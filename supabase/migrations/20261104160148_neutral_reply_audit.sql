-- Owner-reviewed reconciliation of the single neutral pilot only.
-- Installs dormant: no activation, scheduler, outbound binding overwrite or send.
create table event_private.neutral_reply_reviews (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 send_id uuid not null references public.event_outbox(id),proposal_id uuid not null references public.propostas(id),
 account_id text not null,proposal_revision bigint not null check(proposal_revision=1),send_attempt integer not null check(send_attempt=1),
 delivered_message_id text not null,reply_message_id text not null,provider_evidence_sha256 text not null check(provider_evidence_sha256 ~ '^[0-9a-f]{64}$'),
 provenance text not null default 'owner_reviewed_provider_headers' check(provenance='owner_reviewed_provider_headers'),
 context_sha256 text not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 state text not null default 'authorized' check(state in ('authorized','prepared','committed','duplicate')),
 provider_id text,preview jsonb,preview_sha256 text,message_id uuid references public.event_messages(id),committed_at timestamptz,
 check(delivered_message_id ~ '^<[^<>[:space:]@]+@[^<>[:space:]@]+>$' and length(delivered_message_id)<=300),
 check(reply_message_id ~ '^<[^<>[:space:]@]+@[^<>[:space:]@]+>$' and length(reply_message_id)<=300),
 check(delivered_message_id<>reply_message_id),check(expires_at>created_at and expires_at<=created_at+interval '5 minutes')
);
alter table event_private.neutral_reply_reviews enable row level security;
revoke all on event_private.neutral_reply_reviews from public,anon,authenticated,service_role;
create unique index neutral_reply_committed_rfc on event_private.neutral_reply_reviews(account_id,reply_message_id) where state='committed';
create unique index neutral_reply_committed_provider on event_private.neutral_reply_reviews(account_id,provider_id) where state='committed';

create function event_private.neutral_reply_context(target_send uuid,actor uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare k event_private.neutral_email_pilot_case;r event_private.smtp_pilot_receipts;b public.event_outbox;p public.propostas;c event_private.mailbox_oauth_connection;u auth.users;fingerprint text;
begin
 perform event_private.require_mailbox_oauth_off();
 select * into k from event_private.neutral_email_pilot_case where pilot_key='QA-COM-EMAIL-01';
 select * into c from event_private.mailbox_oauth_connection where singleton;
 select * into u from auth.users where id=actor;
 if k.owner_id is distinct from actor or c.owner_id is distinct from actor or c.mailbox is distinct from 'eventos@embaixadacarioca.com.br' or u.email_confirmed_at is null then raise exception 'neutral_reply_owner_changed';end if;
 select * into r from event_private.smtp_pilot_receipts where send_id=target_send;
 select * into p from public.propostas where id=k.proposal_id for update;
 perform 1 from public.oportunidades where id=k.opportunity_id for update;
 select * into b from public.event_outbox where id=target_send for update;
 if r.state is distinct from 'accepted' or r.actor_id is distinct from actor or r.proposal_id is distinct from k.proposal_id or r.account_id is distinct from c.account_id or r.send_attempt<>1 or r.proposal_revision<>1 or r.finished_at is null
 or b.status is distinct from 'accepted' or b.channel is distinct from 'email' or b.attempts<>1 or b.proposal_id is distinct from p.id or b.opportunity_id is distinct from k.opportunity_id or lower(trim(b.destination)) is distinct from lower(u.email)
 or p.id is null or p.revision<>1 or p.is_current is distinct from true or p.oportunidade_id is distinct from k.opportunity_id or p.total is distinct from 0 or lower(p.cliente_email) is distinct from lower(u.email) or p.subtotal is distinct from 0 or p.taxa_servico is distinct from 0 or p.privatizacao is distinct from 0 or p.snapshot#>'{totals,total}' is distinct from '0'::jsonb or p.snapshot->'selectedItems' is distinct from '[]'::jsonb
 or p.snapshot#>>'{communicationTest,id}' is distinct from 'QA-COM-EMAIL-01' or p.snapshot#>'{communicationTest,neutral}' is distinct from 'true'::jsonb
 or (select count(*) from public.event_outbox where proposal_id=p.id and channel='email')<>1 then raise exception 'neutral_reply_context_changed';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('proposal',to_jsonb(p),'outbox',to_jsonb(b),'smtp_evidence',r.evidence_sha256,'account',c.account_id,'owner',actor)::text,'UTF8')),'hex');
 return jsonb_build_object('ownerVerified',true,'captureDisabled',true,'pilot','QA-COM-EMAIL-01','accountId',c.account_id,'sendId',b.id,'proposalId',p.id,'revision',1,'attempt',1,'recipient',lower(u.email),'smtpFinishedAt',floor(extract(epoch from r.finished_at)*1000)::bigint,'contextSha256',fingerprint);
end $$;
revoke all on function event_private.neutral_reply_context(uuid,uuid) from public,anon,authenticated,service_role;

create function public.event_neutral_reply_begin(target_send uuid,delivered_id text,reply_id text,provider_evidence_sha256 text,provider_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare ctx jsonb;v event_private.neutral_reply_reviews;started timestamptz:=clock_timestamp();
begin
 perform event_private.require_mailbox_oauth_owner();
 if provider_reviewed is distinct from true or provider_evidence_sha256 is null or provider_evidence_sha256 !~ '^[0-9a-f]{64}$' or delivered_id is null or reply_id is null or delivered_id !~ '^<[^<>[:space:]@]+@[^<>[:space:]@]+>$' or reply_id !~ '^<[^<>[:space:]@]+@[^<>[:space:]@]+>$' or greatest(length(delivered_id),length(reply_id))>300 or delivered_id=reply_id then raise exception 'neutral_reply_review_required';end if;
 ctx:=event_private.neutral_reply_context(target_send,auth.uid());
 insert into event_private.neutral_reply_reviews(owner_id,send_id,proposal_id,account_id,proposal_revision,send_attempt,delivered_message_id,reply_message_id,provider_evidence_sha256,context_sha256,created_at,expires_at)
 values(auth.uid(),target_send,(ctx->>'proposalId')::uuid,ctx->>'accountId',1,1,delivered_id,reply_id,$4,ctx->>'contextSha256',started,started+interval '5 minutes') returning * into v;
 return jsonb_build_object('reviewId',v.id,'state',v.state,'expiresAt',v.expires_at,'provenance',v.provenance,'captureActive',false);
end $$;
revoke all on function public.event_neutral_reply_begin(uuid,text,text,text,boolean) from public,anon,service_role;
grant execute on function public.event_neutral_reply_begin(uuid,text,text,text,boolean) to authenticated;

create function public.event_neutral_reply_worker_context(target_review uuid,actor uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare v event_private.neutral_reply_reviews;ctx jsonb;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'neutral_reply_worker_required';end if;
 select * into v from event_private.neutral_reply_reviews where id=target_review;
 if v.owner_id is distinct from actor or v.state not in ('authorized','prepared') or v.expires_at<=clock_timestamp() then raise exception 'neutral_reply_review_expired';end if;
 ctx:=event_private.neutral_reply_context(v.send_id,actor);
 if ctx->>'contextSha256' is distinct from v.context_sha256 then raise exception 'neutral_reply_context_changed';end if;
 return (ctx-'contextSha256')||jsonb_build_object('authorizedAt',floor(extract(epoch from v.created_at)*1000)::bigint,'expiresAt',floor(extract(epoch from v.expires_at)*1000)::bigint,'deliveredMessageId',v.delivered_message_id,'replyMessageId',v.reply_message_id,'provenance',v.provenance);
end $$;
revoke all on function public.event_neutral_reply_worker_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.event_neutral_reply_worker_context(uuid,uuid) to service_role;

create function public.event_neutral_reply_store_preview(target_review uuid,actor uuid,verified_reply jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare v event_private.neutral_reply_reviews;ctx jsonb;digest text;item jsonb;received bigint;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'neutral_reply_worker_required';end if;
 ctx:=public.event_neutral_reply_worker_context(target_review,actor);
 select * into v from event_private.neutral_reply_reviews where id=target_review for update;
 -- A commit may have completed while worker_context waited for the config lock.
 -- Never downgrade committed/duplicate audit state with a delayed preview.
 if v.owner_id is distinct from actor or coalesce(v.state,'') not in ('authorized','prepared') or v.expires_at<=clock_timestamp() then raise exception 'neutral_reply_review_unavailable';end if;
 if verified_reply is null or jsonb_typeof(verified_reply)<>'object' or verified_reply->>'state' is distinct from 'prepared' or verified_reply->>'provenance' is distinct from v.provenance
 or verified_reply->>'accountId' is distinct from v.account_id or verified_reply->>'sendId' is distinct from v.send_id::text or verified_reply->>'proposalId' is distinct from v.proposal_id::text
 or verified_reply->'revision' is distinct from '1'::jsonb or verified_reply->'attempt' is distinct from '1'::jsonb or verified_reply->>'inboundMessageId' is distinct from v.reply_message_id or verified_reply->>'deliveredMessageId' is distinct from v.delivered_message_id
 or verified_reply->>'sender' is distinct from ctx->>'recipient' or verified_reply->'contentRead' is distinct from 'true'::jsonb or verified_reply->'messageSent' is distinct from 'false'::jsonb or verified_reply->'captureActivated' is distinct from 'false'::jsonb or verified_reply->'persisted' is distinct from 'false'::jsonb
 or coalesce(verified_reply->>'providerId','') !~ '^[0-9]{1,40}$' or coalesce(verified_reply->>'folderId','') !~ '^[0-9]{1,40}$' or jsonb_typeof(verified_reply->'body') is distinct from 'string' or length(verified_reply->>'body') not between 1 and 6000 or coalesce(verified_reply->>'receivedAt','') !~ '^[0-9]{13}$' then raise exception 'neutral_reply_preview_invalid';end if;
 received:=(verified_reply->>'receivedAt')::bigint;
 if received<(ctx->>'smtpFinishedAt')::bigint or received>floor(extract(epoch from clock_timestamp())*1000)::bigint then raise exception 'neutral_reply_preview_invalid';end if;
 item:=jsonb_build_object('accountId',v.account_id,'sendId',v.send_id,'proposalId',v.proposal_id,'revision',1,'attempt',1,'providerId',verified_reply->>'providerId','inboundMessageId',v.reply_message_id,'deliveredMessageId',v.delivered_message_id,'sender',verified_reply->>'sender','body',verified_reply->>'body','receivedAt',received,'provenance',v.provenance,'providerEvidenceSha256',v.provider_evidence_sha256);
 digest:=encode(sha256(convert_to(item::text,'UTF8')),'hex');
 if v.state='prepared' and v.preview_sha256 is distinct from digest then raise exception 'neutral_reply_preview_conflict';end if;
 if v.expires_at<=clock_timestamp() then raise exception 'neutral_reply_review_expired';end if;
 update event_private.neutral_reply_reviews set state='prepared',provider_id=item->>'providerId',preview=item,preview_sha256=digest where id=v.id;
 return jsonb_build_object('reviewId',v.id,'state','prepared','previewSha256',digest,'expiresAt',v.expires_at,'proposalId',v.proposal_id,'revision',1,'body',item->>'body','provenance',v.provenance,'captureActive',false);
end $$;
revoke all on function public.event_neutral_reply_store_preview(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.event_neutral_reply_store_preview(uuid,uuid,jsonb) to service_role;

create function public.event_neutral_reply_commit(target_review uuid,reviewed_sha256 text,confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare v event_private.neutral_reply_reviews;prior event_private.neutral_reply_reviews;ctx jsonb;m uuid;body_digest text;
begin
 perform event_private.require_mailbox_oauth_owner();
 perform event_private.require_mailbox_oauth_off();
 perform pg_advisory_xact_lock(716614);
 select * into v from event_private.neutral_reply_reviews where id=target_review for update;
 if v.owner_id is distinct from auth.uid() or confirmed is distinct from true or v.preview_sha256 is null or v.preview_sha256 is distinct from reviewed_sha256 then raise exception 'neutral_reply_confirmation_required';end if;
 ctx:=event_private.neutral_reply_context(v.send_id,auth.uid());
 if ctx->>'contextSha256' is distinct from v.context_sha256 then raise exception 'neutral_reply_context_changed';end if;
 if v.state in ('committed','duplicate') then
  if not exists(select 1 from public.event_messages where id=v.message_id and proposal_id=v.proposal_id and proposal_revision=1 and direction='inbound' and body=v.preview->>'body') then raise exception 'neutral_reply_readback_changed';end if;
  return jsonb_build_object('state','committed','messageId',v.message_id,'proposalId',v.proposal_id,'revision',1,'duplicate',true,'captureActive',false);
 end if;
 if v.state<>'prepared' or v.expires_at<=clock_timestamp() then raise exception 'neutral_reply_review_expired';end if;
 select * into prior from event_private.neutral_reply_reviews where state='committed' and account_id=v.account_id and (reply_message_id=v.reply_message_id or provider_id=v.provider_id);
 if found then
  if prior.send_id<>v.send_id or prior.reply_message_id<>v.reply_message_id or prior.provider_id<>v.provider_id or prior.preview is distinct from v.preview then raise exception 'neutral_reply_duplicate_conflict';end if;
  if not exists(select 1 from public.event_messages where id=prior.message_id and body=v.preview->>'body') then raise exception 'neutral_reply_readback_changed';end if;
  update event_private.neutral_reply_reviews set state='duplicate',message_id=prior.message_id,committed_at=clock_timestamp() where id=v.id;
  return jsonb_build_object('state','committed','messageId',prior.message_id,'proposalId',v.proposal_id,'revision',1,'duplicate',true,'captureActive',false);
 end if;
 if exists(select 1 from event_private.mailbox_bound_receipts where account_id=v.account_id and (provider_id=v.provider_id or inbound_message_id=v.reply_message_id)) then raise exception 'neutral_reply_already_observed';end if;
 if exists(select 1 from event_private.mailbox_seen where account_id=v.account_id and provider_id=v.provider_id)
 or exists(select 1 from public.event_messages where channel='email' and external_id='mailbox:'||v.account_id||':'||v.reply_message_id) then raise exception 'neutral_reply_already_observed';end if;
 insert into public.event_messages(opportunity_id,proposal_id,proposal_revision,channel,direction,source,body,occurred_at,created_by,external_id)
 select b.opportunity_id,v.proposal_id,1,'email','inbound','manual',v.preview->>'body',to_timestamp((v.preview->>'receivedAt')::numeric/1000),auth.uid(),'mailbox:'||v.account_id||':'||v.reply_message_id from public.event_outbox b where b.id=v.send_id returning id into m;
 if m is null or v.expires_at<=clock_timestamp() then raise exception 'neutral_reply_commit_unconfirmed';end if;
 body_digest:=encode(sha256(convert_to(v.preview->>'body','UTF8')),'hex');
 insert into event_private.mailbox_bound_receipts(account_id,provider_id,state,reason,send_id,send_attempt,proposal_id,proposal_revision,inbound_message_id,sender,evidence_sha256,outbound_message_id,body_sha256,message_id)
 values(v.account_id,v.provider_id,'prepared',v.provenance,v.send_id,1,v.proposal_id,1,v.reply_message_id,v.preview->>'sender',v.preview_sha256,v.delivered_message_id,body_digest,m);
 insert into event_private.mailbox_seen(account_id,provider_id,received_at_ms)values(v.account_id,v.provider_id,(v.preview->>'receivedAt')::bigint);
 update event_private.neutral_reply_reviews set state='committed',message_id=m,committed_at=clock_timestamp() where id=v.id;
 -- Preserve original sender headers; no lower-provenance alias is added to general sync.
 return jsonb_build_object('state','committed','messageId',m,'proposalId',v.proposal_id,'revision',1,'duplicate',false,'captureActive',false);
end $$;
revoke all on function public.event_neutral_reply_commit(uuid,text,boolean) from public,anon,service_role;
grant execute on function public.event_neutral_reply_commit(uuid,text,boolean) to authenticated;

create function public.event_neutral_reply_status(target_review uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare v event_private.neutral_reply_reviews;active boolean;
begin
 perform event_private.require_mailbox_oauth_owner();
 select * into v from event_private.neutral_reply_reviews where id=target_review;
 if v.owner_id is distinct from auth.uid() or not exists(select 1 from event_private.mailbox_oauth_connection where singleton and owner_id=auth.uid() and account_id=v.account_id and mailbox='eventos@embaixadacarioca.com.br') then raise exception 'neutral_reply_owner_changed';end if;
 if v.state in ('committed','duplicate') and not exists(select 1 from public.event_messages where id=v.message_id and proposal_id=v.proposal_id and proposal_revision=1 and direction='inbound' and body=v.preview->>'body') then raise exception 'neutral_reply_readback_changed';end if;
 select s.enabled or c.enabled or coalesce(cardinality(s.capture_send_ids),0)>0 or s.capture_started_at is not null or s.capture_expires_at is not null into active from event_private.mailbox_sync_state s cross join event_private.channel_credentials c where s.singleton and c.provider='mailbox';
 if active is null then raise exception 'neutral_reply_configuration_missing';end if;
 return jsonb_strip_nulls(jsonb_build_object('reviewId',v.id,'state',case when v.state in ('committed','duplicate') then 'committed' when v.expires_at<=clock_timestamp() then 'expired' else v.state end,'duplicate',v.state='duplicate','previewSha256',v.preview_sha256,'expiresAt',v.expires_at,'messageId',v.message_id,'proposalId',v.proposal_id,'revision',1,'body',v.preview->>'body','provenance',v.provenance,'captureActive',active));
end $$;
revoke all on function public.event_neutral_reply_status(uuid) from public,anon,service_role;
grant execute on function public.event_neutral_reply_status(uuid) to authenticated;
