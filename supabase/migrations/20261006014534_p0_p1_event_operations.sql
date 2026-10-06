-- P0/P1: fila comercial, conversas, envio idempotente, alçada e reservas.
-- Nenhum registro legado é atribuído ou classificado automaticamente.
create schema if not exists event_private;
revoke all on schema event_private from public, anon, authenticated;

create table public.event_commercial_policy (
  id boolean primary key default true check (id),
  capacity integer check (capacity between 1 and 500),
  default_owner text check (default_owner in ('leorangel@gmail.com','eventos@embaixadacarioca.com.br')),
  updated_at timestamptz not null default now()
);
insert into public.event_commercial_policy(id) values(true);
create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.oportunidades(id) on delete cascade,
  proposal_id uuid references public.propostas(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email','link','phone','note')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  source text not null check (source in ('manual','public','provider','system')),
  body text not null check (length(body) between 1 and 6000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  external_id text,
  read_at timestamptz,
  delivery_status text check (delivery_status in ('manual_sent','accepted','delivered','read','failed','uncertain'))
);
create index event_messages_opportunity_time on public.event_messages(opportunity_id,occurred_at desc);
create index event_messages_proposal on public.event_messages(proposal_id) where proposal_id is not null;
create index event_messages_actor on public.event_messages(created_by) where created_by is not null;
create unique index event_messages_external on public.event_messages(channel,external_id) where external_id is not null;
create table public.event_outbox (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.propostas(id) on delete cascade,
  opportunity_id uuid references public.oportunidades(id) on delete set null,
  fingerprint text not null,
  channel text not null check(channel in ('whatsapp','email')),
  destination text not null,
  body text not null,
  status text not null default 'sending' check(status in ('sending','accepted','failed','uncertain')),
  provider_id text,
  detail text,
  attempts integer not null default 1,
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fingerprint)
);
create index event_outbox_proposal on public.event_outbox(proposal_id,created_at desc);
create index event_outbox_opportunity on public.event_outbox(opportunity_id) where opportunity_id is not null;
create index event_outbox_actor on public.event_outbox(approved_by);
create table public.event_discount_approvals (
  proposal_id uuid primary key references public.propostas(id) on delete cascade,
  fingerprint text not null,
  approved_by uuid not null references auth.users(id),
  approved_email text not null,
  approved_at timestamptz not null default now()
);
create index event_discount_actor on public.event_discount_approvals(approved_by);
create table public.event_reservations (
  opportunity_id uuid primary key references public.oportunidades(id) on delete cascade,
  proposal_id uuid not null references public.propostas(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at > starts_at),
  guests integer not null check(guests > 0),
  exclusive boolean not null default false,
  status text not null check(status in ('held','confirmed','released')),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check(status <> 'held' or expires_at is not null)
);
create index event_reservations_proposal on public.event_reservations(proposal_id);
create index event_reservations_window on public.event_reservations(starts_at,ends_at) where status <> 'released';

alter table public.event_commercial_policy enable row level security;
alter table public.event_messages enable row level security;
alter table public.event_outbox enable row level security;
alter table public.event_discount_approvals enable row level security;
alter table public.event_reservations enable row level security;
revoke all on public.event_commercial_policy,public.event_messages,public.event_outbox,public.event_discount_approvals,public.event_reservations from public,anon,authenticated;
grant select on public.event_commercial_policy,public.event_messages,public.event_outbox,public.event_discount_approvals,public.event_reservations to authenticated;
create policy team_read on public.event_commercial_policy for select to authenticated using ((select public.is_team_member()));
create policy team_read on public.event_messages for select to authenticated using ((select public.is_team_member()));
create policy team_read on public.event_outbox for select to authenticated using ((select public.is_team_member()));
create policy team_read on public.event_discount_approvals for select to authenticated using ((select public.is_team_member()));
create policy team_read on public.event_reservations for select to authenticated using ((select public.is_team_member()));

create function event_private.require_team() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_team_member() then raise exception 'Acesso exclusivo da equipe'; end if;
end; $$;
create function event_private.proposal_fingerprint(p public.propostas) returns text language sql immutable set search_path='' as $$
  select encode(extensions.digest(jsonb_build_object('id',p.id,'version',p.versao,'client',p.snapshot->'client','event',p.snapshot->'event','items',p.snapshot->'selectedItems','totals',p.snapshot->'totals','terms',p.snapshot->'generalTerms','offers',p.snapshot->'publicOfferOptions','date',p.data_evento,'time',p.horario_evento,'guests',p.convidados,'duration',p.duracao,'total',p.total)::text,'sha256'),'hex');
$$;
create function event_private.check_discount(p public.propostas) returns void language plpgsql security definer set search_path='' as $$
declare discount numeric; base numeric;
begin
  discount := greatest(0,-coalesce((p.snapshot#>>'{totals,adjustment}')::numeric,0)) + greatest(0,-coalesce((p.snapshot#>>'{totals,privatizationAdjustment}')::numeric,0));
  base := greatest(coalesce(p.subtotal,0),1);
  if (discount>1000 or discount/base>0.10) and not exists(select 1 from public.event_discount_approvals a where a.proposal_id=p.id and a.fingerprint=event_private.proposal_fingerprint(p)) then
    raise exception 'Desconto fora da alçada. Salve a proposta e solicite aprovação autenticada do gestor.';
  end if;
end; $$;

create function public.save_event_commercial_policy(target_capacity integer, owner_email text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  if not public.is_super_admin() then raise exception 'Somente o gestor pode configurar distribuição e capacidade'; end if;
  update public.event_commercial_policy set capacity=target_capacity,default_owner=nullif(lower(trim(owner_email)),''),updated_at=now() where id;
  return (select to_jsonb(p) from public.event_commercial_policy p where id);
end; $$;
create function public.plan_event_opportunities(opportunity_ids uuid[],owner_email text,action_text text,due_at timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  perform event_private.require_team();
  owner_email:=lower(trim(owner_email));
  if owner_email not in ('leorangel@gmail.com','eventos@embaixadacarioca.com.br') or owner_email is null then raise exception 'Escolha um responsável comercial habilitado'; end if;
  if coalesce(array_length(opportunity_ids,1),0) not between 1 and 100 or length(trim(action_text)) not between 1 and 120 or due_at is null then raise exception 'Plano incompleto'; end if;
  update public.oportunidades set responsavel_email=owner_email,responsavel_id=(select id from auth.users where lower(email)=owner_email limit 1),proxima_acao=trim(action_text),proxima_acao_em=due_at,
    metadata=coalesce(metadata,'{}')||jsonb_build_object('next_action_source','manual','plan_changed_by',auth.uid(),'plan_changed_at',now())
  where id=any(opportunity_ids) and status not in ('cancelado','perdido','pos_venda') and (data_evento is null or data_evento >= (now() at time zone 'America/Sao_Paulo')::date);
  get diagnostics affected=row_count;
  insert into public.event_messages(opportunity_id,channel,direction,source,body,created_by)
    select id,'note','internal','system','Plano comercial: '||trim(action_text)||' · responsável '||owner_email||' · prazo '||due_at::text,auth.uid()
    from public.oportunidades where id=any(opportunity_ids) and metadata->>'plan_changed_at'=(to_jsonb(now())#>>'{}');
  return affected;
end; $$;
create function event_private.assign_new_opportunity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if nullif(trim(new.responsavel_email),'') is null then
    select default_owner into new.responsavel_email from public.event_commercial_policy where id;
    if new.responsavel_email is not null then
      select id into new.responsavel_id from auth.users where lower(email)=new.responsavel_email limit 1;
      new.metadata:=coalesce(new.metadata,'{}')||jsonb_build_object('owner_source','configured_default');
    end if;
  end if;
  return new;
end; $$;
create trigger event_default_owner before insert on public.oportunidades for each row execute function event_private.assign_new_opportunity();

create function public.record_event_message(target_opportunity uuid,message_body text,message_channel text,message_direction text,message_at timestamptz,request_id uuid) returns public.event_messages language plpgsql security definer set search_path='' as $$
declare m public.event_messages; o public.oportunidades;
begin
  perform event_private.require_team();
  select * into o from public.oportunidades where id=target_opportunity for update;
  if not found then raise exception 'Oportunidade não encontrada'; end if;
  if message_direction not in ('inbound','outbound','internal') or message_at is null or message_at>now()+interval '5 minutes' or request_id is null then raise exception 'Confira direção e data da mensagem'; end if;
  if message_direction='outbound' and (o.status in ('perdido','cancelado') or (o.data_evento < (now() at time zone 'America/Sao_Paulo')::date and o.status<>'pos_venda')) then raise exception 'Evento encerrado: registre apenas contexto ou resposta recebida'; end if;
  insert into public.event_messages(id,opportunity_id,channel,direction,source,body,occurred_at,created_by,read_at,delivery_status)
  values(request_id,target_opportunity,message_channel,message_direction,'manual',trim(message_body),message_at,auth.uid(),case when message_direction<>'inbound' then now() end,case when message_direction='outbound' then 'manual_sent' end)
  on conflict(id) do nothing returning * into m;
  if m.id is null then
    select * into m from public.event_messages where id=request_id;
    if m.opportunity_id<>target_opportunity or m.body<>trim(message_body) or m.direction<>message_direction then raise exception 'Identificador já usado em outro registro'; end if;
    return m;
  end if;
  if message_direction='outbound' then
    update public.oportunidades set ultimo_contato_em=greatest(ultimo_contato_em,message_at),metadata=coalesce(metadata,'{}')||case when metadata->>'first_reply_sent_at' is null then jsonb_build_object('first_reply_sent_at',message_at,'first_reply_channel',message_channel,'first_reply_source','manual_confirmed') else '{}'::jsonb end where id=target_opportunity;
  elsif message_direction='inbound' then
    update public.oportunidades set ultima_resposta_cliente_em=greatest(ultima_resposta_cliente_em,message_at),proxima_acao=case when status in ('perdido','cancelado','pos_venda') then proxima_acao else 'Responder mensagem do cliente' end,proxima_acao_em=case when status in ('perdido','cancelado','pos_venda') then proxima_acao_em else now() end,metadata=coalesce(metadata,'{}')||jsonb_build_object('next_action_source','client_response') where id=target_opportunity and (ultimo_contato_em is null or message_at>ultimo_contato_em);
  end if;
  return m;
end; $$;
create function public.mark_event_messages_read(target_opportunity uuid,message_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
  perform event_private.require_team();
  update public.event_messages set read_at=coalesce(read_at,now()) where opportunity_id=target_opportunity and id=any(message_ids) and direction='inbound';
end; $$;
create function event_private.capture_public_response() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.oportunidade_id is not null and new.cliente_resposta_em is distinct from old.cliente_resposta_em and new.cliente_resposta_em is not null then
    insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,occurred_at,external_id)
    values(new.oportunidade_id,new.id,'link','inbound','public',left(coalesce(new.cliente_resposta,'Resposta')||': '||coalesce(new.cliente_mensagem,''),6000),new.cliente_resposta_em,'response:'||new.id::text||':'||new.cliente_resposta_em::text)
    on conflict(channel,external_id) where external_id is not null do nothing;
  end if;
  return new;
end; $$;
create trigger event_public_response after update of cliente_resposta_em on public.propostas for each row execute function event_private.capture_public_response();

create function public.approve_event_discount(target_proposal uuid) returns public.event_discount_approvals language plpgsql security definer set search_path='' as $$
declare p public.propostas; a public.event_discount_approvals;
begin
  perform event_private.require_team();
  if not public.is_super_admin() then raise exception 'A aprovação exige login do gestor'; end if;
  select * into p from public.propostas where id=target_proposal for update;
  if not found then raise exception 'Proposta não encontrada'; end if;
  insert into public.event_discount_approvals(proposal_id,fingerprint,approved_by,approved_email) values(p.id,event_private.proposal_fingerprint(p),auth.uid(),lower(auth.jwt()->>'email'))
  on conflict(proposal_id) do update set fingerprint=excluded.fingerprint,approved_by=excluded.approved_by,approved_email=excluded.approved_email,approved_at=now() returning * into a;
  return a;
end; $$;
create function public.begin_event_send(target_proposal uuid,send_channel text,send_destination text,send_body text,send_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas; b public.event_outbox; fp text;
begin
  perform event_private.require_team();
  select * into p from public.propostas where id=target_proposal for update;
  if not found then raise exception 'Proposta não encontrada'; end if;
  if not coalesce(p.is_current,false) or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Envio exige versão atual e evento em aberto'; end if;
  if length(trim(send_body)) not between 1 and 12000 or length(trim(send_destination)) not between 5 and 320 then raise exception 'Confira mensagem e destinatário'; end if;
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
-- Somente o worker autenticado pela service role registra o resultado do provedor.
create function public.finish_event_send(send_id uuid,send_status text,external_message_id text default null,error_detail text default null) returns void language plpgsql security definer set search_path='' as $$
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
      update public.propostas set publication_status='sent',sent_at=coalesce(sent_at,now()),status=case when status='proposta_pronta' then 'proposta_enviada' else status end where id=b.proposal_id;
    end if;
  end if;
end; $$;

create function event_private.reserve_proposal(p public.propostas,reserve_status text,hold_until timestamptz) returns public.event_reservations language plpgsql security definer set search_path='' as $$
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
  perform event_private.check_discount(p);
  insert into public.event_reservations(opportunity_id,proposal_id,starts_at,ends_at,guests,exclusive,status,expires_at) values(p.oportunidade_id,p.id,start_at,end_at,p.convidados,exclusive_event,reserve_status,case when reserve_status='held' then hold_until end)
    on conflict(opportunity_id) do update set proposal_id=excluded.proposal_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,guests=excluded.guests,exclusive=excluded.exclusive,status=excluded.status,expires_at=excluded.expires_at,updated_at=now() returning * into r;
  return r;
end; $$;
create function public.hold_event_proposal(target_proposal uuid,hold_until timestamptz) returns public.event_reservations language plpgsql security definer set search_path='' as $$
declare p public.propostas; r public.event_reservations;
begin
  perform event_private.require_team();
  select * into p from public.propostas where id=target_proposal for update;
  if not found or not p.is_current or p.status in ('cancelado','pos_venda','confirmado','pagamento_final','planejamento','evento_proximo') then raise exception 'Escolha uma proposta atual em negociação'; end if;
  r:=event_private.reserve_proposal(p,'held',hold_until);
  insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by) values(p.oportunidade_id,p.id,'note','internal','system','Pré-reserva até '||hold_until::text||'. Não confirma pagamento.',auth.uid());
  return r;
end; $$;
create function event_private.guard_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_current and new.status in ('confirmado','pagamento_final','planejamento','evento_proximo') and new.data_evento >= (now() at time zone 'America/Sao_Paulo')::date then
    if tg_op='INSERT' or old.status is distinct from new.status or old.data_evento is distinct from new.data_evento or old.horario_evento is distinct from new.horario_evento or old.convidados is distinct from new.convidados or old.duracao is distinct from new.duracao or old.is_current is distinct from new.is_current then
      if coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0 then raise exception 'Registre e valide o sinal antes de confirmar a reserva'; end if;
      perform event_private.reserve_proposal(new,'confirmed',null);
    end if;
  elsif new.status in ('cancelado','pos_venda') then
    update public.event_reservations set status='released',expires_at=null,updated_at=now() where opportunity_id=new.oportunidade_id;
  end if;
  return new;
end; $$;
-- AFTER evita FK antes da inserção da proposta e mantém falhas atômicas.
create trigger event_guard_confirmation after insert or update on public.propostas for each row execute function event_private.guard_confirmation();

revoke all on all functions in schema event_private from public,anon,authenticated;
revoke all on function public.save_event_commercial_policy(integer,text),public.plan_event_opportunities(uuid[],text,text,timestamptz),public.record_event_message(uuid,text,text,text,timestamptz,uuid),public.mark_event_messages_read(uuid,uuid[]),public.approve_event_discount(uuid),public.begin_event_send(uuid,text,text,text,text),public.hold_event_proposal(uuid,timestamptz),public.finish_event_send(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_event_commercial_policy(integer,text),public.plan_event_opportunities(uuid[],text,text,timestamptz),public.record_event_message(uuid,text,text,text,timestamptz,uuid),public.mark_event_messages_read(uuid,uuid[]),public.approve_event_discount(uuid),public.begin_event_send(uuid,text,text,text,text),public.hold_event_proposal(uuid,timestamptz) to authenticated;
grant execute on function public.finish_event_send(uuid,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.get_public_proposal(proposal_token uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, cliente_nome text, cliente_email text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, duracao numeric, subtotal numeric, taxa_servico numeric, privatizacao numeric, total numeric, status text, snapshot jsonb, cliente_resposta text, cliente_resposta_em timestamp with time zone, cliente_mensagem text, cliente_solicitacao jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with requested as (
    select p.*
    from public.propostas p
    where p.public_token = proposal_token
      and p.public_token_revoked_at is null
    limit 1
  ),
  resolved as (
    select coalesce(current_p.id, requested.id) as resolved_id
    from requested
    left join public.propostas current_p
      on current_p.oportunidade_id = requested.oportunidade_id
     and current_p.is_current = true
     and current_p.public_token_revoked_at is null
     and current_p.public_token_expires_at > now()
  )
  select
    p.id,
    p.created_at,
    p.cliente_nome,
    p.cliente_email,
    p.tipo_evento,
    p.data_evento,
    p.horario_evento,
    p.convidados,
    p.duracao,
    p.subtotal,
    p.taxa_servico,
    p.privatizacao,
    p.total,
    p.status,
    jsonb_strip_nulls(jsonb_build_object(
      'event', jsonb_build_object(
        'type', p.snapshot #> '{event,type}',
        'validity', p.snapshot #> '{event,validity}',
        'signalDeadlineHours', p.snapshot #> '{event,signalDeadlineHours}',
        'signalDeadlineAt', p.snapshot #> '{event,signalDeadlineAt}',
        'clientLanguage', p.snapshot #> '{event,clientLanguage}'
      ),
      'totals', jsonb_build_object(
        'subtotal', p.subtotal,
        'serviceFee', p.taxa_servico,
        'privatizationAmount', p.privatizacao,
        'total', p.total,
        'privatization', jsonb_build_object('mode', p.snapshot #> '{totals,privatization,mode}')
      ),
      'selectedItems', p.snapshot -> 'selectedItems',
      'versionChanges', p.snapshot -> 'versionChanges',
      'publicOfferOptions', p.snapshot -> 'publicOfferOptions',
      'generalTerms', p.snapshot -> 'generalTerms',
      'paymentTerms', p.snapshot -> 'paymentTerms',
      'clienteResposta', p.snapshot -> 'clienteResposta',
      'versao', p.versao
    )) as snapshot,
    p.cliente_resposta,
    p.cliente_resposta_em,
    p.cliente_mensagem,
    p.cliente_solicitacao
  from public.propostas p
  join resolved r on r.resolved_id = p.id
  where p.public_token_revoked_at is null
    and p.public_token_expires_at > now()
  limit 1;
$function$

