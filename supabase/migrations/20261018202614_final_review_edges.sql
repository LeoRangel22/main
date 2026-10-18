-- Close the final review without changing any customer's agreement or payment.
-- Unknown deposit terms are not authority to solicit an unspecified payment.
create or replace function event_private.public_payment_summary(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 r:=event_private.operation_readiness(p);
 return jsonb_build_object('signalAudited',r->'signal_audited','reservationAudited',r->'reservation_audited',
  'paidAmount',r->'paid_audited','balanceDue',r->'balance_due',
  'depositDueAmount',case when (r->>'signal_audited')::boolean then 0
    when event_private.deposit_fraction(p)>=0.5 then round(p.total*event_private.deposit_fraction(p),2) end,
  'depositApprovalRequired',not (r->>'signal_audited')::boolean and coalesce(event_private.deposit_fraction(p)<0.5,true),
  'paymentReviewRequired',event_private.payment_review_required(p));
end; $$;
revoke all on function event_private.public_payment_summary(public.propostas) from public,anon,authenticated;

-- A previously-sent legacy proposal can acquire its first real preparation
-- evidence on a later provider-accepted send, even without a status transition.
-- The actual provider message is recorded before finish_event_send updates the
-- proposal; this hook sees that evidence without changing the send workflow.
create or replace function event_private.capture_proposal_preparation() returns trigger
language plpgsql security definer set search_path='' as $$
declare observation record; changed boolean;
begin
 if new.oportunidade_id is null or coalesce(new.publication_status,'') not in ('ready','sent')
   or new.snapshot ? 'amendmentOf' or new.snapshot ? 'appliedAmendment' then return new; end if;
 if exists(select 1 from event_private.proposal_preparation_evidence where proposal_id=new.id) then return new;end if;
 select b.id as send_id,m.occurred_at into observation
 from public.event_outbox b join public.event_messages m on m.proposal_id=new.id and m.opportunity_id=new.oportunidade_id
  and m.channel=b.channel and m.external_id='send:'||b.id::text
 where b.proposal_id=new.id and b.opportunity_id=new.oportunidade_id and b.status='accepted'
  and nullif(trim(b.provider_id),'') is not null and m.source='provider' and m.direction='outbound'
  and m.delivery_status in ('accepted','delivered','read')
  and m.occurred_at>=greatest(new.created_at,b.created_at) and m.occurred_at<=statement_timestamp()
 order by m.occurred_at,b.id limit 1;
 if found then
  insert into event_private.proposal_preparation_evidence(proposal_id,opportunity_id,observed_at,source,source_id)
  values(new.id,new.oportunidade_id,observation.occurred_at,'accepted_send',observation.send_id)
  on conflict(proposal_id) do nothing;
 else
  changed:=tg_op='INSERT';
  if tg_op='UPDATE' then changed:=new.publication_status is distinct from old.publication_status;end if;
  if changed then
   insert into event_private.proposal_preparation_evidence(proposal_id,opportunity_id,observed_at,source)
   values(new.id,new.oportunidade_id,statement_timestamp(),'publication_transition')
   on conflict(proposal_id) do nothing;
  end if;
 end if;
 return new;
end; $$;
revoke all on function event_private.capture_proposal_preparation() from public,anon,authenticated,service_role;
