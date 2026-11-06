'use strict';
const assert=require('node:assert/strict');
const metadata=async c=>(await c.query("select oid::text,proowner::text,proacl::text,encode(sha256(convert_to(prosrc,'UTF8')),'hex') as body_hash from pg_proc where oid='public.record_public_proposal_view(uuid,text,text)'::regprocedure")).rows[0];
const history=async c=>(await c.query("select count(*)::int as count,md5(coalesce(string_agg(concat_ws(':',id,proposta_id,public_token),'|' order by id),'')) as fingerprint from public.proposta_visualizacoes")).rows[0];
async function benchmark(c){const start=performance.now();const r=await c.query("select bool_and(public.record_public_proposal_view(c.token,'performance fixture '||n::text,null)) as accepted from _view_visibility_cases c cross join generate_series(1,25) n where c.kind='valid'");assert.equal(r.rows[0].accepted,true);return Math.round((performance.now()-start)*100)/100;}
module.exports=async(c,sql,migrations)=>{
 assert.ok(['localhost','127.0.0.1','postgres'].includes(c.connectionParameters.host),'Disposable database host required');
 assert.equal((await c.query("select current_setting('session_replication_role') as mode")).rows[0].mode,'origin','Normal triggers required');
 const migration=migrations.find(f=>f.endsWith('_public_view_visibility.sql'));assert.ok(migration);
 await c.query('begin');
 try{
  await c.query(sql('checks/public-view-visibility.sql'));
  const fresh=await metadata(c),newMs=await benchmark(c),before=await history(c);
  await c.query(sql('supabase/rollback/public_view_visibility.sql'));
  const restored=await metadata(c);
  for(const key of ['oid','proowner','proacl'])assert.equal(restored[key],fresh[key],key+' survives rollback');
  assert.equal(restored.body_hash,'5008ff767d8695fc095c780bd1eb6a3615890f29bd20c13afdfc1273aff029e5');
  assert.deepEqual(await history(c),before,'Rollback preserves every historical view');
  const oldMs=await benchmark(c),afterBenchmark=await history(c);
  await c.query(sql('supabase/migrations/'+migration));
  assert.deepEqual(await metadata(c),fresh,'Reapplication restores the tested implementation without identity or ACL changes');
  assert.deepEqual(await history(c),afterBenchmark,'Reapplication preserves history');
  console.log('PASS public view visibility: normal triggers; valid, expired, revoked, draft, unknown, null, old-link redirect and metadata bounds');
  console.log('PASS public view visibility rollback: history, owner, OID and ACL preserved');
  console.log('MEASURE public view visibility: 25 calls, 20-item synthetic proposal; current='+newMs+'ms previous='+oldMs+'ms (observation, not a timing gate)');
 }finally{await c.query('rollback');}
};
