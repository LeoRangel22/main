-- Read-only entity-based cohorts. One opportunity is counted once, including losses.
create function public.event_sales_cohort(from_date date,to_date date,decision_days integer default 30) returns jsonb
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
   exists(select 1 from public.propostas p where p.oportunidade_id=o.id and p.created_at>=o.created_at and p.created_at<=o.deadline and p.publication_status in ('ready','sent') and not p.snapshot ? 'amendmentOf') as prepared,
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
  'definition','Coorte pela entrada da oportunidade no sistema; percentuais somente após a janela completa. Aceito não comprova entrega; comprovante não comprova crédito.');
end; $$;
revoke all on function public.event_sales_cohort(date,date,integer) from public,anon;
grant execute on function public.event_sales_cohort(date,date,integer) to authenticated;
