import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sameSecret } from '../_shared/channel-events.ts';
import { providerFetch, syncEmailDeliveries } from '../_shared/email-delivery.ts';

const json=(status:number,message:string)=>new Response(JSON.stringify({ok:status===200,message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json(405,'Use POST');
  const worker=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
  try{
    const {data:config,error}=await worker.rpc('event_channel_worker_config',{target_provider:'zepto'});
    if(error)return json(503,'Configuração indisponível');
    if(!config||!sameSecret(req.headers.get('x-event-job-key')||'',config.delivery_job_key))return json(401,'Origem não autenticada');
    const payload=await req.json();
    if(payload.action==='diagnose'){
      // Read-only service diagnostic for the authorized project administrator.
      // Never returns API tokens, callback secrets or complete callback URLs.
      const instance=Deno.env.get('ZAPI_INSTANCE_ID'),token=Deno.env.get('ZAPI_TOKEN'),clientToken=Deno.env.get('ZAPI_CLIENT_TOKEN')||Deno.env.get('CLIENT_TOKEN');
      const status:any={emailLogsConfigured:['EVENT_ZOHO_CLIENT_ID','EVENT_ZOHO_CLIENT_SECRET','EVENT_ZOHO_REFRESH_TOKEN'].every(k=>Boolean(Deno.env.get(k))),replyToEmail:Deno.env.get('PROPOSAL_REPLY_TO_EMAIL')||'eventos@embaixadacarioca.com.br'};
      if(instance&&token&&clientToken){
        const me=await providerFetch(`https://api.z-api.io/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}/me`,{headers:{'Client-Token':clientToken}});
        const {data:z}=await worker.rpc('event_channel_worker_config',{target_provider:'zapi'});
        const own=`${Deno.env.get('SUPABASE_URL')}/functions/v1/event-channel-webhook?provider=zapi&key=${encodeURIComponent(z.secret)}`;
        status.whatsapp={instanceId:instance,connected:me.connected===true,received:{present:Boolean(me.receivedCallbackUrl),ours:me.receivedCallbackUrl===own},receipts:{present:Boolean(me.messageStatusCallbackUrl),ours:me.messageStatusCallbackUrl===own}};
      }else status.whatsapp={credentialsConfigured:false};
      return new Response(JSON.stringify({ok:true,diagnostic:status}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }
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
