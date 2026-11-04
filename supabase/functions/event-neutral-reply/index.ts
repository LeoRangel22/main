import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { mailboxBoundedText } from '../_shared/zoho-mailbox.ts';
import { mailboxTokenEnvironment } from '../_shared/mailbox-token-source.ts';
import { prepareNeutralReply } from '../_shared/neutral-reply-reader.ts';
// Local candidate. Imports are mapped to _shared when sealed into a deployable tree.
const ORIGIN='https://leorangel22.github.io';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const respond=(status:number,value:any)=>new Response(JSON.stringify(value),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.headers.get('Origin')!==ORIGIN)return respond(403,{ok:false,code:'origin_rejected'});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return respond(405,{ok:false,code:'method_invalid'});
 try{
  const url=Deno.env.get('SUPABASE_URL')||'';
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const identity=await caller.auth.getUser(),actor=identity.data?.user;
  if(identity.error||!actor?.email_confirmed_at)return respond(401,{ok:false,code:'session_required'});
  const [master,team]=await Promise.all([caller.rpc('is_super_admin'),caller.rpc('is_team_member')]);
  if(master.error||master.data!==true||team.error||team.data!==true)return respond(403,{ok:false,code:'owner_required'});
  let payload;try{payload=JSON.parse(await mailboxBoundedText(req,1024));}catch{return respond(400,{ok:false,code:'request_invalid'});}
  if(!payload||Object.keys(payload).length!==1||typeof payload.reviewId!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(payload.reviewId))return respond(400,{ok:false,code:'request_invalid'});
  const status=await caller.rpc('event_neutral_reply_status',{target_review:payload.reviewId});
  if(status.error||!['authorized','prepared'].includes(status.data?.state)||status.data.captureActive!==false)return respond(409,{ok:false,code:'review_unavailable',captureActivated:false});
  const worker=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
  const context=await worker.rpc('event_neutral_reply_worker_context',{target_review:payload.reviewId,actor:actor.id});
  if(context.error)return respond(409,{ok:false,code:'review_unavailable',captureActivated:false});
  const env=await mailboxTokenEnvironment(worker,context.data.accountId,k=>Deno.env.get(k));
  const reply=await prepareNeutralReply(context.data,env);
  const preview=await worker.rpc('event_neutral_reply_store_preview',{target_review:payload.reviewId,actor:actor.id,verified_reply:reply});
  if(preview.error)return respond(409,{ok:false,code:'preview_unconfirmed',captureActivated:false});
  // Caller-side owner check again before returning the private preview body.
  const final=await caller.rpc('event_neutral_reply_status',{target_review:payload.reviewId});
  if(final.error||final.data?.state!=='prepared'||final.data?.previewSha256!==preview.data?.previewSha256||final.data.captureActive!==false)return respond(409,{ok:false,code:'preview_unconfirmed',captureActivated:false});
  return respond(200,{ok:true,...final.data,persisted:false,captureActivated:false});
 }catch{return respond(503,{ok:false,code:'reply_read_unconfirmed',persisted:false,captureActivated:false,retryAllowed:false});}
});
