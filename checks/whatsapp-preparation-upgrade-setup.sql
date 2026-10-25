-- Test database only. The migration must not rewrite a historical send or ACL.
create temporary table preparation_upgrade_evidence as
select 'outbox'::text key,coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') value from public.event_outbox b
union all select 'proposal',coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.propostas p
union all select 'approval',coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.event_proposal_approvals a
union all select 'claim-function',jsonb_build_object('oid',oid,'acl',proacl) from pg_proc where oid='public.begin_event_send(uuid,text,text,text,text,timestamptz)'::regprocedure
union all select 'bridge',to_jsonb(s) from event_private.bot_bridge_state s where singleton;
