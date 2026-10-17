-- Isolated regression fixtures only; all changes rolled back; no provider calls.
begin;
do $$
declare manager uuid; seller uuid; finance uuid; opp uuid; p public.propostas; d public.propostas;
  result public.propostas; blocked boolean; h public.event_handoffs; t public.event_handoff_tasks; release_id uuid;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 select id into finance from auth.users where email='financeiro@embaixadacarioca.com.br';
 assert not has_function_privilege('anon','event_private.journey_financial_operator()','execute');
 assert not has_function_privilege('authenticated','event_private.guard_journey_proposal()','execute');
 insert into oportunidades(cliente_nome,status) values('Journey fixture','negociacao') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,tipo_evento,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,status,publication_status,is_current,snapshot)
 values(opp,'Journey fixture','Coffee Break','2099-11-18','10:00',20,2,1000,120,1120,'negociacao','sent',true,
 '{"generalTerms":"Original terms","event":{"type":"Coffee Break","date":"2099-11-18","time":"10:00","guests":20,"duration":2,"notes":"Internal note"},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"id":"fixture","nome":"Fixture","descricao":"Original composition","calc":{"total":1000}}]}') returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"generalTerms":"Changed terms"}'),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Released terms must not be overwritten';
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":560}}','status','confirmado'),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;assert blocked,'Seller cannot validate a payment';
 select * into p from save_event_proposal(p.id,'{"publication_status":"ready"}'::jsonb,p.revision,null);
 assert p.journey_commercial_locked,'Operational restaging cannot unlock a released agreement';
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"generalTerms":"Bypass attempt"}'),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Restaging cannot enable a contractual overwrite';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":560,"data":"2026-10-14","bancos":["Fixture"]}}','status','confirmado'),p.revision,null);
 assert p.snapshot#>>'{pagamentoSinal,validadoPor}'=finance::text,'Financial validation has a server-recorded actor';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,notes}','"Internal operational note"')),p.revision,null);
 assert p.snapshot#>>'{pagamentoSinal,validadoPor}'=finance::text,'Notes preserve financial validation';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":1}}'),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;assert blocked,'Finance cannot authorize a below-standard exception';

 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":null}'),p.revision,null);
 exception when others then blocked:=true;end;assert blocked,'A confirmed event cannot lose its validated signal';
 blocked:=false;begin perform save_event_proposal(p.id,'{"convidados":23}'::jsonb,p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Confirmed agreement cannot be overwritten';
 select * into d from save_event_proposal(null,jsonb_build_object('oportunidade_id',opp,'cliente_nome','Journey fixture',
  'status','negociacao','publication_status','draft','is_current',false,'convidados',23,
  'snapshot',(p.snapshot-'pagamentoSinal')||jsonb_build_object('amendmentOf',jsonb_build_object('id',p.id,'revision',p.revision))),p.revision,p.id);
 assert not d.is_current and d.publication_status='draft';
 blocked:=false;begin perform save_event_proposal(d.id,jsonb_build_object('status','confirmado','snapshot',d.snapshot||'{"pagamentoSinal":{"valor":560}}'),d.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Amendment draft cannot create a payment or confirmation';
 select * into p from save_event_proposal(p.id,'{"status":"negociacao"}'::jsonb,p.revision,null);
 assert p.journey_booked_locked,'Restaging cannot forget the previously closed agreement';
 blocked:=false;begin perform save_event_proposal(d.id,'{"is_current":true,"publication_status":"ready"}'::jsonb,d.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Restaging cannot allow a draft to replace a closed agreement';
 select * into p from save_event_proposal(p.id,'{"status":"confirmado"}'::jsonb,p.revision,null);

 assert (select is_current and convidados=20 from propostas where id=p.id),'Original agreement is untouched';
 blocked:=false;begin perform save_event_proposal(d.id,'{"is_current":true,"publication_status":"ready"}'::jsonb,d.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Draft cannot displace booked operation';
 reset role;
 select * into h from event_handoffs where opportunity_id=opp;
 select id into release_id from event_handoff_tasks where opportunity_id=opp and task_key='gerencia_go_no_go';
 assert release_id is not null;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 perform acknowledge_event_handoff_changes(opp,h.version);
 blocked:=false;begin perform update_event_handoff_task(release_id,'done',null,null,null,h.version);
 exception when others then blocked:=true;end;assert blocked,'Coordinator cannot release without audited prerequisites';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform update_event_handoff_task(release_id,'done',null,null,null,h.version);
 exception when others then blocked:=true;end;assert blocked,'Even manager needs the sector prerequisites';
 for t in select * from event_handoff_tasks where opportunity_id=opp order by sort_order loop
  perform plan_event_handoff_task(t.id,h.version,t.updated_at,'Synthetic owner',coalesce(t.due_at,now()),t.notes);
 end loop;
 perform confirm_event_reservation(p.id,p.revision);
 for t in select * from event_handoff_tasks where opportunity_id=opp and task_key<>'gerencia_go_no_go' order by sort_order loop
  perform update_event_handoff_task(t.id,'done',null,null,'Synthetic checked prerequisite',h.version);
 end loop;
 reset role;
 insert into event_private.production_plans(opportunity_id,proposal_id,agreement_fingerprint,data,reviewed_by,reviewed_at,updated_by)
 values(p.oportunidade_id,p.id,event_private.proposal_fingerprint(p),jsonb_build_object('rows','[]'::jsonb,'crew','[]'::jsonb,'stock_checked_at',now(),'logistics',jsonb_build_object('setup',0,'teardown',0)),manager,now(),manager);
 set local role authenticated;
 perform update_event_handoff_task(release_id,'done',null,null,'Synthetic final decision',h.version);
 assert (select status='done' and acknowledged_by=manager from event_handoff_tasks where id=release_id);
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='financeiro_saldo';
 blocked:=false;begin perform update_event_handoff_task(t.id,'done','Seller changed owner',now(),'Changed after financial validation',h.version);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'A seller cannot alter a completed finance task while retaining the finance signature';
 assert (select notes=t.notes and owner_label=t.owner_label and acknowledged_by=manager from event_handoff_tasks where id=t.id);
 perform update_event_handoff_task(release_id,'pending',null,null,'Coordinator reopening final release',h.version);
 assert (select status='pending' from event_handoff_tasks where id=release_id),'Coordinator may explicitly revoke a release';
 perform update_event_handoff_task(release_id,'done',null,null,'Coordinator reconfirms audited prerequisites',h.version);
 -- A legitimate sector prerequisite reopening must still invalidate the release.
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='salao_montagem';
 perform update_event_handoff_task(t.id,'blocked',null,null,'Synthetic reopened prerequisite',h.version);
 assert (select status='pending' and completed_at is null from event_handoff_tasks where id=release_id),'Reopened prerequisite invalidates release';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,notes}','"Revised operational note requiring renewed science"')),p.revision,null);
 assert not exists(select 1 from event_handoff_tasks where opportunity_id=opp and acknowledged_at is not null),'Source invalidation may clear financial science without impersonating Finance';

 reset role;
end; $$;
rollback;
