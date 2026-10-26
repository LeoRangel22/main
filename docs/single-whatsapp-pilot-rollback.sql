-- REVIEWED ROLLBACK PLAN ONLY: never run without the approved production window.
-- FIRST set EVENT_BOT_PILOT_ENABLED=false and verify the pilot transport stopped.
-- EVENT_BOT_SEND_ENABLED must remain false throughout deployment/test/rollback,
-- so older runtimes never become active. A claimed/in-flight request cannot be unsent.
begin;
select pg_advisory_xact_lock(hashtextextended('events-single-whatsapp-pilot',0));
update event_private.whatsapp_pilots set enabled=false where enabled;
revoke all on function public.get_event_whatsapp_pilot(uuid) from authenticated;
revoke all on function public.claim_event_whatsapp_pilot(uuid) from authenticated;
-- Keep service-only finish permission until any claim is reconciled.
-- Preserve rows, provider IDs and the ledger; no DROP, DELETE or resetting attempts.
commit;
