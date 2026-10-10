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
  // Only pg_cron extension creation is adapted; cron.schedule is explicitly mocked.
  const statement=sql(file).replace('create extension if not exists pg_cron with schema pg_catalog;','-- CI adapter: cron schema supplied by platform-test.sql');
  try { await c.query(statement); } catch(e) { e.message=`${file}: ${e.message}`; throw e; }
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
  for(const f of ['capture-idempotency','event-operations','channel-events','opportunity-reconciliation','p1-assisted-sales-handoff','priority-integrity','commercial-cockpit','bridge-operational-completion']) {
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
    c=await connect('events_test');
    await c.query('begin'); await apply(c,'supabase/rollback/priority_integrity_compatibility.sql');
    assert.equal((await c.query("select has_table_privilege('authenticated','propostas','UPDATE') ok")).rows[0].ok,true);
    await c.query('rollback'); console.log('PASS emergency compatibility rollback');
  } finally { if(c) await c.end(); await admin.end(); }
})().catch(e=>{console.error(e);process.exitCode=1});
