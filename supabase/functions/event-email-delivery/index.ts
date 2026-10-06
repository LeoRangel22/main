import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sameSecret } from '../_shared/channel-events.ts';
import { syncEmailDeliveries } from '../_shared/email-delivery.ts';

const json=(status:number,message:string)=>new Response(JSON.stringify({ok:status===200,message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json(405,'Use POST');
  const worker=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
  try{
    const {data:config,error}=await worker.rpc('event_channel_worker_config',{target_provider:'zepto'});
    if(error)return json(503,'Configuração indisponível');
    if(!config||!sameSecret(req.headers.get('x-event-job-key')||'',config.delivery_job_key))return json(401,'Origem não autenticada');
    if(!config.enabled||!config.delivery_sync_ready)return json(409,'Consulta automática ainda não ativada');
    const result=await syncEmailDeliveries(worker);
    const {error:saveError}=await worker.rpc('event_delivery_sync_result',{ready:result.ok,diagnostic:result.message});
    if(saveError)return json(503,'Resultado da consulta indisponível');
    return json(result.ok?200:409,result.message);
  }catch{
    await worker.rpc('event_delivery_sync_result',{ready:true,diagnostic:'Consulta indisponível; nova tentativa no próximo ciclo. Nenhuma entrega presumida.'});
    return json(503,'Consulta indisponível');
  }
});
