do $$
begin
 assert (select value=(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.event_outbox b) from preparation_upgrade_evidence where key='outbox');
 assert (select value=(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.propostas p) from preparation_upgrade_evidence where key='proposal');
 assert (select value=(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.event_proposal_approvals a) from preparation_upgrade_evidence where key='approval');
 assert (select value=(select jsonb_build_object('oid',oid,'acl',proacl) from pg_proc where oid='public.begin_event_send(uuid,text,text,text,text,timestamptz)'::regprocedure) from preparation_upgrade_evidence where key='claim-function');
 assert (select value=(select to_jsonb(s) from event_private.bot_bridge_state s where singleton) from preparation_upgrade_evidence where key='bridge');
end; $$;
drop table preparation_upgrade_evidence;
