const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const c=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function proposalSendOutcome('),source.indexOf('function renderProposalSendFeedback(')),c);
vm.runInContext(source.slice(source.indexOf('function canRegisterManualProposalSend('),source.indexOf('function openManualSendDialog(')),c);
test('only an explicit accepted result is success; missing, failed and uncertain outcomes do not move a sale',()=>{
 assert.equal(c.proposalSendOutcome({ok:true,deliveryStatus:'accepted'},null).status,'accepted');
 for(const data of [null,{}, {ok:false}, {ok:true,deliveryStatus:'uncertain'}, {ok:false,deliveryStatus:'failed'}])assert.equal(c.proposalSendOutcome(data,null).status,'uncertain');
 assert.equal(c.proposalSendOutcome({ok:true},new Error('lost response')).status,'uncertain');
});
test('paused transport explicitly says not sent and retains manual workflow',()=>{
 const result=c.proposalSendOutcome({ok:false,deliveryStatus:'paused'},new Error('409'));
 assert.equal(result.status,'paused');assert.match(result.message,/não foi realizado/);assert.match(result.message,/envio manual/);
});
test('the current ready negotiation supports manual send without treating drafts or contracts as sent',()=>{
 const p={is_current:true,publication_status:'ready',status:'negociacao',snapshot:{}};
 assert.equal(c.canRegisterManualProposalSend(p),true);
 for(const patch of [{is_current:false},{publication_status:'draft'},{publication_status:'sent'},{status:'confirmado'},{status:'cancelado'},{snapshot:{amendmentOf:{id:'base'}}}])assert.equal(c.canRegisterManualProposalSend({...p,...patch}),false);
});
