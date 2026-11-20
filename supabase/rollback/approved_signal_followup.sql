-- Removes only the new projection. Keeps existing plans, owners and all history.
begin;
drop trigger if exists zz_approved_signal_followup on public.propostas;
drop function if exists event_private.plan_approved_signal_followup();
commit;
