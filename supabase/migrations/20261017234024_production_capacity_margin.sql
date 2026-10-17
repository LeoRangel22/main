create or replace function event_private.invalidate_journey_release() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.task_key<>'gerencia_go_no_go' and (new.status<>'done' or new.acknowledged_at is null or new.source_version is distinct from old.source_version) then
  update public.event_handoff_tasks set status='pending',acknowledged_at=null,acknowledged_by=null,completed_at=null,completed_by=null,
   source_version=greatest(source_version,new.source_version),updated_at=now()
  where opportunity_id=new.opportunity_id and task_key='gerencia_go_no_go' and (status='done' or acknowledged_at is not null or source_version<new.source_version);
 end if;
 return new;
end; $$;

-- Only server functions can advance source_version; the financial signature stays protected.
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
 if new.task_key='financeiro_saldo' and (to_jsonb(new)-array['responsible_name','due_at','source_version','updated_at']) is distinct from (to_jsonb(old)-array['responsible_name','due_at','source_version','updated_at']) and not event_private.journey_financial_operator() then
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
-- Production uses the current agreement, with no invented recipes, inventory or staffing.
create table event_private.production_plans(
 opportunity_id uuid primary key references public.oportunidades(id),proposal_id uuid not null references public.propostas(id),
 agreement_fingerprint text not null,revision integer not null default 1,data jsonb not null,
 reviewed_by uuid references auth.users(id),reviewed_at timestamptz,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table event_private.production_costs(
 opportunity_id uuid not null references event_private.production_plans(opportunity_id) on delete cascade,
 cost_key text not null,unit_cost numeric not null check(unit_cost>=0 and unit_cost::text not in ('NaN','Infinity','-Infinity')),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(opportunity_id,cost_key)
);
alter table event_private.production_plans enable row level security;alter table event_private.production_costs enable row level security;
revoke all on event_private.production_plans,event_private.production_costs from public,anon,authenticated;

create function event_private.production_requirements(p public.propostas,data jsonb) returns jsonb
language sql stable set search_path='' as $$
 with lines as (
  select r,lower(trim(r->>'ingredient')) as ingredient_key,r->>'ingredient' as ingredient,r->>'sector' as sector,r->>'unit' as unit,
   round(((r->>'quantity')::numeric*case when r->>'basis'='guest' then p.convidados else 1 end)/((r->>'yield')::numeric/100*(1-(r->>'loss')::numeric/100)),3) as required,
   (r->>'stock')::numeric as stock
  from jsonb_array_elements(coalesce(data->'rows','[]')) r
 ), grouped as (
  select ingredient_key,unit,string_agg(distinct sector,' / ' order by sector) sector,min(ingredient) ingredient,sum(required) required,
   case when count(distinct stock)=1 and count(stock)=count(*) then min(stock) end as stock
  from lines group by ingredient_key,unit
 ) select coalesce(jsonb_agg(jsonb_build_object('ingredient',ingredient,'sector',sector,'unit',unit,'required',required,
  'stock',stock,'purchase',case when stock is not null then greatest(0,required-stock) end) order by sector,ingredient),'[]') from grouped;
$$;
revoke all on function event_private.production_requirements(public.propostas,jsonb) from public,anon,authenticated;

create function public.save_event_production_plan(target_proposal uuid,expected_revision bigint,expected_plan_revision integer,plan_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; prior event_private.production_plans; next_plan event_private.production_plans; h public.event_handoffs;
 r jsonb; c jsonb; item_count integer; sectors text[]; sector_name text; next_version integer; changed_rows boolean; logistics_changed boolean;
begin
 perform event_private.require_team();if not event_private.operations_coordinator() then raise insufficient_privilege using message='Eventos ou gestor deve planejar a produção.';end if;
 perform pg_advisory_xact_lock(71938501);
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize o plano antes de salvar.';end if;
 if not p.is_current or p.status not in ('confirmado','pagamento_final','planejamento','evento_proximo') or p.snapshot ? 'amendmentOf' then raise exception 'Planeje a execução do acordo confirmado vigente.';end if;
 select * into prior from event_private.production_plans where opportunity_id=p.oportunidade_id for update;
 if prior.data=plan_data and prior.agreement_fingerprint=event_private.proposal_fingerprint(p) then return jsonb_build_object('revision',prior.revision,'existing',true);end if;
 if coalesce(prior.revision,0) is distinct from expected_plan_revision then raise exception using errcode='PT409',message='O plano foi atualizado por outra pessoa. Recarregue antes de salvar.';end if;
 if jsonb_typeof(plan_data)<>'object' or octet_length(plan_data::text)>100000 or jsonb_typeof(plan_data->'rows') is distinct from 'array' or jsonb_array_length(plan_data->'rows')>200
  or jsonb_typeof(plan_data->'crew') is distinct from 'array' or jsonb_array_length(plan_data->'crew')>50 or jsonb_typeof(plan_data->'logistics') is distinct from 'object' then raise exception 'Plano de produção inválido.';end if;
 item_count:=jsonb_array_length(coalesce(p.snapshot->'selectedItems','[]'));
 for r in select * from jsonb_array_elements(plan_data->'rows') loop
  if coalesce(r->>'id','') !~ '^[a-f0-9-]{36}$' or jsonb_typeof(r->'item') is distinct from 'number' or (r->>'item')::integer not between 0 and item_count-1
   or length(trim(coalesce(r->>'ingredient',''))) not between 2 and 160 or coalesce(r->>'sector','') not in ('cozinha','bar','estoque','salao','gerencia')
   or coalesce(r->>'unit','') not in ('kg','g','l','ml','un','porcao','lote') or coalesce(r->>'basis','') not in ('guest','event')
   or jsonb_typeof(r->'quantity') is distinct from 'number' or (r->>'quantity')::numeric<=0 or (r->>'quantity')::numeric>1000000
   or jsonb_typeof(r->'yield') is distinct from 'number' or (r->>'yield')::numeric<=0 or (r->>'yield')::numeric>100
   or jsonb_typeof(r->'loss') is distinct from 'number' or (r->>'loss')::numeric<0 or (r->>'loss')::numeric>=100
   or (r->'stock'<>'null'::jsonb and (jsonb_typeof(r->'stock') is distinct from 'number' or (r->>'stock')::numeric<0)) then raise exception 'Confira item, insumo, unidade, quantidade, rendimento, perda e estoque.';end if;
 end loop;
 if (select count(*)<>count(distinct entry->>'id') from jsonb_array_elements(plan_data->'rows') entry) then raise exception 'Cada linha de produção precisa de identificação própria.';end if;
 for c in select * from jsonb_array_elements(plan_data->'crew') loop
  if coalesce(c->>'id','') !~ '^[a-f0-9-]{36}$' or length(trim(coalesce(c->>'lead',''))) not between 2 and 120
   or coalesce(c->>'sector','') not in ('cozinha','bar','estoque','salao','gerencia','eventos') or jsonb_typeof(c->'people') is distinct from 'number'
   or (c->>'people')::integer not between 1 and 200 or jsonb_typeof(c->'hours') is distinct from 'number' or (c->>'hours')::numeric<=0 or (c->>'hours')::numeric>72 then raise exception 'Confira setor, responsável, pessoas e horas da equipe.';end if;
 end loop;
 if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements((plan_data->'rows')||(plan_data->'crew')) x) then raise exception 'Insumos e equipes precisam de identificações distintas.';end if;
 r:=plan_data->'logistics';
 if length(coalesce(r->>'space',''))>120 or jsonb_typeof(r->'setup') is distinct from 'number' or jsonb_typeof(r->'teardown') is distinct from 'number' or (r->>'setup')::integer not between 0 and 720 or (r->>'teardown')::integer not between 0 and 720 then raise exception 'Montagem e desmontagem devem estar entre 0 e 720 minutos.';end if;
 if coalesce(r->>'authorization','') not in ('pending','confirmed','not_required') then raise exception 'Informe a situação da autorização do Parque.';end if;
 if nullif(plan_data->>'stock_checked_at','') is not null and (plan_data->>'stock_checked_at')::timestamptz>now()+interval '1 minute' then raise exception 'A conferência de estoque não pode estar no futuro.';end if;
 select * into h from public.event_handoffs where opportunity_id=p.oportunidade_id for update;
 if not found then raise exception 'Atualize o checklist operacional antes de planejar a produção.';end if;
 changed_rows:=prior.data->'rows' is distinct from plan_data->'rows';
 logistics_changed:=prior.data->'logistics' is distinct from plan_data->'logistics' or prior.data->'crew' is distinct from plan_data->'crew';
 sectors:=array['eventos','gerencia'];
 if prior.data->'stock_checked_at' is distinct from plan_data->'stock_checked_at' then sectors:=array_append(sectors,'estoque');end if;
 if changed_rows then
  for sector_name in select distinct entry->>'sector' from jsonb_array_elements(coalesce(prior.data->'rows','[]')||(plan_data->'rows')) entry loop
   if (select jsonb_agg(entry order by entry->>'id') from jsonb_array_elements(coalesce(prior.data->'rows','[]')) entry where entry->>'sector'=sector_name)
    is distinct from (select jsonb_agg(entry order by entry->>'id') from jsonb_array_elements(plan_data->'rows') entry where entry->>'sector'=sector_name) then sectors:=array_append(sectors,sector_name);end if;
  end loop;
  if cardinality(sectors)>2 then sectors:=array_append(sectors,'estoque');end if;
 end if;
 if logistics_changed then sectors:=sectors||array['salao','cozinha','bar','estoque'];end if;
 insert into event_private.production_plans(opportunity_id,proposal_id,agreement_fingerprint,data,updated_by)
 values(p.oportunidade_id,p.id,event_private.proposal_fingerprint(p),plan_data,auth.uid()) on conflict(opportunity_id) do update
 set proposal_id=excluded.proposal_id,agreement_fingerprint=excluded.agreement_fingerprint,data=excluded.data,revision=production_plans.revision+1,
  reviewed_at=null,reviewed_by=null,updated_by=auth.uid(),updated_at=now() returning * into next_plan;
 next_version:=h.version+1;
 update public.event_handoffs set version=next_version,changes_pending=true,status='active',updated_at=now() where opportunity_id=p.oportunidade_id;
 insert into public.event_handoff_changes(opportunity_id,proposal_id,handoff_version,changed_fields,before_snapshot,after_snapshot)
 values(p.oportunidade_id,p.id,next_version,array['Plano de produção e logística'],coalesce(prior.data,'{}'),plan_data);
 update public.event_handoff_tasks set source_version=next_version,
  status=case when sector=any(sectors) then 'pending' else status end,
  acknowledged_at=case when sector=any(sectors) then null else acknowledged_at end,
  acknowledged_by=case when sector=any(sectors) then null else acknowledged_by end,
  completed_at=case when sector=any(sectors) then null else completed_at end,
  completed_by=case when sector=any(sectors) then null else completed_by end,updated_at=now()
 where opportunity_id=p.oportunidade_id and task_key<>'gerencia_go_no_go';
 return jsonb_build_object('revision',next_plan.revision,'handoff_version',next_version,'existing',false);
end; $$;
revoke all on function public.save_event_production_plan(uuid,bigint,integer,jsonb) from public,anon;
grant execute on function public.save_event_production_plan(uuid,bigint,integer,jsonb) to authenticated;

create function public.review_event_production_plan(target_proposal uuid,expected_revision bigint,expected_plan_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; plan event_private.production_plans; i integer; requirements jsonb; l jsonb;
begin
 perform event_private.require_team();if not event_private.operations_coordinator() then raise insufficient_privilege;end if;
 select * into p from public.propostas where id=target_proposal for update;
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id for update;
 if p.revision is distinct from expected_revision or plan.revision is distinct from expected_plan_revision or plan.agreement_fingerprint is distinct from event_private.proposal_fingerprint(p) then raise exception using errcode='PT409',message='O acordo ou plano mudou. Atualize e revise novamente.';end if;
 if not p.is_current or p.status not in ('confirmado','pagamento_final','planejamento','evento_proximo') then raise exception 'Use o acordo confirmado atual.';end if;
 for i in 0..jsonb_array_length(coalesce(p.snapshot->'selectedItems','[]'))-1 loop
  if not exists(select 1 from jsonb_array_elements(plan.data->'rows') r where (r->>'item')::integer=i) then raise exception 'Cada item contratado precisa de insumo ou serviço quantificado no plano.';end if;
 end loop;
 if jsonb_array_length(plan.data->'rows')=0 then raise exception 'Quantifique os insumos e serviços antes de revisar.';end if;
 requirements:=event_private.production_requirements(p,plan.data);
 if exists(select 1 from jsonb_array_elements(requirements) r where r->'stock'='null'::jsonb) or nullif(plan.data->>'stock_checked_at','') is null then raise exception 'Informe estoque conferido, sem divergência para o mesmo insumo e unidade.';end if;
 if jsonb_array_length(plan.data->'crew')=0 and length(trim(coalesce(plan.data->>'crew_reason','')))<15 then raise exception 'Dimensione a equipe ou justifique o atendimento pela escala regular.';end if;
 l:=plan.data->'logistics';
 if length(trim(coalesce(l->>'space','')))<2 or length(trim(coalesce(l->>'access','')))<10 or length(trim(coalesce(l->>'tickets','')))<10 or length(trim(coalesce(l->>'weather','')))<10
  or length(trim(coalesce(l->>'authorization_notes','')))<10 or l->>'authorization'='pending' then raise exception 'Revise espaço, acesso, ingressos, contingência e autorização do Parque.';end if;
 if coalesce(p.snapshot#>>'{event,notes}','')~*'(^|[^a-z])(dj|banda|banner|atração musical)([^a-z]|$)' and l->>'authorization'<>'confirmed' then raise exception 'A atração ou divulgação exige autorização conferida do Parque.';end if;
 update event_private.production_plans set reviewed_by=auth.uid(),reviewed_at=now() where opportunity_id=p.oportunidade_id;
 return jsonb_build_object('revision',plan.revision,'reviewed',true);
end; $$;
revoke all on function public.review_event_production_plan(uuid,bigint,integer) from public,anon;
grant execute on function public.review_event_production_plan(uuid,bigint,integer) to authenticated;

create function public.set_event_production_costs(target_proposal uuid,expected_plan_revision integer,costs jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare p public.propostas; plan event_private.production_plans; c jsonb;
begin
 perform event_private.require_team();if not event_private.journey_financial_operator() then raise insufficient_privilege using message='Custos são exclusivos do Financeiro ou gestor.';end if;
 select * into p from public.propostas where id=target_proposal;
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id for update;
 if not found or plan.revision is distinct from expected_plan_revision then raise exception using errcode='PT409',message='O plano mudou. Atualize os custos.';end if;
 if jsonb_typeof(costs) is distinct from 'array' or jsonb_array_length(costs)>251 then raise exception 'Custos inválidos.';end if;
 for c in select * from jsonb_array_elements(costs) loop
  if c->>'key'<>'fixed' and not exists(select 1 from jsonb_array_elements((plan.data->'rows')||(plan.data->'crew')) r where r->>'id'=c->>'key') then raise exception 'Custo sem linha correspondente no plano.';end if;
  if jsonb_typeof(c->'value') is distinct from 'number' or (c->>'value')::numeric<0 then raise exception 'Informe custos conhecidos, inclusive zero quando aplicável.';end if;
  insert into event_private.production_costs(opportunity_id,cost_key,unit_cost,updated_by) values(p.oportunidade_id,c->>'key',(c->>'value')::numeric,auth.uid())
  on conflict(opportunity_id,cost_key) do update set unit_cost=excluded.unit_cost,updated_by=auth.uid(),updated_at=now();
 end loop;
end; $$;
revoke all on function public.set_event_production_costs(uuid,integer,jsonb) from public,anon;
grant execute on function public.set_event_production_costs(uuid,integer,jsonb) to authenticated;

create function public.get_event_production_plan(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; plan event_private.production_plans; costs jsonb; estimate numeric; missing integer; financial jsonb:=null;
begin
 perform event_private.require_team();select * into p from public.propostas where id=target_proposal;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize o plano.';end if;
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id;
 if not found then return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'plan',null,'requirements','[]'::jsonb,'can_manage_costs',event_private.journey_financial_operator());end if;
 if event_private.journey_financial_operator() then
  select coalesce(jsonb_object_agg(cost_key,unit_cost),'{}') into costs from event_private.production_costs where opportunity_id=p.oportunidade_id;
  with lines as (
   select r->>'id' key,((r->>'quantity')::numeric*case when r->>'basis'='guest' then p.convidados else 1 end)/((r->>'yield')::numeric/100*(1-(r->>'loss')::numeric/100)) multiplier from jsonb_array_elements(plan.data->'rows') r
   union all select r->>'id',(r->>'people')::numeric*(r->>'hours')::numeric from jsonb_array_elements(plan.data->'crew') r
   union all select 'fixed',1
  ) select sum(multiplier*(costs->>key)::numeric),count(*) filter(where not costs ? key) into estimate,missing from lines;
  financial:=jsonb_build_object('complete',missing=0 and plan.reviewed_at is not null and plan.agreement_fingerprint=event_private.proposal_fingerprint(p),'missing',missing,'estimated_cost',case when missing=0 and plan.reviewed_at is not null and plan.agreement_fingerprint=event_private.proposal_fingerprint(p) then estimate end,
   'net_revenue',p.total-coalesce(p.taxa_servico,0),'estimated_contribution',case when missing=0 and plan.reviewed_at is not null and plan.agreement_fingerprint=event_private.proposal_fingerprint(p) then p.total-coalesce(p.taxa_servico,0)-estimate end,
   'label','Estimativa antes de impostos e custos não cadastrados; receita sem taxa de serviço.');
 end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'plan',to_jsonb(plan)-'agreement_fingerprint',
  'agreement_matches',plan.proposal_id=p.id and plan.agreement_fingerprint=event_private.proposal_fingerprint(p),
  'requirements',event_private.production_requirements(p,plan.data),'can_manage_costs',event_private.journey_financial_operator(),'costs',costs,'financial',financial);
end; $$;
revoke all on function public.get_event_production_plan(uuid,bigint) from public,anon;
grant execute on function public.get_event_production_plan(uuid,bigint) to authenticated;

-- Operational release also checks the reviewed production agreement and inventory freshness.
alter function event_private.operation_readiness(public.propostas) rename to operation_readiness_v2;
revoke all on function event_private.operation_readiness_v2(public.propostas) from public,anon,authenticated;
create function event_private.operation_readiness(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb; plan event_private.production_plans; start_at timestamptz; end_at timestamptz; used integer; cap integer; exclusive_conflict boolean;
begin
 evidence:=event_private.operation_readiness_v2(p);
 select * into plan from event_private.production_plans where opportunity_id=p.oportunidade_id;
 if plan.proposal_id is distinct from p.id or plan.agreement_fingerprint is distinct from event_private.proposal_fingerprint(p) or plan.reviewed_at is null or plan.reviewed_by is null then
  evidence:=evidence||jsonb_build_object('ready',false,'blockers',(evidence->'blockers')||'"Revise o plano quantificado de produção e logística deste acordo."'::jsonb);
 elsif (plan.data->>'stock_checked_at')::timestamptz<now()-interval '72 hours' then
  evidence:=evidence||jsonb_build_object('ready',false,'blockers',(evidence->'blockers')||'"Atualize a conferência de estoque; a última tem mais de 72 horas."'::jsonb);
 end if;
 start_at:=((p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo')-make_interval(mins=>coalesce((plan.data#>>'{logistics,setup}')::integer,0));
 end_at:=((p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo')+make_interval(secs=>(coalesce(p.duracao,2)*3600)::double precision)+make_interval(mins=>coalesce((plan.data#>>'{logistics,teardown}')::integer,0));
 select capacity into cap from public.event_commercial_policy where id;
 select coalesce(sum(other.convidados),0),coalesce(bool_or(coalesce(other.snapshot#>>'{totals,privatization,mode}','') in ('required-full','optional-full') or (other.snapshot#>>'{totals,privatization,mode}'='optional' and coalesce(other.privatizacao,0)>0) or coalesce(p.snapshot#>>'{totals,privatization,mode}','') in ('required-full','optional-full') or (p.snapshot#>>'{totals,privatization,mode}'='optional' and coalesce(p.privatizacao,0)>0)),false) into used,exclusive_conflict
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

-- Payment-only revisions do not erase the operational work of unaffected sectors.
create or replace function event_private.sync_event_handoff(p public.propostas)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_handoff public.event_handoffs;
  next_snapshot jsonb;
  next_fingerprint text;
  next_version integer;
  changed text[];
  event_day date;
  financial_only boolean:=false;
begin
  if p.oportunidade_id is null
     or not coalesce(p.is_current, true)
     or p.status in ('cancelado','perdido','pos_venda')
     or not coalesce((p.status in ('confirmado','pagamento_final','planejamento','evento_proximo') or jsonb_typeof(p.snapshot -> 'pagamentoSinal') = 'object'), false) then
    return;
  end if;

  next_snapshot := event_private.handoff_source_snapshot(p);
  next_fingerprint := encode(extensions.digest(next_snapshot::text, 'sha256'), 'hex');
  event_day := p.data_evento;

  select * into current_handoff
  from public.event_handoffs
  where opportunity_id = p.oportunidade_id
  for update;

  if not found then
    insert into public.event_handoffs(
      opportunity_id, proposal_id, source_fingerprint, source_snapshot, generated_by
    ) values (
      p.oportunidade_id, p.id, next_fingerprint, next_snapshot, auth.uid()
    );
    next_version := 1;
  elsif current_handoff.source_fingerprint <> next_fingerprint then
    next_version := current_handoff.version + 1;
    financial_only:=(current_handoff.source_snapshot-array['signal','remaining_payment'])=(next_snapshot-array['signal','remaining_payment']);
    changed := array_remove(array[
      case when current_handoff.source_snapshot -> 'event_type' is distinct from next_snapshot -> 'event_type' then 'Formato' end,
      case when current_handoff.source_snapshot -> 'event_date' is distinct from next_snapshot -> 'event_date' then 'Data' end,
      case when current_handoff.source_snapshot -> 'event_time' is distinct from next_snapshot -> 'event_time' then 'Horario' end,
      case when current_handoff.source_snapshot -> 'guests' is distinct from next_snapshot -> 'guests' then 'Convidados' end,
      case when current_handoff.source_snapshot -> 'duration' is distinct from next_snapshot -> 'duration' then 'Duracao' end,
      case when current_handoff.source_snapshot -> 'selected_items' is distinct from next_snapshot -> 'selected_items' then 'Cardapio e bebidas' end,
      case when current_handoff.source_snapshot -> 'preferences' is distinct from next_snapshot -> 'preferences' then 'Preferencias' end,
      case when current_handoff.source_snapshot -> 'notes' is distinct from next_snapshot -> 'notes' then 'Observacoes' end,
      case when current_handoff.source_snapshot -> 'extras' is distinct from next_snapshot -> 'extras' then 'Extras' end,
      case when current_handoff.source_snapshot -> 'total' is distinct from next_snapshot -> 'total' then 'Valor' end,
      case when current_handoff.source_snapshot -> 'privatization' is distinct from next_snapshot -> 'privatization' then 'Privatizacao' end,
      case when current_handoff.source_snapshot -> 'client_phone' is distinct from next_snapshot -> 'client_phone' then 'Contato do cliente' end,
      case when current_handoff.source_snapshot -> 'remaining_payment' is distinct from next_snapshot -> 'remaining_payment' then 'Pagamento restante' end
    ], null);

    if cardinality(changed) = 0 then
      changed := array[case when financial_only then 'Validação de pagamento' else 'Dados da proposta' end];
    end if;

    update public.event_handoffs
    set proposal_id = p.id,
        version = next_version,
        source_fingerprint = next_fingerprint,
        source_snapshot = next_snapshot,
        changes_pending = true,
        status = 'active',
        updated_at = now()
    where opportunity_id = p.oportunidade_id;

    insert into public.event_handoff_changes(
      opportunity_id, proposal_id, handoff_version, changed_fields, before_snapshot, after_snapshot
    ) values (
      p.oportunidade_id, p.id, next_version, changed, current_handoff.source_snapshot, next_snapshot
    );
  else
    update public.event_handoffs
    set proposal_id = p.id, updated_at = now()
    where opportunity_id = p.oportunidade_id;
    next_version := current_handoff.version;
  end if;

  insert into public.event_handoff_tasks(
    opportunity_id, task_key, sector, label, details, owner_label, due_at, sort_order, source_version
  )
  values
    (p.oportunidade_id, 'eventos_briefing', 'eventos', 'Conferir briefing final e contato do dia', 'Validar data, horario, pax, preferencias, extras e responsavel do cliente.', 'Equipe de Eventos', case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end, 10, next_version),
    (p.oportunidade_id, 'financeiro_saldo', 'financeiro', 'Alinhar saldo e comprovantes', 'Confirmar valores, vencimentos, bancos e divergencias antes de liberar a operacao.', 'Financeiro', case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end, 20, next_version),
    (p.oportunidade_id, 'cozinha_cardapio', 'cozinha', 'Validar cardapio, restricoes e producao', 'Conferir quantidades, dietas, alergias, tempos e mise en place.', 'Cozinha', case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end, 30, next_version),
    (p.oportunidade_id, 'bar_bebidas', 'bar', 'Validar bebidas e mise en place do bar', 'Conferir pacotes, quantidades, gelo, copos, insumos e servico.', 'Bar', case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end, 40, next_version),
    (p.oportunidade_id, 'estoque_insumos', 'estoque', 'Separar insumos e extras contratados', 'Cruzar ficha com estoque, compras e itens de terceiros.', 'Estoque', case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end, 50, next_version),
    (p.oportunidade_id, 'salao_montagem', 'salao', 'Definir montagem, equipe e linha do tempo', 'Confirmar layout, recepcao, sequencia de servico e desmontagem.', 'Salao', case when event_day is null then null else ((event_day - 2) + time '12:00') at time zone 'America/Sao_Paulo' end, 60, next_version),
    (p.oportunidade_id, 'gerencia_infra', 'gerencia', 'Validar infraestrutura e obrigatorios', 'Revisar seguranca, limpeza, gerador, ECAD, seguro, ambulancia, bombeiro, internet e estacionamento quando aplicavel.', 'Gerencia', case when event_day is null then null else ((event_day - 2) + time '12:00') at time zone 'America/Sao_Paulo' end, 70, next_version),
    (p.oportunidade_id, 'gerencia_go_no_go', 'gerencia', 'Fazer leitura final e liberar execucao', 'Confirmar que todos os setores deram ciencia e que nao ha mudanca pendente.', 'Gerencia', case when event_day is null then null else ((event_day - 1) + time '12:00') at time zone 'America/Sao_Paulo' end, 80, next_version)
  on conflict(opportunity_id, task_key) do nothing;

  if current_handoff.opportunity_id is not null and current_handoff.source_fingerprint <> next_fingerprint then
    update public.event_handoff_tasks
    set due_at = case when current_handoff.source_snapshot->'event_date' is distinct from next_snapshot->'event_date' then case task_key
          when 'eventos_briefing' then case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'financeiro_saldo' then case when event_day is null then null else ((event_day - 5) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'cozinha_cardapio' then case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'bar_bebidas' then case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'estoque_insumos' then case when event_day is null then null else ((event_day - 3) + time '12:00') at time zone 'America/Sao_Paulo' end
          when 'salao_montagem' then case when event_day is null then null else ((event_day - 2) + time '12:00') at time zone 'America/Sao_Paulo' end
          else case when event_day is null then null else ((event_day - case when task_key = 'gerencia_go_no_go' then 1 else 2 end) + time '12:00') at time zone 'America/Sao_Paulo' end
        end else due_at end,
        source_version = next_version,
        status = case when not financial_only or task_key in ('financeiro_saldo','eventos_briefing','gerencia_go_no_go') then 'pending' else status end,
        acknowledged_at = case when not financial_only or task_key in ('financeiro_saldo','eventos_briefing','gerencia_go_no_go') then null else acknowledged_at end,
        acknowledged_by = case when not financial_only or task_key in ('financeiro_saldo','eventos_briefing','gerencia_go_no_go') then null else acknowledged_by end,
        completed_at = case when not financial_only or task_key in ('financeiro_saldo','eventos_briefing','gerencia_go_no_go') then null else completed_at end,
        completed_by = case when not financial_only or task_key in ('financeiro_saldo','eventos_briefing','gerencia_go_no_go') then null else completed_by end,
        updated_at = now()
    where opportunity_id = p.oportunidade_id;
  end if;
end;
$$;


notify pgrst,'reload schema';
