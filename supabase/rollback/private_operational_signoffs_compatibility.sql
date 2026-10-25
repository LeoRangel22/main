-- One atomic statement, also when executed without an outer transaction.
-- ACCESS EXCLUSIVE is acquired before any row lock: a configuration RPC takes
-- RowShare before SELECT FOR UPDATE and RowExclusive on UPDATE. We must not
-- hold a row lock and then wait for either of those table locks.
do $rollback$
declare policy_enabled boolean;
begin
 lock table event_private.operation_contact_config in access exclusive mode;
 select enabled into policy_enabled from event_private.operation_contact_config where id for update;
 if policy_enabled is distinct from false then
  raise exception 'Reversão de compatibilidade exige controle de de acordos ainda desligado; preserve a política ativa e solicite decisão específica.';
 end if;

 -- Revoking EXECUTE cannot cancel a function already in flight. This durable
 -- BEFORE barrier also rejects an activation that began before revocation and
 -- waited for our table lock. Reinstatement requires a separate reviewed change.
 execute $ddl$
 create or replace function event_private.operation_signoffs_retired_guard() returns trigger
 language plpgsql security definer set search_path='' as $guard$
 begin
  if new.enabled is distinct from false then
   raise exception using errcode='55000',message='Controle de de acordos retirado por reversão; reativação exige reinstalação revisada.';
  end if;
  return new;
 end; $guard$;
 $ddl$;
 revoke all on function event_private.operation_signoffs_retired_guard() from public,anon,authenticated,service_role;
 drop trigger if exists operation_signoffs_retired_guard on event_private.operation_contact_config;
 create trigger operation_signoffs_retired_guard before insert or update on event_private.operation_contact_config
  for each row execute function event_private.operation_signoffs_retired_guard();

-- Keep the wrapper's OID and ACL, and the original implementation's identity.
-- Private historical tables, signatures, contact versions and triggers remain.
 execute $ddl$
 create or replace function event_private.operation_readiness(p public.propostas) returns jsonb
 language plpgsql stable security definer set search_path='' as $legacy$
 begin
  return event_private.operation_readiness_before_signoffs(p);
 end; $legacy$;
 $ddl$;

-- Withdraw the new public contract, never grant legacy access or drop history.
revoke all on function public.get_event_operational_contacts() from public,anon,authenticated,service_role;
revoke all on function public.configure_event_operational_contacts(integer,jsonb,boolean) from public,anon,authenticated,service_role;
revoke all on function public.sign_event_operation(uuid,bigint,integer,text,text,boolean) from public,anon,authenticated,service_role;
end; $rollback$;
