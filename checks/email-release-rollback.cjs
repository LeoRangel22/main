const assert=require('node:assert/strict');
module.exports=async(c,sql)=>{
 const digest=async table=>(await c.query('select md5(coalesce(string_agg(to_jsonb(t)::text,\'|\' order by to_jsonb(t)::text),\'\')) hash from '+table+' t')).rows[0].hash;
 const before=await Promise.all(['public.propostas','public.oportunidades','public.event_messages','public.event_reservations','event_private.lead_alert_receipts'].map(digest));
 await c.query('begin');
 try{
  await c.query("update event_private.lead_alert_policy set enabled=true,started_at=now() where id");
  for(const file of ['supabase/rollback/lead_alert_idempotency.sql','supabase/rollback/lead_alert_idempotency.sql','supabase/rollback/approved_signal_followup.sql'])await c.query(sql(file).replace(/^begin;\s*$/gm,'').replace(/^commit;\s*$/gm,''));
  assert.equal((await c.query('select enabled from event_private.lead_alert_policy')).rows[0].enabled,false);
  assert.equal((await c.query("select to_regprocedure('event_private.plan_approved_signal_followup()') f")).rows[0].f,null);
  assert.deepEqual(await Promise.all(['public.propostas','public.oportunidades','public.event_messages','public.event_reservations','event_private.lead_alert_receipts'].map(digest)),before);
  console.log('PASS email release rollback pauses alert transport and removes followup projection without altering plans, owners, history, reservations or receipts');
 }finally{await c.query('rollback');}
};
