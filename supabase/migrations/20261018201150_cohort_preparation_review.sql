-- Preparation belongs to the actual ready/sent transition, never draft creation.
-- Keep the evidence outside propostas: installing this migration must not bump
-- commercial revisions, invalidate approvals, or rewrite a customer's agreement.
create table event_private.proposal_preparation_evidence (
 proposal_id uuid primary key references public.propostas(id) on delete cascade,
 opportunity_id uuid not null references public.oportunidades(id) on delete cascade,
 observed_at timestamptz not null,
 source text not null check(source in ('publication_transition','approval_snapshot','accepted_send')),
 source_id uuid,
 recorded_at timestamptz not null default now(),
 check((source='publication_transition')=(source_id is null))
);
create index proposal_preparation_opportunity_time
 on event_private.proposal_preparation_evidence(opportunity_id,observed_at);
alter table event_private.proposal_preparation_evidence enable row level security;
revoke all on event_private.proposal_preparation_evidence from public,anon,authenticated,service_role;

create function event_private.capture_proposal_preparation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.oportunidade_id is null or coalesce(new.publication_status,'') not in ('ready','sent')
   or new.snapshot ? 'amendmentOf' then return new; end if;
 if tg_op='UPDATE' then
  if new.publication_status is not distinct from old.publication_status then return new; end if;
 end if;
 insert into event_private.proposal_preparation_evidence(proposal_id,opportunity_id,observed_at,source)
 values(new.id,new.oportunidade_id,statement_timestamp(),'publication_transition')
 on conflict(proposal_id) do nothing;
 return new;
end; $$;
revoke all on function event_private.capture_proposal_preparation() from public,anon,authenticated,service_role;
create trigger capture_proposal_preparation after insert or update on public.propostas
 for each row execute function event_private.capture_proposal_preparation();

-- Historical evidence is an upper bound: the proposal was already ready by
-- this observation. An approval snapshot must actually show ready/sent; a send
-- must have both provider acceptance and its server-written outbound message.
-- Neither created_at, updated_at, sent_at alone nor today's status can establish
-- when a historical draft was prepared. Rows without evidence stay unknown.
with observations as (
 select p.id as proposal_id,p.oportunidade_id as opportunity_id,a.created_at as observed_at,
  'approval_snapshot'::text as source,a.id as source_id
 from public.propostas p join public.event_proposal_approvals a on a.proposal_id=p.id
 where p.oportunidade_id is not null and not p.snapshot ? 'amendmentOf'
  and a.proposal_snapshot->>'id'=p.id::text
  and a.proposal_snapshot->>'oportunidade_id'=p.oportunidade_id::text
  and a.proposal_snapshot->>'publication_status' in ('ready','sent')
  and not (coalesce(a.proposal_snapshot->'snapshot','{}'::jsonb) ? 'amendmentOf')
  and a.created_at>=p.created_at and a.created_at<=statement_timestamp()
 union all
 select p.id,p.oportunidade_id,m.occurred_at,'accepted_send',b.id
 from public.propostas p join public.event_outbox b on b.proposal_id=p.id
 join public.event_messages m on m.proposal_id=p.id and m.opportunity_id=p.oportunidade_id
  and m.channel=b.channel and m.external_id='send:'||b.id::text
 where p.oportunidade_id is not null and not p.snapshot ? 'amendmentOf'
  and b.opportunity_id=p.oportunidade_id and b.status='accepted' and nullif(trim(b.provider_id),'') is not null
  and m.source='provider' and m.direction='outbound' and m.delivery_status in ('accepted','delivered','read')
  and m.occurred_at>=greatest(p.created_at,b.created_at) and m.occurred_at<=statement_timestamp()
), first_observation as (
 select distinct on (proposal_id) proposal_id,opportunity_id,observed_at,source,source_id
 from observations order by proposal_id,observed_at,source,source_id
)
insert into event_private.proposal_preparation_evidence(proposal_id,opportunity_id,observed_at,source,source_id)
 select proposal_id,opportunity_id,observed_at,source,source_id from first_observation
 on conflict(proposal_id) do nothing;

create or replace function public.event_sales_cohort(from_date date,to_date date,decision_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_at timestamptz; end_at timestamptz;
begin
 perform event_private.require_team();
 if from_date is null or to_date is null or to_date<from_date or to_date-from_date>366 or decision_days not between 1 and 90 then raise exception 'Use um período de até 366 dias e uma janela de 1 a 90 dias.';end if;
 start_at:=from_date::timestamp at time zone 'America/Sao_Paulo';end_at:=(to_date+1)::timestamp at time zone 'America/Sao_Paulo';
 with cohort as (
  select o.*,o.created_at+make_interval(days=>decision_days) as deadline
  from public.oportunidades o where o.created_at>=start_at and o.created_at<end_at
   and o.metadata->'is_test' is distinct from 'true'::jsonb and o.metadata->'qa' is distinct from 'true'::jsonb
 ), evidence as (
  select o.id,o.deadline<=now() as mature,
   exists(select 1 from event_private.proposal_preparation_evidence e where e.opportunity_id=o.id and e.observed_at>=o.created_at and e.observed_at<=o.deadline) as prepared,
   exists(select 1 from public.event_outbox b where b.opportunity_id=o.id and b.created_at>=o.created_at and b.created_at<=o.deadline and b.status='accepted' and nullif(b.provider_id,'') is not null) as dispatched,
   exists(select 1 from public.event_outbox b where b.opportunity_id=o.id and b.delivery_status in ('delivered','read') and b.delivery_updated_at>=o.created_at and b.delivery_updated_at<=o.deadline) as delivered,
   exists(select 1 from public.event_messages m where m.opportunity_id=o.id and m.direction='inbound' and m.source in ('provider','public') and m.occurred_at>=o.created_at and m.occurred_at<=o.deadline) as replied,
   exists(select 1 from public.propostas p where p.oportunidade_id=o.id and p.is_current and case when event_private.audited_payment(p) then (p.snapshot#>>'{pagamentoSinal,validadoEm}')::timestamptz>=o.created_at and (p.snapshot#>>'{pagamentoSinal,validadoEm}')::timestamptz<=o.deadline else false end) as paid
  from cohort o
 ) select jsonb_build_object('total',count(*),'mature',count(*) filter(where mature),'pending_window',count(*) filter(where not mature),
  'prepared',count(*) filter(where mature and prepared),'dispatched',count(*) filter(where mature and dispatched),
  'delivered',count(*) filter(where mature and delivered),'replied',count(*) filter(where mature and replied),'paid',count(*) filter(where mature and paid),
  'conversion',case when count(*) filter(where mature)>0 then round(100.0*count(*) filter(where mature and paid)/count(*) filter(where mature),2) else null end)
 into result from evidence;
 return result||jsonb_build_object('from',from_date,'to',to_date,'decision_days',decision_days,'generated_at',now(),
  'definition','Coorte pela entrada da oportunidade no sistema; percentuais somente após a janela completa. Preparação pela primeira transição registrada para pronta/enviada ou evidência histórica de solicitação de aprovação/envio; histórico sem evidência não é estimado. Aceito não comprova entrega; comprovante não comprova crédito.');
end; $$;
revoke all on function public.event_sales_cohort(date,date,integer) from public,anon;
grant execute on function public.event_sales_cohort(date,date,integer) to authenticated;
