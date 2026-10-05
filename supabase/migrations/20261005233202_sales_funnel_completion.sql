-- Holistic funnel audit: complete public versions, preserve assigned owners,
-- clear terminal follow-ups and restrict internal trigger RPC permissions.
CREATE OR REPLACE FUNCTION public.sync_opportunity_from_proposal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    owner_changed := new.responsavel_email is distinct from old.responsavel_email;
  end if;
  if new.oportunidade_id is null or not coalesce(new.is_current, true) then
    return new;
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
    responsavel_id = case
      when nullif(trim(o.responsavel_email), '') is null or (owner_changed and nullif(trim(new.responsavel_email), '') is not null)
        then new.responsavel_id else o.responsavel_id end,
    responsavel_email = case
      when nullif(trim(o.responsavel_email), '') is null or (owner_changed and nullif(trim(new.responsavel_email), '') is not null)
        then coalesce(nullif(trim(new.responsavel_email), ''), o.responsavel_email) else o.responsavel_email end,
    ultima_resposta_cliente_em = coalesce(new.cliente_resposta_em, ultima_resposta_cliente_em),
    ganho_em = case
      when new.status in ('confirmado','pagamento_final','planejamento','evento_proximo','pos_venda')
        then coalesce(ganho_em, now())
      else ganho_em
    end,
    motivo_perda = case
      when new.status = 'cancelado'
        then coalesce(nullif(new.snapshot #>> '{cancelamento,motivo}', ''), motivo_perda, 'Cancelado')
      else null
    end,
    perdido_em = case
      when new.status = 'cancelado' then coalesce(perdido_em, now())
      else null
    end
  where id = new.oportunidade_id;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_default_next_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Closed opportunities cannot keep sales follow-up deadlines.
  if new.status in ('perdido', 'cancelado') then
    new.proxima_acao := null;
    new.proxima_acao_em := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.metadata ->> 'next_action_source' = 'default'
     and new.proxima_acao is not distinct from old.proxima_acao
     and new.proxima_acao_em is not distinct from old.proxima_acao_em then
    new.proxima_acao := null;
    new.proxima_acao_em := null;
  end if;

  -- Um plano preenchido pela equipe (inclusive em registros antigos) prevalece.
  if nullif(trim(coalesce(new.proxima_acao, '')), '') is not null then
    return new;
  end if;

  if new.status = 'lead_recebido' then
    new.proxima_acao := 'Responder lead';
    new.proxima_acao_em := now() + interval '2 hours';
  elsif new.status = 'proposta_pronta' then
    new.proxima_acao := 'Enviar proposta';
    new.proxima_acao_em := now() + interval '2 hours';
  elsif new.status = 'proposta_enviada' then
    new.proxima_acao := 'Retomar cliente';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status = 'negociacao' then
    new.proxima_acao := 'Avancar negociacao';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status in ('confirmado', 'pagamento_final') then
    new.proxima_acao := 'Fechar pagamento';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status in ('planejamento', 'evento_proximo') then
    new.proxima_acao := 'Revisar operacao';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status = 'pos_venda' then
    new.proxima_acao := 'Fazer pos-venda';
    new.proxima_acao_em := now() + interval '2 days';
  end if;
  if new.proxima_acao is not null then
    new.metadata := jsonb_set(coalesce(new.metadata, '{}'::jsonb), '{next_action_source}', '"default"'::jsonb, true);
  end if;
  return new;
end;
$function$;


-- Trigger-only functions are not public RPC endpoints.
do $permissions$
declare f record;
begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end
$permissions$;
alter function public.notify_new_lead_fn() set search_path = '';
revoke execute on function public.get_my_event_history() from public, anon;
grant execute on function public.get_my_event_history() to authenticated;
revoke execute on function public.refresh_my_proposal_link(uuid) from public, anon;
grant execute on function public.refresh_my_proposal_link(uuid) to authenticated;

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
      'versionChanges', p.snapshot -> 'versionChanges',
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

-- Remove obsolete deadlines only for opportunities already closed.
update public.oportunidades set proxima_acao = null, proxima_acao_em = null
where status in ('perdido', 'cancelado') and (proxima_acao is not null or proxima_acao_em is not null);
