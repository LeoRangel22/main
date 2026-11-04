const assert=require('node:assert/strict');
module.exports=async function({create,apply,connect,migrationFiles,admin}){

 async function previewCommitRace(){
  const raceName='events_reply_preview_race_'+Date.now();let fixture,owner,worker;let transaction=false;
  try{
   fixture=await create(raceName);for(const f of migrationFiles)await apply(fixture,'supabase/migrations/'+f);
   await apply(fixture,'checks/neutral-reply-audit-fixture.sql');
   const review=(await fixture.query("select * from event_private.neutral_reply_reviews where state='prepared' order by created_at limit 1")).rows[0];
   const email=(await fixture.query('select email from auth.users where id=$1',[review.owner_id])).rows[0].email;
   owner=await connect(raceName);worker=await connect(raceName);
   await owner.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:review.owner_id,email,role:'authenticated'})]);
   await worker.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role'})]);await worker.query('set role service_role');
   const workerPid=(await worker.query('select pg_backend_pid() as pid')).rows[0].pid;
   const reply={...review.preview,state:'prepared',folderId:'1700000000000000002',contentRead:true,messageSent:false,captureActivated:false,persisted:false};
   await owner.query('begin');transaction=true;await owner.query('select singleton from event_private.mailbox_sync_state where singleton for update');
   const waiting=worker.query('select public.event_neutral_reply_store_preview($1,$2,$3::jsonb) as result',[review.id,review.owner_id,JSON.stringify(reply)]).then(r=>({ok:true,result:r.rows[0].result}),e=>({ok:false,error:e.message}));
   const deadline=Date.now()+5000;let blocked=false;
   while(Date.now()<deadline){const row=(await fixture.query('select wait_event_type from pg_stat_activity where pid=$1',[workerPid])).rows[0];if(row?.wait_event_type==='Lock'){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
   assert.equal(blocked,true,'preview must demonstrably wait behind the configuration lock');
   await owner.query('set local role authenticated');const commit=(await owner.query('select public.event_neutral_reply_commit($1,$2,true) as result',[review.id,review.preview_sha256])).rows[0].result;
   assert.equal(commit.state,'committed');await owner.query('commit');transaction=false;
   const late=await waiting,stored=(await fixture.query('select state,message_id from event_private.neutral_reply_reviews where id=$1',[review.id])).rows[0];
   console.log('PREVIEW_RACE_OBSERVED '+JSON.stringify({latePreviewAccepted:late.ok,state:stored.state}));
   assert.equal(late.ok,false,'late preview must reject after concurrent commit, observed state='+stored.state);
   assert.match(late.error,/neutral_reply_review_unavailable/);assert.equal(stored.state,'committed');assert.equal(stored.message_id,commit.messageId);
   const status=(await owner.query('select public.event_neutral_reply_status($1) as result',[review.id])).rows[0].result;
   assert.equal(status.state,'committed');assert.equal(status.captureActive,false);
   assert.equal(Number((await fixture.query("select count(*) from public.event_messages where proposal_id=$1 and direction='inbound'",[review.proposal_id])).rows[0].count),1);
   console.log('PASS delayed preview cannot downgrade committed audit state or create a second incoming message');
  }finally{if(transaction&&owner)await owner.query('rollback');if(worker)await worker.end();if(owner)await owner.end();if(fixture)await fixture.end();await admin.query('drop database '+raceName);}
 }
 await previewCommitRace();

 const name='events_reply_audit_'+Date.now();let c;const connections=[];
 try{
  c=await create(name);
  for(const f of migrationFiles)await apply(c,'supabase/migrations/'+f);
  await apply(c,'checks/neutral-reply-audit-fixture.sql');
  const reviews=(await c.query("select id,owner_id,preview_sha256,proposal_id from event_private.neutral_reply_reviews where state='prepared' order by created_at")).rows;
  assert.equal(reviews.length,2);
  const actor=reviews[0].owner_id,email=(await c.query('select email from auth.users where id=$1',[actor])).rows[0].email;
  const writers=await Promise.all([connect(name),connect(name)]);connections.push(...writers);
  for(const w of writers){await w.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,email,role:'authenticated'})]);await w.query('set role authenticated');}
  const blocker=await connect(name);connections.push(blocker);await blocker.query('begin');await blocker.query('select singleton from event_private.mailbox_sync_state where singleton for update');
  await assert.rejects(()=>writers[0].query('select public.event_neutral_reply_commit($1,$2,true)',[reviews[0].id,reviews[0].preview_sha256]),e=>e.code==='55P03');
  await blocker.query('rollback');assert.equal(Number((await c.query("select count(*) from public.event_messages where proposal_id=$1 and direction='inbound'",[reviews[0].proposal_id])).rows[0].count),0);
  console.log('PASS existing lock contention stops within SQL lock budget without partial history');
  await blocker.query('begin');await blocker.query('select id from public.propostas where id=$1 for update',[reviews[0].proposal_id]);
  await assert.rejects(()=>writers[0].query('select public.event_neutral_reply_commit($1,$2,true)',[reviews[0].id,reviews[0].preview_sha256]),e=>e.code==='55P03');await blocker.query('rollback');
  assert.equal(Number((await c.query("select count(*) from public.event_messages where proposal_id=$1 and direction='inbound'",[reviews[0].proposal_id])).rows[0].count),0);
  console.log('PASS proposal lock prevents a revision edit from interleaving final validation and write');
  const results=await Promise.all(writers.map((w,i)=>w.query('select public.event_neutral_reply_commit($1,$2,true) as result',[reviews[i].id,reviews[i].preview_sha256])));
  assert.ok(results.every(x=>x.rows[0].result.state==='committed'));assert.equal(results.filter(x=>x.rows[0].result.duplicate===false).length,1);
  assert.equal(results[0].rows[0].result.messageId,results[1].rows[0].result.messageId);
  console.log('PASS concurrent reviewed confirmations commit exactly one incoming message');
  await c.end();c=await connect(name);
  const reload=(await c.query("select count(*)::int as count,min(body) as body,min(proposal_revision)::int as revision from public.event_messages where proposal_id=$1 and direction='inbound'",[reviews[0].proposal_id])).rows[0];
  assert.deepEqual(reload,{count:1,body:'Resposta sintética de teste',revision:1});
  assert.equal((await c.query("select bool_and(source='manual') as assisted from public.event_messages where proposal_id=$1 and direction='inbound'",[reviews[0].proposal_id])).rows[0].assisted,true);
  assert.equal(Number((await c.query("select count(*) from event_private.mailbox_bound_receipts where proposal_id=$1 and inbound_message_id='<reply@client.test>' and message_id=$2 and reason='owner_reviewed_provider_headers'",[reviews[0].proposal_id,results[0].rows[0].result.messageId])).rows[0].count),1);
  const seen=(await c.query("select public.event_mailbox_seen('[\"1700000000000000001\"]'::jsonb) as seen")).rows[0].seen;assert.deepEqual(seen,['1700000000000000001']);
  assert.equal(Number((await c.query("select count(*) from public.event_messages where proposal_id=$1 and direction='inbound' and external_id='mailbox:123456789:<reply@client.test>'",[reviews[0].proposal_id])).rows[0].count),1);
  for(let i=0;i<writers.length;i++){const status=(await writers[i].query('select public.event_neutral_reply_status($1) as result',[reviews[i].id])).rows[0].result;assert.equal(status.state,'committed');assert.equal(status.messageId,results[0].rows[0].result.messageId);assert.equal(status.captureActive,false);}
  console.log('PASS committed history and duplicate readback persist after reconnect; both gates remain OFF');
  await c.query('begin');
  await c.query('drop function public.event_neutral_reply_status(uuid),public.event_neutral_reply_commit(uuid,text,boolean),public.event_neutral_reply_store_preview(uuid,uuid,jsonb),public.event_neutral_reply_worker_context(uuid,uuid),public.event_neutral_reply_begin(uuid,text,text,text,boolean),event_private.neutral_reply_context(uuid,uuid)');
  assert.equal(Number((await c.query("select count(*) from event_private.neutral_reply_reviews where state='committed'")).rows[0].count),1);
  assert.equal(Number((await c.query("select count(*) from public.event_messages where proposal_id=$1 and direction='inbound'",[reviews[0].proposal_id])).rows[0].count),1);
  assert.equal((await c.query("select has_table_privilege('authenticated','event_private.neutral_reply_reviews','select') as allowed")).rows[0].allowed,false);
  await c.query('rollback');console.log('PASS rollback removes operator code while preserving private audit and incoming history');
 }finally{for(const x of connections)await x.end();if(c)await c.end();await admin.query('drop database '+name);}

};
