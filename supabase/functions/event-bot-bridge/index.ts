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
    if(!diagnose&&(config.enabled!==true||config.channel_enabled!==true))return json(409,{ok:false,message:'Ponte ainda não ativada'});
    const base=Deno.env.get('EVENT_BOT_BRIDGE_URL')||'',secret=Deno.env.get('EVENT_BOT_BRIDGE_SECRET')||'';
    if(diagnose&&(!base||secret.length<32))return json(409,{ok:false,message:'Configuração da ponte pendente',diagnostic:{configured:false,urlConfigured:Boolean(base),secretConfigured:secret.length>=32}});
    let current=Number(config.cursor||0);
    const url=botBridgeUrl(base);
    if(diagnose){
      const result=normalizeBotBridgeResult(await fetchBotBridge(url,secret,{probe:1,tenant:'embaixada_urca'}),current);
      if(config.expected_account&&result.account!==config.expected_account)throw new Error('Conta divergente');
      return json(200,{ok:true,diagnostic:{configured:true,account:result.account,reachable:true}});
    }
    let received=0,hasMore=false;
    const deadline=Date.now()+20000;
    for(let page=0;page<10;page++){
      const result=normalizeBotBridgeResult(await fetchBotBridge(url,secret,{cursor:current,limit:100,tenant:'embaixada_urca'},deadline-Date.now()),current);
      if(!config.expected_account||result.account!==config.expected_account)throw new Error('Conta divergente');
      if(result.hasMore&&result.nextCursor===current)throw new Error('Ponte sem avanço de cursor');
      const {error:commitError}=await worker.rpc('event_bot_bridge_commit',{account_id:result.account,expected_cursor:current,next_cursor_value:result.nextCursor,events:result.events});
      if(commitError)throw new Error('Falha ao persistir lote e cursor');
      received+=result.events.length;current=result.nextCursor;hasMore=result.hasMore;
      if(!hasMore||Date.now()>=deadline)break;
    }
    return json(200,{ok:true,message:'Consulta concluída',received,hasMore});
  }catch{
    // A diagnose action is strictly read-only, including its failure path.
    if(!diagnose)await worker.rpc('event_bot_bridge_result',{next_cursor_value:null,healthy_value:false,diagnostic_value:'Ponte temporariamente indisponível; cursor preservado.'});
    return json(503,{ok:false,message:'Ponte indisponível'});
  }
});
