-- Defer replies to known unresolved transports. No activation, aliases, data updates or scheduling.
-- CREATE OR REPLACE preserves the existing service-only resolver identity and ACL.
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

