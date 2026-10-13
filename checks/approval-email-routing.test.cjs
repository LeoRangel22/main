const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../app.js`,'utf8');
const body=source.slice(source.indexOf('async function runQuickReply('),source.indexOf('function renderQuickReplies('));
function setup(enabled,confirmed=true){
  const calls={sent:[],reviews:[],logs:[]},location={href:''};
  const payload={id:'followup',title:'Retorno',subject:'Assunto de acompanhamento',message:'Mensagem exata de acompanhamento sem proposta inicial'};
  const context=vm.createContext({QA_MODE:false,encodeURIComponent,state:{sendLocks:{email:false}},window:{location,setTimeout:()=>{}},
    getQuickReplyContext:()=>({email:'fixture@example.test',status:'negociacao'}),
    getQuickReplyPresets:()=>[{...payload,needsLink:true}],getQuickReplyPayload:()=>payload,
    ensureProposalForSharing:async()=>({saved:{id:'fixture'},url:'https://example.test/proposta'}),
    remoteProposalApprovalEnabled:async()=>enabled,
    sendProposalEmailViaZepto:async p=>{calls.sent.push(p);return true;},
    confirmClientSend:async p=>{calls.reviews.push(p);return confirmed;},
    createIntegrationLog:p=>calls.logs.push(p),showToast:()=>{},console});
  vm.runInContext(body,context);return {calls,location,run:()=>context.runQuickReply('followup','email')};
}
test('disabled approval opens only the selected reviewed email draft, without a generic proposal wrapper',async()=>{
  const f=setup(false);await f.run();assert.equal(f.calls.sent.length,0);assert.equal(f.calls.reviews.length,1);
  const url=new URL(f.location.href);assert.equal(url.protocol,'mailto:');
  assert.equal(url.searchParams.get('subject'),'Assunto de acompanhamento');
  assert.equal(url.searchParams.get('body'),'Mensagem exata de acompanhamento sem proposta inicial');
  assert.equal(f.calls.reviews[0].message,url.searchParams.get('body'));
  assert.equal(f.calls.logs[0].status,'opened');assert.ok(f.calls.logs.every(x=>x.status!=='sent'));
});
test('enabled approval routes quick reply for manager review instead of opening mail',async()=>{
  const f=setup(true);await f.run();assert.equal(f.calls.sent.length,1);assert.equal(f.calls.reviews.length,0);assert.equal(f.location.href,'');
  assert.equal(f.calls.sent[0].message,'Mensagem exata de acompanhamento sem proposta inicial');
});
test('unknown approval policy fails closed',async()=>{
  const f=setup(null);await f.run();assert.equal(f.calls.sent.length,0);assert.equal(f.calls.reviews.length,0);assert.equal(f.location.href,'');
});
test('cancelled contingency review never opens or sends email',async()=>{
  const f=setup(false,false);await f.run();assert.equal(f.calls.sent.length,0);assert.equal(f.location.href,'');assert.equal(f.calls.logs[0].status,'canceled');
});
