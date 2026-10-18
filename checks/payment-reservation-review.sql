-- Disposable, rollback-only regression fixtures. Never run against production.
begin;
do $$
declare manager uuid; seller uuid; finance uuid; actor uuid; opp uuid; p public.propostas;
 result jsonb; replay jsonb; blocked boolean;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not has_function_privilege('anon','event_private.payment_review_required(public.propostas)','execute');
 assert not has_function_privilege('authenticated','event_private.payment_review_required(public.propostas)','execute');
 assert not has_function_privilege('anon','public.prepare_event_payment_request(uuid,bigint,text)','execute');
 assert not has_function_privilege('anon','public.confirm_event_reservation(uuid,bigint)','execute');
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Reduced deposit review fixture','proposta_pronta') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Reduced deposit review fixture','proposta_pronta','ready',true,'2099-12-01','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-12-01","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"paymentTerms":["30% na reserva","70% antes do evento"]}') returning * into p;
 foreach actor in array array[seller,finance,manager] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',(select email from auth.users where id=actor),'role','authenticated')::text,true);
  set local role authenticated;
  blocked:=false;
  begin perform prepare_event_payment_request(p.id,p.revision,'sinal');
  exception when insufficient_privilege then blocked:=sqlerrm like 'Sinal abaixo de 50% exige%';end;
  assert blocked,'Reduced pre-payment reference cannot stand in for a manager exception';
  reset role;
 end loop;
 assert not exists(select 1 from event_private.payment_requests where proposal_id=p.id),'Rejected requests have no side effects';
 -- Old unsafe references remain in history but are no longer offered to a client.
 insert into event_private.payment_requests(proposal_id,fingerprint,purpose,amount,created_by)
 values(p.id,event_private.public_proposal_fingerprint(p),'sinal',336,seller);
 set local role anon;
 result:=get_public_event_payment_requests(p.public_token);
 assert result->'requests'='[]'::jsonb,'Legacy reduced-deposit reference is hidden';
 select snapshot->'paymentSummary' into result from get_public_proposal(p.public_token);
 assert result->'depositApprovalRequired'='true'::jsonb and result->>'depositDueAmount' is null;
 reset role;
 -- The existing manager path still records a real, explicitly confirmed receipt.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'sinal',336,
  (now() at time zone 'America/Sao_Paulo')::date,'Fixture Bank','reduced-deposit-real-fixture',true,'Condição excepcional aprovada nesta fixture');
 select * into p from propostas where id=p.id;
 assert p.snapshot#>>'{pagamentoSinal,excecaoAutorizadaPor}'=manager::text;
 result:=prepare_event_payment_request(p.id,p.revision,'saldo');
 assert (result->>'amount')::numeric=784;
 replay:=prepare_event_payment_request(p.id,p.revision,'saldo');
 assert result->>'id'=replay->>'id','Ordinary idempotency is preserved';
 reset role;
 result:=event_private.public_payment_summary(p);
 assert result->'signalAudited'='true'::jsonb and result->'depositApprovalRequired'='false'::jsonb;
 assert result->'paymentReviewRequired'='false'::jsonb;
end $$;

do $$
declare manager uuid; seller uuid; finance uuid; actor uuid; opp uuid; p public.propostas;
 result jsonb; blocked boolean; signal jsonb;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 signal:=jsonb_build_object('valor',560,'validacaoPendente',false,'validadoPor',manager,'validadoEm',now());
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Unaudited balance fixture','confirmado') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Unaudited balance fixture','confirmado','ready',true,'2099-12-02','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-12-02","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}'::jsonb
 ||jsonb_build_object('pagamentoSinal',signal,'pagamentoRestante',jsonb_build_object('valor',280,'data','2026-10-17'))) returning * into p;
 insert into event_private.payment_requests(proposal_id,fingerprint,purpose,amount,created_by)
 values(p.id,event_private.public_proposal_fingerprint(p),'saldo',560,seller);
 result:=event_private.public_payment_summary(p);
 assert result->'signalAudited'='true'::jsonb and result->'paymentReviewRequired'='true'::jsonb;
 assert (result->>'paidAmount')::numeric=560,'Unreviewed balance is not an audited receipt';
 set local role anon;
 select snapshot->'paymentSummary' into result from get_public_proposal(p.public_token);
 assert result->'paymentReviewRequired'='true'::jsonb;
 result:=get_public_event_payment_requests(p.public_token);
 assert result->'requests'='[]'::jsonb,'No existing reference solicits a duplicate payment while the balance is reviewed';
 reset role;
 foreach actor in array array[seller,finance] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',(select email from auth.users where id=actor),'role','authenticated')::text,true);
  set local role authenticated;
  blocked:=false;
  begin perform prepare_event_payment_request(p.id,p.revision,'saldo');
  exception when raise_exception then blocked:=sqlerrm like 'Há pagamento informado sem auditoria.%';end;
  assert blocked,'Both Events and Finance must reconcile the legacy balance first';
  reset role;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',
  jsonb_set(p.snapshot,'{pagamentoRestante}',p.snapshot->'pagamentoRestante'||'{"bankConferido":true}')),p.revision,null);
 result:=prepare_event_payment_request(p.id,p.revision,'saldo');
 assert (result->>'amount')::numeric=280,'Reconciled balance reduces the outstanding amount';
 reset role;
 result:=event_private.public_payment_summary(p);
 assert result->'paymentReviewRequired'='false'::jsonb and (result->>'paidAmount')::numeric=840;
 set local role anon;
 result:=get_public_event_payment_requests(p.public_token);
 assert jsonb_array_length(result->'requests')=1 and (result#>>'{requests,0,amount}')::numeric=280;
 reset role;
end $$;

do $$
declare manager uuid; seller uuid; finance uuid; opp uuid; p public.propostas; signal jsonb; invalid_payment jsonb;
 result jsonb; blocked boolean; before_row public.event_reservations; after_row public.event_reservations; message_count integer;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 signal:=jsonb_build_object('valor',560,'validacaoPendente',false,'validadoPor',finance,'validadoEm',now());
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Canonical reservation audit fixture','confirmado') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Canonical reservation audit fixture','confirmado','ready',true,'2099-12-03','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-12-03","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}'::jsonb
 ||jsonb_build_object('pagamentoSinal',signal)) returning * into p;
 delete from event_reservations where opportunity_id=opp;
 select count(*) into message_count from event_messages where opportunity_id=opp;
 for invalid_payment in select value from jsonb_array_elements(jsonb_build_array(
  signal-'valor',signal||'{"valor":null}',signal||'{"valor":"560"}',signal||'{"valor":0}',
  signal-'validacaoPendente',signal||'{"validacaoPendente":null}',signal||'{"validacaoPendente":"false"}',
  signal||'{"validacaoPendente":true}',signal||'{"validadoEm":"not-a-date"}',signal||'{"validadoEm":"-infinity"}',signal-'validadoEm',
  signal||jsonb_build_object('validadoEm',now()+interval '2 days'),
  signal||jsonb_build_object('validadoPor',gen_random_uuid()),signal||jsonb_build_object('validadoPor',seller)
 )) loop
  perform set_config('request.jwt.claims','',true);
  update propostas set snapshot=jsonb_set(snapshot,'{pagamentoSinal}',invalid_payment) where id=p.id returning * into p;
  assert event_private.audited_payment(p)=false;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
  set local role authenticated;
  blocked:=false;
  begin perform confirm_event_reservation(p.id,p.revision);
  exception when raise_exception then blocked:=sqlerrm='Confira o crédito e registre a validação auditada do sinal antes de reservar.';end;
  assert blocked,'Reservation must use the canonical payment predicate for every invalid audit shape';
  reset role;
  assert not exists(select 1 from event_reservations where opportunity_id=opp);
  assert (select count(*) from event_messages where opportunity_id=opp)=message_count;
 end loop;
 perform set_config('request.jwt.claims','',true);
 update propostas set snapshot=jsonb_set(snapshot,'{pagamentoSinal}',signal) where id=p.id returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 result:=confirm_event_reservation(p.id,p.revision);
 assert result->'already_confirmed'='false'::jsonb;
 assert result#>>'{reservation,confirmed_by}'=seller::text;
 reset role;
 -- Age only the disposable fixture so a same-transaction retry can detect re-stamping.
 alter table event_reservations disable trigger stamp_reservation_agreement;
 update event_reservations set confirmed_at=now()-interval '1 day' where opportunity_id=opp;
 alter table event_reservations enable trigger stamp_reservation_agreement;
 select * into before_row from event_reservations where opportunity_id=opp;
 select count(*) into message_count from event_messages where opportunity_id=opp;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 result:=confirm_event_reservation(p.id,p.revision);
 assert result->'already_confirmed'='true'::jsonb;
 reset role;
 select * into after_row from event_reservations where opportunity_id=opp;
 assert (after_row.confirmed_by,after_row.confirmed_at,after_row.agreement_fingerprint)
  is not distinct from (before_row.confirmed_by,before_row.confirmed_at,before_row.agreement_fingerprint),
  'An unchanged retry by another coordinator preserves the original person and time';
 assert (select count(*) from event_messages where opportunity_id=opp)=message_count,'An unchanged retry adds no audit note';
 -- Unrelated maintenance or attempted audit-field replacement cannot replace prior evidence.
 perform set_config('request.jwt.claims','',true);
 update event_reservations set updated_at=now(),confirmed_by=manager,confirmed_at=now() where opportunity_id=opp returning * into after_row;
 assert after_row.confirmed_by=before_row.confirmed_by and after_row.confirmed_at=before_row.confirmed_at;
 -- A materially changed reservation still requires fresh evidence and is not an idempotent retry.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 update event_reservations set ends_at=ends_at+interval '1 hour' where opportunity_id=opp returning * into after_row;
 assert after_row.confirmed_by=manager and after_row.confirmed_at=now();
 set local role authenticated;
 result:=confirm_event_reservation(p.id,p.revision);
 assert result->'already_confirmed'='false'::jsonb;
 reset role;
 assert (select ends_at=before_row.ends_at from event_reservations where opportunity_id=opp);
 assert (select count(*) from event_messages where opportunity_id=opp)=message_count+1;
 update event_reservations set status='released' where opportunity_id=opp returning * into after_row;
 assert after_row.confirmed_by is null and after_row.confirmed_at is null and after_row.agreement_fingerprint is null;
end $$;

-- Accepted amendments must not provide a weaker route into a confirmed reservation.
do $$
declare manager uuid; seller uuid; finance uuid; opp uuid; p public.propostas; d public.propostas;
 signal jsonb; remaining jsonb; a jsonb; aid uuid; client_token uuid; accepted jsonb; result jsonb;
 before_base jsonb; before_draft jsonb; before_reservation jsonb; before_handoff jsonb; before_tasks jsonb;
 before_messages bigint; before_outbox bigint; blocked boolean; i integer; base_day date;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not has_function_privilege('anon','public.apply_event_amendment(uuid,bigint,bigint,text)','execute');
 for i in 1..6 loop
  perform set_config('request.jwt.claims','',true);
  base_day:=date '2101-01-01'+i*3;
  signal:=jsonb_build_object('valor',560,'validacaoPendente',false,'validadoPor',finance,'validadoEm',now());
  remaining:=null;
  if i=1 then signal:=signal||jsonb_build_object('validadoEm',now()+interval '2 days');end if;
  if i=2 then signal:=signal||'{"validadoEm":"invalid-timestamp"}';end if;
  if i=3 then signal:=signal-'validacaoPendente';end if;
  if i>=4 then remaining:=jsonb_build_object('valor',280,'validacaoPendente',false,'validadoPor',finance,'validadoEm',now());end if;
  if i=4 then remaining:=remaining||jsonb_build_object('validadoPor',seller,'bankConferido',true);end if;
  if i=5 then remaining:=remaining||jsonb_build_object('validadoEm',now()+interval '2 days');end if;
  insert into oportunidades(cliente_nome,status,data_evento)
  values('Amendment audit review fixture '||i,'confirmado',base_day) returning id into opp;
  insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
  values(opp,'Amendment audit review fixture '||i,'confirmado','ready',true,base_day,'10:00',20,2,1000,120,1120,
   jsonb_build_object('event',jsonb_build_object('date',base_day,'time','10:00','guests',20,'duration',2),
    'totals',jsonb_build_object('subtotal',1000,'serviceFee',120,'total',1120),
    'selectedItems',jsonb_build_array(jsonb_build_object('nome','Fixture','calc',jsonb_build_object('total',1000))),
    'pagamentoSinal',signal,'pagamentoRestante',remaining)) returning * into p;
  insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
  values(opp,p.cliente_nome,'negociacao','draft',false,base_day+1,'11:00',25,2,1000,120,1120,
   (p.snapshot-'pagamentoSinal'-'pagamentoRestante')||jsonb_build_object('amendmentOf',jsonb_build_object('id',p.id,'revision',p.revision),
    'event',jsonb_build_object('date',base_day+1,'time','11:00','guests',25,'duration',2))) returning * into d;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
  set local role authenticated;
  a:=request_event_amendment(d.id,d.revision,'Revisão sintética de data e quantidade de convidados.');aid:=(a->>'id')::uuid;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
  set local role authenticated;
  perform decide_event_amendment(aid,'approve','pending_manager','Revisão sintética do gestor.');
  reset role;
  select x.client_token into client_token from event_private.event_amendments x where id=aid;
  perform set_config('request.jwt.claims','',true);
  set local role anon;
  a:=get_public_event_amendment(client_token);
  perform respond_public_event_amendment(client_token,a->>'hash','accept','Cliente da fixture','',gen_random_uuid());
  reset role;
  select to_jsonb(x) into accepted from event_private.event_amendments x where id=aid;
  select to_jsonb(x) into before_base from propostas x where id=p.id;
  select to_jsonb(x) into before_draft from propostas x where id=d.id;
  select to_jsonb(x) into before_reservation from event_reservations x where opportunity_id=opp;
  select to_jsonb(x) into before_handoff from event_handoffs x where opportunity_id=opp;
  select jsonb_agg(to_jsonb(x) order by id) into before_tasks from event_handoff_tasks x where opportunity_id=opp;
  select count(*) into before_messages from event_messages where opportunity_id=opp;
  select count(*) into before_outbox from event_outbox;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
  set local role authenticated;
  if i<6 then
   blocked:=false;
   begin perform apply_event_amendment(aid,p.revision,d.revision,'');
   exception when raise_exception then blocked:=sqlerrm='Financeiro deve registrar validação bancária auditada dos pagamentos antes de aplicar o aditivo';end;
   assert blocked,'Future/invalid signal or unauthorized remaining-payment audit cannot be transferred through an amendment';
   reset role;
   assert (select to_jsonb(x)=before_base from propostas x where id=p.id),'Rejected application preserves the entire base agreement';
   assert (select to_jsonb(x)=before_draft from propostas x where id=d.id),'Rejected application preserves the entire draft';
   assert (select to_jsonb(x)=before_reservation from event_reservations x where opportunity_id=opp),'Rejected application preserves reservation evidence';
   assert (select to_jsonb(x)=before_handoff from event_handoffs x where opportunity_id=opp);
   assert (select jsonb_agg(to_jsonb(x) order by id)=before_tasks from event_handoff_tasks x where opportunity_id=opp);
   assert (select to_jsonb(x)=accepted from event_private.event_amendments x where id=aid),'Acceptance is retained for explicit financial reconciliation';
   assert (select count(*) from event_messages where opportunity_id=opp)=before_messages;
   assert (select count(*) from event_outbox)=before_outbox;
   assert not exists(select 1 from event_private.proposal_public_baseline where proposal_id=d.id);
   assert not exists(select 1 from event_private.amendment_apply_context);
  else
   result:=apply_event_amendment(aid,p.revision,d.revision,'');
   assert result->>'status'='applied','Audited Finance signal and remaining payment still transfer normally';
   reset role;
   select * into d from propostas where id=d.id;
   assert event_private.audited_payment(d) and event_private.audited_payment(d,'pagamentoRestante');
   assert d.snapshot->'pagamentoRestante'=remaining and d.snapshot->'pagamentoSinal'=signal,'Applying never invents a new receipt audit';
  end if;
 end loop;
end $$;
rollback;
