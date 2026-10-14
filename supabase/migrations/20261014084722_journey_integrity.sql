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
    value:=value||jsonb_build_object('validadoPor',auth.uid(),'validadoEmail',actor_email,'validadoEm',now());
    new.snapshot:=jsonb_set(new.snapshot,array[key],value,true);
   end if;
  end if;
 end loop;
 if new.is_current and new.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
  and coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0 then
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
 if new.task_key='financeiro_saldo' and ((new.status='done' and old.status is distinct from new.status) or (new.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at))
   and not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='A ciência financeira deve ser registrada pelo Financeiro ou gestor';
 end if;
 if new.task_key='gerencia_go_no_go' and (new.status='done' or (new.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at)) then
  if auth.uid() is null or not public.is_super_admin() then raise insufficient_privilege using message='Somente o gestor pode dar ciência e liberar a execução'; end if;
  select * into h from public.event_handoffs where opportunity_id=new.opportunity_id for update;
  if not found or h.changes_pending or new.source_version<>h.version then raise exception 'Revise as mudanças da versão operacional antes da liberação'; end if;
  if new.status='done' then
   if not exists(select 1 from public.propostas p where p.id=h.proposal_id and p.is_current
     and p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')) then raise exception 'Evento sem acordo confirmado atual'; end if;
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
