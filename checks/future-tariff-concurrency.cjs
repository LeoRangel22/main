const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async function verifyTariffConcurrency(c,connect,name,actor){
 const email=(await c.query('select email from auth.users where id=$1',[actor])).rows[0].email;
 const claims=JSON.stringify({sub:actor,email,role:'authenticated'});
 const snapshot={event:{date:'2099-02-01'},generalTerms:'VALIDADE: até 31/12/2098.',prices:[{id:'race-item',formula:'fixo',precoFixo:100}],privatizationRules:[],selectedItems:[{id:'race-item',formula:'fixo',precoFixo:100}]};
 const basis=(await c.query('select event_private.tariff_application_basis($1::jsonb) as value',[JSON.stringify(snapshot)])).rows[0].value;
 async function make(){const opp=(await c.query("insert into oportunidades(cliente_nome,status) values('Synthetic tariff concurrency','negociacao') returning id")).rows[0].id;
  return (await c.query("insert into propostas(oportunidade_id,cliente_nome,data_evento,status,publication_status,snapshot) values($1,'Synthetic tariff concurrency','2099-02-01','negociacao','draft',$2::jsonb) returning *",[opp,JSON.stringify(snapshot)])).rows[0];}
 function payload(requestId){return {snapshot:{...snapshot,event:{...snapshot.event,tariffApplication:{schema:1,kind:'request',mode:'use_current_table',requestId,eventDate:'2099-02-01',validUntil:'2098-12-31',catalogVersion:null,reviewedBasis:basis}}}};}
 const writers=await Promise.all([connect(name),connect(name)]);
 try{
  await Promise.all(writers.map(x=>x.query("select set_config('request.jwt.claims',$1,false)",[claims])));
  const row=await make();
  const writes=await Promise.allSettled(writers.map(x=>x.query('select * from save_event_proposal($1,$2,$3,null)',[row.id,JSON.stringify(payload(randomUUID())),row.revision])));
  assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.equal(writes.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
  const proof=(await c.query('select event_private.tariff_application_valid(p) as valid from propostas p where id=$1',[row.id])).rows[0];assert.equal(proof.valid,true);
  assert.equal(Number((await c.query('select count(*) from event_private.tariff_applications where proposal_id=$1 and active',[row.id])).rows[0].count),1);
  const [a,b]=await Promise.all([make(),make()]),requestId=randomUUID();
  const replay=await Promise.allSettled(writers.map((x,i)=>{const p=i?a:b;return x.query('select * from save_event_proposal($1,$2,$3,null)',[p.id,JSON.stringify(payload(requestId)),p.revision]);}));
  assert.equal(replay.filter(r=>r.status==='fulfilled').length,1);assert.equal(replay.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
  assert.equal(Number((await c.query('select count(*) from event_private.tariff_applications where request_id=$1 and originated',[requestId])).rows[0].count),1);
  console.log('PASS native concurrent tariff confirmation: stale revisions and cross-proposal request reuse fail closed');
 }finally{await Promise.all(writers.map(x=>x.end()));}
};
