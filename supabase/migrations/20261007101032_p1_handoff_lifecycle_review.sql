-- Revisao final P1. Preserva todo o historico; somente eventos elegiveis ficam ativos.

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
  if p.oportunidade_id is null
     or not coalesce(p.is_current, true)
     or p.status in ('cancelado','perdido','pos_venda')
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

create or replace view public.active_event_handoffs
with (security_invoker = true)
as
select h.*
from public.event_handoffs h
join public.propostas p on p.oportunidade_id = h.opportunity_id
where coalesce(p.is_current, true)
  and p.status not in ('cancelado','perdido','pos_venda')
  and (p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
    or jsonb_typeof(p.snapshot -> 'pagamentoSinal') = 'object');
revoke all on public.active_event_handoffs from public, anon, authenticated;
grant select on public.active_event_handoffs to authenticated;

create or replace function public.update_event_handoff_task(
  target_task uuid,
  task_status text,
  task_owner_label text default null,
  task_due_at timestamptz default null,
  task_notes text default null,
  target_source_version integer default null
)
returns public.event_handoff_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.event_handoff_tasks;
begin
  perform event_private.require_team();
  if task_status not in ('pending', 'in_progress', 'done', 'blocked') then
    raise exception 'Status da tarefa invalido.';
  end if;

  perform 1 from public.event_handoffs h
  join public.event_handoff_tasks t on t.opportunity_id = h.opportunity_id
  where t.id = target_task for update of h;
  if not exists (select 1 from public.active_event_handoff_tasks where id = target_task) then
    raise exception 'Tarefa operacional inativa.';
  end if;

  select * into task from public.event_handoff_tasks where id = target_task;
  if target_source_version is null or task.source_version <> target_source_version then
    raise exception 'A tarefa mudou. Recarregue antes de registrar a ciencia.';
  end if;

  update public.event_handoff_tasks
  set status = task_status,
      owner_label = coalesce(nullif(trim(task_owner_label), ''), owner_label),
      due_at = coalesce(task_due_at, due_at),
      notes = case when task_notes is null then notes else left(trim(task_notes), 2000) end,
      acknowledged_at = coalesce(acknowledged_at, now()),
      acknowledged_by = coalesce(acknowledged_by, auth.uid()),
      completed_at = case when task_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when task_status = 'done' then coalesce(completed_by, auth.uid()) else null end,
      updated_at = now()
  where id = target_task
  returning * into task;

  if task.id is null then
    raise exception 'Tarefa operacional nao encontrada.';
  end if;

  update public.event_handoffs h
  set status = case
        when not h.changes_pending and not exists (
          select 1 from public.event_handoff_tasks t
          where t.opportunity_id = h.opportunity_id and t.status <> 'done'
        ) then 'completed'
        else 'active'
      end,
      updated_at = now()
  where h.opportunity_id = task.opportunity_id;

  return task;
end;
$$;

create or replace function public.acknowledge_event_handoff_changes(
  target_opportunity uuid,
  target_version integer
)
returns public.event_handoffs
language plpgsql
security definer
set search_path = ''
as $$
declare
  handoff public.event_handoffs;
begin
  perform event_private.require_team();

  select * into handoff
  from public.event_handoffs
  where opportunity_id = target_opportunity
  for update;

  if not exists (select 1 from public.active_event_handoffs where opportunity_id = target_opportunity) then
    raise exception 'Handoff operacional inativo.';
  end if;

  if handoff.opportunity_id is null then
    raise exception 'Handoff operacional nao encontrado.';
  end if;
  if target_version is null or handoff.version <> target_version then
    raise exception 'O handoff mudou. Recarregue antes de registrar a ciencia.';
  end if;

  update public.event_handoff_changes
  set acknowledged_at = coalesce(acknowledged_at, now()),
      acknowledged_by = coalesce(acknowledged_by, auth.uid())
  where opportunity_id = target_opportunity
    and acknowledged_at is null
    and handoff_version <= target_version;

  update public.event_handoffs h
  set changes_pending = exists (
        select 1
        from public.event_handoff_changes c
        where c.opportunity_id = h.opportunity_id
          and c.acknowledged_at is null
      ),
      status = case
        when not exists (
          select 1
          from public.event_handoff_changes c
          where c.opportunity_id = h.opportunity_id
            and c.acknowledged_at is null
        ) and not exists (
          select 1
          from public.event_handoff_tasks t
          where t.opportunity_id = h.opportunity_id
            and t.status <> 'done'
        ) then 'completed'
        else 'active'
      end,
      updated_at = now()
  where h.opportunity_id = target_opportunity
  returning * into handoff;

  return handoff;
end;
$$;

revoke execute on function public.acknowledge_event_handoff_changes(uuid, integer) from public, anon;
grant execute on function public.acknowledge_event_handoff_changes(uuid, integer) to authenticated;

-- Corrige tarefas de versoes anteriores sem apagar notas ou historico.
update public.event_handoff_tasks t
set status = 'pending', source_version = h.version,
    acknowledged_at = null, acknowledged_by = null,
    completed_at = null, completed_by = null, updated_at = now()
from public.active_event_handoffs h
where t.opportunity_id = h.opportunity_id and t.source_version < h.version;
update public.event_handoffs h
set status = 'active', updated_at = now()
where h.status = 'completed'
  and exists (select 1 from public.active_event_handoffs a where a.opportunity_id = h.opportunity_id)
  and exists (select 1 from public.event_handoff_tasks t where t.opportunity_id = h.opportunity_id and t.status <> 'done');

revoke execute on function public.update_event_handoff_task(uuid,text,text,timestamptz,text) from public, anon, authenticated;
revoke execute on function public.update_event_handoff_task(uuid,text,text,timestamptz,text,integer) from public, anon;
grant execute on function public.update_event_handoff_task(uuid,text,text,timestamptz,text,integer) to authenticated;
