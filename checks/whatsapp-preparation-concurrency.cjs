// Disposable PostgreSQL only; no URLs, secrets or transport operations.
const assert=require('node:assert/strict');
module.exports=async function verifyPreparation(c,connect,name,actor){
 const email=(await c.query('select email from auth.users where id=$1',[actor])).rows[0].email;
 const opp=(await c.query("insert into oportunidades(cliente_nome,status,data_evento) values('Preparation concurrency','proposta_pronta','2099-11-19') returning id")).rows[0].id;
 const p=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,total,subtotal,taxa_servico,snapshot) values($1,'Preparation concurrency','proposta_pronta','ready','2099-11-19',1120,1000,120,'{}') returning *",[opp])).rows[0];
 const expiry=new Date(Date.now()+3600000).toISOString(),args=[p.id,p.revision,'15550003333','Synthetic concurrent proposal','Fixture',null,null,expiry];
 const readers=await Promise.all([connect(name),connect(name)]);
 const read='select event_whatsapp_preparation($1,$2,$3,$4,$5,$6,$7,$8) plan';
 const claim='select begin_event_prepared_whatsapp_send($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result';
 try{
  await Promise.all(readers.map(x=>x.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,email,role:'authenticated'})])));
  await readers[0].query('begin read only');await readers[0].query('set local role authenticated');
  const preview=(await readers[0].query(read,args)).rows[0].plan;await readers[0].query('rollback');
  const plans=await Promise.all(readers.map(x=>x.query(read,args)));assert.equal(plans[0].rows[0].plan.id,preview.id);assert.deepEqual(plans[0].rows[0].plan,plans[1].rows[0].plan);
  assert.equal(Number((await c.query('select count(*) from event_outbox where proposal_id=$1',[p.id])).rows[0].count),0);
  const results=await Promise.all(readers.map(x=>x.query(claim,[...args,preview.id,preview.fingerprint])));
  assert.equal(results.filter(r=>r.rows[0].result.claimed).length,1);
  assert.ok(results.every(r=>r.rows[0].result.send.id===preview.id));
  assert.equal(Number((await c.query('select attempts from event_outbox where id=$1',[preview.id])).rows[0].attempts),1);
  console.log('PASS read-only preparation, concurrent stable identity and one explicit claim');
  // Transaction-start time is insufficient: preparation can expire while the
  // explicit claim is blocked by another editor. No claim may survive that wait.
  const shortExpiry=(await c.query("select date_trunc('milliseconds',clock_timestamp()+interval '1 second') expiry")).rows[0].expiry.toISOString();
  const expiringArgs=[p.id,p.revision,'15550003333','Synthetic expiring proposal','Fixture',null,null,shortExpiry];
  const expiring=(await readers[1].query(read,expiringArgs)).rows[0].plan;
  await readers[0].query('begin');await readers[0].query('select id from propostas where id=$1 for update',[p.id]);
  const expiryPid=(await readers[1].query('select pg_backend_pid() pid')).rows[0].pid;
  const expiryWait=readers[1].query(claim,[...expiringArgs,expiring.id,expiring.fingerprint]).then(value=>({value}),error=>({error}));
  let expiryLocked=false;for(let i=0;i<100;i++){const s=(await c.query('select wait_event_type from pg_stat_activity where pid=$1',[expiryPid])).rows[0];if(s?.wait_event_type==='Lock'){expiryLocked=true;break;}await new Promise(r=>setTimeout(r,20));}
  assert.ok(expiryLocked,'expiring claim must actually wait behind a writer');
  await readers[0].query('select pg_sleep(1.05)');await readers[0].query('commit');
  const expired=await expiryWait;assert.ok(expired.error,'expiry during a lock wait must refuse the claim');
  assert.match(expired.error.message,/Prazo/);
  assert.equal(Number((await c.query('select count(*) from event_outbox where id=$1',[expiring.id])).rows[0].count),0);
  console.log('PASS expiry during lock wait refuses claim without an outbox row');
  // A lock waiter must see an edit committed while it was waiting, not a cached
  // read snapshot from before acquiring the proposal lock.
  const otherArgs=[p.id,p.revision,'15550003333','Synthetic waiting proposal','Fixture',null,null,expiry];
  const before=(await readers[1].query(read,otherArgs)).rows[0].plan;
  await readers[0].query('begin');await readers[0].query('select id from propostas where id=$1 for update',[p.id]);
  const pid=(await readers[1].query('select pg_backend_pid() pid')).rows[0].pid;
  const waiting=readers[1].query(claim,[...otherArgs,before.id,before.fingerprint]).then(value=>({value}),error=>({error}));
  let locked=false;for(let i=0;i<100;i++){const s=(await c.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(s?.wait_event_type==='Lock'){locked=true;break;}await new Promise(r=>setTimeout(r,20));}
  assert.ok(locked,'claim waits behind proposal writer');
  await readers[0].query('update propostas set public_token_revoked_at=now() where id=$1',[p.id]);await readers[0].query('commit');
  assert.ok((await waiting).error,'revocation committed during wait refuses stale plan');
  assert.equal(Number((await c.query('select count(*) from event_outbox where id=$1',[before.id])).rows[0].count),0);
  console.log('PASS proposal revocation race refuses stale preparation without an outbox row');
  await readers[0].query('begin');
  await readers[0].query(require('node:fs').readFileSync(require('node:path').join(__dirname,'../supabase/rollback/whatsapp_readonly_preparation_compatibility.sql'),'utf8'));
  assert.equal((await readers[0].query("select has_function_privilege('authenticated','public.event_whatsapp_preparation(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz)','execute') allowed")).rows[0].allowed,false);
  const legacy=(await readers[0].query("select begin_event_send($1,'whatsapp',$2,$3,$4,null) result",[p.id,args[2],args[3],args[4]])).rows[0].result;
  assert.equal(legacy.claimed,false);assert.equal(legacy.send.id,preview.id);
  await readers[0].query('rollback');
  console.log('PASS compatibility rollback revokes new surface and preserves prepared send identity');
 }finally{
  await Promise.all(readers.map(async x=>{await x.query('rollback').catch(()=>{});await x.end();}));
  await c.query('delete from event_outbox where proposal_id=$1',[p.id]);await c.query('delete from propostas where id=$1',[p.id]);await c.query('delete from oportunidades where id=$1',[opp]);
 }
};
