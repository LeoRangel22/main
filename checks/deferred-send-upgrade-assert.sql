-- Assert that the migration only changes schema/contracts, not existing state.
do $$
declare item record;snapshot jsonb;fixture deferred_upgrade_fixture;prior event_private.bot_bridge_state;
begin
 for item in select * from deferred_upgrade_rows loop
  if item.relation_name='event_private.bot_bridge_state' then
   select coalesce(jsonb_agg(to_jsonb(t)-'scope_id' order by (to_jsonb(t)-'scope_id')::text),'[]'::jsonb) into snapshot from event_private.bot_bridge_state t;
  elsif item.relation_name='public.event_outbox' then
   select coalesce(jsonb_agg(to_jsonb(t)-'reviewed_revision'-'reviewed_fingerprint' order by (to_jsonb(t)-'reviewed_revision'-'reviewed_fingerprint')::text),'[]'::jsonb) into snapshot from public.event_outbox t;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %s t',item.relation_name) into snapshot;
  end if;
  assert snapshot=item.rows_before,'Migration rewrote existing rows: '||item.relation_name;
 end loop;
 assert not exists(select 1 from public.event_outbox where reviewed_revision is not null or reviewed_fingerprint is not null),'No historical send review evidence fabricated';
 assert not exists(select 1 from deferred_upgrade_functions old left join pg_proc p on p.oid=old.oid where p.oid is null or p.proacl is distinct from old.proacl or p.proowner<>old.proowner or p.prosecdef<>old.prosecdef),'Existing function privileges/ownership/security mode unchanged';
 assert not exists(select 1 from deferred_upgrade_tables old left join pg_class c on c.oid=old.oid where c.oid is null or c.relacl is distinct from old.relacl or c.relowner<>old.relowner or c.relrowsecurity<>old.relrowsecurity),'Existing table privileges/ownership/RLS unchanged';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists(select 1 from deferred_upgrade_functions old where old.oid=p.oid)),'No new public RPC surface';
 assert (select scope_id is null and enabled and cursor=42 from event_private.bot_bridge_state where singleton),'Legacy enabled state is preserved without inventing a scope';
 select * into fixture from deferred_upgrade_fixture;
 select * into prior from jsonb_populate_record(null::event_private.bot_bridge_state,fixture.bridge_before);
 -- Remove only synthetic setup rows and restore the prior test configuration.
 delete from event_approval_watch_alerts where approval_id=fixture.approval_id;
 delete from event_approval_notifications where approval_id=fixture.approval_id;
 delete from event_approval_audit where approval_id=fixture.approval_id;
 delete from event_proposal_approvals where id=fixture.approval_id;
 delete from event_outbox where proposal_id=fixture.proposal_id;
 delete from event_private.proposal_public_baseline where proposal_id=fixture.proposal_id;
 delete from propostas where id=fixture.proposal_id;
 delete from oportunidades where id=fixture.opportunity_id;
 update event_private.bot_bridge_state set enabled=prior.enabled,cursor=prior.cursor,diagnostic=prior.diagnostic,updated_at=prior.updated_at,last_success_at=prior.last_success_at where singleton;
end; $$;
drop table deferred_upgrade_fixture,deferred_upgrade_rows,deferred_upgrade_functions,deferred_upgrade_tables;
