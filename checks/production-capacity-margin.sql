begin;
do $$
declare actor uuid; seller uuid; finance uuid; o uuid; other_o uuid; p public.propostas; other_p public.propostas; h public.event_handoffs; t public.event_handoff_tasks;
 data jsonb; result jsonb; plan_revision integer; line_id uuid:=gen_random_uuid(); blocked boolean; old_ack timestamptz;
begin
 select id into actor from auth.users where email='leorangel@gmail.com';select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not has_function_privilege('anon','public.get_event_production_plan(uuid,bigint)','execute');assert not has_table_privilege('authenticated','event_private.production_costs','select');
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Production fixture','confirmado') returning id into o;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(o,'Production fixture','confirmado','ready',true,'2099-11-30','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-11-30","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"pagamentoSinal":{"valor":560,"data":"2026-10-17"}}') returning * into p;
 data:=jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',line_id,'item',0,'ingredient','Limão','sector','bar','unit','kg','basis','guest','quantity',0.1,'yield',80,'loss',10,'stock',1)),
  'crew','[]'::jsonb,'crew_reason','Atendimento pela escala regular conferida para a fixture.','stock_checked_at',now(),
  'logistics',jsonb_build_object('space','Lounge fixture','setup',0,'teardown',0,'access','Fornecedores com acesso conferido.','tickets','Ingressos do grupo conferidos.','weather','Contingência de teleférico conferida.','authorization','not_required','authorization_notes','Escopo da fixture sem atração ou divulgação.'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 result:=save_event_production_plan(p.id,p.revision,0,data);plan_revision:=(result->>'revision')::integer;assert plan_revision=1;
 result:=get_event_production_plan(p.id,p.revision);assert result->'costs'='null' and result->'financial'='null','Events cannot read financial costs';
 assert abs((result#>>'{requirements,0,required}')::numeric-2.778)<0.001 and (result#>>'{requirements,0,purchase}')::numeric=1.778;
 assert not exists(select 1 from event_handoff_tasks where opportunity_id=o and acknowledged_at is not null),'Planning does not acknowledge execution';
 perform review_event_production_plan(p.id,p.revision,plan_revision);
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id,'value',10)));exception when insufficient_privilege then blocked:=true;end;assert blocked;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='false' and result#>'{financial,estimated_contribution}'='null';
 perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id,'value',10),jsonb_build_object('key','fixed','value',0)));plan_revision:=plan_revision+1;
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='true' and abs((result#>>'{financial,estimated_cost}')::numeric-27.777778)<0.00001;
 select * into h from event_handoffs where opportunity_id=o;
 select * into t from event_handoff_tasks where opportunity_id=o and task_key='financeiro_saldo';perform update_event_handoff_task(t.id,'done',null,null,'Finance reviewed fixture',h.version);
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);set local role authenticated;
 select * into t from event_handoff_tasks where opportunity_id=o and task_key='cozinha_cardapio';perform update_event_handoff_task(t.id,'done',null,null,'Kitchen reviewed fixture',h.version);
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 data:=jsonb_set(data,'{rows,0,quantity}','0.2');result:=save_event_production_plan(p.id,p.revision,plan_revision,data);plan_revision:=(result->>'revision')::integer;
 assert (select status='done' and acknowledged_at is not null from event_handoff_tasks where opportunity_id=o and task_key='financeiro_saldo');
 assert (select status='done' and acknowledged_at is not null from event_handoff_tasks where opportunity_id=o and task_key='cozinha_cardapio'),'Unchanged sector preserves its real acknowledgement';
 assert (select status='pending' from event_handoff_tasks where opportunity_id=o and task_key='bar_bebidas');
 blocked:=false;begin perform save_event_production_plan(p.id,p.revision,1,jsonb_set(data,'{rows,0,quantity}','0.3'));exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
 data:=jsonb_set(data,'{rows,0,stock}','null');perform save_event_production_plan(p.id,p.revision,plan_revision,data);plan_revision:=plan_revision+1;
 blocked:=false;begin perform review_event_production_plan(p.id,p.revision,plan_revision);exception when others then blocked:=true;end;assert blocked,'Unknown stock cannot masquerade as zero available';
 reset role;
 -- Buffer-only overlap, with no real booking or external operation.
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Buffer fixture','confirmado') returning id into other_o;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(other_o,'Buffer fixture','confirmado','ready',true,'2099-11-30','12:30',190,1,1000,120,1120,
 '{"event":{"date":"2099-11-30","time":"12:30","guests":190,"duration":1},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"pagamentoSinal":{"valor":560}}') returning * into other_p;
 insert into event_private.production_plans(opportunity_id,proposal_id,agreement_fingerprint,data,updated_by)
 values(other_o,other_p.id,event_private.proposal_fingerprint(other_p),'{"rows":[],"crew":[],"logistics":{"setup":60,"teardown":0}}',actor);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);set local role authenticated;
 result:=event_operation_readiness(p.id,p.revision);assert (result->'blockers')::text like '%montagem%','Setup and teardown affect release capacity';
 reset role;
end $$;
rollback;
