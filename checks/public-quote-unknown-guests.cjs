// Synthetic data in disposable PostgreSQL only. No production or provider calls.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
exports.seedUpgrade = async c => {
  const seeded=[];
  await c.query('begin');
  try {
    await c.query('set local session_replication_role=replica');
    for(const kind of ['draft','submit']) {
      const snap={cliente:{nome:'Guest upgrade history',email:'guest-history@example.test'},evento:{convidados:kind==='draft'?30:1},historyMarker:kind};
      const row=(await c.query(`select * from public.${kind==='draft'?"upsert_public_quote_draft($1,$2,'essencial')":'submit_public_quote_request($1,$2)'}`,[randomUUID(),snap])).rows[0];
      seeded.push(row);
    }
    await c.query('commit');return seeded;
  } catch(e) {await c.query('rollback');throw e;}
};
exports.cleanupUpgrade = async (c,seeded) => {
  await c.query('begin');
  try {
    await c.query('set local session_replication_role=replica');
    for(const row of seeded) {
      await c.query('delete from public.solicitacoes_cotacao where id=$1',[row.request_id]);
      await c.query('delete from public.oportunidades where id=$1',[row.opportunity_id]);
    }
    await c.query('commit');
  } catch(e) {await c.query('rollback');throw e;}
};
exports.inspectUpgrade = async c => ({
  functions: (await c.query(`select p.oid::text,p.proname,p.proowner::text,p.proacl::text,p.prosecdef,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','event_private') order by p.oid`)).rows,
  tables: (await c.query(`select oid::text,relname,relacl::text,relrowsecurity,relforcerowsecurity
    from pg_class where relnamespace='public'::regnamespace and relkind='r' order by oid`)).rows,
  requests: (await c.query('select to_jsonb(s) as row from public.solicitacoes_cotacao s order by id')).rows,
  opportunities: (await c.query('select to_jsonb(o) as row from public.oportunidades o order by id')).rows,
});
exports.assertUpgrade = async (c,before) => {
  assert.deepEqual(await exports.inspectUpgrade(c),before,'Upgrade retains ALL function identities/owners/ACLs/config, table permissions/RLS and capture history');
  const column=(await c.query(`select attnotnull,atthasdef from pg_attribute where attrelid='public.solicitacoes_cotacao'::regclass and attname='convidados'`)).rows[0];
  assert.deepEqual(column,{attnotnull:false,atthasdef:false});
  console.log('PASS unknown guest upgrade preserves identities, ACL, RLS and historical captures without defaults');
};
exports.verifyTransactionalRollback = async (c,statement) => {
  const inspect=async()=>({
    columns:(await c.query("select attnotnull,atthasdef,pg_get_expr(d.adbin,d.adrelid) as default_expr from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.solicitacoes_cotacao'::regclass and a.attname='convidados'")).rows,
    constraints:(await c.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.solicitacoes_cotacao'::regclass order by conname")).rows,
    bodies:(await c.query("select pg_get_functiondef(oid) definition from pg_proc where oid in ('public.upsert_public_quote_draft(uuid,jsonb,text)'::regprocedure,'public.submit_public_quote_request(uuid,jsonb)'::regprocedure) order by oid")).rows,
    state:await exports.inspectUpgrade(c),
  });
  const before=await inspect();
  await c.query('begin');
  try { await c.query(statement.replace(/\nbegin;\n/,'\n').replace(/\ncommit;\s*$/,'\n')); }
  finally {await c.query('rollback');}
  assert.deepEqual(await inspect(),before,'Aborted migration restores exact schema, function bodies, ACLs and capture history');
  console.log('PASS unknown guest migration transactional rollback restores prior schema and captures without guesses');
};
exports.run = async c => {
  await c.query('begin');
  try {
    // Keep all application triggers enabled, replacing only the CI HTTP adapter.
    await c.query("create temp table _guest_notifications(capture_status text) on commit drop");
    await c.query("create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$begin if url<>'https://example.invalid/guest-fixture' then raise exception 'Unexpected fixture endpoint';end if;insert into pg_temp._guest_notifications values(body#>>'{record,capture_status}');return 1;end$$");
    await c.query("insert into vault.secrets(name,secret) values('event_lead_webhook_url','https://example.invalid/guest-fixture'),('event_lead_webhook_secret','synthetic-guest-fixture') on conflict(name)do update set secret=excluded.secret");
    const attr={version:1,utm_source:'embaixadacarioca',utm_medium:'website',utm_campaign:'eventos',utm_content:'index_en'};
    const base={cliente:{nome:'Unknown guest fixture',email:'unknown@example.test',idioma:'en'},evento:{tipo:'Coquetel'},attribution:attr};
    const snapshot=guest=>({...base,evento:{...base.evento,...(guest===undefined?{}:{convidados:guest})}});
    async function call(kind,token,snap) {
      await c.query('set local role anon');
      try { return (await c.query(`select * from public.${kind==='draft'?'upsert_public_quote_draft($1,$2,\'evento\')':'submit_public_quote_request($1,$2)'}`,[token,snap])).rows[0]; }
      finally { await c.query('reset role').catch(()=>{}); }
    }
    async function counts(token) {return (await c.query(`select s.id,s.oportunidade_id,s.convidados as request_guests,o.convidados as opportunity_guests,s.capture_status,s.snapshot,o.metadata
      from public.solicitacoes_cotacao s join public.oportunidades o on o.id=s.oportunidade_id where s.capture_token=$1`,[token])).rows;}
    async function reject(kind,token,snap) {
      await c.query('savepoint invalid_capture');
      let error;
      try { await call(kind,token,snap); } catch(e) {error=e;}
      await c.query('rollback to savepoint invalid_capture');
      await c.query('release savepoint invalid_capture');
      assert.equal(error?.code,'22023',`Reject ${kind} ${JSON.stringify(snap.evento?.convidados)} before writes`);
    }
    for(const missing of [undefined,null,'','   ']) {
      const token=randomUUID();
      const result=await call('draft',token,snapshot(missing));
      let [row]=await counts(token);
      assert.ok(result.request_id);assert.equal(row.request_guests,null);assert.equal(row.opportunity_guests,null);assert.equal(row.capture_status,'partial');
      await reject('submit',token,snapshot(missing));
      assert.deepEqual(await counts(token),[row]);
      assert.deepEqual(await call('draft',token,snapshot(missing)),result);
      await c.query(`update oportunidades set metadata=metadata||'{"keep":"unrelated"}' where id=$1`,[result.opportunity_id]);
      await call('draft',token,snapshot(20));
      [row]=await counts(token);assert.equal(row.request_guests,20);assert.equal(row.opportunity_guests,20);
      await call('draft',token,snapshot(null));
      [row]=await counts(token);assert.equal(row.request_guests,null);assert.equal(row.opportunity_guests,null);
      const changed={...snapshot(25),attribution:{...attr,utm_content:'contato'}};
      assert.deepEqual(await call('submit',token,changed),result);
      [row]=await counts(token);assert.equal(row.request_guests,25);assert.equal(row.opportunity_guests,25);assert.equal(row.capture_status,'complete');
      assert.deepEqual(row.snapshot.attribution,attr);assert.deepEqual(row.metadata.attribution,attr);assert.equal(row.metadata.keep,'unrelated');assert.equal(row.snapshot.cliente.idioma,'en');
      // A completed token remains immutable even on stale blank/invalid retries.
      assert.deepEqual(await call('draft',token,snapshot(null)),result);
      assert.deepEqual(await call('submit',token,snapshot('invalid')),result);
      assert.deepEqual(await counts(token),[row]);
    }
    for(const valid of [1,2,500,'1','20','500']) {
      const token=randomUUID();await call('submit',token,snapshot(valid));
      const [row]=await counts(token);assert.equal(row.request_guests,Number(valid));assert.equal(row.opportunity_guests,Number(valid));
    }
    const existing=randomUUID();await call('draft',existing,snapshot(40));
    const before=await counts(existing);
    for(const invalid of [0,-1,501,1.5,'20.5','2e1','abc','-20','1,000',true,{},[],2147483648,'9'.repeat(100)]) {
      for(const kind of ['draft','submit']) {
        const token=randomUUID();await reject(kind,token,snapshot(invalid));assert.deepEqual(await counts(token),[]);
        await reject(kind,existing,snapshot(invalid));assert.deepEqual(await counts(existing),before);
      }
    }
    for(const missing of [undefined,null,'',' ']) {
      const token=randomUUID();await reject('submit',token,snapshot(missing));assert.deepEqual(await counts(token),[]);
    }
    // Existing proposal authority must not be overwritten by a late partial edit.
    const linked=randomUUID();const linkedResult=await call('draft',linked,snapshot(40));
    await c.query("insert into propostas(oportunidade_id,cliente_nome,convidados,snapshot,is_current) values($1,'Current proposal fixture',60,'{}',true)",[linkedResult.opportunity_id]);
    await call('draft',linked,snapshot(null));
    const [linkedRow]=await counts(linked);
    assert.equal(linkedRow.request_guests,null);assert.equal(linkedRow.opportunity_guests,60,'Current proposal remains commercial authority');
    assert.ok((await c.query("select count(*)::int n from pg_temp._guest_notifications where capture_status='complete'")).rows[0].n>0,'Completion notifications still run through isolated recorder');
    // The storage invariant cannot be bypassed by a privileged direct writer.
    await c.query('savepoint complete_null');
    await assert.rejects(c.query("update solicitacoes_cotacao set capture_status='complete',convidados=null where capture_token=$1",[existing]),e=>e.code==='23514');
    await c.query('rollback to savepoint complete_null');
    console.log('PASS unknown guest capture: anon RPC, NULL in both records, strict invalid rejection, 1–500 compatibility, clearing, completion, immutable retries, attribution and metadata');
  } finally {await c.query('rollback');}
};
