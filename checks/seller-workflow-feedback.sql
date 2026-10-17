-- Synthetic fixtures, with real Postgres roles and trigger execution. No external sends.
begin;
do $$
declare seller uuid; finance uuid; opp uuid; p public.propostas; q public.propostas; blocked boolean; before_revision bigint;
begin
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not (select enabled from event_private.proposal_approval_policy where id),'Manager queue defaults off after owner policy change';
 assert not has_function_privilege('anon','event_private.journey_signal_operator()','execute');
 assert not has_function_privilege('authenticated','event_private.journey_signal_operator()','execute');
 q.subtotal:=10000;q.snapshot:='{"totals":{"adjustment":0,"privatizationAdjustment":-5000}}';
 perform event_private.check_discount(q);
 q.snapshot:='{"totals":{"adjustment":-2000,"privatizationAdjustment":0}}';
 blocked:=false;begin perform event_private.check_discount(q);exception when others then blocked:=true;end;
 assert blocked,'General commercial discount still needs manager exception';
 insert into oportunidades(cliente_nome,status,data_evento) values('Seller direct signal fixture','proposta_enviada','2099-11-18') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,snapshot)
 values(opp,'Seller direct signal fixture','proposta_enviada','sent',true,'2099-11-18','10:00',20,2,1000,120,0,1120,
 '{"event":{"type":"Coffee Break","date":"2099-11-18","time":"10:00","guests":20,"duration":2},"selectedItems":[{"nome":"Custom","descricao":"Standalone bespoke service","calc":{"total":1000}}],"totals":{"subtotal":1000,"serviceFee":120,"total":1120}}')
 returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 assert not (event_approval_policy()->>'enabled')::boolean;
 assert event_proposal_can_share(p.id,p.revision),'Ordinary reviewed proposal does not wait on manager';
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":560,"data":"2026-10-17","bancos":["Fixture"]}}','status','confirmado'),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'Proof or amount alone is not bank attestation';
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":560,"data":"2026-10-17","bancos":["Fixture"],"bankConferido":true,"validadoPor":"forged","validadoEmail":"forged@example.test"}}','status','confirmado'),p.revision,null);
 assert p.status='confirmado','Direct Sem resposta to Sinal does not require intermediate stages';
 assert p.snapshot#>>'{pagamentoSinal,validadoPor}'=seller::text,'Server stamps the real actor';
 assert p.snapshot#>>'{pagamentoSinal,validadoEmail}'='eventos@embaixadacarioca.com.br';
 assert p.snapshot#>>'{pagamentoSinal,validacaoPendente}'='false';
 reset role;
 assert (select count(*)=1 from event_reservations where proposal_id=p.id and status='confirmed');
 assert not exists(select 1 from event_outbox where proposal_id=p.id),'Stage change does not resend anything';
 set local role authenticated;
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{pagamentoSinal,valor}','600')),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'Seller cannot overwrite an already audited payment';
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoRestante":{"valor":560,"bankConferido":true}}'),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'Balance stays under Finance permission';
 before_revision:=p.revision;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"internalTestNote":"Signal retained"}'),p.revision,null);
 assert p.snapshot#>>'{pagamentoSinal,validadoPor}'=seller::text,'Ordinary edits retain the audited signal';
 blocked:=false;begin perform save_event_proposal(p.id,'{"status":"planejamento"}',before_revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'Stale writer cannot advance stages';
 reset role;
end; $$;
rollback;
