const assert=require('node:assert/strict');
const functions="select p.oid,p.proname,p.proacl::text acl,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','event_private') order by p.oid";
const quoted=s=>'"'+s.replace(/"/g,'""')+'"';
module.exports=async function verifySignoffRollback(c,sql){
 const rollback=sql('supabase/rollback/private_operational_signoffs_compatibility.sql');
 try {
 await c.query('begin');await c.query("set local statement_timeout='20s'");
 const tables=(await c.query("select schemaname,tablename from pg_tables where schemaname in ('public','event_private') order by schemaname,tablename")).rows;
 const snapshot=async()=>{const result=[];for(const t of tables)result.push({...t,...(await c.query('select count(*)::int count,md5(coalesce(string_agg(row_to_json(t)::text,chr(10) order by row_to_json(t)::text),\'\')) hash from '+quoted(t.schemaname)+'.'+quoted(t.tablename)+' t')).rows[0]});return result;};
 const before=(await c.query(functions)).rows,rows=await snapshot();
 assert.equal((await c.query('select enabled from event_private.operation_contact_config where id')).rows[0].enabled,false);
 await c.query('savepoint active_policy');await c.query('update event_private.operation_contact_config set enabled=true where id');
 let blocked=false;try{await c.query(rollback);}catch(e){blocked=/Reversão de compatibilidade exige/.test(e.message);}assert.equal(blocked,true,'Never bypass activated mandatory signoffs');
 await c.query('rollback to savepoint active_policy');assert.deepEqual((await c.query(functions)).rows,before);assert.deepEqual(await snapshot(),rows);
 console.log('PASS activated policy refusal is atomic and preserves all functions, permissions and rows');
 await c.query(rollback);
 const after=(await c.query(functions)).rows,withdrawn=['get_event_operational_contacts','configure_event_operational_contacts','sign_event_operation'];
 assert.equal(after.length,before.length);
 for(const prev of before){const next=after.find(x=>x.oid===prev.oid);assert.ok(next,'Preserve every function OID');assert.equal(next.args,prev.args);if(prev.proname!=='operation_readiness')assert.equal(next.definition,prev.definition);if(!withdrawn.includes(prev.proname))assert.equal(next.acl,prev.acl);}
 assert.equal((await c.query('select bool_and(event_private.operation_readiness(p)=event_private.operation_readiness_before_signoffs(p)) ok from public.propostas p')).rows[0].ok,true);
 for(const name of withdrawn)for(const role of ['anon','authenticated','service_role'])assert.equal((await c.query('select has_function_privilege($1,p.oid,\'execute\') ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=\'public\' and p.proname=$2',[role,name])).rows[0].ok,false);
 assert.deepEqual(await snapshot(),rows);console.log('PASS legacy readiness restored, new public RPCs withdrawn, all OIDs/history/rows preserved');
 await c.query(rollback);assert.deepEqual((await c.query(functions)).rows,after);assert.deepEqual(await snapshot(),rows);console.log('PASS compatibility rollback is idempotent');
 await c.query('rollback');assert.deepEqual((await c.query(functions)).rows,before);assert.deepEqual(await snapshot(),rows);console.log('PASS diagnostic transaction rolled back; composed schema and fixtures restored');
 }finally{await c.query('rollback').catch(()=>{});}
};
