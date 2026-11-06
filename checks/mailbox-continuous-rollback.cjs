const assert=require('node:assert/strict');
module.exports=async(c,sql)=>{
 const names=['event_mailbox_worker_config','event_mailbox_resolve_binding','event_mailbox_resolve_routed_binding','event_mailbox_commit_bound'];
 const identities=()=>c.query("select p.oid::text,n.nspname,p.proname,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[]) order by p.proname",[names]);
 const before=(await identities()).rows;
 await c.query('begin');try{
  await c.query("insert into event_private.mailbox_continuous_audit(action,version,details) values('rollback_fixture',0,'{\"preserve\":true}')");
  const count=(await c.query('select count(*)::int as n from event_private.mailbox_continuous_audit')).rows[0].n;
  await c.query(sql('supabase/rollback/continuous_mailbox_capture.sql'));
  assert.deepEqual((await identities()).rows,before,'Existing function identities and ACLs survive rollback');
  assert.equal((await c.query('select count(*)::int as n from event_private.mailbox_continuous_audit')).rows[0].n,count,'Audit history survives');
  assert.equal((await c.query("select has_function_privilege('authenticated','public.event_continuous_mailbox(text,bigint,uuid[],uuid,boolean)','execute') as allowed")).rows[0].allowed,false);
  assert.equal((await c.query('select bool_or(enabled) as enabled from event_private.mailbox_sync_state')).rows[0].enabled,false);
  await c.query('rollback');console.log('PASS continuous mailbox rollback keeps history, ACLs, existing function OIDs and OFF gates');
 }catch(e){await c.query('rollback');throw e;}
};
