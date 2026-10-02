-- Executar após phase1_commercial_ux.sql. Mantém propostas e respostas anteriores.
-- Permite anexar o comprovante depois da aprovação, sem repetir a aprovação.
create or replace function public.submit_public_signal_proof(
  proposal_token uuid,
  payment_proof jsonb
)
returns table (ok boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  proposal_row public.propostas%rowtype;
  proof_name text;
  proof_type text;
  proof_data_url text;
  proof_size integer;
  clean_proof jsonb;
  new_snapshot jsonb;
begin
  select coalesce(current_p.id, requested.id)
    into target_id
  from public.propostas requested
  left join public.propostas current_p
    on current_p.oportunidade_id = requested.oportunidade_id
   and current_p.is_current = true
   and current_p.public_token_revoked_at is null
   and current_p.public_token_expires_at > now()
  where requested.public_token = proposal_token
    and requested.public_token_revoked_at is null
    and (current_p.id is not null or requested.public_token_expires_at > now())
  limit 1;

  if target_id is null then
    raise exception 'Proposta nao encontrada ou link expirado.';
  end if;
  select * into proposal_row from public.propostas where id = target_id for update;
  if proposal_row.status <> 'negociacao' or proposal_row.cliente_resposta <> 'confirmar' then
    raise exception 'Esta proposta nao aceita mais comprovantes pelo link publico.';
  end if;
  if proposal_row.cliente_solicitacao -> 'comprovante' is not null
     or proposal_row.snapshot -> 'clienteResposta' -> 'comprovante' is not null
     or proposal_row.snapshot -> 'pagamentoSinal' is not null then
    raise exception 'Ja existe um comprovante ou sinal registrado. Fale com a equipe para conferir antes de altera-lo.';
  end if;

  proof_name := left(nullif(trim(coalesce(payment_proof ->> 'nome', '')), ''), 160);
  proof_type := lower(nullif(trim(coalesce(payment_proof ->> 'tipo', '')), ''));
  proof_data_url := nullif(trim(coalesce(payment_proof ->> 'dataUrl', '')), '');
  proof_size := nullif(trim(coalesce(payment_proof ->> 'tamanho', '')), '')::integer;
  if proof_name is null or proof_type is null or proof_data_url is null
     or proof_size is null or proof_size <= 0 or proof_size > 5242880
     or proof_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
     or length(proof_data_url) > 7200000
     or proof_data_url !~ '^data:(application/pdf|image/(jpeg|png|webp|heic|heif));base64,' then
    raise exception 'Comprovante invalido.';
  end if;

  clean_proof := jsonb_build_object(
    'nome', proof_name, 'tipo', proof_type, 'tamanho', proof_size,
    'dataUrl', proof_data_url, 'anexadoEm', now()
  );
  new_snapshot := coalesce(proposal_row.snapshot, '{}'::jsonb);
  new_snapshot := jsonb_set(new_snapshot, '{clienteResposta,comprovante}', clean_proof, true);
  new_snapshot := jsonb_set(new_snapshot, '{pagamentoSinal}', jsonb_build_object(
    'valor', round(coalesce(proposal_row.total, 0) * 0.5, 2),
    'data', current_date,
    'bancos', jsonb_build_array('A validar'),
    'comprovante', clean_proof,
    'registradoEm', now(),
    'registradoPor', 'Cliente via proposta publica',
    'origem', 'proposta_publica',
    'validacaoPendente', true
  ), true);
  new_snapshot := jsonb_set(new_snapshot, '{commercialHistory}',
    jsonb_build_array(jsonb_build_object(
      'id', 'sinal-cliente-' || extract(epoch from now())::text,
      'type', 'comprovante_sinal',
      'title', 'Comprovante enviado pelo cliente',
      'detail', 'Comprovante recebido pelo link publico. Validar no banco: ' || proof_name,
      'at', now(), 'actor', 'Cliente'
    )) || coalesce(new_snapshot -> 'commercialHistory', '[]'::jsonb), true);

  update public.propostas
     set snapshot = new_snapshot,
         cliente_solicitacao = jsonb_set(coalesce(cliente_solicitacao, '{}'::jsonb), '{comprovante}', clean_proof, true)
   where id = target_id;
  return query select true;
end;
$$;

revoke all on function public.submit_public_signal_proof(uuid, jsonb) from public;
grant execute on function public.submit_public_signal_proof(uuid, jsonb) to anon, authenticated;
