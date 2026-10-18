begin;
do $$
declare actor uuid; o uuid; o2 uuid; p public.propostas; b uuid; report jsonb; baseline bigint;
begin
 select id into actor from auth.users where email='leorangel@gmail.com';
 assert not has_function_privilege('anon','public.event_sales_cohort(date,date,integer)','execute');
 -- Pick a synthetic historical date outside the other fixture cohorts.
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status,created_at,metadata) values('Cohort mature fixture','negociacao',now()-interval '200 days','{}') returning id into o;
 insert into oportunidades(cliente_nome,status,created_at,metadata) values('Cohort test excluded','negociacao',now()-interval '200 days','{"is_test":true}') returning id into o2;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,created_at,snapshot)
 values(o,'Cohort fixture','negociacao','ready',now()-interval '199 days','{"pagamentoSinal":{"valor":100,"validacaoPendente":false,"validadoEm":"bad"}}') returning * into p;
 -- Synthetic preparation evidence belongs inside this fixture's window. The
 -- production trigger intentionally records today's transition, not created_at.
 update event_private.proposal_preparation_evidence set observed_at=now()-interval '199 days' where proposal_id=p.id;
 insert into event_outbox(opportunity_id,proposal_id,fingerprint,channel,destination,body,status,approved_by,created_at)
 values(o,p.id,'cohort-isolated','email','fixture@example.test','Fixture','accepted',actor,now()-interval '198 days') returning id into b;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 report:=event_sales_cohort(((now()-interval '200 days') at time zone 'America/Sao_Paulo')::date,((now()-interval '200 days') at time zone 'America/Sao_Paulo')::date,30);
 assert (report->>'total')::integer=1 and (report->>'mature')::integer=1;
 assert (report->>'prepared')::integer=1 and (report->>'dispatched')::integer=0 and (report->>'delivered')::integer=0 and (report->>'paid')::integer=0;
 reset role;
 update event_outbox set provider_id='cohort-fixture',delivery_status='delivered',delivery_updated_at=now()-interval '197 days' where id=b;
 set local role authenticated;
 report:=event_sales_cohort(((now()-interval '200 days') at time zone 'America/Sao_Paulo')::date,((now()-interval '200 days') at time zone 'America/Sao_Paulo')::date,30);
 assert (report->>'dispatched')::integer=1 and (report->>'delivered')::integer=1 and (report->>'conversion')::numeric=0;
 reset role;
end $$;
rollback;
