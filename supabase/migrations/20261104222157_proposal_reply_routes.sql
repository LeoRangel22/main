-- Dormant reply-address capabilities. No flags, schedule, credentials or sends.
create table event_private.mailbox_reply_routes(
 id uuid primary key default gen_random_uuid(),
 account_id text not null check(account_id ~ '^[0-9]{1,40}$'),
 proposal_id uuid not null references public.propostas(id),
 proposal_revision bigint not null check(proposal_revision>0),
 destination text not null,
 context_hash text not null check(context_hash ~ '^[0-9a-f]{64}$'),
 reply_to text not null unique check(reply_to ~ '^eventos\+[a-z2-7]{51}[aq]@embaixadacarioca\.com\.br$'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,revoked_at timestamptz,
 send_id uuid references public.event_outbox(id),send_attempt integer,
 reviewed_content_hash text,body_sha256 text,
 unique(send_id,send_attempt),
 check((send_id is null and send_attempt is null and reviewed_content_hash is null and body_sha256 is null) or
 (send_id is not null and send_attempt is not null and reviewed_content_hash is not null and body_sha256 is not null and send_attempt>0 and reviewed_content_hash ~ '^[0-9a-f]{64}$' and body_sha256 ~ '^[0-9a-f]{64}$'))
);
alter table event_private.mailbox_reply_routes enable row level security;
revoke all on event_private.mailbox_reply_routes from public,anon,authenticated,service_role;
create index mailbox_reply_routes_context on event_private.mailbox_reply_routes(proposal_id,proposal_revision,context_hash,created_at desc);
alter table event_private.mailbox_bound_receipts add column reply_route_id uuid references event_private.mailbox_reply_routes(id),
 add column binding_origin text check(binding_origin in ('verified_outbound_header','server_generated_reply_to_capability'));

-- 32 random bytes -> 52 lowercase RFC4648 base32 characters, local part 60 octets.
create function event_private.mailbox_reply_route_token() returns text language plpgsql set search_path='' as $$
declare raw bytea:=extensions.gen_random_bytes(32);alphabet text:='abcdefghijklmnopqrstuvwxyz234567';result text:='';acc integer:=0;bits integer:=0;i integer;
begin
 for i in 0..31 loop
  acc:=(acc<<8)|get_byte(raw,i);bits:=bits+8;
  while bits>=5 loop
   bits:=bits-5;result:=result||substr(alphabet,((acc>>bits)&31)+1,1);acc:=acc&((1<<bits)-1);
  end loop;
 end loop;
 if bits>0 then result:=result||substr(alphabet,((acc<<(5-bits))&31)+1,1);end if;
 return result;
end $$;
revoke all on function event_private.mailbox_reply_route_token() from public,anon,authenticated,service_role;

create function public.event_email_reply_route_prepare(target_proposal uuid,reviewed_revision bigint,send_destination text,context_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas;s event_private.mailbox_sync_state;r event_private.mailbox_reply_routes;b public.event_outbox;
begin
 perform event_private.require_team();
 if $4 is null or $4 !~ '^[0-9a-f]{64}$' or $3 is null or $3<>lower(trim($3)) or length($3)>320 or $3 !~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$' then raise exception 'reply_route_request_invalid';end if;
 -- Same global ingress lock: no external work inside this transaction.
 perform pg_advisory_xact_lock(716612);
 select * into p from public.propostas where id=$1 for update;
 if not found or p.revision is distinct from $2 or p.public_token_revoked_at is not null or
 (p.public_token_expires_at is not null and p.public_token_expires_at<=clock_timestamp()) then raise exception 'reply_route_revision_changed';end if;
 select * into s from event_private.mailbox_sync_state where singleton;
 if s.account_id is null or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br' then raise exception 'reply_route_account_unavailable';end if;
 select * into r from event_private.mailbox_reply_routes x where x.proposal_id=$1 and x.proposal_revision=$2 and x.context_hash=$4
 and x.destination=$3 and x.account_id=s.account_id and x.revoked_at is null and (x.expires_at is null or x.expires_at>clock_timestamp())
 order by x.created_at desc,x.id limit 1 for update;
 if found and r.send_id is not null then
  select * into b from public.event_outbox where id=r.send_id;
  -- A failed/paused explicit attempt requires a fresh preview and capability; never rebind an old attempt.
  if b.attempts is distinct from r.send_attempt or b.status not in ('sending','uncertain','accepted') then r.id:=null;end if;
 end if;
 if r.id is null then
  insert into event_private.mailbox_reply_routes(account_id,proposal_id,proposal_revision,destination,context_hash,reply_to,created_by,expires_at)
  values(s.account_id,$1,$2,$3,$4,'eventos+'||event_private.mailbox_reply_route_token()||'@embaixadacarioca.com.br',auth.uid(),p.public_token_expires_at) returning * into r;
 end if;
 return jsonb_build_object('version',1,'id',r.id,'reply_to',r.reply_to,'context_hash',r.context_hash);
end $$;
revoke all on function public.event_email_reply_route_prepare(uuid,bigint,text,text) from public,anon,service_role;
grant execute on function public.event_email_reply_route_prepare(uuid,bigint,text,text) to authenticated;

create function public.event_email_reply_route_bind(target_route uuid,target_send uuid,expected_attempt integer,context_hash text,reviewed_content_hash text,send_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r event_private.mailbox_reply_routes;b public.event_outbox;p public.propostas;s event_private.mailbox_sync_state;
begin
 if $4 is null or $4 !~ '^[0-9a-f]{64}$' or $5 is null or $5 !~ '^[0-9a-f]{64}$' then raise exception 'reply_route_bind_invalid';end if;
 perform pg_advisory_xact_lock(716612);
 select * into b from public.event_outbox where id=$2;
 perform 1 from public.propostas where id=b.proposal_id for update;
 perform 1 from public.oportunidades where id=b.opportunity_id for update;
 select * into b from public.event_outbox where id=$2 for update;
 select * into r from event_private.mailbox_reply_routes where id=$1 for update;
 select * into p from public.propostas where id=b.proposal_id;
 select * into s from event_private.mailbox_sync_state where singleton;
 if r.id is null or b.id is null or b.status<>'sending' or b.channel<>'email' or b.attempts is distinct from $3 or
 r.account_id is distinct from s.account_id or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br' or
 r.proposal_id is distinct from b.proposal_id or r.proposal_revision is distinct from b.reviewed_revision or
 p.revision is distinct from r.proposal_revision or p.public_token_revoked_at is not null or
 r.destination is distinct from lower(trim(b.destination)) or r.context_hash is distinct from $4 or
 r.revoked_at is not null or (r.expires_at is not null and r.expires_at<=clock_timestamp()) or b.body is distinct from $6
 then raise exception 'reply_route_bind_changed';end if;
 if r.send_id is not null and (r.send_id is distinct from $2 or r.send_attempt is distinct from $3 or
 r.reviewed_content_hash is distinct from $5 or r.body_sha256 is distinct from encode(sha256(convert_to($6,'UTF8')),'hex')) then raise exception 'reply_route_bind_immutable';end if;
 update event_private.mailbox_reply_routes set send_id=$2,send_attempt=$3,reviewed_content_hash=$5,body_sha256=encode(sha256(convert_to($6,'UTF8')),'hex') where id=$1;
 return jsonb_build_object('bound',true);
end $$;
revoke all on function public.event_email_reply_route_bind(uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.event_email_reply_route_bind(uuid,uuid,integer,text,text,text) to service_role;

create function public.event_mailbox_resolve_routed_binding(target_account_id text,target_mailbox text,sender text,target_message_id text,reply_candidates jsonb,reply_routes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r event_private.mailbox_reply_routes;b public.event_outbox;prior event_private.mailbox_bound_receipts;result jsonb;legacy jsonb;
begin
 if $1 is null or $1 !~ '^[0-9]{1,40}$' or $2 is distinct from 'eventos@embaixadacarioca.com.br' or $3 is null or
 $4 is null or $4 !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length($4)>302 or jsonb_typeof($5) is distinct from 'array' or jsonb_array_length($5)>33 or
 jsonb_typeof($6) is distinct from 'array' or jsonb_array_length($6) not between 1 and 4 then raise exception 'binding_request_invalid';end if;
 if exists(select 1 from jsonb_array_elements($5) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(v#>>'{}')>302) or
 exists(select 1 from jsonb_array_elements($6) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^eventos\+[a-z2-7]{51}[aq]@embaixadacarioca\.com\.br$') then raise exception 'binding_request_invalid';end if;
 if not exists(select 1 from event_private.mailbox_sync_state s join event_private.channel_credentials c on c.provider='mailbox' where s.singleton and s.enabled and c.enabled and
 cardinality(s.capture_send_ids) between 1 and 2 and s.capture_started_at<=clock_timestamp() and s.capture_expires_at>clock_timestamp() and s.account_id=$1 and s.mailbox=$2 and c.expected_account=$2) then raise exception 'mailbox_disabled';end if;
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
 if not exists(select 1 from event_private.mailbox_sync_state s where s.singleton and b.id=any(s.capture_send_ids)) then return jsonb_build_object('code','out_of_scope');end if;
 result:=jsonb_build_object('version',2,'account_id',$1,'mailbox',$2,'send_id',b.id,'send_attempt',r.send_attempt,'proposal_id',r.proposal_id,'proposal_revision',r.proposal_revision,'opportunity_id',b.opportunity_id,
 'outbound_message_id',null,'origin','server_generated_reply_to_capability','route_id',r.id,'route_address',r.reply_to,'evidence_sha256',
 encode(sha256(convert_to(jsonb_build_array(r.id,r.account_id,r.proposal_id,r.proposal_revision,r.destination,r.context_hash,r.reply_to,r.send_id,r.send_attempt,r.reviewed_content_hash,r.body_sha256)::text,'UTF8')),'hex'));
 select * into prior from event_private.mailbox_bound_receipts x where x.account_id=$1 and x.inbound_message_id=$4 and x.message_id is not null limit 1;
 if found then
  if prior.send_id is distinct from r.send_id or prior.send_attempt is distinct from r.send_attempt or prior.proposal_id is distinct from r.proposal_id or prior.proposal_revision is distinct from r.proposal_revision or prior.sender is distinct from $3 or prior.reply_route_id is distinct from r.id or prior.evidence_sha256 is distinct from result->>'evidence_sha256' then return jsonb_build_object('code','ambiguous');end if;
  return jsonb_build_object('code','duplicate','binding',result);
 end if;
 if (select count(distinct x.message_id) from event_private.mailbox_bound_receipts x cross join event_private.mailbox_sync_state s where s.singleton and x.account_id=s.account_id and x.recorded_at>=s.capture_started_at and x.message_id is not null)>=(select capture_message_limit from event_private.mailbox_sync_state where singleton) then return jsonb_build_object('code','capture_limit');end if;
 return result;
end $$;
revoke all on function public.event_mailbox_resolve_routed_binding(text,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.event_mailbox_resolve_routed_binding(text,text,text,text,jsonb,jsonb) to service_role;

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
 if cardinality(s.capture_send_ids) not between 1 and 2 or s.capture_started_at is null or s.capture_expires_at is null or s.capture_started_at>clock_timestamp() or s.capture_expires_at<=clock_timestamp() or s.enabled is distinct from true or c.enabled is distinct from true or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br' or c.expected_account is distinct from s.mailbox then raise exception 'mailbox_disabled';end if;
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
 if clock_timestamp()>=s.capture_expires_at then raise exception 'capture_expired';end if;
 update event_private.mailbox_sync_state set watermark_ms=next_watermark_ms,version=version+1,last_success_at=now() where singleton;
end $$;
revoke all on function public.event_mailbox_commit_bound(bigint,text,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.event_mailbox_commit_bound(bigint,text,bigint,bigint,jsonb) to service_role;

