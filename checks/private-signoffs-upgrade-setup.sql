-- Disposable test database only: preserve installed business evidence and access.
create temporary table signoffs_upgrade_before as select
 (select jsonb_agg(to_jsonb(p) order by id) from public.propostas p) proposals,
 (select jsonb_agg(to_jsonb(h) order by opportunity_id) from public.event_handoffs h) handoffs,
 (select jsonb_agg(to_jsonb(t) order by id) from public.event_handoff_tasks t) tasks,
 (select jsonb_agg(to_jsonb(r) order by opportunity_id) from public.event_reservations r) reservations,
 (select jsonb_agg(to_jsonb(o) order by id) from public.event_outbox o) outbox,
 (select jsonb_agg(jsonb_build_object('id',id,'email',email,'phone',to_jsonb(u)->'phone') order by id) from auth.users u) identities,
 (select jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'account',expected_account,'sync',delivery_sync_ready) order by provider) from event_private.channel_credentials) channels,
 (select to_jsonb(s) from event_private.bot_bridge_state s where singleton) bridge,
 (select to_jsonb(s) from event_private.mailbox_sync_state s where singleton) mailbox,
 (select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j) jobs,
 (select jsonb_agg(jsonb_build_object('oid',oid,'acl',proacl::text,'definer',prosecdef,'config',proconfig,'definition',pg_get_functiondef(oid)) order by oid)
  from pg_proc where pronamespace='public'::regnamespace and prokind='f') public_functions;
