import { providerFetch } from './email-delivery.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fields = (value: any, keys: string[]) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const safeText = (v: any) => typeof v === 'string' && v.length > 0 && v.length <= 500 && v === v.trim() && !/[\r\n\x00]/.test(v);

// Master-only metadata preparation. It never refreshes OAuth, queries the
// provider, changes readiness, claims an attempt or returns recipient/body/key.
export async function prepareScopedEmailDeliveries(worker: any, payload: any) {
  if (!fields(payload, ['action', 'sendIds']) || payload.action !== 'prepare-email-scoped' || !Array.isArray(payload.sendIds) || payload.sendIds.length !== 2 || payload.sendIds.some((v: any) => typeof v !== 'string' || !uuid.test(v)) || new Set(payload.sendIds).size !== 2) return { ok: false, code: 'scope_invalid' };
  const presence = (prefix: string) => ({ clientId: Boolean(Deno.env.get(prefix + '_CLIENT_ID')), clientSecret: Boolean(Deno.env.get(prefix + '_CLIENT_SECRET')), refreshToken: Boolean(Deno.env.get(prefix + '_REFRESH_TOKEN')) });
  const diagnostic: any = { deliveryRead: presence('EVENT_ZOHO'), mailboxRead: presence('EVENT_MAILBOX'), agentPinned: false, automaticSyncOff: false };
  try {
    const cfg = await worker.rpc('event_channel_worker_config', { target_provider: 'zepto' });
    if (cfg.error || !cfg.data) return { ok: false, code: 'configuration_unavailable', diagnostic };
    diagnostic.agentPinned = safeText(cfg.data.expected_account);
    diagnostic.automaticSyncOff = cfg.data.enabled === false && cfg.data.delivery_sync_ready === false;
    if (!diagnostic.automaticSyncOff) return { ok: false, code: 'configuration_conflict', diagnostic };
    if (!diagnostic.agentPinned || !Object.values(diagnostic.deliveryRead).every(Boolean)) return { ok: false, code: 'setup_pending', diagnostic };
    const r = await worker.from('event_outbox').select('id,proposal_id,reviewed_revision,provider_id,attempts,channel,status,delivery_status,delivery_checked_at').in('id', payload.sendIds);
    if (r.error || !Array.isArray(r.data) || r.data.length !== 2) return { ok: false, code: 'scope_conflict', diagnostic };
    const references = [];
    for (const id of payload.sendIds) {
      const matches = r.data.filter((row: any) => row.id === id), row = matches[0];
      if (matches.length !== 1 || !uuid.test(row.proposal_id) || !Number.isSafeInteger(row.reviewed_revision) || row.reviewed_revision < 1 || !safeText(row.provider_id) || row.attempts !== 1 || row.channel !== 'email' || row.status !== 'accepted' || row.delivery_checked_at !== null || ![null, 'accepted', 'uncertain'].includes(row.delivery_status)) return { ok: false, code: 'scope_conflict', diagnostic };
      references.push({ sendId: row.id, proposalId: row.proposal_id, revision: row.reviewed_revision, providerId: row.provider_id, attempt: 1 });
    }
    return { ok: true, diagnostic, agent: cfg.data.expected_account, references };
  } catch { return { ok: false, code: 'preparation_unavailable', diagnostic }; }
}

// The existing scheduler and broad sync function are deliberately not used here.
// A checked_at claim is durable: failure/abort cannot cause this path to replay a GET.
export async function reconcileScopedEmailDeliveries(worker: any, scope: any) {
  const results: any[] = [];
  const fail = (code: string) => ({ ok: false, code, results, automaticSyncChanged: false, messageAttempted: false });
  if (!fields(scope, ['action', 'agent', 'startedAt', 'expiresAt', 'references']) || scope.action !== 'reconcile-email-scoped' || !safeText(scope.agent) || !Array.isArray(scope.references) || scope.references.length !== 2) return fail('scope_invalid');
  const start = Date.parse(scope.startedAt), end = Date.parse(scope.expiresAt);
  if (typeof scope.startedAt !== 'string' || typeof scope.expiresAt !== 'string' || !Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString() !== scope.startedAt || new Date(end).toISOString() !== scope.expiresAt || end <= start || end - start > 900000) return fail('window_invalid');
  const open = () => Date.now() >= start && Date.now() < end;
  // providerFetch has a 15-second abort budget. Do not start a request whose
  // full network budget would exceed this scope's deadline.
  const requestFits = () => open() && end - Date.now() > 15000;
  if (!requestFits()) return fail('window_closed');
  for (const pin of scope.references) {
    if (!fields(pin, ['sendId', 'proposalId', 'revision', 'providerId', 'attempt']) || !uuid.test(pin.sendId) || !uuid.test(pin.proposalId) || !Number.isSafeInteger(pin.revision) || pin.revision < 1 || pin.attempt !== 1 || !safeText(pin.providerId)) return fail('scope_invalid');
  }
  if (new Set(scope.references.map((p: any) => p.sendId)).size !== 2 || new Set(scope.references.map((p: any) => p.providerId)).size !== 2) return fail('scope_invalid');
  const required = ['EVENT_ZOHO_CLIENT_ID', 'EVENT_ZOHO_CLIENT_SECRET', 'EVENT_ZOHO_REFRESH_TOKEN'];
  if (required.some(k => !Deno.env.get(k))) return fail('read_authorization_missing');
  const accounts = Deno.env.get('EVENT_ZOHO_ACCOUNTS_URL') || 'https://accounts.zoho.com';
  const api = Deno.env.get('EVENT_ZOHO_LOGS_URL') || 'https://cpaas.zoho.com';
  if (!['https://accounts.zoho.com', 'https://accounts.zoho.eu', 'https://accounts.zoho.in', 'https://accounts.zoho.com.au', 'https://accounts.zoho.com.cn'].includes(accounts) || !['https://cpaas.zoho.com', 'https://api.zeptomail.com', 'https://api.zeptomail.eu', 'https://api.zeptomail.in', 'https://api.zeptomail.com.au', 'https://api.zeptomail.com.cn'].includes(api)) return fail('region_invalid');
  const configuration = async () => {
    const r = await worker.rpc('event_channel_worker_config', { target_provider: 'zepto' });
    return !r.error && r.data?.enabled === false && r.data?.delivery_sync_ready === false && r.data?.expected_account === scope.agent;
  };
  try {
    if (!await configuration()) return fail('configuration_conflict');
    const selection = await worker.from('event_outbox').select('id,proposal_id,reviewed_revision,channel,status,provider_id,destination,attempts,delivery_checked_at,delivery_status').in('id', scope.references.map((p: any) => p.sendId));
    if (selection.error || !Array.isArray(selection.data) || selection.data.length !== 2) return fail('scope_conflict');
    const sends: any[] = [];
    for (const pin of scope.references) {
      const matches = selection.data.filter((row: any) => row.id === pin.sendId);
      const row = matches[0];
      if (matches.length !== 1 || row.proposal_id !== pin.proposalId || row.reviewed_revision !== pin.revision || row.channel !== 'email' || row.status !== 'accepted' || row.provider_id !== pin.providerId || row.attempts !== pin.attempt || !safeText(row.destination) || row.destination !== row.destination.toLowerCase() || row.delivery_checked_at !== null || ![null, 'accepted', 'uncertain'].includes(row.delivery_status)) return fail('scope_conflict');
      sends.push(row);
    }
    // Claim all approved rows before any OAuth or provider call. On partial failure,
    // retain the first claim and report uncertainty; never clear it to enable retry.
    for (const row of sends) {
      if (!await configuration() || !open()) return fail('window_or_configuration_changed');
      const claim = await worker.from('event_outbox').update({ delivery_checked_at: new Date().toISOString() }).eq('id', row.id).eq('proposal_id', row.proposal_id).eq('reviewed_revision', row.reviewed_revision).eq('channel', 'email').eq('status', 'accepted').eq('provider_id', row.provider_id).eq('destination', row.destination).eq('attempts', row.attempts).is('delivery_checked_at', null).select('id');
      if (claim.error || !Array.isArray(claim.data) || claim.data.length !== 1 || claim.data[0].id !== row.id) return fail('claim_uncertain');
    }
    if (!await configuration() || !requestFits()) return fail('window_or_configuration_changed');
    const token = await providerFetch(accounts + '/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: Deno.env.get(required[0])!, client_secret: Deno.env.get(required[1])!, refresh_token: Deno.env.get(required[2])! }) });
    if (typeof token?.access_token !== 'string' || !token.access_token) return fail('read_authentication_uncertain');
    for (const row of sends) {
      if (!await configuration() || !requestFits()) return fail('window_or_configuration_changed');
      const url = new URL(api + '/v1.1/email');
      url.search = new URLSearchParams({ request_id: row.provider_id, mailagent_key: scope.agent, to: row.destination, client_reference: 'EV:' + row.id + ':' + row.attempts, limit: '100' }).toString();
      let logs;
      try { logs = await providerFetch(url.href, { headers: { Authorization: 'Zoho-oauthtoken ' + token.access_token } }); }
      catch { results.push({ sendId: row.id, state: 'uncertain' }); return fail('provider_result_uncertain'); }
      if (!await configuration() || !open()) return fail('window_or_configuration_changed');
      if (!logs || logs.status !== 'success' || Object.hasOwn(logs, 'error') || !Array.isArray(logs.data) || logs.data.length > 100) return fail('provider_result_invalid');
      const exact = logs.data.filter((r: any) => r && r.request_id === row.provider_id && r.mailagent_key === scope.agent && typeof r.to === 'string' && r.to.trim().toLowerCase() === row.destination);
      if (exact.length !== 1) return fail('provider_correlation_uncertain');
      if (exact[0].status !== 'delivered') { results.push({ sendId: row.id, state: 'not_confirmed' }); continue; }
      if (exact[0].email_reference != null && !safeText(exact[0].email_reference)) return fail('provider_result_invalid');
      // Do not reuse the broad poller's key: an old pending event may already
      // bind that key to another send. This namespace pins this exact attempt.
      const saved = await worker.rpc('ingest_event_provider_events', { target_provider: 'zepto', events: [{ key: 'scoped-log-delivered:' + row.id + ':' + row.attempts + ':' + row.provider_id, channel: 'email', kind: 'status', message_id: row.provider_id, provider_reference: exact[0].email_reference || null, send_id: row.id, send_attempt: row.attempts, destination: row.destination, signal: 'delivered', occurred_at: new Date().toISOString() }] });
      if (saved.error) return fail('persistence_uncertain');
      const readback = await worker.from('event_outbox').select('id,proposal_id,reviewed_revision,provider_id,attempts,delivery_status').eq('id', row.id).maybeSingle();
      if (readback.error || readback.data?.proposal_id !== row.proposal_id || readback.data?.reviewed_revision !== row.reviewed_revision || readback.data?.provider_id !== row.provider_id || readback.data?.attempts !== row.attempts || !['delivered', 'read'].includes(readback.data?.delivery_status)) return fail('readback_uncertain');
      results.push({ sendId: row.id, state: 'confirmed' });
    }
    return { ok: results.length === 2 && results.every(r => r.state === 'confirmed'), code: 'completed', results, automaticSyncChanged: false, messageAttempted: false };
  } catch { return fail('operation_uncertain'); }
}
