import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sameSecret, decodeWebhook, verifySignature, normalizeZapi, normalizeZepto, normalizeMailbox } from '../_shared/channel-events.ts';

const json = (status: number, message: string) => new Response(JSON.stringify({ ok: status === 200, message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, 'Use POST');
  const provider = new URL(req.url).searchParams.get('provider') || '';
  if (!['zapi', 'zepto', 'mailbox'].includes(provider)) return json(400, 'Canal desconhecido');
  try {
    const worker = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false } });
    const { data: config, error } = await worker.rpc('event_channel_worker_config', { target_provider: provider });
    if (error) return json(503, 'Configuração indisponível');
    if (!config?.enabled || !config.expected_account) return json(503, 'Canal ainda não ativado');
    if (provider === 'zapi' && !sameSecret(new URL(req.url).searchParams.get('key') || '', config.secret)) return json(401, 'Origem não autenticada');
    if (Number(req.headers.get('content-length') || 0) > 65536) return json(413, 'Lote muito grande');
    const reader = req.body?.getReader();
    if (!reader) return json(400, 'Corpo obrigatório');
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const part = await reader.read(); if (part.done) break; total += part.value.length; if (total > 65536) { await reader.cancel(); return json(413, 'Lote muito grande'); } chunks.push(part.value); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    const raw = new TextDecoder().decode(bytes);
    let value: string;
    try { value = decodeWebhook(raw, req.headers.get('content-type') || ''); } catch { return json(400, 'Formato inválido'); }
    if (provider !== 'zapi' && !await verifySignature(req.headers.get('producer-signature') || '', config.secret, value)) return json(401, 'Assinatura inválida');
    let events: any[];
    try {
      const payload = JSON.parse(value);
      if (provider === 'zapi') {
        const instance = Deno.env.get('ZAPI_INSTANCE_ID');
        if (!instance || config.expected_account !== instance) return json(503, 'Instância não corresponde ao canal de envio');
        events = normalizeZapi(payload, instance);
      } else events = provider === 'zepto' ? normalizeZepto(payload, config.expected_account) : normalizeMailbox(payload, config.expected_account);
    } catch { return json(400, 'Dados inválidos ou conta divergente'); }
    if (events.length) {
      const { error: writeError } = await worker.rpc('ingest_event_provider_events', { target_provider: provider, events });
      if (writeError) return json(503, 'Registro indisponível; tente novamente');
    }
    return json(200, 'Recebido');
  } catch { return json(503, 'Serviço indisponível'); }
});
