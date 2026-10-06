-- Contexto de resposta vinculado à revisão humana.
-- A assinatura antiga permanece privada para compatibilidade de migração.
revoke all on function public.begin_event_send(uuid,text,text,text,text) from public,anon,authenticated;
create or replace function public.begin_event_send(target_proposal uuid,send_channel text,send_destination text,send_body text,send_title text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas; b public.event_outbox; fp text; response_at timestamptz;
begin
  perform event_private.require_team();
  select * into p from public.propostas where id=target_proposal for update;
  if not found then raise exception 'Proposta não encontrada'; end if;
  if not coalesce(p.is_current,false) or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Envio exige versão atual e evento em aberto'; end if;
  if length(trim(send_body)) not between 1 and 12000 or length(trim(send_destination)) not between 5 and 320 then raise exception 'Confira mensagem e destinatário'; end if;
  if p.oportunidade_id is null then raise exception 'Salve a proposta e vincule a oportunidade antes de enviar'; end if;
  select ultima_resposta_cliente_em into response_at from public.oportunidades where id=p.oportunidade_id for update;
  if response_at is distinct from reviewed_response_at then raise exception 'Há resposta nova. Atualize e revise antes de enviar'; end if;
  perform event_private.assert_money(p);
  perform event_private.check_discount(p);
  fp:=encode(extensions.digest(event_private.proposal_fingerprint(p)||'|'||send_channel||'|'||lower(trim(send_destination))||'|'||send_body||'|'||send_title,'sha256'),'hex');
  insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,approved_by)
    values(p.id,p.oportunidade_id,fp,send_channel,trim(send_destination),send_body,auth.uid()) on conflict(fingerprint) do nothing returning * into b;
  if b.id is not null then return jsonb_build_object('claimed',true,'send',to_jsonb(b)); end if;
  select * into b from public.event_outbox where fingerprint=fp for update;
  if b.status='failed' then
    update public.event_outbox set status='sending',attempts=attempts+1,approved_by=auth.uid(),updated_at=now() where id=b.id returning * into b;
    return jsonb_build_object('claimed',true,'send',to_jsonb(b));
  end if;
  return jsonb_build_object('claimed',false,'send',to_jsonb(b));
end; $$;
revoke all on function public.begin_event_send(uuid,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.begin_event_send(uuid,text,text,text,text,timestamptz) to authenticated;

-- Ordem de bloqueios consistente: proposta antes da oportunidade.
create or replace function public.finish_event_send(send_id uuid,send_status text,external_message_id text default null,error_detail text default null) returns void language plpgsql security definer set search_path='' as $$
declare b public.event_outbox;
begin
  if send_status not in ('accepted','failed','uncertain') then raise exception 'Estado de envio inválido'; end if;
  update public.event_outbox set status=send_status,provider_id=external_message_id,detail=left(error_detail,1000),updated_at=now() where id=send_id and status='sending' returning * into b;
  if b.id is null then return; end if;
  if b.opportunity_id is not null then
    insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by,delivery_status,external_id)
      values(b.opportunity_id,b.proposal_id,b.channel,'outbound','provider',left(b.body,6000),b.approved_by,send_status,'send:'||b.id::text) on conflict(channel,external_id) where external_id is not null do nothing;
    if send_status='accepted' then
      update public.propostas set publication_status='sent',sent_at=coalesce(sent_at,now()),status=case when status='proposta_pronta' then 'proposta_enviada' else status end where id=b.proposal_id;
      update public.oportunidades set ultimo_contato_em=now(),metadata=coalesce(metadata,'{}')||case when metadata->>'first_reply_sent_at' is null then jsonb_build_object('first_reply_sent_at',now(),'first_reply_channel',b.channel,'first_reply_source','provider_accepted') else '{}'::jsonb end where id=b.opportunity_id;
    end if;
  end if;
end; $$;
