begin;
do $$
declare manager uuid; seller uuid; finance uuid; opp uuid; p public.propostas; h public.event_handoffs; t public.event_handoff_tasks; after_task public.event_handoff_tasks; blocked boolean;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not has_function_privilege('anon','public.plan_event_handoff_task(uuid,integer,timestamptz,text,timestamptz,text)','execute');
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Task owner fixture','confirmado') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Task owner fixture','confirmado','ready','2099-11-26','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-11-26","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"pagamentoSinal":{"valor":560,"data":"2026-10-17"}}') returning * into p;
 select * into h from event_handoffs where opportunity_id=opp;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='financeiro_saldo';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 after_task:=plan_event_handoff_task(t.id,h.version,t.updated_at,'Pessoa fixture',now()+interval '1 day',t.notes);
 assert after_task.responsible_name='Pessoa fixture' and after_task.acknowledged_at is null and after_task.completed_at is null and after_task.status='pending';
 blocked:=false;begin perform plan_event_handoff_task(t.id,h.version+1,after_task.updated_at,'Stale writer',now(),after_task.notes);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
 blocked:=false;begin perform update_event_handoff_task(t.id,'done',null,null,'Impersonating finance',h.version);exception when insufficient_privilege then blocked:=true;end;assert blocked;
 blocked:=false;begin perform plan_event_handoff_task(t.id,h.version,after_task.updated_at,'Pessoa fixture',now(),'Overwrite financial instructions');exception when insufficient_privilege then blocked:=true;end;assert blocked;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform plan_event_handoff_task(t.id,h.version,after_task.updated_at,'Not coordinator',now(),after_task.notes);exception when insufficient_privilege then blocked:=true;end;assert blocked;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='gerencia_go_no_go';
 blocked:=false;begin perform update_event_handoff_task(t.id,'done',null,null,'Finance cannot release',h.version);exception when insufficient_privilege then blocked:=true;end;assert blocked;
 reset role;
end $$;
rollback;
