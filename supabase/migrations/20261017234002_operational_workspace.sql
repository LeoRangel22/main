-- Coordinators may operate within the same financial and capacity guardrails.
create function event_private.operations_coordinator() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and lower(email) in ('leorangel@gmail.com','eventos@embaixadacarioca.com.br'));
$$;
revoke all on function event_private.operations_coordinator() from public,anon,authenticated;
alter table public.event_handoff_tasks add column responsible_name text check(length(responsible_name)<=120);

create function public.plan_event_handoff_task(target_task uuid,target_source_version integer,expected_updated_at timestamptz,
 responsible_name text,task_due_at timestamptz,task_notes text) returns public.event_handoff_tasks
language plpgsql security definer set search_path='' as $$
declare t public.event_handoff_tasks; h public.event_handoffs;
begin
 perform event_private.require_team();
 if not event_private.operations_coordinator() then raise insufficient_privilege using message='Eventos ou gestor devem distribuir as responsabilidades.';end if;
 select x.* into h from public.event_handoffs x join public.event_handoff_tasks y on y.opportunity_id=x.opportunity_id where y.id=target_task for update of x;
 select * into t from public.event_handoff_tasks where id=target_task for update;
 if not found or not exists(select 1 from public.active_event_handoff_tasks where id=target_task) then raise exception 'Tarefa operacional inativa.';end if;
 if t.source_version is distinct from target_source_version or t.updated_at is distinct from expected_updated_at or t.source_version<>h.version then
  raise exception using errcode='PT409',message='A tarefa mudou. Atualize antes de distribuir a responsabilidade.';end if;
 if length(trim(coalesce(responsible_name,''))) not between 2 and 120 or task_due_at is null then raise exception 'Informe pessoa responsável e prazo.';end if;
 if t.task_key='financeiro_saldo' and not event_private.journey_financial_operator() and left(trim(coalesce(task_notes,'')),2000) is distinct from coalesce(t.notes,'') then raise insufficient_privilege using message='A orientação financeira deve ser revisada pelo Financeiro ou gestor.';end if;
 update public.event_handoff_tasks x set responsible_name=trim(plan_event_handoff_task.responsible_name),
  due_at=task_due_at,notes=case when x.task_key='financeiro_saldo' and not event_private.journey_financial_operator() then x.notes else left(trim(coalesce(task_notes,'')),2000) end,updated_at=now() where id=target_task returning * into t;
 -- Assignment never records acknowledgement or execution.
 return t;
end; $$;
revoke all on function public.plan_event_handoff_task(uuid,integer,timestamptz,text,timestamptz,text) from public,anon;
grant execute on function public.plan_event_handoff_task(uuid,integer,timestamptz,text,timestamptz,text) to authenticated;

create or replace function public.confirm_event_reservation(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; payment jsonb; before_row public.event_reservations; after_row public.event_reservations; unchanged boolean;
begin
 perform event_private.require_team();
 if not event_private.operations_coordinator() then raise insufficient_privilege using message='Eventos ou gestor devem conferir a disponibilidade.'; end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='A proposta mudou. Revise o acordo atual antes de reservar.'; end if;
 if p.is_current is distinct from true or coalesce(p.publication_status,'') not in ('ready','sent') or p.snapshot ? 'amendmentOf' or coalesce(p.status,'') not in ('confirmado','pagamento_final','planejamento','evento_proximo')
  or p.data_evento is null or p.horario_evento is null or (p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo'<=now() then
  raise exception 'Use um acordo atual já confirmado e com início futuro. A reserva não reabre nem confirma a venda.';
 end if;
 payment:=p.snapshot->'pagamentoSinal';
 if payment->>'validacaoPendente'='true' or not (case when jsonb_typeof(payment->'valor')='number' then (payment->>'valor')::numeric>0 else false end)
  or nullif(payment->>'validadoEm','') is null or not exists(select 1 from auth.users u where u.id::text=payment->>'validadoPor' and (lower(u.email) in ('leorangel@gmail.com','financeiro@embaixadacarioca.com.br') or (lower(u.email)='eventos@embaixadacarioca.com.br' and payment->'bankConferido'='true'::jsonb))) then
  raise exception 'Confira o crédito e registre a validação auditada do sinal antes de reservar.';
 end if;
 if (payment->>'valor')::numeric+0.01<p.total*0.5 and (length(trim(coalesce(payment->>'motivoExcecao','')))<10 or nullif(payment->>'excecaoAutorizadaEm','') is null
  or not exists(select 1 from auth.users u where u.id::text=payment->>'excecaoAutorizadaPor' and lower(u.email)='leorangel@gmail.com')) then
  raise exception 'Revalide a exceção do sinal abaixo do padrão com o gestor antes de reservar.';
 end if;
 select * into before_row from public.event_reservations where opportunity_id=p.oportunidade_id;
 -- Existing shared lock, money/discount checks, overlapping reservations and legacy bookings.
 after_row:=event_private.reserve_proposal(p,'confirmed',null);
 unchanged:=before_row.proposal_id is not distinct from after_row.proposal_id and before_row.status='confirmed'
  and (before_row.starts_at,before_row.ends_at,before_row.guests,before_row.exclusive) is not distinct from (after_row.starts_at,after_row.ends_at,after_row.guests,after_row.exclusive);
 if not coalesce(unchanged,false) then
  insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by)
  values(p.oportunidade_id,p.id,'note','internal','system','Disponibilidade e capacidade conferidas; reserva confirmada pela coordenação para a revisão '||p.revision::text||'. Esta ação não registra pagamento ou contato com cliente.',auth.uid());
 end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'reservation',to_jsonb(after_row),'already_confirmed',coalesce(unchanged,false));
end; $$;

create or replace function event_private.guard_journey_release() returns trigger
language plpgsql security definer set search_path='' as $$
declare h public.event_handoffs; p public.propostas; evidence jsonb;
begin
 if auth.uid() is null and session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null then return new; end if;
 if pg_trigger_depth()>1 then
  if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
  if new.status='pending' and new.acknowledged_at is null and new.acknowledged_by is null
    and new.completed_at is null and new.completed_by is null and new.source_version>=old.source_version
    and (new.source_version>old.source_version or
      (to_jsonb(new)-array['status','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at'])=
      (to_jsonb(old)-array['status','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at'])) then return new; end if;
 end if;
 if new.status='blocked' and length(trim(coalesce(new.notes,'')))<5 then raise exception 'Informe o impedimento e o próximo passo nas notas.';end if;
 if new.task_key='financeiro_saldo' and (to_jsonb(new)-array['responsible_name','due_at','updated_at']) is distinct from (to_jsonb(old)-array['responsible_name','due_at','updated_at']) and not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='Somente Financeiro ou gestor podem alterar a tarefa de validação financeira'; end if;
 if new.task_key='gerencia_go_no_go' then
  if auth.uid() is null or not event_private.operations_coordinator() then raise insufficient_privilege using message='Eventos ou gestor devem conferir e liberar a execução'; end if;
  select * into h from public.event_handoffs where opportunity_id=new.opportunity_id for update;
  if not found or h.changes_pending or new.source_version<>h.version then raise exception 'Revise as mudanças da versão operacional antes da liberação'; end if;
  if new.status='done' then
   select * into p from public.propostas where id=h.proposal_id;
   evidence:=event_private.operation_readiness(p);
   if not (evidence->>'ready')::boolean then raise exception '%',evidence->'blockers'->>0; end if;
  end if;
 end if;
 return new;
end; $$;

alter function event_private.operation_readiness(public.propostas) rename to operation_readiness_v1;
revoke all on function event_private.operation_readiness_v1(public.propostas) from public,anon,authenticated;
create function event_private.operation_readiness(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb; missing integer;
begin
 evidence:=event_private.operation_readiness_v1(p);
 select count(*) into missing from public.event_handoff_tasks t join public.event_handoffs h using(opportunity_id)
  where h.proposal_id=p.id and t.source_version=h.version and nullif(trim(t.responsible_name),'') is null;
 if missing>0 then evidence:=evidence||jsonb_build_object('ready',false,'blockers',(evidence->'blockers')||'"Defina uma pessoa responsável para cada tarefa operacional."'::jsonb);end if;
 return evidence||jsonb_build_object('unassigned_tasks',missing);
end; $$;
revoke all on function event_private.operation_readiness(public.propostas) from public,anon,authenticated;

create or replace view public.active_event_handoff_tasks with (security_invoker=true) as
 select t.* from public.event_handoff_tasks t join public.active_event_handoffs h on h.opportunity_id=t.opportunity_id;
