-- Evidence only: do not change seller autonomy, discounts, approvals or real operations.
-- Keep the existing ten-step contract and distinguish an optional manager queue from a gate.
create or replace function public.event_journey_evidence(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb; readiness jsonb; steps jsonb; p public.propostas;
 policy_required boolean; discount_required boolean:=false; discount_valid boolean:=false;
 discount public.event_discount_approvals; discount_amount numeric; malformed boolean:=false;
 historical_execution boolean:=false; closed_at timestamptz;
begin
 evidence:=public.event_journey_evidence_v1(target_proposal,expected_revision);
 readiness:=public.event_operation_readiness(target_proposal,expected_revision);
 select * into p from public.propostas where id=target_proposal;
 begin
  closed_at:=(p.snapshot#>>'{eventOutcome,closedAt}')::timestamptz;
  historical_execution:=coalesce(p.status='pos_venda' and p.snapshot#>>'{eventOutcome,outcome}'='realizado'
   and p.data_evento<=(now() at time zone 'America/Sao_Paulo')::date and isfinite(closed_at) and closed_at<=now()+interval '1 minute'
   and exists(select 1 from auth.users where id::text=p.snapshot#>>'{eventOutcome,closedBy}' or lower(email)=lower(p.snapshot#>>'{eventOutcome,closedBy}')),false);
 exception when others then historical_execution:=false;
 end;
 select coalesce((select enabled from event_private.proposal_approval_policy where id),true) into policy_required;
 begin
  discount_amount:=greatest(0,-coalesce((p.snapshot#>>'{totals,adjustment}')::numeric,0));
  discount_required:=discount_amount>1000 or discount_amount/greatest(coalesce(p.subtotal,0),1)>0.10;
 exception when others then malformed:=true;discount_required:=true;
 end;
 if discount_required and not malformed then
  select * into discount from public.event_discount_approvals a where a.proposal_id=p.id
   and a.fingerprint=event_private.proposal_fingerprint(p);
  discount_valid:=discount.proposal_id is not null and discount.approved_by is not null and discount.approved_at is not null;
 end if;
 select jsonb_agg(case
  when s->>'key'='approval' then s||jsonb_build_object(
   'policy_required',policy_required,'discount_required',discount_required,
   'discount_state',case when not discount_required then 'not_required' when discount_valid then 'confirmed' else 'pending' end,
   'discount_at',discount.approved_at,
   'state',case
    when discount_required and not discount_valid then 'pending'
    when s->>'state'='pending' and s->>'evidence_id' is null and not policy_required and not (p.snapshot ? 'amendmentOf')
     then case when discount_required then 'confirmed' else 'not_required' end
    else s->>'state' end,
   'reason',case when malformed then 'Revise os valores comerciais antes de decidir a alçada.'
    when discount_required and not discount_valid then 'Desconto comercial fora da alçada: falta aprovação válida do gestor para este conteúdo.'
    when discount_required and discount_valid then 'Exceção de desconto comercial registrada para este conteúdo. A política geral continua separada.'
    when not policy_required and not (p.snapshot ? 'amendmentOf') then 'A fila geral do gestor é opcional. A revisão do vendedor e as alçadas de exceção continuam obrigatórias.'
    when p.snapshot ? 'amendmentOf' then 'O aditivo exige sua própria decisão e aceite; a autonomia da proposta comum não o dispensa.'
    else 'A política vigente exige revisão do gestor.' end)
  when s->>'key'='payment' and s->>'state' in ('confirmed','legacy') and not (readiness->>'signal_audited')::boolean then s||'{"state":"legacy"}'::jsonb
  when s->>'key'='reservation' and not (readiness->>'reservation_audited')::boolean then s||'{"state":"pending"}'::jsonb
  when s->>'key'='operation' then s||jsonb_build_object('historical',historical_execution,'state',case when not (readiness->>'ready')::boolean and not historical_execution then 'pending' else s->>'state' end)
  else s end order by ord) into steps from jsonb_array_elements(evidence->'steps') with ordinality a(s,ord);
 return evidence||jsonb_build_object('steps',steps,'readiness',readiness);
end; $$;
revoke all on function public.event_journey_evidence(uuid,bigint) from public,anon;
grant execute on function public.event_journey_evidence(uuid,bigint) to authenticated;

-- The direct manager action is bound to the reviewed revision. Existing internal
-- approval workflows may call the locked legacy helper but users cannot invoke it.
create function public.approve_event_discount(target_proposal uuid,expected_revision bigint)
returns public.event_discount_approvals language plpgsql security definer set search_path='' as $$
declare p public.propostas;
begin
 perform event_private.require_team();
 if not public.is_super_admin() then raise insufficient_privilege using message='A aprovação exige login do gestor';end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then
  raise exception using errcode='PT409',message='A proposta mudou. Revise novamente a alçada desta versão.';
 end if;
 return public.approve_event_discount(target_proposal);
end; $$;
revoke all on function public.approve_event_discount(uuid) from public,anon,authenticated;
revoke all on function public.approve_event_discount(uuid,bigint) from public,anon;
grant execute on function public.approve_event_discount(uuid,bigint) to authenticated;

-- A negotiated zero fee does not remove agreed exclusivity. baseAmount is part
-- of the signed commercial fingerprint; an unbound choice or description is not.
create function event_private.proposal_exclusive(p public.propostas) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(p.snapshot#>>'{totals,privatization,mode}' in ('required-full','optional-full')
  or (p.snapshot#>>'{totals,privatization,mode}'='optional' and
   (coalesce(p.privatizacao,0)>0 or case when jsonb_typeof(p.snapshot#>'{totals,privatization,baseAmount}')='number'
     then (p.snapshot#>>'{totals,privatization,baseAmount}')::numeric>0 else false end)),false);
$$;
revoke all on function event_private.proposal_exclusive(public.propostas) from public,anon,authenticated;

create or replace function event_private.reserve_proposal(p public.propostas,reserve_status text,hold_until timestamptz) returns public.event_reservations language plpgsql security definer set search_path='' as $$
declare r public.event_reservations; cap integer; start_at timestamptz; end_at timestamptz; used integer; conflict boolean; exclusive_event boolean;
begin
  perform pg_advisory_xact_lock(71938501);
  select capacity into cap from public.event_commercial_policy where id;
  if cap is null then raise exception 'Configure a capacidade autorizada na Central comercial antes de reservar'; end if;
  if p.oportunidade_id is null or p.data_evento is null or p.horario_evento is null or p.convidados is null or p.convidados<1 or coalesce(p.duracao,0)<=0 or p.duracao>24 then raise exception 'Informe data, horário, duração e convidados antes de reservar'; end if;
  if p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Pré-reserva somente para evento futuro'; end if;
  if reserve_status='held' and (hold_until is null or hold_until<=now() or hold_until>now()+interval '30 days') then raise exception 'Informe uma validade futura de até 30 dias'; end if;
  start_at:=(p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo';
  end_at:=start_at+make_interval(secs=>(p.duracao*3600)::double precision);
  exclusive_event:=event_private.proposal_exclusive(p);
  select coalesce(sum(x.guests),0),coalesce(bool_or(x.exclusive or exclusive_event),false) into used,conflict from (
    select er.guests,(er.exclusive or event_private.proposal_exclusive(agreement)) as exclusive from public.event_reservations er join public.propostas agreement on agreement.id=er.proposal_id where er.opportunity_id<>p.oportunidade_id and er.status<>'released' and (er.status='confirmed' or er.expires_at>now()) and er.starts_at<end_at and er.ends_at>start_at
    union all
    select legacy.convidados,true from public.propostas legacy where legacy.is_current and legacy.oportunidade_id is distinct from p.oportunidade_id and legacy.status in ('confirmado','pagamento_final','planejamento','evento_proximo') and (legacy.data_evento+legacy.horario_evento) at time zone 'America/Sao_Paulo'<end_at and ((legacy.data_evento+legacy.horario_evento) at time zone 'America/Sao_Paulo')+make_interval(secs=>(coalesce(legacy.duracao,2)*3600)::double precision)>start_at and not exists(select 1 from public.event_reservations er where er.opportunity_id=legacy.oportunidade_id and er.status='confirmed')
  ) x;
  if p.convidados>cap or used+p.convidados>cap or conflict then raise exception 'Conflito de agenda ou capacidade. Revise a disponibilidade antes de confirmar'; end if;
  perform event_private.assert_money(p);
  perform event_private.check_discount(p);
  insert into public.event_reservations(opportunity_id,proposal_id,starts_at,ends_at,guests,exclusive,status,expires_at) values(p.oportunidade_id,p.id,start_at,end_at,p.convidados,exclusive_event,reserve_status,case when reserve_status='held' then hold_until end)
    on conflict(opportunity_id) do update set proposal_id=excluded.proposal_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,guests=excluded.guests,exclusive=excluded.exclusive,status=excluded.status,expires_at=excluded.expires_at,updated_at=now() returning * into r;
  return r;
end; $$;


create or replace function event_private.operation_readiness(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb; plan event_private.production_plans; start_at timestamptz; end_at timestamptz; used integer; cap integer; exclusive_conflict boolean;
begin
 evidence:=event_private.operation_readiness_v2(p);
 if exists(select 1 from public.event_reservations r where r.opportunity_id=p.oportunidade_id and r.proposal_id=p.id
  and r.status='confirmed' and r.exclusive is distinct from event_private.proposal_exclusive(p)) then
  evidence:=evidence||jsonb_build_object('ready',false,'reservation_audited',false,'blockers',(evidence->'blockers')||'"Confira novamente a reserva: a exclusividade não corresponde ao acordo."'::jsonb);
 end if;
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id;
 if plan.proposal_id is distinct from p.id or plan.agreement_fingerprint is distinct from event_private.proposal_fingerprint(p) or plan.reviewed_at is null or plan.reviewed_by is null then
  evidence:=evidence||jsonb_build_object('ready',false,'blockers',(evidence->'blockers')||'"Revise o plano quantificado de produção e logística deste acordo."'::jsonb);
 elsif (plan.data->>'stock_checked_at')::timestamptz<now()-interval '72 hours' then
  evidence:=evidence||jsonb_build_object('ready',false,'blockers',(evidence->'blockers')||'"Atualize a conferência de estoque; a última tem mais de 72 horas."'::jsonb);
 end if;
 start_at:=((p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo')-make_interval(mins=>coalesce((plan.data#>>'{logistics,setup}')::integer,0));
 end_at:=((p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo')+make_interval(secs=>(coalesce(p.duracao,2)*3600)::double precision)+make_interval(mins=>coalesce((plan.data#>>'{logistics,teardown}')::integer,0));
 select capacity into cap from public.event_commercial_policy where id;
 select coalesce(sum(other.convidados),0),coalesce(bool_or(event_private.proposal_exclusive(other) or event_private.proposal_exclusive(p)),false) into used,exclusive_conflict
 from public.propostas other left join event_private.production_plans op on op.opportunity_id=other.oportunidade_id
 where other.is_current and other.oportunidade_id is distinct from p.oportunidade_id and other.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
  and ((other.data_evento+other.horario_evento) at time zone 'America/Sao_Paulo')-make_interval(mins=>coalesce((op.data#>>'{logistics,setup}')::integer,0))<end_at
  and ((other.data_evento+other.horario_evento) at time zone 'America/Sao_Paulo')+make_interval(secs=>(coalesce(other.duracao,2)*3600)::double precision)+make_interval(mins=>coalesce((op.data#>>'{logistics,teardown}')::integer,0))>start_at;
 if cap is null or used+coalesce(p.convidados,0)>cap or exclusive_conflict then
  evidence:=evidence||jsonb_build_object('ready',false,'blockers',(evidence->'blockers')||'"Conflito de capacidade ou privatização incluindo montagem e desmontagem. Revise a agenda."'::jsonb);
 end if;
 return evidence||jsonb_build_object('production_reviewed',plan.reviewed_at is not null,'setup_starts_at',start_at,'teardown_ends_at',end_at);
end; $$;
revoke all on function event_private.operation_readiness(public.propostas) from public,anon,authenticated;
