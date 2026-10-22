-- Quarantine only an authenticated, exactly correlated send whose commercial
-- context is no longer current. No grants, activation, replay or provider calls.
create table event_private.bot_bridge_quarantine (
 scope_id uuid not null,
 event_key_hash text not null check(event_key_hash ~ '^[0-9a-f]{64}$'),
 content_fingerprint text not null check(content_fingerprint ~ '^[0-9a-f]{64}$'),
 send_id uuid not null,
 proposal_id uuid not null,
 reviewed_revision bigint not null,
 kind text not null check(kind in ('inbound','status')),
 reason text not null check(reason in ('proposal_changed','proposal_superseded','proposal_closed')),
 page_cursor bigint not null check(page_cursor>=0),
 recorded_at timestamptz not null default now(),
 -- Like event_provider_events(provider,event_key), this fixed-tenant identity
 -- survives grant rotation. A new scope must not replay old quarantined events.
 primary key(event_key_hash)
);
alter table event_private.bot_bridge_quarantine enable row level security;
revoke all on event_private.bot_bridge_quarantine from public,anon,authenticated,service_role;
create index bot_bridge_quarantine_recorded on event_private.bot_bridge_quarantine(recorded_at);

-- Preserve the existing worker signature/ACL and advisory-before-row lock order.
create or replace function public.event_bot_bridge_commit(account_id text,expected_cursor bigint,next_cursor_value bigint,events jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c event_private.channel_credentials; s event_private.bot_bridge_state; payload jsonb; accepted jsonb:='[]';
 v jsonb; b public.event_outbox; p public.propostas; reference_id text; matches integer;
 q event_private.bot_bridge_quarantine; e public.event_provider_events; key_hash text; content_hash text; page_hash text; seen jsonb:='{}'; obsolete_reason text; quarantined integer:=0;
begin
 perform pg_advisory_xact_lock(716612);
 select * into c from event_private.channel_credentials where provider='zapi' for update;
 select * into s from event_private.bot_bridge_state where singleton for update;
 if not c.enabled or not s.enabled or c.expected_account is distinct from account_id or s.cursor is distinct from expected_cursor then raise exception 'A conta ou o cursor da ponte mudou'; end if;
 if jsonb_typeof(events) is distinct from 'object' or s.scope_id is null or (events->>'scope')::uuid is distinct from s.scope_id then raise exception 'O escopo do lote da ponte mudou'; end if;
 payload:=events->'events';
 if account_id is distinct from 'bot:embaixada_urca' or expected_cursor is null or expected_cursor<0 or next_cursor_value is null or next_cursor_value<expected_cursor or jsonb_typeof(payload) is distinct from 'array' then raise exception 'Lote inválido'; end if;
 if jsonb_array_length(payload)>100 then raise exception 'Lote inválido'; end if;
 for v in select value from jsonb_array_elements(payload) loop
  -- Quarantine is not a route around the normal ingress validation.
  if jsonb_typeof(v) is distinct from 'object' or v->>'channel' is distinct from 'whatsapp' or v->>'purpose' is distinct from 'event_proposal'
    or (v-array['key','channel','purpose','kind','send_id','context_id','revision','destination','body','message_id','reply_to_id','occurred_at','captured_at','signal'])<>'{}'::jsonb
    or coalesce(v->>'kind','') not in ('inbound','status') or nullif(v->>'send_id','') is null or nullif(v->>'context_id','') is null
    or nullif(v->>'revision','') is null or length(coalesce(v->>'key','')) not between 1 and 500
    or length(coalesce(v->>'destination','')) not between 1 and 320 or length(coalesce(v->>'body',''))>6000
    or nullif(v->>'message_id','') is null or length(v->>'message_id')>500
    or nullif(v->>'occurred_at','') is null or not isfinite((v->>'occurred_at')::timestamptz)
    or (v->>'occurred_at')::timestamptz>now()+interval '5 minutes'
    or nullif(v->>'captured_at','') is null or not isfinite((v->>'captured_at')::timestamptz)
    or (v->>'captured_at')::timestamptz>now()+interval '5 minutes'
    or (v->>'kind'='inbound' and (nullif(v->>'body','') is null or nullif(v->>'message_id','') is null))
    or (v->>'kind'='status' and coalesce(v->>'signal','') not in ('accepted','delivered','read'))
    then raise exception 'Correlação ou conteúdo do evento inválido'; end if;
  select * into p from public.propostas where id=(v->>'context_id')::uuid for update;
  if p.id is null then raise exception 'Proposta correlacionada ausente'; end if;
  perform 1 from public.oportunidades where id=p.oportunidade_id for update;
  select * into b from public.event_outbox where id=(v->>'send_id')::uuid for update;
  reference_id:=case when v->>'kind'='inbound' then v->>'reply_to_id' else v->>'message_id' end;
  -- Immutable identity failures still reject the whole page and preserve cursor.
  if b.id is null or b.proposal_id<>p.id or b.channel<>'whatsapp' or b.destination is distinct from v->>'destination'
    or b.status<>'accepted' or b.provider_id is distinct from reference_id or reference_id is null
    or b.reviewed_revision is distinct from (v->>'revision')::bigint
    or coalesce(b.reviewed_fingerprint,'') !~ '^[0-9a-f]{64}$'
    then raise exception 'Envio correlacionado mudou ou não foi confirmado'; end if;
  select count(*) into matches from public.event_outbox where channel='whatsapp' and destination=b.destination and (provider_id=reference_id or provider_reference=reference_id);
  if matches<>1 then raise exception 'Identificador de mensagem ambíguo'; end if;
  page_hash:=encode(extensions.digest((v-array['occurred_at','captured_at'])::text,'sha256'),'hex');
  if seen ? (v->>'key') then
   if seen->>(v->>'key')<>page_hash then raise exception 'Chave de evento divergente no lote'; end if;
   continue;
  end if;
  seen:=seen||jsonb_build_object(v->>'key',page_hash);
  select * into e from public.event_provider_events where provider='zapi' and event_key=v->>'key';
  if found then
   if e.send_id is distinct from b.id or e.kind is distinct from v->>'kind' or e.destination is distinct from b.destination
    or e.provider_message_id is distinct from v->>'message_id' or e.reply_to_id is distinct from v->>'reply_to_id'
    or e.signal is distinct from v->>'signal' or e.body is distinct from coalesce(v->>'body','') then raise exception 'Chave de evento divergente'; end if;
   if e.state in ('applied','ignored') then continue; end if;
  end if;
  key_hash:=encode(extensions.digest(v->>'key','sha256'),'hex');
  content_hash:=encode(extensions.digest(jsonb_build_object('kind',v->>'kind','message',v->>'message_id','reply',v->>'reply_to_id','signal',v->>'signal','body',coalesce(v->>'body',''))::text,'sha256'),'hex');
  select * into q from event_private.bot_bridge_quarantine where event_key_hash=key_hash;
  if found then
   if q.send_id<>b.id or q.proposal_id<>p.id or q.reviewed_revision<>b.reviewed_revision or q.kind<>v->>'kind' or q.content_fingerprint<>content_hash then raise exception 'Chave de quarentena divergente'; end if;
   -- A later edit/reversion must never automatically replay an obsolete event.
   quarantined:=quarantined+1; continue;
  end if;
  obsolete_reason:=case when not p.is_current then 'proposal_superseded'
    when p.status in ('cancelado','pos_venda') then 'proposal_closed'
    when b.reviewed_fingerprint is distinct from event_private.public_proposal_fingerprint(p) then 'proposal_changed' else null end;
  if obsolete_reason is not null then
   insert into event_private.bot_bridge_quarantine(scope_id,event_key_hash,content_fingerprint,send_id,proposal_id,reviewed_revision,kind,reason,page_cursor)
    values(s.scope_id,key_hash,content_hash,b.id,p.id,b.reviewed_revision,v->>'kind',obsolete_reason,next_cursor_value);
   quarantined:=quarantined+1;
  else
   accepted:=accepted||jsonb_build_array(v);
  end if;
 end loop;
 perform public.ingest_event_provider_events('zapi',accepted);
 update event_private.bot_bridge_state set cursor=next_cursor_value,last_success_at=now(),updated_at=now(),
  diagnostic=jsonb_array_length(accepted)||' evento(s) encaminhado(s); '||quarantined||' em quarentena.' where singleton;
end; $$;

-- Existing team-authenticated diagnostic API, aggregate metadata only.
-- A recent successful empty poll proves transport, not delivery or business readiness.
create or replace function event_private.channel_diagnostics_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare batch event_private.channel_diagnostic_batch; b event_private.bot_bridge_state; m event_private.mailbox_sync_state; mailbox_channel event_private.channel_credentials;
 c event_private.channel_credentials; counts record; runtime jsonb; result jsonb;
begin
 select * into b from event_private.bot_bridge_state where singleton;
 select * into m from event_private.mailbox_sync_state where singleton;
 select * into c from event_private.channel_credentials where provider='zapi';
 select * into mailbox_channel from event_private.channel_credentials where provider='mailbox';
 select count(*) total,count(*) filter(where recorded_at>now()-interval '7 days') recent,max(recorded_at) latest
  into counts from event_private.bot_bridge_quarantine;
 runtime:=jsonb_build_object('observed_at',now(),'bridge',jsonb_build_object(
  'state',case when b.singleton is null or c.provider is null then 'unknown' when not b.enabled or not c.enabled then 'disabled'
   when b.scope_id is null or c.expected_account is distinct from 'bot:embaixada_urca' then 'blocked' when b.last_success_at is null then 'not_observed'
   when b.last_success_at<now()-interval '15 minutes' then 'stale' when counts.recent>0 then 'degraded' else 'observed' end,
  'enabled',b.enabled and c.enabled,'scope_configured',b.scope_id is not null,'last_success_at',b.last_success_at,
  'quarantined_total',counts.total,'quarantined_recent',counts.recent,'last_quarantined_at',counts.latest),
  'mailbox',jsonb_build_object('state',case when m.singleton is null or mailbox_channel.provider is null then 'unknown' when not m.enabled or not mailbox_channel.enabled then 'disabled'
   when m.mailbox is null or m.mailbox is distinct from mailbox_channel.expected_account then 'blocked'
   when m.last_success_at is null then 'not_observed' when m.last_success_at<now()-interval '15 minutes' then 'stale' else 'observed' end,
   'enabled',m.enabled and mailbox_channel.enabled,'last_success_at',m.last_success_at));
 select * into batch from event_private.channel_diagnostic_batch where singleton;
 if not found then return jsonb_build_object('state','not_checked','runtime',runtime); end if;
 result:=jsonb_build_object('id',batch.id,'requested_at',batch.requested_at,'stale',batch.requested_at<now()-interval '15 minutes',
  'bridge',event_private.channel_probe_response(batch.bridge_request,batch.requested_at),
  'delivery',event_private.channel_probe_response(batch.delivery_request,batch.requested_at));
 return result||jsonb_build_object('runtime',runtime);
end; $$;
