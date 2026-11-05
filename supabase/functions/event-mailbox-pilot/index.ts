import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { mailboxBoundedText } from '../_shared/zoho-mailbox.ts';
import { mailboxPilotRequest,leadNotificationPreflight } from '../_shared/mailbox-owner-pilot.ts';
const ORIGIN='https://leorangel22.github.io';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
 'Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const respond=(status:number,value:any)=>new Response(JSON.stringify(value),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.headers.get('Origin')!==ORIGIN)return respond(403,{ok:false,code:'origin_rejected'});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return respond(405,{ok:false,code:'method_invalid'});
 try{
  const caller=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_ANON_KEY')||'',
   {global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const identity=await caller.auth.getUser();
  if(identity.error||!identity.data.user?.email_confirmed_at)return respond(401,{ok:false,code:'session_required'});
  const role=await caller.rpc('is_super_admin'),team=await caller.rpc('is_team_member');
  if(role.error||role.data!==true||team.error||team.data!==true)return respond(403,{ok:false,code:'owner_required'});
  let request;try{request=mailboxPilotRequest(JSON.parse(await mailboxBoundedText(req,2048)));}
  catch{return respond(400,{ok:false,code:'request_invalid'});}
  const env=(key:string)=>Deno.env.get(key);
  const gatesClosed=env('EVENT_PROPOSAL_REPLY_ROUTES_ENABLED')!=='true'&&!env('EVENT_PROPOSAL_REPLY_ROUTE_PILOT');
  const oauth=await caller.rpc('event_mailbox_oauth_status');
  const connectionStored=!oauth.error&&oauth.data?.state==='stored';
  let senderReady=false;
  try{const probe=await fetch((Deno.env.get('SUPABASE_URL')||'')+'/functions/v1/send-proposal-email',{
   method:'POST',headers:{Authorization:req.headers.get('Authorization')||'',apikey:Deno.env.get('SUPABASE_ANON_KEY')||'','Content-Type':'application/json'},
   body:JSON.stringify({dryRun:true}),signal:AbortSignal.timeout(8000)});
   if(probe.ok){const value=JSON.parse(await mailboxBoundedText(probe,4096));senderReady=value.ok===true&&value.mode==='dry-run'&&value.ownerReplyPilotContract==='owner-pilot-v1';}
  }catch{/* Runtime compatibility unconfirmed: no pilot write is allowed. */}
  if(['open','capture','queue'].includes(request.action)&&(!gatesClosed||!connectionStored||!senderReady))
   return respond(409,{ok:false,code:!gatesClosed?'pilot_legacy_gate_active':!connectionStored?'pilot_connection_pending':'pilot_sender_unverified',retryAllowed:false,notApplied:true});
  const result=await caller.rpc('event_owner_mailbox_pilot',request);
  if(result.error){
   const message=String(result.error.message||'');
   const safe=/^(?:pilot_[a-z_]+|owner_required)$/.test(message)?message:'pilot_unconfirmed';
   const notApplied=safe!=='pilot_unconfirmed'&&['P0001','42501'].includes(String(result.error.code));
   return respond(409,{ok:false,code:safe,retryAllowed:false,notApplied});
  }
  return respond(200,{ok:true,pilot:result.data,publicRoutingOff:gatesClosed,connectionStored,senderReady,
   leadAlerts:leadNotificationPreflight(env,result.data?.leadHooks,identity.data.user.email||''),sendsPerformed:0});
 }catch{return respond(503,{ok:false,code:'pilot_unconfirmed',retryAllowed:false});}
});
