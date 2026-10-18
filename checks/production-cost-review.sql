begin;
do $$
declare actor uuid; seller uuid; finance uuid; o uuid; p public.propostas; plan event_private.production_plans;
 data jsonb; changed jsonb; result jsonb; costs jsonb; field text; change jsonb; plan_revision integer; blocked boolean;
 line_id uuid:=gen_random_uuid(); crew_id uuid:=gen_random_uuid();
begin
 select id into actor from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Production cost review fixture','confirmado') returning id into o;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(o,'Production cost review fixture','confirmado','ready',true,'2099-12-04','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-12-04","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}],"pagamentoSinal":{"valor":560,"data":"2026-10-17"}}') returning * into p;
 data:=jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',line_id,'item',0,'ingredient','Limão','sector','bar','unit','kg','basis','guest','quantity',0.1,'yield',80,'loss',10,'stock',1)),
  'crew',jsonb_build_array(jsonb_build_object('id',crew_id,'sector','bar','lead','Pessoa fixture','people',1,'hours',2)),
  'crew_reason','','stock_checked_at',now(),
  'logistics',jsonb_build_object('space','Lounge fixture','setup',0,'teardown',0,'access','Fornecedores com acesso conferido.','tickets','Ingressos do grupo conferidos.','weather','Contingência de teleférico conferida.','authorization','not_required','authorization_notes','Escopo fixture sem atração externa.'));
 costs:=jsonb_build_array(jsonb_build_object('key',line_id,'value',10),jsonb_build_object('key',crew_id,'value',20),jsonb_build_object('key','fixed','value',0));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);set local role authenticated;
 result:=save_event_production_plan(p.id,p.revision,0,data);plan_revision:=(result->>'revision')::integer;
 perform review_event_production_plan(p.id,p.revision,plan_revision);
 reset role;
 -- Simulate an amount from the pre-migration schema: preserve it, but never
 -- backfill review evidence that Finance has not actually supplied.
 insert into event_private.production_costs(opportunity_id,cost_key,unit_cost,updated_by) values(o,line_id::text,10,actor);
 set local role authenticated;
 result:=get_event_production_plan(p.id,p.revision);
 assert result->'costs'='{}' and result#>'{financial,complete}'='false' and result#>'{financial,estimated_contribution}'='null','Legacy unbound costs cannot produce a margin';
 reset role;select * into plan from event_private.production_plans where opportunity_id=o;set local role authenticated;
 perform set_event_production_costs(p.id,plan_revision,costs);plan_revision:=plan_revision+1;
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='true';
 assert (result#>>'{plan,revision}')::integer=plan_revision and (result#>>'{plan,reviewed_at}')::timestamptz=plan.reviewed_at and (result#>>'{plan,reviewed_by}')::uuid=plan.reviewed_by,'Cost writes advance CAS without clearing operational review';
 -- Dialog B was opened when costs were unknown. After A saves them, B's
 -- stale nulls must fail atomically rather than erase A's entry.
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision-1,jsonb_build_array(jsonb_build_object('key',line_id,'value',null),jsonb_build_object('key',crew_id,'value',25),jsonb_build_object('key','fixed','value',0)));exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Second stale cost dialog must conflict';
 result:=get_event_production_plan(p.id,p.revision);assert result->'costs'->>line_id::text='10' and result->'costs'->>crew_id::text='20','A stale dialog cannot clear or overwrite another save';
 -- Every field that changes the priced recipe invalidates only its own line.
 for field,change in select * from (values ('ingredient','"Laranja"'::jsonb),('unit','"g"'),('basis','"event"'),('quantity','0.2'),('yield','90'),('loss','5'),('sector','"cozinha"')) changes(field,value) loop
  changed:=jsonb_set(data,array['rows','0',field],change);
  result:=save_event_production_plan(p.id,p.revision,plan_revision,changed);plan_revision:=(result->>'revision')::integer;
  perform review_event_production_plan(p.id,p.revision,plan_revision);
  result:=get_event_production_plan(p.id,p.revision);
  assert not(result->'costs' ? line_id::text) and result->'costs' ? crew_id::text and result#>'{financial,missing}'='1' and result#>'{financial,estimated_contribution}'='null','Changed row requires Finance review, even after operational review';
  -- Reverting the edit does not revive an old cost.
  result:=save_event_production_plan(p.id,p.revision,plan_revision,data);plan_revision:=(result->>'revision')::integer;
  perform review_event_production_plan(p.id,p.revision,plan_revision);
  result:=get_event_production_plan(p.id,p.revision);assert not(result->'costs' ? line_id::text),'Reverting a row must not resurrect its stale cost';
  perform set_event_production_costs(p.id,plan_revision,costs);plan_revision:=plan_revision+1;
 end loop;
 for field,change in select * from (values ('sector','"cozinha"'::jsonb),('lead','"Outra pessoa fixture"'),('people','2'),('hours','3')) changes(field,value) loop
  changed:=jsonb_set(data,array['crew','0',field],change);
  result:=save_event_production_plan(p.id,p.revision,plan_revision,changed);plan_revision:=(result->>'revision')::integer;
  perform review_event_production_plan(p.id,p.revision,plan_revision);
  result:=get_event_production_plan(p.id,p.revision);
  assert not(result->'costs' ? crew_id::text) and result->'costs' ? line_id::text and result#>'{financial,estimated_contribution}'='null','Changed staffing needs Finance review';
  result:=save_event_production_plan(p.id,p.revision,plan_revision,data);plan_revision:=(result->>'revision')::integer;
  perform set_event_production_costs(p.id,plan_revision,costs);plan_revision:=plan_revision+1;
 end loop;
 -- Stock observations and their timestamps do not change the unit cost basis.
 changed:=jsonb_set(data,'{rows,0,stock}','2');changed:=jsonb_set(changed,'{stock_checked_at}',to_jsonb(now()-interval '1 minute'));
 result:=save_event_production_plan(p.id,p.revision,plan_revision,changed);plan_revision:=(result->>'revision')::integer;
 perform review_event_production_plan(p.id,p.revision,plan_revision);
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='true','Stock changes preserve reviewed unit costs';
 -- Removing and then reusing the same UUID cannot revive a cost.
 result:=save_event_production_plan(p.id,p.revision,plan_revision,jsonb_set(data,'{rows}','[]'));plan_revision:=(result->>'revision')::integer;
 result:=save_event_production_plan(p.id,p.revision,plan_revision,data);plan_revision:=(result->>'revision')::integer;
 result:=get_event_production_plan(p.id,p.revision);assert not(result->'costs' ? line_id::text),'Removed UUID reuse must not revive costs';
 perform set_event_production_costs(p.id,plan_revision,costs);plan_revision:=plan_revision+1;perform review_event_production_plan(p.id,p.revision,plan_revision);
 -- A clear is an explicit null patch. Known zero remains a real, complete cost.
 perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id,'value',null)));plan_revision:=plan_revision+1;
 result:=get_event_production_plan(p.id,p.revision);
 assert not(result->'costs' ? line_id::text) and result#>'{financial,missing}'='1' and result#>'{financial,estimated_contribution}'='null';
 reset role;assert not exists(select 1 from event_private.production_costs where opportunity_id=o and cost_key=line_id::text),'Cleared cost is removed, not hidden by the UI';set local role authenticated;
 perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id,'value',0)));plan_revision:=plan_revision+1;
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='true' and result#>'{financial,estimated_cost}'='40','Known zero is not unknown';
 -- Other event costs are tied to reviewed logistics, not just the 'fixed' key.
 changed:=jsonb_set(data,'{logistics,setup}','60');
 result:=save_event_production_plan(p.id,p.revision,plan_revision,changed);plan_revision:=(result->>'revision')::integer;
 perform review_event_production_plan(p.id,p.revision,plan_revision);
 result:=get_event_production_plan(p.id,p.revision);
 assert not(result->'costs' ? 'fixed') and result->'costs' ? line_id::text and result->'costs' ? crew_id::text and result#>'{financial,estimated_contribution}'='null','Logistics changes require a new fixed-cost review';
 perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key','fixed','value',0)));plan_revision:=plan_revision+1;
 -- Reject malformed/duplicate keys atomically, stale dialogs, and non-finance users.
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id,'value',null),jsonb_build_object('key','unknown','value',10)));exception when others then blocked:=true;end;assert blocked;
 result:=get_event_production_plan(p.id,p.revision);assert result->'costs' ? line_id::text,'Invalid patch rolls back earlier clear';
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id,'value',null),jsonb_build_object('key',line_id,'value',10)));exception when others then blocked:=true;end;assert blocked;
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision,jsonb_build_array(jsonb_build_object('key',line_id)));exception when others then blocked:=true;end;assert blocked;
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision-1,costs);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
 perform set_event_production_costs(p.id,plan_revision,'[]');
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='true','An empty patch must not erase known costs';
 reset role;
 -- A new agreement cannot inherit costs solely because line IDs are unchanged.
 select * into plan from event_private.production_plans where opportunity_id=o;
 update event_private.production_plans set agreement_fingerprint='synthetic-changed-agreement' where opportunity_id=o;
 assert not exists(select 1 from event_private.production_costs where opportunity_id=o and reviewed_basis is not null),'Agreement change invalidates every cost basis';
 set local role authenticated;
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision,costs);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Stale agreement cannot receive new cost evidence';
 reset role;update event_private.production_plans set agreement_fingerprint=plan.agreement_fingerprint where opportunity_id=o;set local role authenticated;
 result:=get_event_production_plan(p.id,p.revision);assert result->'costs'='{}','Restoring an agreement cannot revive invalidated cost evidence';
 reset role;perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 perform set_event_production_costs(p.id,plan_revision,costs);plan_revision:=plan_revision+1;
 result:=get_event_production_plan(p.id,p.revision);assert result#>'{financial,complete}'='true','Finance can reconfirm costs against the current basis';
 reset role;perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 blocked:=false;begin perform set_event_production_costs(p.id,plan_revision,costs);exception when insufficient_privilege then blocked:=true;end;assert blocked;
 result:=get_event_production_plan(p.id,p.revision);assert result->'costs'='null' and result->'financial'='null','Operational users still cannot read costs';
 reset role;
 assert not has_function_privilege('authenticated','event_private.production_cost_basis(event_private.production_plans,text)','execute');
 assert not has_function_privilege('anon','public.set_event_production_costs(uuid,integer,jsonb)','execute');
 assert not has_table_privilege('authenticated','event_private.production_costs','select');
end $$;
rollback;
