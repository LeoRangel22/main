const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

async function run(channel, scenario = {}) {
  const calls = { fetch: 0, begin: [], finish: [] };
  const proposal = { id: '00000000-0000-4000-8000-000000000111', revision: 3, is_current:true, status:'proposta_pronta', oportunidade_id:'00000000-0000-4000-8000-000000000113', public_token: 'token', cliente_nome: 'Cliente', total: 1120, snapshot: { event: {signalDeadlineHours:72}, selectedItems:[{nome:'Coffee Break aprovado',descricao:'Café e frutas',calc:{total:1000}}] } };
  if(scenario.neutral){proposal.revision=1;proposal.total=0;proposal.cliente_email='client@example.test';proposal.snapshot={communicationTest:{id:'QA-COM-EMAIL-01',neutral:true},totals:{total:0},selectedItems:[]};}
  if(scenario.proposal)Object.assign(proposal,scenario.proposal);
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user', email:'client@example.test', email_confirmed_at:scenario.unconfirmed?null:'2026-01-01T00:00:00Z' } } }) },
    from: table => ({ select: () => ({ eq: () => ({ single: async () => ({data:table==='oportunidades'?{ultima_resposta_cliente_em:scenario.newResponse?'2026-10-21T00:00:00Z':'2026-10-06T00:00:00Z'}:calls.begin.length?{...proposal,...scenario.fresh}:proposal}) }) }) }),
    rpc: async (name, body) => {
      if (name === 'is_super_admin') return {data:scenario.owner!==false,error:scenario.ownerError?{}:null};
      if (name === 'is_team_member') return { data: scenario.outsider !== true };
      if (name === 'begin_event_send_reviewed') {
        calls.begin.push(body);
        const prior=scenario.ledger?.row;
        const send=prior||{ id: '00000000-0000-4000-8000-000000000112',created_at:new Date(Date.now()-60000).toISOString(),attempts:1,status: scenario.duplicate || 'sending' };
        if(scenario.ledger&&!prior)scenario.ledger.row=send;
        return { data: { claimed: !scenario.duplicate&&!prior, send } };
      }
      if (name === 'finish_event_send') { calls.finish.push(body);if(scenario.finishError)return{error:{message:'Synthetic finalizer unavailable'}};if(scenario.ledger)scenario.ledger.row={...scenario.ledger.row,status:body.send_status,provider_id:body.external_message_id};return {}; }
      if (name === 'reconcile_event_receipts') return {};
      throw new Error('Unexpected RPC: ' + name);
    }
  };
  let handler;
  const env = { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'worker', EVENT_BOT_SEND_ENABLED:'true',EVENT_BOT_SEND_URL:'https://script.google.com/macros/s/fixture/exec',EVENT_BOT_SEND_SECRET:'s'.repeat(40),ZAPI_INSTANCE_ID: 'instance', ZAPI_TOKEN: 'token', ZAPI_CLIENT_TOKEN: 'client', ZEPTO_MAIL_TOKEN: 'email-token', PROPOSAL_FROM_EMAIL: 'events@example.test' };
  if(scenario.neutral)env.PROPOSAL_FROM_EMAIL='leads@embaixadacarioca.com.br';
  if(scenario.sender)env.PROPOSAL_FROM_EMAIL=scenario.sender;
  if(scenario.replyTo)env.PROPOSAL_REPLY_TO_EMAIL=scenario.replyTo;
  const context = vm.createContext({ crypto: require('node:crypto').webcrypto, TextEncoder, Request, Response, URL, AbortSignal, Intl, Date, console: { error() {} }, createClient: () => client, Deno: { env: { get: key => env[key] }, serve: fn => handler = fn }, fetch: async (url, options) => {
    calls.fetch++; calls.providerPayload=JSON.parse(options.body);
    if (scenario.timeout) throw new Error('Timeout');
    if(String(url).includes('script.google.com'))return new Response(JSON.stringify({ok:!scenario.http,version:2,account:'bot:embaixada_urca',id:calls.providerPayload.id,contentHash:calls.providerPayload.contentHash,status:scenario.http===400?'failed':scenario.http?'uncertain':'accepted',attempted:true,...(!scenario.http?{providerId:'provider'}:{})}));
    if(scenario.readError)return{ok:true,status:200,text:async()=>{throw Error('Synthetic body read failure');}};
    const providerBody=Object.hasOwn(scenario,'providerBody')?scenario.providerBody:{ messageId: 'provider', request_id: 'provider' };
    return new Response(scenario.malformedJson?'{invalid':JSON.stringify(providerBody), { status: scenario.http || 200 });
  } });
  for (const file of ['_shared/bot-dispatch.ts','_shared/send-ledger.ts', `send-proposal-${channel}/index.ts`]) {
    const source = fs.readFileSync(`${__dirname}/../supabase/functions/${file}`, 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
    vm.runInContext(stripTypeScriptTypes(source), context);
  }
  const payload = { proposalId: '00000000-0000-4000-8000-000000000111', approved: true, reviewedRevision: 3, reviewedResponseAt: '2026-10-06T00:00:00Z', email: 'client@example.test', phone: '5521999999999', proposalUrl: 'https://leorangel22.github.io/main/proposta.html?p=token', message: 'Mensagem revisada pela equipe' };
  if(scenario.neutral){payload.reviewedRevision=1;payload.message='';}
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

// ZeptoMail acknowledges an object with a top-level string request_id, not a
// Supabase RPC row array. Official data/code fields remain provider-specific.
for(const [label,providerBody] of [
 ['null',null],['empty object',{}],['array',[]],['empty ID',{request_id:''}],
 ['whitespace ID',{request_id:'  '}],['numeric ID',{request_id:123}],['object ID',{request_id:{}}],
 ['explicit error',{request_id:'error-request',error:{code:'TM_4001'}}],
 ['error data',{request_id:'error-request',data:{error_code:'TM_3004'}}]
])test('email: invalid 200 acknowledgement stays uncertain: '+label,async()=>{
 const ledger={};const r=await run('email',{providerBody,ledger});
 assert.equal(r.status,409);assert.equal(r.body.ok,false);assert.equal(r.body.deliveryStatus,'uncertain');
 assert.equal(r.calls.fetch,1);assert.equal(r.calls.finish.length,1);assert.equal(r.calls.finish[0].send_status,'uncertain');
 assert.equal(r.calls.finish[0].external_message_id,null);assert.equal(r.body.sendId,r.calls.finish[0].send_id);
 assert.equal(r.calls.begin[0].target_proposal,'00000000-0000-4000-8000-000000000111');assert.equal(r.calls.begin[0].reviewed_revision,3);
 assert.equal(r.calls.providerPayload.client_reference,'EV:'+r.body.sendId+':1');
 assert.equal(r.calls.providerPayload.textbody,r.preview.text);
 const afterReload=await run('email',{ledger});assert.equal(afterReload.calls.fetch,0);
 assert.equal(afterReload.body.sendId,r.body.sendId);assert.equal(afterReload.body.deliveryStatus,'uncertain');assert.equal(afterReload.calls.finish.length,0);
});
for(const scenario of [{malformedJson:true},{readError:true}])test('email: unreadable acknowledgement is uncertain '+JSON.stringify(scenario),async()=>{
 const r=await run('email',scenario);assert.equal(r.status,409);assert.equal(r.body.deliveryStatus,'uncertain');assert.equal(r.calls.fetch,1);
 assert.equal(r.calls.finish.length,1);assert.equal(r.calls.finish[0].send_status,'uncertain');assert.equal(r.calls.finish[0].external_message_id,null);
});
for(const code of ['EM_101','EM_104'])test('email: documented '+code+' receipt is accepted without claiming delivery',async()=>{
 const ledger={};const r=await run('email',{ledger,providerBody:{data:[{code,additional_info:[],message:'Email request received'}],message:'OK',request_id:'synthetic.request-id'}});
 assert.equal(r.status,200);assert.equal(r.body.deliveryStatus,'accepted');assert.equal(r.calls.finish[0].external_message_id,'synthetic.request-id');assert.equal(r.calls.fetch,1);
 const afterReload=await run('email',{ledger});assert.equal(afterReload.calls.fetch,0);assert.equal(afterReload.body.sendId,r.body.sendId);assert.equal(afterReload.body.deliveryStatus,'accepted');
});
test('email: finalizer failure does not claim success or repeat the provider call',async()=>{
 const ledger={};const r=await run('email',{finishError:true,ledger});assert.equal(r.status,500);assert.equal(r.body.ok,false);assert.equal(r.calls.fetch,1);
 const afterReload=await run('email',{ledger});assert.equal(afterReload.calls.fetch,0);assert.equal(afterReload.body.deliveryStatus,'sending');
});

const neutralBody="Olá, Leo. Esta é uma mensagem controlada para validar a comunicação do Sistema de Eventos. Não constitui proposta comercial, reserva, cobrança ou confirmação de evento. Para validar o retorno, responda a este mesmo e-mail com: TESTE RECEBIDO QA-COM-EMAIL-01. Não encaminhe dados pessoais ou documentos neste teste.";
test('email neutral: exact reviewed text, subject and one recipient, no commercial template',async()=>{
 const ledger={};const r=await run('email',{neutral:true,ledger});assert.equal(r.status,200);
 assert.equal(r.preview.text,neutralBody);assert.equal(r.calls.providerPayload.textbody,neutralBody);
 assert.equal(r.calls.providerPayload.subject,'[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial');
 assert.equal(r.calls.providerPayload.to.length,1);assert.equal(r.calls.providerPayload.to[0].email_address.address,'client@example.test');
 assert.equal(r.calls.providerPayload.bcc,undefined);assert.equal(r.calls.providerPayload.cc,undefined);
 assert.equal(r.calls.providerPayload.reply_to[0].address,'eventos@embaixadacarioca.com.br');
 assert.doesNotMatch(r.preview.html,/Total estimado|Prazo do sinal|Ver e responder|após validação/);
 assert.equal(r.calls.begin[0].reviewed_revision,1);assert.equal(r.calls.begin[0].send_body,neutralBody);
 const reload=await run('email',{neutral:true,ledger});assert.equal(reload.calls.fetch,0);assert.equal(reload.body.sendId,r.body.sendId);
});
for(const scenario of [{owner:false},{ownerError:true},{unconfirmed:true},{sender:'other@example.test'},{replyTo:'other@example.test'},{proposal:{revision:2}},{proposal:{total:1}},{proposal:{total:null}},{proposal:{cliente_email:'other@example.test'}},{payload:{email:'other@example.test'}},{payload:{title:'Commercial'}},{payload:{message:'Changed after review'}},{payload:{approved:false}},{payload:{reviewedRevision:2}},{payload:{reviewedContentHash:'incorrect'}},{skipPreview:true}])
 test('email neutral: safety refusal '+JSON.stringify(scenario),async()=>{
  const r=await run('email',{neutral:true,...scenario});assert.ok([401,403,409].includes(r.status));assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
 });
test('email neutral: uncertain provider result persists across reload without replay',async()=>{
 const ledger={};const r=await run('email',{neutral:true,timeout:true,ledger});assert.equal(r.status,409);assert.equal(r.calls.fetch,1);assert.equal(r.body.deliveryStatus,'uncertain');
 const reload=await run('email',{neutral:true,ledger});assert.equal(reload.calls.fetch,0);assert.equal(reload.body.sendId,r.body.sendId);assert.equal(reload.body.deliveryStatus,'uncertain');
});
for(const change of [
 {communicationTest:{id:'OTHER',neutral:true}},
 {communicationTest:{id:'QA-COM-EMAIL-01',neutral:false}},
 {totals:{total:1}}, {totals:{total:null}}, {selectedItems:[{name:'priced'}]},
 {selectedItems:null}, {selectedItems:undefined}
])test('email neutral: malformed or commercial snapshot refuses '+JSON.stringify(change),async()=>{
 const snapshot={communicationTest:{id:'QA-COM-EMAIL-01',neutral:true},totals:{total:0},selectedItems:[],...change};
 const r=await run('email',{neutral:true,proposal:{snapshot}});assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});
test('email neutral: concurrent handlers share the existing ledger and attempt once',async()=>{
 const ledger={};const results=await Promise.all([run('email',{neutral:true,ledger}),run('email',{neutral:true,ledger})]);
 assert.equal(results.reduce((n,r)=>n+r.calls.fetch,0),1);assert.equal(results[0].body.sendId,results[1].body.sendId);
});
for(const marker of [false,null,0,'',undefined])test('email neutral: invalid or absent marker never falls back to a commercial preview '+String(marker),async()=>{
 const snapshot={totals:{total:0},selectedItems:[],...(marker===undefined?{}:{communicationTest:marker})};
 const r=await run('email',{neutral:true,proposal:{snapshot},payload:{preview:true,title:'[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial'}});
 assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});
for(const field of ['title','message'])test('email neutral: whitespace never disguises neutral intent '+field,async()=>{
 const snapshot={totals:{total:0},selectedItems:[]};
 const content=field==='title'?'[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial':neutralBody;
 const r=await run('email',{neutral:true,proposal:{snapshot},payload:{preview:true,[field]:' \n'+content+'\n '}});
 assert.equal(r.status,409);assert.equal(r.calls.fetch,0);assert.equal(r.calls.begin.length,0);
});

