-- Stop reconciliation first. Preserve all receipt rows and send history.
revoke all on function public.reconcile_event_whatsapp_pilot(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_event_whatsapp_pilot_receipt(uuid) from public,anon,authenticated,service_role;
-- No table drop, send retry, cursor reset, property change or gate activation.
