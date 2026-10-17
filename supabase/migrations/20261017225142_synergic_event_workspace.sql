-- Canonical operational evidence. No backfill of payment, reservation or task facts.
create function event_private.audited_payment(p public.propostas, payment_key text default 'pagamentoSinal') returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v jsonb:=p.snapshot->payment_key; actor text; stamped timestamptz;
begin
 if payment_key not in ('pagamentoSinal','pagamentoRestante') or jsonb_typeof(v)<>'object'
   or jsonb_typeof(v->'valor')<>'number' or (v->>'valor')::numeric<=0
   or v->'validacaoPendente' is distinct from 'false'::jsonb then return false; end if;
 begin stamped:=(v->>'validadoEm')::timestamptz; exception when others then return false; end;
 if stamped is null or stamped>now()+interval '1 minute' then return false; end if;
 select lower(email) into actor from auth.users where id::text=v->>'validadoPor';
 return coalesce(actor in ('leorangel@gmail.com','financeiro@embaixadacarioca.com.br')
   or (payment_key='pagamentoSinal' and actor='eventos@embaixadacarioca.com.br' and v->'bankConferido'='true'::jsonb),false);
end; $$;
revoke all on function event_private.audited_payment(public.propostas,text) from public,anon,authenticated;

alter table public.event_reservations add column agreement_fingerprint text,
 add column confirmed_by uuid references auth.users(id), add column confirmed_at timestamptz;
create function event_private.stamp_reservation_agreement() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.propostas;
begin
 if new.status='confirmed' then
  select * into p from public.propostas where id=new.proposal_id;
  new.agreement_fingerprint:=event_private.proposal_fingerprint(p);
  new.confirmed_by:=auth.uid(); new.confirmed_at:=now();
 else new.agreement_fingerprint:=null;new.confirmed_by:=null;new.confirmed_at:=null; end if;
 return new;
end; $$;
revoke all on function event_private.stamp_reservation_agreement() from public,anon,authenticated;
create trigger stamp_reservation_agreement before insert or update on public.event_reservations
 for each row execute function event_private.stamp_reservation_agreement();

create function event_private.operation_readiness(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare h public.event_handoffs; r public.event_reservations; blockers jsonb:='[]'; k text;
 paid numeric:=0; signal_ok boolean; reservation_ok boolean:=false; starts timestamptz;
begin
 signal_ok:=event_private.audited_payment(p);
 starts:=(p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo';
 if p.is_current is distinct from true or p.status not in ('confirmado','pagamento_final','planejamento','evento_proximo')
   or p.snapshot ? 'amendmentOf' then blockers:=blockers||'"Acordo confirmado atual obrigatório."'::jsonb; end if;
 if not signal_ok then blockers:=blockers||'"Confira o crédito e registre a validação auditada do sinal."'::jsonb;
 else paid:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric; end if;
 if event_private.audited_payment(p,'pagamentoRestante') then paid:=paid+(p.snapshot#>>'{pagamentoRestante,valor}')::numeric; end if;
 if starts-interval '72 hours'<=now() and paid+0.01<p.total then
  blockers:=blockers||'"Saldo devido sem validação auditada. Financeiro deve conferir antes da liberação."'::jsonb;
 end if;
 begin perform event_private.assert_money(p); perform event_private.check_discount(p);
 exception when others then blockers:=blockers||'"Revise os valores e a alçada comercial do acordo."'::jsonb; end;
 select * into r from public.event_reservations where opportunity_id=p.oportunidade_id;
 reservation_ok:=coalesce(r.status='confirmed' and r.proposal_id=p.id and r.confirmed_by is not null and r.confirmed_at is not null
   and r.agreement_fingerprint=event_private.proposal_fingerprint(p)
   and r.starts_at=starts and r.ends_at=starts+make_interval(secs=>(p.duracao*3600)::double precision)
   and r.guests=p.convidados,false);
 if not reservation_ok then blockers:=blockers||'"Confirme a disponibilidade e a reserva auditada deste acordo."'::jsonb; end if;
 select * into h from public.event_handoffs where opportunity_id=p.oportunidade_id;
 if h.proposal_id is distinct from p.id or h.changes_pending is distinct from false
   or h.source_fingerprint is distinct from encode(extensions.digest(event_private.handoff_source_snapshot(p)::text,'sha256'),'hex') then
  blockers:=blockers||'"Revise as mudanças e a versão do checklist operacional."'::jsonb;
 end if;
 foreach k in array array['eventos_briefing','financeiro_saldo','cozinha_cardapio','bar_bebidas','estoque_insumos','salao_montagem','gerencia_infra'] loop
  if not exists(select 1 from public.event_handoff_tasks t where t.opportunity_id=p.oportunidade_id and t.task_key=k
    and t.source_version=h.version and t.status='done' and t.acknowledged_at is not null and t.acknowledged_by is not null
    and t.completed_at is not null and t.completed_by is not null) then
   blockers:=blockers||'"Conclua as sete tarefas setoriais e registre a ciência na versão atual."'::jsonb;exit;
  end if;
 end loop;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'handoff_version',h.version,
  'generated_at',now(),'signal_audited',signal_ok,'reservation_audited',reservation_ok,
  'paid_audited',paid,'balance_due',greatest(0,p.total-paid),'blockers',blockers,'ready',jsonb_array_length(blockers)=0);
end; $$;
revoke all on function event_private.operation_readiness(public.propostas) from public,anon,authenticated;
create function public.event_operation_readiness(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas;
begin
 perform event_private.require_team();
 select * into p from public.propostas where id=target_proposal;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize antes de conferir a liberação.'; end if;
 return event_private.operation_readiness(p);
end; $$;
revoke all on function public.event_operation_readiness(uuid,bigint) from public,anon;
grant execute on function public.event_operation_readiness(uuid,bigint) to authenticated;

-- Keep financial permission and nested invalidation behavior; replace only final evidence decision.
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
 if new.task_key='financeiro_saldo' and not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='Somente Financeiro ou gestor podem alterar a tarefa de validação financeira'; end if;
 if new.task_key='gerencia_go_no_go' then
  if auth.uid() is null or not public.is_super_admin() then raise insufficient_privilege using message='Somente o gestor pode dar ciência e liberar a execução'; end if;
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

-- Existing ten-step journey consumes the very same canonical release evidence.
alter function public.event_journey_evidence(uuid,bigint) rename to event_journey_evidence_v1;
revoke all on function public.event_journey_evidence_v1(uuid,bigint) from public,anon,authenticated;
create function public.event_journey_evidence(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb; readiness jsonb; steps jsonb;
begin
 evidence:=public.event_journey_evidence_v1(target_proposal,expected_revision);
 readiness:=public.event_operation_readiness(target_proposal,expected_revision);
 select jsonb_agg(case
  when s->>'key'='payment' and s->>'state' in ('confirmed','legacy') and not (readiness->>'signal_audited')::boolean then s||'{"state":"legacy"}'::jsonb
  when s->>'key'='reservation' and not (readiness->>'reservation_audited')::boolean then s||'{"state":"pending"}'::jsonb
  when s->>'key'='operation' and not (readiness->>'ready')::boolean then s||'{"state":"pending"}'::jsonb
  else s end order by ord) into steps from jsonb_array_elements(evidence->'steps') with ordinality a(s,ord);
 return evidence||jsonb_build_object('steps',steps,'readiness',readiness);
end; $$;
revoke all on function public.event_journey_evidence(uuid,bigint) from public,anon;
grant execute on function public.event_journey_evidence(uuid,bigint) to authenticated;
