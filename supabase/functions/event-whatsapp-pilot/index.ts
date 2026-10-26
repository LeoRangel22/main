import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { executeWhatsAppPilot } from '../_shared/whatsapp-pilot.ts';
const cors={'Access-Control-Allow-Origin':'https://leorangel22.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return respond({ok:false,message:'Use POST autenticado.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
    if(!url||!anon)return respond({ok:false,message:'Serviço indisponível.'},503);
    const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
    const {data:identity,error:authError}=await caller.auth.getUser();
    if(authError||!identity?.user)return respond({ok:false,message:'Entre com sua conta.'},401);
    const {data:master,error:roleError}=await caller.rpc('is_super_admin');
    if(roleError||master!==true)return respond({ok:false,message:'Acesso exclusivo do responsável autorizado pelo piloto.'},403);
    const raw=await req.text();if(raw.length>2048)return respond({ok:false,message:'Solicitação inválida.'},413);
    const input=JSON.parse(raw);
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!service)return respond({ok:false,message:'Registro interno indisponível.'},503);
    const worker=createClient(url,service,{auth:{persistSession:false}});
    const result=await executeWhatsAppPilot(input,{caller,worker,mode:()=>Deno.env.get('EVENT_BOT_SEND_MODE')||''});
    return respond(result.body,result.status);
  }catch{return respond({ok:false,message:'Operação não confirmada. Não repetir; confira o registro.'},503);}
});
