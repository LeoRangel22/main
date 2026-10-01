-- Phase 1 follow-up: notify the team when a captured partial lead is completed.
-- The existing notify_new_lead_fn() owns the webhook URL and secret in the
-- database. It sends NEW as an INSERT-shaped payload to notify-new-lead.
-- Reusing it keeps credentials out of this migration and preserves the
-- current notification path for newly inserted requests.
--
-- A lead inserted directly as complete is already covered by
-- notify_new_lead_webhook (AFTER INSERT). Only the partial -> complete
-- transition needs a second notification.

do $$
begin
  if to_regprocedure('public.notify_new_lead_fn()') is null then
    raise exception 'notify_new_lead_fn() is required before enabling completion alerts';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.solicitacoes_cotacao'::regclass
      and tgname = 'notify_completed_quote_webhook'
      and not tgisinternal
  ) then
    create trigger notify_completed_quote_webhook
    after update of capture_status on public.solicitacoes_cotacao
    for each row
    when (old.capture_status = 'partial' and new.capture_status = 'complete')
    execute function public.notify_new_lead_fn();
  end if;
end
$$;
