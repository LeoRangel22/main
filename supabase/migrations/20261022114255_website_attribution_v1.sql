-- Website attribution v1 and client language. Only replace existing RPC bodies; preserve ACLs.
-- No new endpoints, grants, policies or business configuration.

CREATE OR REPLACE FUNCTION public.submit_public_quote_request(p_capture_token uuid, p_snapshot jsonb)
 RETURNS TABLE(request_id uuid, opportunity_id uuid, capture_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_candidate jsonb;
  v_attribution jsonb;
  v_existing_snapshot jsonb;
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
  perform event_private.validate_quote_capture(p_snapshot);
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

  -- Capture-token advisory lock above serializes first-valid attribution selection.
  select s.snapshot into v_existing_snapshot from public.solicitacoes_cotacao s where s.id=v_request_id;
  foreach v_candidate in array array[v_existing_snapshot->'attribution', p_snapshot->'attribution'] loop
    if jsonb_typeof(v_candidate) = 'object' then
      if v_candidate ?& array['version','utm_source','utm_medium','utm_campaign','utm_content']
        and (v_candidate - array['version','utm_source','utm_medium','utm_campaign','utm_content']) = '{}'::jsonb
        and v_candidate->'version' = '1'::jsonb
        and v_candidate->'utm_source' = '"embaixadacarioca"'::jsonb
        and v_candidate->'utm_medium' = '"website"'::jsonb
        and v_candidate->'utm_campaign' = '"eventos"'::jsonb
        and jsonb_typeof(v_candidate->'utm_content') = 'string'
        and v_candidate->>'utm_content' in ('index','index_en','index_es','eventos','eventos-corporativos','en-eventos-corporativos','es-eventos-corporativos','contato','en-contato','es-contato','formulario') then
        v_attribution := v_candidate;
        exit;
      end if;
    end if;
  end loop;
  p_snapshot := p_snapshot - 'attribution';
  if v_attribution is not null then p_snapshot := p_snapshot || jsonb_build_object('attribution',v_attribution); end if;
  p_snapshot := jsonb_set(p_snapshot,'{cliente}',
    (case when jsonb_typeof(p_snapshot->'cliente')='object' then p_snapshot->'cliente' else '{}'::jsonb end)
    || jsonb_build_object('idioma',case when lower(trim(p_snapshot#>>'{cliente,idioma}')) in ('pt','en','es')
      then lower(trim(p_snapshot#>>'{cliente,idioma}')) else 'pt' end));

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

  -- Keep unrelated opportunity metadata intact; never infer a website origin.
  update public.oportunidades
    set metadata = (coalesce(metadata,'{}'::jsonb) - 'attribution')
      || case when v_attribution is not null then jsonb_build_object('attribution',v_attribution) else '{}'::jsonb end
    where id=v_opportunity_id;

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
  v_candidate jsonb;
  v_attribution jsonb;
  v_existing_snapshot jsonb;
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
  perform event_private.validate_quote_capture(p_snapshot,p_last_step);
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

  -- Capture-token advisory lock above serializes first-valid attribution selection.
  select s.snapshot into v_existing_snapshot from public.solicitacoes_cotacao s where s.id=v_request_id;
  foreach v_candidate in array array[v_existing_snapshot->'attribution', p_snapshot->'attribution'] loop
    if jsonb_typeof(v_candidate) = 'object' then
      if v_candidate ?& array['version','utm_source','utm_medium','utm_campaign','utm_content']
        and (v_candidate - array['version','utm_source','utm_medium','utm_campaign','utm_content']) = '{}'::jsonb
        and v_candidate->'version' = '1'::jsonb
        and v_candidate->'utm_source' = '"embaixadacarioca"'::jsonb
        and v_candidate->'utm_medium' = '"website"'::jsonb
        and v_candidate->'utm_campaign' = '"eventos"'::jsonb
        and jsonb_typeof(v_candidate->'utm_content') = 'string'
        and v_candidate->>'utm_content' in ('index','index_en','index_es','eventos','eventos-corporativos','en-eventos-corporativos','es-eventos-corporativos','contato','en-contato','es-contato','formulario') then
        v_attribution := v_candidate;
        exit;
      end if;
    end if;
  end loop;
  p_snapshot := p_snapshot - 'attribution';
  if v_attribution is not null then p_snapshot := p_snapshot || jsonb_build_object('attribution',v_attribution); end if;
  p_snapshot := jsonb_set(p_snapshot,'{cliente}',
    (case when jsonb_typeof(p_snapshot->'cliente')='object' then p_snapshot->'cliente' else '{}'::jsonb end)
    || jsonb_build_object('idioma',case when lower(trim(p_snapshot#>>'{cliente,idioma}')) in ('pt','en','es')
      then lower(trim(p_snapshot#>>'{cliente,idioma}')) else 'pt' end));

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

  -- Keep unrelated opportunity metadata intact; never infer a website origin.
  update public.oportunidades
    set metadata = (coalesce(metadata,'{}'::jsonb) - 'attribution')
      || case when v_attribution is not null then jsonb_build_object('attribution',v_attribution) else '{}'::jsonb end
    where id=v_opportunity_id;

  return query select v_request_id, v_opportunity_id, p_capture_token;
end;
$function$
;


create or replace function public.save_event_proposal(
  p_proposal_id uuid,p_changes jsonb,p_expected_revision bigint,p_source_proposal_id uuid default null
) returns setof public.propostas language plpgsql security definer set search_path='' as $$
declare v_candidate jsonb; v_attribution jsonb; v_source_snapshot jsonb; v_source_id uuid;
  v_snapshot jsonb; v_language text; v_old_language text; v_source_language text;
  old_row public.propostas; new_row public.propostas; target_opportunity uuid; allowed text[]:=array[
  'responsavel_id','responsavel_email','cliente_nome','cliente_email','cliente_whatsapp','tipo_evento',
  'data_evento','horario_evento','convidados','duracao','subtotal','taxa_servico','privatizacao','total','status',
  'oportunidade_id','public_token_expires_at','solicitacao_id','snapshot','is_current','publication_status','sent_at'];
begin
  perform event_private.require_team();
  if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k where not k=any(allowed)) then
    raise exception 'Campos de proposta invalidos';
  end if;
  if p_proposal_id is not null and p_source_proposal_id is not null then raise exception 'Origem invalida'; end if;
  if p_proposal_id is not null or p_source_proposal_id is not null then
    select oportunidade_id into target_opportunity from public.propostas where id=coalesce(p_proposal_id,p_source_proposal_id);
    if not found then raise exception 'Proposta nao encontrada'; end if;
  else target_opportunity:=(p_changes->>'oportunidade_id')::uuid;
  end if;
  target_opportunity:=coalesce(target_opportunity,(p_changes->>'oportunidade_id')::uuid);
  if target_opportunity is not null then perform event_private.lock_proposal_group(target_opportunity); end if;
  if p_proposal_id is not null or p_source_proposal_id is not null then
    select * into old_row from public.propostas where id=coalesce(p_proposal_id,p_source_proposal_id) for update;
    if not found then raise exception 'Proposta nao encontrada'; end if;
    if p_expected_revision is null or old_row.revision<>p_expected_revision then
      raise sqlstate 'PT409' using message='A proposta mudou. Atualize antes de salvar; suas alteracoes nao foram aplicadas.';
    end if;
    if p_proposal_id is null and (not old_row.is_current or old_row.publication_status='draft') then
      raise sqlstate 'PT409' using message='A versao de origem mudou. Atualize antes de criar outra versao.';
    end if;
  elsif p_expected_revision is not null then raise exception 'Revisao inesperada para nova proposta'; end if;
  -- An existing proposal's request identity cannot be replaced by payload metadata.
  v_source_id := coalesce(old_row.solicitacao_id,(p_changes->>'solicitacao_id')::uuid);
  if v_source_id is not null then
    select s.snapshot into v_source_snapshot from public.solicitacoes_cotacao s
      where s.id=v_source_id and s.oportunidade_id is not distinct from target_opportunity;
    if not found then raise exception 'Solicitacao de origem divergente'; end if;
  elsif target_opportunity is not null then
    select s.id,s.snapshot into v_source_id,v_source_snapshot from public.solicitacoes_cotacao s
      where s.oportunidade_id=target_opportunity order by s.created_at,s.id limit 1;
  end if;
  if v_source_id is not null then p_changes := p_changes || jsonb_build_object('solicitacao_id',v_source_id); end if;
  v_snapshot := coalesce(p_changes->'snapshot',old_row.snapshot,'{}'::jsonb);
  if jsonb_typeof(v_snapshot) is distinct from 'object' then raise exception 'Snapshot de proposta invalido'; end if;
  -- With an authoritative request, even absent/invalid attribution must beat a forged payload.
  foreach v_candidate in array array[case when v_source_id is not null then v_source_snapshot->'attribution'
    else old_row.snapshot->'attribution' end] loop
    if jsonb_typeof(v_candidate) = 'object' then
      if v_candidate ?& array['version','utm_source','utm_medium','utm_campaign','utm_content']
        and (v_candidate - array['version','utm_source','utm_medium','utm_campaign','utm_content']) = '{}'::jsonb
        and v_candidate->'version' = '1'::jsonb
        and v_candidate->'utm_source' = '"embaixadacarioca"'::jsonb
        and v_candidate->'utm_medium' = '"website"'::jsonb
        and v_candidate->'utm_campaign' = '"eventos"'::jsonb
        and jsonb_typeof(v_candidate->'utm_content') = 'string'
        and v_candidate->>'utm_content' in ('index','index_en','index_es','eventos','eventos-corporativos','en-eventos-corporativos','es-eventos-corporativos','contato','en-contato','es-contato','formulario') then
        v_attribution := v_candidate;
        exit;
      end if;
    end if;
  end loop;
  v_snapshot := v_snapshot - 'attribution';
  if v_attribution is not null then v_snapshot := v_snapshot || jsonb_build_object('attribution',v_attribution); end if;
  if jsonb_typeof(v_snapshot->'sourceRequestSnapshot')='object' then
    v_snapshot := jsonb_set(v_snapshot,'{sourceRequestSnapshot}',
      ((v_snapshot->'sourceRequestSnapshot') - 'attribution')
      || case when v_attribution is not null then jsonb_build_object('attribution',v_attribution) else '{}'::jsonb end);
  elsif v_source_id is not null or v_attribution is not null then
    v_snapshot := v_snapshot || jsonb_build_object('sourceRequestSnapshot',
      case when v_attribution is not null then jsonb_build_object('attribution',v_attribution) else '{}'::jsonb end);
  end if;
  v_language := lower(trim(p_changes#>>'{snapshot,event,clientLanguage}'));
  v_old_language := lower(trim(old_row.snapshot#>>'{event,clientLanguage}'));
  v_source_language := lower(trim(v_source_snapshot#>>'{cliente,idioma}'));
  v_language := case when v_language in ('pt','en','es') then v_language
    when v_old_language in ('pt','en','es') then v_old_language
    when v_source_language in ('pt','en','es') then v_source_language else null end;
  if v_language is not null then
  v_snapshot := jsonb_set(v_snapshot,'{event}',
    (case when jsonb_typeof(v_snapshot->'event')='object' then v_snapshot->'event' else '{}'::jsonb end)
    || jsonb_build_object('clientLanguage',v_language));
  elsif jsonb_typeof(v_snapshot->'event')='object' and (v_snapshot->'event')?'clientLanguage' then
    v_snapshot := jsonb_set(v_snapshot,'{event}',(v_snapshot->'event')-'clientLanguage');
  end if;
  p_changes := p_changes || jsonb_build_object('snapshot',v_snapshot);

  if p_proposal_id is not null then
    if p_changes ? 'oportunidade_id' and old_row.oportunidade_id is not null and (p_changes->>'oportunidade_id')::uuid is distinct from old_row.oportunidade_id then
      raise exception 'Nao e permitido transferir uma proposta para outra oportunidade';
    end if;
    if not old_row.is_current and old_row.publication_status<>'draft' then raise sqlstate 'PT409' using message='A versao de origem mudou. Atualize antes de salvar.'; end if;
    if not old_row.is_current and coalesce((p_changes->>'is_current')::boolean,false)
       and exists(select 1 from public.propostas where oportunidade_id=target_opportunity and is_current and versao>=old_row.versao and id<>old_row.id) then
      raise sqlstate 'PT409' using message='A versao de origem mudou. Atualize antes de publicar.';
    end if;
    new_row:=jsonb_populate_record(old_row,p_changes);
    update public.propostas set
      responsavel_id=new_row.responsavel_id,responsavel_email=new_row.responsavel_email,
      cliente_nome=new_row.cliente_nome,cliente_email=new_row.cliente_email,cliente_whatsapp=new_row.cliente_whatsapp,
      tipo_evento=new_row.tipo_evento,data_evento=new_row.data_evento,horario_evento=new_row.horario_evento,
      convidados=new_row.convidados,duracao=new_row.duracao,subtotal=new_row.subtotal,taxa_servico=new_row.taxa_servico,
      privatizacao=new_row.privatizacao,total=new_row.total,status=new_row.status,oportunidade_id=new_row.oportunidade_id,
      public_token_expires_at=new_row.public_token_expires_at,solicitacao_id=new_row.solicitacao_id,
      snapshot=new_row.snapshot,is_current=new_row.is_current,publication_status=new_row.publication_status,sent_at=new_row.sent_at
    where id=p_proposal_id returning * into new_row;
  else
    if p_source_proposal_id is not null and (p_changes->>'oportunidade_id')::uuid is distinct from old_row.oportunidade_id then raise exception 'Oportunidade de origem divergente'; end if;
    if p_source_proposal_id is null and exists(select 1 from public.propostas where oportunidade_id=target_opportunity) then
      raise sqlstate 'PT409' using message='A proposta mudou. Escolha a versao de origem antes de criar outra versao.';
    end if;
    new_row:=jsonb_populate_record(null::public.propostas,p_changes);
    insert into public.propostas(
      responsavel_id,responsavel_email,cliente_nome,cliente_email,cliente_whatsapp,tipo_evento,data_evento,horario_evento,
      convidados,duracao,subtotal,taxa_servico,privatizacao,total,status,oportunidade_id,public_token_expires_at,
      solicitacao_id,snapshot,is_current,publication_status,sent_at
    ) values(new_row.responsavel_id,new_row.responsavel_email,new_row.cliente_nome,new_row.cliente_email,new_row.cliente_whatsapp,
      new_row.tipo_evento,new_row.data_evento,new_row.horario_evento,coalesce(new_row.convidados,1),coalesce(new_row.duracao,1),
      coalesce(new_row.subtotal,0),coalesce(new_row.taxa_servico,0),coalesce(new_row.privatizacao,0),coalesce(new_row.total,0),
      coalesce(new_row.status,'rascunho'),new_row.oportunidade_id,coalesce(new_row.public_token_expires_at,now()+interval '90 days'),
      new_row.solicitacao_id,coalesce(new_row.snapshot,'{}'),coalesce(new_row.is_current,true),coalesce(new_row.publication_status,'draft'),new_row.sent_at
    ) returning * into new_row;
  end if;
  if target_opportunity is not null then
    update public.oportunidades set metadata=(coalesce(metadata,'{}'::jsonb)-'attribution')
      || case when v_attribution is not null then jsonb_build_object('attribution',v_attribution) else '{}'::jsonb end
      where id=target_opportunity;
  end if;
  return next new_row;
end; $$;
