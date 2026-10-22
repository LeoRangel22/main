CREATE OR REPLACE FUNCTION public.get_event_approval_watch_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare watch_enabled boolean; policy_enabled boolean;
begin
 perform event_private.require_team();
 select c.enabled into watch_enabled from event_private.approval_watch_config c where c.id;
 select p.enabled into policy_enabled from event_private.proposal_approval_policy p where p.id;
 return jsonb_build_object('enabled',coalesce(watch_enabled,false) and coalesce(policy_enabled,false),
 'watch_enabled',coalesce(watch_enabled,false),
 'policy_enabled',coalesce(policy_enabled,false),
 'paused_reason',case when not coalesce(watch_enabled,false) then 'WATCH_DISABLED' when not coalesce(policy_enabled,false) then 'APPROVAL_POLICY_DISABLED' else null end,
 'last_started_at',(select last_started_at from event_private.approval_watch_config where id),
 'pending_expired_count',(select count(*) from public.event_proposal_approvals where status='pending' and expires_at<=now()),
 'last_success_at',(select last_success_at from event_private.approval_watch_config where id),
 'unresolved_count',(select count(*) from public.event_approval_watch_alerts where status in ('sending','uncertain','failed')),
 'alerts',coalesce((select jsonb_agg(to_jsonb(w)) from (
  select id,approval_id,kind,channel,status,created_at,updated_at,detail from public.event_approval_watch_alerts
  where kind<>'probe' order by created_at desc limit 30) w),'[]'::jsonb));
end; $function$
