begin;
do $$
declare actor uuid; o uuid; p public.propostas; second_p public.propostas; amendment public.propostas; report jsonb;
 cohort_day date; first_at timestamptz; blocked boolean;
begin
 select id into actor from auth.users where email='leorangel@gmail.com';
 assert not has_table_privilege('authenticated','event_private.proposal_preparation_evidence','INSERT');
 assert not has_table_privilege('authenticated','event_private.proposal_preparation_evidence','UPDATE');
 assert not has_table_privilege('anon','event_private.proposal_preparation_evidence','SELECT');
 assert not has_function_privilege('authenticated','event_private.capture_proposal_preparation()','EXECUTE');
 assert not has_function_privilege('anon','public.event_sales_cohort(date,date,integer)','EXECUTE');
 perform set_config('request.jwt.claims','',true);
 -- A day-1 draft promoted after the decision window must never become a
 -- day-1 preparation in a matured cohort, even with a forged old sent_at.
 insert into oportunidades(cliente_nome,status,created_at,metadata)
 values('Preparation transition fixture','negociacao',now()-interval '210 days','{}') returning id into o;
 cohort_day:=((now()-interval '210 days') at time zone 'America/Sao_Paulo')::date;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,created_at,snapshot)
 values(o,'Preparation transition fixture','negociacao','draft',now()-interval '209 days','{}') returning * into p;
 assert not exists(select 1 from event_private.proposal_preparation_evidence where proposal_id=p.id);
 update propostas set publication_status='ready' where id=p.id;
 select observed_at into first_at from event_private.proposal_preparation_evidence where proposal_id=p.id;
 assert first_at>=statement_timestamp() and first_at>now()-interval '1 minute';
 update propostas set publication_status='sent',sent_at=now()-interval '208 days' where id=p.id;
 assert (select observed_at=first_at from event_private.proposal_preparation_evidence where proposal_id=p.id);
 update propostas set publication_status='draft' where id=p.id;
 update propostas set publication_status='ready' where id=p.id;
 assert (select observed_at=first_at from event_private.proposal_preparation_evidence where proposal_id=p.id), 'Repeated preparation must retain the first actual observation';
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,created_at,snapshot)
 values(o,'Preparation amendment fixture','negociacao','draft',false,now()-interval '209 days',jsonb_build_object('amendmentOf',jsonb_build_object('id',p.id))) returning * into amendment;
 update propostas set publication_status='ready' where id=amendment.id;
 assert not exists(select 1 from event_private.proposal_preparation_evidence where proposal_id=amendment.id), 'Amendments are not new commercial preparations';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 report:=event_sales_cohort(cohort_day,cohort_day,30);
 assert (report->>'total')::integer=1 and (report->>'mature')::integer=1;
 assert (report->>'prepared')::integer=0, 'Late preparation was incorrectly backdated to draft creation';
 -- Team clients cannot forge or move the server-owned observation.
 blocked:=false;
 begin update event_private.proposal_preparation_evidence set observed_at=now()-interval '209 days' where proposal_id=p.id;
 exception when insufficient_privilege then blocked:=true; end;
 assert blocked;
 reset role;
 perform set_config('request.jwt.claims','',true);
 -- Synthetic historical observations test window boundaries and deduplication.
 update event_private.proposal_preparation_evidence set observed_at=now()-interval '180 days' where proposal_id=p.id;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,created_at,snapshot)
 values(o,'Second prepared version','negociacao','ready',now()-interval '205 days','{}') returning * into second_p;
 update event_private.proposal_preparation_evidence set observed_at=now()-interval '205 days' where proposal_id=second_p.id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 report:=event_sales_cohort(cohort_day,cohort_day,30);
 assert (report->>'prepared')::integer=1, 'Multiple proposal versions must count once per opportunity';
 reset role;
 perform set_config('request.jwt.claims','',true);
 delete from event_private.proposal_preparation_evidence where proposal_id=second_p.id;
 update propostas set publication_status='ready' where id=second_p.id;
 assert not exists(select 1 from event_private.proposal_preparation_evidence where proposal_id=second_p.id), 'An unchanged legacy ready row must not invent a preparation';
 update event_private.proposal_preparation_evidence set observed_at=now()-interval '210 days' - interval '1 second' where proposal_id=p.id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 report:=event_sales_cohort(cohort_day,cohort_day,30);
 assert (report->>'prepared')::integer=0, 'Observations before opportunity entry do not belong to the cohort';
 reset role;
end $$;
rollback;
