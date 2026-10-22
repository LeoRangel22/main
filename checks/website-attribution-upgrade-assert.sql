do $$
begin
  assert not exists(select 1 from website_attribution_acl_before b join pg_proc p on p.oid=b.oid
    where p.proacl is distinct from b.proacl or p.proowner<>b.proowner or p.prosecdef<>b.prosecdef or p.proconfig is distinct from b.proconfig),
    'Existing ACL, owner, security mode and search_path must be unchanged';
  assert not exists(select 1 from website_attribution_acl_before b left join pg_proc p on p.oid=b.oid where p.oid is null),'No endpoint removed';
  assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    left join website_attribution_acl_before b on b.oid=p.oid where n.nspname in ('public','event_private') and b.oid is null),'No endpoint added';
end $$;
drop table website_attribution_acl_before;
