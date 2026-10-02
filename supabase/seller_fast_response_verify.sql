-- Consultas somente leitura após executar seller_fast_response.sql.
select c.relname as tabela, c.relrowsecurity as rls_ativo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('oportunidades', 'propostas', 'commercial_settings', 'commercial_settings_history')
order by c.relname;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'propostas' and column_name in ('status', 'publication_status', 'sent_at', 'snapshot'))
    or (table_name = 'oportunidades' and column_name in ('proxima_acao', 'proxima_acao_em', 'metadata'))
    or table_name in ('commercial_settings', 'commercial_settings_history')
  )
order by table_name, ordinal_position;

select t.tgname as trigger, c.relname as tabela,
       p.proname as funcao
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname in ('oportunidades_default_next_action', 'propostas_promote_version', 'propostas_sync_opportunity')
order by t.tgname;

select proname, pg_get_function_arguments(oid) as argumentos
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('set_default_next_action', 'promote_proposal_version', 'save_commercial_setting')
order by proname;

select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename in ('commercial_settings', 'commercial_settings_history')
order by tablename, indexname;

select config_key, version, updated_at, jsonb_array_length(value) as registros
from public.commercial_settings
order by config_key;
