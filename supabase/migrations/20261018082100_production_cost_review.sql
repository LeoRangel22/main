-- A UUID identifies a line, not the ingredient, unit or staffing priced by Finance.
-- Preserve legacy amounts, but do not certify their basis retroactively. Finance
-- must enter/review them once after this migration before a contribution is shown.
alter table event_private.production_costs add column reviewed_basis jsonb;

create function event_private.production_cost_basis(plan event_private.production_plans,cost_key text) returns jsonb
language sql stable set search_path='' as $$
 with basis as (
  select jsonb_build_object('kind','row','line',r-'stock') value
   from jsonb_array_elements(coalesce(plan.data->'rows','[]')) r where r->>'id'=cost_key
  union all
  select jsonb_build_object('kind','crew','line',c)
   from jsonb_array_elements(coalesce(plan.data->'crew','[]')) c where c->>'id'=cost_key
  union all
  select jsonb_build_object('kind','fixed','logistics',plan.data->'logistics','crew_reason',plan.data->'crew_reason')
   where cost_key='fixed'
 ) select jsonb_build_object('proposal_id',plan.proposal_id,'agreement_fingerprint',plan.agreement_fingerprint,'basis',value) from basis;
$$;
revoke all on function event_private.production_cost_basis(event_private.production_plans,text) from public,anon,authenticated;

-- Invalidation is irreversible by an operational edit: changing a line back or
-- reusing a removed UUID cannot resurrect a price without Finance reviewing it.
create function event_private.invalidate_production_cost_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update event_private.production_costs c set reviewed_basis=null
 where c.opportunity_id=new.opportunity_id and c.reviewed_basis is not null
  and c.reviewed_basis is distinct from event_private.production_cost_basis(new,c.cost_key);
 return new;
end; $$;
revoke all on function event_private.invalidate_production_cost_review() from public,anon,authenticated;
create trigger production_cost_review_changed
 after update of data,proposal_id,agreement_fingerprint on event_private.production_plans
 for each row execute function event_private.invalidate_production_cost_review();

create or replace function public.set_event_production_costs(target_proposal uuid,expected_plan_revision integer,costs jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare p public.propostas; plan event_private.production_plans; c jsonb; basis jsonb;
begin
 perform event_private.require_team();if not event_private.journey_financial_operator() then raise insufficient_privilege using message='Custos são exclusivos do Financeiro ou gestor.';end if;
 -- Match the plan writer's lock order so a stale cost dialog cannot revalidate
 -- amounts against a plan or agreement that changed concurrently.
 select * into p from public.propostas where id=target_proposal for update;
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id for update;
 if not found or plan.revision is distinct from expected_plan_revision or plan.proposal_id is distinct from p.id
  or plan.agreement_fingerprint is distinct from event_private.proposal_fingerprint(p) then
  raise exception using errcode='PT409',message='O plano ou acordo mudou. Atualize os custos.';
 end if;
 if not p.is_current or p.status not in ('confirmado','pagamento_final','planejamento','evento_proximo') then raise exception 'Use o acordo confirmado atual.';end if;
 if jsonb_typeof(costs) is distinct from 'array' or jsonb_array_length(costs)>251 then raise exception 'Custos inválidos.';end if;
 if (select count(*)<>count(distinct entry->>'key') from jsonb_array_elements(costs) entry) then raise exception 'Cada custo precisa de identificação própria.';end if;
 for c in select * from jsonb_array_elements(costs) loop
  if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'key') is distinct from 'string' or not(c ? 'value') then raise exception 'Custo inválido. Informe o valor ou null para marcar como desconhecido.';end if;
  basis:=event_private.production_cost_basis(plan,c->>'key');
  if basis is null then raise exception 'Custo sem linha correspondente no plano.';end if;
  if c->'value'='null'::jsonb then
   delete from event_private.production_costs where opportunity_id=p.oportunidade_id and cost_key=c->>'key';
  else
   if jsonb_typeof(c->'value') is distinct from 'number' or (c->>'value')::numeric<0 then raise exception 'Informe custos conhecidos, inclusive zero quando aplicável.';end if;
   insert into event_private.production_costs(opportunity_id,cost_key,unit_cost,reviewed_basis,updated_by)
   values(p.oportunidade_id,c->>'key',(c->>'value')::numeric,basis,auth.uid())
   on conflict(opportunity_id,cost_key) do update set unit_cost=excluded.unit_cost,reviewed_basis=excluded.reviewed_basis,updated_by=auth.uid(),updated_at=now();
  end if;
 end loop;
 -- Costs and planning share an optimistic concurrency token. Two dialogs opened
 -- at the same revision cannot overwrite/clear each other's newer amounts.
 -- This does not change operational data, review evidence or handoff tasks.
 if jsonb_array_length(costs)>0 then
  update event_private.production_plans set revision=revision+1 where opportunity_id=p.oportunidade_id;
 end if;
end; $$;
revoke all on function public.set_event_production_costs(uuid,integer,jsonb) from public,anon;
grant execute on function public.set_event_production_costs(uuid,integer,jsonb) to authenticated;

create or replace function public.get_event_production_plan(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; plan event_private.production_plans; costs jsonb; estimate numeric; missing integer; financial jsonb:=null;
begin
 perform event_private.require_team();select * into p from public.propostas where id=target_proposal;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize o plano.';end if;
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id;
 if not found then return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'plan',null,'requirements','[]'::jsonb,'can_manage_costs',event_private.journey_financial_operator());end if;
 if event_private.journey_financial_operator() then
  select coalesce(jsonb_object_agg(cost_key,unit_cost),'{}') into costs from event_private.production_costs c where c.opportunity_id=p.oportunidade_id
   and c.reviewed_basis is not null and c.reviewed_basis=event_private.production_cost_basis(plan,c.cost_key);
  with lines as (
   select r->>'id' key,((r->>'quantity')::numeric*case when r->>'basis'='guest' then p.convidados else 1 end)/((r->>'yield')::numeric/100*(1-(r->>'loss')::numeric/100)) multiplier from jsonb_array_elements(plan.data->'rows') r
   union all select r->>'id',(r->>'people')::numeric*(r->>'hours')::numeric from jsonb_array_elements(plan.data->'crew') r
   union all select 'fixed',1
  ) select sum(multiplier*(costs->>key)::numeric),count(*) filter(where not costs ? key) into estimate,missing from lines;
  financial:=jsonb_build_object('complete',missing=0 and plan.reviewed_at is not null and plan.proposal_id=p.id and plan.agreement_fingerprint=event_private.proposal_fingerprint(p),'missing',missing,'estimated_cost',case when missing=0 and plan.reviewed_at is not null and plan.proposal_id=p.id and plan.agreement_fingerprint=event_private.proposal_fingerprint(p) then estimate end,
   'net_revenue',p.total-coalesce(p.taxa_servico,0),'estimated_contribution',case when missing=0 and plan.reviewed_at is not null and plan.proposal_id=p.id and plan.agreement_fingerprint=event_private.proposal_fingerprint(p) then p.total-coalesce(p.taxa_servico,0)-estimate end,
   'label','Estimativa antes de impostos e custos não cadastrados; receita sem taxa de serviço.');
 end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'plan',to_jsonb(plan)-'agreement_fingerprint',
  'agreement_matches',plan.proposal_id=p.id and plan.agreement_fingerprint=event_private.proposal_fingerprint(p),
  'requirements',event_private.production_requirements(p,plan.data),'can_manage_costs',event_private.journey_financial_operator(),'costs',costs,'financial',financial);
end; $$;
revoke all on function public.get_event_production_plan(uuid,bigint) from public,anon;
grant execute on function public.get_event_production_plan(uuid,bigint) to authenticated;

notify pgrst,'reload schema';
