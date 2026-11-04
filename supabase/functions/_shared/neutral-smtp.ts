import { Buffer } from 'node:buffer';

const SMTP_HOST='smtp.zeptomail.com';
const SMTP_FROM='leads@embaixadacarioca.com.br';
const SMTP_REPLY='eventos@embaixadacarioca.com.br';
const PILOT_SUBJECT='[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial';
const PILOT_BODY_SHA='3cb5fe4c494dbfc1153166d1f20d762c2b3d784eabdd6a5d53808616d1267099';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{64}$/;
type Gate={startedAt:string;expiresAt:string};
type Content={subject:string;text:string;sender:{address:string;name?:string};replyTo:string};
type Transport={sendMail:(input:any)=>Promise<any>;close:()=>void};
type Dependencies={createTransport?:(options:any)=>Promise<Transport>|Transport;authorize?:()=>Promise<boolean>;now?:()=>number;timeoutMs?:number};

export function neutralSmtpGate(env:(key:string)=>string|undefined,proposalId:string,now=Date.now()):Gate {
 const start=env('EVENT_NEUTRAL_SMTP_STARTED_AT')||'',end=env('EVENT_NEUTRAL_SMTP_EXPIRES_AT')||'';
 const a=Date.parse(start),b=Date.parse(end);
 if(env('EVENT_NEUTRAL_SMTP_ENABLED')!=='true'||env('EVENT_NEUTRAL_SMTP_PROPOSAL_ID')!==proposalId||!UUID.test(proposalId)||
  !start.endsWith('Z')||!end.endsWith('Z')||!Number.isFinite(a)||!Number.isFinite(b)||a>now||b-a>900000||b<=a||b-now<60000)throw Error('SMTP_PILOT_CLOSED');
 return{startedAt:new Date(a).toISOString(),expiresAt:new Date(b).toISOString()};
}
async function smtpDigest(bytes:Uint8Array|string){const b=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes,owned=new Uint8Array(b.byteLength);owned.set(b);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',owned.buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function smtpMailbox(value:string){if(typeof value!=='string'||value.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value))throw Error('SMTP_PILOT_CONTENT_INVALID');return value.toLowerCase();}
function smtpEncodedHeader(value:string){let chunk='',out:string[]=[];for(const c of value){if(Buffer.byteLength(chunk+c,'utf8')>42){out.push('=?UTF-8?B?'+Buffer.from(chunk,'utf8').toString('base64')+'?=');chunk='';}chunk+=c;}if(chunk)out.push('=?UTF-8?B?'+Buffer.from(chunk,'utf8').toString('base64')+'?=');return out.join('\r\n ');}
export async function neutralSmtpMime(content:Content,to:string,messageId:string,now=Date.now()){
 const destination=smtpMailbox(to),senderName=content?.sender?.name;
 if(content?.subject!==PILOT_SUBJECT||content?.sender?.address!==SMTP_FROM||content?.replyTo!==SMTP_REPLY||
  typeof senderName!=='string'||!senderName.trim()||senderName.length>160||/[\x00-\x1f\x7f]/.test(senderName)||
  typeof content?.text!=='string'||await smtpDigest(content.text)!==PILOT_BODY_SHA||
  !new RegExp('^<'+UUID.source.slice(1,-1)+'@embaixadacarioca\\.com\\.br>$','i').test(messageId)||!Number.isFinite(now))throw Error('SMTP_PILOT_CONTENT_INVALID');
 const body=Buffer.from(content.text,'utf8').toString('base64').match(/.{1,76}/g)!.join('\r\n');
 const raw=Buffer.from(['From: '+smtpEncodedHeader(senderName)+' <'+SMTP_FROM+'>','To: <'+destination+'>','Reply-To: '+SMTP_REPLY,
  'Subject: '+smtpEncodedHeader(content.subject),'Date: '+new Date(now).toUTCString(),'Message-ID: '+messageId,
  'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',''+body,''].join('\r\n'),'utf8');
 return{raw,mimeSha256:await smtpDigest(raw),destination,messageId};
}
export function neutralSmtpOptions(password:string){
 if(typeof password!=='string'||! /^[A-Za-z0-9._~+/=-]{16,8192}$/.test(password))throw Error('SMTP_CREDENTIAL_UNAVAILABLE');
 return{host:SMTP_HOST,port:465,secure:true,pool:false,auth:{user:'emailapikey',pass:password},
  tls:{servername:SMTP_HOST,rejectUnauthorized:true,minVersion:'TLSv1.2'},ignoreTLS:false,opportunisticTLS:false,
  connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,dnsTimeout:8000,
  logger:false,debug:false,transactionLog:false,disableFileAccess:true,disableUrlAccess:true,maxRecipients:1};
}
export function neutralSmtpAccepted(info:any,to:string,messageId:string){
 if(!info||typeof info.response!=='string'||info.response.length>2048||!Array.isArray(info.accepted)||info.accepted.length!==1||
  typeof info.accepted[0]!=='string'||info.accepted[0].toLowerCase()!==to||!Array.isArray(info.rejected)||info.rejected.length!==0||
  (info.pending!=null&&(!Array.isArray(info.pending)||info.pending.length!==0))||
  !info.envelope||info.envelope.from!==SMTP_FROM||!Array.isArray(info.envelope.to)||info.envelope.to.length!==1||info.envelope.to[0]!==to||
  (info.messageId!=null&&info.messageId!==messageId))return false;
 const lines:string[]=info.response.split(/\r?\n/);if(lines.length>16||lines.some(l=>l.length>512))return false;
 return lines.every((l,i)=>i===lines.length-1?/^250(?: [\x20-\x7e]*)?$/.test(l):/^250-[\x20-\x7e]*$/.test(l));
}
async function defaultSmtpTransport(options:any):Promise<Transport>{const {default:nodemailer}=await import('npm:nodemailer@10.3.1');return nodemailer.createTransport(options);}

// Only the private, service-only finalizer may create the authenticated outbound binding.
// HTTP provider IDs are deliberately neither fabricated nor populated by this transport.
export async function sendNeutralSmtp(input:{worker:any;send:any;actorId:string;proposalId:string;to:string;content:Content;password:string;gate:Gate},deps:Dependencies={}){
 const now=deps.now||Date.now,worker=input.worker,id=input.send?.id;
 let token='',messageId='',mimeSha256='',transport:Transport|undefined,attempted=false;
 const uncertain=(code:string)=>({ok:false,code,sendId:id,deliveryStatus:'uncertain',messageAttempted:attempted,readbackRequired:true});
 const matches=(r:any)=>r?.mime_sha256===mimeSha256&&r?.origin_message_id===messageId;
 async function readback(){try{const r=await worker.rpc('event_smtp_pilot_status',{target_send:id,claim_token:token});if(!r.error&&matches(r.data)&&r.data.state==='accepted')return{ok:true,code:'SMTP_ACCEPTED',sendId:id,deliveryStatus:'accepted',messageAttempted:attempted,readbackConfirmed:true};}catch{}return null;}
 async function finish(state:string,responseHash:string|null){try{const r=await worker.rpc('event_smtp_pilot_finish',{target_send:id,claim_token:token,result_code:state,mime_sha256:mimeSha256,origin_message_id:messageId,smtp_response_sha256:responseHash,completed_at:new Date(now()).toISOString()});if(r.error||!matches(r.data))return null;return r.data;}catch{return null;}}
 try{
  if(!UUID.test(id||'')||!UUID.test(input.actorId)||!UUID.test(input.proposalId)||input.send.attempts!==1||input.send.status!=='sending')return uncertain('SMTP_CLAIM_INVALID');
  if(Date.parse(input.gate.expiresAt)-now()<60000)return uncertain('SMTP_PILOT_CLOSED');
  messageId='<'+crypto.randomUUID()+'@embaixadacarioca.com.br>';
  const mime=await neutralSmtpMime(input.content,input.to,messageId,now());mimeSha256=mime.mimeSha256;
  // Creating a non-pooled transport must not connect; sendMail is the sole provider call.
  transport=await(deps.createTransport||defaultSmtpTransport)(neutralSmtpOptions(input.password));
  const prepared=await worker.rpc('event_smtp_pilot_prepare',{target_send:id,actor_id:input.actorId,attempt_no:1,origin_message_id:messageId,mime_sha256:mimeSha256,gate_started_at:input.gate.startedAt,gate_expires_at:input.gate.expiresAt});
  if(prepared.error||prepared.data?.state!=='prepared'||!HEX.test(prepared.data?.claim_token||'')||!matches(prepared.data))return uncertain('SMTP_PREPARE_UNCONFIRMED');
  token=prepared.data.claim_token;
  const started=await worker.rpc('event_smtp_pilot_start',{target_send:id,claim_token:token});
  if(started.error||started.data?.state!=='sending'||!matches(started.data)){
   await finish('UNCERTAIN',null);return(await readback())||uncertain('SMTP_START_UNCONFIRMED');
  }
  if(typeof deps.authorize!=='function'||await deps.authorize()!==true){await finish('UNCERTAIN',null);return(await readback())||uncertain('SMTP_AUTHORIZATION_CHANGED');}
  const budget=deps.timeoutMs??25000;if(!Number.isInteger(budget)||budget<1||budget>25000)throw Error('SMTP_DEADLINE_INVALID');
  const remaining=Math.min(Date.parse(started.data.deadline),Date.parse(started.data.gate_expires_at))-now();
  if(!Number.isFinite(remaining)||remaining<25000){await finish('UNCERTAIN',null);return(await readback())||uncertain('SMTP_START_EXPIRED');}
  let timer:ReturnType<typeof setTimeout>;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{try{transport?.close();}catch{}reject(Error('SMTP_DEADLINE'));},budget);});
  let info:any;
  try{attempted=true;info=await Promise.race([transport.sendMail({envelope:{from:SMTP_FROM,to:[mime.destination]},messageId,raw:mime.raw,disableFileAccess:true,disableUrlAccess:true}),deadline]);}
  finally{clearTimeout(timer!);}
  if(!neutralSmtpAccepted(info,mime.destination,messageId)){
   await finish('UNCERTAIN',null);return(await readback())||uncertain('SMTP_RESULT_UNCERTAIN');
  }
  const done=await finish('DATA_250',await smtpDigest(info.response));
  if(done?.state==='accepted')return{ok:true,code:'SMTP_ACCEPTED',sendId:id,deliveryStatus:'accepted',messageAttempted:true};
  return(await readback())||uncertain('SMTP_PERSISTENCE_UNCONFIRMED');
 }catch{
  if(token)await finish('UNCERTAIN',null);
  return(token?await readback():null)||uncertain(attempted?'SMTP_RESULT_UNCERTAIN':'SMTP_PREPARATION_UNCONFIRMED');
 }finally{try{transport?.close();}catch{/* No raw error, token, protocol transcript or message content is logged. */}}
}
