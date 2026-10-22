// Real PostgreSQL sessions only. No provider requests, credentials or live data.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async function verifyBridgeLockOrder(c,connect,name,actor){
 const scope=randomUUID(),send=randomUUID(),provider='lock-fixture-'+randomUUID();
 const priorBridge=(await c.query('select to_jsonb(s) value from event_private.bot_bridge_state s where singleton')).rows[0].value;
 const priorChannel=(await c.query("select to_jsonb(c) value from event_private.channel_credentials c where provider='zapi'")).rows[0].value;
 const opp=(await c.query("insert into oportunidades(cliente_nome,status,data_evento) values('Bridge lock fixture','proposta_pronta','2099-11-19') returning id")).rows[0].id;
 const p=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,total,subtotal,taxa_servico,snapshot) values($1,'Bridge lock fixture','proposta_pronta','ready','2099-11-19',1120,1000,120,'{}') returning *",[opp])).rows[0];
 await c.query("insert into event_outbox(id,proposal_id,opportunity_id,fingerprint,channel,destination,body,status,provider_id,approved_by,reviewed_revision,reviewed_fingerprint) select $1::uuid,id,oportunidade_id,($1::uuid)::text,'whatsapp','5521000000001','Synthetic accepted content','accepted',$2,$3,revision,event_private.public_proposal_fingerprint(p) from propostas p where id=$4",[send,provider,actor,p.id]);
 await c.query('update event_private.bot_bridge_state set enabled=false,cursor=0,scope_id=$1 where singleton',[scope]);
 await c.query("select event_bot_bridge_activate('bot:embaixada_urca|'||$1,0)",[scope]);
 const bridge=await connect(name),reconcile=await connect(name);let pending;
 try{
  await bridge.query('begin');await reconcile.query('begin');
  await reconcile.query('select pg_advisory_xact_lock(716612)');
  const pid=(await bridge.query('select pg_backend_pid() pid')).rows[0].pid;
  const event={key:provider,channel:'whatsapp',kind:'status',message_id:provider,destination:'5521000000001',signal:'delivered',occurred_at:new Date().toISOString(),captured_at:new Date().toISOString(),send_id:send,context_id:p.id,revision:Number(p.revision),purpose:'event_proposal'};
  pending=bridge.query("select event_bot_bridge_commit('bot:embaixada_urca',0,1,$1)",[JSON.stringify({scope,events:[event]})]);
  // Attach immediately so an early server failure cannot become an unhandled rejection.
  const observed=pending.then(()=>({ok:true}),error=>({error}));
  let waiting=false;
  for(let i=0;i<100;i++){
   const state=(await c.query('select wait_event from pg_stat_activity where pid=$1',[pid])).rows[0];
   if(state?.wait_event==='advisory'){waiting=true;break;}
   await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(waiting,true,'Bridge waits on the common ingestion fence');
  await reconcile.query("set local lock_timeout='500ms'");
  // The old reversed order held this row while waiting for our advisory lock.
  await reconcile.query('select id from propostas where id=$1 for update',[p.id]);
  await reconcile.query('rollback');
  const result=await observed;if(result.error)throw result.error;
  assert.equal((await bridge.query('select cursor from event_private.bot_bridge_state where singleton')).rows[0].cursor,'1');
  console.log('PASS bridge and receipt reconciliation share advisory-before-row lock order');
 }finally{
  await reconcile.query('rollback').catch(()=>{});
  await pending?.catch(()=>{});
  await bridge.query('rollback').catch(()=>{});
  await Promise.all([bridge.end(),reconcile.end()]);
  await c.query('update event_private.bot_bridge_state set enabled=false,cursor=0,scope_id=$1 where singleton',[priorBridge.scope_id]);
  await c.query('update event_private.bot_bridge_state set enabled=$1,cursor=$2,last_success_at=$3,diagnostic=$4,updated_at=$5 where singleton',[priorBridge.enabled,priorBridge.cursor,priorBridge.last_success_at,priorBridge.diagnostic,priorBridge.updated_at]);
  await c.query("update event_private.channel_credentials set enabled=$1,expected_account=$2,updated_at=$3 where provider='zapi'",[priorChannel.enabled,priorChannel.expected_account,priorChannel.updated_at]);
  await c.query('delete from event_outbox where id=$1',[send]);await c.query('delete from propostas where id=$1',[p.id]);await c.query('delete from oportunidades where id=$1',[opp]);
 }
};
