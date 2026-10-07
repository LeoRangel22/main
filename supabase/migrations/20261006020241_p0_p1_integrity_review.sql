-- Revisão de integridade: preço coerente, aprovação vinculada e reserva protegida.
create or replace function event_private.assert_money(p public.propostas) returns void language plpgsql set search_path='' as $$
begin
  if p.subtotal<0 or p.taxa_servico<0 or p.privatizacao<0 or p.total<0 or abs(coalesce(p.total,0)-greatest(0,coalesce(p.subtotal,0)+coalesce(p.taxa_servico,0)+coalesce(p.privatizacao,0)+coalesce((p.snapshot#>>'{totals,adjustment}')::numeric,0)))>0.02 then
    raise exception 'Totais divergentes. Revise valores e salve uma nova versão antes de enviar ou reservar';
  end if;
end; $$;
revoke all on function event_private.assert_money(public.propostas) from public,anon,authenticated;
create or replace function public.get_event_discount_approvals() returns table(proposal_id uuid,approved_email text,approved_at timestamptz,valid boolean) language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  return query select a.proposal_id,a.approved_email,a.approved_at,a.fingerprint=event_private.proposal_fingerprint(p) from public.event_discount_approvals a join public.propostas p on p.id=a.proposal_id;
end; $$;
revoke all on function public.get_event_discount_approvals() from public,anon;
grant execute on function public.get_event_discount_approvals() to authenticated;
create or replace function event_private.proposal_fingerprint(p public.propostas) returns text language sql immutable set search_path='' as $$
  select encode(extensions.digest(jsonb_build_object('id',p.id,'version',p.versao,'client',p.snapshot->'client','event',(p.snapshot->'event')-'signalDeadlineAt','items',p.snapshot->'selectedItems','totals',p.snapshot->'totals','terms',p.snapshot->'generalTerms','offers',p.snapshot->'publicOfferOptions','date',p.data_evento,'time',p.horario_evento,'guests',p.convidados,'duration',p.duracao,'total',p.total)::text,'sha256'),'hex');
$$;

create or replace function public.begin_event_send(target_proposal uuid,send_channel text,send_destination text,send_body text,send_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas; b public.event_outbox; fp text;
begin
  perform event_private.require_team();
  select * into p from public.propostas where id=target_proposal for update;
  if not found then raise exception 'Proposta não encontrada'; end if;
  if not coalesce(p.is_current,false) or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Envio exige versão atual e evento em aberto'; end if;
  if length(trim(send_body)) not between 1 and 12000 or length(trim(send_destination)) not between 5 and 320 then raise exception 'Confira mensagem e destinatário'; end if;
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
      update public.oportunidades set ultimo_contato_em=now(),metadata=coalesce(metadata,'{}')||case when metadata->>'first_reply_sent_at' is null then jsonb_build_object('first_reply_sent_at',now(),'first_reply_channel',b.channel,'first_reply_source','provider_accepted') else '{}'::jsonb end where id=b.opportunity_id;
      update public.propostas set snapshot=case when nullif(snapshot#>>'{event,signalDeadlineAt}','') is null then jsonb_set(coalesce(snapshot,'{}'),'{event}',coalesce(snapshot->'event','{}')||jsonb_build_object('signalDeadlineAt',now()+make_interval(hours=>coalesce((snapshot#>>'{event,signalDeadlineHours}')::integer,48)))) else snapshot end,publication_status='sent',sent_at=coalesce(sent_at,now()),status=case when status='proposta_pronta' then 'proposta_enviada' else status end where id=b.proposal_id;
    end if;
  end if;
end; $$;

create or replace function event_private.reserve_proposal(p public.propostas,reserve_status text,hold_until timestamptz) returns public.event_reservations language plpgsql security definer set search_path='' as $$
declare r public.event_reservations; cap integer; start_at timestamptz; end_at timestamptz; used integer; conflict boolean; exclusive_event boolean;
begin
  perform pg_advisory_xact_lock(71938501);
  select capacity into cap from public.event_commercial_policy where id;
  if cap is null then raise exception 'Configure a capacidade autorizada na Central comercial antes de reservar'; end if;
  if p.oportunidade_id is null or p.data_evento is null or p.horario_evento is null or p.convidados is null or p.convidados<1 or coalesce(p.duracao,0)<=0 or p.duracao>24 then raise exception 'Informe data, horário, duração e convidados antes de reservar'; end if;
  if p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Pré-reserva somente para evento futuro'; end if;
  if reserve_status='held' and (hold_until is null or hold_until<=now() or hold_until>now()+interval '30 days') then raise exception 'Informe uma validade futura de até 30 dias'; end if;
  start_at:=(p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo';
  end_at:=start_at+make_interval(secs=>(p.duracao*3600)::double precision);
  exclusive_event:=coalesce(p.snapshot#>>'{totals,privatization,mode}','') in ('required-full','optional-full') or (p.snapshot#>>'{totals,privatization,mode}'='optional' and coalesce(p.privatizacao,0)>0);
  select coalesce(sum(x.guests),0),coalesce(bool_or(x.exclusive or exclusive_event),false) into used,conflict from (
    select er.guests,er.exclusive from public.event_reservations er where er.opportunity_id<>p.oportunidade_id and er.status<>'released' and (er.status='confirmed' or er.expires_at>now()) and er.starts_at<end_at and er.ends_at>start_at
    union all
    select legacy.convidados,true from public.propostas legacy where legacy.is_current and legacy.oportunidade_id is distinct from p.oportunidade_id and legacy.status in ('confirmado','pagamento_final','planejamento','evento_proximo') and (legacy.data_evento+legacy.horario_evento) at time zone 'America/Sao_Paulo'<end_at and ((legacy.data_evento+legacy.horario_evento) at time zone 'America/Sao_Paulo')+make_interval(secs=>(coalesce(legacy.duracao,2)*3600)::double precision)>start_at and not exists(select 1 from public.event_reservations er where er.opportunity_id=legacy.oportunidade_id and er.status='confirmed')
  ) x;
  if p.convidados>cap or used+p.convidados>cap or conflict then raise exception 'Conflito de agenda ou capacidade. Revise a disponibilidade antes de confirmar'; end if;
  perform event_private.assert_money(p);
  perform event_private.check_discount(p);
  insert into public.event_reservations(opportunity_id,proposal_id,starts_at,ends_at,guests,exclusive,status,expires_at) values(p.oportunidade_id,p.id,start_at,end_at,p.convidados,exclusive_event,reserve_status,case when reserve_status='held' then hold_until end)
    on conflict(opportunity_id) do update set proposal_id=excluded.proposal_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,guests=excluded.guests,exclusive=excluded.exclusive,status=excluded.status,expires_at=excluded.expires_at,updated_at=now() returning * into r;
  return r;
end; $$;

create or replace function event_private.guard_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_current and new.status in ('confirmado','pagamento_final','planejamento','evento_proximo') and new.data_evento >= (now() at time zone 'America/Sao_Paulo')::date then
    if tg_op='INSERT' or old.status is distinct from new.status or old.data_evento is distinct from new.data_evento or old.horario_evento is distinct from new.horario_evento or old.convidados is distinct from new.convidados or old.duracao is distinct from new.duracao or old.is_current is distinct from new.is_current or event_private.proposal_fingerprint(old) is distinct from event_private.proposal_fingerprint(new) then
      if coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0 then raise exception 'Registre e valide o sinal antes de confirmar a reserva'; end if;
      perform event_private.reserve_proposal(new,'confirmed',null);
    end if;
  elsif new.status in ('cancelado','pos_venda') then
    update public.event_reservations set status='released',expires_at=null,updated_at=now() where opportunity_id=new.oportunidade_id;
  end if;
  return new;
end; $$;

