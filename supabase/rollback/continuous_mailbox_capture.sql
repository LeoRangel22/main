-- Disable first; preserve messages, receipts, routes, audit history and schema.
do $$ begin
 if exists(select 1 from event_private.mailbox_owner_pilot where singleton and state='open') then raise exception 'close_pilot_before_rollback';end if;
 if exists(select 1 from event_private.mailbox_sync_state s cross join event_private.mailbox_continuous_control v cross join event_private.channel_credentials c
  where s.singleton and v.singleton and c.provider='mailbox' and (s.enabled or c.enabled)
  and not (v.enabled and s.capture_mode='continuous' and s.account_id=v.account_id and s.activated_at_ms=floor(extract(epoch from v.started_at)*1000)::bigint)) then raise exception 'rollback_configuration_changed';end if;
end $$;
select event_private.stop_continuous_mailbox('rollback',null);
revoke all on function public.event_continuous_mailbox(text,bigint,uuid[],uuid,boolean) from public,anon,authenticated,service_role;


create or replace function public.event_mailbox_worker_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('enabled',s.enabled,'account_id',s.account_id,'mailbox',s.mailbox,'activated_at_ms',s.activated_at_ms,'watermark_ms',s.watermark_ms,'version',s.version,'channel_enabled',c.enabled,'expected_account',c.expected_account,'job_key',c.delivery_job_key,'capture_send_ids',s.capture_send_ids,'capture_started_at_ms',floor(extract(epoch from s.capture_started_at)*1000)::bigint,'capture_expires_at_ms',floor(extract(epoch from s.capture_expires_at)*1000)::bigint,'capture_message_limit',s.capture_message_limit,'capture_used_messages',(select count(distinct r.message_id) from event_private.mailbox_bound_receipts r where r.account_id=s.account_id and r.recorded_at>=s.capture_started_at and r.message_id is not null))
 from event_private.mailbox_sync_state s cross join event_private.channel_credentials c where s.singleton and c.provider='mailbox';
$$;

create or replace function public.event_mailbox_resolve_binding(target_account_id text,target_mailbox text,sender text,target_message_id text,reply_candidates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; result jsonb;
begin
 if target_message_id is null or target_message_id !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(target_message_id)>302 or target_mailbox is distinct from 'eventos@embaixadacarioca.com.br' or jsonb_typeof(reply_candidates) is distinct from 'array'
 or jsonb_array_length(reply_candidates)>33 or jsonb_array_length(reply_candidates)<1 then raise exception 'binding_request_invalid'; end if;
 if exists(select 1 from jsonb_array_elements(reply_candidates) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' or length(v#>>'{}')>302) then raise exception 'binding_request_invalid'; end if;
 if not exists(select 1 from event_private.mailbox_sync_state s join event_private.channel_credentials c on c.provider='mailbox'
 where s.singleton and s.enabled and c.enabled and cardinality(s.capture_send_ids) between 1 and 2 and s.capture_started_at<=clock_timestamp() and s.capture_expires_at>clock_timestamp() and s.account_id=target_account_id and s.mailbox=target_mailbox and c.expected_account=target_mailbox) then raise exception 'mailbox_disabled'; end if;
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
 if not exists(select 1 from event_private.mailbox_sync_state s where s.singleton and (result->>'send_id')::uuid=any(s.capture_send_ids)) then return jsonb_build_object('code','out_of_scope');end if;
 if exists(select 1 from event_private.mailbox_bound_receipts r where r.account_id=target_account_id and r.inbound_message_id=target_message_id and r.message_id is not null) then
  if exists(select 1 from event_private.mailbox_bound_receipts r where r.account_id=target_account_id and r.inbound_message_id=target_message_id and r.message_id is not null
   and (r.sender is distinct from $3 or r.send_id::text is distinct from result->>'send_id' or r.send_attempt is distinct from (result->>'send_attempt')::integer or r.proposal_id::text is distinct from result->>'proposal_id' or r.proposal_revision is distinct from (result->>'proposal_revision')::bigint or r.evidence_sha256 is distinct from result->>'evidence_sha256' or r.outbound_message_id is distinct from result->>'outbound_message_id')) then return jsonb_build_object('code','ambiguous');end if;
  return jsonb_build_object('code','duplicate','binding',result);
 end if;
 if (select count(distinct r.message_id) from event_private.mailbox_bound_receipts r cross join event_private.mailbox_sync_state s where s.singleton and r.account_id=s.account_id and r.recorded_at>=s.capture_started_at and r.message_id is not null)>=(select capture_message_limit from event_private.mailbox_sync_state where singleton) then return jsonb_build_object('code','capture_limit');end if;
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

create or replace function event_private.queue_mailbox_sync() returns void language plpgsql security definer set search_path='' as $$
declare s event_private.mailbox_sync_state;c event_private.channel_credentials;
begin
 select * into s from event_private.mailbox_sync_state where singleton;
 select * into c from event_private.channel_credentials where provider='mailbox';
 if s.enabled is distinct from true or c.enabled is distinct from true or s.mailbox is distinct from c.expected_account or cardinality(s.capture_send_ids) not between 1 and 2 or s.capture_started_at is null or s.capture_expires_at is null or s.capture_started_at>clock_timestamp() or s.capture_expires_at<=clock_timestamp() then return;end if;
 perform net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync',body:='{"action":"sync"}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),timeout_milliseconds:=120000);
end $$;
