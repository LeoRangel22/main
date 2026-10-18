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

-- Final review: a real accepted send establishes evidence on same-status legacy
-- records. Rejected/uncertain/incomplete transport outcomes do not establish it.
do $$
declare actor uuid; opp uuid; p public.propostas; b uuid; outcome text; before_evidence jsonb; proof event_private.proposal_preparation_evidence;
begin
 perform set_config('request.jwt.claims','',true);
 select id into actor from auth.users where email='leorangel@gmail.com';
 foreach outcome in array array['failed','uncertain','accepted_no_id','accepted'] loop
  insert into oportunidades(cliente_nome,status,created_at) values('Ongoing evidence fixture','negociacao',now()-interval '10 days') returning id into opp;
  insert into propostas(oportunidade_id,cliente_nome,status,publication_status,created_at,snapshot)
   values(opp,'Ongoing evidence fixture','negociacao','sent',now()-interval '9 days','{}') returning * into p;
  delete from event_private.proposal_preparation_evidence where proposal_id=p.id;
  update propostas set publication_status='sent',sent_at=now()-interval '8 days' where id=p.id;
  assert not exists(select 1 from event_private.proposal_preparation_evidence where proposal_id=p.id),'No transition and no transport evidence must remain unknown';
  insert into event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,approved_by)
   values(p.id,opp,gen_random_uuid()::text,'email','fixture@example.test','Controlled transport fixture','sending',actor) returning id into b;
  perform finish_event_send(b,case when outcome='accepted_no_id' then 'accepted' else outcome end,
   case when outcome<>'accepted_no_id' then 'fixture-provider-id' end,null);
  select * into proof from event_private.proposal_preparation_evidence where proposal_id=p.id;
  if outcome='accepted' then
   assert found and proof.source='accepted_send' and proof.source_id=b;
   assert proof.observed_at=(select occurred_at from event_messages where external_id='send:'||b::text and channel='email');
   assert proof.observed_at>=now()-interval '1 minute','New accepted evidence is not backdated to the old draft';
   before_evidence:=to_jsonb(proof);
   perform finish_event_send(b,'accepted','fixture-provider-id',null);
   update propostas set publication_status='sent' where id=p.id;
   assert (select to_jsonb(e)=before_evidence from event_private.proposal_preparation_evidence e where proposal_id=p.id),'Repeated result preserves the first exact observation';
  else
   assert not found,'Uncertain, rejected or missing-ID outcomes are not accepted preparation evidence';
  end if;
 end loop;
end $$;

-- Final review: unknown custom deposit terms must not expose a payment amount or
-- payment references. Verified payments still take precedence over custom text.
do $$
declare actor uuid; opp uuid; p public.propostas; term text; summary jsonb; blocked boolean;
begin
 perform set_config('request.jwt.claims','',true);
 select id into actor from auth.users where email='leorangel@gmail.com';
 foreach term in array array['Condição a combinar','Após confirmação da equipe','','0% na reserva','150% na reserva'] loop
  insert into oportunidades(cliente_nome,status) values('Custom deposit review fixture','negociacao') returning id into opp;
  insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,total,subtotal,taxa_servico,data_evento,horario_evento,convidados,duracao,snapshot)
   values(opp,'Custom deposit review fixture','negociacao','ready',true,1120,1000,120,'2099-11-18','10:00',20,2,
    jsonb_build_object('event',jsonb_build_object('date','2099-11-18','time','10:00','guests',20,'duration',2),'paymentTerms',jsonb_build_array(term),
     'totals',jsonb_build_object('total',1120,'subtotal',1000,'serviceFee',120),'selectedItems',jsonb_build_array(jsonb_build_object('nome','Fixture','calc',jsonb_build_object('total',1000))))) returning * into p;
  assert event_private.deposit_fraction(p) is null;
  summary:=event_private.public_payment_summary(p);
  assert summary->'depositApprovalRequired'='true' and summary->'depositDueAmount'='null','Unparseable terms must require a decision rather than unspecified payment';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
  set local role authenticated;
  blocked:=false;begin perform prepare_event_payment_request(p.id,p.revision,'sinal');exception when others then blocked:=true;end;
  assert blocked;
  reset role;
  perform set_config('request.jwt.claims','',true);
  assert not exists(select 1 from event_private.payment_requests where proposal_id=p.id),'No charge/reference was fabricated';
  -- Pure in-memory audited representation, not a claimed real receipt.
  p.snapshot:=p.snapshot||jsonb_build_object('pagamentoSinal',jsonb_build_object('valor',560,'validacaoPendente',false,'validadoPor',actor,'validadoEm',now()));
  summary:=event_private.public_payment_summary(p);
  assert summary->'signalAudited'='true' and summary->'depositApprovalRequired'='false' and summary->'depositDueAmount'='0';
 end loop;
end $$;
rollback;
