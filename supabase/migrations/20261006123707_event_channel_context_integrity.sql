-- Preserve newer channel context; never retry proven delivery.
CREATE OR REPLACE FUNCTION public.sync_opportunity_from_proposal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    owner_changed := new.responsavel_email is distinct from old.responsavel_email;
  end if;
  if new.oportunidade_id is null or not coalesce(new.is_current, true) then
    return new;
  end if;

  update public.oportunidades o
  set
    status = case when new.status = 'cancelado' then 'perdido' else new.status end,
    cliente_nome = new.cliente_nome,
    cliente_email = new.cliente_email,
    cliente_whatsapp = new.cliente_whatsapp,
    tipo_evento = new.tipo_evento,
    data_evento = new.data_evento,
    horario_evento = new.horario_evento,
    convidados = new.convidados,
    valor_atual = coalesce(new.total, 0),
    responsavel_id = case
      when nullif(trim(o.responsavel_email), '') is null or (owner_changed and nullif(trim(new.responsavel_email), '') is not null)
        then new.responsavel_id else o.responsavel_id end,
    responsavel_email = case
      when nullif(trim(o.responsavel_email), '') is null or (owner_changed and nullif(trim(new.responsavel_email), '') is not null)
        then coalesce(nullif(trim(new.responsavel_email), ''), o.responsavel_email) else o.responsavel_email end,
    ultima_resposta_cliente_em = greatest(new.cliente_resposta_em, ultima_resposta_cliente_em),
    ganho_em = case
      when new.status in ('confirmado','pagamento_final','planejamento','evento_proximo','pos_venda')
        then coalesce(ganho_em, now())
      else ganho_em
    end,
    motivo_perda = case
      when new.status = 'cancelado'
        then coalesce(nullif(new.snapshot #>> '{cancelamento,motivo}', ''), motivo_perda, 'Cancelado')
      else null
    end,
    perdido_em = case
      when new.status = 'cancelado' then coalesce(perdido_em, now())
      else null
    end
  where id = new.oportunidade_id;

  return new;
end;
$function$;

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
  if b.status='failed' and coalesce(b.delivery_status,'failed') not in ('delivered','read') then
    update public.event_outbox set status='sending',provider_id=null,provider_reference=null,delivery_status=null,delivery_updated_at=null,delivery_checked_at=null,engagement=null,attempts=attempts+1,approved_by=auth.uid(),updated_at=now() where id=b.id returning * into b;
    return jsonb_build_object('claimed',true,'send',to_jsonb(b));
  end if;
  return jsonb_build_object('claimed',false,'send',to_jsonb(b));
end; $$;
revoke all on function public.begin_event_send(uuid,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.begin_event_send(uuid,text,text,text,text,timestamptz) to authenticated;

