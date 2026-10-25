const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async function verifyGerenciaIdentityConcurrency(c,sql,connect,name){
 const clients=[],pending=[],opp=randomUUID(),proposal=randomUUID();let config,identity,actor,claimsBefore,actorBefore;
 const configure='select event_private.configure_gerencia_identity($1,$2,$3,true) value';
 const sign="select public.sign_event_operation($1,$2,$3,$4,'gerencia',true) value";
 const observe=query=>{const o={settled:false};o.outcome=query.then(result=>(o.settled=true,{result}),error=>(o.settled=true,{error}));pending.push(o.outcome);return o;};
 async function done(o){const r=await o.outcome;if(r.error)throw r.error;return r.result;}
 async function blocked(pid,blocker,o,label){const end=Date.now()+5000;while(Date.now()<end){const s=(await c.query('select state,wait_event_type,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[pid])).rows[0];if(s?.state==='active'&&s.wait_event_type==='Lock'&&s.blockers.map(Number).includes(blocker))return;if(o.settled){const r=await o.outcome;throw r.error||Error(label+': no overlapping wait');}await new Promise(resolve=>setTimeout(resolve,25));}throw Error(label+': lock wait unproven');}
 async function begin(client,asActor){await client.query('begin');await client.query("set local statement_timeout='20s'");await client.query("set local lock_timeout='10s'");if(asActor){await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor.id,email:actor.email,role:'authenticated'})]);}}
 const version=async()=> (await c.query('select version from event_private.operation_contact_config where id')).rows[0].version;
 try{
  config=(await c.query('select to_jsonb(x) value from event_private.operation_contact_config x where id')).rows[0].value;
  identity=(await c.query('select to_jsonb(x) value from event_private.operation_gerencia_identity x where singleton')).rows[0].value;
  assert.equal(config.enabled,false);assert.equal(identity.user_id,null);assert.equal(identity.retired,false);
  assert.equal((await c.query('select count(*)::int n from event_private.operation_gerencia_identity_audit')).rows[0].n,0);
  claimsBefore=(await c.query("select current_setting('request.jwt.claims',true) value")).rows[0].value||'';
  for(const u of (await c.query('select id,email from auth.users')).rows){await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u.id,email:u.email,role:'authenticated'})]);const authority=(await c.query('select public.is_team_member() team,event_private.journey_financial_operator() finance')).rows[0];if(authority.team&&!authority.finance)actor=u;}
  assert.ok(actor);await c.query("select set_config('request.jwt.claims','',false)");
  actorBefore=(await c.query('select to_jsonb(u) value from auth.users u where id=$1',[actor.id])).rows[0].value;
  await c.query('update auth.users set email_confirmed_at=clock_timestamp(),banned_until=null where id=$1',[actor.id]);
  // Isolate unrelated future handoffs, not the shared config lock or signature checks.
  await c.query('alter table event_private.operation_contact_config disable trigger invalidate_signoff_configuration');
  await c.query('update event_private.operation_contact_config set enabled=true where id');
  await c.query(configure,[await version(),actor.id,actor.email]);
  await c.query("insert into oportunidades(id,cliente_nome,status) values($1,'Gerencia race fixture','confirmado')",[opp]);
  const p=(await c.query(`insert into propostas(id,oportunidade_id,cliente_nome,status,publication_status,is_current,convidados,duracao,subtotal,taxa_servico,total,snapshot) values($1,$2,'Gerencia race fixture','confirmado','ready',true,20,2,1000,120,1120,'{"event":{"guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning revision`,[proposal,opp])).rows[0];
  const h=(await c.query('select version from event_handoffs where opportunity_id=$1',[opp])).rows[0];
  const signArgs=async()=>[proposal,p.revision,h.version,(await c.query('select event_private.operation_review_fingerprint(p) hash from propostas p where id=$1',[proposal])).rows[0].hash];
  const a=await connect(name),b=await connect(name);clients.push(a,b);const ap=(await a.query('select pg_backend_pid() id')).rows[0].id,bp=(await b.query('select pg_backend_pid() id')).rows[0].id;assert.notEqual(ap,bp);
  // Revocation first: sign waits BEFORE deciding authority and cannot use old binding.
  const staleArgs=await signArgs();await begin(a,false);await a.query(configure,[await version(),null,null]);await begin(b,true);
  const staleSign=observe(b.query(sign,staleArgs));await blocked(bp,ap,staleSign,'Sign behind revocation');await a.query('commit');const denied=await staleSign.outcome;assert.equal(denied.error?.code,'42501');await b.query('rollback');
  assert.equal((await c.query('select count(*)::int n from event_private.operation_signoffs where proposal_id=$1',[proposal])).rows[0].n,0);
  console.log('PASS Gerencia revocation wins: real sign waits then rejects stale authority');
  await c.query(configure,[await version(),actor.id,actor.email]);
  // Signature first: revoke waits until legitimate signature commits, then the
  // shared config version invalidates its CURRENT use, not historical authorship.
  const validArgs=await signArgs();const signedVersion=await version();await begin(a,true);await a.query(sign,validArgs);await begin(b,false);
  const revoke=observe(b.query(configure,[signedVersion,null,null]));await blocked(bp,ap,revoke,'Revoke behind sign');await a.query('commit');await done(revoke);await b.query('commit');
  const history=(await c.query('select signed_by,config_version,signed_at::text stamp from event_private.operation_signoffs where proposal_id=$1 and role=\'gerencia\'',[proposal])).rows;assert.equal(history.length,1);assert.equal(history[0].signed_by,actor.id);assert.equal(history[0].config_version,signedVersion);
  const current=(await c.query("select event_private.operation_signoff_evidence(p)->'roles'->1 value from propostas p where id=$1",[proposal])).rows[0].value;assert.equal(current.signed,false);assert.equal(current.identity_pending,true);
  console.log('PASS Gerencia signature wins: revoke waits; old signer/stamp retained but no longer current');
  // Two administrative writes from one version cannot overwrite each other.
  await c.query(configure,[await version(),actor.id,actor.email]);const casVersion=await version();await begin(a,false);await a.query(configure,[casVersion,null,null]);await begin(b,false);
  const loser=observe(b.query(configure,[casVersion,actor.id,actor.email]));await blocked(bp,ap,loser,'Identity configuration CAS');await a.query('commit');assert.equal((await loser.outcome).error?.code,'PT409');await b.query('rollback');
  assert.equal(await version(),casVersion+1);assert.equal((await c.query('select user_id from event_private.operation_gerencia_identity where singleton')).rows[0].user_id,null);
  console.log('PASS Gerencia concurrent configuration has one winner and no stale overwrite');
 }finally{
  await Promise.allSettled(clients.map(x=>x.query('rollback')));await Promise.allSettled(pending);
  if(config&&identity){await c.query('begin');try{
   await c.query('update event_private.operation_contact_config set (version,enabled,updated_by,updated_at)=(select r.version,r.enabled,r.updated_by,r.updated_at from jsonb_populate_record(null::event_private.operation_contact_config,$1::jsonb) r) where id',[JSON.stringify(config)]);
   await c.query('update event_private.operation_gerencia_identity set (user_id,expected_email,config_version,retired,configured_by,configured_db_role,configured_at)=(select r.user_id,r.expected_email,r.config_version,r.retired,r.configured_by,r.configured_db_role,r.configured_at from jsonb_populate_record(null::event_private.operation_gerencia_identity,$1::jsonb) r) where singleton',[JSON.stringify(identity)]);
   await c.query('delete from event_private.operation_gerencia_identity_audit where config_version>$1',[config.version]);
   await c.query('delete from event_private.operation_signoffs where proposal_id=$1',[proposal]);
   await c.query('delete from event_handoff_tasks where opportunity_id=$1',[opp]);await c.query('delete from event_handoffs where opportunity_id=$1',[opp]);await c.query('delete from event_reservations where opportunity_id=$1',[opp]);await c.query('delete from propostas where id=$1',[proposal]);await c.query('delete from oportunidades where id=$1',[opp]);
   if(actorBefore)await c.query('update auth.users set email_confirmed_at=($2::jsonb->>\'email_confirmed_at\')::timestamptz,banned_until=($2::jsonb->>\'banned_until\')::timestamptz where id=$1',[actor.id,JSON.stringify(actorBefore)]);
   await c.query('alter table event_private.operation_contact_config enable trigger invalidate_signoff_configuration');await c.query("select set_config('request.jwt.claims',$1,false)",[claimsBefore||'']);await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{await Promise.allSettled(clients.map(x=>x.end()));}}
 }
 assert.deepEqual((await c.query('select to_jsonb(x) value from event_private.operation_contact_config x where id')).rows[0].value,config);
 assert.deepEqual((await c.query('select to_jsonb(x) value from event_private.operation_gerencia_identity x where singleton')).rows[0].value,identity);
 console.log('PASS Gerencia concurrency restores fixture configuration and identity without touching other contacts');
};
