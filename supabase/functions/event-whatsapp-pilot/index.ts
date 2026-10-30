import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { executeDiagnosticReceiptRead } from '../_shared/diagnostic-receipt-client.ts';
import { executeWhatsAppPilot } from '../_shared/whatsapp-pilot.ts';
const cors={'Access-Control-Allow-Origin':'https://leorangel22.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const trace=(stage:'REQUEST_POST'|'ENV_UNAVAILABLE'|'ENV_CONFIRMED'|'AUTH_STARTED'|'AUTH_REFUSED'|'AUTH_CONFIRMED'|'MASTER_STARTED'|'MASTER_REFUSED'|'MASTER_CONFIRMED'|'PARSE_STARTED'|'PARSE_CONFIRMED'|'SERVICE_UNAVAILABLE'|'WORKER_READY'|'DIAGNOSTIC_ROUTED'|'LEGACY_ROUTED'|'RESULT_RETURNED'|'HANDLER_UNCONFIRMED')=>{try{console.log(JSON.stringify({phase:'EVENT_WHATSAPP_PILOT_STAGE',stage}));}catch{}};
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return respond({ok:false,message:'Use POST autenticado.'},405);
  trace('REQUEST_POST');
  try{
    const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
    if(!url||!anon){trace('ENV_UNAVAILABLE');return respond({ok:false,message:'Servi�o indispon�vel.'},503);}
    trace('ENV_CONFIRMED');
    const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
    trace('AUTH_STARTED');
    const {data:identity,error:authError}=await caller.auth.getUser();
    if(authError||!identity?.user){trace('AUTH_REFUSED');return respond({ok:false,message:'Entre com sua conta.'},401);}
    trace('AUTH_CONFIRMED');
    trace('MASTER_STARTED');
    const {data:master,error:roleError}=await caller.rpc('is_super_admin');
    if(roleError||master!==true){trace('MASTER_REFUSED');return respond({ok:false,message:'Acesso exclusivo do respons�vel autorizado pelo piloto.'},403);}
    trace('MASTER_CONFIRMED');
    trace('PARSE_STARTED');
    const raw=await req.text();if(raw.length>2048)return respond({ok:false,message:'Solicita��o inv�lida.'},413);
    const input=JSON.parse(raw);trace('PARSE_CONFIRMED');
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!service){trace('SERVICE_UNAVAILABLE');return respond({ok:false,message:'Registro interno indispon�vel.'},503);}
    const worker=createClient(url,service,{auth:{persistSession:false}});
    trace('WORKER_READY');
    const diagnostic=input?.action==='reconcileReceipt';trace(diagnostic?'DIAGNOSTIC_ROUTED':'LEGACY_ROUTED');
    const result=diagnostic
      ? await executeDiagnosticReceiptRead(input,{caller,worker,env:(name:string)=>Deno.env.get(name)})
      : await executeWhatsAppPilot(input,{caller,worker,mode:()=>Deno.env.get('EVENT_BOT_SEND_MODE')||''});
    trace('RESULT_RETURNED');return respond(result.body,result.status);
  }catch{trace('HANDLER_UNCONFIRMED');return respond({ok:false,message:'Opera��o n�o confirmada. N�o repetir; confira o registro.'},503);}
});

