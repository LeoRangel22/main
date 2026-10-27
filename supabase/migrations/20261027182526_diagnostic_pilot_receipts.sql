-- Candidate only: no send grant, channel enablement, scheduler or Bot change.
create table event_private.whatsapp_pilot_receipts (
 pilot_id uuid not null references event_private.whatsapp_pilots(id),
 event_key text not null check(length(event_key) between 1 and 500),
 kind text not null check(kind in ('status','inbound')),
 message_id text not null check(length(message_id) between 1 and 500),
 reply_to_id text,
 signal text,
 occurred_at timestamptz not null,
 captured_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 primary key(pilot_id,event_key),
 check((kind='status' and signal in ('accepted','delivered','read') and reply_to_id is null)
    or (kind='inbound' and signal is null and reply_to_id is not null))
);
alter table event_private.whatsapp_pilot_receipts enable row level security;
revoke all on event_private.whatsapp_pilot_receipts from public,anon,authenticated,service_role;

create function public.reconcile_event_whatsapp_pilot(target_pilot uuid,receipt_events jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p event_private.whatsapp_pilots; v jsonb; previous event_private.whatsapp_pilot_receipts; n integer:=0;
begin
 -- The immutable send row is the shared per-pilot lock. A failed page rolls
 -- back every receipt. This function never changes a send row or its gates.
 select * into p from event_private.whatsapp_pilots where id=target_pilot for update;
 if not found or p.status<>'accepted' or p.attempts<>1 or p.network_attempted is not true or p.provider_id is null then
  raise exception using errcode='PT409',message='Confirmed pilot required';
 end if;
 if jsonb_typeof(receipt_events) is distinct from 'array' or jsonb_array_length(receipt_events)>100 then
  raise exception using errcode='22023',message='Invalid diagnostic receipt page';
 end if;
 for v in select value from jsonb_array_elements(receipt_events) loop
  if jsonb_typeof(v) is distinct from 'object'
   or (v-array['key','kind','message_id','reply_to_id','destination','body','signal','occurred_at','captured_at'])<>'{}'::jsonb
   or coalesce(v->>'kind','') not in ('status','inbound')
   or length(coalesce(v->>'key','')) not between 1 and 500 or coalesce(v->>'key','') !~ '^[A-Za-z0-9_.:-]+$'
   or length(coalesce(v->>'message_id','')) not between 1 and 500 or coalesce(v->>'message_id','') !~ '^[A-Za-z0-9_.:-]+$'
   or v->>'destination' is distinct from p.destination
   or nullif(v->>'occurred_at','') is null or not isfinite((v->>'occurred_at')::timestamptz)
   or nullif(v->>'captured_at','') is null or not isfinite((v->>'captured_at')::timestamptz)
   or (v->>'occurred_at')::timestamptz<p.claimed_at-interval '5 minutes'
   or (v->>'occurred_at')::timestamptz>now()+interval '5 minutes'
   or (v->>'captured_at')::timestamptz>now()+interval '5 minutes'
   or (v->>'captured_at')::timestamptz<(v->>'occurred_at')::timestamptz-interval '5 minutes'
   or (v->>'kind'='status' and (v->>'message_id' is distinct from p.provider_id or coalesce(v->>'signal','') not in ('accepted','delivered','read') or v->>'body' is not null or v->>'reply_to_id' is not null))
   or (v->>'kind'='inbound' and (v->>'reply_to_id' is distinct from p.provider_id or v->>'body' is distinct from 'TESTE RECEBIDO' or v->>'signal' is not null)) then
   raise exception using errcode='22023',message='Invalid diagnostic receipt correlation';
  end if;
  select * into previous from event_private.whatsapp_pilot_receipts where pilot_id=p.id and event_key=v->>'key';
  if found then
   -- captured_at may differ on a later read of the same immutable callback.
   if (previous.kind,previous.message_id,previous.reply_to_id,previous.signal,previous.occurred_at)
    is distinct from (v->>'kind',v->>'message_id',v->>'reply_to_id',v->>'signal',(v->>'occurred_at')::timestamptz) then
    raise exception using errcode='PT409',message='Conflicting diagnostic receipt';
   end if;
   continue;
  end if;
  insert into event_private.whatsapp_pilot_receipts(pilot_id,event_key,kind,message_id,reply_to_id,signal,occurred_at,captured_at)
   values(p.id,v->>'key',v->>'kind',v->>'message_id',v->>'reply_to_id',v->>'signal',(v->>'occurred_at')::timestamptz,(v->>'captured_at')::timestamptz);
  n:=n+1;
 end loop;
 return jsonb_build_object('pilotId',p.id,'inserted',n,'sendStatus',p.status,'attempts',p.attempts);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
 -- Do not return a raw malformed timestamp/value supplied by an upstream
 -- adapter. The exception subtransaction also rolls back the entire page.
 raise exception using errcode='22023',message='Invalid diagnostic receipt value';
end; $$;
revoke all on function public.reconcile_event_whatsapp_pilot(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_event_whatsapp_pilot(uuid,jsonb) to service_role;

create function public.get_event_whatsapp_pilot_receipt(target_pilot uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p event_private.whatsapp_pilots; result jsonb;
begin
 p:=event_private.owned_whatsapp_pilot(target_pilot);
 select jsonb_build_object('pilotId',p.id,'sendStatus',p.status,'attempts',p.attempts,
  'deliveredAt',min(occurred_at) filter(where kind='status' and signal='delivered'),
  'readAt',min(occurred_at) filter(where kind='status' and signal='read'),
  'replyAt',min(occurred_at) filter(where kind='inbound'),
  'deliveryConfirmed',coalesce(bool_or(kind='status' and signal in ('delivered','read')),false),
  'replyConfirmed',coalesce(bool_or(kind='inbound'),false),
  'replyImpliesReceipt',coalesce(bool_or(kind='inbound'),false)) into result
 from event_private.whatsapp_pilot_receipts where pilot_id=p.id;
 return result;
end; $$;
revoke all on function public.get_event_whatsapp_pilot_receipt(uuid) from public,anon,service_role;
grant execute on function public.get_event_whatsapp_pilot_receipt(uuid) to authenticated;
