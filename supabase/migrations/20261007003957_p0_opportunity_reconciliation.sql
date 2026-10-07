-- P0: make the current proposal authoritative for commercial state and
-- reconcile the existing opportunity backlog without deleting history.

update public.event_commercial_policy
set default_owner = 'eventos@embaixadacarioca.com.br',
    updated_at = now()
where id
  and default_owner is distinct from 'eventos@embaixadacarioca.com.br';

create or replace function public.sync_opportunity_from_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  resolved_owner_email text;
  resolved_owner_id uuid;
begin
  if new.oportunidade_id is null or not coalesce(new.is_current, true) then
    return new;
  end if;

  resolved_owner_email := nullif(lower(trim(new.responsavel_email)), '');
  if resolved_owner_email is null then
    select coalesce(
      nullif(lower(trim(o.responsavel_email)), ''),
      p.default_owner
    )
    into resolved_owner_email
    from public.oportunidades o
    left join public.event_commercial_policy p on p.id
    where o.id = new.oportunidade_id;
  end if;

  if resolved_owner_email is not null then
    if new.responsavel_id is not null
       and exists (
         select 1
         from auth.users u
         where u.id = new.responsavel_id
           and lower(u.email) = resolved_owner_email
       ) then
      resolved_owner_id := new.responsavel_id;
    else
      select u.id
      into resolved_owner_id
      from auth.users u
      where lower(u.email) = resolved_owner_email
      limit 1;
    end if;
  end if;

  update public.oportunidades o
  set
    status = case when new.status = 'cancelado' then 'perdido' else new.status end,
    cliente_nome = new.cliente_nome,
    cliente_email = new.cliente_email,
    cliente_whatsapp = new.cliente_whatsapp,
    tipo_evento = new.tipo_evento,
    data_evento = new.data_evento,
    horario_evento = new.horario_evento,
    convidados = new.convidados,
    valor_atual = coalesce(new.total, 0),
    responsavel_id = resolved_owner_id,
    responsavel_email = resolved_owner_email,
    proxima_acao = case
      when new.status = 'cancelado' then null
      when coalesce(o.metadata ->> 'next_action_source', '') in ('manual', 'client_response', 'scheduled_return')
        then o.proxima_acao
      when new.status = 'lead_recebido' then 'Responder lead'
      when new.status = 'proposta_pronta' then 'Enviar proposta'
      when new.status = 'proposta_enviada' then 'Retomar cliente'
      when new.status = 'negociacao' then 'Avancar negociacao'
      when new.status = 'confirmado' and
        coalesce((new.snapshot #>> '{pagamentoSinal,valor}')::numeric, 0)
        + coalesce((new.snapshot #>> '{pagamentoRestante,valor}')::numeric, 0)
        >= coalesce(new.total, 0) - 0.01 then 'Enviar para planejamento'
      when new.status = 'confirmado' then 'Cobrar pagamento restante'
      when new.status = 'pagamento_final' then 'Registrar pagamento restante'
      when new.status = 'planejamento' then 'Concluir checklist operacional'
      when new.status = 'evento_proximo' then 'Revisar evento 48h'
      when new.status = 'pos_venda' then 'Fazer pos-venda'
      else coalesce(o.proxima_acao, 'Revisar próximo passo')
    end,
    proxima_acao_em = case
      when new.status = 'cancelado' then null
      when coalesce(o.metadata ->> 'next_action_source', '') in ('manual', 'client_response', 'scheduled_return')
        then o.proxima_acao_em
      when o.status is not distinct from (case when new.status = 'cancelado' then 'perdido' else new.status end)
        and o.proxima_acao_em > now() then o.proxima_acao_em
      when new.status in ('lead_recebido', 'proposta_pronta') then now() + interval '2 hours'
      when new.status = 'pos_venda' then now() + interval '2 days'
      else now() + interval '1 day'
    end,
    metadata = case
      when new.status = 'cancelado' then o.metadata
      when coalesce(o.metadata ->> 'next_action_source', '') in ('manual', 'client_response', 'scheduled_return')
        then o.metadata
      else jsonb_set(coalesce(o.metadata, '{}'::jsonb), '{next_action_source}', '"default"'::jsonb, true)
    end,
    ultima_resposta_cliente_em = greatest(new.cliente_resposta_em, o.ultima_resposta_cliente_em),
    ganho_em = case
      when new.status in ('confirmado', 'pagamento_final', 'planejamento', 'evento_proximo', 'pos_venda')
        then coalesce(o.ganho_em, now())
      else o.ganho_em
    end,
    motivo_perda = case
      when new.status = 'cancelado'
        then coalesce(nullif(new.snapshot #>> '{cancelamento,motivo}', ''), o.motivo_perda, 'Cancelado')
      else null
    end,
    perdido_em = case
      when new.status = 'cancelado' then coalesce(o.perdido_em, now())
      else null
    end
  where o.id = new.oportunidade_id;

  return new;
end;
$function$;

revoke execute on function public.sync_opportunity_from_proposal()
from public, anon, authenticated;

create or replace function event_private.reconcile_event_opportunities(
  run_key text,
  owner_email text,
  reference_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_owner text := nullif(lower(trim(owner_email)), '');
  owner_id uuid;
  affected integer := 0;
  notes_created integer := 0;
begin
  if run_key !~ '^[a-z0-9_]{8,80}$' then
    raise exception 'Identificador de reconciliação inválido';
  end if;
  if normalized_owner not in ('leorangel@gmail.com', 'eventos@embaixadacarioca.com.br') then
    raise exception 'Responsável padrão não habilitado';
  end if;

  select u.id
  into owner_id
  from auth.users u
  where lower(u.email) = normalized_owner
  limit 1;
  if owner_id is null then
    raise exception 'Responsável padrão sem usuário ativo';
  end if;

  update public.event_commercial_policy
  set default_owner = normalized_owner,
      updated_at = reference_at
  where id
    and default_owner is distinct from normalized_owner;

  with current_proposal as (
    select p.*
    from public.propostas p
    where p.is_current is true
  ), source as (
    select
      o.*,
      p.id as proposal_id,
      p.snapshot as proposal_snapshot,
      coalesce(p.total, o.valor_atual, 0) as desired_value,
      case
        when p.id is null then o.status
        when p.status = 'cancelado' then 'perdido'
        else p.status
      end as desired_status,
      coalesce(p.data_evento, o.data_evento) as desired_event_date,
      case
        when nullif(lower(trim(p.responsavel_email)), '') is not null
          then lower(trim(p.responsavel_email))
        when nullif(lower(trim(o.responsavel_email)), '') is not null
          then lower(trim(o.responsavel_email))
        when coalesce(p.data_evento, o.data_evento) >= (reference_at at time zone 'America/Sao_Paulo')::date
          and (case when p.status = 'cancelado' then 'perdido' else coalesce(p.status, o.status) end)
            not in ('perdido', 'cancelado', 'pos_venda')
          then normalized_owner
        else null
      end as desired_owner_email,
      p.cliente_nome as proposal_client_name,
      p.cliente_email as proposal_client_email,
      p.cliente_whatsapp as proposal_client_whatsapp,
      p.tipo_evento as proposal_event_type,
      p.data_evento as proposal_event_date,
      p.horario_evento as proposal_event_time,
      p.convidados as proposal_guests,
      p.cliente_resposta_em as proposal_response_at
    from public.oportunidades o
    left join current_proposal p on p.oportunidade_id = o.id
  ), ranked as (
    select
      s.*,
      case
        when s.desired_event_date >= (reference_at at time zone 'America/Sao_Paulo')::date
          and s.desired_status not in ('perdido', 'cancelado', 'pos_venda')
          and (s.proxima_acao_em is null or s.proxima_acao_em < reference_at)
          and coalesce(s.metadata ->> 'next_action_source', '') not in ('manual', 'client_response', 'scheduled_return')
          and s.metadata #>> '{p0_reconciliation,run}' is distinct from run_key
          then row_number() over (
            order by
              case s.desired_status
                when 'confirmado' then 1
                when 'pagamento_final' then 2
                when 'negociacao' then 3
                when 'lead_recebido' then 4
                when 'proposta_pronta' then 5
                when 'proposta_enviada' then 6
                when 'planejamento' then 7
                when 'evento_proximo' then 8
                else 9
              end,
              s.desired_event_date nulls last,
              s.created_at,
              s.id
          )
      end as schedule_rank
    from source s
  ), business_days as (
    select
      row_number() over (order by candidate_day)::integer as business_day_number,
      candidate_day::date as business_day
    from generate_series(
      (reference_at at time zone 'America/Sao_Paulo')::date + 1,
      (reference_at at time zone 'America/Sao_Paulo')::date + 21,
      interval '1 day'
    ) candidate_day
    where extract(isodow from candidate_day) between 1 and 5
  ), desired as (
    select
      r.*,
      coalesce(
        (
          select u.id
          from auth.users u
          where lower(u.email) = r.desired_owner_email
          limit 1
        ),
        case when r.desired_owner_email = normalized_owner then owner_id end
      ) as desired_owner_id,
      case
        when r.desired_status in ('perdido', 'cancelado') then null
        when r.schedule_rank is null then r.proxima_acao
        when r.desired_status = 'lead_recebido' then 'Responder lead'
        when r.desired_status = 'proposta_pronta' then 'Enviar proposta'
        when r.desired_status = 'proposta_enviada' then 'Retomar cliente'
        when r.desired_status = 'negociacao' then 'Avançar negociação'
        when r.desired_status = 'confirmado' and
          coalesce((r.proposal_snapshot #>> '{pagamentoSinal,valor}')::numeric, 0)
          + coalesce((r.proposal_snapshot #>> '{pagamentoRestante,valor}')::numeric, 0)
          >= r.desired_value - 0.01 then 'Enviar para planejamento'
        when r.desired_status = 'confirmado' then 'Cobrar pagamento restante'
        when r.desired_status = 'pagamento_final' then 'Registrar pagamento restante'
        when r.desired_status = 'planejamento' then 'Concluir checklist operacional'
        when r.desired_status = 'evento_proximo' then 'Revisar evento 48h'
        else coalesce(r.proxima_acao, 'Revisar próximo passo')
      end as desired_next_action,
      case
        when r.desired_status in ('perdido', 'cancelado') then null
        when r.schedule_rank is null then r.proxima_acao_em
        else (
          (
            select bd.business_day
            from business_days bd
            where bd.business_day_number = ((r.schedule_rank - 1) / 16)::integer + 1
          ) + time '09:00' + (((r.schedule_rank - 1) % 16)::integer * interval '30 minutes')
        ) at time zone 'America/Sao_Paulo'
      end as desired_next_action_at
    from ranked r
  ), updated as (
    update public.oportunidades o
    set
      status = d.desired_status,
      cliente_nome = case when d.proposal_id is not null then d.proposal_client_name else o.cliente_nome end,
      cliente_email = case when d.proposal_id is not null then d.proposal_client_email else o.cliente_email end,
      cliente_whatsapp = case when d.proposal_id is not null then d.proposal_client_whatsapp else o.cliente_whatsapp end,
      tipo_evento = case when d.proposal_id is not null then d.proposal_event_type else o.tipo_evento end,
      data_evento = case when d.proposal_id is not null then d.proposal_event_date else o.data_evento end,
      horario_evento = case when d.proposal_id is not null then d.proposal_event_time else o.horario_evento end,
      convidados = case when d.proposal_id is not null then d.proposal_guests else o.convidados end,
      valor_atual = d.desired_value,
      responsavel_email = d.desired_owner_email,
      responsavel_id = d.desired_owner_id,
      proxima_acao = d.desired_next_action,
      proxima_acao_em = d.desired_next_action_at,
      ultima_resposta_cliente_em = greatest(o.ultima_resposta_cliente_em, d.proposal_response_at),
      ganho_em = case
        when d.desired_status in ('confirmado', 'pagamento_final', 'planejamento', 'evento_proximo', 'pos_venda')
          then coalesce(o.ganho_em, reference_at)
        else o.ganho_em
      end,
      motivo_perda = case
        when d.desired_status = 'perdido' and d.proposal_id is not null
          then coalesce(nullif(d.proposal_snapshot #>> '{cancelamento,motivo}', ''), o.motivo_perda, 'Cancelado')
        when d.desired_status = 'perdido' then o.motivo_perda
        else null
      end,
      perdido_em = case
        when d.desired_status = 'perdido' then coalesce(o.perdido_em, reference_at)
        else null
      end,
      metadata = case
        when d.schedule_rank is not null then
          jsonb_set(
            jsonb_set(coalesce(o.metadata, '{}'::jsonb), '{next_action_source}', '"default"'::jsonb, true),
            '{p0_reconciliation}',
            jsonb_build_object('run', run_key, 'at', reference_at, 'proposal_id', d.proposal_id),
            true
          )
        else
          jsonb_set(
            coalesce(o.metadata, '{}'::jsonb),
            '{p0_reconciliation}',
            jsonb_build_object('run', run_key, 'at', reference_at, 'proposal_id', d.proposal_id),
            true
          )
      end
    from desired d
    where o.id = d.id
      and (
        o.status is distinct from d.desired_status
        or o.valor_atual is distinct from d.desired_value
        or nullif(lower(trim(o.responsavel_email)), '') is distinct from d.desired_owner_email
        or o.responsavel_id is distinct from d.desired_owner_id
        or o.proxima_acao is distinct from d.desired_next_action
        or o.proxima_acao_em is distinct from d.desired_next_action_at
        or (d.proposal_id is not null and (
          o.cliente_nome is distinct from d.proposal_client_name
          or o.cliente_email is distinct from d.proposal_client_email
          or o.cliente_whatsapp is distinct from d.proposal_client_whatsapp
          or o.tipo_evento is distinct from d.proposal_event_type
          or o.data_evento is distinct from d.proposal_event_date
          or o.horario_evento is distinct from d.proposal_event_time
          or o.convidados is distinct from d.proposal_guests
        ))
      )
    returning o.id, o.responsavel_email, o.proxima_acao, o.proxima_acao_em
  ), notes as (
    insert into public.event_messages(
      opportunity_id,
      channel,
      direction,
      source,
      body,
      occurred_at,
      external_id,
      read_at
    )
    select
      u.id,
      'note',
      'internal',
      'system',
      left(
        'Reconciliação P0: responsável ' || coalesce(u.responsavel_email, 'não definido') ||
        ' · próxima ação ' || coalesce(u.proxima_acao, 'encerrada') ||
        case when u.proxima_acao_em is not null then ' · prazo ' || u.proxima_acao_em::text else '' end,
        6000
      ),
      reference_at,
      'reconcile:' || run_key || ':' || u.id::text,
      reference_at
    from updated u
    on conflict (channel, external_id) where external_id is not null do nothing
    returning id
  )
  select
    (select count(*) from updated),
    (select count(*) from notes)
  into affected, notes_created;

  return jsonb_build_object(
    'run', run_key,
    'updated', affected,
    'notes_created', notes_created,
    'default_owner', normalized_owner
  );
end;
$function$;

revoke all on function event_private.reconcile_event_opportunities(text, text, timestamptz)
from public, anon, authenticated;

select event_private.reconcile_event_opportunities(
  'p0_sync_20261007',
  'eventos@embaixadacarioca.com.br',
  now()
);
