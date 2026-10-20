const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../operational-ui.js','utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const listeners={},calls=[],mutations=[],renders=[],toasts=[];
 const root={addEventListener:(name,fn)=>listeners[name]=fn};
 const state={workspaceMode:'sales',supabase:{rpc:(name,args)=>new Promise(resolve=>calls.push({name,args,resolve}))},session:{user:{id:'u',email:'leorangel@gmail.com'}},proposals:[{id:'a',revision:1},{id:'b',revision:1}]};
 const c=vm.createContext({state,window:{},document:{querySelector:()=>root},QA_MODE:false,Date,Number,Promise,Error,console,
 readinessRevision:p=>Number(p?.revision),readinessAwait:p=>p,ensureFullProposal:async id=>state.proposals.find(p=>p.id===id),renderWorkspaceMode(){},showToast:msg=>toasts.push(msg),
 acknowledgeOperationalHandoffChanges:async id=>mutations.push(id)});
 vm.runInContext(source,c);c.renderOperationWorkspace=()=>renders.push(vm.runInContext('({selected:operationWorkspace.selected,pending:Boolean(operationWorkspace.pending),error:operationWorkspace.error})',c));
 const read=key=>vm.runInContext(`operationWorkspace.${key}`,c);
 const finish=(call,id)=>call.resolve({data:{proposal_id:id,revision:1,ready:false,blockers:[],generated_at:new Date().toISOString()}});
 function button(id,revision=1){return {dataset:{},hasAttribute:name=>name==='data-operation-ack',closest:selector=>selector==='[data-operation-proposal]'?{dataset:{operationProposal:id,operationRevision:String(revision)}}:null};}
 return {c,state,listeners,calls,mutations,renders,toasts,read,finish,button};
}
test('selection immediately removes stale action ownership while another event loads',async()=>{
 const f=fixture(),pending=f.c.loadOperationWorkspaceDetail('b');
 assert.deepEqual(JSON.parse(JSON.stringify(f.renders[0])),{selected:'b',pending:true,error:''});
 const old=f.button('a');await f.listeners.click({target:{closest:()=>old}});
 assert.deepEqual(f.mutations,[]);assert.match(f.toasts[0],/seleção mudou/);
 await tick();f.finish(f.calls[0],'b');await pending;
 assert.equal(f.read('pending'),null);assert.equal(f.read('data.proposal_id'),'b');
});
test('late A and repeated A reads cannot overwrite a newer selected B result',async()=>{
 const f=fixture(),first=f.c.loadOperationWorkspaceDetail('a');await tick();const second=f.c.loadOperationWorkspaceDetail('a');await tick();const third=f.c.loadOperationWorkspaceDetail('b');await tick();
 f.finish(f.calls[2],'b');await third;f.finish(f.calls[1],'a');await second;f.finish(f.calls[0],'a');await first;
 assert.equal(f.read('selected'),'b');assert.equal(f.read('data.proposal_id'),'b');assert.equal(f.read('pending'),null);
});
test('failed detail hydration is caught and cannot leave old event actions available',async()=>{
 const f=fixture();f.c.ensureFullProposal=async()=>{throw Error('read failed');};await f.c.loadOperationWorkspaceDetail('b');
 assert.equal(f.read('pending'),null);assert.equal(f.read('data'),null);assert.equal(f.read('error'),'read failed');assert.equal(f.calls.length,0);
 assert.equal(f.c.operationDisplayedProposal(f.button('a')),null);
});
test('displayed actions are bound to both proposal and revision, including delayed old DOM events',async()=>{
 const f=fixture(),pending=f.c.loadOperationWorkspaceDetail('b');await tick();f.finish(f.calls[0],'b');await pending;
 assert.equal(f.c.operationDisplayedProposal(f.button('a')),null);assert.equal(f.c.operationDisplayedProposal(f.button('b',0)),null);
 assert.equal(f.c.operationDisplayedProposal(f.button('b')).id,'b');f.state.proposals[1].revision=2;assert.equal(f.c.operationDisplayedProposal(f.button('b')),null);
});
test('logout during read cannot restore evidence and malformed responses fail closed',async()=>{
 const f=fixture(),pending=f.c.loadOperationWorkspaceDetail('a');await tick();f.state.session=null;f.c.clearOperationWorkspace();f.finish(f.calls[0],'a');await pending;assert.equal(f.read('data'),null);assert.equal(f.read('selected'),'');
 const g=fixture(),next=g.c.loadOperationWorkspaceDetail('a');await tick();g.calls[0].resolve({data:{proposal_id:'a',revision:1,ready:true,blockers:'not an array'}});await next;assert.equal(g.read('data'),null);assert.match(g.read('error'),/incompletas/);
});
test('successful assignment invalidates dashboard cache before rereading server owner and revision',()=>{
 assert.match(source,/invalidateCommercialDashboard\(\);await loadEventOperations\(\)/);
});
