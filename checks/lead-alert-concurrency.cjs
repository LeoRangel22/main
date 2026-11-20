const assert=require('node:assert/strict');
module.exports=async function(c,connect,name){
 const prior=(await c.query('select * from event_private.lead_alert_policy')).rows[0];
 const writers=await Promise.all([connect(name),connect(name)]),ids=[];
 const insert=async(status='partial',age='0 minutes',createdAge='0 minutes')=>{
  const row=(await c.query("insert into public.solicitacoes_cotacao(cliente_nome,cliente_email,capture_status,updated_at,created_at,snapshot) values('Synthetic alert fixture','fixture@example.test',$1,now()-$2::interval,now()-$3::interval,'{}') returning id",[status,age,createdAge])).rows[0];ids.push(row.id);return row.id;
 };
 const claim=async(client,id)=>(await client.query('select public.event_claim_lead_alert($1) value',[id])).rows[0].value;
 try{
  assert.equal(prior.enabled,false,'Migration installs dormant');
  assert.equal((await c.query('select event_private.dispatch_due_lead_alerts() state')).rows[0].state,'paused');
  await c.query("update event_private.lead_alert_policy set enabled=true,started_at=clock_timestamp(),abandoned_after=interval '30 minutes' where id");
  assert.equal((await c.query('select event_private.dispatch_due_lead_alerts() state')).rows[0].state,'setup_pending','Absent Vault references cannot queue HTTP');
  const partial=await insert();assert.equal((await claim(c,partial)).code,'not_due');
  await c.query("update public.solicitacoes_cotacao set capture_status='complete' where id=$1",[partial]);
  const race=await Promise.all(writers.map(w=>claim(w,partial)));
  assert.equal(race.filter(r=>r.claimed).length,1);assert.equal(race.find(r=>r.claimed).kind,'complete');
  const first=race.find(r=>r.claimed);assert.equal(first.record.capture_token,undefined);
  assert.equal((await c.query("select public.event_finish_lead_alert($1,'accepted','fixture-provider') value",[first.claimId])).rows[0].value,true);
  assert.equal((await claim(c,partial)).code,'already_claimed');
  assert.equal((await c.query("select public.event_finish_lead_alert($1,'uncertain',null) value",[first.claimId])).rows[0].value,false,'Cannot overwrite persisted acceptance');
  console.log('PASS alert partial->complete and concurrent retry: one durable claim, no token, immutable outcome');

  const abandoned=await insert('partial','40 minutes');const a=await claim(c,abandoned);assert.equal(a.claimed,true);assert.equal(a.kind,'abandoned');
  await c.query("select public.event_finish_lead_alert($1,'uncertain',null)",[a.claimId]);assert.equal((await claim(c,abandoned)).code,'already_claimed');
  await c.query("update public.solicitacoes_cotacao set capture_status='complete' where id=$1",[abandoned]);
  assert.equal((await claim(c,abandoned)).kind,'complete');assert.equal((await claim(c,abandoned)).claimed,false);
  assert.equal(Number((await c.query('select count(*) from event_private.lead_alert_receipts where lead_id=$1',[abandoned])).rows[0].count),2);
  console.log('PASS abandoned-only after inactivity; uncertain transport never reclaims; later completion alerts once');

  const completing=await insert('partial','40 minutes');
  await writers[0].query('begin');await writers[0].query("update public.solicitacoes_cotacao set capture_status='complete' where id=$1",[completing]);
  const pending=claim(writers[1],completing);await new Promise(resolve=>setTimeout(resolve,30));await writers[0].query('commit');
  const completed=await pending;assert.equal(completed.kind,'complete');assert.equal(completed.record.capture_status,'complete');
  assert.equal(Number((await c.query("select count(*) from event_private.lead_alert_receipts where lead_id=$1 and kind='abandoned'",[completing])).rows[0].count),0);
  console.log('PASS abandoned scan racing committed completion rereads latest row under lock');

  const legacy=await insert('complete','0 minutes','1 day');assert.equal((await claim(c,legacy)).code,'out_of_scope');
  const active=await insert();const fresh=await insert('complete');const due=(await c.query('select public.event_due_lead_alerts() id')).rows.map(r=>r.id);
  assert.ok(due.includes(fresh));assert.ok(!due.includes(active)&&!due.includes(legacy)&&!due.includes(partial));assert.ok(due.length<=10);
  console.log('PASS bounded due scan excludes active partials, old history and previously claimed alerts');
  const inflight=await insert('partial','0 minutes','1 day');
  await c.query("update public.solicitacoes_cotacao set capture_status='complete',capture_completed_at=clock_timestamp() where id=$1",[inflight]);
  assert.equal((await claim(c,inflight)).kind,'complete','Old in-flight form completing after rollout is not lost');
  console.log('PASS completion after rollout is notified even when contact was captured earlier');

  for(const role of ['anon','authenticated']){
   await writers[0].query('set role '+role);
   await assert.rejects(()=>writers[0].query('select public.event_claim_lead_alert($1)',[fresh]),e=>e.code==='42501');
   await assert.rejects(()=>writers[0].query('select * from event_private.lead_alert_receipts'),e=>e.code==='42501');
   await writers[0].query('reset role');
  }
  await writers[0].query('set role service_role');assert.equal((await claim(writers[0],fresh)).kind,'complete');await writers[0].query('reset role');
  console.log('PASS alert RPC denied to public callers/team; service can claim without direct ledger access');
 }finally{
  await Promise.all(writers.map(async w=>{await w.query('rollback');await w.query('reset role');await w.end();}));
  await c.query('delete from event_private.lead_alert_receipts where lead_id=any($1::uuid[])',[ids]);
  await c.query('delete from public.solicitacoes_cotacao where id=any($1::uuid[])',[ids]);
  await c.query('update event_private.lead_alert_policy set enabled=$1,started_at=$2,abandoned_after=$3 where id',[prior.enabled,prior.started_at,prior.abandoned_after]);
 }
};
