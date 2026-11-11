const assert=require('node:assert/strict');
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
module.exports=async function(c,sql,fixtureOwner,migrationFiles){
 assert.ok(['localhost','127.0.0.1','postgres'].includes(c.connectionParameters.host));
 assert.ok(['events_test','events_fresh_test','events_current_upgrade_test'].includes(c.connectionParameters.database));
 const migration=migrationFiles.find(f=>f.endsWith('_historical_classification_review.sql'));
 await c.query(sql('supabase/migrations/'+migration));
 const originalClaims=(await c.query("select current_setting('request.jwt.claims',true) claims")).rows[0].claims;
 const owner=await fixtureOwner(c),outside=randomUUID(),session=randomUUID(),batch='classification-fixture-'+randomUUID();
 const claims={sub:owner.id,email:owner.email,role:'authenticated',session_id:session};
 await c.query("alter table auth.users add column if not exists deleted_at timestamptz; alter table auth.users add column if not exists banned_until timestamptz");
 await c.query("create table if not exists auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz)");
 await c.query("insert into auth.users(id,email) values($1,'classification-outsider@example.test')",[outside]);
 await c.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[session,owner.id]);
 await c.query("insert into event_crm.import_batches(id,source_period_start,source_period_end,status,created_at,manifest) values($1,'2098-01-01','2099-01-01','validated','2099-01-01','{}')",[batch]);
 await c.query("insert into event_crm.foundation_records(batch_id,kind,record_id,payload) values($1,'organization','review-a','{\"id\":\"review-a\",\"name\":\"Conta sintética\",\"segment\":\"Original\",\"source_ids\":[]}'),($1,'organization','review-b','{\"id\":\"review-b\",\"name\":\"Homônimo sintético\",\"source_ids\":[]}'),($1,'contact','review-contact','{\"id\":\"review-contact\",\"email\":\"fixture@example.test\",\"marketing_permission\":false}')",[batch]);
 const sourceBefore=(await c.query("select jsonb_agg(jsonb_build_array(kind,record_id,payload) order by kind,record_id) data from event_crm.foundation_records")).rows[0].data;
 const operations=()=>c.query("select (select count(*) from public.propostas)::int proposals,(select count(*) from public.oportunidades)::int opportunities,(select count(*) from public.solicitacoes_cotacao)::int requests");
 const before=(await operations()).rows[0];
 const writeSql='select public.event_crm_review_classification($1,$2,$3,$4,$5,$6,$7,$8) data';
 const readSql='select public.event_crm_classification_status($1,$2,$3,$4,$5) data';
 const params=(id='review-a',revision=0,request=randomUUID())=>[batch,'organization',id,revision,request,'supplier','company','Revisão manual da fonte sintética'];
 async function actor(query,args,jwt=claims,role='authenticated',db=c){
  await db.query('begin');
  try{
   await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(jwt)]);
   await db.query('set local role '+({'authenticated':'authenticated','anon':'anon','service_role':'service_role'}[role]));
   const r=await db.query(query,args);await db.query('commit');return r.rows[0]?.data;
  }catch(e){await db.query('rollback');throw e;}
 }
 const deny=(jwt,role='authenticated')=>assert.rejects(actor(writeSql,params(),jwt,role),e=>e.code==='42501');
 try{
  const acl=(await c.query("select has_table_privilege('authenticated','event_crm.classification_review_events','SELECT') sel,has_table_privilege('authenticated','event_crm.classification_review_events','INSERT') ins,(select relrowsecurity from pg_class where oid='event_crm.classification_review_events'::regclass) rls,(select prosecdef from pg_proc where oid='public.event_crm_review_classification(text,text,text,integer,uuid,text,text,text)'::regprocedure) public_definer")).rows[0];
  assert.deepEqual(acl,{sel:false,ins:false,rls:true,public_definer:false});
  await deny({},'anon');await deny(claims,'service_role');
  await deny({...claims,sub:outside,email:'classification-outsider@example.test'});
  await deny({...claims,sub:outside});await deny({...claims,session_id:undefined});
  await deny({...claims,session_id:randomUUID()});
  await c.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[session]);await deny(claims);
  await c.query("update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[session]);
  await c.query("update auth.users set banned_until=now()+interval '1 hour' where id=$1",[owner.id]);await deny(claims);
  await c.query("update auth.users set banned_until=null,deleted_at=now() where id=$1",[owner.id]);await deny(claims);
  await c.query("update auth.users set deleted_at=null where id=$1",[owner.id]);
  for(const [index,value]of [[0,'wrong-batch'],[1,'event'],[2,'missing'],[3,-1],[4,null],[5,'realizado_comprovado'],[6,'admin'],[7,'x'.repeat(501)],[7,'short']]){
   const p=params();p[index]=value;await assert.rejects(actor(writeSql,p),e=>['22023','PT409'].includes(e.code));
  }
  const p=params(),saved=await actor(writeSql,p);assert.equal(saved.status,'saved');assert.equal(saved.revision,1);
  const replay=await actor(writeSql,p);assert.equal(replay.status,'already_saved');
  const changed=p.slice();changed[7]='Outra revisão com o mesmo identificador';
  await assert.rejects(actor(writeSql,changed),e=>e.code==='22023');
  await assert.rejects(actor(writeSql,params()),e=>e.code==='PT409');
  const read=await actor(readSql,[batch,'organization','review-a',0,p[4]]);
  assert.equal(read.current.actor_id,owner.id);assert.equal(read.current.actor_email,owner.email.toLowerCase());assert.equal(read.receipt.revision,1);assert.equal(read.current.classification,'supplier');assert.equal(read.total,1);
  assert.equal((await actor(readSql,[batch,'organization','review-b',0,p[4]])).receipt,null);
  const decorated=await actor("select public.event_crm_history('organization','','name',20,0,null,null) data",[]);
  assert.equal(decorated.records.find(x=>x.id==='review-a').classification_review.revision,1);
  const detail=await actor("select public.event_crm_history('organization','','name',20,0,'review-a',null) data",[]);
  assert.equal(detail.record.segment,'Original');assert.equal(detail.classification_review.current.classification,'supplier');
  for(let revision=1;revision<12;revision++)await actor(writeSql,params('review-a',revision));
  const old=await actor(readSql,[batch,'organization','review-a',10,null]);assert.equal(old.total,12);assert.equal(old.history.length,2);assert.equal(old.history[0].revision,2);
  const reset=params('review-a',12);reset[5]=null;reset[6]=null;await actor(writeSql,reset);
  assert.equal((await actor(readSql,[batch,'organization','review-a',0,null])).current.classification,null);
  await assert.rejects(c.query("delete from event_crm.classification_review_events where batch_id=$1",[batch]),e=>e.code==='42501');
  const connect=async()=>{const d=c.connectionParameters;const x=new Client({host:d.host,port:d.port,database:d.database,user:d.user,password:d.password});await x.connect();return x;};
  const writers=await Promise.all([connect(),connect()]);
  try{
   const concurrent=await Promise.allSettled(writers.map(w=>actor(writeSql,params('review-b',0),claims,'authenticated',w)));
   assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
   assert.equal(concurrent.filter(x=>x.status==='rejected'&&x.reason.code==='PT409').length,1);
   const same=params('review-b',1);const duplicate=await Promise.all(writers.map(w=>actor(writeSql,same,claims,'authenticated',w)));
   assert.deepEqual(duplicate.map(x=>x.status).sort(),['already_saved','saved']);
   assert.equal((await actor(readSql,[batch,'organization','review-b',0,null])).total,2);
  }finally{await Promise.all(writers.map(w=>w.end()));}
  const events=(await c.query('select count(*)::int n from event_crm.classification_review_events')).rows[0].n;
  await c.query(sql('supabase/rollback/historical_classification_review.sql'));
  await assert.rejects(actor(writeSql,params()),e=>e.code==='42501');
  assert.equal((await c.query('select count(*)::int n from event_crm.classification_review_events')).rows[0].n,events);
  await c.query(sql('supabase/migrations/'+migration));
  assert.equal((await actor(readSql,[batch,'organization','review-a',0,null])).total,13);
  assert.deepEqual((await c.query("select jsonb_agg(jsonb_build_array(kind,record_id,payload) order by kind,record_id) data from event_crm.foundation_records")).rows[0].data,sourceBefore);
  assert.deepEqual((await operations()).rows[0],before);
  console.log('PASS classification active owner/session gate, CAS concurrency, idempotency, immutable audit, source/operation preservation and data-preserving rollback');
 }finally{
  await c.query("select set_config('request.jwt.claims',$1,false)",[originalClaims||'']);
 }
};
