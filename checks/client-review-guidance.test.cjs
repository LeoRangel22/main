const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
function extract(name, text = source) {
  const start = text.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  return text.slice(start, text.indexOf('\n}', start) + 2);
}
function context() {
  const c = vm.createContext({ state: { session: null }, normalizeProposalStatus: x => x,
    isLikelyEmailAddress: x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x),
    escapeHtml: x => String(x ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    formatDateFromIso: x => x, formatMoney: x => 'R$ ' + x, getProposalStatusLabel: x => x,
    fetch() { throw Error('NETWORK_FORBIDDEN'); }, localStorage: {setItem() {throw Error('WRITE_FORBIDDEN');}},
  });
  for (const name of ['getSalesFunnelState','getSalesFunnelStateForItem','getSalesFunnelItems','getClientNextAction','getClientCommercialProfile',
    'getClientReviewPhone','getClientReviewName','clientReviewNamesMatch','getClientRelationshipReviews','renderClientRelationshipReview','renderClientQuoteComparison']) vm.runInContext(extract(name), c);
  return c;
}
const base = { kind: 'proposal', status: 'negociacao' };
for (const [name, changes, expected] of [
  ['adjustment does not recommend signal', {clientResponse:'alteracao'}, /pedido de alteração/],
  ['unaccepted negotiation requires evidence', {}, /evidências da etapa/],
  ['acceptance is distinct from reservation', {clientResponse:'confirmar'}, /Aceite não confirma reserva/],
  ['pending receipt remains unvalidated', {clientResponse:'confirmar',snapshot:{pagamentoSinal:{valor:50,validacaoPendente:true}}}, /Financeiro/],
  ['draft acceptance cannot advance', {isDraft:true,clientResponse:'confirmar'}, /rascunho/],
  ['old version cannot guide a charge', {isCurrent:false,clientResponse:'confirmar'}, /versão atual/],
  ['legacy old version cannot guide a charge', {is_current:false,clientResponse:'confirmar'}, /versão atual/],
  ['pipeline old version cannot guide a charge', {isCurrentVersion:false,clientResponse:'confirmar'}, /versão atual/],
  ['client cancellation requires response', {clientResponse:'cancelar'}, /resposta do cliente/],
  ['status alone does not establish dispatch', {status:'proposta_enviada'}, /evidências da etapa/],
  ['recorded dispatch waits for reply', {status:'proposta_enviada',sentAt:'2020-01-01T00:00:00Z'}, /sem presumir aceite/],
  ['advanced stage without paid evidence is reviewed', {status:'confirmado'}, /evidências da etapa/],
  ['accounted signal permits balance review only', {status:'confirmado',paymentPaidTotal:50,snapshot:{pagamentoSinal:{valor:50}}}, /Conferir o saldo calculado/],
]) test(name, () => {
  const c=context(), actual=c.getClientNextAction({...base,...changes});
  assert.match(actual,expected);
  assert.doesNotMatch(actual,/avançar para sinal|Registrar pagamento restante/);
});
test('multiple quotes do not assert repeat customer',()=>{
  const c=context(); const p=c.getClientCommercialProfile({latest:base,openQuoteItems:[{},{}],confirmedItems:[],realizedItems:[],canceledItems:[]});
  assert.equal(p.label,'Mais de uma cotação aberta'); assert.match(p.detail,/alternativas do mesmo evento/);
});
test('profile preserves adjustment evidence',()=>{
  const c=context(); const p=c.getClientCommercialProfile({latest:{...base,clientResponse:'alteracao'},openQuoteItems:[{}],confirmedItems:[],realizedItems:[],canceledItems:[]});
  assert.match(p.detail,/pedido de alteração/); assert.doesNotMatch(p.detail,/conduza para sinal/);
});
const contact=(key,name,email='',phone='',items=[])=>({key,name,email,phone,items});
test('phone comparison does not invent country or accept letters',()=>{
  const c=context(); assert.equal(c.getClientReviewPhone('+55 (21) 98765-4321'),c.getClientReviewPhone('0055 21 98765 4321'));
  assert.notEqual(c.getClientReviewPhone('(21) 98765-4321'),c.getClientReviewPhone('+55 21 98765-4321'));
  assert.equal(c.getClientReviewPhone('call 21987654321'),''); assert.equal(c.getClientReviewPhone('00000000000'),'');
});
test('same phone with conflicting emails requires review and never joins entries',()=>{
  const c=context(), input=[contact('a','Ana Ribeiro','one@example.test','21987654321'),contact('b','Ana Ribeiro','two@example.test','(21) 98765-4321')];
  const before=JSON.stringify(input), result=c.getClientRelationshipReviews(input);
  assert.equal(input.length,2); assert.equal(JSON.stringify(input),before); assert.equal(result.size,2);
  assert.match(result.get('a').candidates[0].reason,/e-mails diferentes/);
});
test('shared agency phone with different names is not a verified identity',()=>{
  const c=context(), result=c.getClientRelationshipReviews([contact('a','Ana Ribeiro','','21987654321'),contact('b','Bruno Tavares','','21987654321')]);
  assert.match(result.get('a').candidates[0].reason,/nomes diferentes/);
});
test('abbreviated multi-part names produce a weak hint only',()=>{
  const c=context(), result=c.getClientRelationshipReviews([contact('a','Marina Duarte'),contact('b','MARINA ALVES DUARTE COSTA')]);
  const candidate=result.get('a').candidates[0]; assert.equal(candidate.kind,'name'); assert.match(candidate.reason,/não identifica/);
  assert.deepEqual(Object.keys(candidate).sort(),['kind','name','reason']);
});
test('homonyms remain hints, not identity associations',()=>{
  const c=context(), input=[contact('a','José Silva'),contact('b','José Silva')], result=c.getClientRelationshipReviews(input);
  assert.equal(result.size,2); assert.equal(result.get('a').candidates[0].kind,'name'); assert.deepEqual(input.map(x=>x.key),['a','b']);
});
test('empty channels and first names never coincide',()=>{
  const c=context(), result=c.getClientRelationshipReviews([contact('a','Ana'),contact('b','Ana'),contact('c','')]);
  for(const row of result.values()) assert.equal(row.candidates.length,0);
});
test('shared phone hints never transitively merge another identity',()=>{
  const c=context(), input=[contact('a','Ana Ribeiro','','21987654321'),contact('b','Ana Ribeiro','','21987654321'),contact('c','Bruno Tavares')];
  const result=c.getClientRelationshipReviews(input); assert.equal(result.size,3); assert.equal(result.get('c').candidates.length,0);
});
test('only supplied authorized contacts participate',()=>{
  const c=context(); c.state.privateOtherTenant=[contact('secret','Hidden Canary','','21987654321')];
  const result=c.getClientRelationshipReviews([contact('a','Ana Ribeiro','','21987654321')]);
  assert.equal(result.get('a').candidates.length,0); assert.doesNotMatch(JSON.stringify([...result.values()]),/Canary|secret/);
});
test('common names and shared channels bound candidate output',()=>{
  const c=context(), input=Array.from({length:250},(_,i)=>contact(String(i),'Ana Silva','','21987654321'));
  const result=c.getClientRelationshipReviews(input); for(const row of result.values()){assert.ok(row.candidates.length<=3); assert.equal(row.ambiguousName,true); assert.equal(row.moreCandidates,true);}
});
test('name hints escape markup and never expose another quote history',()=>{
  const c=context(), review={candidates:[{name:'<img src=x onerror=alert(1)>',reason:'Apenas nome semelhante'}],variants:[],hasNameVariants:false,ambiguousName:false,moreCandidates:false};
  const html=c.renderClientRelationshipReview(contact('a','Ana Ribeiro'),review);
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img')); assert.match(html,/Nenhum cadastro ou histórico foi unido/); assert.doesNotMatch(html,/data-proposal|href=|Total cotado/);
});
test('comparison preserves distinct opportunities and removes duplicate versions',()=>{
  const c=context(), items=[{kind:'proposal',id:'p1',opportunityId:'o1',version:2,total:100,status:'negociacao'},
    {kind:'proposal',id:'p0',opportunityId:'o1',version:1,total:90,status:'negociacao'},
    {kind:'proposal',id:'p2',opportunityId:'o2',version:1,total:200,status:'negociacao'}];
  const html=c.renderClientQuoteComparison(contact('a','Ana Ribeiro','','',items));
  assert.match(html,/cotações atuais \(2\)/); assert.ok(!html.includes('R$ 90')); assert.match(html,/Duração a definir/); assert.match(html,/Quantidade a definir/); assert.match(html,/não significa mesmo evento ou reserva/);
});
test('comparison does not normalize unknown duration to one hour',()=>{
  const c=context(), html=c.renderClientQuoteComparison(contact('a','Ana Ribeiro','','',[{kind:'proposal',id:'p1',duration:null},{kind:'proposal',id:'p2',duration:3,guests:25,total:150}]));
  assert.match(html,/Duração a definir/); assert.match(html,/3 h/); assert.match(html,/25 pessoas/); assert.doesNotMatch(html,/1 h/);
});
test('public and registry identity resolution remain separate from hints',()=>{
  const registry=extract('getClientRegistry'), service=extract('getServiceClientMatch');
  assert.doesNotMatch(registry,/getClientRelationshipReviews|clientReviewNamesMatch/);
  assert.doesNotMatch(service,/getClientRelationshipReviews|clientReviewNamesMatch/);
});
test('comparison chooses current highest revision regardless of input order',()=>{
  const c=context(), items=[{kind:'proposal',id:'retired',opportunityId:'o1',version:1,isCurrent:false,total:90},
    {kind:'proposal',id:'older',opportunityId:'o1',version:2,total:100},
    {kind:'proposal',id:'current',opportunityId:'o1',version:3,total:120},
    {kind:'proposal',id:'other',opportunityId:'o2',version:1,total:200}];
  const html=c.renderClientQuoteComparison(contact('a','Ana Ribeiro','','',items));
  assert.match(html,/cotações atuais \(2\)/); assert.ok(html.includes('R$ 120')); assert.ok(!html.includes('R$ 90')); assert.ok(!html.includes('R$ 100'));
});
test('explicit null duration never falls back to stale snapshot duration',()=>{
  const c=context(), html=c.renderClientQuoteComparison(contact('a','Ana Ribeiro','','',[
    {kind:'proposal',id:'one',duration:null,snapshot:{event:{duration:1}}},
    {kind:'proposal',id:'two',duration:3}]));
  assert.match(html,/Duração a definir/); assert.doesNotMatch(html,/1 h/);
});
test('malformed comparison values never become money or quantities',()=>{
  const c=context(), html=c.renderClientQuoteComparison(contact('a','Ana Ribeiro','','',[
    {kind:'proposal',id:'one',duration:Infinity,guests:Infinity,total:''},
    {kind:'proposal',id:'two',duration:NaN,guests:NaN,total:Infinity}]));
  assert.doesNotMatch(html,/Infinity|NaN|R\$ 0/); assert.match(html,/Duração a definir/); assert.match(html,/Quantidade a definir/);
});
test('shared phone warning survives another two-person channel',()=>{
  const c=context(), a=contact('a','Ana Ribeiro','','21987654321',[{phone:'21977776666'}]);
  const result=c.getClientRelationshipReviews([a,contact('b','Bruno Tavares','','21987654321'),contact('c','Carlos Alves','','21987654321'),contact('d','Dora Costa','','21977776666')]);
  assert.equal(result.get('a').moreCandidates,true);
});
function pipelineContext(proposals, requests=[]) {
  const c=context(); c.state.quoteRequests=requests;
  Object.assign(c,{getWorkingProposals:()=>proposals,normalizeRequestStatus:x=>x,getPipelineStageForItem:x=>x,
    getPaymentCoverage:()=>({paidTotal:0,remainingDue:0}),getOpportunityForItem:()=>null,getFinalClientFromSnapshot:()=>'',
    getGroupNameFromSnapshot:()=>'',getLeadSegment:()=>'',parseLocalIsoDate:()=>null});
  vm.runInContext(extract('getPipelineItems',fs.readFileSync('commercial-rules.js','utf8')),c); return c;
}
test('pipeline preserves explicit unknown briefing separately from legacy calculation fields',()=>{
  const c=pipelineContext([{id:'one',duracao:null,convidados:null,snapshot:{event:{duration:1},client:{guests:1}}}]);
  const row=c.getPipelineItems()[0]; assert.equal(row.duration,1); assert.equal(row.guests,1);
  assert.equal(row.briefingDuration,null); assert.equal(row.briefingGuests,null);
});
test('pipeline display preserves explicit choices instead of older snapshot',()=>{
  const c=pipelineContext([{id:'one',duracao:3,convidados:25,snapshot:{event:{duration:1},client:{guests:1}}}]);
  const row=c.getPipelineItems()[0]; assert.equal(row.briefingDuration,3); assert.equal(row.briefingGuests,25);
});
test('request display keeps unknown values without changing legacy duration',()=>{
  const c=pipelineContext([],[{id:'lead',duracao:null,convidados:null,snapshot:{evento:{duracao:1,convidados:1}}}]);
  const row=c.getPipelineItems()[0]; assert.equal(row.duration,1); assert.equal(row.briefingDuration,null); assert.equal(row.briefingGuests,null);
});
for (const [label, totalFields] of [['null',{total:null}],['absent',{}],['blank',{total:''}]]) {
  test(`pipeline comparison distinguishes ${label} total from explicit zero without changing financial fallback`,()=>{
    const pc=pipelineContext([
      {id:'unknown',oportunidade_id:'unknown-op',status:'negociacao',...totalFields,snapshot:{totals:{total:120}}},
      {id:'zero',oportunidade_id:'zero-op',status:'negociacao',total:0,snapshot:{}},
    ]);
    const items=pc.getPipelineItems(), before=JSON.stringify(items);
    assert.equal(items.find(x=>x.id==='unknown').total,0);
    assert.equal(items.find(x=>x.id==='zero').briefingTotal,0);
    const c=context(), html=c.renderClientQuoteComparison({items});
    assert.match(html,/<td>A definir<\/td>/);
    assert.equal((html.match(/<td>R\$ 0<\/td>/g)||[]).length,1);
    assert.doesNotMatch(html,/R\$ 120/);
    assert.equal(JSON.stringify(items),before);
  });
}
function signatureContext() {
  const c=context(); c.fields={generalTerms:{value:'Terms'},eventDuration:null};
  Object.assign(c.state,{selectedIds:new Set(),guided:{}});
  Object.assign(c,{getSelectedItems:()=>[],tariffApplicationIdentity:()=>'',getTariffApplication:()=>null,
    tariffBasisKey:()=>'',getTariffEditorSnapshot:()=>null,getPrivatizationAdjustment:()=>0,
    getCurrentEventType:()=>'',getGuestCount:()=>0,getDuration:()=>Number(c.fields.eventDuration.value),
    roundCurrency:x=>x,getManualAdjustment:()=>0,getCurrentSourceOverrides:()=>({})});
  vm.runInContext(extract('getCurrentEditorSignature'),c); return c;
}
function addEditorStartup(c) {
  const header='document.addEventListener("DOMContentLoaded", () => {';
  const start=source.lastIndexOf(header); assert.ok(start>=0);
  const end=source.indexOf('}, { once: true });',start); assert.ok(end>start);
  vm.runInContext('function runEditorStartup(){'+source.slice(start+header.length,end)+'}',c);
}
test('non-editor startup never computes a quote signature or leave protection',()=>{
  for(const fields of [{generalTerms:null,eventDuration:null},{generalTerms:{value:''},eventDuration:null},{generalTerms:null,eventDuration:{value:'3'}}]) {
    const c=context(); c.fields=fields;
    c.getCurrentEditorSignature=()=>{throw Error('NON_EDITOR_SIGNATURE_FORBIDDEN');};
    c.syncEditorLeaveProtection=()=>{throw Error('NON_EDITOR_TRACKING_FORBIDDEN');};
    addEditorStartup(c); assert.doesNotThrow(()=>c.runEditorStartup());
  }
});
test('editor signature distinguishes unknown duration from explicit one hour',()=>{
  const c=signatureContext(); c.fields.eventDuration={value:''}; const empty=c.getCurrentEditorSignature();
  c.fields.eventDuration.value='1'; const explicit=c.getCurrentEditorSignature();
  assert.notEqual(empty,explicit); assert.equal(JSON.parse(explicit).duration,1);
});
test('duration null guard does not mask price or terms edits',()=>{
  const c=signatureContext(); c.fields.eventDuration={value:'3'};
  let price=100; c.getSelectedItems=()=>[{id:'item',nome:'Synthetic',descricao:'',calc:price}];
  const initial=c.getCurrentEditorSignature(); price=200; const priceEdit=c.getCurrentEditorSignature();
  assert.notEqual(initial,priceEdit); c.fields.generalTerms.value='Changed terms';
  assert.notEqual(priceEdit,c.getCurrentEditorSignature());
});
test('editor startup preserves a loaded record baseline and keeps leave protection active',()=>{
  const c=context(); c.fields={generalTerms:{value:'Terms'},eventDuration:{value:'3'}};
  c.state.loadedEditorSignature='saved-record-baseline'; let sync=0;
  c.getCurrentEditorSignature=()=>{throw Error('LOADED_BASELINE_MUST_NOT_BE_REPLACED');};
  c.syncEditorLeaveProtection=()=>{sync++;}; addEditorStartup(c); c.runEditorStartup();
  assert.equal(c.state.loadedEditorSignature,'saved-record-baseline'); assert.equal(sync,1);
});
