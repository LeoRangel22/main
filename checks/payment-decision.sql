begin;
do $$
declare manager uuid; seller uuid; finance uuid; opp uuid; p public.propostas; charge jsonb; replay jsonb; result jsonb; first_key uuid:=gen_random_uuid(); blocked boolean; before_revision bigint;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not has_function_privilege('anon','public.record_event_bank_payment(uuid,bigint,uuid,text,numeric,date,text,text,boolean,text)','execute');
 assert not has_function_privilege('anon','event_private.public_payment_summary(public.propostas)','execute');
 assert not has_table_privilege('authenticated','event_private.payment_operations','select');
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Payment reference fixture','proposta_pronta') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Payment reference fixture','proposta_pronta','ready',true,'2099-11-29','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-11-29","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 charge:=prepare_event_payment_request(p.id,p.revision,'sinal');replay:=prepare_event_payment_request(p.id,p.revision,'sinal');assert charge->>'id'=replay->>'id' and (charge->>'amount')::numeric=560;
 result:=record_event_bank_payment(p.id,p.revision,first_key,'sinal',560,current_date,'Fixture Bank','fixture-transfer-1',true,'');
 replay:=record_event_bank_payment(p.id,p.revision,first_key,'sinal',560,current_date,'Fixture Bank','fixture-transfer-1',true,'');assert replay->'existing'='true';
 select * into p from propostas where id=p.id;before_revision:=p.revision;
 assert p.status='confirmado' and p.snapshot#>>'{pagamentoSinal,validadoPor}'=seller::text;
 blocked:=false;begin perform record_event_bank_payment(p.id,p.revision,first_key,'sinal',561,current_date,'Fixture Bank','fixture-transfer-1',true,'');exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
 blocked:=false;begin perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'sinal',560,current_date,'Fixture Bank','fixture-transfer-1',true,'');exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
 blocked:=false;begin perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'saldo',280,current_date,'Fixture Bank','fixture-transfer-2',true,'');exception when insufficient_privilege then blocked:=true;end;assert blocked;
 charge:=prepare_event_payment_request(p.id,p.revision,'saldo');assert (charge->>'amount')::numeric=560;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'saldo',280,current_date,'Fixture Bank','fixture-transfer-2',true,'');select * into p from propostas where id=p.id;
 assert (p.snapshot#>>'{pagamentoRestante,valor}')::numeric=280;
 perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'saldo',280,current_date,'Fixture Bank','fixture-transfer-3',true,'');select * into p from propostas where id=p.id;
 result:=event_payment_history(p.id,p.revision);assert (result->>'paid')::numeric=1120 and (result->>'due')::numeric=0 and jsonb_array_length(result->'operations')=3;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);set local role authenticated;
 blocked:=false;begin perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'estorno',1,current_date,'Fixture Bank','fixture-refund-denied',true,'Attempt without cancellation');exception when others then blocked:=true;end;assert blocked;
 select * into p from save_event_proposal(p.id,'{"status":"cancelado"}',p.revision,null);
 perform record_event_bank_payment(p.id,p.revision,gen_random_uuid(),'estorno',1120,current_date,'Fixture Bank','fixture-refund-1',true,'Devolução integral da fixture cancelada');select * into p from propostas where id=p.id;
 result:=event_payment_history(p.id,p.revision);assert (result->>'paid')::numeric=0 and (result->>'due')::numeric=0 and jsonb_array_length(result->'operations')=4;
 reset role;
end $$;
rollback;
