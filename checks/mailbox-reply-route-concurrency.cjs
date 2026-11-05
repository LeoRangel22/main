// Real lock contention, exclusively in the disposable local database harness.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async function(c,connect,name){
 if(!['events_test','events_upgrade'].includes(name)||!['127.0.0.1','localhost','postgres'].includes(c.connectionParameters.host))throw Error('LOCAL_FIXTURE_REQUIRED');
 const a=await connect(name),b=await connect(name),account='99220501',mailbox='eventos@embaixadacarioca.com.br',sender='route-race@example.test';
 const before=(await c.query('select to_jsonb(s) as s from event_private.mailbox_sync_state s where singleton')).rows[0].s;
 const channel=(await c.query("select enabled,expected_account from event_private.channel_credentials where provider='mailbox'")).rows[0];
 let p,o,send1,send2,r,received=Date.now()-60000,provider=String(Date.now())+'902',inbound='<'+randomUUID()+'@example.test>';
 const settled=p=>p.then(value=>({ok:true,value}),error=>({ok:false,error}));
 async function blocked(pid){
  const end=Date.now()+5000;while(Date.now()<end){const q=await c.query("select wait_event_type='Lock' as blocked from pg_stat_activity where pid=$1",[pid]);if(q.rows[0]?.blocked)return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('REAL_LOCK_WAIT_NOT_OBSERVED');
 }
 const prepare=(client)=>client.query('select public.event_email_reply_route_prepare($1,$2,$3,$4) as r',[p,1,sender,'a'.repeat(64)]);
 const bind=(client,id)=>client.query('select public.event_email_reply_route_bind($1,$2,1,$3,$4,$5) as r',[r.id,id,'a'.repeat(64),'c'.repeat(64),'Route race fixture']);
 let pending;
 try{
  // These are disposable fixture identities, never a connection to the real Auth service.
  let actor,claims;
  for(const principal of (await c.query('select id,email from auth.users order by id')).rows){
   const candidate=JSON.stringify({sub:principal.id,email:principal.email,role:'authenticated'});
   await c.query("select set_config('request.jwt.claims',$1,false)",[candidate]);
   if((await c.query('select public.is_super_admin() as allowed')).rows[0].allowed===true){actor=principal.id;claims=candidate;break;}
  }
  assert.ok(actor,'Synthetic harness owner required');
  for(const client of [c,a,b])await client.query("select set_config('request.jwt.claims',$1,false)",[claims]);
  o=(await c.query("insert into public.oportunidades(cliente_nome,cliente_email,data_evento,status) values('Route race fixture',$1,'2099-12-01','proposta_pronta') returning id",[sender])).rows[0].id;
  p=(await c.query("insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,snapshot) values($1,'Route race fixture',$2,'proposta_pronta','ready','{}') returning id",[o,sender])).rows[0].id;
  await c.query("update event_private.mailbox_sync_state set enabled=false,account_id=$1,mailbox=$2,activated_at_ms=$3,watermark_ms=$3,capture_send_ids='{}',capture_started_at=null,capture_expires_at=null where singleton",[account,mailbox,received-3600000]);
  await a.query('begin');r=(await prepare(a)).rows[0].r;pending=settled(prepare(b));await blocked(b.processID);await a.query('commit');
  const same=await pending;pending=null;assert.equal(same.ok,true);assert.deepEqual(same.value.rows[0].r,r);
  assert.equal(Number((await c.query('select count(*) from event_private.mailbox_reply_routes where proposal_id=$1',[p])).rows[0].count),1);
  console.log('PASS reply route concurrent previews share exactly one immutable capability');
  for(let n=0;n<2;n++){const id=(await c.query("insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,approved_by,reviewed_revision) values($1,$2,$3,'email',$4,'Route race fixture','sending',$5,1) returning id",[p,o,randomUUID(),sender,actor])).rows[0].id;if(n===0)send1=id;else send2=id;}
  await a.query('begin');await bind(a,send1);pending=settled(bind(b,send2));await blocked(b.processID);await a.query('commit');
  const different=await pending;pending=null;assert.equal(different.ok,false);assert.match(different.error.message,/reply_route_bind_immutable/);
  assert.equal((await c.query('select send_id from event_private.mailbox_reply_routes where id=$1',[r.id])).rows[0].send_id,send1);
  console.log('PASS reply route concurrent bind cannot reassign the original send/attempt');
  await c.query("select public.finish_event_send($1,'accepted','opaque-synthetic-provider')",[send1]);
  await c.query("update event_private.channel_credentials set enabled=true,expected_account=$1 where provider='mailbox'",[mailbox]);
  await c.query("update event_private.mailbox_sync_state set enabled=true,capture_send_ids=array[$1::uuid],capture_started_at=clock_timestamp()-interval '1 minute',capture_expires_at=clock_timestamp()+interval '10 minutes',capture_message_limit=10 where singleton",[send1]);
  const binding=(await c.query("select public.event_mailbox_resolve_routed_binding($1,$2,$3,$4,'[]',$5::jsonb) as r",[account,mailbox,sender,inbound,JSON.stringify([r.reply_to])])).rows[0].r;
  assert.equal(binding.send_id,send1);
  const s=(await c.query('select version,watermark_ms from event_private.mailbox_sync_state where singleton')).rows[0];
  const event={key:inbound,message_id:inbound,kind:'inbound',channel:'email',destination:sender,body:'Synthetic concurrent reply',occurred_at:new Date(received).toISOString()};
  const item={provider_id:provider,received_at_ms:received,state:'prepared',inbound_message_id:inbound,sender,reply_candidates:[],reply_routes:[r.reply_to],binding,event};
  const commit=client=>client.query('select public.event_mailbox_commit_bound($1,$2,$3,$4,$5::jsonb)',[s.version,account,s.watermark_ms,received,JSON.stringify([item])]);
  await a.query('begin');await a.query('select pg_advisory_xact_lock(716612)');await a.query('update event_private.mailbox_reply_routes set revoked_at=clock_timestamp() where id=$1',[r.id]);
  pending=settled(commit(b));await blocked(b.processID);await a.query('commit');const revoked=await pending;pending=null;
  assert.equal(revoked.ok,false);assert.match(revoked.error.message,/binding_changed/);
  assert.equal((await c.query('select watermark_ms from event_private.mailbox_sync_state where singleton')).rows[0].watermark_ms,s.watermark_ms);
  assert.equal(Number((await c.query('select count(*) from event_private.mailbox_seen where account_id=$1 and provider_id=$2',[account,provider])).rows[0].count),0);
  console.log('PASS route revoked during real lock wait leaves body, seen marker and cursor uncommitted');
  await c.query('update event_private.mailbox_reply_routes set revoked_at=null where id=$1',[r.id]);
  await a.query('begin');await a.query('select pg_advisory_xact_lock(716612)');await a.query("update event_private.mailbox_reply_routes set expires_at=clock_timestamp()+interval '800 milliseconds' where id=$1",[r.id]);
  pending=settled(commit(b));await blocked(b.processID);await new Promise(resolve=>setTimeout(resolve,1000));await a.query('commit');const expired=await pending;pending=null;
  assert.equal(expired.ok,false);assert.match(expired.error.message,/binding_changed/);
  assert.equal(Number((await c.query('select count(*) from event_private.mailbox_seen where account_id=$1 and provider_id=$2',[account,provider])).rows[0].count),0);
  console.log('PASS route expiry is checked with wall clock after real lock contention');
  await c.query('update event_private.mailbox_reply_routes set expires_at=(select public_token_expires_at from public.propostas where id=$2) where id=$1',[r.id,p]);
  await commit(c);
  assert.equal(Number((await c.query("select count(*) from public.event_messages where proposal_id=$1 and direction='inbound'",[p])).rows[0].count),1);
  console.log('PASS explicit later capture persists one reply in its original route/revision');
 }finally{
  for(const client of [a,b])await client.query('rollback').catch(()=>{});
  if(pending)await pending;
  await a.end();await b.end();
  await c.query('begin');
  try{
   await c.query('select pg_advisory_xact_lock(716612)');
   if(p){await c.query('delete from event_private.mailbox_bound_receipts where proposal_id=$1',[p]);await c.query('delete from event_private.mailbox_reply_routes where proposal_id=$1',[p]);await c.query('delete from public.event_messages where proposal_id=$1',[p]);await c.query('delete from public.event_outbox where proposal_id=$1',[p]);await c.query('delete from public.propostas where id=$1',[p]);}
   if(o)await c.query('delete from public.oportunidades where id=$1',[o]);
   await c.query('delete from event_private.mailbox_seen where account_id=$1 and provider_id=$2',[account,provider]);
   await c.query("update event_private.channel_credentials set enabled=$1,expected_account=$2 where provider='mailbox'",[channel.enabled,channel.expected_account]);
   await c.query("update event_private.mailbox_sync_state s set enabled=x.enabled,account_id=x.account_id,mailbox=x.mailbox,activated_at_ms=x.activated_at_ms,watermark_ms=x.watermark_ms,version=x.version,last_success_at=x.last_success_at,capture_send_ids=x.capture_send_ids,capture_started_at=x.capture_started_at,capture_expires_at=x.capture_expires_at,capture_message_limit=x.capture_message_limit from jsonb_populate_record(null::event_private.mailbox_sync_state,$1::jsonb) x where s.singleton",[JSON.stringify(before)]);
   await c.query('commit');
  }catch(error){await c.query('rollback');throw error;}
 }
};
