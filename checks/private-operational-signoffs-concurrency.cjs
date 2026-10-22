// Native PostgreSQL sessions only. Synthetic fixtures; no HTTP, credentials or live data.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

module.exports = async function verifyOperationalSignoffConcurrency(c, connect, name, actor) {
  const clients = [], pending = [];
  const opportunity = randomUUID(), proposalId = randomUUID(), scope = randomUUID();
  let original, failure;

  async function beginFixture(client) {
    await client.query('begin');
    await client.query('set local role none');
    await client.query("select set_config('request.jwt.claims','',true)");
    await client.query("set local statement_timeout='20s'");
    await client.query("set local lock_timeout='10s'");
    await client.query("set local idle_in_transaction_session_timeout='30s'");
  }

  async function fixture(work) {
    await beginFixture(c);
    try {
      const result = await work();
      await c.query('commit');
      return result;
    } catch (error) {
      await c.query('rollback').catch(() => {});
      throw error;
    }
  }

  // Attach both handlers in the same turn that starts the query. A server error
  // while the observer is polling must never become an unhandled rejection.
  function observe(query) {
    const observation = { settled: false };
    observation.outcome = query.then(
      result => (observation.settled = true, { result }),
      error => (observation.settled = true, { error })
    );
    pending.push(observation.outcome);
    return observation;
  }

  async function finish(observation) {
    const outcome = await observation.outcome;
    if (outcome.error) throw outcome.error;
    return outcome.result;
  }

  async function assertBlocked(pid, blocker, observation, label) {
    const deadline = Date.now() + 5000;
    let state;
    while (Date.now() < deadline) {
      // c is outside a transaction: each poll observes a fresh activity snapshot.
      state = (await c.query(`
        select state, wait_event_type, wait_event, pg_blocking_pids(pid) blockers
        from pg_stat_activity where pid=$1
      `, [pid])).rows[0];
      if (state?.state === 'active' && state.wait_event_type === 'Lock' &&
          state.blockers.map(Number).includes(blocker)) return;
      if (observation.settled) {
        const outcome = await observation.outcome;
        if (outcome.error) throw outcome.error;
        assert.fail(`${label}: query completed without the required overlapping lock wait`);
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail(`${label}: expected backend ${pid} to wait on ${blocker}; observed ${JSON.stringify(state)}`);
  }

  async function readConfiguration() {
    return (await c.query(`
      select to_jsonb(c) config,
        (select jsonb_agg(to_jsonb(r) order by r.role) from event_private.operation_contacts r) contacts
      from event_private.operation_contact_config c where id
    `)).rows[0];
  }

  try {
    let email;
    await fixture(async () => {
      email = (await c.query('select email from auth.users where id=$1', [actor])).rows[0]?.email;
      assert.ok(email, 'The existing manager actor must come from the auth fixture table');
      original = await readConfiguration();
      assert.ok(original?.config, 'Operational contact configuration exists');
      // Keep the CAS race dormant so it cannot invalidate unrelated releases.
      // These fixture-only transitions do not change the version or grant access.
      await c.query('update event_private.operation_contact_config set enabled=false where id');
    });

    const claims = JSON.stringify({ sub: actor, email, role: 'authenticated' });
    async function authenticate(client) {
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims',$1,true)", [claims]);
      const identity = (await client.query('select current_user, auth.uid() actor, public.is_super_admin() manager')).rows[0];
      assert.equal(identity.current_user, 'authenticated', 'RPCs must not run with fixture-admin privileges');
      assert.equal(identity.actor, actor);
      assert.equal(identity.manager, true, 'Use existing manager authority, never fixture-created grants');
    }
    async function beginAuthenticated(client) {
      await beginFixture(client);
      await authenticate(client);
    }

    const a = await connect(name); clients.push(a);
    const b = await connect(name); clients.push(b);
    const aPid = Number((await a.query('select pg_backend_pid() pid')).rows[0].pid);
    const bPid = Number((await b.query('select pg_backend_pid() pid')).rows[0].pid);
    assert.notEqual(aPid, bPid, 'Concurrency requires two real PostgreSQL backends');
    const contacts = suffix => ['financeiro', 'gerencia', 'salao', 'eventos'].map(role => ({
      role, email: role === 'financeiro' ? `fixture-${scope}-${suffix}@example.test` : null, whatsapp: null,
    }));
    const winnerContacts = contacts('a'), loserContacts = contacts('b');
    const version = original.config.version;
    const configureSql = 'select public.configure_event_operational_contacts($1,$2::jsonb,false) result';

    // A's successful RPC keeps the config row locked until COMMIT. B starts
    // with the same version, demonstrably overlaps A, then must lose with PT409.
    await beginAuthenticated(a);
    const winner = await a.query(configureSql, [version, JSON.stringify(winnerContacts)]);
    assert.equal(winner.rows[0].result.version, version + 1);
    await beginAuthenticated(b);
    const staleWrite = observe(b.query(configureSql, [version, JSON.stringify(loserContacts)]));
    await assertBlocked(bPid, aPid, staleWrite, 'Concurrent contact configuration');
    await a.query('commit');
    const loser = await staleWrite.outcome;
    assert.equal(loser.error?.code, 'PT409', 'Exactly one overlapping CAS write must lose with PT409');
    await b.query('rollback');
    const configured = await readConfiguration();
    assert.equal(configured.config.version, version + 1, 'Exactly one configuration revision was committed');
    assert.equal(configured.config.enabled, false);
    assert.equal(configured.config.updated_by, actor);
    assert.deepEqual(configured.contacts, [...winnerContacts].sort((x, y) => x.role.localeCompare(y.role)));

    let proposal, handoff, release;
    await fixture(async () => {
      // Enabling at the same version avoids touching unrelated handoffs. The
      // normal enable/configuration invalidation path has separate SQL coverage.
      await c.query('update event_private.operation_contact_config set enabled=true where id');
      await c.query("insert into public.oportunidades(id,cliente_nome,status) values($1,'Signoff concurrency fixture','confirmado')", [opportunity]);
      proposal = (await c.query(`
        insert into public.propostas(id,oportunidade_id,cliente_nome,status,publication_status,is_current,
          convidados,duracao,subtotal,taxa_servico,total,snapshot)
        values($1,$2,'Signoff concurrency fixture','confirmado','ready',true,20,2,1000,120,1120,
          '{"event":{"guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}')
        returning to_jsonb(propostas) value
      `, [proposalId, opportunity])).rows[0].value;
      handoff = (await c.query('select to_jsonb(h) value from public.event_handoffs h where opportunity_id=$1', [opportunity])).rows[0]?.value;
      assert.ok(handoff, 'The real proposal trigger creates the operational handoff');
      assert.equal(handoff.changes_pending, false);
      // Undated agreement and released reservation cannot occupy another test's
      // capacity. All reservation statuses use the actual invalidation trigger.
      await c.query(`
        insert into public.event_reservations(opportunity_id,proposal_id,starts_at,ends_at,guests,status)
        values($1,$2,'2199-12-18 10:00:00+00','2199-12-18 12:00:00+00',20,'released')
      `, [opportunity, proposalId]);
      release = (await c.query(`
        update public.event_handoff_tasks set status='in_progress',acknowledged_at=clock_timestamp(),
          acknowledged_by=$2,completed_at=null,completed_by=null
        where opportunity_id=$1 and task_key='gerencia_go_no_go'
        returning to_jsonb(event_handoff_tasks) value
      `, [opportunity, actor])).rows[0]?.value;
      assert.ok(release?.acknowledged_at, 'Seed a release that must be invalidated, not an already-pending no-op');
    });

    // Concurrent duplicate signatures serialize on the real proposal row, not
    // just ON CONFLICT in an artificially isolated table.
    await beginAuthenticated(a);
    const evidence = (await a.query('select public.event_operation_readiness($1,$2) result', [proposalId, proposal.revision])).rows[0].result;
    const signoffs = evidence.operational_signoffs;
    assert.equal(signoffs.enabled, true);
    assert.equal(signoffs.roles.find(role => role.role === 'financeiro').can_sign, true);
    const signArgs = [proposalId, proposal.revision, handoff.version, signoffs.review_fingerprint];
    const signSql = "select public.sign_event_operation($1,$2,$3,$4,'financeiro',true) result";
    const signed = (await a.query(signSql, signArgs)).rows[0].result;
    await beginAuthenticated(b);
    const duplicate = observe(b.query(signSql, signArgs));
    await assertBlocked(bPid, aPid, duplicate, 'Concurrent duplicate signature');
    await a.query('commit');
    const repeated = (await finish(duplicate)).rows[0].result;
    await b.query('commit');
    const firstSignature = signed.operational_signoffs.roles.find(role => role.role === 'financeiro');
    const secondSignature = repeated.operational_signoffs.roles.find(role => role.role === 'financeiro');
    assert.equal(firstSignature.signed, true);
    assert.equal(secondSignature.signed, true);
    assert.equal(secondSignature.signed_at, firstSignature.signed_at, 'A retry preserves the original signature timestamp');
    const signatureRows = (await c.query('select to_jsonb(s) value from event_private.operation_signoffs s where proposal_id=$1', [proposalId])).rows;
    assert.equal(signatureRows.length, 1, 'Both successful calls produce exactly one signature row');
    assert.equal(signatureRows[0].value.signed_by, actor);
    assert.equal(signatureRows[0].value.review_fingerprint, signoffs.review_fingerprint);

    // H = handoff, G = gerencia_go_no_go. B holds only H before A starts.
    // A's real reservation trigger must wait for H *without* already holding G.
    // The old G -> H order lets A hold G and deadlocks B's actual planning RPC.
    await beginFixture(b);
    const held = await b.query('select opportunity_id from public.event_handoffs where opportunity_id=$1 for update', [opportunity]);
    assert.equal(held.rowCount, 1);
    await authenticate(b);
    await b.query("set local lock_timeout='2500ms'");
    await beginFixture(a);
    const reservationEdit = observe(a.query('update public.event_reservations set guests=guests+1 where opportunity_id=$1 returning guests', [opportunity]));
    await assertBlocked(aPid, bPid, reservationEdit, 'Reservation invalidation waits for handoff H');
    // Keep expected_updated_at as JSON text, not a JS Date: PostgreSQL retains
    // microseconds and the RPC intentionally compares the timestamp exactly.
    assert.equal((await b.query('select current_user')).rows[0].current_user, 'authenticated');
    const planned = (await b.query(`
      select to_jsonb(public.plan_event_handoff_task($1,$2,$3::timestamptz,$4,$5::timestamptz,$6)) result
    `, [release.id, handoff.version, release.updated_at, 'Synthetic coordinator', '2199-12-17 12:00:00+00', 'Synthetic lock-order review'])).rows[0].result;
    assert.equal(planned.id, release.id);
    assert.equal(planned.responsible_name, 'Synthetic coordinator');
    await b.query('commit');
    assert.equal((await finish(reservationEdit)).rows[0].guests, 21);
    await a.query('commit');
    const after = (await c.query('select to_jsonb(t) value from public.event_handoff_tasks t where id=$1', [release.id])).rows[0].value;
    assert.equal(after.responsible_name, 'Synthetic coordinator', 'The authenticated planning RPC committed');
    assert.equal(after.status, 'pending', 'The reservation trigger completed the release invalidation');
    for (const field of ['acknowledged_at', 'acknowledged_by', 'completed_at', 'completed_by']) assert.equal(after[field], null);
  } catch (error) {
    failure = error;
  } finally {
    const cleanupErrors = [];
    // Roll back both sessions together: either may own the lock needed by the
    // other's pending query. Server-side timeouts bound even the regression path.
    const rollbacks = await Promise.allSettled(clients.map(client => client.query('rollback')));
    for (const result of rollbacks) if (result.status === 'rejected') cleanupErrors.push(result.reason);
    await Promise.all(pending);
    const closed = await Promise.allSettled(clients.map(client => client.end()));
    for (const result of closed) if (result.status === 'rejected') cleanupErrors.push(result.reason);
    if (original) {
      try {
        await fixture(async () => {
          // Restore the version while disabled, then restore enabled without a
          // version change. Cleanup must not invalidate other tests' releases.
          await c.query('update event_private.operation_contact_config set enabled=false where id');
          await c.query(`
            update event_private.operation_contact_config c
            set version=r.version,updated_by=r.updated_by,updated_at=r.updated_at
            from jsonb_populate_record(null::event_private.operation_contact_config,$1::jsonb) r where c.id
          `, [JSON.stringify(original.config)]);
          await c.query(`
            update event_private.operation_contacts c set email=r.email,whatsapp=r.whatsapp
            from jsonb_populate_recordset(null::event_private.operation_contacts,$1::jsonb) r where c.role=r.role
          `, [JSON.stringify(original.contacts)]);
          await c.query('delete from event_private.operation_signoffs where proposal_id=$1', [proposalId]);
          await c.query('delete from public.event_reservations where opportunity_id=$1', [opportunity]);
          await c.query('delete from public.event_handoffs where opportunity_id=$1', [opportunity]);
          await c.query('delete from public.propostas where id=$1', [proposalId]);
          await c.query('delete from public.oportunidades where id=$1', [opportunity]);
          await c.query('update event_private.operation_contact_config set enabled=$1 where id', [original.config.enabled]);
          assert.deepEqual(await readConfiguration(), original, 'Restore all original contact/config values, including timestamps');
        });
      } catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) {
      throw new AggregateError(failure ? [failure, ...cleanupErrors] : cleanupErrors, 'Operational signoff concurrency cleanup failed');
    }
  }
  if (failure) throw failure;
  console.log('PASS concurrent private contact CAS: one commit and one PT409');
  console.log('PASS concurrent operational signature retries: one immutable signature');
  console.log('PASS reservation invalidation and authenticated handoff planning share H -> G lock order');
};
