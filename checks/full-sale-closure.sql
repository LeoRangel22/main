-- Isolated database only. No bank, mail, payment processor or production access.
begin;
do $$
declare seller_id uuid;finance_id uuid;opp uuid;p public.propostas;q public.propostas;
 decision record;request uuid:=gen_random_uuid();payment_key uuid:=gen_random_uuid();result jsonb;replay jsonb;blocked boolean;
begin
 select id into seller_id from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance_id from auth.users where email='financeiro@embaixadacarioca.com.br';
 perform set_config('request.jwt.claims','{}',true);
 insert into public.oportunidades(cliente_nome,cliente_email,status)
  values('Isolated full sale fixture','full-sale@example.test','proposta_enviada') returning id into opp;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,is_current,
  data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Isolated full sale fixture','full-sale@example.test','proposta_enviada','sent',true,
  '2099-12-25','09:00',30,1,1000,120,1120,
  '{"event":{"type":"Coffee Break","date":"2099-12-25","time":"09:00","guests":30,"duration":1},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Synthetic breakfast","calc":{"total":1000}}]}') returning * into p;
 insert into event_private.proposal_public_baseline values(p.id,event_private.public_proposal_fingerprint(p));
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select * into decision from public.respond_public_proposal_v2(p.public_token,'confirmar',request,p.id,p.revision,null,null,null,'Aceite de fixture isolada, sem compromisso real',null);
 assert decision.ok and decision.status='negociacao','Public acceptance is recorded without automatic booking';
 select * into decision from public.respond_public_proposal_v2(p.public_token,'confirmar',request,p.id,p.revision,null,null,null,'Aceite de fixture isolada, sem compromisso real',null);
 assert decision.ok,'Identical customer acceptance is idempotent';
 reset role;
 select * into q from public.propostas where id=p.id;
 assert q.revision=p.revision+1,'Acceptance increments the revision once';
 assert not exists(select 1 from public.event_reservations where opportunity_id=opp),'Customer acceptance alone reserves no capacity';
 assert q.snapshot->'pagamentoSinal' is null or q.snapshot->'pagamentoSinal'='null'::jsonb,'No payment is inferred';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller_id,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 result:=public.prepare_event_payment_request(q.id,q.revision,'sinal');
 replay:=public.prepare_event_payment_request(q.id,q.revision,'sinal');
 assert result->>'id'=replay->>'id' and (result->>'amount')::numeric=560,'One reference for the ordinary 50 percent deposit';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance_id,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 result:=public.record_event_bank_payment(q.id,q.revision,payment_key,'sinal',560,
  (now() at time zone 'America/Sao_Paulo')::date,'Fixture Bank','isolated-full-sale-deposit',true,'Synthetic fixture only');
 replay:=public.record_event_bank_payment(q.id,q.revision,payment_key,'sinal',560,
  (now() at time zone 'America/Sao_Paulo')::date,'Fixture Bank','isolated-full-sale-deposit',true,'Synthetic fixture only');
 assert replay->'existing'='true','The receipt is not credited twice';
 select * into q from public.propostas where id=p.id;
 assert q.status='confirmado' and q.snapshot#>>'{pagamentoSinal,validadoPor}'=finance_id::text,'A financial actor validates the synthetic deposit';
 result:=public.prepare_event_payment_request(q.id,q.revision,'saldo');assert (result->>'amount')::numeric=560;
 perform public.record_event_bank_payment(q.id,q.revision,gen_random_uuid(),'saldo',280,
  (now() at time zone 'America/Sao_Paulo')::date,'Fixture Bank','isolated-full-sale-balance-1',true,'Synthetic fixture only');
 select * into q from public.propostas where id=p.id;
 result:=public.event_payment_history(q.id,q.revision);
 assert (result->>'paid')::numeric=840 and (result->>'due')::numeric=280,'Partial balance preserves the remaining amount';
 blocked:=false;begin
  perform public.record_event_bank_payment(q.id,q.revision,gen_random_uuid(),'saldo',281,
   (now() at time zone 'America/Sao_Paulo')::date,'Fixture Bank','isolated-overpayment',true,'Synthetic fixture only');
 exception when others then blocked:=true;end;
 assert blocked,'Payment above the outstanding amount is rejected';
 perform public.record_event_bank_payment(q.id,q.revision,gen_random_uuid(),'saldo',280,
  (now() at time zone 'America/Sao_Paulo')::date,'Fixture Bank','isolated-full-sale-balance-2',true,'Synthetic fixture only');
 select * into q from public.propostas where id=p.id;
 result:=public.event_payment_history(q.id,q.revision);
 assert (result->>'paid')::numeric=1120 and (result->>'due')::numeric=0;
 assert jsonb_array_length(result->'operations')=3,'The final ledger has one deposit and two partial balance receipts';
 reset role;
 assert not exists(select 1 from public.event_outbox where proposal_id=p.id),'The isolated financial test sends no messages';
 assert (select count(*)=1 from public.propostas where oportunidade_id=opp),'Financial operations preserve proposal identity';
end $$;
rollback;
