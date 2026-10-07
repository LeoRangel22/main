-- Preserva a evidencia de cada tarefa antes de reabrir ou editar seu estado.
create table public.event_handoff_task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null,
  opportunity_id uuid not null,
  source_version integer not null,
  task_snapshot jsonb not null,
  reason text not null check (reason in ('version_reopened','task_updated')),
  changed_by uuid,
  recorded_at timestamptz not null default now()
);
create index event_handoff_task_history_task_idx on public.event_handoff_task_history(task_id, recorded_at desc);
create index event_handoff_task_history_opportunity_idx on public.event_handoff_task_history(opportunity_id, recorded_at desc);
alter table public.event_handoff_task_history enable row level security;
revoke all on public.event_handoff_task_history from public, anon, authenticated;
grant select on public.event_handoff_task_history to authenticated;
create policy team_read on public.event_handoff_task_history
  for select to authenticated using ((select public.is_team_member()));

create or replace function event_private.audit_event_handoff_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.event_handoff_task_history(task_id, opportunity_id, source_version, task_snapshot, reason, changed_by)
    values (old.id, old.opportunity_id, old.source_version, to_jsonb(old),
      case when new.source_version is distinct from old.source_version then 'version_reopened' else 'task_updated' end,
      auth.uid());
  end if;
  return new;
end;
$$;
revoke execute on function event_private.audit_event_handoff_task() from public, anon, authenticated;
create trigger event_audit_handoff_task
before update on public.event_handoff_tasks
for each row execute function event_private.audit_event_handoff_task();

create or replace function event_private.sync_event_handoff(p public.propostas)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_handoff public.event_handoffs;
  next_snapshot jsonb;
  next_fingerprint text;
  next_version integer;
  changed text[];
  event_day date;
begin
  if p.oportunidade_id is null or not coalesce(p.is_current, true) then
    return;
  end if;
  -- Serializa inclusive o cancelamento com as RPCs que gravam ciencia/tarefas.
  perform 1 from public.event_handoffs
  where opportunity_id = p.oportunidade_id for update;
  if p.status in ('cancelado','perdido','pos_venda')
     or not coalesce((p.status in ('confirmado','pagamento_final','planejamento','evento_proximo') or jsonb_typeof(p.snapshot -> 'pagamentoSinal') = 'object'), false) then
    return;
  end if;

  next_snapshot := event_private.handoff_source_snapshot(p);
  next_fingerprint := encode(extensions.digest(next_snapshot::text, 'sha256'), 'hex');
  event_day := p.data_evento;

  select * into current_handoff
  from public.event_handoffs
  where opportunity_id = p.oportunidade_id
  for update;

  if not found then
    insert into public.event_handoffs(
      opportunity_id, proposal_id, source_fingerprint, source_snapshot, generated_by
    ) values (
      p.oportunidade_id, p.id, next_fingerprint, next_snapshot, auth.uid()
    );
    next_version := 1;
  elsif current_handoff.source_fingerprint <> next_fingerprint then
    next_version := current_handoff.version + 1;
    changed := array_remove(array[
      case when current_handoff.source_snapshot -> 'event_type' is distinct from next_snapshot -> 'event_type' then 'Formato' end,
      case when current_handoff.source_snapshot -> 'event_date' is distinct from next_snapshot -> 'event_date' then 'Data' end,
      case when current_handoff.source_snapshot -> 'event_time' is distinct from next_snapshot -> 'event_time' then 'Horario' end,
      case when current_handoff.source_snapshot -> 'guests' is distinct from next_snapshot -> 'guests' then 'Convidados' end,
      case when current_handoff.source_snapshot -> 'duration' is distinct from next_snapshot -> 'duration' then 'Duracao' end,
      case when current_handoff.source_snapshot -> 'selected_items' is distinct from next_snapshot -> 'selected_items' then 'Cardapio e bebidas' end,
      case when current_handoff.source_snapshot -> 'preferences' is distinct from next_snapshot -> 'preferences' then 'Preferencias' end,
      case when current_handoff.source_snapshot -> 'notes' is distinct from next_snapshot -> 'notes' then 'Observacoes' end,
      case when current_handoff.source_snapshot -> 'extras' is distinct from next_snapshot -> 'extras' then 'Extras' end,
      case when current_handoff.source_snapshot -> 'total' is distinct from next_snapshot -> 'total' then 'Valor' end,
      case when current_handoff.source_snapshot -> 'privatization' is distinct from next_snapshot -> 'privatization' then 'Privatizacao' end,
      case when current_handoff.source_snapshot -> 'client_phone' is distinct from next_snapshot -> 'client_phone' then 'Contato do cliente' end,
      case when current_handoff.source_snapshot -> 'remaining_payment' is distinct from next_snapshot -> 'remaining_payment' then 'Pagamento restante' end
    ], null);

    if cardinality(changed) = 0 then
      changed := array['Dados da proposta'];
    end if;

    update public.event_handoffs
    set proposal_id = p.id,
        version = next_version,
        source_fingerprint = next_fingerprint,
        source_snapshot = next_snapshot,
        changes_pending = true,
        status = 'active',
        updated_at = now()
    where opportunity_id = p.oportunidade_id;

    insert into public.event_handoff_changes(
      opportunity_id, proposal_id, handoff_version, changed_fields, before_snapshot, after_snapshot
    ) values (
      p.oportunidade_id, p.id, next_version, changed, current_handoff.source_snapshot, next_snapshot
    );
  else
    update public.event_handoffs
    set proposal_id = p.id, updated_at = now()
    where opportunity_id = p.oportunidade_id;
    next_version := current_handoff.version;
  end if;

  insert into public.event_handoff_tasks(
    opportunity_id, task_key, sector, label, details, owner_label, due_at, sort_order, source_version
  )
  values
    (p.oportunidade_id, 'eventos_briefing', 'eventos', 'Conferir briefing final e contato do dia', 'Validar data, horario, pax, preferencias, extras e responsavel do cliente.', 'Equipe de Eventos', case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end, 10, next_version),
    (p.oportunidade_id, 'financeiro_saldo', 'financeiro', 'Alinhar saldo e comprovantes', 'Confirmar valores, vencimentos, bancos e divergencias antes de liberar a operacao.', 'Financeiro', case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end, 20, next_version),
    (p.oportunidade_id, 'cozinha_cardapio', 'cozinha', 'Validar cardapio, restricoes e producao', 'Conferir quantidades, dietas, alergias, tempos e mise en place.', 'Cozinha', case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end, 30, next_version),
    (p.oportunidade_id, 'bar_bebidas', 'bar', 'Validar bebidas e mise en place do bar', 'Conferir pacotes, quantidades, gelo, copos, insumos e servico.', 'Bar', case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end, 40, next_version),
    (p.oportunidade_id, 'estoque_insumos', 'estoque', 'Separar insumos e extras contratados', 'Cruzar ficha com estoque, compras e itens de terceiros.', 'Estoque', case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end, 50, next_version),
    (p.oportunidade_id, 'salao_montagem', 'salao', 'Definir montagem, equipe e linha do tempo', 'Confirmar layout, recepcao, sequencia de servico e desmontagem.', 'Salao', case when event_day is null then null else ((event_day - 2) + time '12:00') at time zone 'America/Sao_Paulo' end, 60, next_version),
    (p.oportunidade_id, 'gerencia_infra', 'gerencia', 'Validar infraestrutura e obrigatorios', 'Revisar seguranca, limpeza, gerador, ECAD, seguro, ambulancia, bombeiro, internet e estacionamento quando aplicavel.', 'Gerencia', case when event_day is null then null else ((event_day - 2) + time '12:00') at time zone 'America/Sao_Paulo' end, 70, next_version),
    (p.oportunidade_id, 'gerencia_go_no_go', 'gerencia', 'Fazer leitura final e liberar execucao', 'Confirmar que todos os setores deram ciencia e que nao ha mudanca pendente.', 'Gerencia', case when event_day is null then null else ((event_day - 1) + time '12:00') at time zone 'America/Sao_Paulo' end, 80, next_version)
  on conflict(opportunity_id, task_key) do nothing;

  if current_handoff.opportunity_id is not null and current_handoff.source_fingerprint <> next_fingerprint then
    update public.event_handoff_tasks
    set due_at = case task_key
          when 'eventos_briefing' then case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'financeiro_saldo' then case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'cozinha_cardapio' then case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'bar_bebidas' then case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'estoque_insumos' then case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'salao_montagem' then case when event_day is null then null else ((event_day - 2) + time '12:00') at time zone 'America/Sao_Paulo' end
          else case when event_day is null then null else ((event_day - case when task_key = 'gerencia_go_no_go' then 1 else 2 end) + time '12:00') at time zone 'America/Sao_Paulo' end
        end,
        source_version = next_version,
        status = 'pending',
        acknowledged_at = null,
        acknowledged_by = null,
        completed_at = null,
        completed_by = null,
        updated_at = now()
    where opportunity_id = p.oportunidade_id;
  end if;
end;
$$;

revoke execute on function event_private.sync_event_handoff(public.propostas) from public, anon, authenticated;

