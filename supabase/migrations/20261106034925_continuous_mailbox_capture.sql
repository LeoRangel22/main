-- Installed dormant. Reuses the existing verified connection and job key.
-- No activation, scheduling, credentials, outbound mail or business-state writes.
alter table event_private.mailbox_sync_state add column capture_mode text not null default 'pilot' check(capture_mode in ('pilot','continuous'));
create table event_private.mailbox_continuous_control(
 singleton boolean primary key default true check(singleton), version bigint not null default 0 check(version>=0),
 enabled boolean not null default false, owner_id uuid references auth.users(id), account_id text,
 test_only boolean not null default true, target_send_ids uuid[] not null default '{}',
 readmitted_route_ids uuid[] not null default '{}', started_at timestamptz, expires_at timestamptz,
 job_id bigint,last_job bigint,last_queued_at timestamptz,last_success_at timestamptz,
 check(not enabled or (owner_id is not null and account_id is not null and started_at is not null and
  ((test_only and cardinality(target_send_ids) between 1 and 2 and expires_at>started_at and expires_at<=started_at+interval '1 hour') or
   (not test_only and cardinality(target_send_ids)=0 and expires_at is null))))
);
alter table event_private.mailbox_continuous_control enable row level security;
revoke all on event_private.mailbox_continuous_control from public,anon,authenticated,service_role;
insert into event_private.mailbox_continuous_control(singleton) values(true);
create table event_private.mailbox_continuous_audit(
 id bigint generated always as identity primary key,actor_id uuid references auth.users(id),
 action text not null,version bigint not null,request_id uuid unique,request_hash text,
 details jsonb not null default '{}',recorded_at timestamptz not null default clock_timestamp()
);
alter table event_private.mailbox_continuous_audit enable row level security;
revoke all on event_private.mailbox_continuous_audit from public,anon,authenticated,service_role;

create function event_private.mailbox_capture_active(target_account text,target_mailbox text)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(bool_or(s.enabled and c.enabled and s.account_id=$1 and s.mailbox=$2
  and s.mailbox='eventos@embaixadacarioca.com.br' and c.expected_account=s.mailbox and
  case when s.capture_mode='pilot' then cardinality(s.capture_send_ids) between 1 and 2
   and s.capture_started_at<=clock_timestamp() and s.capture_expires_at>clock_timestamp()
  when s.capture_mode='continuous' then v.enabled and v.account_id=s.account_id and cardinality(s.capture_send_ids)=0
   and v.started_at<=clock_timestamp() and ((v.test_only and v.expires_at>clock_timestamp()) or
    (not v.test_only and v.expires_at is null))
   and exists(select 1 from event_private.mailbox_oauth_connection o where o.singleton
    and o.account_id=s.account_id and o.mailbox=s.mailbox and o.owner_id=v.owner_id and o.vault_secret_id is not null)
  else false end),false)
 from event_private.mailbox_sync_state s cross join event_private.mailbox_continuous_control v
 cross join event_private.channel_credentials c where s.singleton and v.singleton and c.provider='mailbox';
$$;
revoke all on function event_private.mailbox_capture_active(text,text) from public,anon,authenticated,service_role;

create function event_private.mailbox_capture_contains(target_send uuid)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(bool_or(case when s.capture_mode='pilot' then $1=any(s.capture_send_ids)
 when s.capture_mode='continuous' then exists(
  select 1 from event_private.mailbox_reply_routes r join public.event_outbox b on b.id=r.send_id
  join public.propostas p on p.id=b.proposal_id join auth.users u on u.id=v.owner_id
  where b.id=$1 and r.account_id=s.account_id and r.revoked_at is null and r.expires_at>clock_timestamp()
   and b.channel='email' and b.status='accepted' and b.attempts=r.send_attempt
   and b.reviewed_revision=r.proposal_revision and p.id=r.proposal_id
   and p.oportunidade_id=b.opportunity_id and b.opportunity_id is not null
   and p.public_token_revoked_at is null and r.destination=lower(trim(b.destination))
   and r.body_sha256=encode(sha256(convert_to(b.body,'UTF8')),'hex')
   and (not v.test_only or (b.id=any(v.target_send_ids) and r.created_by=v.owner_id
    and lower(trim(b.destination))=lower(u.email)
    and p.cliente_nome ~ '^\[TESTE SEM VALOR COMERCIAL\] QA-VENDA-0[123]($|[^0-9])'))
 ) else false end),false)
 from event_private.mailbox_sync_state s cross join event_private.mailbox_continuous_control v
 where s.singleton and v.singleton and event_private.mailbox_capture_active(s.account_id,s.mailbox);
$$;
revoke all on function event_private.mailbox_capture_contains(uuid) from public,anon,authenticated,service_role;

create function event_private.mailbox_capture_limit_reached() returns boolean language sql security definer set search_path='' as $$
 select case when s.capture_mode='continuous' then false else
  (select count(distinct r.message_id) from event_private.mailbox_bound_receipts r
   where r.account_id=s.account_id and r.recorded_at>=s.capture_started_at and r.message_id is not null)>=s.capture_message_limit end
 from event_private.mailbox_sync_state s where s.singleton;
$$;
revoke all on function event_private.mailbox_capture_limit_reached() from public,anon,authenticated,service_role;

create or replace function public.event_mailbox_worker_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('enabled',s.enabled,'account_id',s.account_id,'mailbox',s.mailbox,
 'activated_at_ms',s.activated_at_ms,'watermark_ms',s.watermark_ms,'version',s.version,
 'channel_enabled',c.enabled,'expected_account',c.expected_account,'job_key',c.delivery_job_key,
 'capture_mode',s.capture_mode,'capture_send_ids',s.capture_send_ids,
 'capture_started_at_ms',floor(extract(epoch from s.capture_started_at)*1000)::bigint,
 'capture_expires_at_ms',floor(extract(epoch from s.capture_expires_at)*1000)::bigint,
 'capture_message_limit',s.capture_message_limit,
 'capture_used_messages',(select count(distinct r.message_id) from event_private.mailbox_bound_receipts r
  where r.account_id=s.account_id and r.recorded_at>=s.capture_started_at and r.message_id is not null),
 'continuous_enabled',v.enabled,'continuous_test_only',v.test_only,
 'continuous_started_at_ms',floor(extract(epoch from v.started_at)*1000)::bigint,
 'continuous_expires_at_ms',floor(extract(epoch from v.expires_at)*1000)::bigint)
 from event_private.mailbox_sync_state s cross join event_private.mailbox_continuous_control v
 cross join event_private.channel_credentials c where s.singleton and v.singleton and c.provider='mailbox';
$$;

create or replace function public.event_mailbox_resolve_binding(target_account_id text,target_mailbox text,sender text,target_message_id text,reply_candidates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; result jsonb;
begin
 if target_message_id is null or target_message_id !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(target_message_id)>302 or target_mailbox is distinct from 'eventos@embaixadacarioca.com.br' or jsonb_typeof(reply_candidates) is distinct from 'array'
 or jsonb_array_length(reply_candidates)>33 or jsonb_array_length(reply_candidates)<1 then raise exception 'binding_request_invalid'; end if;
 if exists(select 1 from jsonb_array_elements(reply_candidates) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(v#>>'{}')>302) then raise exception 'binding_request_invalid'; end if;
 if not event_private.mailbox_capture_active($1,$2) then raise exception 'mailbox_disabled';end if;
 -- A verified ancestor can exist before the ledger is durably accepted. Do not
 -- consume that reply, or choose another accepted ancestor prematurely.
 if exists(
  select 1 from event_private.mailbox_outbound_headers h join public.event_outbox b on b.id=h.send_id
  where h.account_id=target_account_id and reply_candidates ? h.outbound_message_id
   and b.channel='email' and b.status in ('sending','uncertain')
   and b.attempts=h.send_attempt and b.reviewed_revision=h.proposal_revision
   and b.opportunity_id is not null and lower(trim(b.destination))=sender
 ) then return jsonb_build_object('code','transport_pending');end if;
 select count(*),(jsonb_agg(jsonb_build_object('version',1,'account_id',h.account_id,'mailbox',target_mailbox,'send_id',b.id,'send_attempt',h.send_attempt,'proposal_id',b.proposal_id,'proposal_revision',h.proposal_revision,'opportunity_id',b.opportunity_id,'outbound_message_id',h.outbound_message_id,'origin','verified_outbound_header','evidence_sha256',h.evidence_sha256)))->0
 into n,result from event_private.mailbox_outbound_headers h join public.event_outbox b on b.id=h.send_id
 where h.account_id=target_account_id and reply_candidates ? h.outbound_message_id and b.channel='email' and b.status='accepted'
 and b.attempts=h.send_attempt and b.reviewed_revision=h.proposal_revision and b.opportunity_id is not null and lower(trim(b.destination))=sender;
 if n=0 then return null; end if;
 -- A chain referencing multiple sends is ambiguous, even if it has a nearer parent.
 if n<>1 then return jsonb_build_object('code','ambiguous'); end if;
 if not event_private.mailbox_capture_contains((result->>'send_id')::uuid) then return jsonb_build_object('code','out_of_scope');end if;
 if exists(select 1 from event_private.mailbox_bound_receipts r where r.account_id=target_account_id and r.inbound_message_id=target_message_id and r.message_id is not null) then
  if exists(select 1 from event_private.mailbox_bound_receipts r where r.account_id=target_account_id and r.inbound_message_id=target_message_id and r.message_id is not null
   and (r.sender is distinct from $3 or r.send_id::text is distinct from result->>'send_id' or r.send_attempt is distinct from (result->>'send_attempt')::integer or r.proposal_id::text is distinct from result->>'proposal_id' or r.proposal_revision is distinct from (result->>'proposal_revision')::bigint or r.evidence_sha256 is distinct from result->>'evidence_sha256' or r.outbound_message_id is distinct from result->>'outbound_message_id')) then return jsonb_build_object('code','ambiguous');end if;
  return jsonb_build_object('code','duplicate','binding',result);
 end if;
 if event_private.mailbox_capture_limit_reached() then return jsonb_build_object('code','capture_limit');end if;
 return result;
end $$;
create or replace function public.event_mailbox_resolve_routed_binding(target_account_id text,target_mailbox text,sender text,target_message_id text,reply_candidates jsonb,reply_routes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r event_private.mailbox_reply_routes;b public.event_outbox;prior event_private.mailbox_bound_receipts;result jsonb;legacy jsonb;
begin
 if $1 is null or $1 !~ '^[0-9]{1,40}$' or $2 is distinct from 'eventos@embaixadacarioca.com.br' or $3 is null or
 $4 is null or $4 !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length($4)>302 or jsonb_typeof($5) is distinct from 'array' or jsonb_array_length($5)>33 or
 jsonb_typeof($6) is distinct from 'array' or jsonb_array_length($6) not between 1 and 4 then raise exception 'binding_request_invalid';end if;
 if exists(select 1 from jsonb_array_elements($5) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(v#>>'{}')>302) or
 exists(select 1 from jsonb_array_elements($6) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^eventos\+[a-z2-7]{51}[aq]@embaixadacarioca\.com\.br$') then raise exception 'binding_request_invalid';end if;
 if not event_private.mailbox_capture_active($1,$2) then raise exception 'mailbox_disabled';end if;
 if jsonb_array_length($5)>0 then legacy:=public.event_mailbox_resolve_binding($1,$2,$3,$4,$5);end if;
 if legacy->>'code'='transport_pending' then return legacy;end if;
 -- Pending known routes, including those outside scope, are never permanently consumed.
 if exists(select 1 from event_private.mailbox_reply_routes x left join public.event_outbox o on o.id=x.send_id
 where x.account_id=$1 and $6 ? x.reply_to and x.destination=$3 and x.revoked_at is null and (x.expires_at is null or x.expires_at>clock_timestamp()) and
 (o.attempts=x.send_attempt and o.reviewed_revision=x.proposal_revision and o.status in ('sending','uncertain'))) then return jsonb_build_object('code','transport_pending');end if;
 if jsonb_array_length($6)<>1 then return jsonb_build_object('code','ambiguous');end if;
 select * into r from event_private.mailbox_reply_routes x where x.account_id=$1 and x.reply_to=$6->>0;
 if not found then return null;end if;
 if r.revoked_at is not null or (r.expires_at is not null and r.expires_at<=clock_timestamp()) then return jsonb_build_object('code','out_of_scope');end if;
 select * into b from public.event_outbox where id=r.send_id;
 if b.id is null or b.channel<>'email' or b.status<>'accepted' or b.attempts is distinct from r.send_attempt or b.reviewed_revision is distinct from r.proposal_revision or b.proposal_id is distinct from r.proposal_id or b.opportunity_id is null or r.destination is distinct from $3 or lower(trim(b.destination)) is distinct from $3 or r.body_sha256 is distinct from encode(sha256(convert_to(b.body,'UTF8')),'hex') then return null;end if;
 if exists(select 1 from public.propostas where id=r.proposal_id and public_token_revoked_at is not null) then return jsonb_build_object('code','out_of_scope');end if;
 -- A route must not override a verified RFC ancestor of another send/attempt/revision.
 if legacy->>'code'='ambiguous' or exists(select 1 from event_private.mailbox_outbound_headers h where h.account_id=$1 and $5 ? h.outbound_message_id and
 (h.send_id is distinct from r.send_id or h.send_attempt is distinct from r.send_attempt or h.proposal_revision is distinct from r.proposal_revision)) then return jsonb_build_object('code','ambiguous');end if;
 if not event_private.mailbox_capture_contains(b.id) then return jsonb_build_object('code','out_of_scope');end if;
 result:=jsonb_build_object('version',2,'account_id',$1,'mailbox',$2,'send_id',b.id,'send_attempt',r.send_attempt,'proposal_id',r.proposal_id,'proposal_revision',r.proposal_revision,'opportunity_id',b.opportunity_id,
 'outbound_message_id',null,'origin','server_generated_reply_to_capability','route_id',r.id,'route_address',r.reply_to,'evidence_sha256',
 encode(sha256(convert_to(jsonb_build_array(r.id,r.account_id,r.proposal_id,r.proposal_revision,r.destination,r.context_hash,r.reply_to,r.send_id,r.send_attempt,r.reviewed_content_hash,r.body_sha256)::text,'UTF8')),'hex'));
 select * into prior from event_private.mailbox_bound_receipts x where x.account_id=$1 and x.inbound_message_id=$4 and x.message_id is not null limit 1;
 if found then
  if prior.send_id is distinct from r.send_id or prior.send_attempt is distinct from r.send_attempt or prior.proposal_id is distinct from r.proposal_id or prior.proposal_revision is distinct from r.proposal_revision or prior.sender is distinct from $3 or prior.reply_route_id is distinct from r.id or prior.evidence_sha256 is distinct from result->>'evidence_sha256' then return jsonb_build_object('code','ambiguous');end if;
  return jsonb_build_object('code','duplicate','binding',result);
 end if;
 if event_private.mailbox_capture_limit_reached() then return jsonb_build_object('code','capture_limit');end if;
 return result;
end $$;
create or replace function public.event_mailbox_commit_bound(expected_version bigint,expected_account_id text,expected_watermark_ms bigint,next_watermark_ms bigint,items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s event_private.mailbox_sync_state;c event_private.channel_credentials;i jsonb;e jsonb;binding jsonb;trusted jsonb;received bigint;m uuid;old event_private.mailbox_bound_receipts;prior event_private.mailbox_bound_receipts;body_hash text;
begin
 perform pg_advisory_xact_lock(716612);
 -- Block concurrent provenance inserts until full-chain revalidation and commit.
 lock table event_private.mailbox_outbound_headers in share mode;
 lock table event_private.mailbox_reply_routes in share mode;
 select * into s from event_private.mailbox_sync_state where singleton for update;
 select * into c from event_private.channel_credentials where provider='mailbox' for share;
 if not event_private.mailbox_capture_active(s.account_id,s.mailbox) then raise exception 'mailbox_disabled';end if;
 if s.account_id is distinct from expected_account_id or s.version is distinct from expected_version or s.watermark_ms is distinct from expected_watermark_ms then raise exception 'cursor_changed';end if;
 if next_watermark_ms is null or next_watermark_ms<expected_watermark_ms or next_watermark_ms>floor(extract(epoch from now())*1000) then raise exception 'cursor_invalid';end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>20 then raise exception 'batch_invalid';end if;
 for i in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(i) is distinct from 'object' or jsonb_typeof(i->'provider_id') is distinct from 'string' or (i->>'provider_id') !~ '^[0-9]{1,40}$' or jsonb_typeof(i->'received_at_ms') is distinct from 'number' or coalesce(i->>'state','') not in ('prepared','duplicate','review_required','ignored') then raise exception 'item_invalid';end if;
  received:=(i->>'received_at_ms')::bigint;
  if received<s.activated_at_ms or received>next_watermark_ms then raise exception 'received_time_invalid';end if;
  select * into old from event_private.mailbox_bound_receipts where account_id=s.account_id and provider_id=i->>'provider_id';
  if found then raise exception 'duplicate_requires_readback';end if;
  if exists(select 1 from event_private.mailbox_seen where account_id=s.account_id and provider_id=i->>'provider_id') then raise exception 'legacy_message_requires_review';end if;
  binding:=i->'binding';e:=i->'event';m:=null;body_hash:=null;
  if i->>'state' in ('prepared','duplicate') then
   if jsonb_typeof(binding) is distinct from 'object' or i->>'inbound_message_id' is null or (i->>'inbound_message_id') !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(i->>'inbound_message_id')>302 or nullif(i->>'sender','') is null then raise exception 'binding_invalid';end if;
   if i->>'state'='prepared' then
    if jsonb_typeof(e) is distinct from 'object' or e->>'kind' is distinct from 'inbound' or e->>'channel' is distinct from 'email' or nullif(e->>'body','') is null or length(e->>'body')>6000 or e->>'message_id' is distinct from i->>'inbound_message_id' or e->>'destination' is distinct from i->>'sender' or e->>'message_id' is distinct from e->>'key' or e ? 'signal' then raise exception 'event_invalid';end if;
    if abs(extract(epoch from (e->>'occurred_at')::timestamptz)*1000-received)>1 then raise exception 'event_time_changed';end if;
    body_hash:=encode(sha256(convert_to(e->>'body','UTF8')),'hex');
   elsif e is not null and e<>'null'::jsonb then raise exception 'duplicate_body_forbidden';end if;
   perform 1 from public.propostas where id=(binding->>'proposal_id')::uuid for update;
   perform 1 from public.oportunidades where id=(binding->>'opportunity_id')::uuid for update;
   perform 1 from public.event_outbox where id=(binding->>'send_id')::uuid for update;
   if jsonb_array_length(coalesce(i->'reply_routes','[]'::jsonb))>0 then
    trusted:=public.event_mailbox_resolve_routed_binding(s.account_id,s.mailbox,i->>'sender',i->>'inbound_message_id',i->'reply_candidates',i->'reply_routes');
   else trusted:=public.event_mailbox_resolve_binding(s.account_id,s.mailbox,i->>'sender',i->>'inbound_message_id',i->'reply_candidates');end if;
   if trusted->>'code'='duplicate' then trusted:=trusted->'binding';end if;
   if trusted is null or trusted is distinct from binding then raise exception 'binding_changed';end if;
   select * into prior from event_private.mailbox_bound_receipts r where r.account_id=s.account_id and r.inbound_message_id=i->>'inbound_message_id' and r.message_id is not null limit 1;
   if found then
    if body_hash is not null and body_hash is distinct from prior.body_sha256 then raise exception 'rfc_content_conflict';end if;
    m:=prior.message_id;body_hash:=prior.body_sha256;
   else
    if i->>'state'='duplicate' then raise exception 'duplicate_requires_readback';end if;
    insert into public.event_messages(opportunity_id,proposal_id,proposal_revision,channel,direction,source,body,occurred_at,external_id)
     values((trusted->>'opportunity_id')::uuid,(trusted->>'proposal_id')::uuid,(trusted->>'proposal_revision')::bigint,'email','inbound','provider',e->>'body',(e->>'occurred_at')::timestamptz,'mailbox:'||s.account_id||':'||(i->>'inbound_message_id')) returning id into m;
    -- Preserve existing follow-up behavior; no approval, price, payment or reservation effects.
    update public.oportunidades set ultima_resposta_cliente_em=greatest(ultima_resposta_cliente_em,(e->>'occurred_at')::timestamptz),
     proxima_acao=case when status not in ('perdido','cancelado','pos_venda') and (data_evento is null or data_evento>=(now() at time zone 'America/Sao_Paulo')::date) then 'Responder mensagem do cliente' else proxima_acao end,
     proxima_acao_em=case when status not in ('perdido','cancelado','pos_venda') and (data_evento is null or data_evento>=(now() at time zone 'America/Sao_Paulo')::date) then now() else proxima_acao_em end
     where id=(trusted->>'opportunity_id')::uuid and (ultimo_contato_em is null or (e->>'occurred_at')::timestamptz>ultimo_contato_em);
   end if;
  else
   if binding is not null and binding<>'null'::jsonb or e is not null and e<>'null'::jsonb then raise exception 'review_body_forbidden';end if;
   if i->>'state'='review_required' and coalesce(i->>'reason','') not in ('no_thread','unmatched_thread','ambiguous_thread','capture_limit','out_of_scope') then raise exception 'review_reason_invalid';end if;
  end if;
  insert into event_private.mailbox_bound_receipts(account_id,provider_id,state,reason,send_id,send_attempt,proposal_id,proposal_revision,inbound_message_id,sender,evidence_sha256,outbound_message_id,body_sha256,message_id,reply_route_id,binding_origin)
   values(s.account_id,i->>'provider_id',i->>'state',i->>'reason',(binding->>'send_id')::uuid,(binding->>'send_attempt')::integer,(binding->>'proposal_id')::uuid,(binding->>'proposal_revision')::bigint,i->>'inbound_message_id',i->>'sender',binding->>'evidence_sha256',binding->>'outbound_message_id',body_hash,m,(binding->>'route_id')::uuid,binding->>'origin');
  insert into event_private.mailbox_seen(account_id,provider_id,received_at_ms) values(s.account_id,i->>'provider_id',received);
 end loop;
 if not event_private.mailbox_capture_active(s.account_id,s.mailbox) then raise exception 'capture_expired';end if;
 update event_private.mailbox_sync_state set watermark_ms=next_watermark_ms,version=version+1,last_success_at=now() where singleton;
 if s.capture_mode='continuous' then update event_private.mailbox_continuous_control set last_success_at=clock_timestamp() where singleton;end if;
end $$;

create function event_private.stop_continuous_mailbox(reason text,actor uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v event_private.mailbox_continuous_control; s event_private.mailbox_sync_state; owned boolean; mismatch boolean:=false;
begin
 perform pg_advisory_xact_lock(716612);
 select * into v from event_private.mailbox_continuous_control where singleton for update;
 if not v.enabled then return;end if;
 select * into s from event_private.mailbox_sync_state where singleton for update;
 owned:=s.capture_mode='continuous' and s.account_id=v.account_id and s.activated_at_ms=floor(extract(epoch from v.started_at)*1000)::bigint;
 update event_private.mailbox_continuous_control set enabled=false,version=version+1,job_id=null where singleton;
 if owned then
  update event_private.mailbox_sync_state set enabled=false,capture_mode='pilot',capture_send_ids='{}',
   capture_started_at=null,capture_expires_at=null,version=version+1 where singleton;
  update event_private.channel_credentials set enabled=false,updated_at=clock_timestamp() where provider='mailbox';
 end if;
 update event_private.mailbox_reply_routes set revoked_at=clock_timestamp()
  where id=any(v.readmitted_route_ids) and revoked_at is null;
 if v.job_id is not null then
  if exists(select 1 from cron.job j where j.jobid=v.job_id and j.jobname='events-mailbox-continuous'
   and j.command='select event_private.queue_continuous_mailbox();') then
   perform cron.unschedule(v.job_id);
  elsif exists(select 1 from cron.job j where j.jobid=v.job_id) then mismatch:=true;end if;
 end if;
 insert into event_private.mailbox_continuous_audit(actor_id,action,version,details)
  values(actor,$1,v.version+1,jsonb_build_object('configurationDrift',not owned,'cronMismatch',mismatch,'readmittedRoutesClosed',cardinality(v.readmitted_route_ids)));
end $$;
revoke all on function event_private.stop_continuous_mailbox(text,uuid) from public,anon,authenticated,service_role;

create function event_private.queue_continuous_mailbox() returns void
language plpgsql security definer set search_path='' as $$
declare v event_private.mailbox_continuous_control;s event_private.mailbox_sync_state;c event_private.channel_credentials; job bigint;
begin
 perform pg_advisory_xact_lock(716612);
 select * into v from event_private.mailbox_continuous_control where singleton for update;
 if not v.enabled then return;end if;
 if v.test_only and v.expires_at<=clock_timestamp() then
  perform event_private.stop_continuous_mailbox('expired',null);return;end if;
 select * into s from event_private.mailbox_sync_state where singleton;
 select * into c from event_private.channel_credentials where provider='mailbox';
 if s.capture_mode<>'continuous' or not event_private.mailbox_capture_active(s.account_id,s.mailbox) then return;end if;
 if v.last_queued_at>clock_timestamp()-interval '90 seconds' then return;end if;
 if v.last_job is not null and v.last_queued_at>clock_timestamp()-interval '3 minutes'
  and not exists(select 1 from net._http_response r where r.id=v.last_job) then return;end if;
 job:=net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync',
  body:='{"action":"sync"}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),
  timeout_milliseconds:=120000);
 update event_private.mailbox_continuous_control set last_job=job,last_queued_at=clock_timestamp() where singleton;
end $$;
revoke all on function event_private.queue_continuous_mailbox() from public,anon,authenticated,service_role;

create or replace function event_private.queue_mailbox_sync() returns void language plpgsql security definer set search_path='' as $$
declare s event_private.mailbox_sync_state;c event_private.channel_credentials;
begin
 select * into s from event_private.mailbox_sync_state where singleton;
 if s.capture_mode='continuous' then perform event_private.queue_continuous_mailbox();return;end if;
 select * into c from event_private.channel_credentials where provider='mailbox';
 if not event_private.mailbox_capture_active(s.account_id,s.mailbox) then return;end if;
 perform net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync',
  body:='{"action":"sync"}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),timeout_milliseconds:=120000);
end $$;

create function event_private.continuous_mailbox_status() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('version',v.version,'enabled',v.enabled,'testOnly',v.test_only,
  'state',case when not v.enabled then 'closed' when v.test_only and v.expires_at<=clock_timestamp() then 'expired' else 'active' end,
  'startsAt',v.started_at,'expiresAt',v.expires_at,'captureEnabled',s.enabled and c.enabled,
  'captureMode',s.capture_mode,'captureActive',event_private.mailbox_capture_active(s.account_id,s.mailbox),'targetSendIds',v.target_send_ids,'mailbox',s.mailbox,
  'connectionReady',s.account_id is not null and nullif(c.delivery_job_key,'') is not null
   and c.expected_account=s.mailbox and exists(select 1 from event_private.mailbox_oauth_connection o
    where o.singleton and o.account_id=s.account_id and o.mailbox=s.mailbox and o.vault_secret_id is not null),
  'schedulerRegistered',exists(select 1 from cron.job j where j.jobid=v.job_id and j.jobname='events-mailbox-continuous'
    and j.command='select event_private.queue_continuous_mailbox();'),
  'lastQueuedAt',v.last_queued_at,'lastSuccessAt',v.last_success_at,
  'jobState',case when v.last_job is null then 'none'
    when not exists(select 1 from net._http_response x where x.id=v.last_job) then 'pending_or_unknown'
    when exists(select 1 from net._http_response x where x.id=v.last_job and x.status_code=200
      and not coalesce(x.timed_out,false) and x.error_msg is null) then 'completed' else 'unconfirmed' end,
  'testSends',(select coalesce(jsonb_agg(jsonb_build_object('sendId',b.id,'proposalId',p.id,'version',p.versao,
    'reviewedRevision',b.reviewed_revision,'name',p.cliente_nome,'guests',p.convidados,
    'recipient',b.destination,'replyTo',r.reply_to,'routeRevoked',r.revoked_at is not null) order by p.versao),'[]')
    from public.event_outbox b join public.propostas p on p.id=b.proposal_id
    join event_private.mailbox_reply_routes r on r.send_id=b.id and r.account_id=s.account_id
    where b.channel='email' and b.status='accepted' and b.attempts=r.send_attempt
     and b.reviewed_revision=r.proposal_revision and p.oportunidade_id=b.opportunity_id
     and r.created_by=auth.uid() and lower(trim(b.destination))=lower(auth.jwt()->>'email')
     and p.cliente_nome ~ '^\[TESTE SEM VALOR COMERCIAL\] QA-VENDA-0[123]($|[^0-9])'),
  'replies',(select coalesce(jsonb_agg(jsonb_build_object('messageId',r.message_id,'proposalId',r.proposal_id,
    'revision',r.proposal_revision,'sendId',r.send_id,'recordedAt',r.recorded_at,
    'persisted',m.id is not null and m.proposal_id=r.proposal_id and m.opportunity_id=b.opportunity_id
      and m.direction='inbound' and m.proposal_revision=r.proposal_revision
      and b.reviewed_revision=r.proposal_revision and b.attempts=r.send_attempt)),'[]')
    from event_private.mailbox_bound_receipts r join public.event_outbox b on b.id=r.send_id
    left join public.event_messages m on m.id=r.message_id
    where v.test_only and r.send_id=any(v.target_send_ids) and r.account_id=s.account_id
     and r.recorded_at>=v.started_at and r.message_id is not null))
 from event_private.mailbox_continuous_control v cross join event_private.mailbox_sync_state s
 cross join event_private.channel_credentials c where v.singleton and s.singleton and c.provider='mailbox';
$$;
revoke all on function event_private.continuous_mailbox_status() from public,anon,authenticated,service_role;

create function public.event_continuous_mailbox(action text,expected_version bigint default null,
 target_ids uuid[] default '{}',request_id uuid default null,confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v event_private.mailbox_continuous_control;s event_private.mailbox_sync_state;c event_private.channel_credentials;
 request_hash text; prior event_private.mailbox_continuous_audit; actor_email text;
 target uuid; r event_private.mailbox_reply_routes; b public.event_outbox;p public.propostas;
 readmitted uuid[]:='{}';started timestamptz;current_ms bigint;scheduled bigint;
begin
 perform event_private.require_mailbox_oauth_owner();
 if $1 not in ('status','start_test','start','stop') or $1 is null then raise exception 'action_invalid';end if;
 if $1='status' then return event_private.continuous_mailbox_status();end if;
 if $5 is distinct from true or $4 is null or $2 is null then raise exception 'explicit_confirmation_required';end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_array($1,$2,$3)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(716612);
 select * into prior from event_private.mailbox_continuous_audit a where a.request_id=$4;
 if found then
  if prior.actor_id is distinct from auth.uid() or prior.request_hash is distinct from request_hash then raise exception 'request_reused';end if;
  return event_private.continuous_mailbox_status();
 end if;
 select * into v from event_private.mailbox_continuous_control where singleton for update;
 if v.version is distinct from $2 then raise exception 'capture_version_changed';end if;
 if $1='stop' then
  perform event_private.stop_continuous_mailbox('owner_stopped',auth.uid());
  insert into event_private.mailbox_continuous_audit(actor_id,action,version,request_id,request_hash)
   select auth.uid(),'stop',x.version,$4,request_hash from event_private.mailbox_continuous_control x where x.singleton;
  return event_private.continuous_mailbox_status();
 end if;
 select * into s from event_private.mailbox_sync_state where singleton for update;
 select * into c from event_private.channel_credentials where provider='mailbox' for update;
 if v.enabled or s.enabled or c.enabled or exists(select 1 from event_private.mailbox_owner_pilot x where x.singleton and x.state='open')
  then raise exception 'capture_already_active';end if;
 if s.account_id is null or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br'
  or c.expected_account is distinct from s.mailbox or nullif(c.delivery_job_key,'') is null
  or not exists(select 1 from event_private.mailbox_oauth_connection o where o.singleton and
    o.account_id=s.account_id and o.mailbox=s.mailbox and o.owner_id=auth.uid() and o.vault_secret_id is not null)
  then raise exception 'verified_connection_required';end if;
 if exists(select 1 from cron.job where jobname='events-mailbox-continuous') then raise exception 'scheduler_name_conflict';end if;
 if $3 is null or ($1='start' and cardinality($3)<>0) or
  ($1='start_test' and (cardinality($3) not between 1 and 2 or
   (select count(distinct x) from unnest($3) x)<>cardinality($3))) then raise exception 'test_scope_invalid';end if;
 select lower(email) into actor_email from auth.users where id=auth.uid();
 if $1='start_test' then
  foreach target in array $3 loop
   select * into b from public.event_outbox where id=target for update;
   select * into p from public.propostas where id=b.proposal_id for update;
   select * into r from event_private.mailbox_reply_routes where send_id=target for update;
   if b.id is null or p.id is null or r.id is null or b.channel<>'email' or b.status<>'accepted'
    or r.account_id is distinct from s.account_id or r.created_by is distinct from auth.uid()
    or lower(trim(b.destination)) is distinct from actor_email or r.destination is distinct from actor_email
    or p.cliente_nome !~ '^\[TESTE SEM VALOR COMERCIAL\] QA-VENDA-0[123]($|[^0-9])'
    or b.attempts is distinct from r.send_attempt or b.reviewed_revision is distinct from r.proposal_revision
    or p.id is distinct from r.proposal_id or p.oportunidade_id is distinct from b.opportunity_id
    or b.opportunity_id is null or p.public_token_revoked_at is not null or p.journey_booked_locked
    or r.expires_at<=clock_timestamp() or r.body_sha256 is distinct from encode(sha256(convert_to(b.body,'UTF8')),'hex')
    then raise exception 'test_send_changed';end if;
   if r.revoked_at is not null then
    readmitted:=array_append(readmitted,r.id);
    insert into event_private.mailbox_continuous_audit(actor_id,action,version,details)
     values(auth.uid(),'test_route_readmitted',v.version+1,
      jsonb_build_object('routeId',r.id,'sendId',b.id,'previousRevokedAt',r.revoked_at));
    update event_private.mailbox_reply_routes set revoked_at=null where id=r.id;
   end if;
  end loop;
 end if;
 started:=clock_timestamp();current_ms:=floor(extract(epoch from started)*1000)::bigint;
 update event_private.mailbox_continuous_control set enabled=true,owner_id=auth.uid(),account_id=s.account_id,test_only=($1='start_test'),
  target_send_ids=$3,readmitted_route_ids=readmitted,started_at=started,
  expires_at=case when $1='start_test' then started+interval '1 hour' else null end,
  last_job=null,last_queued_at=null,last_success_at=null,version=version+1 where singleton;
 update event_private.mailbox_sync_state set enabled=true,capture_mode='continuous',capture_send_ids='{}',
  capture_started_at=null,capture_expires_at=null,activated_at_ms=current_ms,watermark_ms=current_ms,
  version=version+1 where singleton;
 update event_private.channel_credentials set enabled=true,updated_at=clock_timestamp() where provider='mailbox';
 scheduled:=cron.schedule('events-mailbox-continuous','*/2 * * * *','select event_private.queue_continuous_mailbox();');
 update event_private.mailbox_continuous_control set job_id=scheduled where singleton;
 insert into event_private.mailbox_continuous_audit(actor_id,action,version,request_id,request_hash,details)
  values(auth.uid(),$1,v.version+1,$4,request_hash,jsonb_build_object('targetSendIds',$3,'futureMessagesOnly',true,'testOnly',$1='start_test'));
 return event_private.continuous_mailbox_status();
end $$;
revoke all on function public.event_continuous_mailbox(text,bigint,uuid[],uuid,boolean) from public,anon,service_role;
grant execute on function public.event_continuous_mailbox(text,bigint,uuid[],uuid,boolean) to authenticated;
