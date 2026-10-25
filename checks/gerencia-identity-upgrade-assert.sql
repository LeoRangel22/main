do $$ declare old gerencia_upgrade_before; f jsonb; current_definition text; begin
 select * into old from gerencia_upgrade_before;
 assert old.proposals is not distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.propostas p);
 assert old.opportunities is not distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.oportunidades p);
 assert old.outbox is not distinct from (select jsonb_agg(to_jsonb(p) order by id) from public.event_outbox p);
 assert old.accounts is not distinct from (select jsonb_agg(to_jsonb(p) order by id) from auth.users p);
 assert old.config=(select to_jsonb(c) from event_private.operation_contact_config c where id);
 for f in select value from jsonb_array_elements(old.functions) loop
  assert f->>'acl' is not distinct from (select proacl::text from pg_proc where oid=(f->>'oid')::oid),'No public ACL changed';
  select pg_get_functiondef(oid) into current_definition from pg_proc where oid=(f->>'oid')::oid;
  assert current_definition is not null,'Preserve public function OID';
  if f->>'name'<>'sign_event_operation' then assert current_definition=f->>'definition','Unrelated public function changed';end if;
 end loop;
 assert jsonb_array_length(old.functions)=(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')),'No new public RPC';
 assert (select user_id is null and expected_email is null and not retired and config_version=0 from event_private.operation_gerencia_identity where singleton);
 assert not exists(select 1 from event_private.operation_gerencia_identity_audit);
end $$;
drop table gerencia_upgrade_before;
