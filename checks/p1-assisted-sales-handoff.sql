-- Regression P1: handoff por setor, idempotencia e mudanca pos-handoff.
-- Executar depois de 20261007024236_p1_assisted_sales_client_portal_handoff.sql.
begin;

do $$
declare
  fixture_opportunity_id uuid;
  fixture_proposal_id uuid;
  draft_opportunity_id uuid;
  fixture_task_id uuid;
  team_user uuid;
  first_count integer;
begin
  insert into public.oportunidades(
    cliente_nome, cliente_email, data_evento, status
  ) values (
    'Fixture sem sinal', 'fixture-sem-sinal@example.test', current_date + 45, 'proposta_enviada'
  ) returning id into draft_opportunity_id;

  insert into public.propostas(
    oportunidade_id, cliente_nome, cliente_email, tipo_evento, data_evento,
    horario_evento, convidados, duracao, subtotal, taxa_servico, privatizacao,
    total, status, publication_status, is_current, snapshot
  ) values (
    draft_opportunity_id, 'Fixture sem sinal', 'fixture-sem-sinal@example.test',
    'Coquetel', current_date + 45, '18:00', 40, 3, 8000, 960, 0, 8960,
    'proposta_enviada', 'sent', true,
    jsonb_build_object('pagamentoSinal', null)
  );

  assert not exists(
    select 1 from public.event_handoffs where opportunity_id = draft_opportunity_id
  ), 'JSON null nao pode ser interpretado como sinal';

  insert into public.oportunidades(
    cliente_nome, cliente_email, data_evento, status
  ) values (
    'Fixture P1 Handoff', 'fixture-p1@example.test', current_date + 30, 'confirmado'
  ) returning id into fixture_opportunity_id;

  insert into public.propostas(
    oportunidade_id, cliente_nome, cliente_email, cliente_whatsapp, tipo_evento,
    data_evento, horario_evento, convidados, duracao, subtotal, taxa_servico,
    privatizacao, total, status, publication_status, is_current, snapshot
  ) values (
    fixture_opportunity_id, 'Fixture P1 Handoff', 'fixture-p1@example.test', '21999999999',
    'Coquetel', current_date + 30, '18:00', 60, 3, 10000, 1200, 0, 11200,
    'confirmado', 'sent', true,
    jsonb_build_object(
      'event', jsonb_build_object('notes','Sem lactose','preferences','Welcome drink'),
      'selectedItems', jsonb_build_array(jsonb_build_object('id','coquetel-carioca','nome','Coquetel Carioca')),
      'pagamentoSinal', jsonb_build_object('valor',5600,'data',current_date)
    )
  ) returning id into fixture_proposal_id;

  assert exists(
    select 1 from public.event_handoffs h
    where h.opportunity_id = fixture_opportunity_id
      and h.proposal_id = fixture_proposal_id
      and h.version = 1
      and not h.changes_pending
  ), 'Sinal deve gerar handoff operacional V1';

  select count(*) into first_count
  from public.event_handoff_tasks
  where opportunity_id = fixture_opportunity_id;
  assert first_count = 8, 'Handoff deve criar oito tarefas setoriais';

  update public.event_handoff_tasks set status = 'done', acknowledged_at = now(), completed_at = now()
  where opportunity_id = fixture_opportunity_id;

  update public.propostas
  set convidados = 75,
      snapshot = jsonb_set(snapshot, '{event,notes}', '"Sem lactose e uma pessoa celíaca"'::jsonb)
  where id = fixture_proposal_id;

  assert exists(
    select 1 from public.event_handoffs h
    where h.opportunity_id = fixture_opportunity_id
      and h.version = 2
      and h.changes_pending
  ), 'Alteracao posterior deve criar nova versao pendente de ciencia';

  assert exists(
    select 1 from public.event_handoff_changes c
    where c.opportunity_id = fixture_opportunity_id
      and c.handoff_version = 2
      and 'Convidados' = any(c.changed_fields)
      and 'Observacoes' = any(c.changed_fields)
  ), 'Historico deve explicar exatamente os campos alterados';

  assert (
    select count(*) = first_count
    from public.event_handoff_tasks
    where opportunity_id = fixture_opportunity_id
  ), 'Ressincronizacao nao pode duplicar tarefas';

  assert (select count(*) = 8 from public.event_handoff_tasks
    where opportunity_id = fixture_opportunity_id and status = 'pending'
      and source_version = 2 and acknowledged_at is null and completed_at is null),
    'Mudanca deve reabrir tarefas concluidas para ciencia da nova versao';

  select id into team_user from auth.users
  where lower(email) = 'eventos@embaixadacarioca.com.br'
  limit 1;
  if team_user is null then
    assert (select count(*) = 8 from public.event_handoff_tasks
    where opportunity_id = fixture_opportunity_id and status = 'pending'
      and source_version = 2 and acknowledged_at is null and completed_at is null),
    'Mudanca deve reabrir tarefas concluidas para ciencia da nova versao';

  select id into team_user from auth.users where lower(email) = 'leorangel@gmail.com' limit 1;
  end if;
  assert team_user is not null, 'Fixture requer um usuario real da equipe';

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', team_user,
    'email', coalesce((select email from auth.users where id = team_user), 'eventos@embaixadacarioca.com.br'),
    'role', 'authenticated'
  )::text, true);

  select id into fixture_task_id
  from public.event_handoff_tasks
  where opportunity_id = fixture_opportunity_id
  order by sort_order
  limit 1;

  perform public.update_event_handoff_task(fixture_task_id, 'done', null, null, 'Conferido na regressao P1', 2);
  assert exists(
    select 1 from public.event_handoff_tasks
    where id = fixture_task_id and status = 'done' and acknowledged_at is not null and completed_by = team_user
  ), 'Conclusao deve registrar ciencia, horario e ator';

  begin
    perform public.acknowledge_event_handoff_changes(fixture_opportunity_id, 1);
    raise exception 'Versao antiga nao pode registrar ciencia';
  exception
    when others then
      assert sqlerrm like 'O handoff mudou.%', 'Ciencia deve falhar quando a versao visualizada ficou antiga';
  end;

  begin
    perform public.update_event_handoff_task(fixture_task_id, 'done', null, null, null, 1);
    raise exception 'Tarefa antiga nao pode registrar ciencia';
  exception when others then
    assert sqlerrm like 'A tarefa mudou.%', 'Versao obsoleta da tarefa deve ser rejeitada';
  end;
  begin
    perform public.acknowledge_event_handoff_changes(fixture_opportunity_id, null);
    raise exception 'Versao ausente nao pode registrar ciencia';
  exception when others then
    assert sqlerrm like 'O handoff mudou.%', 'Ciencia deve exigir versao explicita';
  end;

  perform public.acknowledge_event_handoff_changes(fixture_opportunity_id, 2);
  assert (select status <> 'completed' from public.event_handoffs where opportunity_id = fixture_opportunity_id),
    'Ciencia global nao substitui revisao das tarefas setoriais';

  update public.propostas set convidados = 76 where id = fixture_proposal_id;
  assert exists(select 1 from public.event_handoff_task_history
    where event_handoff_task_history.task_id = fixture_task_id and opportunity_id = fixture_opportunity_id
      and source_version = 2 and reason = 'version_reopened'
      and task_snapshot ->> 'status' = 'done'
      and task_snapshot ->> 'acknowledged_by' = team_user::text
      and task_snapshot ->> 'completed_by' = team_user::text
      and task_snapshot ->> 'acknowledged_at' is not null
      and task_snapshot ->> 'completed_at' is not null),
    'Reabertura deve preservar ciencia e conclusao anteriores com ator e horarios';
  perform public.acknowledge_event_handoff_changes(fixture_opportunity_id, 3);

  update public.propostas set status = 'cancelado' where id = fixture_proposal_id;
  assert not exists(select 1 from public.active_event_handoffs where opportunity_id = fixture_opportunity_id),
    'Cancelamento com sinal preservado deve sair da operacao';
  assert not exists(select 1 from public.active_event_handoff_tasks where opportunity_id = fixture_opportunity_id),
    'Tarefas de evento cancelado devem ficar ocultas';
  assert exists(select 1 from public.event_handoffs where opportunity_id = fixture_opportunity_id),
    'Historico do cancelamento deve ser preservado';
  begin
    perform public.update_event_handoff_task(fixture_task_id, 'done', null, null, null, 2);
    raise exception 'Tarefa cancelada nao pode ser concluida';
  exception when others then
    assert sqlerrm like 'Tarefa operacional inativa.%', 'Cancelamento deve bloquear RPC de tarefa';
  end;
  assert exists(
    select 1 from public.event_handoffs
    where opportunity_id = fixture_opportunity_id and not changes_pending
  ), 'Revisao explicita deve retirar somente o alerta de mudanca';

  assert not has_table_privilege('anon','public.event_handoff_task_history','select'), 'Anon nao pode acessar historico de ciencia';
  assert not has_table_privilege('authenticated','public.event_handoff_task_history','update'), 'Equipe nao pode editar auditoria';
  assert not has_function_privilege('anon', 'public.update_event_handoff_task(uuid,text,text,timestamptz,text,integer)', 'execute'),
    'Anon nao pode alterar tarefas operacionais';
  assert not has_function_privilege('anon', 'public.acknowledge_event_handoff_changes(uuid,integer)', 'execute'),
    'Anon nao pode reconhecer mudancas operacionais';
  assert has_table_privilege('authenticated', 'public.active_event_handoffs', 'select'),
    'Equipe autenticada deve ler somente handoffs elegiveis';
  assert not has_table_privilege('anon', 'public.active_event_handoffs', 'select'),
    'Anon nao pode consultar handoffs operacionais';
end;
$$;

rollback;
