create temporary table whatsapp_pilot_upgrade_before as select
 (select jsonb_agg(to_jsonb(p) order by id) from public.propostas p) proposals,
 (select jsonb_agg(to_jsonb(o) order by id) from public.oportunidades o) opportunities,
 (select jsonb_agg(to_jsonb(c) order by provider) from event_private.channel_credentials c) channels,
 (select to_jsonb(b) from event_private.bot_bridge_state b where singleton) bridge,
 (select to_jsonb(p) from event_private.proposal_approval_policy p where id) policy,
 (select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j) jobs,
 (select jsonb_agg(jsonb_build_object('oid',oid,'acl',proacl::text,'definition',pg_get_functiondef(oid)) order by oid)
   from pg_proc where pronamespace='public'::regnamespace and prokind='f') functions;
