-- Dormant Zoho Mail pull adapter. No OAuth, schedule, channel activation or historical import.
create table event_private.mailbox_sync_state (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 account_id text check(account_id ~ '^[0-9]{1,40}$'),
 mailbox text check(mailbox='eventos@embaixadacarioca.com.br'),
 activated_at_ms bigint check(activated_at_ms>=1000000000000),
 watermark_ms bigint check(watermark_ms>=activated_at_ms),
 version bigint not null default 0 check(version>=0),
 last_success_at timestamptz,
 check(not enabled or (account_id is not null and mailbox is not null and activated_at_ms is not null and watermark_ms is not null))
);
alter table event_private.mailbox_sync_state enable row level security;
revoke all on event_private.mailbox_sync_state from public,anon,authenticated;
insert into event_private.mailbox_sync_state(singleton) values(true);
create table event_private.mailbox_seen (
 account_id text not null, provider_id text not null check(provider_id ~ '^[0-9]{1,40}$'),
 received_at_ms bigint not null, recorded_at timestamptz not null default now(),
 primary key(account_id,provider_id)
);
alter table event_private.mailbox_seen enable row level security;
revoke all on event_private.mailbox_seen from public,anon,authenticated;
create function public.event_mailbox_worker_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('enabled',s.enabled,'account_id',s.account_id,'mailbox',s.mailbox,'activated_at_ms',s.activated_at_ms,'watermark_ms',s.watermark_ms,'version',s.version,'channel_enabled',c.enabled,'expected_account',c.expected_account,'job_key',c.delivery_job_key)
 from event_private.mailbox_sync_state s cross join event_private.channel_credentials c where s.singleton and c.provider='mailbox';
$$;
revoke all on function public.event_mailbox_worker_config() from public,anon,authenticated;
grant execute on function public.event_mailbox_worker_config() to service_role;
create function public.event_mailbox_seen(provider_ids jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(provider_ids) is distinct from 'array' or jsonb_array_length(provider_ids)>1000 then raise exception 'Lote inválido'; end if;
 return (select coalesce(jsonb_agg(m.provider_id),'[]') from event_private.mailbox_seen m join event_private.mailbox_sync_state s on s.account_id=m.account_id where s.singleton and provider_ids ? m.provider_id);
end; $$;
revoke all on function public.event_mailbox_seen(jsonb) from public,anon,authenticated;
grant execute on function public.event_mailbox_seen(jsonb) to service_role;
create function public.event_mailbox_commit(expected_version bigint,expected_account_id text,expected_watermark_ms bigint,next_watermark_ms bigint,items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s event_private.mailbox_sync_state; c event_private.channel_credentials; item jsonb; event jsonb; events jsonb:='[]'; received bigint;
begin
 -- Same global ingress lock order, then singleton cursor lock; concurrent commits cannot skip data.
 perform pg_advisory_xact_lock(716612);
 select * into s from event_private.mailbox_sync_state where singleton for update;
 select * into c from event_private.channel_credentials where provider='mailbox' for share;
 if s.enabled is distinct from true or c.enabled is distinct from true or s.mailbox is distinct from c.expected_account or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br' then raise exception 'Caixa desabilitada'; end if;
 if s.version is distinct from expected_version or s.account_id is distinct from expected_account_id or s.watermark_ms is distinct from expected_watermark_ms then raise exception using errcode='PT409',message='Cursor mudou'; end if;
 if next_watermark_ms is null or next_watermark_ms<expected_watermark_ms or next_watermark_ms>floor(extract(epoch from now())*1000) then raise exception 'Cursor inválido'; end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>20 then raise exception 'Lote inválido'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'provider_id') is distinct from 'string' or (item->>'provider_id') !~ '^[0-9]{1,40}$' or jsonb_typeof(item->'received_at_ms') is distinct from 'number' then raise exception 'Mensagem inválida'; end if;
  received:=(item->>'received_at_ms')::bigint;
  if received<s.activated_at_ms or received>next_watermark_ms then raise exception 'Horário inválido'; end if;
  event:=item->'event';
  if event is not null and event<>'null'::jsonb then
   if jsonb_typeof(event) is distinct from 'object' or event->>'kind' is distinct from 'inbound' or event->>'channel' is distinct from 'email' or nullif(event->>'key','') is null or event->>'key' is distinct from event->>'message_id' or event ? 'signal' then raise exception 'Evento inválido'; end if;
   if abs(extract(epoch from (event->>'occurred_at')::timestamptz)*1000-received)>1 then raise exception 'Horário divergente'; end if;
   events:=events||jsonb_build_array(event);
  end if;
  insert into event_private.mailbox_seen(account_id,provider_id,received_at_ms) values(s.account_id,item->>'provider_id',received) on conflict do nothing;
 end loop;
 perform public.ingest_event_provider_events('mailbox',events);
 update event_private.mailbox_sync_state set watermark_ms=next_watermark_ms,version=version+1,last_success_at=now() where singleton;
end; $$;
revoke all on function public.event_mailbox_commit(bigint,text,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.event_mailbox_commit(bigint,text,bigint,bigint,jsonb) to service_role;
create function event_private.queue_mailbox_sync() returns void language plpgsql security definer set search_path='' as $$
declare s event_private.mailbox_sync_state; c event_private.channel_credentials;
begin
 select * into s from event_private.mailbox_sync_state where singleton;
 select * into c from event_private.channel_credentials where provider='mailbox';
 if s.enabled is distinct from true or c.enabled is distinct from true or s.mailbox is distinct from c.expected_account then return; end if;
 perform net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync',body:='{"action":"sync"}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),timeout_milliseconds:=120000);
end; $$;
revoke all on function event_private.queue_mailbox_sync() from public,anon,authenticated;
-- Scheduling and activation require an independently approved, live account verification.
