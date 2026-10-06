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
$function$;

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
$function$;

