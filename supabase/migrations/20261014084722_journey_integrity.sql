-- Monotonic server-owned lock. No historical data is rewritten.
alter table public.propostas add column journey_commercial_locked boolean not null default false,
  add column journey_booked_locked boolean not null default false;

-- Audited journey guards. No updates/backfills of real proposals, payments or acknowledgements.
create function event_private.journey_financial_operator() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
   and lower(u.email) in ('leorangel@gmail.com','financeiro@embaixadacarioca.com.br'));
$$;
revoke all on function event_private.journey_financial_operator() from public,anon,authenticated;

create function event_private.journey_commercial_value(p public.propostas) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object(
  'client',p.snapshot->'client','event',coalesce(p.snapshot->'event','{}')-'notes'-'signalDeadlineAt',
  'items',p.snapshot->'selectedItems','totals',p.snapshot->'totals','terms',p.snapshot->'generalTerms',
  'paymentTerms',p.snapshot->'paymentTerms','offers',p.snapshot->'publicOfferOptions','versionChanges',p.snapshot->'versionChanges',
  'name',p.cliente_nome,'email',p.cliente_email,'phone',p.cliente_whatsapp,
  'type',p.tipo_evento,'date',p.data_evento,'time',p.horario_evento,'guests',p.convidados,
  'duration',p.duracao,'subtotal',p.subtotal,'service',p.taxa_servico,'private',p.privatizacao,'total',p.total);
$$;
revoke all on function event_private.journey_commercial_value(public.propostas) from public,anon,authenticated;

create function event_private.guard_journey_proposal() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb:='{}'; key text; value jsonb; paid numeric; actor_email text; original public.propostas;
  booked text[]:=array['confirmado','pagamento_final','planejamento','evento_proximo','pos_venda'];
begin
 -- Trusted maintenance has no end-user claims. User-facing writes do not get this exemption.
 if auth.uid() is null and session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null then return new; end if;
 if tg_op='UPDATE' then
  new.journey_booked_locked:=old.journey_booked_locked or old.status=any(booked) or new.status=any(booked);
  new.journey_commercial_locked:=old.journey_commercial_locked or old.journey_booked_locked or old.publication_status='sent' or old.status=any(booked)
    or exists(select 1 from public.event_outbox b where b.proposal_id=old.id and b.status in ('sending','accepted','uncertain'))
    or exists(select 1 from event_private.proposal_public_baseline b where b.proposal_id=old.id);
  prior:=old.snapshot;
  if new.journey_commercial_locked and event_private.journey_commercial_value(old) is distinct from event_private.journey_commercial_value(new) then
   raise exception using errcode='PT409',message='O conteúdo liberado deve ser preservado. Crie uma nova versão ou rascunho de aditivo, sem sobrescrever o acordo.';
  end if;
  if old.is_current and (old.journey_booked_locked or old.status=any(booked)) and not new.is_current then
   raise exception using errcode='PT409',message='O acordo confirmado não pode ser substituído por um rascunho. O aditivo exige aprovação e aceite próprios.';
  end if;
 end if;
 if new.is_current and new.oportunidade_id is not null then
  select * into original from public.propostas p where p.oportunidade_id=new.oportunidade_id and p.is_current
    and p.id<>new.id and (p.journey_booked_locked or p.status=any(booked)) for update;
  if found then raise exception using errcode='PT409',message='Preserve o evento confirmado. Salve a alteração como rascunho de aditivo, sem promover ou alterar a operação.'; end if;
 end if;
 if tg_op='INSERT' then
  new.journey_booked_locked:=new.status=any(booked);
  new.journey_commercial_locked:=new.publication_status='sent' or new.journey_booked_locked;
 end if;
 if new.snapshot ? 'amendmentOf' and (new.is_current or new.publication_status<>'draft' or new.status=any(booked)
    or nullif(new.snapshot->'pagamentoSinal','null'::jsonb) is not null or nullif(new.snapshot->'pagamentoRestante','null'::jsonb) is not null) then
  raise exception using errcode='PT409',message='Aditivo em rascunho não pode confirmar venda, pagamento, envio ou operação. Preserve o acordo atual.';
 end if;
 for key in select unnest(array['pagamentoSinal','pagamentoRestante']) loop
  value:=nullif(new.snapshot->key,'null'::jsonb);
  if nullif(prior->key,'null'::jsonb) is distinct from value then
   if not event_private.journey_financial_operator() then
    raise insufficient_privilege using message='Somente Financeiro ou gestor podem validar, corrigir ou remover pagamentos. Comprovante informado não confirma recebimento.';
   end if;
   if value is not null then
    if jsonb_typeof(value)<>'object' or jsonb_typeof(value->'valor')<>'number' or coalesce((value->>'valor')::numeric,0)<=0 then
     raise exception 'Informe um pagamento válido e positivo';
    end if;
    paid:=(value->>'valor')::numeric;
    if key='pagamentoSinal' and paid+0.01<new.total*0.5 then
     if not public.is_super_admin() or length(trim(coalesce(value->>'motivoExcecao','')))<10 then
      raise insufficient_privilege using message='Sinal abaixo do padrão exige autorização do gestor e justificativa da condição aprovada.';
     end if;
     value:=value||jsonb_build_object('excecaoAutorizadaPor',auth.uid(),'excecaoAutorizadaEm',now());
    end if;
    select lower(email) into actor_email from auth.users where id=auth.uid();
    value:=value||jsonb_build_object('validadoPor',auth.uid(),'validadoEmail',actor_email,'validadoEm',now(),'validacaoPendente',false);
    new.snapshot:=jsonb_set(new.snapshot,array[key],value,true);
   end if;
  end if;
 end loop;
 if new.is_current and new.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
  and (coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0
    or coalesce((new.snapshot#>>'{pagamentoSinal,validacaoPendente}')::boolean,false)) then
  raise exception 'Registre e valide o sinal antes de confirmar ou preparar a reserva';
 end if;
 return new;
end; $$;
revoke all on function event_private.guard_journey_proposal() from public,anon,authenticated;
create trigger journey_guard_proposal before insert or update on public.propostas
for each row execute function event_private.guard_journey_proposal();

create function event_private.guard_journey_release() returns trigger
language plpgsql security definer set search_path='' as $$
declare h public.event_handoffs; required_key text;
begin
 if auth.uid() is null and session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null then return new; end if;
 -- Only nested database invalidations may clear a prior decision without
 -- impersonating its owner. Direct RPC updates fire at depth 1 and never qualify.
 if pg_trigger_depth()>1 then
  if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
  if new.status='pending' and new.acknowledged_at is null and new.acknowledged_by is null
    and new.completed_at is null and new.completed_by is null and new.source_version>=old.source_version
    and (new.source_version>old.source_version or
      (to_jsonb(new)-array['status','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at'])=
      (to_jsonb(old)-array['status','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at'])) then
   return new;
  end if;
 end if;
 if new.task_key='financeiro_saldo' and not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='Somente Financeiro ou gestor podem alterar a tarefa de validação financeira';
 end if;
 if new.task_key='gerencia_go_no_go' then
  if auth.uid() is null or not public.is_super_admin() then raise insufficient_privilege using message='Somente o gestor pode dar ciência e liberar a execução'; end if;
  select * into h from public.event_handoffs where opportunity_id=new.opportunity_id for update;
  if not found or h.changes_pending or new.source_version<>h.version then raise exception 'Revise as mudanças da versão operacional antes da liberação'; end if;
  if new.status='done' then
   if not exists(select 1 from public.propostas p where p.id=h.proposal_id and p.is_current
     and p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
     and coalesce((p.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)>0
     and not coalesce((p.snapshot#>>'{pagamentoSinal,validacaoPendente}')::boolean,false)) then
      raise exception 'Evento sem acordo confirmado atual e sinal validado pelo Financeiro ou gestor'; end if;
   foreach required_key in array array['eventos_briefing','financeiro_saldo','cozinha_cardapio','bar_bebidas','estoque_insumos','salao_montagem','gerencia_infra'] loop
    if not exists(select 1 from public.event_handoff_tasks t where t.opportunity_id=new.opportunity_id
      and t.task_key=required_key and t.status='done' and t.acknowledged_at is not null and t.source_version=h.version) then
     raise exception 'Conclua e registre a ciência das sete tarefas setoriais antes da liberação final';
    end if;
   end loop;
  end if;
 end if;
 return new;
end; $$;
revoke all on function event_private.guard_journey_release() from public,anon,authenticated;
create trigger journey_guard_release before update on public.event_handoff_tasks
for each row execute function event_private.guard_journey_release();

create function event_private.invalidate_journey_release() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.task_key<>'gerencia_go_no_go' and
   (new.status<>'done' or new.acknowledged_at is null or new.source_version is distinct from old.source_version) then
  update public.event_handoff_tasks set status='pending',acknowledged_at=null,acknowledged_by=null,
    completed_at=null,completed_by=null,updated_at=now()
   where opportunity_id=new.opportunity_id and task_key='gerencia_go_no_go' and status='done';
 end if;
 return new;
end; $$;
revoke all on function event_private.invalidate_journey_release() from public,anon,authenticated;
create trigger journey_invalidate_release after update on public.event_handoff_tasks
for each row execute function event_private.invalidate_journey_release();

-- Public proof intake records evidence only. Never infer a payment amount from a file.
-- Existing revision/idempotency wrappers and their privileges are unchanged.
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
