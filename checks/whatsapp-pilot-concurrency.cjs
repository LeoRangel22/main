const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async(c,sql,connect,name,actor)=>{
 await c.query("update auth.users set email_confirmed_at=now(),banned_until=null where id=$1",[actor]);
 const clients=await Promise.all([connect(name),connect(name)]);
 const claims=JSON.stringify({sub:actor,email:'leorangel@gmail.com',role:'authenticated'});
 const grants='grant execute on function public.get_event_whatsapp_pilot(uuid), public.claim_event_whatsapp_pilot(uuid) to authenticated';
 const insert=async()=>{const id=randomUUID();await c.query("insert into event_private.whatsapp_pilots(id,owner_id,destination,body,content_hash,approval_reference,expires_at,enabled) values($1,$2,'5521000000001','Synthetic isolated fixture',repeat('a',64),'fixture:concurrency',now()+interval '10 minutes',true)",[id,actor]);return id;};
 try{
  await Promise.all(clients.map(async x=>{await x.query('set role authenticated');await x.query("select set_config('request.jwt.claims',$1,false)",[claims]);}));
  const id=await insert();
  const results=await Promise.all(clients.map(x=>x.query('select claim_event_whatsapp_pilot($1) r',[id])));
  assert.equal(results.filter(r=>r.rows[0].r.claimed).length,1);
  assert.equal(Number((await c.query('select attempts from event_private.whatsapp_pilots where id=$1',[id])).rows[0].attempts),1);
  await c.query(sql('docs/single-whatsapp-pilot-rollback.sql'));
  await c.query("select finish_event_whatsapp_pilot($1,'refused',null,false)",[id]);
  assert.equal((await c.query('select status from event_private.whatsapp_pilots where id=$1',[id])).rows[0].status,'refused');
  console.log('PASS native pilot concurrent claim once, rollback preserves claim and service-only completion');
  await c.query(grants);
  const next=await insert();
  await c.query('begin');await c.query("select pg_advisory_xact_lock(hashtextextended('events-single-whatsapp-pilot',0))");
  const waiter=(await clients[0].query('select pg_backend_pid()')).rows[0].pg_backend_pid;
  const blocker=(await c.query('select pg_backend_pid()')).rows[0].pg_backend_pid;
  const pending=clients[0].query('select claim_event_whatsapp_pilot($1) r',[next]).then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
  // Observe the actual advisory-lock wait instead of assuming a race occurred.
  let waiting=false;const deadline=Date.now()+3000;
  while(Date.now()<deadline){waiting=(await c.query('select $2::int=any(pg_blocking_pids($1::int)) waiting',[waiter,blocker])).rows[0].waiting;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(waiting,true,'Claim did not enter the competing rollback lock');
  await c.query('update event_private.whatsapp_pilots set enabled=false where id=$1',[next]);
  await c.query('revoke all on function public.get_event_whatsapp_pilot(uuid),public.claim_event_whatsapp_pilot(uuid) from authenticated');
  await c.query('commit');
  const resolved=await pending;
  assert.ok(resolved.status==='rejected'&&resolved.reason.code==='42501'||resolved.status==='fulfilled'&&resolved.value.rows[0].r.claimed===false);
  assert.equal(Number((await c.query('select attempts from event_private.whatsapp_pilots where id=$1',[next])).rows[0].attempts),0);
  await c.query(grants);
  console.log('PASS native pilot rollback prevents a waiting/new claim without resetting history');
 }finally{await c.query('rollback');await c.query('update event_private.whatsapp_pilots set enabled=false where enabled');await c.query(grants);await Promise.all(clients.map(x=>x.end()));}
};
