import { providerFetch, syncEmailDeliveries } from '../_shared/email-delivery.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
    if (!['inspect-zapi', 'activate-zapi'].includes(payload.action)) return respond(400, { ok: false, message: 'Ação desconhecida' });
    const instance = Deno.env.get('ZAPI_INSTANCE_ID'), token = Deno.env.get('ZAPI_TOKEN'), clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || Deno.env.get('CLIENT_TOKEN');
    if (!instance || !token || !clientToken) return respond(409, { ok: false, message: 'Credenciais da instância não configuradas' });
    const base = `https://api.z-api.io/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(token)}`;
    const headers = { 'Client-Token': clientToken, 'Content-Type': 'application/json' };
    const { data: config, error } = await worker.rpc('event_channel_worker_config', { target_provider: 'zapi' });
    if (error || !config?.secret) throw new Error('Configuração interna indisponível');
    const callback = `${supabaseUrl}/functions/v1/event-channel-webhook?provider=zapi&key=${encodeURIComponent(config.secret)}`;
    const me = await providerFetch(base + '/me', { headers });
    const fields = ['receivedCallbackUrl', 'messageStatusCallbackUrl'];
    const conflicts = fields.filter(key => me[key] && me[key] !== callback);
    if (payload.action === 'inspect-zapi') return respond(200, { ok: true, instanceId: instance, connected: me.connected === true, conflicts, message: conflicts.length ? 'Há callbacks de outro sistema. Ativação bloqueada para preservar o atendimento existente.' : 'Callbacks disponíveis para o Sistema de Eventos' });
    if (payload.approved !== true) return respond(409, { ok: false, message: 'Revise a instância e aprove a ativação' });
    if (payload.instanceId !== instance) return respond(409, { ok: false, message: 'Verifique a instância e confirme o identificador antes de ativar' });
    if (conflicts.length || me.connected !== true) return respond(409, { ok: false, message: 'Instância desconectada ou usada por outro sistema. Não substituí os callbacks.' });
    const { error: enableError } = await caller.rpc('configure_event_channel', { target_provider: 'zapi', account_id: instance, enable_channel: true });
    if (enableError) throw new Error('Não foi possível ativar a recepção interna');
    // Touch only these two callback slots; never update-every-webhooks or auto-read.
    for (const route of ['update-webhook-received', 'update-webhook-message-status']) await providerFetch(base + '/' + route, { method: 'PUT', headers, body: JSON.stringify({ value: callback }) });
    const after = await providerFetch(base + '/me', { headers });
    if (fields.some(key => after[key] !== callback)) return respond(409, { ok: false, message: 'Configuração parcial: confira os callbacks no painel. Não há confirmação de entrega real.' });
    return respond(200, { ok: true, instanceId: instance, activated: true, message: 'Recebimento e retornos configurados. Aguardando teste real de mensagem e entrega.' });
  } catch { return respond(502, { ok: false, message: 'Não foi possível concluir a consulta/configuração. Confira o provedor antes de repetir.' }); }
});
