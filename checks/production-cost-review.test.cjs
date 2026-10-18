const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('../production-planning');
const source=fs.readFileSync(__dirname+'/../production-ui.js','utf8');
function fixture(qa=false){
 const calls=[];let submit;
 const state={supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:{}};}},session:{user:{id:'finance'}},proposals:[]};
 const c=vm.createContext({state,QA_MODE:qa,document:{addEventListener(){}},isFinanceSession:()=>true,escapeHtml:x=>String(x),readinessAwait:x=>x,opsDialog:(title,html,label,save)=>{submit=save;},EventProduction:P});
 vm.runInContext(source,c);
 vm.runInContext('loadProductionWorkspace=async()=>{};',c);
 const data={rows:[{id:'a',item:0,ingredient:'Limão',sector:'bar',unit:'kg',basis:'guest',quantity:.1,yield:80,loss:10,stock:1}],crew:[{id:'c',sector:'bar',lead:'Pessoa fixture',people:1,hours:2}],crew_reason:'',logistics:{setup:0,teardown:0,space:'Lounge'}};
 const plan={revision:2,data,reviewed_at:'2026-10-18T00:00:00Z',costs:{a:10,c:20,fixed:0}};
 c.plan=plan;c.costs=plan.costs;
 vm.runInContext("productionWorkspace.data={plan,costs};productionQa.set('p',plan);",c);
 return {c,state,plan,calls,dialog:()=>submit,save:entries=>submit({querySelectorAll:()=>entries.map(([key,value])=>({dataset:{costKey:key},value}))})};
}
const copy=x=>JSON.parse(JSON.stringify(x));
test('production cost form sends explicit null for cleared costs and preserves explicit zero',async()=>{
 const f=fixture();await f.c.editProductionCosts('p');await f.save([['a',''],['c','25'],['fixed','0']]);
 assert.deepEqual(copy(f.calls),[{name:'set_event_production_costs',args:{target_proposal:'p',expected_plan_revision:2,costs:[{key:'a',value:null},{key:'c',value:25},{key:'fixed',value:0}]}}]);
});
test('QA clearing a known cost makes the estimate incomplete and does not reappear on reopen',async()=>{
 const f=fixture(true);await f.c.editProductionCosts('p');await f.save([['a',''],['c','20'],['fixed','0']]);
 assert.deepEqual(copy(f.plan.costs),{c:20,fixed:0});assert.equal(P.costEstimate(f.plan.data.rows,f.plan.data.crew,20,f.plan.costs).total,null);
 f.c.costs=f.plan.costs;vm.runInContext('productionWorkspace.data.costs=costs',f.c);
 await f.c.editProductionCosts('p');await f.save([['a','0'],['c','20'],['fixed','0']]);
 assert.equal(P.costEstimate(f.plan.data.rows,f.plan.data.crew,20,f.plan.costs).missing,0);assert.equal(f.plan.costs.a,0);
});
test('cost dialog cannot save after session changes',async()=>{
 const f=fixture();await f.c.editProductionCosts('p');f.state.session={user:{id:'other'}};
 await assert.rejects(f.save([['a','']]),/A sessão mudou/);assert.equal(f.calls.length,0);
});
for(const [field,value] of Object.entries({ingredient:'Laranja',unit:'g',basis:'event',quantity:.2,yield:90,loss:5,item:1,sector:'cozinha'}))test(`same row UUID cannot retain costs after ${field} changes`,()=>{
 const f=fixture(true),next=copy(f.plan.data);next.rows[0][field]=value;
 assert.deepEqual(copy(f.c.productionRetainedCosts(f.plan,next)),{c:20,fixed:0});
});
for(const [field,value] of Object.entries({sector:'cozinha',lead:'Outro responsável',people:2,hours:4}))test(`same crew UUID cannot retain costs after ${field} changes`,()=>{
 const f=fixture(true),next=copy(f.plan.data);next.crew[0][field]=value;
 assert.deepEqual(copy(f.c.productionRetainedCosts(f.plan,next)),{a:10,fixed:0});
});
test('stock observations and object key order preserve known unit costs',()=>{
 const f=fixture(true),next=copy(f.plan.data);next.rows[0]=Object.fromEntries(Object.entries(next.rows[0]).reverse());next.rows[0].stock=2;next.stock_checked_at='2026-10-18T01:00:00Z';
 assert.deepEqual(copy(f.c.productionRetainedCosts(f.plan,next)),f.plan.costs);
});
test('removed rows, UUID reuse across row/crew, and reverting meaning cannot resurrect old costs',()=>{
 const f=fixture(true),next=copy(f.plan.data);next.rows=[];let retained=f.c.productionRetainedCosts(f.plan,next);assert.deepEqual(copy(retained),{c:20,fixed:0});
 assert.deepEqual(copy(f.c.productionRetainedCosts({data:next,costs:retained},f.plan.data)),{c:20,fixed:0});
 next.crew.push({...f.plan.data.crew[0],id:'a'});assert.deepEqual(copy(f.c.productionRetainedCosts(f.plan,next)),{c:20,fixed:0});
 const changed=copy(f.plan.data);changed.rows[0].ingredient='Laranja';retained=f.c.productionRetainedCosts(f.plan,changed);
 assert.deepEqual(copy(f.c.productionRetainedCosts({data:changed,costs:retained},f.plan.data)),{c:20,fixed:0});
});
test('logistics changes require renewed fixed-cost review without erasing unchanged unit costs',()=>{
 const f=fixture(true),next=copy(f.plan.data);next.logistics.setup=60;
 assert.deepEqual(copy(f.c.productionRetainedCosts(f.plan,next)),{a:10,c:20});
});

test('two cost dialogs at one revision cannot clear or overwrite the first saved result',async()=>{
 const f=fixture(true);delete f.plan.costs.a;
 await f.c.editProductionCosts('p');const first=f.dialog();await f.c.editProductionCosts('p');const stale=f.dialog();
 const form=entries=>({querySelectorAll:()=>entries.map(([key,value])=>({dataset:{costKey:key},value}))});
 const reviewed=f.plan.reviewed_at;await first(form([['a','15'],['c','20'],['fixed','0']]));
 assert.equal(f.plan.revision,3);assert.equal(f.plan.reviewed_at,reviewed);
 await assert.rejects(stale(form([['a',''],['c','25'],['fixed','0']])),/O plano ou acordo mudou/);
 assert.deepEqual(copy(f.plan.costs),{a:15,c:20,fixed:0});assert.equal(f.plan.revision,3);
});
