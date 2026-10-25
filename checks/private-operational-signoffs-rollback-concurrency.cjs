// Real two-backend regression, synthetic database only. No HTTP or transport.
const assert=require('node:assert/strict');
module.exports=async function verifyRetirementConcurrency(c,sql,connect,name){
 const clients=[],pending=[];
 const functionSql="select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','event_private') and p.prokind in ('f','p') order by p.oid";
 const before=(await c.query(functionSql)).rows;
 const config=(await c.query('select to_jsonb(x) value from event_private.operation_contact_config x where id')).rows[0].value;
 const contacts=(await c.query('select role,email,whatsapp from event_private.operation_contacts order by role')).rows;
 assert.equal(config.enabled,false);
 assert.equal((await c.query("select tgenabled from pg_trigger where tgrelid='event_private.operation_contact_config'::regclass and tgname='invalidate_signoff_configuration'")).rows[0].tgenabled,'O');
 const actor=(await c.query("select id,email from auth.users where email='leorangel@gmail.com'")).rows[0];assert.ok(actor);
 const claims=JSON.stringify({sub:actor.id,email:actor.email,role:'authenticated'});
 const rollback=sql('supabase/rollback/private_operational_signoffs_compatibility.sql');
 const args=[config.version,JSON.stringify(contacts)];
 const configure='select public.configure_event_operational_contacts($1,$2::jsonb,true)';
 const observe=query=>{const o={settled:false};o.outcome=query.then(result=>(o.settled=true,{result}),error=>(o.settled=true,{error}));pending.push(o.outcome);return o;};
 async function blocked(pid,blocker,o,label){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
   const s=(await c.query('select state,wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[pid])).rows[0];
   if(s?.state==='active'&&s.wait_event_type==='Lock'&&s.blockers.map(Number).includes(blocker))return;
   if(o.settled){const r=await o.outcome;throw r.error||Error(label+': completed instead of overlapping');}
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw Error(label+': lock wait not proven');
 }
 async function begin(client,authenticated){await client.query('begin');await client.query("set local statement_timeout='20s'");await client.query("set local lock_timeout='10s'");if(authenticated){await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[claims]);}}
 async function restoreConfig(){await c.query('update event_private.operation_contact_config x set (version,enabled,updated_by,updated_at)=(select r.version,r.enabled,r.updated_by,r.updated_at from jsonb_populate_record(null::event_private.operation_contact_config,$1::jsonb) r) where id',[JSON.stringify(config)]);}
 // Fixture isolation only: this unrelated AFTER trigger invalidates all future
 // handoffs on activation. Its behavior is covered by private-operational-release.
 // Keep the new BEFORE retirement barrier enabled throughout the race itself.
 await c.query('alter table event_private.operation_contact_config disable trigger invalidate_signoff_configuration');
 try{
  const a=await connect(name),b=await connect(name);clients.push(a,b);
  const aPid=(await a.query('select pg_backend_pid() id')).rows[0].id,bPid=(await b.query('select pg_backend_pid() id')).rows[0].id;
  assert.notEqual(aPid,bPid);
  // Activation wins: the real authenticated RPC owns the table/row write lock.
  // Reversal must wait, then see ON and fail before changing definitions or ACLs.
  await begin(a,true);await a.query(configure,args);await begin(b,false);
  const reversal=observe(b.query(rollback));await blocked(bPid,aPid,reversal,'Rollback behind activation');await a.query('commit');
  const refused=await reversal.outcome;assert.match(refused.error?.message||'',/Reversão de compatibilidade exige/);await b.query('rollback');
  assert.equal((await c.query('select enabled from event_private.operation_contact_config where id')).rows[0].enabled,true);
  assert.deepEqual((await c.query(functionSql)).rows,before);
  console.log('PASS activation wins: rollback waits on real RPC then refuses active policy without schema/ACL changes');
  await restoreConfig();
  // Reversal wins: B has entered the real RPC and passed its EXECUTE check,
  // proven by its relation lock wait. Revocation alone cannot stop this call.
  await begin(a,false);await a.query(rollback);await begin(b,true);
  const activation=observe(b.query(configure,args));await blocked(bPid,aPid,activation,'In-flight activation behind rollback');await a.query('commit');
  const denied=await activation.outcome;assert.equal(denied.error?.code,'55000','Durable BEFORE guard must reject the already-authorized in-flight update');await b.query('rollback');
  assert.equal((await c.query('select enabled from event_private.operation_contact_config where id')).rows[0].enabled,false);
  console.log('PASS rollback wins: already-entered authenticated activation waits, then retirement barrier rejects it');
  // Owner/direct updates cannot bypass the durable guard either.
  await c.query('begin');let direct=false;try{await c.query('update event_private.operation_contact_config set enabled=true where id');}catch(e){direct=e.code==='55000';}await c.query('rollback');assert.equal(direct,true);
  console.log('PASS durable retirement barrier blocks later direct activation');
 }finally{
  await Promise.allSettled(clients.map(x=>x.query('rollback')));await Promise.allSettled(pending);
  await c.query('begin');
  try{
   await c.query('lock table event_private.operation_contact_config in access exclusive mode');
   await c.query('drop trigger if exists operation_signoffs_retired_guard on event_private.operation_contact_config');
   await c.query('drop function if exists event_private.operation_signoffs_retired_guard()');
   const wrapper=before.find(f=>f.nspname==='event_private'&&f.proname==='operation_readiness');assert.ok(wrapper);await c.query(wrapper.definition);
   await c.query('grant execute on function public.get_event_operational_contacts(),public.configure_event_operational_contacts(integer,jsonb,boolean),public.sign_event_operation(uuid,bigint,integer,text,text,boolean) to authenticated');
   await restoreConfig();
   await c.query('alter table event_private.operation_contact_config enable trigger invalidate_signoff_configuration');await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{await Promise.allSettled(clients.map(x=>x.end()));}
 }
 assert.deepEqual((await c.query(functionSql)).rows,before,'Restore every original function definition/OID/ACL');
 assert.deepEqual((await c.query('select to_jsonb(x) value from event_private.operation_contact_config x where id')).rows[0].value,config);
 assert.deepEqual((await c.query('select role,email,whatsapp from event_private.operation_contacts order by role')).rows,contacts);
 assert.equal((await c.query("select tgenabled from pg_trigger where tgrelid='event_private.operation_contact_config'::regclass and tgname='invalidate_signoff_configuration'")).rows[0].tgenabled,'O');
 console.log('PASS concurrency fixtures restored; original configuration, contacts, functions, ACLs and invalidation trigger preserved');
};
