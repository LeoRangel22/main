-- Entirely disposable evidence. No HTTP, provider sends or production writes.
begin;
do $$
declare manager uuid; opp uuid; p public.propostas; h public.event_handoffs; t public.event_handoff_tasks; ready jsonb; blocked boolean;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 assert not has_function_privilege('anon','public.event_operation_readiness(uuid,bigint)','execute');
 assert not has_function_privilege('authenticated','public.event_journey_evidence_v1(uuid,bigint)','execute');
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Release legacy fixture','confirmado') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Release legacy fixture','confirmado','ready',true,'2099-11-23','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-11-23","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"pagamentoSinal":{"valor":560,"data":"2026-10-17"}}') returning * into p;
 delete from event_reservations where opportunity_id=opp;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 select * into h from event_handoffs where opportunity_id=opp;
 for t in select * from event_handoff_tasks where opportunity_id=opp order by sort_order loop
  perform plan_event_handoff_task(t.id,h.version,t.updated_at,'Synthetic responsible',coalesce(t.due_at,now()),t.notes);
 end loop;
 for t in select * from event_handoff_tasks where opportunity_id=opp and task_key<>'gerencia_go_no_go' order by sort_order loop
  perform update_event_handoff_task(t.id,'done',null,null,'Synthetic prerequisite',h.version);
 end loop;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='gerencia_go_no_go';
 ready:=event_operation_readiness(p.id,p.revision);
 assert ready->'signal_audited'='false' and ready->'reservation_audited'='false';
 blocked:=false;begin perform update_event_handoff_task(t.id,'done',null,null,'Must fail for legacy',h.version);exception when others then blocked:=true;end;
 assert blocked,'No missing-pending-flag bypass even when all prerequisites have genuine stamps';
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{pagamentoSinal}',p.snapshot->'pagamentoSinal'||'{"bankConferido":true}')),p.revision,null);
 ready:=event_operation_readiness(p.id,p.revision);
 assert ready->'signal_audited'='true' and ready->'ready'='false','Payment validation alone never proves reservation';
 perform confirm_event_reservation(p.id,p.revision);
 select * into h from event_handoffs where opportunity_id=opp;
 if h.changes_pending then perform acknowledge_event_handoff_changes(opp,h.version);end if;
 for t in select * from event_handoff_tasks where opportunity_id=opp and task_key<>'gerencia_go_no_go' order by sort_order loop
  perform update_event_handoff_task(t.id,'done',null,null,'Reviewed current prerequisites',h.version);
 end loop;
 reset role;
 insert into event_private.production_plans(opportunity_id,proposal_id,agreement_fingerprint,data,reviewed_by,reviewed_at,updated_by)
 values(p.oportunidade_id,p.id,event_private.proposal_fingerprint(p),jsonb_build_object('rows','[]'::jsonb,'crew','[]'::jsonb,'stock_checked_at',now(),'logistics',jsonb_build_object('setup',0,'teardown',0)),manager,now(),manager);
 set local role authenticated;
 ready:=event_operation_readiness(p.id,p.revision);assert ready->'ready'='true',ready::text;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='gerencia_go_no_go';
 perform update_event_handoff_task(t.id,'done',null,null,'Audited synthetic release',h.version);
 assert exists(select 1 from event_handoff_tasks where id=t.id and status='done');
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='bar_bebidas';
 perform update_event_handoff_task(t.id,'blocked',null,null,'Supplier must confirm the delivery',h.version);
 assert exists(select 1 from event_handoff_tasks where opportunity_id=opp and task_key='gerencia_go_no_go' and status='pending');
 assert event_operation_readiness(p.id,p.revision)->'ready'='false';
 reset role;
end $$;
rollback;
