// Integration adapter only: real PostgreSQL functions, no Supabase or provider network.
const {Client}=require('pg');
const assert=require('node:assert/strict');
async function database(){
 const url=new URL(process.env.TEST_DATABASE_URL||'postgres://postgres:event-test-only@127.0.0.1:5432/postgres');
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Loopback test database required');
 assert.ok(['/postgres','/events_test'].includes(url.pathname),'Only the disposable harness database is permitted');
 url.pathname='/events_test';
 const c=new Client({connectionString:url.toString(),connectionTimeoutMillis:5000});await c.connect();
 assert.equal((await c.query("select current_database() as name")).rows[0].name,'events_test');
 assert.equal((await c.query('show server_encoding')).rows[0].server_encoding,'UTF8','Recreate the disposable database with npm run test:db');
 return c;
}
async function owner(c){
 for(const actor of (await c.query('select id,email from auth.users order by id')).rows){
  await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({...actor,sub:actor.id,role:'authenticated'})]);
  if((await c.query('select public.is_super_admin() as allowed')).rows[0].allowed)return actor;
 }
 throw Error('Disposable fixture owner missing');
}
async function role(c,name,actor,run){
 assert.ok(['anon','authenticated','service_role'].includes(name));
 await c.query('savepoint fixture_role');
 try{
  await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:name,...(actor?{sub:actor.id,email:actor.email}:{})})]);
  await c.query(`set local role ${name}`);
  const value=await run();await c.query('reset role');await c.query('release savepoint fixture_role');return value;
 }catch(error){await c.query('rollback to savepoint fixture_role');await c.query('release savepoint fixture_role');throw error;}
}
const permitted=new Set(['save_event_proposal','event_mailbox_worker_config','event_mailbox_oauth_worker_credential','event_mailbox_seen','event_mailbox_resolve_binding','event_mailbox_resolve_routed_binding','event_mailbox_commit_bound']);
async function rpc(c,name,args={}){
 assert.ok(permitted.has(name),'Unexpected integration RPC');
 const types=(await c.query(`select p.proargnames, p.proretset, t.typtype,
  (select array_agg(a::regtype::text order by n) from unnest(p.proargtypes::oid[]) with ordinality as x(a,n)) as types
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype
  where n.nspname='public' and p.proname=$1`,[name])).rows;
 assert.equal(types.length,1,'RPC must resolve unambiguously');
 const meta=types[0],keys=Object.keys(args),values=[];
 const params=keys.map((key,i)=>{
  assert.ok(meta.proargnames?.includes(key),'Unknown RPC parameter');
  const type=meta.types[meta.proargnames.indexOf(key)];
  assert.match(type,/^[a-z0-9_ .\[\]]+$/i);
  values.push(['json','jsonb'].includes(type)?JSON.stringify(args[key]):args[key]);
  return `${key} => $${i+1}::${type}`;
 });
 const call=`public.${name}(${params.join(',')})`;
 const result=await c.query(meta.proretset?`select to_jsonb(r) as value from ${call} r`:`select to_jsonb(${call}) as value`,values);
 return meta.proretset?result.rows.map(r=>r.value):result.rows[0]?.value??null;
}
module.exports={database,owner,role,rpc};
