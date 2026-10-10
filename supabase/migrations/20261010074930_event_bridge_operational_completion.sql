-- Bind every pull to the reviewed account and commit events/cursor together.
alter table event_private.bot_bridge_state add column last_success_at timestamptz;
create or replace function public.event_bot_bridge_worker_config() returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('job_key',c.delivery_job_key,'channel_enabled',c.enabled,'enabled',s.enabled,'cursor',s.cursor,'expected_account',c.expected_account)
  from event_private.channel_credentials c cross join event_private.bot_bridge_state s where c.provider='zapi' and s.singleton;
$$;

create function public.event_bot_bridge_commit(account_id text,expected_cursor bigint,next_cursor_value bigint,events jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c event_private.channel_credentials; s event_private.bot_bridge_state;
begin
  select * into c from event_private.channel_credentials where provider='zapi' for update;
  select * into s from event_private.bot_bridge_state where singleton for update;
  if not c.enabled or not s.enabled or c.expected_account is distinct from account_id or s.cursor is distinct from expected_cursor then raise exception 'A conta ou o cursor da ponte mudou'; end if;
  if account_id is distinct from 'bot:embaixada_urca' or expected_cursor is null or expected_cursor<0 or next_cursor_value is null or events is null or next_cursor_value<expected_cursor or jsonb_typeof(events)<>'array' or jsonb_array_length(events)>100 then raise exception 'Lote inválido'; end if;
  perform public.ingest_event_provider_events('zapi',events);
  update event_private.bot_bridge_state set cursor=next_cursor_value,last_success_at=now(),updated_at=now(),diagnostic='Ponte consultada; '||jsonb_array_length(events)||' evento(s) recebido(s).' where singleton;
end; $$;
revoke all on function public.event_bot_bridge_commit(text,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.event_bot_bridge_commit(text,bigint,bigint,jsonb) to service_role;

create or replace function public.event_bot_bridge_activate(account_id text,initial_cursor bigint) returns void language plpgsql security definer set search_path='' as $$
begin
  if account_id is distinct from 'bot:embaixada_urca' or initial_cursor is null or initial_cursor<0 then raise exception 'Ponte inválida'; end if;
  perform 1 from event_private.channel_credentials where provider='zapi' for update;
  perform 1 from event_private.bot_bridge_state where singleton for update;
  update event_private.channel_credentials set expected_account=account_id,enabled=true,updated_at=now() where provider='zapi';
  update event_private.bot_bridge_state set cursor=initial_cursor,enabled=true,last_success_at=null,diagnostic='Ponte autenticada; aguardando novos eventos.',updated_at=now() where singleton;
end; $$;

create or replace function public.event_zapi_direct_activate(account_id text) returns void language plpgsql security definer set search_path='' as $$
begin
  if nullif(trim(account_id),'') is null or account_id like 'bot:%' then raise exception 'Instância inválida'; end if;
  perform 1 from event_private.channel_credentials where provider='zapi' for update;
  perform 1 from event_private.bot_bridge_state where singleton for update;
  update event_private.channel_credentials set expected_account=trim(account_id),enabled=true,updated_at=now() where provider='zapi';
  update event_private.bot_bridge_state set enabled=false,diagnostic='Ponte desativada para uso direto de callbacks.',updated_at=now() where singleton;
end; $$;

create or replace function public.get_event_channel_health() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  return (select jsonb_agg(jsonb_build_object('provider',c.provider,'enabled',c.enabled,'account_configured',c.expected_account is not null,'delivery_sync_ready',c.delivery_sync_ready,'delivery_sync_diagnostic',c.delivery_sync_diagnostic,
    'last_received_at',(select max(e.created_at) from public.event_provider_events e where e.provider=c.provider),
    'triage_count',(select count(*) from public.event_provider_events e where e.provider=c.provider and e.state='triage'),
    'pending_count',(select count(*) from public.event_provider_events e where e.provider=c.provider and e.state='pending'),
    'bridge_enabled',case when c.provider='zapi' then s.enabled else false end,
    'bridge_diagnostic',case when c.provider='zapi' and s.enabled then s.diagnostic else null end,
    'bridge_last_success_at',case when c.provider='zapi' and s.enabled then s.last_success_at else null end,
    'bridge_stale',c.provider='zapi' and c.enabled and s.enabled and (s.last_success_at is null or s.last_success_at<now()-interval '3 minutes')) order by c.provider)
    from event_private.channel_credentials c cross join event_private.bot_bridge_state s);
end; $$;

-- Approval is bound to the persisted revision under the same lock used to claim.
create function public.begin_event_send_reviewed(target_proposal uuid,reviewed_revision bigint,send_channel text,send_destination text,send_body text,send_title text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas;
begin
  perform event_private.require_team();
  select * into p from public.propostas where id=target_proposal for update;
  if not found or reviewed_revision is null or p.revision is distinct from reviewed_revision then raise exception 'A proposta mudou. Revise a versão atual antes de enviar'; end if;
  return public.begin_event_send(target_proposal,send_channel,send_destination,send_body,send_title,reviewed_response_at);
end; $$;
revoke all on function public.begin_event_send_reviewed(uuid,bigint,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.begin_event_send_reviewed(uuid,bigint,text,text,text,text,timestamptz) to authenticated;
