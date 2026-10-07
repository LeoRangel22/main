-- Priority package: canonical capture, optimistic concurrency and public responses.
-- Apply once after the reconciled historical migrations. No business rows are deleted.
revoke insert on public.solicitacoes_cotacao from anon;
drop policy if exists "Cliente pode enviar solicitacao" on public.solicitacoes_cotacao;
drop policy if exists "Equipe autenticada pode remover propostas" on public.propostas;
drop policy if exists "Equipe autenticada pode remover solicitacoes" on public.solicitacoes_cotacao;
drop policy if exists "Super admin pode remover propostas" on public.propostas;
drop policy if exists "Super admin pode remover solicitacoes" on public.solicitacoes_cotacao;
create policy "Super admin pode remover propostas" on public.propostas for delete to authenticated using ((select public.is_super_admin()));
create policy "Super admin pode remover solicitacoes" on public.solicitacoes_cotacao for delete to authenticated using ((select public.is_super_admin()));

alter table public.propostas add column revision bigint not null default 1 check(revision>0);
create function event_private.bump_proposal_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then new.revision:=1; else new.revision:=old.revision+1; end if;
  return new;
end; $$;
revoke all on function event_private.bump_proposal_revision() from public,anon,authenticated;
create trigger event_proposal_revision before insert or update on public.propostas for each row execute function event_private.bump_proposal_revision();

create function event_private.lock_proposal_group(opportunity uuid) returns void language sql security definer set search_path='' as $$
  select pg_advisory_xact_lock(hashtextextended('event-proposal:'||opportunity::text,71938503));
$$;
revoke all on function event_private.lock_proposal_group(uuid) from public,anon,authenticated;

-- Refuse historical duplicates instead of renumbering client-visible versions.
do $$ begin
  if exists(select 1 from public.propostas where oportunidade_id is not null group by oportunidade_id,versao having count(*)>1) then
    raise exception 'Revise versoes duplicadas antes de aplicar esta migracao';
  end if;
end; $$;
create unique index propostas_opportunity_version_unique on public.propostas(oportunidade_id,versao) where oportunidade_id is not null;


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
revoke all on function public.prepare_proposal_version() from public,anon,authenticated;

create function public.save_event_proposal(
  p_proposal_id uuid,p_changes jsonb,p_expected_revision bigint,p_source_proposal_id uuid default null
) returns setof public.propostas language plpgsql security definer set search_path='' as $$
declare old_row public.propostas; new_row public.propostas; target_opportunity uuid; allowed text[]:=array[
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
  return next new_row;
end; $$;
revoke all on function public.save_event_proposal(uuid,jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_event_proposal(uuid,jsonb,bigint,uuid) to authenticated;
-- Every team INSERT/UPDATE now requires a revision-aware RPC. Internal workers keep their grants.
revoke insert,update on public.propostas from authenticated;


create function event_private.lock_public_proposal(proposal_token uuid) returns public.propostas language plpgsql security definer set search_path='' as $$
declare requested public.propostas; resolved public.propostas;
begin
  select * into requested from public.propostas where public_token=proposal_token and public_token_revoked_at is null;
  if not found then raise exception 'Proposta nao encontrada ou link expirado'; end if;
  if requested.oportunidade_id is not null then perform event_private.lock_proposal_group(requested.oportunidade_id); end if;
  -- Re-read the bearer capability after the group lock, including revocation.
  select * into requested from public.propostas where public_token=proposal_token and public_token_revoked_at is null;
  if not found then raise exception 'Proposta nao encontrada ou link expirado'; end if;
  select * into resolved from public.propostas where oportunidade_id=requested.oportunidade_id and is_current
    and public_token_revoked_at is null and public_token_expires_at>now();
  if not found then resolved:=requested; end if;
  select * into resolved from public.propostas where id=resolved.id for update;
  if resolved.id is null or resolved.public_token_revoked_at is not null or resolved.public_token_expires_at<=now() or resolved.publication_status='draft' then
    raise exception 'Proposta nao encontrada ou link expirado';
  end if;
  return resolved;
end; $$;
revoke all on function event_private.lock_public_proposal(uuid) from public,anon,authenticated;


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
  locked_row public.propostas;
  proof_name text;
  proof_type text;
  proof_size integer;
  proof_data_url text;
begin
  if normalized_action not in ('confirmar', 'cancelar', 'alteracao') then
    raise exception 'Acao invalida.';
  end if;

  if length(coalesce(clean_message,''))>6000 then raise exception 'Mensagem acima do limite'; end if;

  if requested_guests is not null and (requested_guests < 1 or requested_guests > 500) then
    raise exception 'Numero de convidados invalido.';
  end if;

  if normalized_action in ('cancelar', 'alteracao') and length(coalesce(clean_message, '')) < 3 then
    raise exception 'Mensagem obrigatoria.';
  end if;

  locked_row:=event_private.lock_public_proposal(proposal_token);
  target_id:=locked_row.id;
  current_status:=locked_row.status;
  current_snapshot:=coalesce(locked_row.snapshot,'{}');
  proposal_total:=locked_row.total;

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
revoke all on function public.respond_public_proposal(uuid,text,date,time,integer,text,jsonb) from public,anon,authenticated;

create table event_private.public_response_requests(
  request_id uuid primary key,proposal_id uuid not null references public.propostas(id) on delete cascade,
  token_hash text not null,payload_hash text not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table event_private.public_response_requests enable row level security;
revoke all on event_private.public_response_requests from public,anon,authenticated;
create function public.respond_public_proposal_v2(
  proposal_token uuid,action text,request_id uuid,expected_proposal_id uuid,expected_revision bigint,
  requested_date date default null,requested_time time default null,requested_guests integer default null,
  message text default null,payment_proof jsonb default null
) returns table(ok boolean,status text,cliente_resposta text) language plpgsql security definer set search_path='' as $$
declare p public.propostas; receipt event_private.public_response_requests; result_row record; result_json jsonb;
  token_digest text:=encode(extensions.digest(proposal_token::text,'sha256'),'hex');
  payload_digest text:=encode(extensions.digest(jsonb_build_array(action,expected_proposal_id,expected_revision,requested_date,requested_time,requested_guests,message,payment_proof)::text,'sha256'),'hex');
begin
  if request_id is null or expected_proposal_id is null or expected_revision is null then raise exception 'Identidade e revisao da resposta obrigatorias'; end if;
  perform pg_advisory_xact_lock(hashtextextended('event-response:'||request_id::text,71938504));
  p:=event_private.lock_public_proposal(proposal_token);
  select * into receipt from event_private.public_response_requests r where r.request_id=respond_public_proposal_v2.request_id;
  if found then
    if receipt.token_hash<>token_digest or receipt.payload_hash<>payload_digest then raise exception 'Identidade de resposta reutilizada com conteudo diferente'; end if;
    return query select (receipt.result->>'ok')::boolean,receipt.result->>'status',receipt.result->>'cliente_resposta';
    return;
  end if;
  if p.id<>expected_proposal_id or p.revision<>expected_revision then raise sqlstate 'PT409' using message='A proposta mudou. Recarregue e confira a versao atual antes de responder.'; end if;
  select * into result_row from public.respond_public_proposal(proposal_token,action,requested_date,requested_time,requested_guests,message,payment_proof);
  result_json:=to_jsonb(result_row);
  insert into event_private.public_response_requests values(request_id,p.id,token_digest,payload_digest,result_json,now());
  return query select result_row.ok,result_row.status,result_row.cliente_resposta;
end; $$;
revoke all on function public.respond_public_proposal_v2(uuid,text,uuid,uuid,bigint,date,time,integer,text,jsonb) from public;
grant execute on function public.respond_public_proposal_v2(uuid,text,uuid,uuid,bigint,date,time,integer,text,jsonb) to anon,authenticated;


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
      'versao', p.versao,
      'publicRevision', p.revision
    )) as snapshot,
    p.cliente_resposta,
    p.cliente_resposta_em,
    p.cliente_mensagem,
    p.cliente_solicitacao
  from public.propostas p
  join resolved r on r.resolved_id = p.id
  where p.public_token_revoked_at is null
    and p.public_token_expires_at > now()
    and p.publication_status <> 'draft'
  limit 1;
$function$
;

create or replace function public.refresh_my_proposal_link(p_proposal_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare my_email text:=lower(nullif(trim(coalesce(auth.jwt()->>'email','')),'')); p public.propostas;
begin
  if auth.uid() is null or my_email is null then raise exception 'Autenticacao obrigatoria'; end if;
  select * into p from public.propostas where id=p_proposal_id and lower(coalesce(cliente_email,''))=my_email;
  if not found then raise exception 'Proposta nao encontrada para este usuario'; end if;
  if p.oportunidade_id is not null then perform event_private.lock_proposal_group(p.oportunidade_id); end if;
  select * into p from public.propostas where id=p_proposal_id and lower(coalesce(cliente_email,''))=my_email for update;
  if not found or not p.is_current or p.publication_status='draft' then raise exception 'Proposta nao encontrada para este usuario'; end if;
  if p.public_token_revoked_at is not null then raise exception 'Acesso revogado pela equipe. Solicite uma nova proposta.'; end if;
  if p.public_token_expires_at<=now() then
    update public.propostas set public_token=gen_random_uuid(),public_token_expires_at=now()+interval '30 days' where id=p.id returning * into p;
  end if;
  return p.public_token;
end; $$;
revoke all on function public.refresh_my_proposal_link(uuid) from public,anon;
grant execute on function public.refresh_my_proposal_link(uuid) to authenticated;


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
    and p.publication_status <> 'draft'
  order by coalesce(p.data_evento, p.created_at::date) desc, p.updated_at desc
  limit 12;
$function$
;

create function event_private.validate_quote_capture(p_snapshot jsonb,p_last_step text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object' or octet_length(p_snapshot::text)>65536 then raise exception 'Dados da solicitacao invalidos ou acima do limite'; end if;
  if length(coalesce(p_snapshot#>>'{cliente,nome}',''))>160 or length(coalesce(p_snapshot#>>'{cliente,email}',''))>320
    or length(coalesce(p_snapshot#>>'{cliente,whatsapp}',''))>40 or length(coalesce(p_snapshot#>>'{cliente,empresa}',''))>240
    or length(coalesce(p_last_step,''))>80 then raise exception 'Campo da solicitacao acima do limite'; end if;
end; $$;
revoke all on function event_private.validate_quote_capture(jsonb,text) from public,anon,authenticated;


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

CREATE OR REPLACE FUNCTION public.submit_public_signal_proof(proposal_token uuid, payment_proof jsonb)
 RETURNS TABLE(ok boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  proposal_row:=event_private.lock_public_proposal(proposal_token);
  target_id:=proposal_row.id;
  if proposal_row.status <> 'negociacao' or proposal_row.cliente_resposta <> 'confirmar' then
    raise exception 'Esta proposta nao aceita mais comprovantes pelo link publico.';
  end if;
  if jsonb_typeof(proposal_row.cliente_solicitacao -> 'comprovante')='object'
     or jsonb_typeof(proposal_row.snapshot -> 'clienteResposta' -> 'comprovante')='object'
     or jsonb_typeof(proposal_row.snapshot -> 'pagamentoSinal')='object' then
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
$function$
;
