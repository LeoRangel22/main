-- Isolated rollback-only regression/pilot. Never execute against a live project.
begin;
do $$
declare manager uuid; seller uuid; opp uuid; p public.propostas; step jsonb; result jsonb; old_revision bigint; blocked boolean;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 assert not has_function_privilege('authenticated','public.approve_event_discount(uuid)','execute'),'Unbound direct approval is private';
 assert not has_function_privilege('anon','public.approve_event_discount(uuid,bigint)','execute');
 assert not has_function_privilege('authenticated','event_private.proposal_exclusive(public.propostas)','execute');
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Integrated policy fixture','proposta_pronta') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Integrated policy fixture','proposta_pronta','ready',true,'2099-12-17','10:00',20,2,10000,1200,11200,
 '{"event":{"date":"2099-12-17","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":10000,"serviceFee":1200,"total":11200},"selectedItems":[{"nome":"Fixture","calc":{"total":10000}}]}') returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 result:=event_journey_evidence(p.id,p.revision);
 select s into step from jsonb_array_elements(result->'steps') s where s->>'key'='approval';
 assert step->>'state'='not_required' and step->'policy_required'='false' and step->'discount_required'='false';
 assert event_proposal_can_share(p.id,p.revision),'Evidence change must not restore a general manager gate';
 reset role;
 update event_private.proposal_approval_policy set enabled=true where id;
 set local role authenticated;
 result:=event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='pending' and s->'policy_required'='true' from jsonb_array_elements(result->'steps') s where s->>'key'='approval');
 reset role;
 update event_private.proposal_approval_policy set enabled=false where id;
 perform set_config('request.jwt.claims','',true);
 update propostas set snapshot=jsonb_set(snapshot,'{totals,adjustment}','-2000'),total=9200 where id=p.id returning * into p;
 old_revision:=p.revision;
 -- Concurrent change after a manager could have opened the old review.
 update propostas set snapshot=jsonb_set(snapshot,'{totals,adjustment}','-2100'),total=9100 where id=p.id returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform approve_event_discount(p.id,old_revision);exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked and not exists(select 1 from event_discount_approvals where proposal_id=p.id),'Changed revision cannot inherit the manager decision';
 result:=event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='pending' and s->'discount_required'='true' and s->>'discount_state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='approval');
 perform approve_event_discount(p.id,p.revision);
 result:=event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' and s->>'discount_state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='approval');
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform approve_event_discount(p.id,p.revision);exception when insufficient_privilege then blocked:=true;end;assert blocked;
 reset role;
end $$;

do $$
declare manager uuid; o uuid; o2 uuid; p public.propostas; q public.propostas; trial public.propostas; blocked boolean; r public.event_reservations; result jsonb;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 trial.snapshot:='{"totals":{"privatization":{"mode":"optional","baseAmount":6000}}}';trial.privatizacao:=0;
 assert event_private.proposal_exclusive(trial),'Waived price preserves agreed exclusivity';
 trial.snapshot:='{"privatizationChoice":"yes","totals":{"privatizationAdjustment":-9000,"privatization":{"mode":"optional","baseAmount":0}}}';
 assert not event_private.proposal_exclusive(trial),'Unbound choice or negative adjustment alone cannot create exclusivity';
 trial.snapshot:='{"totals":{"privatization":{"mode":"optional","baseAmount":"6000"}}}';
 assert not event_private.proposal_exclusive(trial),'Malformed base amount is not numeric evidence';
 trial.snapshot:='{"totals":{"privatization":{"mode":"optional"}}}';trial.privatizacao:=100;
 assert event_private.proposal_exclusive(trial),'Existing positive-price agreement remains compatible';
 trial.snapshot:='{"totals":{"privatization":{"mode":"required-full"}}}';trial.privatizacao:=0;assert event_private.proposal_exclusive(trial);
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Waived exclusive fixture','proposta_pronta') returning id into o;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,snapshot)
 values(o,'Waived exclusive fixture','proposta_pronta','ready',true,'2099-12-18','10:00',20,2,1000,120,0,1120,
 '{"event":{"date":"2099-12-18","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120,"privatization":{"mode":"optional","baseAmount":6000,"amount":0},"privatizationAdjustment":-6000},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning * into p;
 insert into oportunidades(cliente_nome,status) values('Overlapping nonexclusive fixture','proposta_pronta') returning id into o2;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(o2,'Overlapping nonexclusive fixture','proposta_pronta','ready',true,'2099-12-18','11:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-12-18","time":"11:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning * into q;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 perform hold_event_proposal(p.id,now()+interval '1 hour');
 assert (select exclusive from event_reservations where proposal_id=p.id);
 blocked:=false;begin perform hold_event_proposal(q.id,now()+interval '1 hour');exception when others then blocked:=true;end;assert blocked,'Waived exclusive hold blocks a second event';
 reset role;
 -- Simulate a previously persisted wrong flag without backfilling actual data.
 update event_reservations set exclusive=false where proposal_id=p.id;
 set local role authenticated;
 blocked:=false;begin perform hold_event_proposal(q.id,now()+interval '1 hour');exception when others then blocked:=true;end;assert blocked,'Old false flag cannot defeat current agreement exclusivity';
 reset role;
 update event_reservations set status='released' where proposal_id=p.id;
 set local role authenticated;
 perform hold_event_proposal(q.id,now()+interval '1 hour');
 blocked:=false;begin perform hold_event_proposal(p.id,now()+interval '1 hour');exception when others then blocked:=true;end;assert blocked,'Overlap is rejected in reverse insertion order too';
 reset role;
 update event_reservations set status='released' where proposal_id=q.id;
 -- Readiness surfaces a mismatched active record; it never silently repairs it.
 update event_reservations set status='confirmed',exclusive=false where proposal_id=p.id;
 set local role authenticated;
 result:=event_operation_readiness(p.id,p.revision);
 assert result->'reservation_audited'='false' and (result->'blockers')::text like '%exclusividade%';
 reset role;
 assert (select not exclusive from event_reservations where proposal_id=p.id),'Readiness is nonmutating';
end $$;

do $$
declare manager uuid; opp uuid; p public.propostas; h public.event_handoffs; result jsonb;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Completed historical fixture','confirmado') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Completed historical fixture','confirmado','sent',true,current_date-2,'10:00',20,2,1000,120,1120,
 '{"event":{},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"pagamentoSinal":{"valor":560}}') returning * into p;
 select * into h from event_handoffs where opportunity_id=opp;
 update event_handoff_tasks set status='done',responsible_name='Synthetic historical actor',acknowledged_by=manager,acknowledged_at=now()-interval '2 days',completed_by=manager,completed_at=now()-interval '2 days' where opportunity_id=opp;
 update propostas set status='pos_venda',snapshot=snapshot||jsonb_build_object('eventOutcome',jsonb_build_object('outcome','realizado','closedBy','leorangel@gmail.com','closedAt',now()-interval '1 day')) where id=p.id returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 result:=event_journey_evidence(p.id,p.revision);
 assert result#>'{readiness,ready}'='false','Historical execution never grants new operational release';
 assert (select s->>'state'='confirmed' and s->'historical'='true' from jsonb_array_elements(result->'steps') s where s->>'key'='operation'),'Realized outcome preserves stamped historical execution';
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='reservation'),'No reservation audit may be invented';
 reset role;
 perform set_config('request.jwt.claims','',true);
 update propostas set snapshot=jsonb_set(snapshot,'{eventOutcome,closedBy}','"unknown"') where id=p.id returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 result:=event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='operation'),'Unknown actor cannot restore historical confirmation';
 reset role;
end $$;

-- Full synthetic commercial pilot across the actual RPC/trigger boundaries.
do $$
declare manager uuid; seller uuid; form record; response record; opp uuid; p public.propostas;
 claim jsonb; retry jsonb; result jsonb; plan jsonb; h public.event_handoffs; t public.event_handoff_tasks;
 send_id uuid; payment_key uuid:=gen_random_uuid(); outbox_before bigint; line_id uuid:=gen_random_uuid();
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select count(*) into outbox_before from event_outbox;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select * into form from submit_public_quote_request(gen_random_uuid(),
  '{"cliente":{"nome":"Integrated full pilot fixture","email":"integrated-pilot@example.test","whatsapp":"21999990001"},"evento":{"tipo":"Coquetel","data":"2099-12-19","horario":"10:00","convidados":20,"duracao":2,"observacoes":"Synthetic test, never a real order"}}');
 opp:=form.opportunity_id;assert opp is not null and form.request_id is not null;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 perform plan_event_opportunities(array[opp],'eventos@embaixadacarioca.com.br','Revisar proposta da fixture',now()+interval '1 hour');
 assert (select responsavel_email='eventos@embaixadacarioca.com.br' and proxima_acao='Revisar proposta da fixture' from oportunidades where id=opp);
 select * into p from save_event_proposal(null,jsonb_build_object('oportunidade_id',opp,'solicitacao_id',form.request_id,'responsavel_id',seller,'responsavel_email','eventos@embaixadacarioca.com.br',
  'cliente_nome','Integrated full pilot fixture','cliente_email','integrated-pilot@example.test','cliente_whatsapp','21999990001','tipo_evento','Coquetel','data_evento','2099-12-19','horario_evento','10:00','convidados',20,'duracao',2,
  'subtotal',1000,'taxa_servico',120,'privatizacao',0,'total',1120,'status','proposta_pronta','publication_status','ready','is_current',true,
  'snapshot','{"client":{"name":"Integrated full pilot fixture","email":"integrated-pilot@example.test"},"event":{"type":"Coquetel","date":"2099-12-19","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Synthetic item","calc":{"total":1000}}],"generalTerms":"Synthetic isolated pilot"}'::jsonb),null,null);
 assert p.oportunidade_id=opp and p.solicitacao_id=form.request_id and event_proposal_can_share(p.id,p.revision);
 claim:=begin_event_send_reviewed(p.id,p.revision,'email','integrated-pilot@example.test','Synthetic reviewed proposal','Synthetic pilot',null);
 send_id:=(claim#>>'{send,id}')::uuid;
 retry:=begin_event_send_reviewed(p.id,p.revision,'email','integrated-pilot@example.test','Synthetic reviewed proposal','Synthetic pilot',null);
 assert (claim->>'claimed')::boolean and not (retry->>'claimed')::boolean;
 reset role;
 -- Simulated transport evidence only; no provider/network request is made.
 perform finish_event_send(send_id,'accepted','integrated-pilot-provider',null);
 select * into p from propostas where id=p.id;
 update event_private.channel_credentials set enabled=true,expected_account='synthetic-mailagent' where provider='zepto';
 perform ingest_event_provider_events('zepto',jsonb_build_array(jsonb_build_object('key','integrated-pilot-delivery','kind','status','channel','email','message_id','integrated-pilot-provider','destination','integrated-pilot@example.test','signal','delivered','occurred_at',now())));
 set local role authenticated;
 result:=event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='delivery');
 reset role;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select * into response from respond_public_proposal_v2(p.public_token,'confirmar',gen_random_uuid(),p.id,p.revision,null,null,null,'Synthetic client acceptance',null);
 assert response.ok;
 reset role;
 select * into p from propostas where id=p.id;
 assert not exists(select 1 from event_reservations where opportunity_id=opp and status='confirmed'),'Client acceptance never substitutes bank validation';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 result:=record_event_bank_payment(p.id,p.revision,payment_key,'sinal',560,(now() at time zone 'America/Sao_Paulo')::date,'Synthetic Bank','integrated-pilot-transfer',true,'');
 retry:=record_event_bank_payment(p.id,p.revision,payment_key,'sinal',560,(now() at time zone 'America/Sao_Paulo')::date,'Synthetic Bank','integrated-pilot-transfer',true,'');assert retry->'existing'='true';
 select * into p from propostas where id=p.id;
 assert p.status='confirmado' and (select status='confirmed' from event_reservations where opportunity_id=opp);
 result:=event_operation_readiness(p.id,p.revision);assert result->'ready'='false';
 plan:=jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',line_id,'item',0,'ingredient','Synthetic ingredient','sector','bar','unit','kg','basis','guest','quantity',0.1,'yield',100,'loss',0,'stock',10)),
  'crew','[]'::jsonb,'crew_reason','Synthetic fixture regular staffing reviewed.','stock_checked_at',now(),'logistics',jsonb_build_object('space','Synthetic space','setup',0,'teardown',0,'access','Synthetic access reviewed','tickets','Synthetic tickets reviewed','weather','Synthetic contingency reviewed','authorization','not_required','authorization_notes','Synthetic scope without external attraction'));
 result:=save_event_production_plan(p.id,p.revision,0,plan);perform review_event_production_plan(p.id,p.revision,(result->>'revision')::integer);
 select * into h from event_handoffs where opportunity_id=opp;
 if h.changes_pending then perform acknowledge_event_handoff_changes(opp,h.version);end if;
 for t in select * from event_handoff_tasks where opportunity_id=opp loop
  perform plan_event_handoff_task(t.id,h.version,t.updated_at,'Synthetic responsible person',coalesce(t.due_at,now()+interval '1 day'),t.notes);
 end loop;
 assert not exists(select 1 from event_handoff_tasks where opportunity_id=opp and acknowledged_at is not null),'Planning is not science or execution';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);set local role authenticated;
 for t in select * from event_handoff_tasks where opportunity_id=opp and task_key<>'gerencia_go_no_go' loop
  perform update_event_handoff_task(t.id,'done',null,null,'Synthetic completed prerequisite',h.version);
 end loop;
 result:=event_operation_readiness(p.id,p.revision);assert result->'ready'='true',result::text;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='gerencia_go_no_go';
 perform update_event_handoff_task(t.id,'done',null,null,'Synthetic explicit release',h.version);
 result:=event_journey_evidence(p.id,p.revision);
 assert (select bool_and(s->>'state'='confirmed') from jsonb_array_elements(result->'steps') s where s->>'key' in ('proposal','dispatch','delivery','reply','client_acceptance','payment','reservation','operation'));
 assert (select s->>'state'='not_required' from jsonb_array_elements(result->'steps') s where s->>'key'='approval');
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='outcome'),'Future fixture never claims real execution occurred';
 assert (select count(*)=outbox_before+1 from event_outbox),'Downstream payment/planning/actions never resend the proposal';
 reset role;
end $$;
rollback;
