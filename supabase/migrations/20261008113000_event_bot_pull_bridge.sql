-- The Bot keeps ownership of Z-API callbacks. Events only pulls a normalized,
-- authenticated ledger. This remains dormant until a manager verifies and
-- activates the bridge; no provider callback is changed by this migration.
create table event_private.bot_bridge_state (
  singleton boolean primary key default true check(singleton),
  cursor bigint not null default 0 check(cursor>=0),
  enabled boolean not null default false,
  diagnostic text,
  updated_at timestamptz not null default now()
);
alter table event_private.bot_bridge_state enable row level security;
revoke all on event_private.bot_bridge_state from public,anon,authenticated;
insert into event_private.bot_bridge_state(singleton) values(true);

create function public.event_bot_bridge_worker_config() returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('job_key',c.delivery_job_key,'channel_enabled',c.enabled,'enabled',s.enabled,'cursor',s.cursor)
  from event_private.channel_credentials c cross join event_private.bot_bridge_state s where c.provider='zapi' and s.singleton;
$$;
revoke all on function public.event_bot_bridge_worker_config() from public,anon,authenticated;
grant execute on function public.event_bot_bridge_worker_config() to service_role;

create function public.event_bot_bridge_activate(account_id text,initial_cursor bigint) returns void language plpgsql security definer set search_path='' as $$
begin
  if account_id !~ '^bot:[a-zA-Z0-9_-]+$' or initial_cursor<0 then raise exception 'Ponte inválida'; end if;
  update event_private.channel_credentials set expected_account=account_id,enabled=true,updated_at=now() where provider='zapi';
  update event_private.bot_bridge_state set cursor=initial_cursor,enabled=true,diagnostic='Ponte autenticada; aguardando novos eventos.',updated_at=now() where singleton;
end; $$;
revoke all on function public.event_bot_bridge_activate(text,bigint) from public,anon,authenticated;
grant execute on function public.event_bot_bridge_activate(text,bigint) to service_role;

create function public.event_bot_bridge_deactivate() returns void language sql security definer set search_path='' as $$
  update event_private.bot_bridge_state set enabled=false,diagnostic='Ponte desativada para uso direto de callbacks.',updated_at=now() where singleton;
$$;
revoke all on function public.event_bot_bridge_deactivate() from public,anon,authenticated;
grant execute on function public.event_bot_bridge_deactivate() to service_role;

-- WhatsApp activation must go through a provider/account inspection. The
-- generic manager RPC may still disable Z-API and configure the e-mail
-- providers, but cannot bypass either verified WhatsApp activation path.
create or replace function public.configure_event_channel(target_provider text,account_id text,enable_channel boolean,authentication_key text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  if not public.is_super_admin() then raise exception 'Configuração exclusiva do gestor'; end if;
  if target_provider='zapi' and enable_channel then raise exception 'Use a ativação verificada do WhatsApp'; end if;
  if enable_channel and nullif(trim(account_id),'') is null then raise exception 'Informe a conta/instância de origem'; end if;
  if authentication_key is not null and length(authentication_key)<32 then raise exception 'Chave deve ter pelo menos 32 caracteres'; end if;
  update event_private.channel_credentials set expected_account=nullif(trim(account_id),''),enabled=enable_channel,secret=coalesce(authentication_key,secret),updated_at=now() where provider=target_provider;
  if not found then raise exception 'Canal desconhecido'; end if;
end; $$;

create function public.event_zapi_direct_activate(account_id text) returns void language plpgsql security definer set search_path='' as $$
begin
  if nullif(trim(account_id),'') is null or account_id like 'bot:%' then raise exception 'Instância inválida'; end if;
  update event_private.bot_bridge_state set enabled=false,diagnostic='Ponte desativada para uso direto de callbacks.',updated_at=now() where singleton;
  update event_private.channel_credentials set expected_account=trim(account_id),enabled=true,updated_at=now() where provider='zapi';
end; $$;
revoke all on function public.event_zapi_direct_activate(text) from public,anon,authenticated;
grant execute on function public.event_zapi_direct_activate(text) to service_role;

create function public.event_bot_bridge_result(next_cursor_value bigint,healthy_value boolean,diagnostic_value text) returns void language plpgsql security definer set search_path='' as $$
begin
  update event_private.bot_bridge_state set
    cursor=case when healthy_value and next_cursor_value is not null then greatest(cursor,next_cursor_value) else cursor end,
    diagnostic=left(diagnostic_value,500),updated_at=now()
  where singleton;
end; $$;
revoke all on function public.event_bot_bridge_result(bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.event_bot_bridge_result(bigint,boolean,text) to service_role;

create function event_private.queue_event_bot_bridge() returns void language plpgsql security definer set search_path='' as $$
declare c event_private.channel_credentials; s event_private.bot_bridge_state;
begin
  select * into c from event_private.channel_credentials where provider='zapi';
  select * into s from event_private.bot_bridge_state where singleton;
  if not c.enabled or not s.enabled then return; end if;
  perform net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-bot-bridge',body:='{}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),timeout_milliseconds:=30000);
end; $$;
revoke all on function event_private.queue_event_bot_bridge() from public,anon,authenticated;
select cron.schedule('event-bot-bridge-check','* * * * *','select event_private.queue_event_bot_bridge()');
