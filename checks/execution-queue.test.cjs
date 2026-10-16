const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../event-operations.js','utf8');
const helpers=source.slice(source.indexOf('function resetOpsExecution('),source.indexOf('function getOpsItems('));
function fixture({query,qa=false}={}){
 const state={session:{user:{id:'u'}},supabase:{from:()=>query},proposals:[]};const eventOps={handoffs:[],handoffTasks:[]};let renders=0;
 const c=vm.createContext({state,eventOps,QA_MODE:qa,Intl,Date,Promise,Error,Number,Array,JSON,structuredClone,operationStatuses:new Set(['planejamento','evento_proximo']),getTaskPlan:i=>i.plan||{},getOpsItems:()=>[],getOpsIncoming:i=>i.incoming,hasValidatedSignal:p=>p?.validacaoPendente!==true&&p?.valor>0,renderEventOperations:()=>renders++});
 vm.runInContext(helpers,c);return {c,state,eventOps,renders:()=>renders};
}
function queryPages(pages){let offset;const q={select(){return q},eq(){return q},order(){return q},range(a){offset=a;return Promise.resolve(pages[Math.floor(offset/100)])}};return q;}
test('execution queue paginates pending approvals before replacing cache',async()=>{const pages=[{data:Array.from({length:100},(_,n)=>({id:String(n)}))},{data:[{id:'last'}]}];const f=fixture({query:queryPages(pages)});await f.c.loadOpsExecution();assert.equal(f.c.opsExecutionState().rows.length,101);assert.equal(f.c.opsExecutionState().error,'');assert.equal(f.renders(),1);});
test('approval read failure retains last known rows and explicitly marks stale state',async()=>{const f=fixture({query:queryPages([{error:{message:'offline'}}])});f.c.opsExecutionState().rows=[{id:'old'}];await f.c.loadOpsExecution();assert.equal(f.c.opsExecutionState().rows[0].id,'old');assert.match(f.c.opsExecutionState().error,/Não foi possível/);});
test('late approval response cannot expose a previous session to the next user',async()=>{let finish;const q=queryPages([]);q.range=()=>new Promise(resolve=>finish=resolve);const f=fixture({query:q});const pending=f.c.loadOpsExecution();await Promise.resolve();f.state.session.user.id='next';const fresh=f.c.opsExecutionState();finish({data:[{id:'old-private'}]});await pending;assert.equal(fresh.rows.length,0);assert.equal(f.renders(),0);});
test('execution queue separates bank evidence, expired approvals, current task versions and historical outcome',()=>{
 const f=fixture();f.state.proposals=[{id:'p',snapshot:{pagamentoSinal:{valor:50,validacaoPendente:true}}},{id:'old',snapshot:{pagamentoSinal:{valor:50}}}];
 f.eventOps.handoffs=[{proposal_id:'p',opportunity_id:'opp',version:2}];f.eventOps.handoffTasks=[{opportunity_id:'opp',source_version:1,status:'pending'},{opportunity_id:'opp',source_version:2,status:'done',acknowledged_at:'2026-10-15'}];
 f.c.opsExecutionState().rows=[{id:'a',proposal_id:'p',expires_at:'2026-10-15',client_name:'A'}];
 const rows=f.c.getOpsExecutionEntries([{id:'p',opportunityId:'opp',name:'A',status:'planejamento',date:'2026-10-16'},{id:'old',name:'B',status:'planejamento',stage:'desfecho_pendente',date:'2026-10-10'}],new Date('2026-10-16T18:00:00Z'));
 assert.equal(rows[0].kind,'operation');assert.equal(rows.find(e=>e.kind==='finance').item.id,'p');assert.equal(rows.find(e=>e.kind==='outcome').item.id,'old');assert.match(rows.find(e=>e.kind==='approval').reason,/expirada/);assert.equal(rows.find(e=>e.kind==='operation').reason,'Revisar liberação da operação');
});
test('prepared service requests manager approval with the exact reviewed destination and message',async()=>{
 const f=fixture();f.c.QA_MODE=false;f.c.remoteProposalApprovalEnabled=async()=>true;f.c.getOpportunityForItem=()=>({ultima_resposta_cliente_em:'2026-10-16T18:00:00Z'});f.c.loadOpsExecution=async()=>{};f.c.showToast=()=>{};let call;
 f.state.supabase.functions={invoke:async(name,args)=>{call={name,args};return {data:{ok:true,approval:{id:'a'}}}}};
 await f.c.requestOpsDraftApproval({id:'p'},{id:'p',revision:4},'email','reviewed@example.test','Texto exato revisado');
 assert.equal(call.name,'event-proposal-approval');assert.deepEqual(JSON.parse(JSON.stringify(call.args.body)),{action:'request',channel:'email',proposalId:'p',reviewedRevision:4,destination:'reviewed@example.test',message:'Texto exato revisado',title:'Atendimento do seu evento',reviewedResponseAt:'2026-10-16T18:00:00Z'});
});
test('prepared service fails closed if policy is unavailable or disabled',async()=>{for(const value of [null,false]){const f=fixture();f.c.remoteProposalApprovalEnabled=async()=>value;let calls=0;f.state.supabase.functions={invoke:async()=>{calls++}};await assert.rejects(()=>f.c.requestOpsDraftApproval({},{id:'p',revision:1},'whatsapp','5521000000000','Mensagem revisada'),/aprovação remota/);assert.equal(calls,0);}});
for(const scenario of ['cancel','revision','session','success'])test(`bank validation: ${scenario} preserves the agreement and requires actual confirmation`,async()=>{
 const f=fixture({qa:true});const original={id:'p',revision:3,is_current:true,status:'planejamento',snapshot:{event:{notes:'acordo'},pagamentoSinal:{valor:50,data:'2026-10-13',validacaoPendente:true,comprovante:{nome:'original.pdf'}}}};f.state.proposals=[original];
 f.c.isFinanceSession=()=>true;f.c.ensureFullProposal=async()=>f.state.proposals[0];let dialog,write;
 f.c.showSignalPaymentDialog=async(total,options)=>{dialog=options;if(scenario==='cancel')return null;if(scenario==='revision')f.state.proposals[0]={...original,revision:4};if(scenario==='session')f.state.session.user.id='next';return {valor:50,data:'2026-10-13',bancos:['Itaú']};};
 f.c.persistEventProposal=async(id,changes,source)=>{write={id,changes,source};return {data:{...source,...changes},error:null}};f.c.upsertProposalState=()=>{};f.c.showToast=()=>{};f.c.loadEventOperations=async()=>{};f.c.renderPipeline=()=>{};
 if(['revision','session'].includes(scenario))await assert.rejects(()=>f.c.validateOpsSignal('p'));else await f.c.validateOpsSignal('p');
 assert.equal(dialog.requireBankConfirmation,true);assert.equal(original.snapshot.pagamentoSinal.validacaoPendente,true);
 if(scenario==='success'){assert.equal(write.changes.status,undefined);assert.equal(write.source.revision,3);assert.equal(write.changes.snapshot.pagamentoSinal.validacaoPendente,false);assert.equal(write.changes.snapshot.pagamentoSinal.comprovante.nome,'original.pdf');}else assert.equal(write,undefined);
});
test('synchronous read failure releases loading ownership and can be retried',async()=>{const f=fixture();f.state.supabase.from=()=>{throw Error('offline')};await f.c.loadOpsExecution();assert.equal(f.c.opsExecutionState().pending,null);f.state.supabase.from=()=>queryPages([{data:[{id:'recovered'}]}]);await f.c.loadOpsExecution({force:true});assert.equal(f.c.opsExecutionState().rows[0].id,'recovered');assert.equal(f.c.opsExecutionState().error,'');});
