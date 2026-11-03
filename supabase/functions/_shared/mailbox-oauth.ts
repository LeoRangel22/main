// Local candidate. Secret values stay server-side; only fixed metadata is returned.
import { mailboxJson } from './zoho-mailbox.ts';
const MAILBOX='eventos@embaixadacarioca.com.br';
const SCOPES=['ZohoMail.accounts.READ','ZohoMail.folders.READ','ZohoMail.messages.READ'];
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9._~-]{1,8192}$/;
type Rpc=(name:string,args:Record<string,unknown>)=>Promise<{data:any,error:any}>;
type Dependencies={caller:Rpc,worker:Rpc,actor:string,env:(name:string)=>string|undefined,fetcher?:typeof fetch};
const stopped=(stage:string)=>({ok:false,code:'connection_unconfirmed',stage,retryAllowed:false,captureActivated:false});
function exact(value:any,keys:string[]){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function account(response:any){
  if(!Array.isArray(response?.data))throw Error('account_invalid');
  const selected=response.data.filter((a:any)=>a&&a.type==='ZOHO_ACCOUNT'&&a.mailboxStatus==='enabled'&&a.incomingBlocked===false&&
    (Object.hasOwn(a,'enabled')?a.enabled===true:a.status===true)&&(!Object.hasOwn(a,'status')||a.status===true)&&
    Array.isArray(a.emailAddress)&&a.emailAddress.filter((e:any)=>e?.isPrimary===true&&e.isConfirmed===true&&typeof e.mailId==='string'&&e.mailId.toLowerCase()===MAILBOX).length===1);
  if(selected.length!==1||typeof selected[0].accountId!=='string'||!/^\d{1,40}$/.test(selected[0].accountId))throw Error('account_invalid');
  return selected[0].accountId;
}
async function clientFingerprint(id:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function statusMetadata(value:any){
  if(!value||typeof value!=='object'||!['absent','prepared','claimed','stored','uncertain','expired'].includes(value.state))throw Error('status_invalid');
  if(value.state==='prepared'&&(!UUID.test(value.attempt_id)||typeof value.expires_at!=='string'))throw Error('status_invalid');
  return {state:value.state,connected:value.state==='stored',...(value.state==='prepared'?{attemptId:value.attempt_id,expiresAt:value.expires_at}:{}),captureActivated:false,retryAllowed:false};
}
export async function mailboxOAuth(payload:any,d:Dependencies){
  let stage='VALIDATE',attempt:string|undefined,claimed=false;
  try{
    if(!UUID.test(d.actor))return stopped(stage);
    if(payload?.action==='status'&&exact(payload,['action'])){
      const r=await d.caller('event_mailbox_oauth_status',{});if(r.error)return stopped('STATUS');
      return {ok:true,...statusMetadata(r.data)};
    }
    if(payload?.action!=='prepare'&&payload?.action!=='complete')return stopped(stage);
    const client=d.env('EVENT_MAILBOX_CLIENT_ID')||'',secret=d.env('EVENT_MAILBOX_CLIENT_SECRET')||'';
    if(!TOKEN.test(client)||!TOKEN.test(secret)||d.env('EVENT_MAILBOX_REFRESH_TOKEN'))return stopped('CONFIGURATION');
    const fingerprint=await clientFingerprint(client);
    if(payload.action==='prepare'){
      if(!exact(payload,['action']))return stopped(stage);
      const r=await d.caller('event_mailbox_oauth_prepare',{client_fingerprint:fingerprint});
      if(r.error||!r.data||!UUID.test(r.data.attempt_id)||typeof r.data.expires_at!=='string')return stopped('PREPARE');
      return {ok:true,state:'prepared',attemptId:r.data.attempt_id,expiresAt:r.data.expires_at,captureActivated:false};
    }
    if(!exact(payload,['action','attemptId','code','scopesConfirmed'])||!UUID.test(payload.attemptId)||payload.scopesConfirmed!==true||typeof payload.code!=='string'||!TOKEN.test(payload.code))return stopped(stage);
    attempt=payload.attemptId;
    stage='CLAIM';const claim=await d.caller('event_mailbox_oauth_claim',{target_attempt:attempt,client_fingerprint:fingerprint});
    if(claim.error||claim.data?.claimed!==true)return stopped(stage);
    claimed=true;
    stage='EXCHANGE';
    const token=await mailboxJson('https://accounts.zoho.com/oauth/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client,client_secret:secret,code:payload.code})},32768,d.fetcher);
    payload.code='';
    if(typeof token.access_token!=='string'||typeof token.refresh_token!=='string'||!TOKEN.test(token.access_token)||!TOKEN.test(token.refresh_token))throw Error('token_invalid');
    if(Object.hasOwn(token,'scope')){
      if(typeof token.scope!=='string')throw Error('scope_invalid');
      const scopes=token.scope.split(/[,\s]+/).filter(Boolean);
      if(scopes.length!==3||new Set(scopes).size!==3||scopes.some((s:string)=>!SCOPES.includes(s)))throw Error('scope_invalid');
    }
    stage='CLAIM_READBACK';const before=await d.caller('event_mailbox_oauth_claim_status',{target_attempt:attempt});
    if(before.error||before.data?.active!==true)throw Error('claim_expired');
    stage='ACCOUNT';
    const verified=account(await mailboxJson('https://mail.zoho.com/api/accounts',{method:'GET',headers:{Authorization:'Zoho-oauthtoken '+token.access_token,Accept:'application/json'}},131072,d.fetcher));
    token.access_token='';
    stage='STORE';
    const committed=await d.worker('event_mailbox_oauth_store',{target_attempt:attempt,owner_id:d.actor,target_account:verified,refresh_value:token.refresh_token,client_fingerprint:fingerprint});
    token.refresh_token='';
    if(committed.error||committed.data?.stored!==true)throw Error('store_unconfirmed');
    stage='STATUS';const after=await d.caller('event_mailbox_oauth_status',{});
    if(after.error||after.data?.state!=='stored')throw Error('readback_unconfirmed');
    return {ok:true,code:'mailbox_connected',...statusMetadata(after.data),mailbox:MAILBOX};
  }catch{
    if(claimed&&attempt){
      try{await d.worker('event_mailbox_oauth_uncertain',{target_attempt:attempt,owner_id:d.actor,diagnostic:stage});}catch{/* Preserve unknown claim; never rearm. */}
      try{const r=await d.caller('event_mailbox_oauth_status',{});if(!r.error&&r.data?.state==='stored')return {ok:true,code:'mailbox_connected',...statusMetadata(r.data),mailbox:MAILBOX};}catch{/* Keep uncertainty. */}
    }
    return stopped(stage);
  }finally{if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.hasOwn(payload,'code'))payload.code='';}
}
