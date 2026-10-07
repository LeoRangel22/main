const test = require('node:test');
const assert = require('node:assert/strict');
const {createStore,PAGE_SIZE} = require('../event-data.js');
const {createMonitor} = require('../event-performance.js');
const priorities = require('../commercial-rules.js');
function fixture(count=181) {
  let rows=Array.from({length:count},(_,i)=>({id:`record-${i}`,revision:1,snapshot:{marker:'preserved'}}));
  let fail=false, active=true, pause=null;
  const calls=[];
  const client={rpc:async(name,body)=>{
    calls.push({name,body});
    if(pause)await pause;
    if(fail&&name==='get_event_dashboard_rows')return{error:{code:'NETWORK'}};
    if(name==='get_event_dashboard_manifest')return{data:{version:1,records:{propostas:rows.map(r=>({id:r.id,version:String(r.revision)}))},summary:{},views:[]}};
    return{data:structuredClone(rows.filter(r=>body.record_ids.includes(r.id)))};
  }};
  return{client,calls,get rows(){return rows;},set rows(v){rows=v;},set fail(v){fail=v;},set active(v){active=v;},set pause(v){pause=v;},isCurrent:()=>active};
}
test('pagination loads all rows once, unchanged refresh reads only manifest, changed/deleted rows reconcile',async()=>{
  const f=fixture(),store=createStore({client:f.client});
  let r=await store.sync();assert.equal(r.rows.propostas.length,181);
  assert.equal(f.calls.filter(c=>c.name==='get_event_dashboard_rows').length,3);
  assert.ok(f.calls.filter(c=>c.body?.record_ids).every(c=>c.body.record_ids.length<=PAGE_SIZE));
  f.calls.length=0;r=await store.sync({force:true});assert.equal(r.changed,0);assert.equal(f.calls.length,1);
  f.rows[0].revision=2;f.rows.pop();
  f.calls.length=0;r=await store.sync({force:true});assert.equal(r.changed,1);assert.equal(r.removed,1);assert.equal(r.rows.propostas.length,180);assert.equal(f.calls.length,2);
  assert.equal(r.rows.propostas.find(x=>x.id==='record-0').revision,2);
});
test('failed refresh does not commit partial pages, retry preserves unchanged rows',async()=>{
  const f=fixture(3),store=createStore({client:f.client});await store.sync();
  f.rows[0].revision=2;f.fail=true;await assert.rejects(store.sync({force:true}));
  f.fail=false;const r=await store.sync({force:true});assert.equal(r.changed,1);assert.equal(r.rows.propostas.length,3);
});
test('single flight and disposed-session responses cannot refill cache',async()=>{
  const f=fixture(3);let release;f.pause=new Promise(r=>{release=r;});
  const store=createStore({client:f.client,isCurrent:f.isCurrent});
  const a=store.sync(),b=store.sync();assert.equal(f.calls.length,1);
  store.dispose();release();await assert.rejects(a,e=>e.code==='SESSION_CHANGED');await assert.rejects(b,e=>e.code==='SESSION_CHANGED');
});
test('invalidate during a read retains dirty flag so the next read bypasses cooldown',async()=>{
 const f=fixture(1);let release;f.pause=new Promise(r=>{release=r;});const store=createStore({client:f.client});
 const read=store.sync();store.invalidate();release();await read;f.pause=null;f.calls.length=0;await store.sync();assert.equal(f.calls.length,1);
});
test('diagnostics percentile and failures are honest, bounded and contain no row content',()=>{
  let at=100;const sent=[];const monitor=createMonitor({now:()=>at,capture:(event,props)=>sent.push({event,props})});
  for(let i=1;i<=40;i++){at++;monitor.record({ok:true,duration_ms:i,request_count:2,payload_bytes:200,changed_rows:1,snapshot:{client:'PRIVATE'}});}
  let m=monitor.snapshot();assert.equal(m.samples,30);assert.equal(m.median,25);assert.equal(m.p90,37);
  at++;monitor.record({ok:false,reason_code:'read_failed'});m=monitor.snapshot();assert.equal(m.failures,1);assert.equal(m.stale,true);assert.ok(!JSON.stringify(sent).includes('PRIVATE'));
  at++;monitor.record({ok:true,duration_ms:1});assert.equal(monitor.snapshot().stale,false);
});
test('timezone, validity and closed/past/answered proposals do not invent follow-up priorities',()=>{
  assert.equal(priorities.today(new Date('2026-10-08T01:00:00Z')),'2026-10-07');
  const now=Date.parse('2026-10-07T15:00:00Z');
  const item={kind:'proposal',status:'proposta_enviada',date:'2026-10-20',createdAt:'2026-09-24T15:00:00Z',snapshot:{event:{validity:'14 dias'}}};
  assert.equal(priorities.validity(item,now).reason,'validity_48h');
  assert.equal(priorities.validity({...item,createdAt:'2026-09-20T15:00:00Z'},now).reason,'validity_expired');
  for(const patch of [{date:'2026-10-06'},{clientResponse:'alteracao'},{isDraft:true},{status:'cancelado'}])assert.equal(priorities.validity({...item,...patch},now),null);
});
test('rank explains ownership/due risk and respects scheduled follow-up while preserving urgent response',()=>{
  const context={planFor:i=>({owner:i.owner||'',due:i.due||'',overdue:!!i.overdue}),scheduledFor:i=>i.scheduled?{label:'Retorno agendado',note:'Contato no prazo combinado'}:null,trackFor:t=>t.track,profile:{canManageCommercial:true},salesOnly:true};
  const tasks=[{item:{id:'a',scheduled:true},title:'Retomar',note:'Sem resposta',priority:90,track:'Comercial'},{item:{id:'b',overdue:true},title:'Responder pedido de ajuste',note:'Cliente pediu ajuste',priority:95,track:'Venda'}];
  const ranked=priorities.rank(tasks,context);assert.equal(ranked[0].item.id,'b');assert.ok(ranked[0].reasonCodes.includes('overdue'));assert.ok(ranked[0].reasons.includes('Ainda sem responsável.'));assert.equal(ranked[1].title,'Retorno agendado');
});
