-- Emergency compatibility rollback. Requires a reviewed release rollback; new data is preserved.

grant insert,update on public.propostas to authenticated;

grant insert on public.solicitacoes_cotacao to anon;

create policy "Cliente pode enviar solicitacao" on public.solicitacoes_cotacao for insert to anon with check(status='novo' and proposta_id is null and origem='formulario');

CREATE OR REPLACE FUNCTION public.prepare_proposal_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  next_version integer;
begin
  if new.oportunidade_id is null then
    return new;
  end if;

  perform event_private.lock_proposal_group(new.oportunidade_id);

  select coalesce(max(p.versao), 0) + 1
    into next_version
  from public.propostas p
  where p.oportunidade_id = new.oportunidade_id;

  new.versao := next_version;

  if coalesce(new.is_current, true) then
    update public.propostas
      set is_current = false,
          superseded_at = now()
      where oportunidade_id = new.oportunidade_id
        and is_current = true;
    new.is_current := true;
    new.superseded_at := null;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.respond_public_proposal(proposal_token uuid, action text, requested_date date DEFAULT NULL::date, requested_time time without time zone DEFAULT NULL::time without time zone, requested_guests integer DEFAULT NULL::integer, message text DEFAULT NULL::text, payment_proof jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(ok boolean, status text, cliente_resposta text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_action text := lower(trim(coalesce(action, '')));
  clean_message text := nullif(trim(coalesce(message, '')), '');
  target_id uuid;
  current_status text;
  current_snapshot jsonb;
  response_payload jsonb;
  history_entry jsonb;
  proof_history_entry jsonb := null;
  clean_proof jsonb := null;
  signal_payment jsonb := null;
  next_status text;
  new_snapshot jsonb;
  proposal_total numeric := 0;
  proof_name text;
  proof_type text;
  proof_size integer;
  proof_data_url text;
begin
  if normalized_action not in ('confirmar', 'cancelar', 'alteracao') then
    raise exception 'Acao invalida.';
  end if;

  if requested_guests is not null and (requested_guests < 1 or requested_guests > 500) then
    raise exception 'Numero de convidados invalido.';
  end if;

  if normalized_action in ('cancelar', 'alteracao') and length(coalesce(clean_message, '')) < 3 then
    raise exception 'Mensagem obrigatoria.';
  end if;

  select
    coalesce(current_p.id, requested.id),
    coalesce(current_p.status, requested.status),
    coalesce(current_p.snapshot, requested.snapshot, '{}'::jsonb),
    coalesce(current_p.total, requested.total, 0)
  into target_id, current_status, current_snapshot, proposal_total
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

  if target_id is null or current_snapshot is null then
    raise exception 'Proposta nao encontrada ou link expirado.';
  end if;

  if current_status not in ('proposta_enviada', 'negociacao') then
    raise exception 'Esta proposta nao aceita mais respostas pelo link publico.';
  end if;

  if payment_proof is not null then
    proof_name := left(nullif(trim(coalesce(payment_proof ->> 'nome', '')), ''), 160);
    proof_type := lower(nullif(trim(coalesce(payment_proof ->> 'tipo', '')), ''));
    proof_data_url := nullif(trim(coalesce(payment_proof ->> 'dataUrl', '')), '');
    proof_size := nullif(trim(coalesce(payment_proof ->> 'tamanho', '')), '')::integer;

    if proof_name is null or proof_type is null or proof_data_url is null then
      raise exception 'Comprovante incompleto.';
    end if;
    if proof_size is null or proof_size <= 0 or proof_size > 5242880 then
      raise exception 'Comprovante acima do limite permitido.';
    end if;
    if proof_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') then
      raise exception 'Tipo de comprovante nao permitido.';
    end if;
    if length(proof_data_url) > 7200000 or proof_data_url !~ '^data:(application/pdf|image/(jpeg|png|webp|heic|heif));base64,' then
      raise exception 'Formato do comprovante invalido.';
    end if;

    clean_proof := jsonb_strip_nulls(jsonb_build_object(
      'nome', proof_name,
      'tipo', proof_type,
      'tamanho', proof_size,
      'dataUrl', proof_data_url,
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
      case when clean_proof is not null then ' Comprovante anexado: ' || coalesce(clean_proof ->> 'nome', 'arquivo') else '' end,
    'at', now(),
    'actor', 'Cliente'
  );

  next_status := case when normalized_action = 'cancelar' then 'cancelado' else 'negociacao' end;
  new_snapshot := jsonb_set(current_snapshot, '{clienteResposta}', response_payload, true);

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

    proof_history_entry := jsonb_build_object(
      'id', 'sinal-cliente-' || extract(epoch from now())::text,
      'type', 'comprovante_sinal',
      'title', 'Comprovante enviado pelo cliente',
      'detail', 'Comprovante anexado pelo link público. Validar no banco antes da confirmação operacional: ' || coalesce(clean_proof ->> 'nome', 'arquivo'),
      'at', now(),
      'actor', 'Cliente'
    );
  end if;

  new_snapshot := jsonb_set(
    new_snapshot,
    '{commercialHistory}',
    (case when proof_history_entry is not null then jsonb_build_array(proof_history_entry, history_entry) else jsonb_build_array(history_entry) end)
      || coalesce(new_snapshot -> 'commercialHistory', '[]'::jsonb),
    true
  );

  if signal_payment is not null then
    new_snapshot := jsonb_set(new_snapshot, '{pagamentoSinal}', signal_payment, true);
  end if;

  update public.propostas
  set
    status = next_status,
    cliente_resposta = normalized_action,
    cliente_resposta_em = now(),
    cliente_mensagem = clean_message,
    cliente_solicitacao = response_payload,
    snapshot = new_snapshot
  where id = target_id;

  return query select true, next_status, normalized_action;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_proposal(proposal_token uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, cliente_nome text, cliente_email text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, duracao numeric, subtotal numeric, taxa_servico numeric, privatizacao numeric, total numeric, status text, snapshot jsonb, cliente_resposta text, cliente_resposta_em timestamp with time zone, cliente_mensagem text, cliente_solicitacao jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'publicOfferOptions', p.snapshot -> 'publicOfferOptions',
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_my_proposal_link(p_proposal_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  my_email text := lower(nullif(trim(coalesce(auth.jwt() ->> 'email','')), ''));
  token uuid;
begin
  if my_email is null then
    raise exception 'Autenticacao obrigatoria.';
  end if;

  update public.propostas
  set public_token_expires_at = greatest(public_token_expires_at, now() + interval '30 days'),
      public_token_revoked_at = null
  where id = p_proposal_id
    and lower(coalesce(cliente_email,'')) = my_email
    and coalesce(is_current, true) = true
  returning public_token into token;

  if token is null then
    raise exception 'Proposta nao encontrada para este usuario.';
  end if;

  return token;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_event_history()
 RETURNS TABLE(proposal_id uuid, oportunidade_id uuid, versao integer, status text, cliente_nome text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, total numeric, public_token uuid, snapshot jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (
    select lower(nullif(trim(coalesce(auth.jwt() ->> 'email','')), '')) as email
  )
  select
    p.id,
    p.oportunidade_id,
    p.versao,
    p.status,
    p.cliente_nome,
    p.tipo_evento,
    p.data_evento,
    p.horario_evento,
    p.convidados,
    p.total,
    p.public_token,
    jsonb_strip_nulls(jsonb_build_object(
      'client', p.snapshot -> 'client',
      'event', p.snapshot -> 'event',
      'selectedItems', p.snapshot -> 'selectedItems',
      'qualificacao', p.snapshot -> 'qualificacao',
      'sourceRequestSnapshot', p.snapshot -> 'sourceRequestSnapshot'
    )),
    p.created_at,
    p.updated_at
  from public.propostas p, me
  where me.email is not null
    and lower(coalesce(p.cliente_email,'')) = me.email
    and coalesce(p.is_current, true) = true
  order by coalesce(p.data_evento, p.created_at::date) desc, p.updated_at desc
  limit 12;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_public_quote_request(p_capture_token uuid, p_snapshot jsonb)
 RETURNS TABLE(request_id uuid, opportunity_id uuid, capture_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request_id uuid;
  v_opportunity_id uuid;
  v_name text := nullif(trim(coalesce(p_snapshot #>> '{cliente,nome}', '')), '');
  v_email text := nullif(lower(trim(coalesce(p_snapshot #>> '{cliente,email}', ''))), '');
  v_phone text := nullif(trim(coalesce(p_snapshot #>> '{cliente,whatsapp}', '')), '');
  v_company text := nullif(trim(coalesce(p_snapshot #>> '{cliente,empresa}', '')), '');
  v_event_type text := nullif(trim(coalesce(p_snapshot #>> '{evento,tipo}', '')), '');
  v_event_date date;
  v_event_time time;
  v_guests integer;
  v_duration numeric;
begin
  if p_capture_token is null then raise exception 'capture_token obrigatorio'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_capture_token::text, 71938502));
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nome obrigatorio.';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'Informe e-mail ou WhatsApp.';
  end if;

  begin
    v_event_date := nullif(p_snapshot #>> '{evento,data}', '')::date;
  exception when others then
    v_event_date := null;
  end;
  begin
    v_event_time := nullif(p_snapshot #>> '{evento,horario}', '')::time;
  exception when others then
    v_event_time := null;
  end;
  begin
    v_guests := greatest(1, least(500, coalesce(nullif(p_snapshot #>> '{evento,convidados}', '')::integer, 1)));
  exception when others then
    v_guests := 1;
  end;
  begin
    v_duration := nullif(p_snapshot #>> '{evento,duracao}', '')::numeric;
  exception when others then
    v_duration := null;
  end;

  if p_capture_token is not null then
    select s.id, s.oportunidade_id
      into v_request_id, v_opportunity_id
    from public.solicitacoes_cotacao s
    where s.capture_token = p_capture_token
    limit 1;
  end if;

  if v_request_id is not null and exists(select 1 from public.solicitacoes_cotacao where id=v_request_id and capture_status='complete') then
    return query select v_request_id,v_opportunity_id,p_capture_token;
    return;
  end if;

  if v_opportunity_id is null then
    insert into public.oportunidades (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, origem,
      metadata
    )
    values (
      'lead_recebido', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, 'formulario',
      jsonb_build_object('capture_status','complete')
    )
    returning id into v_opportunity_id;
  end if;

  if v_request_id is null then
    insert into public.solicitacoes_cotacao (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, duracao,
      motivo_evento, preferencias, observacoes, origem, proposta_id,
      snapshot, oportunidade_id, capture_token, capture_status,
      last_form_step, capture_completed_at
    )
    values (
      'novo', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, v_duration,
      nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      'formulario', null,
      p_snapshot, v_opportunity_id, p_capture_token, 'complete',
      'completed', now()
    )
    returning id into v_request_id;
  else
    update public.solicitacoes_cotacao
    set
      status = 'novo',
      cliente_nome = v_name,
      cliente_email = v_email,
      cliente_whatsapp = v_phone,
      empresa = v_company,
      tipo_evento = v_event_type,
      data_evento = v_event_date,
      horario_evento = v_event_time,
      convidados = v_guests,
      duracao = v_duration,
      motivo_evento = nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      preferencias = nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      observacoes = nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      snapshot = p_snapshot,
      capture_status = 'complete',
      last_form_step = 'completed',
      capture_completed_at = now()
    where id = v_request_id;
  end if;

  update public.oportunidades
  set
    status = 'lead_recebido',
    cliente_nome = v_name,
    cliente_email = v_email,
    cliente_whatsapp = v_phone,
    empresa = v_company,
    tipo_evento = v_event_type,
    data_evento = v_event_date,
    horario_evento = v_event_time,
    convidados = v_guests,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('capture_status','complete')
  where id = v_opportunity_id;

  return query select v_request_id, v_opportunity_id, p_capture_token;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_public_quote_draft(p_capture_token uuid, p_snapshot jsonb, p_last_step text DEFAULT NULL::text)
 RETURNS TABLE(request_id uuid, opportunity_id uuid, capture_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request_id uuid;
  v_opportunity_id uuid;
  v_name text := nullif(trim(coalesce(p_snapshot #>> '{cliente,nome}', '')), '');
  v_email text := nullif(lower(trim(coalesce(p_snapshot #>> '{cliente,email}', ''))), '');
  v_phone text := nullif(trim(coalesce(p_snapshot #>> '{cliente,whatsapp}', '')), '');
  v_company text := nullif(trim(coalesce(p_snapshot #>> '{cliente,empresa}', '')), '');
  v_event_type text := nullif(trim(coalesce(p_snapshot #>> '{evento,tipo}', '')), '');
  v_event_date date;
  v_event_time time;
  v_guests integer;
  v_duration numeric;
begin
  if p_capture_token is null then raise exception 'capture_token obrigatorio'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_capture_token::text, 71938502));
  if p_capture_token is null then
    raise exception 'capture_token obrigatorio';
  end if;

  -- So criamos lead parcial quando ja existe uma pessoa identificavel e um canal.
  if v_name is null or length(v_name) < 2 or (v_email is null and v_phone is null) then
    return;
  end if;

  begin
    v_event_date := nullif(p_snapshot #>> '{evento,data}', '')::date;
  exception when others then
    v_event_date := null;
  end;

  begin
    v_event_time := nullif(p_snapshot #>> '{evento,horario}', '')::time;
  exception when others then
    v_event_time := null;
  end;

  begin
    v_guests := greatest(1, least(500, coalesce(nullif(p_snapshot #>> '{evento,convidados}', '')::integer, 1)));
  exception when others then
    v_guests := 1;
  end;

  begin
    v_duration := nullif(p_snapshot #>> '{evento,duracao}', '')::numeric;
  exception when others then
    v_duration := null;
  end;

  select s.id, s.oportunidade_id
    into v_request_id, v_opportunity_id
  from public.solicitacoes_cotacao s
  where s.capture_token = p_capture_token
  limit 1;

  if v_request_id is not null and exists(select 1 from public.solicitacoes_cotacao where id=v_request_id and capture_status='complete') then
    return query select v_request_id,v_opportunity_id,p_capture_token;
    return;
  end if;

  if v_request_id is null then
    insert into public.oportunidades (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, origem,
      metadata
    )
    values (
      'lead_recebido', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, 'formulario',
      jsonb_build_object('capture_status','partial')
    )
    returning id into v_opportunity_id;

    insert into public.solicitacoes_cotacao (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, duracao,
      motivo_evento, preferencias, observacoes, origem, proposta_id,
      snapshot, oportunidade_id, capture_token, capture_status, last_form_step
    )
    values (
      'rascunho_cliente', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, v_duration,
      nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      'formulario', null,
      p_snapshot, v_opportunity_id, p_capture_token, 'partial', p_last_step
    )
    returning id into v_request_id;
  else
    update public.solicitacoes_cotacao
    set
      cliente_nome = v_name,
      cliente_email = v_email,
      cliente_whatsapp = v_phone,
      empresa = v_company,
      tipo_evento = v_event_type,
      data_evento = v_event_date,
      horario_evento = v_event_time,
      convidados = v_guests,
      duracao = v_duration,
      motivo_evento = nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      preferencias = nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      observacoes = nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      snapshot = p_snapshot,
      capture_status = 'partial',
      last_form_step = p_last_step
    where id = v_request_id;
  end if;

  return query select v_request_id, v_opportunity_id, p_capture_token;
end;
$function$
;

grant execute on function public.respond_public_proposal(uuid,text,date,time,integer,text,jsonb) to anon,authenticated;
