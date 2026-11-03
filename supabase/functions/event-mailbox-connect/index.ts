import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { mailboxBoundedText } from '../_shared/zoho-mailbox.ts';
import { mailboxOAuth } from '../_shared/mailbox-oauth.ts';
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
    const identity=await caller.auth.getUser();
    if(identity.error||!identity.data?.user||!identity.data.user.email_confirmed_at)return respond(401,{ok:false,code:'session_required'});
    const role=await caller.rpc('is_super_admin'),team=await caller.rpc('is_team_member');
    if(role.error||role.data!==true||team.error||team.data!==true)return respond(403,{ok:false,code:'owner_required'});
    let payload;try{payload=JSON.parse(await mailboxBoundedText(req,12288));}catch{return respond(400,{ok:false,code:'request_invalid'});}
    const worker=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
    const result=await mailboxOAuth(payload,{actor:identity.data.user.id,env:k=>Deno.env.get(k),caller:(n,a)=>caller.rpc(n,a),worker:(n,a)=>worker.rpc(n,a)});
    return respond(result.ok?200:409,result);
  }catch{return respond(503,{ok:false,code:'connection_unconfirmed',retryAllowed:false,captureActivated:false});}
});
