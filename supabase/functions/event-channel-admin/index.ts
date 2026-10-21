import { providerFetch, syncEmailDeliveries } from '../_shared/email-delivery.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { botBridgeUrl, fetchBotBridge, normalizeBotBridgeResult, verifyBotCallbacks } from '../_shared/bot-bridge.ts';

const cors = { 'Access-Control-Allow-Origin': 'https://leorangel22.github.io', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const respond = (status: number, data: any) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return respond(405, { ok: false, message: 'Use POST' });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { data: identity, error: authError } = await caller.auth.getUser();
    if (authError || !identity?.user) return respond(401, { ok: false, message: 'Entre com o usuário da equipe' });
    const { data: team } = await caller.rpc('is_team_member');
    if (!team) return respond(403, { ok: false, message: 'Acesso exclusivo da equipe' });
    const payload = await req.json();
    const worker = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false } });
    if (payload.action === 'sync-email') {
      const result=await syncEmailDeliveries(worker);
      await worker.rpc('event_delivery_sync_result',{ready:result.ok,diagnostic:result.message});
      return respond(result.ok?200:409,result);
    }
    const { data: manager } = await caller.rpc('is_super_admin');
    if (!manager) return respond(403, { ok: false, message: 'Configuração exclusiva do gestor' });
    if (!['inspect-zapi', 'activate-zapi', 'inspect-bot-bridge', 'activate-bot-bridge'].includes(payload.action)) return respond(400, { ok: false, message: 'Ação desconhecida' });
    if (payload.action === 'activate-zapi') return respond(409,{ok:false,message:'O Bot é o único responsável pelos callbacks. Use a ponte de leitura restrita.'});
    if (payload.action === 'inspect-bot-bridge' || payload.action === 'activate-bot-bridge') {
      const bridgeUrl=Deno.env.get('EVENT_BOT_BRIDGE_URL')||'',bridgeSecret=Deno.env.get('EVENT_BOT_BRIDGE_SECRET')||'';
      const {data:bridgeConfig,error:bridgeConfigError}=await worker.rpc('event_bot_bridge_worker_config');
      const scope=String(bridgeConfig?.scope_id||'');
      if(bridgeConfigError||!scope)return respond(409,{ok:false,message:'O escopo privado da ponte ainda precisa de aprovação e configuração.'});
      const bridge=normalizeBotBridgeResult(await fetchBotBridge(botBridgeUrl(bridgeUrl),bridgeSecret,{probe:1,scope}),0,scope);
      if(payload.action==='inspect-bot-bridge')return respond(200,{ok:true,instanceId:bridge.account,scopeId:scope,connected:true,message:'Ponte do Bot autenticada. Nenhum callback foi alterado.'});
      if(payload.approved!==true)return respond(409,{ok:false,message:'Revise a ponte e aprove a ativação'});
      if(payload.scopeId!==scope)return respond(409,{ok:false,message:'O escopo mudou. Verifique e revise a ponte novamente.'});
      if(payload.instanceId!==bridge.account)return respond(409,{ok:false,message:'Verifique novamente a ponte antes de ativar'});
      if(bridge.account!=='bot:embaixada_urca')return respond(409,{ok:false,message:'A ponte não pertence à conta da Embaixada'});
      const instance=Deno.env.get('ZAPI_INSTANCE_ID'),token=Deno.env.get('ZAPI_TOKEN'),clientToken=Deno.env.get('ZAPI_CLIENT_TOKEN')||Deno.env.get('CLIENT_TOKEN');
      if(!instance||!token||!clientToken)return respond(409,{ok:false,message:'Credenciais da instância não configuradas'});
      const me=await providerFetch(`https://api.z-api.io/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}/me`,{headers:{'Client-Token':clientToken}});
      try{verifyBotCallbacks(me,bridgeUrl);}catch{return respond(409,{ok:false,message:'Ativação bloqueada: confirme que os dois callbacks pertencem ao Bot verificado.'});}
      const {error:bridgeError}=await worker.rpc('event_bot_bridge_activate',{account_id:bridge.account+'|'+scope,initial_cursor:bridge.nextCursor});
      if(bridgeError)throw new Error('Não foi possível ativar a ponte');
      return respond(200,{ok:true,instanceId:bridge.account,scopeId:scope,activated:true,message:'Ponte ativada sem alterar callbacks. Aguardando novos retornos autenticados.'});
    }
    const instance = Deno.env.get('ZAPI_INSTANCE_ID'), token = Deno.env.get('ZAPI_TOKEN'), clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || Deno.env.get('CLIENT_TOKEN');
    if (!instance || !token || !clientToken) return respond(409, { ok: false, message: 'Credenciais da instância não configuradas' });
    const base = `https://api.z-api.io/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}`;
    const headers = { 'Client-Token': clientToken, 'Content-Type': 'application/json' };
    const me = await providerFetch(base + '/me', { headers });
    let callbacksVerified=false;
    try { verifyBotCallbacks(me,Deno.env.get('EVENT_BOT_BRIDGE_URL')||'');callbacksVerified=true; } catch { /* Read-only inspection, never replace callbacks. */ }
    return respond(200,{ok:true,instanceId:instance,connected:me.connected===true,callbacksVerified,
      message:callbacksVerified?'Callbacks pertencem ao Bot. Verifique separadamente a ponte restrita de Eventos.':'Confira os callbacks do Bot existente. O Sistema de Eventos não altera nem assume esses callbacks.'});
  } catch { return respond(502, { ok: false, message: 'Não foi possível concluir a consulta/configuração. Confira o provedor antes de repetir.' }); }
});
