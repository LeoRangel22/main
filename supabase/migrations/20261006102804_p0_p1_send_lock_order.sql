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
    if send_status='accepted' then
      update public.propostas set snapshot=case when nullif(snapshot#>>'{event,signalDeadlineAt}','') is null then jsonb_set(coalesce(snapshot,'{}'),'{event}',coalesce(snapshot->'event','{}')||jsonb_build_object('signalDeadlineAt',now()+make_interval(hours=>coalesce((snapshot#>>'{event,signalDeadlineHours}')::integer,48)))) else snapshot end,publication_status='sent',sent_at=coalesce(sent_at,now()),status=case when status='proposta_pronta' then 'proposta_enviada' else status end where id=b.proposal_id;
      update public.oportunidades set ultimo_contato_em=now(),metadata=coalesce(metadata,'{}')||case when metadata->>'first_reply_sent_at' is null then jsonb_build_object('first_reply_sent_at',now(),'first_reply_channel',b.channel,'first_reply_source','provider_accepted') else '{}'::jsonb end where id=b.opportunity_id;
    end if;
  end if;
end; $$;
