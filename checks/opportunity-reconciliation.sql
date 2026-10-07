-- Regressão P0: sincronização, responsável padrão e backfill idempotente.
-- Executar após a migração; todas as fixtures são revertidas.
begin;

do $$
declare
  actor uuid;
  fixture_opportunity_id uuid;
  proposal_id uuid;
  first_run jsonb;
  second_run jsonb;
begin
  select id into actor
  from auth.users
  where lower(email) = 'leorangel@gmail.com'
  limit 1;
  assert actor is not null, 'Gestor de teste indisponível';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor, 'email', 'leorangel@gmail.com', 'role', 'authenticated')::text,
    true
  );

  insert into public.oportunidades(
    cliente_nome,
    data_evento,
    status,
    valor_atual,
    proxima_acao,
    proxima_acao_em,
    metadata
  ) values (
    'Fixture reconciliação P0',
    '2099-12-20',
    'lead_recebido',
    0,
    'Responder lead',
    now() - interval '1 day',
    '{"next_action_source":"default"}'::jsonb
  ) returning id into fixture_opportunity_id;

  insert into public.propostas(
    oportunidade_id,
    cliente_nome,
    cliente_email,
    cliente_whatsapp,
    tipo_evento,
    data_evento,
    horario_evento,
    convidados,
    duracao,
    subtotal,
    taxa_servico,
    privatizacao,
    total,
    status,
    publication_status,
    responsavel_email,
    snapshot
  ) values (
    fixture_opportunity_id,
    'Fixture reconciliação P0',
    'fixture-reconciliation@example.test',
    '21999990000',
    'Evento corporativo',
    '2099-12-20',
    '18:00',
    40,
    3,
    10000,
    1200,
    0,
    11200,
    'negociacao',
    'ready',
    'eventos@embaixadacarioca.com.br',
    '{"event":{},"totals":{}}'::jsonb
  ) returning id into proposal_id;

  assert (
    select status = 'negociacao'
      and responsavel_email = 'eventos@embaixadacarioca.com.br'
      and responsavel_id = (
        select id from auth.users where lower(email) = 'eventos@embaixadacarioca.com.br' limit 1
      )
      and valor_atual = 11200
      and proxima_acao = 'Avancar negociacao'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Trigger deve sincronizar etapa, responsável, valor e próxima ação';

  update public.propostas
  set status = 'proposta_enviada',
      total = 11800,
      responsavel_email = 'leorangel@gmail.com',
      responsavel_id = actor
  where id = proposal_id;

  assert (
    select status = 'proposta_enviada'
      and responsavel_email = 'leorangel@gmail.com'
      and responsavel_id = actor
      and valor_atual = 11800
      and proxima_acao = 'Retomar cliente'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Atualização da proposta atual deve prevalecer integralmente';

  update public.oportunidades
  set proxima_acao = null,
      proxima_acao_em = null,
      metadata = metadata - 'next_action_source'
  where id = fixture_opportunity_id;

  update public.propostas
  set total = 11801
  where id = proposal_id;

  assert (
    select valor_atual = 11801
      and proxima_acao = 'Retomar cliente'
      and proxima_acao_em > now()
      and metadata ->> 'next_action_source' = 'default'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Sincronização deve reparar a próxima ação mesmo sem mudança de etapa';

  update public.oportunidades
  set proxima_acao = 'Retornar após reunião do cliente',
      proxima_acao_em = now() + interval '4 days',
      metadata = jsonb_set(metadata, '{next_action_source}', '"manual"'::jsonb, true)
  where id = fixture_opportunity_id;

  update public.propostas
  set total = 11800
  where id = proposal_id;

  assert (
    select proxima_acao = 'Retornar após reunião do cliente'
      and proxima_acao_em > now() + interval '3 days'
      and metadata ->> 'next_action_source' = 'manual'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Sincronização não pode sobrescrever plano manual';

  update public.oportunidades
  set status = 'lead_recebido',
      responsavel_email = null,
      responsavel_id = null,
      valor_atual = 0,
      proxima_acao = 'Responder lead',
      proxima_acao_em = now() - interval '1 day',
      metadata = '{"next_action_source":"default"}'::jsonb
  where id = fixture_opportunity_id;

  first_run := event_private.reconcile_event_opportunities(
    'p0_check_reconciliation',
    'eventos@embaixadacarioca.com.br',
    now()
  );

  assert (first_run ->> 'updated')::integer >= 1, 'Backfill deve corrigir a fixture divergente';
  assert (
    select status = 'proposta_enviada'
      and responsavel_email = 'leorangel@gmail.com'
      and responsavel_id = actor
      and valor_atual = 11800
      and proxima_acao = 'Retomar cliente'
      and proxima_acao_em > now()
      and metadata #>> '{p0_reconciliation,run}' = 'p0_check_reconciliation'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Backfill deve reconciliar e reagendar sem perder a proposta atual';

  assert exists (
    select 1
    from public.event_messages m
    where m.opportunity_id = fixture_opportunity_id
      and m.external_id = 'reconcile:p0_check_reconciliation:' || fixture_opportunity_id::text
  ), 'Backfill deve deixar trilha interna';

  second_run := event_private.reconcile_event_opportunities(
    'p0_check_reconciliation',
    'eventos@embaixadacarioca.com.br',
    now()
  );
  assert (second_run ->> 'updated')::integer = 0, 'Segunda execução não pode alterar registros';
  assert (second_run ->> 'notes_created')::integer = 0, 'Segunda execução não pode duplicar histórico';

  assert not has_function_privilege(
    'authenticated',
    'public.sync_opportunity_from_proposal()',
    'EXECUTE'
  ), 'Função de trigger não pode ser RPC pública';
  assert not has_function_privilege(
    'authenticated',
    'event_private.reconcile_event_opportunities(text,text,timestamptz)',
    'EXECUTE'
  ), 'Backfill interno não pode ser exposto à aplicação';
end $$;

rollback;
