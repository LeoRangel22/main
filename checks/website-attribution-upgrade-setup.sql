-- Snapshot all callable surfaces before this migration. Do not alter any ACL.
create temporary table website_attribution_acl_before as
select p.oid,p.proacl,p.proowner,p.prosecdef,p.proconfig from pg_proc p
join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','event_private');
