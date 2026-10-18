// Deliberately refuses remote URLs. Creates only disposable, named test databases.
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const address = new URL(process.env.TEST_DATABASE_URL || 'postgres://postgres:event-test-only@127.0.0.1:5432/postgres');
if (!['localhost','127.0.0.1','postgres'].includes(address.hostname)) throw Error('Only an isolated local test database is permitted');
const admin = new Client({ connectionString: address.toString() });
const sql = (file) => fs.readFileSync(path.join(root,file),'utf8');
const migrationFiles = fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const priority = migrationFiles.find(f=>f.endsWith('_priority_integrity_release.sql'));
async function connect(name) { const url = new URL(address); url.pathname=`/${name}`; const c = new Client({connectionString:url.toString()}); await c.connect(); return c; }
async function apply(c,file) {
  const cohortReview=file.startsWith('supabase/migrations/')&&file.endsWith('_cohort_preparation_review.sql');
  if(cohortReview) await apply(c,'checks/cohort-preparation-upgrade-setup.sql');
  // Only pg_cron extension creation is adapted; cron.schedule is explicitly mocked.
  const statement=sql(file).replace('create extension if not exists pg_cron with schema pg_catalog;','-- CI adapter: cron schema supplied by platform-test.sql');
  try { await c.query(statement); } catch(e) { e.message=`${file}: ${e.message}`; throw e; }
  if(cohortReview) { await apply(c,'checks/cohort-preparation-upgrade-assert.sql'); console.log('PASS preparation evidence upgrade preserves proposals and unknown history'); }
}
async function create(name) {
  await admin.query(`create database ${name}`);
  const c=await connect(name);
  await apply(c,'supabase/bootstrap/platform-test.sql');
  for (const f of JSON.parse(sql('supabase/bootstrap/manifest.json'))) await apply(c,f);
  return c;
}
async function checks(c) {
  // Business configuration is deliberately absent from a fresh installation.
  // Explicit fixture capacity, independent of production configuration.
  await c.query('update public.event_commercial_policy set capacity=200 where id');
  for(const f of ['capture-idempotency','event-operations','channel-events','opportunity-reconciliation','p1-assisted-sales-handoff','priority-integrity','commercial-cockpit','bridge-operational-completion','proposal-persistence','remote-approval','journey-integrity','journey-completion','approval-closure','approval-closure-regressions','channel-readiness-journey','amendment-lifecycle','seller-workflow-feedback','operational-release','operational-workspace','channel-measurement','intuitive-sales','payment-decision','production-capacity-margin','payment-reservation-review','production-cost-review','cohort-preparation']) {

    await apply(c,`checks/${f}.sql`); console.log(`PASS ${f}`);
  }
}
async function concurrent(c,name) {
  const actor=(await c.query("select id from auth.users where email='leorangel@gmail.com'")).rows[0].id;
  const claims=JSON.stringify({sub:actor,email:'leorangel@gmail.com',role:'authenticated'});
  const opp=(await c.query("insert into oportunidades(cliente_nome,status) values('Concurrent fixture','proposta_pronta') returning id")).rows[0].id;
  const p=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,snapshot) values($1,'Concurrent fixture','proposta_pronta','ready','{}') returning *",[opp])).rows[0];
  const writers=await Promise.all([connect(name),connect(name)]);
  try {
    await Promise.all(writers.map(x=>x.query("select set_config('request.jwt.claims',$1,false)",[claims])));
    const results=await Promise.allSettled(writers.map((x,i)=>x.query('select * from save_event_proposal($1,$2,$3,null)',[p.id,JSON.stringify({snapshot:{writer:i}}),p.revision])));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
    const updated=(await c.query('select * from propostas where id=$1',[p.id])).rows[0];
    const versions=await Promise.allSettled(writers.map((x,i)=>x.query('select * from save_event_proposal(null,$1,$2,$3)',[JSON.stringify({oportunidade_id:opp,cliente_nome:`Version ${i}`,snapshot:{},status:'proposta_pronta',publication_status:'ready',is_current:true}),updated.revision,p.id])));
    assert.equal(versions.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(versions.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
    assert.equal(Number((await c.query('select count(*) from propostas where oportunidade_id=$1 and is_current',[opp])).rows[0].count),1);
    console.log('PASS concurrent save and version creation');
    const publicOpp=(await c.query("insert into oportunidades(cliente_nome,status) values('Public concurrency','proposta_enviada') returning id")).rows[0].id;
    const publicRow=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,snapshot) values($1,'Public concurrency','proposta_enviada','sent','{}') returning *",[publicOpp])).rows[0];
    const requestId=require('node:crypto').randomUUID();
    await Promise.all(writers.map(x=>x.query('set role anon')));
    const duplicateResults=await Promise.all(writers.map(x=>x.query("select * from respond_public_proposal_v2($1,'alteracao',$2,$3,$4,null,null,null,'Revisar horario',null)",[publicRow.public_token,requestId,publicRow.id,publicRow.revision])));
    assert.ok(duplicateResults.every(r=>r.rows[0].ok));
    assert.equal(Number((await c.query('select count(*) from event_private.public_response_requests where request_id=$1',[requestId])).rows[0].count),1);
    const publicUpdated=(await c.query('select * from propostas where id=$1',[publicRow.id])).rows[0];
    await writers[0].query('set role authenticated');
    const race=await Promise.allSettled([
      writers[0].query('select * from save_event_proposal($1,$2,$3,null)',[publicUpdated.id,JSON.stringify({snapshot:{teamWriter:true}}),publicUpdated.revision]),
      writers[1].query("select * from respond_public_proposal_v2($1,'alteracao',$2,$3,$4,null,null,null,'Outro horario',null)",[publicUpdated.public_token,require('node:crypto').randomUUID(),publicUpdated.id,publicUpdated.revision]),
    ]);
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
    console.log('PASS concurrent public retry and team/client race');
    // A renewal uses the proposal lock: concurrent unchanged requests share one successor.
    await c.query("update event_private.proposal_approval_policy set enabled=true,approver_id=$1,approver_email='leorangel@gmail.com',whatsapp='5521000000000' where id",[actor]);
    const renewalOpp=(await c.query("insert into oportunidades(cliente_nome,status,data_evento) values('Renewal race fixture','proposta_pronta','2099-11-18') returning id")).rows[0].id;
    const renewal=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,horario_evento,convidados,subtotal,taxa_servico,total,snapshot) values($1,'Renewal race fixture','proposta_pronta','ready','2099-11-18','10:00',20,1000,120,1120,'{\"totals\":{\"subtotal\":1000,\"serviceFee\":120,\"total\":1120},\"selectedItems\":[{\"name\":\"Fixture\",\"calc\":{\"total\":1000}}]}') returning *",[renewalOpp])).rows[0];
    const content=JSON.stringify({channel:'whatsapp',destination:'5521000000001',body:'Renewal race fixture',message:'Renewal race fixture',title:'Fixture',contentHash:null,reviewedResponseAt:null,proposalUrl:'https://leorangel22.github.io/main/proposta.html?p='+renewal.public_token});
    const prior=(await c.query('select * from event_create_proposal_approval($1,$2,$3,$4)',[renewal.id,renewal.revision,actor,content])).rows[0];
    await c.query("update event_proposal_approvals set expires_at=now()-interval '1 second' where id=$1",[prior.id]);
    await Promise.all(writers.map(x=>x.query('set role service_role')));
    const renewed=await Promise.all(writers.map(x=>x.query('select * from event_create_proposal_approval($1,$2,$3,$4)',[renewal.id,renewal.revision,actor,content])));
    assert.equal(renewed[0].rows[0].id,renewed[1].rows[0].id);assert.notEqual(renewed[0].rows[0].id,prior.id);
    assert.equal(Number((await c.query('select count(*) from event_proposal_approvals where proposal_id=$1',[renewal.id])).rows[0].count),2);
    assert.equal(Number((await c.query('select revision from propostas where id=$1',[renewal.id])).rows[0].revision),Number(renewal.revision));
    await c.query('update event_private.proposal_approval_policy set enabled=false where id');
    console.log('PASS concurrent approval expiry renewal without proposal mutation');
    // Real concurrent database sessions, disposable amendment decisions only.
    const amendmentOpp=(await c.query("insert into oportunidades(cliente_nome,status,data_evento) values('Amendment race fixture','confirmado','2100-01-10') returning id")).rows[0].id;
    const amendmentSnapshot={event:{date:'2100-01-10',time:'10:00',guests:20,duration:2},totals:{subtotal:1000,serviceFee:120,total:1120},selectedItems:[{name:'Fixture',calc:{total:1000}}],pagamentoSinal:{valor:560,data:'2026-10-17',validadoPor:actor,validadoEm:new Date().toISOString(),validacaoPendente:false}};
    const amendmentBase=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot) values($1,'Amendment race fixture','confirmado','ready',true,'2100-01-10','10:00',20,2,1000,120,1120,$2) returning *",[amendmentOpp,JSON.stringify(amendmentSnapshot)])).rows[0];
    const draftSnapshot={...amendmentSnapshot,amendmentOf:{id:amendmentBase.id,revision:Number(amendmentBase.revision)},event:{date:'2100-01-11',time:'11:00',guests:25,duration:2}};delete draftSnapshot.pagamentoSinal;
    const amendmentDraft=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot) values($1,'Amendment race fixture','negociacao','draft',false,'2100-01-11','11:00',25,2,1000,120,1120,$2) returning *",[amendmentOpp,JSON.stringify(draftSnapshot)])).rows[0];
    await Promise.all(writers.map(async x=>{await x.query('set role authenticated');await x.query("select set_config('request.jwt.claims',$1,false)",[claims]);}));
    const requests=await Promise.all(writers.map(x=>x.query("select request_event_amendment($1,$2,'Remarcação para revisão concorrente de fixture') result",[amendmentDraft.id,amendmentDraft.revision])));
    const amendmentId=requests[0].rows[0].result.id;assert.equal(amendmentId,requests[1].rows[0].result.id);
    const decisions=await Promise.allSettled(writers.map(x=>x.query("select decide_event_amendment($1,'approve','pending_manager','')",[amendmentId])));
    assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);assert.equal(decisions.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
    const amendment=(await c.query('select * from event_private.event_amendments where id=$1',[amendmentId])).rows[0];
    await Promise.all(writers.map(async x=>{await x.query('set role anon');await x.query("select set_config('request.jwt.claims','',false)");}));
    const publicRequest=require('node:crypto').randomUUID();
    const acceptances=await Promise.all(writers.map(x=>x.query("select respond_public_event_amendment($1,$2,'accept','Client fixture','',$3) result",[amendment.client_token,amendment.content_hash,publicRequest])));
    assert.ok(acceptances.every(x=>x.rows[0].result.status==='client_accepted'));
    await Promise.all(writers.map(async x=>{await x.query('set role authenticated');await x.query("select set_config('request.jwt.claims',$1,false)",[claims]);}));
    const applications=await Promise.all(writers.map(x=>x.query("select apply_event_amendment($1,$2,$3,'') result",[amendmentId,amendmentBase.revision,amendmentDraft.revision])));
    assert.deepEqual(applications.map(x=>x.rows[0].result.existing).sort(),[false,true]);
    assert.equal(Number((await c.query('select count(*) from event_reservations where opportunity_id=$1',[amendmentOpp])).rows[0].count),1);
    const effective=(await c.query('select * from propostas where id=$1',[amendmentDraft.id])).rows[0];assert.equal(effective.is_current,true);assert.equal(effective.sent_at,null);
    assert.equal(Number((await c.query('select version from event_handoffs where opportunity_id=$1',[amendmentOpp])).rows[0].version),2);
    assert.equal(Number((await c.query('select count(*) from event_private.amendment_apply_context')).rows[0].count),0);
    console.log('PASS concurrent amendment request, manager decision, bearer acceptance and atomic application');
  } finally { await Promise.all(writers.map(x=>x.end())); }
}
(async()=>{
  await admin.connect();
  let c;
  try {
    c=await create('events_test');
    for(const f of migrationFiles.filter(f=>f<priority)) await apply(c,`supabase/migrations/${f}`);
    const legacy=(await c.query("insert into oportunidades(cliente_nome,status) values('Upgrade fixture','proposta_pronta') returning id")).rows[0];
    const preserved=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,snapshot) values($1,'Upgrade fixture','proposta_pronta','ready','{\"historyMarker\":\"preserve\"}') returning id,public_token",[legacy.id])).rows[0];
    for(const f of migrationFiles.filter(f=>f>=priority)) await apply(c,`supabase/migrations/${f}`);
    const after=(await c.query('select id,public_token,revision,snapshot from propostas where id=$1',[preserved.id])).rows[0];
    assert.equal(after.public_token,preserved.public_token); assert.equal(after.snapshot.historyMarker,'preserve'); assert.equal(Number(after.revision),1);
    console.log('PASS upgrade preserves history and links');
    await checks(c); await concurrent(c,'events_test'); await c.end(); c=null;
    c=await create('events_fresh_test');
    for(const f of migrationFiles) await apply(c,`supabase/migrations/${f}`);
    await checks(c); console.log('PASS fresh installation');
    await c.end(); c=null;
    // Production already has journey_integrity (#52) installed. Exercise the
    // late approval_closure installation as well as chronological fresh installs.
    c=await create('events_current_upgrade_test');
    const closure=migrationFiles.find(f=>f.endsWith('_approval_closure.sql'));
    for(const f of migrationFiles.filter(f=>f!==closure)) await apply(c,`supabase/migrations/${f}`);
    const legacyApproval=(await c.query(`
      update event_private.proposal_approval_policy set enabled=true,
        approver_id=(select id from auth.users where email='leorangel@gmail.com'),approver_email='manager@example.test',whatsapp='5521000000000' where id;
      insert into oportunidades(cliente_nome,status,data_evento) values('Legacy approval fixture','proposta_pronta','2099-11-18');
      insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,total,subtotal,taxa_servico,snapshot)
        select id,cliente_nome,'proposta_pronta','ready','2099-11-18',1120,1000,120,
          '{"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"name":"Legacy fixture","calc":{"total":1000}}]}'::jsonb
        from oportunidades where cliente_nome='Legacy approval fixture';
      select a.* from propostas p cross join lateral event_create_proposal_approval(p.id,p.revision,
        (select id from auth.users where email='leorangel@gmail.com'),
        jsonb_build_object('channel','whatsapp','destination','5521000000001','body','Legacy approved content',
          'proposalUrl','https://leorangel22.github.io/main/proposta.html?p='||p.public_token)) a
        where p.cliente_nome='Legacy approval fixture';
    `)).at(-1).rows[0];
    await apply(c,`supabase/migrations/${closure}`);
    const backfilled=(await c.query('select * from event_proposal_approvals where id=$1',[legacyApproval.id])).rows[0];
    assert.equal(backfilled.review_hash,legacyApproval.review_hash);
    assert.deepEqual(backfilled.proposal_snapshot,legacyApproval.proposal_snapshot);
    assert.deepEqual(backfilled.content,legacyApproval.content);
    const reused=(await c.query('select a.* from propostas p cross join lateral event_create_proposal_approval(p.id,p.revision,$1,$2) a where p.id=$3',
      [legacyApproval.requested_by,legacyApproval.content,legacyApproval.proposal_id])).rows[0];
    assert.equal(reused.id,legacyApproval.id);
    // Remove synthetic pre-migration rows so common permission/monitor checks start clean.
    await c.query('delete from event_approval_notifications where approval_id=$1',[legacyApproval.id]);
    await c.query('delete from event_approval_audit where approval_id=$1',[legacyApproval.id]);
    await c.query('delete from event_proposal_approvals where id=$1',[legacyApproval.id]);
    await c.query('update event_private.proposal_approval_policy set enabled=false where id');
    await checks(c); console.log('PASS current production upgrade preserves existing approval links and identity');
    await c.end(); c=null;
    c=await connect('events_test');
    await c.query('begin'); await apply(c,'supabase/rollback/priority_integrity_compatibility.sql');
    assert.equal((await c.query("select has_table_privilege('authenticated','propostas','UPDATE') ok")).rows[0].ok,true);
    await c.query('rollback'); console.log('PASS emergency compatibility rollback');
  } finally { if(c) await c.end(); await admin.end(); }
})().catch(e=>{console.error(e);process.exitCode=1});
