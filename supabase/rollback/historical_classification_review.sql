-- Disable the feature; preserve every source and review event.
create or replace function public.event_crm_history(
 p_kind text default 'organization',p_query text default '',p_sort text default 'name',
 p_limit integer default 20,p_offset integer default 0,p_record_id text default null,p_organization_id text default null)
returns jsonb language sql stable security invoker set search_path='' as $f$
 select event_crm_api.read_history(p_kind,p_query,p_sort,p_limit,p_offset,p_record_id,p_organization_id);
$f$;
revoke all on function public.event_crm_classification_status(text,text,text,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function public.event_crm_review_classification(text,text,text,integer,uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function event_crm_review_api.read_classification(text,text,text,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function event_crm_review_api.save_classification(text,text,text,integer,uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function event_crm_review_api.decorate_history(jsonb) from public,anon,authenticated,service_role;
revoke usage on schema event_crm_review_api from authenticated;
