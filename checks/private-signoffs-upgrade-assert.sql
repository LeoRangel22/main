do $$ declare old signoffs_upgrade_before; fn jsonb;
begin
 select * into old from signoffs_upgrade_before;
 assert old.proposals is not distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.propostas p);
 assert old.handoffs is not distinct from (select jsonb_agg(to_jsonb(h) order by opportunity_id) from public.event_handoffs h);
 assert old.tasks is not distinct from (select jsonb_agg(to_jsonb(t) order by id) from public.event_handoff_tasks t);
 assert old.reservations is not distinct from (select jsonb_agg(to_jsonb(r) order by opportunity_id) from public.event_reservations r);
 assert old.outbox is not distinct from (select jsonb_agg(to_jsonb(o) order by id) from public.event_outbox o);
 assert old.identities is not distinct from (select jsonb_agg(jsonb_build_object('id',id,'email',email,'phone',to_jsonb(u)->'phone') order by id) from auth.users u);
 assert old.channels is not distinct from (select jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'account',expected_account,'sync',delivery_sync_ready) order by provider) from event_private.channel_credentials);
 assert old.bridge is not distinct from (select to_jsonb(s) from event_private.bot_bridge_state s where singleton);
 assert old.mailbox is not distinct from (select to_jsonb(s) from event_private.mailbox_sync_state s where singleton);
 assert old.jobs is not distinct from (select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j);
 for fn in select value from jsonb_array_elements(old.public_functions) loop
  assert fn=(select jsonb_build_object('oid',oid,'acl',proacl::text,'definer',prosecdef,'config',proconfig,'definition',pg_get_functiondef(oid)) from pg_proc where oid=(fn->>'oid')::oid),'Every pre-existing public function preserves its OID, definition and ACL';
 end loop;
 assert (select count(*)=1 and bool_and(version=0 and not enabled and updated_by is null) from event_private.operation_contact_config);
 assert (select count(*)=4 and bool_and(email is null and whatsapp is null) from event_private.operation_contacts);
 assert not exists(select 1 from event_private.operation_signoffs),'Installation must not create or backfill anyone’s agreement';
end $$;
drop table signoffs_upgrade_before;
