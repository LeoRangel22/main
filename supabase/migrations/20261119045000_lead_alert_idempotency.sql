-- Installs dormant. No backfill, webhook/credential replacement, HTTP, cron or
-- business-state update. Enable only with a reviewed rollout start timestamp.
begin;
create table event_private.lead_alert_policy (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 started_at timestamptz,
 abandoned_after interval not null default interval '30 minutes' check(abandoned_after>=interval '15 minutes'),
 check(not enabled or started_at is not null)
);
insert into event_private.lead_alert_policy(id) values(true);
create table event_private.lead_alert_receipts (
 lead_id uuid not null,
 kind text not null check(kind in ('complete','abandoned')),
 claim_id uuid not null unique default gen_random_uuid(),
 state text not null default 'claimed' check(state in ('claimed','accepted','failed','uncertain')),
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 provider_id text check(provider_id is null or length(provider_id) between 1 and 500),
 primary key(lead_id,kind)
);
alter table event_private.lead_alert_policy enable row level security;
alter table event_private.lead_alert_receipts enable row level security;
revoke all on event_private.lead_alert_policy,event_private.lead_alert_receipts from public,anon,authenticated,service_role;

create function public.event_claim_lead_alert(target_lead uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.solicitacoes_cotacao; policy event_private.lead_alert_policy; kind text; claim uuid;
begin
 select * into policy from event_private.lead_alert_policy where id;
 if not coalesce(policy.enabled,false) then return jsonb_build_object('claimed',false,'code','paused'); end if;
 -- Same lead lock as completion: a committed completion always wins over a
 -- stale webhook or abandoned scan. Retry cannot reclaim an accepted/unknown POST.
 select * into r from public.solicitacoes_cotacao where id=target_lead for update;
 if not found then return jsonb_build_object('claimed',false,'code','out_of_scope'); end if;
 if r.capture_status='complete' then
  if coalesce(r.capture_completed_at,r.created_at)<policy.started_at then return jsonb_build_object('claimed',false,'code','out_of_scope'); end if;
  kind:='complete';
 elsif r.capture_status='partial' and r.created_at>=policy.started_at and r.updated_at<=now()-policy.abandoned_after then kind:='abandoned';
 else return jsonb_build_object('claimed',false,'code','not_due'); end if;
 insert into event_private.lead_alert_receipts(lead_id,kind) values(r.id,kind)
 on conflict do nothing returning claim_id into claim;
 if claim is null then return jsonb_build_object('claimed',false,'code','already_claimed'); end if;
 return jsonb_build_object('claimed',true,'claimId',claim,'kind',kind,'record',to_jsonb(r)-'capture_token');
end $$;

create function public.event_due_lead_alerts()
returns setof uuid language sql security definer set search_path='' as $$
 select r.id from public.solicitacoes_cotacao r cross join event_private.lead_alert_policy p
 where p.id and p.enabled
 and (r.capture_status='complete' and coalesce(r.capture_completed_at,r.created_at)>=p.started_at
 or r.capture_status='partial' and r.created_at>=p.started_at and r.updated_at<=now()-p.abandoned_after)
 and not exists(select 1 from event_private.lead_alert_receipts a where a.lead_id=r.id and a.kind=case when r.capture_status='complete' then 'complete' else 'abandoned' end)
 order by r.created_at,r.id limit 10
$$;

create function public.event_finish_lead_alert(target_claim uuid,outcome text,reference_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed uuid;
begin
 if outcome not in ('accepted','failed','uncertain') or reference_id is not null and (length(reference_id) not between 1 and 500 or reference_id~'[[:cntrl:]]') then raise exception 'Invalid alert outcome'; end if;
 update event_private.lead_alert_receipts set state=outcome,finished_at=now(),provider_id=reference_id
 where claim_id=target_claim and state='claimed' returning claim_id into changed;
 return changed is not null;
end $$;
revoke all on function public.event_claim_lead_alert(uuid),public.event_due_lead_alerts(),public.event_finish_lead_alert(uuid,text,text) from public,anon,authenticated;
grant execute on function public.event_claim_lead_alert(uuid),public.event_due_lead_alerts(),public.event_finish_lead_alert(uuid,text,text) to service_role;

-- Scheduler entry is prepared, never scheduled by this migration. It reuses
-- the existing Vault names used by the fresh-install notification adapter.
-- Missing references fail closed; no credential is inferred/copied/provisioned.
create function event_private.dispatch_due_lead_alerts()
returns text language plpgsql security definer set search_path='' as $$
declare endpoint text; hook text; policy event_private.lead_alert_policy;
begin
 select * into policy from event_private.lead_alert_policy where id;
 if not coalesce(policy.enabled,false) then return 'paused'; end if;
 if to_regclass('vault.decrypted_secrets') is null then return 'setup_pending'; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into endpoint using 'event_lead_webhook_url';
 execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1' into hook using 'event_lead_webhook_secret';
 if endpoint is null or hook is null then return 'setup_pending'; end if;
 if endpoint!~'^https://[a-z0-9]{20}\.supabase\.co/functions/v1/notify-new-lead$' or length(hook) not between 16 and 8192 then return 'setup_pending'; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',hook),body:='{"action":"scan-abandoned"}'::jsonb);
 return 'queued';
end $$;
revoke all on function event_private.dispatch_due_lead_alerts() from public,anon,authenticated,service_role;
commit;
