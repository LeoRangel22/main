-- Contexto de resposta vinculado à revisão humana.
drop function public.begin_event_send(uuid,text,text,text,text);
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
