-- P1: venda assistida permanece aprovada pelo vendedor no snapshot da proposta.
-- Este migration normaliza o handoff operacional, preserva o checklist legado e
-- impede que mudancas comerciais posteriores sejam absorvidas silenciosamente.

create table public.event_handoffs (
  opportunity_id uuid primary key references public.oportunidades(id) on delete cascade,
  proposal_id uuid not null references public.propostas(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  source_fingerprint text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed')),
  changes_pending boolean not null default false,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_handoffs_proposal_idx on public.event_handoffs(proposal_id);
create index event_handoffs_status_idx on public.event_handoffs(status, changes_pending);
create index event_handoffs_generated_by_idx on public.event_handoffs(generated_by) where generated_by is not null;

create table public.event_handoff_tasks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.event_handoffs(opportunity_id) on delete cascade,
  task_key text not null check (length(task_key) between 2 and 80),
  sector text not null check (sector in ('eventos', 'financeiro', 'cozinha', 'bar', 'salao', 'estoque', 'gerencia')),
  label text not null check (length(label) between 3 and 180),
  details text not null default '' check (length(details) <= 1200),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'blocked')),
  owner_label text not null check (length(owner_label) between 2 and 80),
  due_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text not null default '' check (length(notes) <= 2000),
  sort_order smallint not null default 0,
  source_version integer not null default 1 check (source_version > 0),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, task_key)
);

create index event_handoff_tasks_flow_idx on public.event_handoff_tasks(opportunity_id, status, due_at);
create index event_handoff_tasks_ack_actor_idx on public.event_handoff_tasks(acknowledged_by) where acknowledged_by is not null;
create index event_handoff_tasks_complete_actor_idx on public.event_handoff_tasks(completed_by) where completed_by is not null;

create table public.event_handoff_changes (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.event_handoffs(opportunity_id) on delete cascade,
  proposal_id uuid not null references public.propostas(id) on delete cascade,
  handoff_version integer not null check (handoff_version > 1),
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null
);

create index event_handoff_changes_timeline_idx on public.event_handoff_changes(opportunity_id, created_at desc);
create index event_handoff_changes_proposal_idx on public.event_handoff_changes(proposal_id);
create index event_handoff_changes_ack_actor_idx on public.event_handoff_changes(acknowledged_by) where acknowledged_by is not null;

alter table public.event_handoffs enable row level security;
alter table public.event_handoff_tasks enable row level security;
alter table public.event_handoff_changes enable row level security;

revoke all on public.event_handoffs, public.event_handoff_tasks, public.event_handoff_changes from public, anon, authenticated;
grant select on public.event_handoffs, public.event_handoff_tasks, public.event_handoff_changes to authenticated;

create policy team_read on public.event_handoffs
  for select to authenticated using ((select public.is_team_member()));
create policy team_read on public.event_handoff_tasks
  for select to authenticated using ((select public.is_team_member()));
create policy team_read on public.event_handoff_changes
  for select to authenticated using ((select public.is_team_member()));

create or replace function event_private.handoff_source_snapshot(p public.propostas)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'proposal_id', p.id,
    'proposal_version', p.versao,
    'event_type', p.tipo_evento,
    'event_date', p.data_evento,
    'event_time', p.horario_evento,
    'guests', p.convidados,
    'duration', p.duracao,
    'client_name', p.cliente_nome,
    'client_phone', p.cliente_whatsapp,
    'selected_items', coalesce(p.snapshot -> 'selectedItems', '[]'::jsonb),
    'preferences', coalesce(p.snapshot #>> '{event,preferences}', p.snapshot #>> '{event,preferencias}'),
    'notes', coalesce(p.snapshot #>> '{event,notes}', p.snapshot #>> '{event,observacoes}'),
    'extras', p.snapshot #>> '{event,extras}',
    'total', p.total,
    'privatization', p.privatizacao,
    'signal', p.snapshot -> 'pagamentoSinal',
    'remaining_payment', p.snapshot -> 'pagamentoRestante'
  ));
$$;

revoke execute on function event_private.handoff_source_snapshot(public.propostas) from public, anon, authenticated;

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
     or not (p.status in ('confirmado','pagamento_final','planejamento','evento_proximo') or p.snapshot -> 'pagamentoSinal' is not null) then
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
        updated_at = now()
    where opportunity_id = p.oportunidade_id
      and status <> 'done';
  end if;
end;
$$;

revoke execute on function event_private.sync_event_handoff(public.propostas) from public, anon, authenticated;

create or replace function event_private.sync_event_handoff_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform event_private.sync_event_handoff(new);
  return new;
end;
$$;

revoke execute on function event_private.sync_event_handoff_trigger() from public, anon, authenticated;

create trigger event_sync_operational_handoff
after insert or update of status, snapshot, data_evento, horario_evento, convidados, duracao, total, privatizacao, cliente_whatsapp, is_current
on public.propostas
for each row execute function event_private.sync_event_handoff_trigger();

create or replace function public.update_event_handoff_task(
  target_task uuid,
  task_status text,
  task_owner_label text default null,
  task_due_at timestamptz default null,
  task_notes text default null
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

create or replace function public.acknowledge_event_handoff_changes(target_opportunity uuid)
returns public.event_handoffs
language plpgsql
security definer
set search_path = ''
as $$
declare
  handoff public.event_handoffs;
begin
  perform event_private.require_team();

  update public.event_handoff_changes
  set acknowledged_at = coalesce(acknowledged_at, now()),
      acknowledged_by = coalesce(acknowledged_by, auth.uid())
  where opportunity_id = target_opportunity
    and acknowledged_at is null;

  update public.event_handoffs h
  set changes_pending = false,
      status = case
        when not exists (
          select 1 from public.event_handoff_tasks t
          where t.opportunity_id = h.opportunity_id and t.status <> 'done'
        ) then 'completed'
        else 'active'
      end,
      updated_at = now()
  where opportunity_id = target_opportunity
  returning * into handoff;

  if handoff.opportunity_id is null then
    raise exception 'Handoff operacional nao encontrado.';
  end if;
  return handoff;
end;
$$;

revoke execute on function public.update_event_handoff_task(uuid, text, text, timestamptz, text) from public, anon;
revoke execute on function public.acknowledge_event_handoff_changes(uuid) from public, anon;
grant execute on function public.update_event_handoff_task(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.acknowledge_event_handoff_changes(uuid) to authenticated;

-- Backfill seguro e idempotente para vendas que ja chegaram ao pos-sinal.
do $backfill$
declare
  proposal_row public.propostas;
begin
  for proposal_row in
    select p.*
    from public.propostas p
    where coalesce(p.is_current, true)
      and p.oportunidade_id is not null
      and (p.status in ('confirmado','pagamento_final','planejamento','evento_proximo') or p.snapshot -> 'pagamentoSinal' is not null)
  loop
    perform event_private.sync_event_handoff(proposal_row);
  end loop;
end
$backfill$;
