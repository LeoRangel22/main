-- Local reviewed candidate only. Execute atomically in an explicit transaction.
-- Reversal is supported only while the new mandatory policy is still OFF.
-- An activated policy requires a separate decision; this never disables it.
do $$ begin
 if (select enabled from event_private.operation_contact_config where id) is distinct from false then
  raise exception 'Reversão de compatibilidade exige controle de de acordos ainda desligado; preserve a política ativa e solicite decisão específica.';
 end if;
end $$;

-- Keep the wrapper's OID and ACL, and the original implementation's identity.
-- Private historical tables, signatures, contact versions and triggers remain.
create or replace function event_private.operation_readiness(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return event_private.operation_readiness_before_signoffs(p);
end; $$;

-- Withdraw the new public contract, never grant legacy access or drop history.
revoke all on function public.get_event_operational_contacts() from public,anon,authenticated,service_role;
revoke all on function public.configure_event_operational_contacts(integer,jsonb,boolean) from public,anon,authenticated,service_role;
revoke all on function public.sign_event_operation(uuid,bigint,integer,text,text,boolean) from public,anon,authenticated,service_role;
