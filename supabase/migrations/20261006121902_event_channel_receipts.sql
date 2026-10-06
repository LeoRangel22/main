-- Independent event-channel ingress. Keys never enter public tables or anonymous RPCs.
create table event_private.channel_credentials (
  provider text primary key check(provider in ('zapi','zepto','mailbox')),
  secret text not null default encode(extensions.gen_random_bytes(32),'hex'),
  expected_account text,
  enabled boolean not null default false,
  delivery_job_key text not null default encode(extensions.gen_random_bytes(32),'hex'),
  delivery_sync_ready boolean not null default false,
  delivery_sync_diagnostic text,
  updated_at timestamptz not null default now()
);
alter table event_private.channel_credentials enable row level security;
revoke all on event_private.channel_credentials from public,anon,authenticated;
insert into event_private.channel_credentials(provider) values('zapi'),('zepto'),('mailbox');

alter table public.event_outbox add column delivery_status text check(delivery_status in ('accepted','delivered','read','failed','uncertain'));
alter table public.event_outbox add column delivery_updated_at timestamptz;
alter table public.event_outbox add column delivery_checked_at timestamptz;
alter table public.event_outbox add column provider_reference text;
alter table public.event_outbox add column engagement text check(engagement in ('opened','clicked','softbounce','complaint'));
create index event_outbox_provider_lookup on public.event_outbox(channel,provider_id) where provider_id is not null;

create table public.event_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check(provider in ('zapi','zepto','mailbox')),
  event_key text not null check(length(event_key) between 1 and 500),
  channel text not null check(channel in ('whatsapp','email')),
  kind text not null check(kind in ('inbound','status')),
  provider_message_id text,
  provider_reference text,
  reply_to_id text,
  send_id uuid,
  send_attempt integer,
  destination text not null check(length(destination) between 1 and 320),
  body text not null default '' check(length(body)<=6000),
  signal text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  state text not null default 'pending' check(state in ('pending','triage','applied','ignored')),
  opportunity_id uuid references public.oportunidades(id) on delete set null,
  message_id uuid references public.event_messages(id) on delete set null,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  unique(provider,event_key)
);
create index event_provider_pending on public.event_provider_events(state,created_at);
create index event_provider_opportunity on public.event_provider_events(opportunity_id) where opportunity_id is not null;
create index event_provider_message on public.event_provider_events(message_id) where message_id is not null;
create index event_provider_actor on public.event_provider_events(resolved_by) where resolved_by is not null;
alter table public.event_provider_events enable row level security;
revoke all on public.event_provider_events from public,anon,authenticated;
grant select on public.event_provider_events to authenticated;
create policy event_provider_team_read on public.event_provider_events for select to authenticated using((select public.is_team_member()));

create function public.event_channel_worker_config(target_provider text) returns jsonb language sql security definer set search_path='' as $$
  select to_jsonb(c) from event_private.channel_credentials c where provider=target_provider;
$$;
revoke all on function public.event_channel_worker_config(text) from public,anon,authenticated;
grant execute on function public.event_channel_worker_config(text) to service_role;

create function public.get_event_channel_setup() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  if not public.is_super_admin() then raise exception 'Configuração exclusiva do gestor'; end if;
  return (select jsonb_agg(jsonb_build_object('provider',provider,'secret',secret,'expected_account',expected_account,'enabled',enabled) order by provider) from event_private.channel_credentials c);
end; $$;
revoke all on function public.get_event_channel_setup() from public,anon;
grant execute on function public.get_event_channel_setup() to authenticated;

create function public.configure_event_channel(target_provider text,account_id text,enable_channel boolean,authentication_key text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  if not public.is_super_admin() then raise exception 'Configuração exclusiva do gestor'; end if;
  if enable_channel and nullif(trim(account_id),'') is null then raise exception 'Informe a conta/instância de origem'; end if;
  if authentication_key is not null and length(authentication_key)<32 then raise exception 'Chave deve ter pelo menos 32 caracteres'; end if;
  update event_private.channel_credentials set expected_account=nullif(trim(account_id),''),enabled=enable_channel,secret=coalesce(authentication_key,secret),updated_at=now() where provider=target_provider;
  if not found then raise exception 'Canal desconhecido'; end if;
end; $$;
revoke all on function public.configure_event_channel(text,text,boolean,text) from public,anon;
grant execute on function public.configure_event_channel(text,text,boolean,text) to authenticated;

create function public.get_event_channel_health() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  return (select jsonb_agg(jsonb_build_object('provider',c.provider,'enabled',c.enabled,'account_configured',c.expected_account is not null,'delivery_sync_ready',c.delivery_sync_ready,'delivery_sync_diagnostic',c.delivery_sync_diagnostic,'last_received_at',(select max(e.created_at) from public.event_provider_events e where e.provider=c.provider),'triage_count',(select count(*) from public.event_provider_events e where e.provider=c.provider and e.state='triage'),'pending_count',(select count(*) from public.event_provider_events e where e.provider=c.provider and e.state='pending')) order by provider) from event_private.channel_credentials c);
end; $$;
revoke all on function public.get_event_channel_health() from public,anon;
grant execute on function public.get_event_channel_health() to authenticated;

create function event_private.apply_provider_event(target_event uuid,manual_opportunity uuid default null) returns void language plpgsql set search_path='' as $$
declare e public.event_provider_events; b public.event_outbox; o uuid; matches integer; m uuid; next_delivery text;
begin
  select * into e from public.event_provider_events where id=target_event for update;
  if e.id is null or e.state in ('applied','ignored') then return; end if;
  if e.kind='status' then
    select count(*),(array_agg(id))[1] into matches,m from public.event_outbox
      where channel=e.channel and destination=e.destination and ((e.send_id is not null and id=e.send_id and (e.send_attempt is null or attempts=e.send_attempt)) or (e.send_id is null and provider_id=e.provider_message_id));
    if matches<>1 then return; end if;
    select * into b from public.event_outbox where id=m;
    -- Same lock order as send finalization. The Edge worker reconciles AFTER its commit.
    perform 1 from public.propostas where id=b.proposal_id for update;
    perform 1 from public.oportunidades where id=b.opportunity_id for update;
    select * into b from public.event_outbox where id=m for update;
    if b.status='sending' then return; end if;
    if e.send_attempt is not null and e.send_attempt<>b.attempts then
      update public.event_provider_events set state='ignored',resolved_at=now() where id=e.id; return;
    end if;
    if e.provider_reference is not null then update public.event_outbox set provider_reference=e.provider_reference where id=b.id; end if;
    next_delivery:=case when e.signal in ('accepted','delivered','read','failed') then e.signal else null end;
    if next_delivery is not null then
      -- Never regress read/delivered from an older, repeated or reordered receipt.
      if b.delivery_status='read' or (b.delivery_status='delivered' and next_delivery in ('accepted','failed')) or (b.delivery_status='failed' and next_delivery='accepted') then next_delivery:=b.delivery_status; end if;
      update public.event_outbox set delivery_status=next_delivery,delivery_updated_at=greatest(delivery_updated_at,e.occurred_at),updated_at=now() where id=b.id;
      update public.event_messages set delivery_status=next_delivery where channel=b.channel and external_id='send:'||b.id::text;
    else
      update public.event_outbox set engagement=case when engagement='clicked' and e.signal='opened' then engagement else e.signal end,updated_at=now() where id=b.id;
    end if;
    update public.event_provider_events set state='applied',opportunity_id=b.opportunity_id,resolved_at=now() where id=e.id;
    return;
  end if;
  o:=manual_opportunity;
  if o is null and e.reply_to_id is not null then
    select count(distinct opportunity_id),(array_agg(opportunity_id))[1] into matches,o from public.event_outbox where channel=e.channel and destination=e.destination and (provider_id=e.reply_to_id or provider_reference=e.reply_to_id) and opportunity_id is not null;
    if matches<>1 then o:=null; end if;
  end if;
  if o is null then
    select count(*),(array_agg(id))[1] into matches,o from public.oportunidades
      where status not in ('perdido','cancelado','pos_venda') and (data_evento is null or data_evento>=(now() at time zone 'America/Sao_Paulo')::date)
      and case when e.channel='email' then lower(trim(cliente_email))=e.destination else regexp_replace(cliente_whatsapp,'[^0-9]','','g')=e.destination or (length(regexp_replace(cliente_whatsapp,'[^0-9]','','g'))=11 and '55'||regexp_replace(cliente_whatsapp,'[^0-9]','','g')=e.destination) end;
    if matches<>1 then o:=null; end if;
  end if;
  -- Only one active event with an exact contact can be linked automatically.
  if o is null then update public.event_provider_events set state='triage' where id=e.id; return; end if;
  perform 1 from public.oportunidades where id=o for update;
  if not found then raise exception 'Evento não encontrado'; end if;
  insert into public.event_messages(opportunity_id,channel,direction,source,body,occurred_at,external_id)
    values(o,e.channel,'inbound','provider',e.body,e.occurred_at,e.provider||':'||e.event_key)
    on conflict(channel,external_id) where external_id is not null do nothing returning id into m;
  if m is null then select id into m from public.event_messages where channel=e.channel and external_id=e.provider||':'||e.event_key; end if;
  update public.event_provider_events set state='applied',opportunity_id=o,message_id=m,resolved_at=now() where id=e.id;
  update public.oportunidades set ultima_resposta_cliente_em=greatest(ultima_resposta_cliente_em,e.occurred_at),proxima_acao=case when status not in ('perdido','cancelado','pos_venda') and (data_evento is null or data_evento>=(now() at time zone 'America/Sao_Paulo')::date) then 'Responder mensagem do cliente' else proxima_acao end,proxima_acao_em=case when status not in ('perdido','cancelado','pos_venda') and (data_evento is null or data_evento>=(now() at time zone 'America/Sao_Paulo')::date) then now() else proxima_acao_em end
    where id=o and (ultimo_contato_em is null or e.occurred_at>ultimo_contato_em);
end; $$;
revoke all on function event_private.apply_provider_event(uuid,uuid) from public,anon,authenticated;

create function public.ingest_event_provider_events(target_provider text,events jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb; e uuid; ids jsonb:='[]';
begin
  if jsonb_typeof(events)<>'array' or jsonb_array_length(events)>100 then raise exception 'Lote inválido'; end if;
  perform pg_advisory_xact_lock(716612);
  for v in select value from jsonb_array_elements(events) loop
    if (target_provider='zapi' and v->>'channel'<>'whatsapp') or (target_provider in ('zepto','mailbox') and v->>'channel'<>'email') then raise exception 'Canal incompatível'; end if;
    if v->>'kind'='inbound' and (nullif(v->>'body','') is null or nullif(v->>'message_id','') is null) then raise exception 'Mensagem inválida'; end if;
    if v->>'kind'='status' and coalesce(v->>'signal','') not in ('accepted','delivered','read','failed','opened','clicked','softbounce','complaint') then raise exception 'Status inválido'; end if;
    if (v->>'occurred_at')::timestamptz>now()+interval '5 minutes' then raise exception 'Horário inválido'; end if;
    insert into public.event_provider_events(provider,event_key,channel,kind,provider_message_id,provider_reference,reply_to_id,send_id,send_attempt,destination,body,signal,occurred_at)
      values(target_provider,v->>'key',v->>'channel',v->>'kind',nullif(v->>'message_id',''),nullif(v->>'provider_reference',''),nullif(v->>'reply_to_id',''),nullif(v->>'send_id','')::uuid,nullif(v->>'send_attempt','')::integer,v->>'destination',coalesce(v->>'body',''),v->>'signal',(v->>'occurred_at')::timestamptz)
      on conflict(provider,event_key) do nothing returning id into e;
    if e is null then select id into e from public.event_provider_events where provider=target_provider and event_key=v->>'key'; end if;
    perform event_private.apply_provider_event(e);
    ids:=ids||jsonb_build_array(e);
  end loop;
  return ids;
end; $$;
revoke all on function public.ingest_event_provider_events(text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_event_provider_events(text,jsonb) to service_role;

create function public.reconcile_event_receipts(target_send uuid) returns void language plpgsql security definer set search_path='' as $$
declare e uuid; b public.event_outbox;
begin
  perform pg_advisory_xact_lock(716612);
  select * into b from public.event_outbox where id=target_send;
  for e in select id from public.event_provider_events where state='pending' and kind='status' and channel=b.channel and destination=b.destination and (send_id=b.id or provider_message_id=b.provider_id) order by occurred_at,created_at loop
    perform event_private.apply_provider_event(e);
  end loop;
end; $$;
revoke all on function public.reconcile_event_receipts(uuid) from public,anon,authenticated;
grant execute on function public.reconcile_event_receipts(uuid) to service_role;

create function public.resolve_event_inbound(target_event uuid,target_opportunity uuid default null,ignore_message boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare e public.event_provider_events;
begin
  perform event_private.require_team();
  perform pg_advisory_xact_lock(716612);
  select * into e from public.event_provider_events where id=target_event for update;
  if e.kind<>'inbound' or e.state<>'triage' or e.id is null then raise exception 'Mensagem já tratada ou indisponível'; end if;
  if ignore_message then update public.event_provider_events set state='ignored',resolved_by=auth.uid(),resolved_at=now() where id=e.id;
  else
    if target_opportunity is null then raise exception 'Escolha o evento correto'; end if;
    perform event_private.apply_provider_event(e.id,target_opportunity);
    update public.event_provider_events set resolved_by=auth.uid() where id=e.id;
  end if;
end; $$;
revoke all on function public.resolve_event_inbound(uuid,uuid,boolean) from public,anon;
grant execute on function public.resolve_event_inbound(uuid,uuid,boolean) to authenticated;

-- Scheduler exists independently of the operator's browser. It remains dormant
-- until the manager's OAuth-backed query succeeds and the Zepto agent is enabled.
create extension if not exists pg_cron with schema pg_catalog;
create function public.event_delivery_sync_result(ready boolean,diagnostic text) returns void language sql security definer set search_path='' as $$
  update event_private.channel_credentials set delivery_sync_ready=ready,delivery_sync_diagnostic=left(diagnostic,500) where provider='zepto';
$$;
revoke all on function public.event_delivery_sync_result(boolean,text) from public,anon,authenticated;
grant execute on function public.event_delivery_sync_result(boolean,text) to service_role;
create function event_private.queue_email_delivery_check() returns void language plpgsql security definer set search_path='' as $$
declare c event_private.channel_credentials;
begin
  select * into c from event_private.channel_credentials where provider='zepto';
  if not c.enabled or not c.delivery_sync_ready then return; end if;
  if not exists(select 1 from public.event_outbox where channel='email' and status='accepted' and provider_id is not null and coalesce(delivery_status,'accepted') in ('accepted','uncertain') and created_at>now()-interval '60 days') then return; end if;
  perform net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-email-delivery',body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),timeout_milliseconds:=120000);
end; $$;
revoke all on function event_private.queue_email_delivery_check() from public,anon,authenticated;
select cron.schedule('event-email-delivery-check','*/5 * * * *','select event_private.queue_email_delivery_check()');

-- Ordem de bloqueios consistente e preservação do prazo do sinal.
create or replace function public.finish_event_send(send_id uuid,send_status text,external_message_id text default null,error_detail text default null) returns void language plpgsql security definer set search_path='' as $$
declare b public.event_outbox;
begin
  if send_status not in ('accepted','failed','uncertain') then raise exception 'Estado de envio inválido'; end if;
  select * into b from public.event_outbox where id=send_id;
  if b.id is null then return; end if;
  perform 1 from public.propostas where id=b.proposal_id for update;
  perform 1 from public.oportunidades where id=b.opportunity_id for update;
  update public.event_outbox set status=send_status,provider_id=external_message_id,detail=left(error_detail,1000),updated_at=now() where id=send_id and status='sending' returning * into b;
  if b.id is null then return; end if;
  if b.opportunity_id is not null then
    insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by,delivery_status,external_id)
      values(b.opportunity_id,b.proposal_id,b.channel,'outbound','provider',left(b.body,6000),b.approved_by,send_status,'send:'||b.id::text) on conflict(channel,external_id) where external_id is not null do nothing;
    update public.event_messages set body=left(b.body,6000),delivery_status=send_status,occurred_at=now() where channel=b.channel and external_id='send:'||b.id::text;
    if send_status='accepted' then
      update public.propostas set snapshot=case when nullif(snapshot#>>'{event,signalDeadlineAt}','') is null then jsonb_set(coalesce(snapshot,'{}'),'{event}',coalesce(snapshot->'event','{}')||jsonb_build_object('signalDeadlineAt',now()+make_interval(hours=>coalesce((snapshot#>>'{event,signalDeadlineHours}')::integer,48)))) else snapshot end,publication_status='sent',sent_at=coalesce(sent_at,now()),status=case when status='proposta_pronta' then 'proposta_enviada' else status end where id=b.proposal_id;
      update public.oportunidades set ultimo_contato_em=now(),metadata=coalesce(metadata,'{}')||case when metadata->>'first_reply_sent_at' is null then jsonb_build_object('first_reply_sent_at',now(),'first_reply_channel',b.channel,'first_reply_source','provider_accepted') else '{}'::jsonb end where id=b.opportunity_id;
    end if;
  end if;
end; $$;
