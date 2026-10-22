-- Isolated DB upgrade snapshot; never reads a production database.
create temporary table bridge_health_before as select
 (select jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'account',expected_account,'sync',delivery_sync_ready) order by provider) from event_private.channel_credentials) channels,
 (select to_jsonb(s) from event_private.bot_bridge_state s where singleton) bridge,
 (select to_jsonb(s) from event_private.mailbox_sync_state s where singleton) mailbox,
 (select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j) jobs,
 (select jsonb_agg(jsonb_build_object('id',id,'status',status,'delivery',delivery_status,'provider',provider_id) order by id) from public.event_outbox) outbox,
 (select jsonb_agg(jsonb_build_object('id',id,'status',status,'revision',revision,'snapshot',snapshot) order by id) from public.propostas) proposals,
 (select jsonb_agg(jsonb_build_object('function',oid::regprocedure::text,'acl',proacl::text,'definer',prosecdef,'config',proconfig) order by oid)
  from pg_proc where oid in ('public.event_bot_bridge_commit(text,bigint,bigint,jsonb)'::regprocedure,'public.event_channel_diagnostics_status()'::regprocedure,'event_private.channel_diagnostics_snapshot()'::regprocedure)) acl;
