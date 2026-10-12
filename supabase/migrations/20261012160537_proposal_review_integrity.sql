-- Only the revision-checked, row-locked wrapper is a team-facing send API.
-- Keep both legacy overloads for the SECURITY DEFINER wrapper's internal call;
-- revocation does not modify proposals, outbox records or provider configuration.
revoke all on function public.begin_event_send(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.begin_event_send(uuid,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.begin_event_send_reviewed(uuid,bigint,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.begin_event_send_reviewed(uuid,bigint,text,text,text,text,timestamptz) to authenticated;
