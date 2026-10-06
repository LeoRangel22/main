export async function providerFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!res.ok) throw new Error('O provedor recusou a consulta/configuração. Confira as credenciais e permissões.');
  return await res.json();
}

export async function syncEmailDeliveries(worker: any) {
const required = ['EVENT_ZOHO_CLIENT_ID', 'EVENT_ZOHO_CLIENT_SECRET', 'EVENT_ZOHO_REFRESH_TOKEN'];
if (required.some(key => !Deno.env.get(key))) return { ok: false, message: 'Consulta de entrega de e-mail requer OAuth Zeptomail.email.READ. O token atual de envio não concede leitura dos registros.' };
const { data: config, error: configError } = await worker.rpc('event_channel_worker_config', { target_provider: 'zepto' });
if (configError || !config?.expected_account) return { ok: false, message: 'Configure o agente de e-mail na Central' };
const accounts = Deno.env.get('EVENT_ZOHO_ACCOUNTS_URL') || 'https://accounts.zoho.com';
const api = Deno.env.get('EVENT_ZOHO_LOGS_URL') || 'https://cpaas.zoho.com';
if (!['https://accounts.zoho.com', 'https://accounts.zoho.eu', 'https://accounts.zoho.in', 'https://accounts.zoho.com.au', 'https://accounts.zoho.com.cn'].includes(accounts) || !['https://cpaas.zoho.com', 'https://api.zeptomail.com', 'https://api.zeptomail.eu', 'https://api.zeptomail.in', 'https://api.zeptomail.com.au', 'https://api.zeptomail.com.cn'].includes(api)) throw new Error('Região Zoho inválida');
const token = await providerFetch(accounts + '/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: Deno.env.get(required[0])!, client_secret: Deno.env.get(required[1])!, refresh_token: Deno.env.get(required[2])! }) });
if (!token.access_token) throw new Error('Permissão OAuth de leitura indisponível');
const { data: sends, error: sendsError } = await worker.from('event_outbox').select('id,provider_id,destination,attempts').eq('channel', 'email').eq('status', 'accepted').or('delivery_status.is.null,delivery_status.eq.accepted,delivery_status.eq.uncertain').not('provider_id', 'is', null).gte('created_at',new Date(Date.now()-60*864e5).toISOString()).order('delivery_checked_at', { ascending: true, nullsFirst: true }).order('created_at', { ascending: true }).limit(5);
if (sendsError) throw new Error('Registro de envios indisponível');
let confirmed = 0;
for (const send of sends || []) {
  const url = new URL(api + '/v1.1/email');
  url.search = new URLSearchParams({ request_id: send.provider_id, mailagent_key: config.expected_account, to: send.destination, limit: '100' }).toString();
  const logs = await providerFetch(url.href, { headers: { Authorization: 'Zoho-oauthtoken ' + token.access_token } });
    const {error: checkedError}=await worker.from('event_outbox').update({delivery_checked_at:new Date().toISOString()}).eq('id',send.id);
    if(checkedError)throw new Error('Registro da consulta indisponível');
  if (!Array.isArray(logs.data)) continue;
  const exact = logs.data.filter((r: any) => r.request_id === send.provider_id && r.mailagent_key === config.expected_account && String(r.to).trim().toLowerCase() === send.destination);
  if (exact.length !== 1 || exact[0].status !== 'delivered') continue;
  const { error } = await worker.rpc('ingest_event_provider_events', { target_provider: 'zepto', events: [{ key: 'log-delivered:' + send.provider_id + ':' + send.destination, channel: 'email', kind: 'status', message_id: send.provider_id, provider_reference: exact[0].email_reference || null, send_id: send.id, send_attempt: send.attempts, destination: send.destination, signal: 'delivered', occurred_at: new Date().toISOString() }] });
  if (error) throw new Error('Não foi possível registrar a entrega');
  confirmed++;
}
return { ok: true, message: `${confirmed} entrega(s) confirmada(s) pelo servidor de destino. Isso não comprova leitura humana ou caixa de entrada.` };
}
