-- Isolated fixtures only. No provider calls; every write rolls back.
begin;
do $$
declare blocked boolean; before_count bigint; actor uuid; opp uuid; prop uuid; rev bigint; result jsonb;
begin
  assert not has_function_privilege('authenticated','public.event_bot_bridge_commit(text,bigint,bigint,jsonb)','EXECUTE'), 'Sellers cannot advance bridge cursor';
  assert not has_function_privilege('anon','public.begin_event_send_reviewed(uuid,bigint,text,text,text,text,timestamptz)','EXECUTE'), 'Anonymous send forbidden';
  perform public.event_bot_bridge_activate('bot:embaixada_urca',7);
  select count(*) into before_count from public.event_provider_events;
  blocked:=false;begin perform public.event_bot_bridge_commit('bot:outra',7,8,'[]');exception when others then blocked:=true;end;
  assert blocked and (select cursor=7 from event_private.bot_bridge_state), 'Wrong account preserves cursor';
  blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',6,8,'[]');exception when others then blocked:=true;end;
  assert blocked and (select cursor=7 from event_private.bot_bridge_state), 'Concurrent stale worker preserves cursor';
  blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',7,null,'[]');exception when others then blocked:=true;end;
  assert blocked and (select cursor=7 from event_private.bot_bridge_state), 'Null cursor rejected';
  -- Ingestion can begin but a malformed second event aborts the entire transaction.
  blocked:=false;begin
    perform public.event_bot_bridge_commit('bot:embaixada_urca',7,9,jsonb_build_array(
      jsonb_build_object('key','atomic-fixture','channel','whatsapp','kind','inbound','message_id','atomic-fixture','destination','5521000000011','body','Fixture','occurred_at',now()),
      jsonb_build_object('key','invalid-fixture','channel','invalid','kind','inbound','message_id','invalid-fixture','destination','5521000000011','body','Fixture','occurred_at',now())));
  exception when others then blocked:=true;end;
  assert blocked, 'Malformed event rejects batch';
  assert (select count(*)=before_count from public.event_provider_events), 'Partial events roll back with cursor';
  assert (select cursor=7 and last_success_at is null from event_private.bot_bridge_state), 'Failed ingestion preserves health and cursor';
  perform public.event_bot_bridge_commit('bot:embaixada_urca',7,8,'[]');
  assert (select cursor=8 and last_success_at is not null from event_private.bot_bridge_state), 'Successful empty poll records health';
  perform public.event_zapi_direct_activate('instance');
  blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',8,9,'[]');exception when others then blocked:=true;end;
  assert blocked and (select cursor=8 from event_private.bot_bridge_state), 'Direct activation invalidates in-flight bridge batch';

  select id into actor from auth.users where email='leorangel@gmail.com';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
  insert into public.oportunidades(cliente_nome,status,data_evento) values('Review fixture','proposta_pronta','2099-12-01') returning id into opp;
  insert into public.propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,snapshot)
  values(opp,'Review fixture','proposta_pronta','ready','2099-12-01','10:00',20,2,1000,120,0,1120,'{"event":{},"totals":{"adjustment":0}}') returning id,revision into prop,rev;
  blocked:=false;begin perform public.begin_event_send_reviewed(prop,rev+1,'whatsapp','5521000000011','Reviewed content','Fixture',null);exception when others then blocked:=true;end;
  assert blocked and not exists(select 1 from public.event_outbox where proposal_id=prop), 'Unreviewed revision never creates a send';
  result:=public.begin_event_send_reviewed(prop,rev,'whatsapp','5521000000011','Reviewed content','Fixture',null);
  assert (result->>'claimed')::boolean, 'Exact reviewed revision may claim';
end; $$;
rollback;
