create temporary table gerencia_upgrade_before as select
 (select jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')) functions,
 (select jsonb_agg(to_jsonb(p) order by id) from public.propostas p) proposals,
 (select jsonb_agg(to_jsonb(p) order by id) from public.oportunidades p) opportunities,
 (select jsonb_agg(to_jsonb(p) order by id) from public.event_outbox p) outbox,
 (select jsonb_agg(to_jsonb(p) order by id) from auth.users p) accounts,
 (select to_jsonb(c) from event_private.operation_contact_config c where id) config;
