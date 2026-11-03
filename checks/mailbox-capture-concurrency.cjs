const assert=require('node:assert/strict');
module.exports=async function(c,connect,name){
 const original=(await c.query('select to_jsonb(s) value from event_private.mailbox_sync_state s where singleton')).rows[0].value;
 const channel=(await c.query("select enabled,expected_account from event_private.channel_credentials where provider='mailbox'")).rows[0];
 const a=await connect(name),b=await connect(name);let pending;
 try{
  await c.query("update event_private.channel_credentials set enabled=true,expected_account='eventos@embaixadacarioca.com.br' where provider='mailbox'");
  await c.query("update event_private.mailbox_sync_state set enabled=true,account_id='123',mailbox='eventos@embaixadacarioca.com.br',activated_at_ms=floor(extract(epoch from clock_timestamp())*1000)-60000,watermark_ms=floor(extract(epoch from clock_timestamp())*1000)-30000,version=777,capture_send_ids=array[gen_random_uuid()],capture_started_at=clock_timestamp()-interval '1 second',capture_expires_at=clock_timestamp()+interval '2 seconds',capture_message_limit=1 where singleton");
  const start=(await c.query('select watermark_ms,capture_expires_at from event_private.mailbox_sync_state')).rows[0];
  const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
  await a.query('begin');await a.query('select pg_advisory_xact_lock(716612)');
  pending=b.query('select public.event_mailbox_commit_bound(777,$1,$2,$2,$3)',['123',start.watermark_ms,'[]']).then(()=>({ok:true}),error=>({ok:false,code:error.message}));
  let waiting=false;for(let i=0;i<20;i++){waiting=(await c.query("select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) waiting",[pid])).rows[0].waiting;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(waiting,true,'Commit must really wait behind the advisory lock');
  const timing=(await c.query('select query_start<$2::timestamptz before_expiry from pg_stat_activity where pid=$1',[pid,start.capture_expires_at])).rows[0];assert.equal(timing.before_expiry,true,'Request started before expiry');
  await new Promise(r=>setTimeout(r,2300));await a.query('commit');
  const result=await pending;assert.equal(result.ok,false,'Expired waiter must not persist');assert.match(result.code,/mailbox_disabled|capture_expired/);
  assert.equal((await c.query('select version from event_private.mailbox_sync_state')).rows[0].version,'777','Expired waiter preserves cursor');
 }finally{
  await a.query('rollback').catch(()=>{});if(pending)await pending;await Promise.all([a.end(),b.end()]);
  await c.query("update event_private.channel_credentials set enabled=$1,expected_account=$2 where provider='mailbox'",[channel.enabled,channel.expected_account]);
  await c.query(`update event_private.mailbox_sync_state s set enabled=o.enabled,account_id=o.account_id,mailbox=o.mailbox,activated_at_ms=o.activated_at_ms,watermark_ms=o.watermark_ms,version=o.version,capture_send_ids=o.capture_send_ids,capture_started_at=o.capture_started_at,capture_expires_at=o.capture_expires_at,capture_message_limit=o.capture_message_limit from jsonb_populate_record(null::event_private.mailbox_sync_state,$1::jsonb) o where s.singleton`,[JSON.stringify(original)]);
 }
 console.log('PASS bounded mailbox expiry after actual lock wait, with cursor preserved');
};
