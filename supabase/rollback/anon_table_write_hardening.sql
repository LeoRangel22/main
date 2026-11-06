-- Emergency rollback for the reviewed direct-anonymous ACL predecessor.
-- Scope: four existing tables only. SELECT, RLS, owners, sequences and defaults are preserved.
-- Guarded against unreviewed grant options, grantors, missing RLS and ACL drift.
do $anon_table_acl$
declare
  target_name text; target_relation regclass; owner_id oid; rls_enabled boolean;
  anon_id oid; actual_privileges text[]; original_privileges text[];
  unexpected_grant boolean; privilege_name text;
  prior_lock_timeout text := pg_catalog.current_setting('lock_timeout');
begin
  perform pg_catalog.set_config('lock_timeout','2s',true);
  select oid into anon_id from pg_catalog.pg_roles where rolname='anon' and not rolbypassrls;
  if anon_id is null then raise exception 'anon_acl_role_mismatch'; end if;
  -- Validate every target before changing any grant.
  foreach target_name in array array['oportunidades','propostas','solicitacoes_cotacao','proposta_visualizacoes'] loop
    target_relation := pg_catalog.to_regclass(pg_catalog.format('public.%I',target_name));
    if target_relation is null then raise exception 'anon_acl_target_missing'; end if;
    select relowner,relrowsecurity into owner_id,rls_enabled from pg_catalog.pg_class where oid=target_relation and relkind='r';
    if owner_id is null or not coalesce(rls_enabled,false) then raise exception 'anon_acl_rls_mismatch'; end if;
    original_privileges := array['DELETE','INSERT','MAINTAIN','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
    if target_name='solicitacoes_cotacao' then original_privileges:=pg_catalog.array_remove(original_privileges,'INSERT'); end if;
    select coalesce(array_agg(a.privilege_type order by a.privilege_type),array[]::text[]),
      coalesce(bool_or(a.is_grantable or a.grantor<>owner_id),false)
      into actual_privileges,unexpected_grant
      from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid=target_relation and a.grantee=anon_id;
    if unexpected_grant or not (actual_privileges=original_privileges or actual_privileges=array['SELECT']) then
      raise exception 'anon_acl_baseline_mismatch';
    end if;
  end loop;
  foreach target_name in array array['oportunidades','propostas','solicitacoes_cotacao','proposta_visualizacoes'] loop
    target_relation:=pg_catalog.to_regclass(pg_catalog.format('public.%I',target_name));
    if target_name='solicitacoes_cotacao' then
      execute pg_catalog.format('grant UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on table public.%I to anon',target_name);
    else
      execute pg_catalog.format('grant INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on table public.%I to anon',target_name);
    end if;
    if not pg_catalog.has_table_privilege('anon',target_relation,'SELECT') then raise exception 'anon_acl_read_changed'; end if;
  end loop;
  perform pg_catalog.set_config('lock_timeout',prior_lock_timeout,true);
end
$anon_table_acl$;
