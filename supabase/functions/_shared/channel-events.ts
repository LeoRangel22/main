// Provider schemas: docs in docs/event-channel-setup.md. No automatic external sends.
export function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0 && x.length > 0;
}
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))));
}
export function decodeWebhook(raw: string, contentType: string) {
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(raw);
    if (!form.has('data')) throw new Error('Formulário inválido');
    return form.get('data')!;
  }
  if (!contentType.includes('application/json')) throw new Error('Content-Type inválido');
  return raw;
}
export async function verifySignature(header: string, secret: string, value: string, now = Date.now()) {
  try {
    const parts = Object.fromEntries(header.split(';').map(p => { const at = p.indexOf('='); return [p.slice(0, at).trim(), p.slice(at + 1).trim()]; }));
    const ts = Number(parts.ts);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > 600000 || parts['s-algorithm'] !== 'HmacSHA256') return false;
    return sameSecret(decodeURIComponent(parts.s || ''), await hmac(secret, value));
  } catch { return false; }
}
function eventTime(value: any) {
  const n = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : value;
  const date = new Date(n);
  if (value == null || !Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 300000) throw new Error('Horário inválido');
  return date.toISOString();
}
function phone(value: any) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(digits)) throw new Error('Telefone inválido');
  return digits;
}
function address(value: any) {
  const text = String(value || '').trim().toLowerCase();
  if (text.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error('E-mail inválido');
  return text;
}
function id(value: any) {
  if (typeof value !== 'string' || !value || value.length > 300) throw new Error('Identificador inválido');
  return value;
}
export function normalizeZapi(p: any, expectedAccount: string) {
  if (!expectedAccount || p.instanceId !== expectedAccount) throw new Error('Instância divergente');
  if (p.isGroup || p.isNewsletter || p.broadcast || p.fromMe || p.isEdit || p.waitingMessage || p.isStatusReply) return [];
  if (p.type === 'MessageStatusCallback') {
    const signal = ({ SENT: 'accepted', RECEIVED: 'delivered', READ: 'read' } as any)[p.status];
    if (!signal) return []; // READ_BY_ME is the operator reading, not the recipient.
    if (!Array.isArray(p.ids) || !p.ids.length || p.ids.length > 100) throw new Error('Lote inválido');
    return p.ids.map((message: any) => ({ key: `${id(message)}:${signal}:${eventTime(p.momment)}`, channel: 'whatsapp', kind: 'status', message_id: message, destination: phone(p.phone), signal, occurred_at: eventTime(p.momment) }));
  }
  if (p.type !== 'ReceivedCallback') return [];
  const content = p.text?.message || p.image?.caption || p.video?.caption || (p.audio ? '[Áudio recebido; consulte o WhatsApp]' : p.image ? '[Imagem recebida; consulte o WhatsApp]' : p.video ? '[Vídeo recebido; consulte o WhatsApp]' : p.document ? '[Documento recebido; consulte o WhatsApp]' : '[Mensagem recebida; consulte o WhatsApp]');
  return [{ key: id(p.messageId), channel: 'whatsapp', kind: 'inbound', message_id: p.messageId, destination: phone(p.phone), body: String(content).slice(0, 6000), occurred_at: eventTime(p.momment) }];
}
export function normalizeZepto(p: any, expectedAccount: string) {
  if (!expectedAccount || p.mailagent_key !== expectedAccount) throw new Error('Agente divergente');
  id(p.webhook_request_id);
  if (!Array.isArray(p.event_message) || p.event_message.length > 100) throw new Error('Lote inválido');
  const result: any[] = [];
  for (const msg of p.event_message) {
    const ref = /^EV:([0-9a-f-]{36}):(\d+)$/.exec(msg.email_info?.client_reference || '');
    for (const data of msg.event_data || []) {
      const signal = ({ hardbounce: 'failed', softbounce: 'softbounce', email_open: 'opened', email_link_click: 'clicked', fbl_complaint: 'complaint' } as any)[data.object];
      if (!signal) continue;
      for (const detail of data.details || []) {
        // Bounce identifies the affected recipient; opens/clicks need their explicit address
        // or a single-recipient message. Never apply a recipient signal to an entire batch.
        const recipients = detail.bounced_recipient ? [detail.bounced_recipient] : detail.recipient ? [detail.recipient] : msg.email_info?.to?.length === 1 ? [msg.email_info.to[0].email_address?.address] : [];
        for (const recipient of recipients) {
          const destination = address(recipient), time = eventTime(detail.time || detail.modified_time);
          result.push({ key: `${p.webhook_request_id}:${msg.request_id}:${signal}:${destination}:${time}`, channel: 'email', kind: 'status', message_id: id(msg.request_id), provider_reference: msg.email_info?.email_reference || null, send_id: ref?.[1] || null, send_attempt: ref ? Number(ref[2]) : null, destination, signal, occurred_at: time });
        }
      }
    }
  }
  if (result.length > 100) throw new Error('Lote inválido');
  return result;
}
export function normalizeMailbox(p: any, expectedAccount: string) {
  if (!expectedAccount || p.mailbox !== expectedAccount) throw new Error('Caixa divergente');
  // Contract for an authenticated mailbox adapter, not a ZeptoMail inbound feature.
  if (p.kind !== 'inbound' || typeof p.text !== 'string' || !p.text.trim()) throw new Error('Mensagem inválida');
  return [{ key: id(p.message_id), channel: 'email', kind: 'inbound', message_id: p.message_id, reply_to_id: p.in_reply_to ? String(p.in_reply_to).replace(/^<|>$/g, '') : null, destination: address(p.from), body: p.text.slice(0, 6000), occurred_at: eventTime(p.received_at) }];
}
