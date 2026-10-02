-- Inventario somente leitura para comparar o Supabase atual com:
-- phase1_commercial_ux.sql, seller_fast_response.sql e client_proposal_ux.sql.
-- Execute no SQL Editor antes de qualquer migracao e guarde o resultado.
-- Nao inclui linhas de clientes, tokens ou comprovantes.

begin transaction read only;

select jsonb_pretty(jsonb_build_object(
  'database', current_database(),
  'server_version', current_setting('server_version_num'),
  'migration_registry', to_regclass('supabase_migrations.schema_migrations')::text,
  'tables', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'rls', c.relrowsecurity,
      'estimated_rows', greatest(c.reltuples::bigint, 0)
    ) order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname in ('propostas', 'solicitacoes_cotacao', 'oportunidades',
        'commercial_settings', 'commercial_settings_history')
  ),
  'columns', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'column', a.attname,
      'type', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid)
    ) order by c.relname, a.attnum), '[]'::jsonb)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relname in ('propostas',
      'solicitacoes_cotacao', 'oportunidades', 'commercial_settings',
      'commercial_settings_history')
      and a.attnum > 0 and not a.attisdropped
  ),
  'indexes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', indexname, 'definition', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
    from pg_indexes
    where schemaname = 'public' and tablename in ('propostas',
      'solicitacoes_cotacao', 'oportunidades', 'commercial_settings',
      'commercial_settings_history')
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', k.conname,
      'definition', pg_get_constraintdef(k.oid)
    ) order by c.relname, k.conname), '[]'::jsonb)
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('propostas',
      'solicitacoes_cotacao', 'oportunidades', 'commercial_settings',
      'commercial_settings_history')
  ),
  'table_privileges', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'role', r.rolname,
      'select', has_table_privilege(r.oid, c.oid, 'SELECT'),
      'insert', has_table_privilege(r.oid, c.oid, 'INSERT'),
      'update', has_table_privilege(r.oid, c.oid, 'UPDATE'),
      'delete', has_table_privilege(r.oid, c.oid, 'DELETE')
    ) order by c.relname, r.rolname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join pg_roles r
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname in ('propostas', 'solicitacoes_cotacao', 'oportunidades',
        'commercial_settings', 'commercial_settings_history')
      and r.rolname in ('anon', 'authenticated')
  ),
  'triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', t.tgname,
      'enabled', t.tgenabled, 'definition', pg_get_triggerdef(t.oid)
    ) order by c.relname, t.tgname), '[]'::jsonb)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
      and c.relname in ('propostas', 'solicitacoes_cotacao', 'oportunidades')
  ),
  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
      'returns', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'search_path', p.proconfig,
      'definition_md5', md5(pg_get_functiondef(p.oid)),
      'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'is_team_member', 'is_super_admin', 'set_updated_at',
      'prepare_proposal_version', 'promote_proposal_version',
      'sync_opportunity_from_proposal', 'sync_opportunity_from_request',
      'set_default_next_action', 'get_public_proposal',
      'respond_public_proposal', 'upsert_public_quote_draft',
      'save_commercial_setting', 'submit_public_signal_proof')
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', p.polname, 'command', p.polcmd,
      'roles', (select coalesce(jsonb_agg(r.rolname order by r.rolname), '[]'::jsonb)
                from pg_roles r where r.oid = any(p.polroles)),
      'using', pg_get_expr(p.polqual, p.polrelid),
      'check', pg_get_expr(p.polwithcheck, p.polrelid)
    ) order by c.relname, p.polname), '[]'::jsonb)
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('propostas',
      'solicitacoes_cotacao', 'oportunidades', 'commercial_settings',
      'commercial_settings_history')
  )
)) as commercial_ux_preflight;

commit;
