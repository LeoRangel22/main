const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../app.js`,'utf8');
const ctx=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function getSalesFunnelState('),source.indexOf('function getSalesFunnelStateForItem(')),ctx);
vm.runInContext(source.slice(source.indexOf('function getSalesFunnelItems('),source.indexOf('function renderSalesFunnelOverview(')),ctx);
const now=Date.parse('2026-10-23T12:00:00Z');
const proposal=changes=>({id:'p',kind:'proposal',status:'negociacao',snapshot:{},...changes});
const stage=(p,wait)=>ctx.getSalesFunnelState(p,wait,now)?.id;
test('a lead and an unsent ready proposal have separate next steps',()=>{
 assert.equal(stage({kind:'request',status:'lead_recebido'}),'lead');
 assert.equal(stage(proposal({status:'proposta_pronta',publicationStatus:'ready'})),'preparation');
});
for(const status of ['proposta_enviada','negociacao','confirmado'])test(`${status} alone proves neither sending nor payment`,()=>assert.equal(stage(proposal({status})),'review'));
test('sending must be recorded with a valid nonfuture timestamp',()=>{
 for(const sentAt of ['',null,'bad','2027-01-01'])assert.equal(stage(proposal({sentAt})),'review');
 assert.equal(stage(proposal({sentAt:'2026-10-22T12:00:00Z'})),'waiting');
});
test('approval awaiting signal differs from a change request or generic reply',()=>{
 assert.equal(stage(proposal({clientResponse:'confirmar'})),'approved');
 assert.equal(stage(proposal({clientResponse:'alteracao'})),'changes');
 assert.equal(stage(proposal({clientResponse:'cancelar'})),'reply');
 assert.equal(stage(proposal({clientResponse:'duvida'})),'reply');
});
test('a proof is not collected money; pending validation blocks the won state',()=>{
 assert.equal(stage(proposal({clientResponse:'confirmar',hasSignalProof:true})),'approved');
 assert.equal(stage(proposal({status:'confirmado',paymentPaidTotal:100,snapshot:{pagamentoSinal:{valor:100,validacaoPendente:true}}})),'validation');
 assert.equal(stage(proposal({status:'confirmado',paymentPaidTotal:100,snapshot:{pagamentoSinal:{valor:100}}})),'won');
 assert.equal(stage(proposal({status:'confirmado',paymentPaidTotal:0,snapshot:{pagamentoSinal:{valor:100}}})),'review');
});
test('draft cannot inherit old approval or old send as current readiness',()=>{
 assert.equal(stage(proposal({isDraft:true,clientResponse:'confirmar',sentAt:'2026-10-22T12:00:00Z'})),'preparation');
  assert.equal(stage(proposal({isDraft:true,status:'confirmado',paymentPaidTotal:100,snapshot:{pagamentoSinal:{valor:100}}})),'preparation');
});
test('new customer message needs a reply; old message before recorded send does not',()=>{
 const p=proposal({sentAt:'2026-10-22T12:00:00Z'});
 assert.equal(stage(p,{waiting:'team',message:{occurred_at:'2026-10-23T10:00:00Z'}}),'reply');
 assert.equal(stage(p,{waiting:'team',message:{occurred_at:'2026-10-22T10:00:00Z'}}),'waiting');
 assert.equal(stage(p,{waiting:'unknown'}),'review');
 assert.equal(stage(proposal({}),{waiting:'client'}),'review');
});
test('closed outcomes and post-sale do not pollute the active funnel',()=>{
 for(const status of ['cancelado','perdido','pos_venda','realizado'])assert.equal(stage(proposal({status})),undefined);
 assert.equal(stage(proposal({stage:'desfecho_pendente'})),undefined);
});
test('one opportunity is counted once, preferring its working proposal to its lead',()=>{
 const lead={id:'l',kind:'request',opportunityId:'o'},p=proposal({opportunityId:'o'}),rows=[lead,p];
 const before=JSON.stringify(rows),result=ctx.getSalesFunnelItems(rows);assert.equal(result.length,1);assert.equal(result[0].id,'p');assert.equal(JSON.stringify(rows),before);
 assert.equal(ctx.getSalesFunnelItems([{...lead,opportunityId:''},{...p,opportunityId:''}]).length,2);
});
