-- Correção do fluxo público de aprovação com comprovante.
-- Use no Supabase SQL Editor.
--
-- Resultado:
-- 1. Novas propostas aprovadas com comprovante passam para "confirmado" / Sinal recebido.
-- 2. O comprovante vira pagamentoSinal no snapshot.
-- 3. Propostas já aprovadas com comprovante e ainda em negociação são corrigidas.

drop function if exists public.respond_public_proposal(uuid, text, date, time, integer, text);
drop function if exists public.respond_public_proposal(uuid, text, date, time, integer, text, jsonb);

create or replace function public.respond_public_proposal(
  proposal_token uuid,
  action text,
  requested_date date default null,
  requested_time time default null,
  requested_guests integer default null,
  message text default null,
  payment_proof jsonb default null
)
returns table (
  ok boolean,
  status text,
  cliente_resposta text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_action text := lower(trim(coalesce(action, '')));
  clean_message text := nullif(trim(coalesce(message, '')), '');
  response_payload jsonb;
  history_entry jsonb;
  signal_history_entry jsonb := null;
  clean_proof jsonb := null;
  signal_payment jsonb := null;
  next_status text;
  new_snapshot jsonb;
  proposal_total numeric := 0;
begin
  if normalized_action not in ('confirmar', 'cancelar', 'alteracao') then
    raise exception 'Acao invalida.';
  end if;

  if requested_guests is not null and requested_guests < 1 then
    raise exception 'Numero de convidados invalido.';
  end if;

  if normalized_action in ('cancelar', 'alteracao') and length(coalesce(clean_message, '')) < 3 then
    raise exception 'Mensagem obrigatoria.';
  end if;

  if payment_proof is not null then
    clean_proof := jsonb_strip_nulls(jsonb_build_object(
      'nome', nullif(trim(coalesce(payment_proof ->> 'nome', '')), ''),
      'tipo', nullif(trim(coalesce(payment_proof ->> 'tipo', '')), ''),
      'tamanho', nullif(trim(coalesce(payment_proof ->> 'tamanho', '')), ''),
      'dataUrl', nullif(trim(coalesce(payment_proof ->> 'dataUrl', '')), ''),
      'anexadoEm', coalesce(payment_proof ->> 'anexadoEm', now()::text)
    ));
  end if;

  response_payload := jsonb_strip_nulls(jsonb_build_object(
    'acao', normalized_action,
    'data', requested_date,
    'horario', requested_time,
    'convidados', requested_guests,
    'mensagem', clean_message,
    'comprovante', clean_proof,
    'registradoEm', now()
  ));

  history_entry := jsonb_build_object(
    'id', 'cliente-' || extract(epoch from now())::text,
    'type', 'cliente_resposta',
    'title', case
      when normalized_action = 'confirmar' then 'Cliente aprovou a proposta'
      when normalized_action = 'cancelar' then 'Cliente solicitou cancelamento'
      else 'Cliente solicitou alteração'
    end,
    'detail', coalesce(clean_message, 'Resposta registrada pelo link público.') ||
      case
        when clean_proof is not null then ' Comprovante anexado: ' || coalesce(clean_proof ->> 'nome', 'arquivo')
        else ''
      end,
    'at', now(),
    'actor', 'Cliente'
  );

  next_status := case
    when normalized_action = 'cancelar' then 'cancelado'
    when normalized_action = 'confirmar' and clean_proof is not null then 'confirmado'
    else 'negociacao'
  end;

  select
    jsonb_set(coalesce(p.snapshot, '{}'::jsonb), '{clienteResposta}', response_payload, true),
    coalesce(p.total, 0)
    into new_snapshot, proposal_total
  from public.propostas p
  where p.public_token = proposal_token;

  if new_snapshot is null then
    raise exception 'Proposta nao encontrada.';
  end if;

  if normalized_action = 'cancelar' then
    new_snapshot := jsonb_set(
      new_snapshot,
      '{cancelamento}',
      jsonb_build_object(
        'motivo', coalesce(clean_message, 'Cancelado pelo cliente'),
        'canceladoEm', now(),
        'canceladoPor', 'cliente'
      ),
      true
    );
  end if;

  if normalized_action = 'confirmar' and clean_proof is not null then
    signal_payment := jsonb_strip_nulls(jsonb_build_object(
      'valor', round(coalesce(proposal_total, 0) * 0.5, 2),
      'data', current_date,
      'bancos', jsonb_build_array('A validar'),
      'comprovante', clean_proof,
      'registradoEm', now(),
      'registradoPor', 'Cliente via proposta pública',
      'origem', 'proposta_publica',
      'validacaoPendente', true
    ));

    signal_history_entry := jsonb_build_object(
      'id', 'sinal-cliente-' || extract(epoch from now())::text,
      'type', 'sinal',
      'title', 'Sinal enviado pelo cliente',
      'detail', 'Comprovante anexado pelo link público. Validar no banco antes da confirmação operacional: ' || coalesce(clean_proof ->> 'nome', 'arquivo'),
      'at', now(),
      'actor', 'Cliente'
    );

    new_snapshot := jsonb_set(new_snapshot, '{pagamentoSinal}', signal_payment, true);
  end if;

  new_snapshot := jsonb_set(
    new_snapshot,
    '{commercialHistory}',
    (case
      when signal_history_entry is not null then jsonb_build_array(signal_history_entry, history_entry)
      else jsonb_build_array(history_entry)
    end) || coalesce(new_snapshot -> 'commercialHistory', '[]'::jsonb),
    true
  );

  update public.propostas
    set
      status = next_status,
      cliente_resposta = normalized_action,
      cliente_resposta_em = now(),
      cliente_mensagem = clean_message,
      cliente_solicitacao = response_payload,
      snapshot = new_snapshot
    where public_token = proposal_token;

  return query select true, next_status, normalized_action;
end;
$$;

grant execute on function public.respond_public_proposal(uuid, text, date, time, integer, text, jsonb) to anon, authenticated;

-- Corrige propostas já aprovadas pelo cliente com comprovante anexado,
-- mas que ficaram em negociação antes desta atualização.
with approved_with_proof as (
  select
    p.id,
    coalesce(p.total, 0) as total,
    p.cliente_solicitacao -> 'comprovante' as proof
  from public.propostas p
  where p.cliente_resposta = 'confirmar'
    and p.status = 'negociacao'
    and p.cliente_solicitacao -> 'comprovante' is not null
    and p.snapshot -> 'pagamentoSinal' is null
)
update public.propostas p
set
  status = 'confirmado',
  snapshot = jsonb_set(
    jsonb_set(
      p.snapshot,
      '{pagamentoSinal}',
      jsonb_strip_nulls(jsonb_build_object(
        'valor', round(coalesce(a.total, 0) * 0.5, 2),
        'data', current_date,
        'bancos', jsonb_build_array('A validar'),
        'comprovante', a.proof,
        'registradoEm', now(),
        'registradoPor', 'Cliente via proposta pública',
        'origem', 'proposta_publica',
        'validacaoPendente', true
      )),
      true
    ),
    '{commercialHistory}',
    jsonb_build_array(jsonb_build_object(
      'id', 'sinal-backfill-' || extract(epoch from now())::text,
      'type', 'sinal',
      'title', 'Sinal enviado pelo cliente',
      'detail', 'Comprovante anexado pelo link público. Validar no banco antes da confirmação operacional: ' || coalesce(a.proof ->> 'nome', 'arquivo'),
      'at', now(),
      'actor', 'Sistema'
    )) || coalesce(p.snapshot -> 'commercialHistory', '[]'::jsonb),
    true
  ),
  updated_at = now()
from approved_with_proof a
where p.id = a.id;
