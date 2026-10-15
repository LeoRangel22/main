const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../commercial-rules.js`,'utf8');
const working=source.slice(source.indexOf('function getWorkingProposals()'),source.indexOf('let commercialOpportunityIndex'));
for(const compact of [false,true])test(`amendment does not replace booked working agreement (compact=${compact})`,()=>{
 const original={id:'booked',oportunidade_id:'opp',status:'confirmado',is_current:true,publication_status:'sent',total:1120,versao:1,snapshot:{_dashboard_summary:compact},updated_at:'2026-10-10'};
 const draft={id:'amendment',oportunidade_id:'opp',status:'negociacao',is_current:false,publication_status:'draft',total:9999,versao:2,snapshot:{amendmentOf:{id:'booked'},_dashboard_summary:compact},updated_at:'2026-10-14'};
 const c=vm.createContext({state:{proposals:[draft,original]},normalizeProposalStatus:x=>x});vm.runInContext(working,c);
 const result=c.getWorkingProposals()[0];assert.equal(result.id,'booked');assert.equal(result.status,'confirmado');assert.equal(result.total,1120);assert.equal(result.pendingDraftId,'amendment');
});
test('ordinary negotiating draft remains the working quotation',()=>{
 const c=vm.createContext({state:{proposals:[{id:'old',oportunidade_id:'opp',status:'negociacao',publication_status:'sent',is_current:true},{id:'draft',oportunidade_id:'opp',status:'negociacao',publication_status:'draft',updated_at:'2026-10-14'}]},normalizeProposalStatus:x=>x});
 vm.runInContext(working,c);assert.equal(c.getWorkingProposals()[0].id,'draft');
});
for(const page of ['index.html','clientes.html','comunicacao.html','valores.html'])test(`working-version rules cache matches journey rollout in ${page}`,()=>{
 const html=fs.readFileSync(`${__dirname}/../${page}`,'utf8');assert.match(html,/commercial-rules\.js\?v=20261015-approval-closure/);
});
