'use strict';
const assert=require('node:assert/strict');
module.exports=async function reconcile(c,sql,migrations){
 // Called only by the runner that rejects remote hosts and creates disposable DBs.
 const migration=migrations.find(f=>f.endsWith('_cohort_amendment_evidence.sql'));
 const old=migrations.find(f=>f.endsWith('_cohort_preparation_review.sql'));
 assert.ok(migration&&old);
 await c.query('begin');
 try {
  await c.query(sql('checks/cohort-amendment-reconciliation-setup.sql'));
  const prior=sql('supabase/migrations/'+old);
  const start=prior.indexOf('with observations as ('),end=prior.indexOf('create or replace function public.event_sales_cohort',start);
  assert.ok(start>=0&&end>start);
  // Reproduce the real historical backfill, not a replacement implementation.
  await c.query(prior.slice(start,end));
  const count=(await c.query('select count(*) from event_private.proposal_preparation_evidence e join cohort_amendment_expected x on x.proposal_id=e.proposal_id')).rows[0].count;
  assert.equal(Number(count),5,'The fixture must reproduce both historical sources, including applied amendments');
  await c.query(sql('supabase/migrations/'+migration));
  await c.query(sql('supabase/migrations/'+migration));
  await c.query(sql('checks/cohort-amendment-reconciliation-assert.sql'));
  console.log('PASS applied-amendment historical backfill correction, two sources, idempotency and original agreement preservation');
 } finally {await c.query('rollback');}
};
