-- Isolated upgrade evidence only. Never execute these fixtures on production.
create temporary table future_tariff_fixture(proposal_id uuid,opportunity_id uuid);
do $$ declare o uuid; p public.propostas;
begin
 perform set_config('request.jwt.claims','',false);
 insert into public.oportunidades(cliente_nome,status,data_evento) values('Tariff upgrade fixture','negociacao','2099-04-20') returning id into o;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,data_evento,snapshot)
 values(o,'Tariff upgrade fixture','tariff-upgrade@example.test','negociacao','ready','2099-04-20',
 '{"event":{"date":"2099-04-20","tariffApplication":{"schema":1,"kind":"confirmed","mode":"use_current_table","eventDate":"2099-04-20","validUntil":"2026-12-31","confirmedBy":"00000000-0000-0000-0000-000000000000","confirmedAt":"2026-01-01T00:00:00Z","basisHash":"pretend-server-proof"}},"prices":[],"privatizationRules":[],"selectedItems":[],"generalTerms":"VALIDADE: até 31/12/2026.","unknownHistory":{"preserve":true}}') returning * into p;
 insert into future_tariff_fixture values(p.id,o);
end $$;
create temporary table future_tariff_functions_before as
 select oid,pronamespace,proname,proacl,prosecdef,proconfig,pg_get_functiondef(oid) definition
 from pg_proc where pronamespace in ('public'::regnamespace,'event_private'::regnamespace) and prokind='f';
create temporary table future_tariff_relations_before as
 select oid,relacl,relrowsecurity from pg_class where relnamespace in ('public'::regnamespace,'event_private'::regnamespace);
create temporary table future_tariff_triggers_before as
 select oid,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal and tgrelid in ('public.propostas'::regclass,'public.event_outbox'::regclass);
create temporary table future_tariff_business_before as select
 (select jsonb_agg(to_jsonb(p) order by p.id) from public.propostas p) proposals,
 (select jsonb_agg(to_jsonb(o) order by o.id) from public.oportunidades o) opportunities,
 (select jsonb_agg(to_jsonb(b) order by b.id) from public.event_outbox b) outbox,
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.event_proposal_approvals a) approvals,
 (select jsonb_agg(to_jsonb(r) order by r.opportunity_id) from public.event_reservations r) reservations,
 (select jsonb_agg(to_jsonb(c) order by c.config_key) from public.commercial_settings c) catalogs,
 (select jsonb_agg(to_jsonb(c) order by c.id) from public.commercial_settings_history c) catalog_history,
 (select jsonb_agg(to_jsonb(c) order by c.provider) from event_private.channel_credentials c) channels,
 (select jsonb_agg(to_jsonb(j) order by j.jobid) from cron.job j) jobs;
