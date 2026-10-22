begin;
do $$
declare h jsonb; prior_outbox bigint; prior_approvals bigint;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where email='leorangel@gmail.com'),'email','leorangel@gmail.com','role','authenticated')::text,true);
 select count(*) into prior_outbox from public.event_outbox;
 select count(*) into prior_approvals from public.event_proposal_approvals;
 update event_private.approval_watch_config set enabled=true where id;
 update event_private.proposal_approval_policy set enabled=false where id;
 h:=public.get_event_approval_watch_health();
 if (h->>'enabled')::boolean or h->>'paused_reason' is distinct from 'APPROVAL_POLICY_DISABLED' or (h->>'watch_enabled')::boolean is distinct from true then raise exception 'Disabled policy was not reported separately'; end if;
 if not h ? 'pending_expired_count' or not h ? 'last_started_at' then raise exception 'Missing operational evidence'; end if;
 update event_private.approval_watch_config set enabled=false where id;
 h:=public.get_event_approval_watch_health();
 if h->>'paused_reason' is distinct from 'WATCH_DISABLED' then raise exception 'Disabled watchdog was not preserved'; end if;
 update event_private.approval_watch_config set enabled=true where id;
 update event_private.proposal_approval_policy set enabled=true where id;
 h:=public.get_event_approval_watch_health();
 if (h->>'enabled')::boolean is distinct from true or h->>'paused_reason' is not null then raise exception 'Enabled configuration is not effective'; end if;
 if prior_outbox<>(select count(*) from public.event_outbox) or prior_approvals<>(select count(*) from public.event_proposal_approvals) then raise exception 'Health read created business records'; end if;
end $$;
set local role anon;
do $$
begin
 begin
  perform public.get_event_approval_watch_health();
  raise exception 'Anonymous monitor access must fail';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
