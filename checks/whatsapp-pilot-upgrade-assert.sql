do $$ declare b record; current_functions jsonb; begin
 select * into b from whatsapp_pilot_upgrade_before;
 if b.proposals is distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.propostas p)
  or b.opportunities is distinct from (select jsonb_agg(to_jsonb(o) order by id) from public.oportunidades o)
  or b.channels is distinct from (select jsonb_agg(to_jsonb(c) order by provider) from event_private.channel_credentials c)
  or b.bridge is distinct from (select to_jsonb(s) from event_private.bot_bridge_state s where singleton)
  or b.policy is distinct from (select to_jsonb(s) from event_private.proposal_approval_policy s where id)
  or b.jobs is distinct from (select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j) then raise exception 'Pilot changed business/channel/scheduler configuration'; end if;
 select jsonb_agg(jsonb_build_object('oid',p.oid,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) order by p.oid)
 into current_functions from pg_proc p where p.oid in (select (x->>'oid')::oid from jsonb_array_elements(b.functions) x);
 if b.functions is distinct from current_functions then raise exception 'Existing public RPC changed'; end if;
 if exists(select 1 from event_private.whatsapp_pilots) then raise exception 'Pilot installed active data'; end if;
 if has_function_privilege('anon','public.get_event_whatsapp_pilot(uuid)','execute')
  or has_function_privilege('anon','public.claim_event_whatsapp_pilot(uuid)','execute')
  or has_function_privilege('authenticated','public.finish_event_whatsapp_pilot(uuid,text,text,boolean)','execute')
  or has_table_privilege('authenticated','event_private.whatsapp_pilots','select,insert,update,delete')
  or has_table_privilege('service_role','event_private.whatsapp_pilots','select,insert,update,delete') then raise exception 'Pilot permissions broadened'; end if;
 if not (select relrowsecurity from pg_class where oid='event_private.whatsapp_pilots'::regclass) then raise exception 'Pilot RLS missing'; end if;
end; $$;
