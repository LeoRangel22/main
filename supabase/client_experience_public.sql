-- Public proposal response: preserve stored snapshots and historical versions,
-- but only return fields needed to present the customer-facing experience.
-- Apply after phase1_commercial_ux.sql.
create or replace function public.get_public_proposal(proposal_token uuid)
returns table (
  id uuid,
  created_at timestamptz,
  cliente_nome text,
  cliente_email text,
  tipo_evento text,
  data_evento date,
  horario_evento time,
  convidados integer,
  duracao numeric,
  subtotal numeric,
  taxa_servico numeric,
  privatizacao numeric,
  total numeric,
  status text,
  snapshot jsonb,
  cliente_resposta text,
  cliente_resposta_em timestamptz,
  cliente_mensagem text,
  cliente_solicitacao jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select p.*
    from public.propostas p
    where p.public_token = proposal_token
      and p.public_token_revoked_at is null
    limit 1
  ),
  resolved as (
    select coalesce(current_p.id, requested.id) as resolved_id
    from requested
    left join public.propostas current_p
      on current_p.oportunidade_id = requested.oportunidade_id
     and current_p.is_current = true
     and current_p.public_token_revoked_at is null
     and current_p.public_token_expires_at > now()
  )
  select
    p.id,
    p.created_at,
    p.cliente_nome,
    p.cliente_email,
    p.tipo_evento,
    p.data_evento,
    p.horario_evento,
    p.convidados,
    p.duracao,
    p.subtotal,
    p.taxa_servico,
    p.privatizacao,
    p.total,
    p.status,
    jsonb_strip_nulls(jsonb_build_object(
      'event', jsonb_build_object(
        'type', p.snapshot #> '{event,type}',
        'validity', p.snapshot #> '{event,validity}',
        'signalDeadlineHours', p.snapshot #> '{event,signalDeadlineHours}',
        'signalDeadlineAt', p.snapshot #> '{event,signalDeadlineAt}',
        'clientLanguage', p.snapshot #> '{event,clientLanguage}'
      ),
      'totals', jsonb_build_object(
        'subtotal', p.subtotal,
        'serviceFee', p.taxa_servico,
        'privatizationAmount', p.privatizacao,
        'total', p.total,
        'privatization', jsonb_build_object('mode', p.snapshot #> '{totals,privatization,mode}')
      ),
      'selectedItems', p.snapshot -> 'selectedItems',
      'generalTerms', p.snapshot -> 'generalTerms',
      'paymentTerms', p.snapshot -> 'paymentTerms',
      'clienteResposta', p.snapshot -> 'clienteResposta',
      'versao', p.versao
    )) as snapshot,
    p.cliente_resposta,
    p.cliente_resposta_em,
    p.cliente_mensagem,
    p.cliente_solicitacao
  from public.propostas p
  join resolved r on r.resolved_id = p.id
  where p.public_token_revoked_at is null
    and p.public_token_expires_at > now()
  limit 1;
$$;

grant execute on function public.get_public_proposal(uuid) to anon, authenticated;
