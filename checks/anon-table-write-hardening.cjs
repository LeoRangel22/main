'use strict';
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const tables=['oportunidades','propostas','solicitacoes_cotacao','proposta_visualizacoes'];
const writes=['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
async function inspect(c){
 return (await c.query("select jsonb_build_object("+
 "'tables',(select jsonb_agg(jsonb_build_object('name',r.relname,'oid',r.oid,'owner',r.relowner,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,"+
 "'anon',coalesce((select jsonb_agg(to_jsonb(a) order by a.grantor,a.privilege_type) from aclexplode(r.relacl)a where a.grantee=(select oid from pg_roles where rolname='anon')),'[]'::jsonb),"+
 "'other_acl',coalesce((select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type) from aclexplode(r.relacl)a where a.grantee<>(select oid from pg_roles where rolname='anon')),'[]'::jsonb)) order by r.relname) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname=any($1::text[])),"+
 "'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl::text,'body',md5(p.prosrc)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','event_private')),"+
 "'defaults',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d),"+
 "'sequences',(select jsonb_agg(jsonb_build_object('oid',r.oid,'owner',r.relowner,'acl',r.relacl::text) order by r.oid) from pg_class r join pg_namespace n on n.oid=r.relnamespace where r.relkind='S' and n.nspname in ('public','event_private')),"+
 "'triggers',(select jsonb_agg(jsonb_build_object('oid',t.oid,'enabled',t.tgenabled,'function',t.tgfoid,'definition',pg_get_triggerdef(t.oid)) order by t.oid) from pg_trigger t where t.tgrelid in(select r.oid from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname=any($1::text[]))),"+
 "'counts',jsonb_build_array((select count(*) from public.oportunidades),(select count(*) from public.propostas),(select count(*) from public.solicitacoes_cotacao),(select count(*) from public.proposta_visualizacoes),(select count(*) from public.event_outbox))) as snapshot",[tables])).rows[0].snapshot;
}
function assertHardened(state){
 assert.equal(state.tables.length,4);
 for(const table of state.tables){
  assert.equal(table.rls,true);
  assert.deepEqual(table.anon.map(a=>a.privilege_type),['SELECT'],table.name+' retains only direct SELECT');
  assert.equal(table.anon[0].is_grantable,false);
 }
}
function assertDelta(before,after){
 assertHardened(after);
 const strip=s=>{const copy=JSON.parse(JSON.stringify(s));for(const t of copy.tables)delete t.anon;return copy;};
 assert.deepEqual(strip(after),strip(before),'All other ACLs, functions, owners, RLS, defaults, sequences, triggers and business counts must be identical');
}
async function expectDenied(c,statement){
 await c.query('savepoint denied_direct_write');
 try{
  await assert.rejects(c.query(statement),error=>error.code==='42501','Direct anonymous write must be rejected by table permissions');
 }finally{
  await c.query('rollback to savepoint denied_direct_write');
  await c.query('release savepoint denied_direct_write');
 }
}
module.exports=async(c,sql,migrations)=>{
 assert.ok(['localhost','127.0.0.1','postgres'].includes(c.connectionParameters.host),'Disposable database host required');
 assert.equal((await c.query("select current_setting('session_replication_role') as mode")).rows[0].mode,'origin','Normal triggers required');
 const migration=migrations.find(f=>f.endsWith('_anon_table_write_hardening.sql'));assert.ok(migration);
 const candidate=sql('supabase/migrations/'+migration);
 const beforeFixture=await inspect(c);
 await c.query('begin');
 try{
  assertHardened(await inspect(c));
  await c.query("select set_config('request.jwt.claims','{}',true)");
  // CI-only recorder: application notification triggers stay enabled; this adapter cannot send HTTP.
  await c.query("create temp table _anon_acl_notifications(request_id uuid,capture_status text) on commit drop");
  await c.query("create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$begin if url<>'https://example.invalid/acl-fixture' then raise exception 'Unexpected fixture endpoint';end if;insert into pg_temp._anon_acl_notifications values((body#>>'{record,id}')::uuid,body#>>'{record,capture_status}');return 1;end$$");
  await c.query("insert into vault.secrets(name,secret) values('event_lead_webhook_url','https://example.invalid/acl-fixture'),('event_lead_webhook_secret','synthetic-acl-fixture') on conflict(name)do update set secret=excluded.secret");
  const outboxBefore=(await c.query('select count(*)::int as count from public.event_outbox')).rows[0].count;
  await c.query('set local role anon');
  for(const table of tables){
   for(const privilege of writes)assert.equal((await c.query('select has_table_privilege(current_user,$1,$2) as allowed',['public.'+table,privilege])).rows[0].allowed,false);
   assert.equal((await c.query('select count(*)::int as count from public.'+table)).rows[0].count,0,'RLS still hides direct reads');
   for(const statement of ['insert into public.'+table+' default values','update public.'+table+' set id=id where false','delete from public.'+table+' where false','truncate table public.'+table])await expectDenied(c,statement);
  }
  await c.query('savepoint unauthorized_acl_restore');
  await assert.rejects(c.query(sql('supabase/rollback/anon_table_write_hardening.sql')),error=>error.code==='42501'||error.message.includes('anon_acl_restore_failed'),'Unauthorized rollback cannot claim grants were restored');
  await c.query('rollback to savepoint unauthorized_acl_restore');
  await c.query('release savepoint unauthorized_acl_restore');
  await c.query('reset role');
  // The repository bootstrap notifies only completed inserts. The deployed predecessor
  // has an unconditional INSERT trigger, plus the same partial-to-complete UPDATE trigger.
  // Exercise both verified contracts inside this rolled-back, non-network fixture.
  for(const profile of [{name:'bootstrap',statuses:['complete']},{name:'production-equivalent',statuses:['complete','partial']}]){
   if(profile.name==='production-equivalent'){
    await c.query("drop trigger notify_new_lead_webhook on public.solicitacoes_cotacao; create trigger notify_new_lead_webhook after insert on public.solicitacoes_cotacao for each row execute function public.notify_new_lead_fn()");
   }
   await c.query('truncate pg_temp._anon_acl_notifications');
   const token=randomUUID(),snapshot={cliente:{nome:'Synthetic ACL Visitor',email:'acl-fixture@example.invalid'},evento:{tipo:'Coquetel',data:'2099-11-18',horario:'19:00',convidados:30,duracao:1}};
   await c.query('set local role anon');
   const first=(await c.query("select * from public.upsert_public_quote_draft($1,$2,'essencial')",[token,snapshot])).rows[0];assert.ok(first?.request_id);
   const repeated=(await c.query("select * from public.upsert_public_quote_draft($1,$2,'essencial')",[token,snapshot])).rows[0];
   await c.query('reset role');
   assert.equal((await c.query('select count(*)::int as count from pg_temp._anon_acl_notifications')).rows[0].count,profile.name==='bootstrap'?0:1,profile.name+' partial notification timing');
   await c.query('set local role anon');
   const completed=(await c.query('select * from public.submit_public_quote_request($1,$2)',[token,snapshot])).rows[0];
   const duplicate=(await c.query('select * from public.submit_public_quote_request($1,$2)',[token,snapshot])).rows[0];
   await c.query("select * from public.upsert_public_quote_draft($1,$2,'essencial')",[token,snapshot]);
   for(const next of [repeated,completed,duplicate]){assert.equal(next.request_id,first.request_id);assert.equal(next.opportunity_id,first.opportunity_id);}
   await c.query('reset role');
   const request=(await c.query("select id,oportunidade_id,capture_status from public.solicitacoes_cotacao where capture_token=$1",[token])).rows;
   assert.equal(request.length,1);assert.equal(request[0].id,first.request_id);assert.equal(request[0].oportunidade_id,first.opportunity_id);assert.equal(request[0].capture_status,'complete');
   const notifications=(await c.query('select request_id,capture_status from pg_temp._anon_acl_notifications order by capture_status')).rows;
   assert.deepEqual(notifications,profile.statuses.map(capture_status=>({request_id:first.request_id,capture_status})),profile.name+' notification contract survives anonymous table revocation without duplicates');
   assert.equal((await c.query('select count(*)::int as count from public.event_outbox')).rows[0].count,outboxBefore,'No message outbox is created');
  }

  const hardened=await inspect(c);
  await c.query('savepoint unexpected_direct_grant');
  await c.query('grant insert on public.solicitacoes_cotacao to anon');
  await c.query('savepoint before_invalid_candidate');
  const drift=await inspect(c);
  await assert.rejects(c.query(candidate),e=>e.message.includes('anon_acl_baseline_mismatch'));
  await c.query('rollback to savepoint before_invalid_candidate');
  assert.deepEqual(await inspect(c),drift,'Rejected drift leaves every prior grant and business row intact');
  await c.query('rollback to savepoint unexpected_direct_grant');
  assert.deepEqual(await inspect(c),hardened);

  await c.query('savepoint inherited_write');
  await c.query(sql('supabase/rollback/anon_table_write_hardening.sql'));
  await c.query('grant update on public.propostas to public');
  await c.query('savepoint before_inherited_candidate');
  const inherited=await inspect(c);
  await assert.rejects(c.query(candidate),e=>e.message.includes('anon_acl_effective_write_remaining'));
  await c.query('rollback to savepoint before_inherited_candidate');
  assert.deepEqual(await inspect(c),inherited,'Inherited write rejection rolls back every candidate revoke');
  await c.query('rollback to savepoint inherited_write');
  assert.deepEqual(await inspect(c),hardened);
  console.log('PASS anonymous direct writes denied; protected draft/submit stay idempotent under both bootstrap and deployed normal-trigger notification contracts, without network');
  console.log('PASS anonymous ACL drift and inherited writes fail atomically; SELECT/RLS and all other authority boundaries preserved');
 }finally{await c.query('rollback');}
 assert.deepEqual(await inspect(c),beforeFixture,'All fixture trigger, authority and business state is rolled back');
};
module.exports.inspect=inspect;
module.exports.assertDelta=assertDelta;
