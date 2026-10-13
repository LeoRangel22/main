-- Restore explicit retries without allowing duplicate or uncertain sends.
create or replace function public.begin_event_approved_send(target_approval uuid,reviewed_revision bigint,send_channel text,send_destination text,send_body text,send_title text,content_hash text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.event_proposal_approvals; p public.propostas; c event_private.proposal_approval_policy; pid uuid; result jsonb; prior_send public.event_outbox;
begin
 perform event_private.require_team(); select * into c from event_private.proposal_approval_policy where id;
 if not c.enabled or auth.uid() is distinct from c.approver_id or not public.is_super_admin() then raise exception 'Envio exige o gestor designado'; end if;
 select proposal_id into pid from public.event_proposal_approvals where id=target_approval;
 select * into p from public.propostas where id=pid for update;
 perform 1 from public.oportunidades where id=p.oportunidade_id for update;
 select * into a from public.event_proposal_approvals where id=target_approval for update;
 if a.status is distinct from 'approved' or a.decided_by is distinct from auth.uid() or a.approver_id is distinct from c.approver_id then raise exception 'Aprovação do gestor ausente'; end if;
 if a.content->>'channel' is distinct from send_channel or a.content->>'destination' is distinct from send_destination or a.content->>'body' is distinct from send_body or a.content->>'title' is distinct from send_title or a.content->>'contentHash' is distinct from content_hash or (a.content->>'reviewedResponseAt')::timestamptz is distinct from reviewed_response_at then raise exception 'Mensagem, destinatário ou prévia divergente da aprovação'; end if;
 if a.send_id is not null then
  select * into prior_send from public.event_outbox where id=a.send_id for update;
  -- Only an explicit manager retry after a definite rejection can claim again.
  if prior_send.status is distinct from 'failed' or prior_send.delivery_status in ('delivered','read') then
   return jsonb_build_object('claimed',false,'send',to_jsonb(prior_send));
  end if;
 end if;
 if a.expires_at<=now() or p.revision is distinct from a.revision or p.revision is distinct from reviewed_revision or event_private.proposal_fingerprint(p) is distinct from a.proposal_fingerprint then raise exception using errcode='PT409',message='A versão aprovada mudou ou expirou'; end if;
 result:=public.begin_event_send(p.id,send_channel,send_destination,send_body,send_title,reviewed_response_at);
 update public.event_proposal_approvals set send_id=(result#>>'{send,id}')::uuid where id=a.id;
 insert into public.event_approval_audit(approval_id,action,actor_id) values(a.id,'dispatch_claimed',auth.uid());
 return result;
end; $$;
revoke all on function public.begin_event_approved_send(uuid,bigint,text,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.begin_event_approved_send(uuid,bigint,text,text,text,text,text,timestamptz) to authenticated;

