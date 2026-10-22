const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

async function run(channel, scenario = {}) {
  const calls = { fetch: 0, begin: [], finish: [] };
  const proposal = { id: '00000000-0000-4000-8000-000000000111', revision: 3, is_current:true, status:'proposta_pronta', oportunidade_id:'00000000-0000-4000-8000-000000000113', public_token: 'token', cliente_nome: 'Cliente', total: 1120, snapshot: { event: {signalDeadlineHours:72}, selectedItems:[{nome:'Coffee Break aprovado',descricao:'Café e frutas',calc:{total:1000}}] } };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
    from: table => ({ select: () => ({ eq: () => ({ single: async () => ({data:table==='oportunidades'?{ultima_resposta_cliente_em:scenario.newResponse?'2026-10-21T00:00:00Z':'2026-10-06T00:00:00Z'}:calls.begin.length?{...proposal,...scenario.fresh}:proposal}) }) }) }),
    rpc: async (name, body) => {
      if (name === 'is_team_member') return { data: scenario.outsider !== true };
      if (name === 'begin_event_send_reviewed') {
        calls.begin.push(body);
        return { data: { claimed: !scenario.duplicate, send: { id: '00000000-0000-4000-8000-000000000112',created_at:new Date(Date.now()-60000).toISOString(),attempts:1,status: scenario.duplicate || 'sending' } } };
      }
      if (name === 'finish_event_send') { calls.finish.push(body); return {}; }
      if (name === 'reconcile_event_receipts') return {};
      throw new Error('Unexpected RPC: ' + name);
    }
  };
  let handler;
  const env = { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'worker', EVENT_BOT_SEND_ENABLED:'true',EVENT_BOT_SEND_URL:'https://script.google.com/macros/s/fixture/exec',EVENT_BOT_SEND_SECRET:'s'.repeat(40),ZAPI_INSTANCE_ID: 'instance', ZAPI_TOKEN: 'token', ZAPI_CLIENT_TOKEN: 'client', ZEPTO_MAIL_TOKEN: 'email-token', PROPOSAL_FROM_EMAIL: 'events@example.test' };
  const context = vm.createContext({ crypto: require('node:crypto').webcrypto, TextEncoder, Request, Response, URL, AbortSignal, Intl, Date, console: { error() {} }, createClient: () => client, Deno: { env: { get: key => env[key] }, serve: fn => handler = fn }, fetch: async (url, options) => {
    calls.fetch++; calls.providerPayload=JSON.parse(options.body);
    if (scenario.timeout) throw new Error('Timeout');
    if(String(url).includes('script.google.com'))return new Response(JSON.stringify({ok:!scenario.http,version:2,account:'bot:embaixada_urca',id:calls.providerPayload.id,contentHash:calls.providerPayload.contentHash,status:scenario.http===400?'failed':scenario.http?'uncertain':'accepted',attempted:true,...(!scenario.http?{providerId:'provider'}:{})}));
    return new Response(JSON.stringify({ messageId: 'provider', request_id: 'provider' }), { status: scenario.http || 200 });
  } });
  for (const file of ['_shared/bot-dispatch.ts','_shared/send-ledger.ts', `send-proposal-${channel}/index.ts`]) {
    const source = fs.readFileSync(`${__dirname}/../supabase/functions/${file}`, 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
    vm.runInContext(stripTypeScriptTypes(source), context);
  }
  const payload = { proposalId: '00000000-0000-4000-8000-000000000111', approved: true, reviewedRevision: 3, reviewedResponseAt: '2026-10-06T00:00:00Z', email: 'client@example.test', phone: '5521999999999', proposalUrl: 'https://leorangel22.github.io/main/proposta.html?p=token', message: 'Mensagem revisada pela equipe' };
  let preview;
  if (channel === 'email' && !scenario.skipPreview && !scenario.payload?.preview) {
    const response = await handler(new Request('https://example.test/send', {method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({...payload,preview:true})}));
    preview = await response.json();
    assert.equal(calls.fetch,0,'Preparing the preview never calls the provider');
    assert.equal(calls.begin.length,0,'Preparing the preview never claims a send');
    payload.reviewedContentHash=preview.contentHash;
  }
  Object.assign(payload,scenario.payload || {});
  if(scenario.changedItem) proposal.snapshot.selectedItems[0].nome='Item changed after review';
  if(scenario.changedSender) env.PROPOSAL_FROM_EMAIL='different@example.test';
  const response = await handler(new Request('https://example.test/send', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
  return { status: response.status, body: await response.json(), calls, preview };
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
    const r = await run(channel, { http }); assert.equal(r.status, channel==='whatsapp'&&http===503?409:502); assert.equal(r.calls.finish[0].send_status, http === 400 ? 'failed' : 'uncertain');
  });
  for (const payload of [{ approved: false }, { reviewedRevision: 2 }, { reviewedRevision: null }, { proposalUrl: 'https://leorangel22.github.io/main/proposta.html?p=outro' }]) test(`${channel}: aprovação e versão são obrigatórias ${JSON.stringify(payload)}`, async () => {
    const r = await run(channel, { payload }); assert.equal(r.status, 409); assert.equal(r.calls.fetch, 0); assert.equal(r.calls.begin.length, 0);
  });
  test(`${channel}: usuário externo não acessa dry-run`, async () => {
    const r = await run(channel, { outsider: true, payload: { dryRun: true } }); assert.equal(r.status, 403); assert.equal(r.calls.fetch, 0);
  });
}


test('email: prévia retorna HTML e texto completos sem gravar ou enviar', async()=>{
  const r=await run('email',{payload:{preview:true}});
  assert.equal(r.status,200); assert.equal(r.body.mode,'preview');
  assert.match(r.body.html,/Coffee Break aprovado/); assert.match(r.body.text,/Café e frutas/);
  assert.match(r.body.text,/1.120,00/); assert.match(r.body.text,/Prazo do sinal: 3 dias/);
  assert.match(r.body.text,/https:\/\/wa.me\/5521971426007/);
  assert.match(r.body.contentHash,/^[a-f0-9]{64}$/);
  assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);assert.equal(r.calls.finish.length,0);
});
test('email: provedor recebe exatamente o HTML e texto revisados',async()=>{
  const r=await run('email'); assert.equal(r.status,200);
  assert.equal(r.calls.providerPayload.htmlbody,r.preview.html);
  assert.equal(r.calls.providerPayload.textbody,r.preview.text);
  assert.equal(r.calls.providerPayload.subject,r.preview.subject);
  assert.equal(r.calls.begin[0].send_body,r.preview.text);
});
test('email: cliente antigo sem prévia não cria envio',async()=>{
  const r=await run('email',{skipPreview:true});assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});
for(const payload of [{message:'Alterado após aprovação'},{title:'Outro assunto'},{email:'other@example.test'},{reviewedContentHash:'invalid'}]) test(`email: alteração após prévia bloqueada ${JSON.stringify(payload)}`,async()=>{
  const r=await run('email',{payload});assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});
for(const scenario of [{changedItem:true},{changedSender:true}]) test(`email: conteúdo gerado e remetente são vinculados à aprovação ${JSON.stringify(scenario)}`,async()=>{
  const r=await run('email',scenario);assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});
test('email: dados malformados não são renderizados ou enviados',async()=>{
  const r=await run('email',{payload:{preview:true,message:{invalid:true}}});assert.equal(r.status,400);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});

for(const scenario of [{newResponse:true},{fresh:{revision:4}},{fresh:{is_current:false}},{fresh:{status:'cancelado'}},{fresh:{public_token:'changed'}},{fresh:{public_token_revoked_at:new Date().toISOString()}},{fresh:{public_token_expires_at:'invalid'}}])test('whatsapp: last-moment stale state pauses without network '+JSON.stringify(scenario),async()=>{const r=await run('whatsapp',scenario);assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.finish[0].send_status,'paused');});
test('whatsapp: noncanonical legacy number is refused before claim and never rewritten',async()=>{const r=await run('whatsapp',{payload:{phone:'2133334444'}});assert.equal(r.status,400);assert.equal(r.calls.begin.length,0);assert.equal(r.calls.fetch,0);assert.match(r.body.message,/não será alterado/);});

test('whatsapp: reviewed international country code is not silently changed',async()=>{const r=await run('whatsapp',{payload:{phone:'12025550123'}});assert.equal(r.status,200);assert.equal(r.calls.providerPayload.destination,'12025550123');assert.equal(r.calls.begin[0].send_destination,'12025550123');});
test('whatsapp: local Brazilian number requires explicit country code review',async()=>{const r=await run('whatsapp',{payload:{phone:'21999999999'}});assert.equal(r.status,400);assert.equal(r.calls.begin.length,0);assert.equal(r.calls.fetch,0);});
