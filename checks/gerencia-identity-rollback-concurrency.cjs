const assert=require('node:assert/strict');
module.exports=async function(c,sql,connect,name){
 const rollback=sql('supabase/rollback/gerencia_operational_identity_compatibility.sql');
 const configure='select event_private.configure_gerencia_identity($1,$2,$3,true)';
 const cfg=(await c.query('select to_jsonb(x) v from event_private.operation_contact_config x where id')).rows[0].v;
 const identity=(await c.query('select to_jsonb(x) v from event_private.operation_gerencia_identity x where singleton')).rows[0].v;
 assert.equal(cfg.enabled,false);assert.equal(identity.retired,false);assert.equal(identity.user_id,null);
 assert.equal((await c.query('select count(*)::int n from event_private.operation_gerencia_identity_audit')).rows[0].n,0);
 const defs=(await c.query("select pg_get_functiondef(oid) definition,oid,proacl::text acl from pg_proc where oid in ('public.sign_event_operation(uuid,bigint,integer,text,text,boolean)'::regprocedure,'event_private.operation_signoff_evidence(public.propostas)'::regprocedure) order by oid")).rows;
 const actor=(await c.query('select u.id,u.email,u.email_confirmed_at,u.banned_until from auth.users u where lower(u.email)=any(event_private.gerencia_team_emails()) order by u.id limit 1')).rows[0];assert.ok(actor);
 const a=await connect(name),b=await connect(name),pending=[];
 const ap=(await a.query('select pg_backend_pid() p')).rows[0].p,bp=(await b.query('select pg_backend_pid() p')).rows[0].p;
 const observe=p=>{const o={settled:false};o.result=p.then(value=>(o.settled=true,{value}),error=>(o.settled=true,{error}));pending.push(o.result);return o;};
 async function wait(o){const end=Date.now()+5000;while(Date.now()<end){if((await c.query('select $1::int=any(pg_blocking_pids($2)) blocked',[ap,bp])).rows[0].blocked)return;if(o.settled){const x=await o.result;throw x.error||Error('Expected real config lock overlap');}await new Promise(r=>setTimeout(r,25));}throw Error('Config/rollback lock wait unproven');}
 async function begin(x){await x.query('begin');await x.query("set local statement_timeout='20s';set local lock_timeout='10s'");}
 async function restore(){
  await c.query('begin');try{
   await c.query('lock event_private.operation_contact_config in access exclusive mode');
   for(const f of defs)await c.query(f.definition);
   await c.query('alter table event_private.operation_contact_config disable trigger invalidate_signoff_configuration');
   await c.query('update event_private.operation_contact_config set (version,enabled,updated_by,updated_at)=(select r.version,r.enabled,r.updated_by,r.updated_at from jsonb_populate_record(null::event_private.operation_contact_config,$1::jsonb) r) where id',[JSON.stringify(cfg)]);
   await c.query('update event_private.operation_gerencia_identity set (user_id,expected_email,config_version,retired,configured_by,configured_db_role,configured_at)=(select r.user_id,r.expected_email,r.config_version,r.retired,r.configured_by,r.configured_db_role,r.configured_at from jsonb_populate_record(null::event_private.operation_gerencia_identity,$1::jsonb) r) where singleton',[JSON.stringify(identity)]);
   await c.query('delete from event_private.operation_gerencia_identity_audit where config_version>$1',[cfg.version]);
   await c.query('alter table event_private.operation_contact_config enable trigger invalidate_signoff_configuration');await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}
 }
 try{
  await c.query('update auth.users set email_confirmed_at=clock_timestamp(),banned_until=null where id=$1',[actor.id]);
  // Configure first: rollback must wait, then retain and retire the committed binding.
  await begin(a);await a.query(configure,[cfg.version,actor.id,actor.email]);await begin(b);
  const retiring=observe(b.query(rollback));await wait(retiring);await a.query('commit');const retired=await retiring.result;if(retired.error)throw retired.error;await b.query('commit');
  const row=(await c.query('select user_id,retired from event_private.operation_gerencia_identity where singleton')).rows[0];assert.equal(row.user_id,actor.id);assert.equal(row.retired,true);
  assert.deepEqual((await c.query('select action from event_private.operation_gerencia_identity_audit order by config_version')).rows.map(x=>x.action),['assign','retire']);
  await restore();console.log('PASS Gerencia configure wins: rollback waits, retires binding and preserves assign/retire audit');
  // Rollback first: already entered configuration cannot restore authority.
  await begin(a);await a.query(rollback);await begin(b);const configuring=observe(b.query(configure,[cfg.version,actor.id,actor.email]));await wait(configuring);await a.query('commit');assert.equal((await configuring.result).error?.code,'PT409');await b.query('rollback');
  const retiredVersion=(await c.query('select version from event_private.operation_contact_config where id')).rows[0].version;
  let code;try{await b.query(configure,[retiredVersion,actor.id,actor.email]);}catch(e){code=e.code;}assert.equal(code,'55000');
  assert.equal((await c.query('select user_id from event_private.operation_gerencia_identity where singleton')).rows[0].user_id,null);
  assert.deepEqual((await c.query('select action from event_private.operation_gerencia_identity_audit order by config_version')).rows.map(x=>x.action),['retire']);
  console.log('PASS Gerencia rollback wins: stale config PT409, current-version config 55000, no reassignment');
 }finally{
  await Promise.allSettled([a.query('rollback'),b.query('rollback')]);await Promise.allSettled(pending);await restore();
  await c.query('update auth.users set email_confirmed_at=$2,banned_until=$3 where id=$1',[actor.id,actor.email_confirmed_at,actor.banned_until]);await Promise.allSettled([a.end(),b.end()]);
 }
 for(const f of defs){const current=(await c.query('select pg_get_functiondef($1::oid) definition,proacl::text acl from pg_proc where oid=$1',[f.oid])).rows[0];assert.equal(current.definition,f.definition);assert.equal(current.acl,f.acl);}
 assert.deepEqual((await c.query('select to_jsonb(x) v from event_private.operation_contact_config x where id')).rows[0].v,cfg);
 assert.deepEqual((await c.query('select to_jsonb(x) v from event_private.operation_gerencia_identity x where singleton')).rows[0].v,identity);
 console.log('PASS Gerencia rollback concurrency restores functions/ACL/configuration and synthetic account');
};
