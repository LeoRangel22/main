const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../app.js`,'utf8');
const helpers=source.slice(source.indexOf('function proposalSendContent('),source.indexOf('async function sendProposalWhatsAppViaZapi('));
function fixture(){
  const before={id:'test',revision:2,status:'proposta_pronta',publication_status:'ready',sent_at:null,
    updated_at:'before',proxima_acao:'Enviar proposta',proxima_acao_em:'before',
    snapshot:{event:{notes:'approved',signalDeadlineAt:null},totals:{total:100},prices:[{id:1,price:100}]}};
  const after=structuredClone(before);
  Object.assign(after,{revision:3,status:'proposta_enviada',publication_status:'sent',sent_at:'sent',updated_at:'after',proxima_acao:'Retomar cliente',proxima_acao_em:'after'});
  after.snapshot.event.signalDeadlineAt='deadline';
  return {before,after};
}
function setup(){
  const {before,after}=fixture();
  const state={activeProposalId:'test',activeQuoteRequestId:'quote',manualSourceKey:'',editorProposalBase:structuredClone(before),session:{user:{id:'user'}}};
  const context=vm.createContext({structuredClone,state,upsertProposalState:row=>context.saved=row,renderLoadedEditorBar:()=>{},showToast:()=>{}});
  state.supabase={from:()=>({select:()=>({eq:()=>({single:async()=>({data:after,error:null})})})})};
  vm.runInContext(helpers,context);
  return {before,after,state,context};
}
test('own send reconciles observed revision without mutating reviewed content',async()=>{
  const {before,after,state,context:c}=setup(); const old=JSON.stringify(before);
  const result=await c.reconcileProposalEditorAfterSend(c.captureProposalSendEditor(before));
  assert.equal(result,'reconciled');assert.equal(state.editorProposalBase.revision,3);assert.equal(JSON.stringify(before),old);
  assert.deepEqual(state.editorProposalBase,after);assert.notEqual(state.editorProposalBase,after);
});
for(const [name,mutate] of [
  ['revision jump',p=>p.revision++],['same revision but changed data',p=>p.revision=2],
  ['changed notes',p=>p.snapshot.event.notes='another editor'],['changed price',p=>p.snapshot.prices[0].price=200],
  ['client response',p=>p.snapshot.clienteResposta={acao:'alteracao'}],['payment',p=>p.snapshot.pagamentoSinal={valor:100}],
  ['wrong proposal',p=>p.id='other'],['summary',p=>p._dashboard_summary=true],
  ['wrong stage',p=>p.status='confirmado'],['missing row',p=>p.snapshot=null],
]) test(`concurrent or incomplete ${name} never advances base`,async()=>{
  const {before,after,state,context:c}=setup();const base=state.editorProposalBase;mutate(after);
  assert.equal(await c.reconcileProposalEditorAfterSend(c.captureProposalSendEditor(before)),'conflict');
  assert.equal(state.editorProposalBase,base);
});
for(const [name,mutate] of [
  ['user',s=>s.session.user.id='other'],['logout',s=>s.session=null],['client',s=>s.supabase={}],
  ['event',s=>s.activeProposalId='other'],['reopened editor',s=>s.editorProposalBase=structuredClone(s.editorProposalBase)],
  ['source',s=>s.manualSourceKey='new'],
])test(`switching ${name} during read cannot affect the current editor`,async()=>{
  const {before,after,state,context:c}=setup();
  state.supabase.from=()=>({select:()=>({eq:()=>({single:async()=>{mutate(state);return {data:after};}})})});
  const call=c.captureProposalSendEditor(before);
  assert.equal(await c.reconcileProposalEditorAfterSend(call),'changed');assert.equal(c.saved,undefined);
});
test('read failure preserves old revision instead of fabricating a new one',async()=>{
  const {before,state,context:c}=setup();state.supabase.from=()=>{throw Error('offline');};
  const base=state.editorProposalBase;
  assert.equal(await c.reconcileProposalEditorAfterSend(c.captureProposalSendEditor(before)),'unavailable');assert.equal(state.editorProposalBase,base);
});
test('accepted duplicate with identical revision is safe, changed duplicate is not',()=>{
  const {after,context:c}=setup();assert.equal(c.isOwnProposalSendRevision(after,structuredClone(after)),true);
  const changed=structuredClone(after);changed.snapshot.event.notes='concurrent';assert.equal(c.isOwnProposalSendRevision(after,changed),false);
});
test('JSON key order does not simulate a concurrent write',()=>{
  const {before,after,context:c}=setup();after.snapshot={prices:after.snapshot.prices,totals:after.snapshot.totals,event:after.snapshot.event};
  assert.equal(c.isOwnProposalSendRevision(before,after),true);
});
test('both reviewed provider sends reconcile, without weakening server revision checks',()=>{
  for(const name of ['sendProposalWhatsAppViaZapi','sendProposalEmailViaZepto']){
    const body=source.slice(source.indexOf(`async function ${name}(`));
    const fn=body.slice(0,body.indexOf('\nasync function ',1));
    assert.match(fn,/captureProposalSendEditor\(proposal\)/);assert.match(fn,/await reconcileProposalEditorAfterSend\(sendEditor\)/);
    assert.match(fn,/reviewedRevision:/);assert.match(fn,/await confirmClientSend/);
  }
  assert.match(source,/p_expected_revision: existing \? Number\(existing.revision/);
});
