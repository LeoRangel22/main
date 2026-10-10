const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

async function run(channel, scenario = {}) {
  const calls = { fetch: 0, begin: [], finish: [] };
  const proposal = { id: 'proposal', revision: 3, public_token: 'token', cliente_nome: 'Cliente', snapshot: {} };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: proposal }) }) }) }),
    rpc: async (name, body) => {
      if (name === 'is_team_member') return { data: scenario.outsider !== true };
      if (name === 'begin_event_send_reviewed') {
        calls.begin.push(body);
        return { data: { claimed: !scenario.duplicate, send: { id: 'send', status: scenario.duplicate || 'sending' } } };
      }
      if (name === 'finish_event_send') { calls.finish.push(body); return {}; }
      if (name === 'reconcile_event_receipts') return {};
      throw new Error('Unexpected RPC: ' + name);
    }
  };
  let handler;
  const env = { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'worker', ZAPI_INSTANCE_ID: 'instance', ZAPI_TOKEN: 'token', ZAPI_CLIENT_TOKEN: 'client', ZEPTO_MAIL_TOKEN: 'email-token', PROPOSAL_FROM_EMAIL: 'events@example.test' };
  const context = vm.createContext({ Request, Response, URL, AbortSignal, Intl, Date, console: { error() {} }, createClient: () => client, Deno: { env: { get: key => env[key] }, serve: fn => handler = fn }, fetch: async () => {
    calls.fetch++;
    if (scenario.timeout) throw new Error('Timeout');
    return new Response(JSON.stringify({ messageId: 'provider', request_id: 'provider' }), { status: scenario.http || 200 });
  } });
  for (const file of ['_shared/send-ledger.ts', `send-proposal-${channel}/index.ts`]) {
    const source = fs.readFileSync(`${__dirname}/../supabase/functions/${file}`, 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
    vm.runInContext(stripTypeScriptTypes(source), context);
  }
  const payload = { proposalId: 'proposal', approved: true, reviewedRevision: 3, reviewedResponseAt: '2026-10-06T00:00:00Z', email: 'client@example.test', phone: '21999999999', proposalUrl: 'https://leorangel22.github.io/main/proposta.html?p=token', message: 'Mensagem revisada pela equipe', ...scenario.payload };
  const response = await handler(new Request('https://example.test/send', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
  return { status: response.status, body: await response.json(), calls };
}
for (const channel of ['email', 'whatsapp']) {
  test(`${channel}: registra aceitação sem alegar entrega`, async () => {
    const r = await run(channel); assert.equal(r.status, 200); assert.equal(r.calls.fetch, 1); assert.equal(r.body.deliveryStatus, 'accepted'); assert.equal(r.calls.finish[0].send_status, 'accepted'); assert.equal(r.calls.begin[0].reviewed_response_at, '2026-10-06T00:00:00Z');
  });
  for (const state of ['accepted', 'sending', 'uncertain']) test(`${channel}: duplicado ${state} não reenvia`, async () => {
    const r = await run(channel, { duplicate: state }); assert.equal(r.calls.fetch, 0); assert.equal(r.status, state === 'accepted' ? 200 : 409); assert.equal(r.calls.finish.length, 0);
  });
  test(`${channel}: timeout mantém resultado incerto`, async () => {
    const r = await run(channel, { timeout: true }); assert.equal(r.status, 409); assert.equal(r.calls.fetch, 1); assert.equal(r.calls.finish[0].send_status, 'uncertain');
  });
  for (const http of [400, 503]) test(`${channel}: HTTP ${http} distingue recusa de incerteza`, async () => {
    const r = await run(channel, { http }); assert.equal(r.status, 502); assert.equal(r.calls.finish[0].send_status, http === 400 ? 'failed' : 'uncertain');
  });
  for (const payload of [{ approved: false }, { reviewedRevision: 2 }, { reviewedRevision: null }, { proposalUrl: 'https://leorangel22.github.io/main/proposta.html?p=outro' }]) test(`${channel}: aprovação e versão são obrigatórias ${JSON.stringify(payload)}`, async () => {
    const r = await run(channel, { payload }); assert.equal(r.status, 409); assert.equal(r.calls.fetch, 0); assert.equal(r.calls.begin.length, 0);
  });
  test(`${channel}: usuário externo não acessa dry-run`, async () => {
    const r = await run(channel, { outsider: true, payload: { dryRun: true } }); assert.equal(r.status, 403); assert.equal(r.calls.fetch, 0);
  });
}
