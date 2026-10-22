do $$ declare old bridge_health_before; after_value jsonb;
begin
 select * into old from bridge_health_before;
 assert old.channels is not distinct from (select jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'account',expected_account,'sync',delivery_sync_ready) order by provider) from event_private.channel_credentials),'Channel configuration is unchanged';
 assert old.bridge is not distinct from (select to_jsonb(s) from event_private.bot_bridge_state s where singleton),'Bridge scope, cursor, flags and prior health are unchanged';
 assert old.mailbox is not distinct from (select to_jsonb(s) from event_private.mailbox_sync_state s where singleton),'Mailbox configuration is unchanged';
 assert old.jobs is not distinct from (select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j),'No new or modified scheduler';
 assert old.outbox is not distinct from (select jsonb_agg(jsonb_build_object('id',id,'status',status,'delivery',delivery_status,'provider',provider_id) order by id) from public.event_outbox),'No send or historical status changed';
 assert old.proposals is not distinct from (select jsonb_agg(jsonb_build_object('id',id,'status',status,'revision',revision,'snapshot',snapshot) order by id) from public.propostas),'No business evidence changed';
 select jsonb_agg(jsonb_build_object('function',oid::regprocedure::text,'acl',proacl::text,'definer',prosecdef,'config',proconfig) order by oid)
  into after_value from pg_proc where oid in ('public.event_bot_bridge_commit(text,bigint,bigint,jsonb)'::regprocedure,'public.event_channel_diagnostics_status()'::regprocedure,'event_private.channel_diagnostics_snapshot()'::regprocedure);
 assert old.acl=after_value,'Existing execution privileges, definer and empty search path are preserved exactly';
 assert not exists(select 1 from event_private.bot_bridge_quarantine),'Install never backfills, replays or invents quarantine history';
 assert (select relrowsecurity from pg_class where oid='event_private.bot_bridge_quarantine'::regclass);
 assert not has_table_privilege('anon','event_private.bot_bridge_quarantine','select');
 assert not has_table_privilege('authenticated','event_private.bot_bridge_quarantine','select');
 assert not has_table_privilege('service_role','event_private.bot_bridge_quarantine','select');
end $$;
drop table bridge_health_before;
