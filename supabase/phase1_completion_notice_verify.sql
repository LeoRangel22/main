-- Read-only verification for the partial -> complete lead notification.
-- Expected result: one row with enabled = true and the WHEN clause shown in definition.

select
  t.tgname as trigger_name,
  t.tgenabled <> 'D' as enabled,
  pg_get_triggerdef(t.oid, true) as definition,
  p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.solicitacoes_cotacao'::regclass
  and t.tgname = 'notify_completed_quote_webhook'
  and not t.tgisinternal;

do $$
declare
  trigger_definition text;
begin
  select pg_get_triggerdef(t.oid, true)
    into trigger_definition
  from pg_trigger t
  where t.tgrelid = 'public.solicitacoes_cotacao'::regclass
    and t.tgname = 'notify_completed_quote_webhook'
    and not t.tgisinternal
    and t.tgenabled <> 'D';

  if trigger_definition is null then
    raise exception 'notify_completed_quote_webhook is missing or disabled';
  end if;
  if trigger_definition not ilike '%old.capture_status%partial%new.capture_status%complete%' then
    raise exception 'notify_completed_quote_webhook has an unexpected WHEN clause: %', trigger_definition;
  end if;
  if to_regprocedure('public.notify_new_lead_fn()') is null then
    raise exception 'public.notify_new_lead_fn() is missing';
  end if;
end
$$;
