const assert=require('node:assert/strict');
module.exports=async function verifyGerenciaRollback(c,sql){
 const functions="select p.oid,n.nspname,p.proname,p.proacl::text acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','event_private') and p.prokind in ('f','p') order by p.oid";
 const before=(await c.query(functions)).rows;
 const rollback=sql('supabase/rollback/gerencia_operational_identity_compatibility.sql');
 await c.query('begin');
 try{
  await c.query("set local statement_timeout='20s'");
  await c.query('savepoint active_policy');await c.query('update event_private.operation_contact_config set enabled=true where id');
  let refused=false;try{await c.query(rollback);}catch(e){refused=/política ainda desligada/.test(e.message);}assert.equal(refused,true);await c.query('rollback to savepoint active_policy');assert.deepEqual((await c.query(functions)).rows,before);
  let actor;
  for(const u of (await c.query('select id,email from auth.users')).rows){await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:u.id,email:u.email,role:'authenticated'})]);const a=(await c.query('select public.is_team_member() team,event_private.journey_financial_operator() finance')).rows[0];if(a.team&&!a.finance)actor=u;}
  assert.ok(actor);await c.query("select set_config('request.jwt.claims','',true)");await c.query('update auth.users set email_confirmed_at=clock_timestamp(),banned_until=null where id=$1',[actor.id]);
  const v=(await c.query('select version from event_private.operation_contact_config where id')).rows[0].version;
  await c.query('select event_private.configure_gerencia_identity($1,$2,$3,true)',[v,actor.id,actor.email]);
  const opp=(await c.query("insert into oportunidades(cliente_nome,status) values('Gerencia rollback fixture','confirmado') returning id")).rows[0].id;
  const p=(await c.query(`insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,convidados,duracao,subtotal,taxa_servico,total,snapshot) values($1,'Gerencia rollback fixture','confirmado','ready',true,20,2,1000,120,1120,'{"event":{"guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning *`,[opp])).rows[0];
  await c.query('update event_private.operation_contact_config set enabled=true where id');
  const h=(await c.query('select version from event_handoffs where opportunity_id=$1',[opp])).rows[0];
  const fp=(await c.query('select event_private.operation_review_fingerprint(p) hash from propostas p where id=$1',[p.id])).rows[0].hash;
  await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor.id,email:actor.email,role:'authenticated'})]);await c.query('set local role authenticated');
  await c.query("select public.sign_event_operation($1,$2,$3,$4,'gerencia',true)",[p.id,p.revision,h.version,fp]);await c.query('reset role');
  await c.query('update event_private.operation_contact_config set enabled=false where id'); // Disposable fixture only; never an API/policy-off recommendation.
  const signatures=(await c.query('select to_jsonb(s) value from event_private.operation_signoffs s order by proposal_id,role')).rows;
  const business=(await c.query('select to_jsonb(p) value from propostas p order by id')).rows;
  await c.query(rollback);
  const retired=(await c.query('select * from event_private.operation_gerencia_identity where singleton')).rows[0];assert.equal(retired.retired,true);assert.equal(retired.user_id,actor.id);
  assert.deepEqual((await c.query('select to_jsonb(s) value from event_private.operation_signoffs s order by proposal_id,role')).rows,signatures);assert.deepEqual((await c.query('select to_jsonb(p) value from propostas p order by id')).rows,business);
  const after=(await c.query(functions)).rows;assert.equal(after.length,before.length);for(const f of before){const next=after.find(x=>x.oid===f.oid);assert.ok(next);assert.equal(next.acl,f.acl);if(!['sign_event_operation','operation_signoff_evidence'].includes(f.proname))assert.equal(next.definition,f.definition);}
  await c.query('savepoint retired_write');let blocked=false;try{await c.query('select event_private.configure_gerencia_identity($1,$2,$3,true)',[retired.config_version,actor.id,actor.email]);}catch(e){blocked=e.code==='55000';}assert.equal(blocked,true);await c.query('rollback to savepoint retired_write');
  const configBeforeRepeat=(await c.query('select to_jsonb(c) value from event_private.operation_contact_config c where id')).rows;
  const auditBeforeRepeat=(await c.query('select to_jsonb(a) value from event_private.operation_gerencia_identity_audit a order by config_version')).rows;
  await c.query(rollback);assert.deepEqual((await c.query(functions)).rows,after);assert.deepEqual((await c.query('select to_jsonb(c) value from event_private.operation_contact_config c where id')).rows,configBeforeRepeat);assert.deepEqual((await c.query('select to_jsonb(a) value from event_private.operation_gerencia_identity_audit a order by config_version')).rows,auditBeforeRepeat);
  console.log('PASS Gerencia rollback refuses active obligations, retains real synthetic signature/authorship and binding audit, retires reconfiguration and is idempotent');
 }finally{await c.query('rollback');}
 assert.deepEqual((await c.query(functions)).rows,before);console.log('PASS Gerencia rollback diagnostic transaction restores composed schema');
};
