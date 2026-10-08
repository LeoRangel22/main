import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sameSecret } from '../_shared/channel-events.ts';
import { botBridgeUrl, fetchBotBridge, normalizeBotBridgeResult } from '../_shared/bot-bridge.ts';

const json=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json(405,{ok:false,message:'Use POST'});
  const worker=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
  let diagnose=false;
  try{
    const {data:config,error}=await worker.rpc('event_bot_bridge_worker_config');
    if(error||!config)return json(503,{ok:false,message:'Configuração indisponível'});
    if(!sameSecret(req.headers.get('x-event-job-key')||'',config.job_key||''))return json(401,{ok:false,message:'Origem não autenticada'});
    const payload=await req.json();diagnose=payload.action==='diagnose';
    const base=Deno.env.get('EVENT_BOT_BRIDGE_URL')||'',secret=Deno.env.get('EVENT_BOT_BRIDGE_SECRET')||'';
    const current=Number(config.cursor||0);
    const url=botBridgeUrl(base);
    const result=normalizeBotBridgeResult(await fetchBotBridge(url,secret,diagnose?{probe:1,tenant:'embaixada_urca'}:{cursor:current,limit:100,tenant:'embaixada_urca'}),current);
    if(diagnose)return json(200,{ok:true,diagnostic:{configured:true,account:result.account,reachable:true}});
    if(config.enabled!==true||config.channel_enabled!==true)return json(409,{ok:false,message:'Ponte ainda não ativada'});
    if(result.events.length){
      const {error:ingestError}=await worker.rpc('ingest_event_provider_events',{target_provider:'zapi',events:result.events});
      if(ingestError)throw new Error('Falha ao persistir eventos');
    }
    const {error:saveError}=await worker.rpc('event_bot_bridge_result',{next_cursor_value:result.nextCursor,healthy_value:true,diagnostic_value:`Ponte consultada; ${result.events.length} evento(s) recebido(s).`});
    if(saveError)throw new Error('Falha ao avançar cursor');
    return json(200,{ok:true,message:'Consulta concluída',received:result.events.length,hasMore:result.hasMore});
  }catch{
    // A diagnose action is strictly read-only, including its failure path.
    if(!diagnose)await worker.rpc('event_bot_bridge_result',{next_cursor_value:null,healthy_value:false,diagnostic_value:'Ponte temporariamente indisponível; cursor preservado.'});
    return json(503,{ok:false,message:'Ponte indisponível'});
  }
});
