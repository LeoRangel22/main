-- All actors, agreements, customer responses and payments below are disposable CI fixtures.
begin;
do $$
declare manager uuid; seller uuid; outsider uuid:=gen_random_uuid(); p public.propostas; d public.propostas; opp uuid;
 a jsonb; aid uuid; token uuid; evidence jsonb; accepted_at timestamptz; req uuid:=gen_random_uuid(); before_outbox bigint;
 before_tasks bigint; before_version integer; blocked boolean; original jsonb; result jsonb; n integer; i integer; payment jsonb; base_day date; draft_revision bigint; old_active uuid; old_history uuid;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 assert not has_table_privilege('authenticated','event_private.event_amendments','select');
 assert not has_table_privilege('authenticated','event_private.amendment_apply_context','insert');
 assert not has_function_privilege('anon','public.request_event_amendment(uuid,bigint,text)','execute');
 assert not has_function_privilege('anon','public.list_event_amendments()','execute');
 assert not has_function_privilege('anon','public.get_event_amendment(uuid)','execute');
 assert not has_function_privilege('anon','public.apply_event_amendment(uuid,bigint,bigint,text)','execute');
 assert not has_function_privilege('authenticated','event_private.amendment_application_allowed(public.propostas,public.propostas)','execute');
 assert has_function_privilege('anon','public.get_public_event_amendment(uuid)','execute');
 assert has_function_privilege('anon','public.respond_public_event_amendment(uuid,text,text,text,text,uuid)','execute');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'email','outside@example.test')::text,true);
 blocked:=false;begin perform public.list_event_amendments();exception when others then blocked:=true;end;assert blocked;
 select count(*) into before_outbox from public.event_outbox;

 -- Includes a normal amendment, legacy payment, signal exception, stale agreement and withdrawal.
 for i in 1..6 loop
  perform set_config('request.jwt.claims','',true);
  base_day:=date '2099-11-01'+i*3;
  insert into public.oportunidades(cliente_nome,status,data_evento) values('Amendment fixture '||i,'confirmado',base_day) returning id into opp;
  payment:=jsonb_build_object('valor',560,'data','2026-10-17','bancos',jsonb_build_array('Fixture'),
   'comprovante',jsonb_build_object('nome','proof-fixture.pdf','conteudo','PRIVATE_PROOF_FIXTURE'));
  if i<>2 then payment:=payment||jsonb_build_object('validadoPor',manager,'validadoEm',now(),'validacaoPendente',false);end if;
  -- Events bank attestation from the seller workflow fix stays valid across an amendment.
  if i=6 then payment:=payment||jsonb_build_object('validadoPor',seller,'bankConferido',true);end if;
  insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,cliente_whatsapp,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
  values(opp,'Amendment fixture '||i,'fixture@example.test','+5521999990000','confirmado','ready',true,base_day,'10:00',20,2,1000,120,1120,
   jsonb_build_object('event',jsonb_build_object('date',base_day,'time','10:00','guests',20,'duration',2,'notes','PRIVATE_INTERNAL_FIXTURE'),
    'totals',jsonb_build_object('subtotal',1000,'serviceFee',120,'total',1120),'selectedItems',jsonb_build_array(jsonb_build_object('nome','Fixture','formula','SECRET_FORMULA_FIXTURE','preco1h',50,'priority',10,'recommendedWindows',jsonb_build_array('INTERNAL_WINDOW'),'calc',jsonb_build_object('total',1000))),
    'generalTerms','Original terms','paymentTerms','Original payment terms','pagamentoSinal',payment)) returning * into p;
  original:=p.snapshot;
  update public.event_handoff_tasks set status='done',acknowledged_at=now(),acknowledged_by=manager,completed_at=now(),completed_by=manager where opportunity_id=opp;
  select count(*) into before_tasks from public.event_handoff_tasks where opportunity_id=opp;
  select version into before_version from public.event_handoffs where opportunity_id=opp;
  insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,cliente_whatsapp,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
  values(opp,p.cliente_nome,p.cliente_email,p.cliente_whatsapp,'negociacao','draft',false,base_day+1,'11:00',25,2,
   case when i=3 then 2000 else 1000 end,case when i=3 then 240 else 120 end,case when i=3 then 2240 else 1120 end,
   (p.snapshot-'pagamentoSinal')||jsonb_build_object('amendmentOf',jsonb_build_object('id',p.id,'revision',p.revision),
    'event',jsonb_build_object('date',base_day+1,'time','11:00','guests',25,'duration',2,'notes','PRIVATE_DRAFT_FIXTURE'),
    'totals',jsonb_build_object('subtotal',case when i=3 then 2000 else 1000 end,'serviceFee',case when i=3 then 240 else 120 end,'total',case when i=3 then 2240 else 1120 end),
    'selectedItems',jsonb_build_array(jsonb_build_object('nome','Changed fixture','calc',jsonb_build_object('total',case when i=3 then 2000 else 1000 end))))) returning * into d;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br')::text,true);
  a:=public.request_event_amendment(d.id,d.revision,'Remarcação e novo número de convidados para revisão.');aid:=(a->>'id')::uuid;
  assert a->>'status'='pending_manager';
  assert public.request_event_amendment(d.id,d.revision,'Repetição não muda o resumo revisado.')->>'id'=a->>'id','Request retry is idempotent';
  assert (select is_current and snapshot=original from public.propostas where id=p.id),'Request preserves existing agreement';
  blocked:=false;begin perform public.save_event_proposal(d.id,jsonb_build_object('snapshot',d.snapshot||'{"modified":true}'),d.revision,null);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Submitted draft cannot change';
  blocked:=false;begin perform public.decide_event_amendment(aid,'approve','pending_manager','');exception when insufficient_privilege then blocked:=true;end;assert blocked,'Seller cannot approve';
  perform set_config('event.amendment_apply','true',true);
  blocked:=false;begin perform public.save_event_proposal(p.id,'{"total":9999}',p.revision,null);exception when others then blocked:=true;end;assert blocked,'A client GUC cannot bypass the original agreement guard';
  if i=4 then
   perform set_config('request.jwt.claims','',true);
   update public.propostas set snapshot=snapshot||'{"internalNote":"Changed after request"}' where id=p.id;
   perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com')::text,true);
   blocked:=false;begin perform public.decide_event_amendment(aid,'approve','pending_manager','');exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Changed base prevents approval';
   perform public.withdraw_event_amendment(aid,'pending_manager','Revisão anterior ficou desatualizada.');continue;
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com')::text,true);
  a:=public.decide_event_amendment(aid,'approve','pending_manager','Condições e eventual desconto revisados.');
  assert a->>'status'='awaiting_client';
  select client_token into token from event_private.event_amendments where id=aid;
  perform set_config('request.jwt.claims','',true);
  evidence:=public.get_public_event_amendment(token);
  assert evidence#>>'{after,date}'=(base_day+1)::text;
  assert evidence::text not like '%PRIVATE_%' and evidence::text not like '%validadoPor%' and evidence::text not like '%fixture@example.test%','Public capability never leaks bank proof, internal briefing or contact';
  assert evidence::text not like '%SECRET_FORMULA%' and evidence::text not like '%preco1h%' and evidence::text not like '%recommendedWindows%','Public item projection omits catalog calculation and scheduling metadata';
  blocked:=false;begin perform public.respond_public_event_amendment(token,'changed-hash','accept','Client fixture','',req);exception when others then blocked:=true;end;assert blocked,'Hash binds acceptance to reviewed content';
  if i=5 then
   perform public.respond_public_event_amendment(token,evidence->>'hash','changes_requested','Client fixture','Solicito outro horário para o evento.',req);
   assert (select is_current from public.propostas where id=p.id);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br')::text,true);
   select * into d from public.save_event_proposal(d.id,jsonb_build_object('snapshot',d.snapshot||'{"note":"Revisar horário solicitado"}'),d.revision,null);
   a:=public.request_event_amendment(d.id,d.revision,'Nova revisão após o pedido do cliente.');aid:=(a->>'id')::uuid;
   perform public.withdraw_event_amendment(aid,'pending_manager','Retirada explícita pelo vendedor solicitante.');
   assert (select client_token is null and status='withdrawn' from event_private.event_amendments where id=aid);continue;
  end if;
  result:=public.respond_public_event_amendment(token,evidence->>'hash','accept','Client fixture','De acordo com esta revisão.',req);
  select client_response_at into accepted_at from event_private.event_amendments where id=aid;
  assert public.respond_public_event_amendment(token,evidence->>'hash','accept','Client fixture','De acordo com esta revisão.',req)=result,'Acceptance retry has one result';
  assert (select proposal_id=p.id and status='confirmed' from public.event_reservations where opportunity_id=opp),'Acceptance alone never moves reservation';
  assert (select count(*)=before_tasks from public.event_handoff_tasks where opportunity_id=opp and status='done'),'Acceptance alone never changes sector decisions';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br')::text,true);
  blocked:=false;begin perform public.apply_event_amendment(aid,p.revision,d.revision,'');exception when insufficient_privilege then blocked:=true;end;assert blocked;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com')::text,true);
  blocked:=false;begin perform public.apply_event_amendment(aid,p.revision+1,d.revision,'');exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
  if i=2 then
   blocked:=false;begin perform public.apply_event_amendment(aid,p.revision,d.revision,'');exception when others then blocked:=true;end;assert blocked,'Legacy payment cannot be promoted to audited payment';
   assert (select proposal_id=p.id from public.event_reservations where opportunity_id=opp);continue;
  end if;
  if i=1 then
   update public.event_commercial_policy set capacity=10 where id;
   blocked:=false;begin perform public.apply_event_amendment(aid,p.revision,d.revision,'');exception when others then blocked:=true;end;assert blocked,'New capacity conflicts block the complete transaction';
   assert (select is_current and snapshot=original from public.propostas where id=p.id);
   assert (select proposal_id=p.id from public.event_reservations where opportunity_id=opp);
   assert (select status='client_accepted' from event_private.event_amendments where id=aid);
   update public.event_commercial_policy set capacity=200 where id;
  elsif i=3 then
   blocked:=false;begin perform public.apply_event_amendment(aid,p.revision,d.revision,'');exception when others then blocked:=true;end;assert blocked,'Higher total requires complement or explicit manager exception';
  end if;
  draft_revision:=d.revision;
  result:=public.apply_event_amendment(aid,p.revision,d.revision,case when i=3 then 'Condição excepcional aprovada pelo gestor para este novo total.' else '' end);
  assert result->>'status'='applied';
  assert (select not is_current and snapshot=original from public.propostas where id=p.id),'Prior agreement is retained unchanged';
  select * into d from public.propostas where id=d.id;
  assert d.is_current and d.publication_status='ready' and d.status=p.status and d.journey_commercial_locked and d.journey_booked_locked;
  assert d.snapshot#>'{pagamentoSinal,comprovante}'=original#>'{pagamentoSinal,comprovante}';
  assert d.snapshot#>'{pagamentoSinal,validadoEm}'=original#>'{pagamentoSinal,validadoEm}','Actual bank audit is preserved, not invented at apply';
  assert d.cliente_resposta='confirmar' and d.cliente_resposta_em=accepted_at;
  evidence:=public.event_journey_evidence(d.id,d.revision);
  assert (select s->>'state'='confirmed' and s->>'evidence_type'='amendment' from jsonb_array_elements(evidence->'steps') s where s->>'key'='approval'),'Journey recognizes the actual amendment manager decision';
  assert (select s->>'state'='confirmed' from jsonb_array_elements(evidence->'steps') s where s->>'key'='client_acceptance');
  assert (select proposal_id=d.id and status='confirmed' and guests=25 from public.event_reservations where opportunity_id=opp);
  assert (select version>before_version and changes_pending and proposal_id=d.id from public.event_handoffs where opportunity_id=opp);
  assert (select count(*)=8 from public.event_handoff_tasks where opportunity_id=opp and status='pending' and acknowledged_by is null and completed_by is null),'New agreement requires new sector science and execution';
  assert (select id=d.id from public.get_public_proposal(p.public_token)),'Original public link resolves to the applied, authorized new agreement';
  if i=1 then old_history:=aid;end if;
  select count(*) into n from public.event_messages where opportunity_id=opp and channel='note';
  assert public.apply_event_amendment(aid,p.revision,draft_revision,'')->>'existing'='true','Apply retry returns the original result';
  assert (select count(*)=n from public.event_messages where opportunity_id=opp and channel='note'),'Retry does not duplicate the audit note';
  assert (select revision=d.revision from public.propostas where id=d.id),'Retry does not mutate the applied agreement';
  blocked:=false;begin perform public.save_event_proposal(d.id,'{"total":9999}',d.revision,null);exception when others then blocked:=true;end;assert blocked,'Normal immutability still protects the newly applied agreement';
 end loop;
 select id into old_active from event_private.event_amendments where status='client_accepted' limit 1;
 update event_private.event_amendments set created_at=now()-interval '20 days' where id=old_history;
 insert into event_private.event_amendments(opportunity_id,base_id,draft_id,base_revision,draft_revision,before_record,after_record,content_hash,summary,status,requested_by,created_at)
 select a.opportunity_id,a.base_id,a.draft_id,a.base_revision,a.draft_revision,a.before_record,a.after_record,a.content_hash,a.summary,'rejected',a.requested_by,now()+make_interval(secs=>g.seq)
 from event_private.event_amendments a cross join generate_series(1,205) g(seq) where a.id=old_active;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com')::text,true);
 evidence:=public.list_event_amendments();
 assert (select count(*)=1 from jsonb_array_elements(evidence->'requests') jr(value) where jr.value->>'id'=old_active::text),'Old active request stays accessible after more than 200 newer closed rows';
 assert (select count(*)=0 from jsonb_array_elements(evidence->'requests') jr(value) where jr.value->>'id'=old_history::text),'Old history is outside the capped listing';
 assert public.get_event_amendment(old_history)->>'id'=old_history::text,'Direct authenticated link retrieves history outside the cap';
 evidence:=public.get_public_event_amendment((select client_token from event_private.event_amendments where id=old_history));
 assert evidence::text not like '%SECRET_FORMULA%';
 assert (select snapshot::text not like '%SECRET_FORMULA%' and snapshot::text not like '%preco1h%' from public.get_public_proposal((select public_token from public.propostas where id=(select base_id from event_private.event_amendments where id=old_history)))),'Existing proposal portal uses the same item privacy projection';
 -- Ordinary proposal promotion must retain the existing ready-versus-sent behavior.
 perform set_config('request.jwt.claims','',true);
 insert into public.oportunidades(cliente_nome,status) values('Ordinary promotion fixture','proposta_pronta') returning id into opp;
 insert into public.propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,snapshot)
 values(opp,'Ordinary promotion fixture','proposta_pronta','ready',true,'{}') returning * into p;
 insert into public.propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,snapshot)
 values(opp,'Ordinary promotion fixture','proposta_pronta','draft',false,'{}') returning * into d;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com')::text,true);
 select * into d from public.save_event_proposal(d.id,'{"is_current":true,"publication_status":"ready","status":"proposta_pronta"}',d.revision,null);
 assert d.is_current and d.publication_status='ready' and d.sent_at is null,'Ordinary ready proposal must not acquire a fictional transport send';
 assert (select count(*)=before_outbox from public.event_outbox),'Amendment lifecycle never creates customer sends';
 assert (select count(*)=0 from event_private.amendment_apply_context),'No application capability survives its transaction';
end $$;
rollback;
