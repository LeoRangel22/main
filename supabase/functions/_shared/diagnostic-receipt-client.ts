import { botPostJson } from './bot-dispatch.ts';
import { reconcileDiagnosticReceipt } from './diagnostic-receipt.ts';

// This is the existing approved Bot deployment, not a URL supplied by a caller.
const endpoint='https://script.google.com/macros/s/AKfycbzNGnL3nMHDHX_xLfg7g-XpvAheJsoiyflp7yMW8vSjp9z5iOAjqPZ0TX9w_XAjkDzE/exec';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
type Dependencies={caller:any;worker:any;env:(name:string)=>string|undefined;post?:typeof botPostJson;now?:()=>number};
const reply=(status:number,code:string,message:string,extra:Record<string,unknown>={})=>({status,body:{ok:false,code,message,willSend:false,...extra}});
function config(d:Dependencies,pilotId:string) {
  const env=d.env,now=(d.now||Date.now)();
  const rawStart=env('EVENT_BOT_DIAGNOSTIC_READ_STARTED_AT')||'',rawEnd=env('EVENT_BOT_DIAGNOSTIC_READ_EXPIRES_AT')||'';
  const start=Date.parse(rawStart),end=Date.parse(rawEnd);
  const secret=env('EVENT_BOT_SEND_SECRET')||'',url=env('EVENT_BOT_SEND_URL')||'';
  if(env('EVENT_BOT_DIAGNOSTIC_READ_ENABLED')!=='true'||env('EVENT_BOT_DIAGNOSTIC_PILOT_ID')!==pilotId||
    env('EVENT_BOT_SEND_ENABLED')!=='false'||env('EVENT_BOT_PILOT_ENABLED')!=='false'||url!==endpoint||secret.length<32||
    !Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString()!==rawStart||new Date(end).toISOString()!==rawEnd||
    start>now||end<=now||end<=start||end-start>900000)throw Error('unavailable');
  return {start,end,secret,url};
}
function context(p:any) {
  if(!p||p.network_attempted!==true)throw Error('unavailable');
  // Owner-bound metadata reader: no destination/body is fetched at all.
  return {id:p.id,status:p.status,attempts:p.attempts,provider_id:p.provider_id,content_hash:p.content_hash,claimed_at:p.claimed_at};
}
function readback(v:any,pilotId:string,pilot:any) {
  const keys=['pilotId','sendStatus','attempts','deliveredAt','readAt','replyAt','deliveryConfirmed','replyConfirmed','replyImpliesReceipt'];
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>k!=='context'&&!keys.includes(k))||
    JSON.stringify(context(v.context))!==JSON.stringify(pilot)||
    v.pilotId!==pilotId||v.sendStatus!=='accepted'||v.attempts!==1||
    ['deliveredAt','readAt','replyAt'].some(k=>v[k]!==null&&(typeof v[k]!=='string'||!Number.isFinite(Date.parse(v[k]))))||
    ['deliveryConfirmed','replyConfirmed','replyImpliesReceipt'].some(k=>typeof v[k]!=='boolean')||
    v.deliveryConfirmed!==(v.deliveredAt!==null||v.readAt!==null)||v.replyConfirmed!==(v.replyAt!==null)||v.replyImpliesReceipt!==v.replyConfirmed)throw Error('unavailable');
  return Object.fromEntries(keys.map(k=>[k,v[k]]));
}

// Called only after the existing Edge JWT/getUser/Master checks. There is no
// dispatch/claim branch here and no callback/receipt accepted from the browser.
export async function executeDiagnosticReceiptRead(input:unknown,d:Dependencies) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['action','pilotId'].includes(k))||
    (input as any).action!=='reconcileReceipt'||!uuid((input as any).pilotId))return reply(400,'INVALID_REQUEST','Solicita��o inv�lida.');
  const pilotId=(input as any).pilotId as string;
  // Fixed stage names only: never log payloads, identities, credentials or errors.
  const mark=(stage:'CONFIG_CONFIRMED'|'CONTEXT_CONFIRMED'|'BOT_REQUEST_STARTED'|'BOT_RESPONSE_RECEIVED'|'SOURCE_VALIDATED'|'WRITE_STARTED'|'WRITE_CONFIRMED'|'SOURCE_UNCONFIRMED'|'WRITE_UNCONFIRMED'|'READBACK_CONFIRMED'|'READBACK_UNCONFIRMED'|'BOT_DEADLINE_INVALID'|'BOT_FETCH_ABORTED'|'BOT_FETCH_FAILED'|'BOT_REDIRECT_MISSING'|'BOT_REDIRECT_INVALID'|'BOT_REDIRECT_REFUSED'|'BOT_REDIRECT_LIMIT'|'BOT_HTTP_ERROR'|'BOT_BODY_ABORTED'|'BOT_BODY_READ_FAILED'|'BOT_RESPONSE_TOO_LARGE'|'BOT_JSON_INVALID')=>{try{console.log(JSON.stringify({phase:'EVENT_DIAGNOSTIC_RECEIPT_STAGE',stage}));}catch{}};
  let initial:ReturnType<typeof config>;
  try{initial=config(d,pilotId);}catch{return reply(409,'DIAGNOSTIC_READ_CLOSED','Leitura diagn�stica fechada ou fora do escopo.');}
  mark('CONFIG_CONFIRMED');
  let pilot:any;
  try {
    const r=await d.caller.rpc('get_event_whatsapp_pilot_receipt',{target_pilot:pilotId});
    if(r.error||!r.data)return reply(403,'PILOT_UNAVAILABLE','Piloto indispon�vel para esta conta.');
    pilot=context(r.data.context);mark('CONTEXT_CONFIRMED');
  }catch{return reply(503,'PILOT_CONTEXT_UNCONFIRMED','Contexto do piloto n�o confirmado.');}
  const sameWindow=()=>{const current=config(d,pilotId);if(current.start!==initial.start||current.end!==initial.end||current.url!==initial.url||current.secret!==initial.secret)throw Error('unavailable');return current;};
  let commit:any;
  try {
    commit=await reconcileDiagnosticReceipt(pilotId,{
      readOwnedPilot:async()=>pilot,
      fetchAuthenticatedReceipt:async request=>{
        const current=sameWindow(),now=(d.now||Date.now)();
        const payload={version:2,action:'events_diagnostic_receipt',tenant:'embaixada_urca',scope:request.scope,
          contentHash:request.contentHash,originalProviderId:request.originalProviderId,sentAt:new Date(now).toISOString(),credential:current.secret};
        mark('BOT_REQUEST_STARTED');
        const page=await (d.post||botPostJson)(current.url,payload,Math.min(15000,current.end-now),262144,stage=>mark(stage));
        mark('BOT_RESPONSE_RECEIVED');sameWindow();return page;
      },
      commit:async(id,events)=>{
        mark('SOURCE_VALIDATED');sameWindow();
        // Recheck the owner-bound immutable context before a service write.
        const fresh=await d.caller.rpc('get_event_whatsapp_pilot_receipt',{target_pilot:id});
        if(fresh.error||JSON.stringify(context(fresh.data?.context))!==JSON.stringify(pilot))throw Error('unavailable');
        sameWindow();
        mark('WRITE_STARTED');
        const r=await d.worker.rpc('reconcile_event_whatsapp_pilot',{target_pilot:id,receipt_events:events});
        if(r.error||!r.data||r.data.pilotId!==id||r.data.sendStatus!=='accepted'||r.data.attempts!==1||
          !Number.isSafeInteger(r.data.inserted)||r.data.inserted<0||r.data.inserted>100)throw Error('unavailable');
        mark('WRITE_CONFIRMED');return {inserted:r.data.inserted};
      }
    });
  }catch(e){
    const uncertain=(e as any)?.writeMayHaveOccurred===true;
    mark(uncertain?'WRITE_UNCONFIRMED':'SOURCE_UNCONFIRMED');
    return reply(503,uncertain?'DIAGNOSTIC_RECEIPT_COMMIT_UNCONFIRMED':'DIAGNOSTIC_RECEIPT_SOURCE_UNCONFIRMED',
      uncertain?'Concilia��o sem confirma��o. Consulte o recibo antes de repetir.':'Origem ou correla��o n�o confirmada. Nenhuma concilia��o iniciada.',{writeMayHaveOccurred:uncertain});
  }
  try {
    const r=await d.caller.rpc('get_event_whatsapp_pilot_receipt',{target_pilot:pilotId});
    if(r.error)throw Error('unavailable');
    const receipt=readback(r.data,pilotId,pilot);mark('READBACK_CONFIRMED');
    return {status:200,body:{ok:true,willSend:false,inserted:commit.inserted,receipt}};
  }catch{mark('READBACK_UNCONFIRMED');return reply(503,'DIAGNOSTIC_RECEIPT_READBACK_UNCONFIRMED','Persist�ncia confirmada, mas leitura final indispon�vel. Consulte o recibo; n�o repetir automaticamente.',{writeMayHaveOccurred:true,persistenceConfirmed:true});}
}

