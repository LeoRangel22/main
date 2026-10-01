-- Phase 1 - CRM comercial e UX de conversao
-- Embaixada Carioca / futura base multi-loja
-- Additive migration: oportunidades, versionamento de propostas,
-- captura parcial do formulario e historico autenticado do cliente.
--
-- Execute no SQL Editor do Supabase antes de habilitar a nova UX em producao.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Oportunidade comercial como entidade persistente
-- ---------------------------------------------------------------------------

create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid,
  status text not null default 'lead_recebido',
  cliente_nome text,
  cliente_email text,
  cliente_whatsapp text,
  empresa text,
  tipo_evento text,
  data_evento date,
  horario_evento time,
  convidados integer,
  valor_atual numeric(12,2) not null default 0,
  responsavel_id uuid references auth.users(id) on delete set null,
  responsavel_email text,
  proxima_acao text,
  proxima_acao_em timestamptz,
  ultimo_contato_em timestamptz,
  ultima_resposta_cliente_em timestamptz,
  motivo_perda text,
  ganho_em timestamptz,
  perdido_em timestamptz,
  origem text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists oportunidades_status_updated_idx
  on public.oportunidades (status, updated_at desc);

create index if not exists oportunidades_cliente_email_idx
  on public.oportunidades (lower(cliente_email))
  where cliente_email is not null;

create index if not exists oportunidades_cliente_whatsapp_idx
  on public.oportunidades (cliente_whatsapp)
  where cliente_whatsapp is not null;

create index if not exists oportunidades_data_evento_idx
  on public.oportunidades (data_evento)
  where data_evento is not null;

drop trigger if exists oportunidades_set_updated_at on public.oportunidades;
create trigger oportunidades_set_updated_at
before update on public.oportunidades
for each row
execute function public.set_updated_at();

alter table public.oportunidades enable row level security;

drop policy if exists "Equipe pode ler oportunidades" on public.oportunidades;
create policy "Equipe pode ler oportunidades"
on public.oportunidades
for select
to authenticated
using ((select public.is_team_member()));

drop policy if exists "Equipe pode criar oportunidades" on public.oportunidades;
create policy "Equipe pode criar oportunidades"
on public.oportunidades
for insert
to authenticated
with check ((select public.is_team_member()));

drop policy if exists "Equipe pode atualizar oportunidades" on public.oportunidades;
create policy "Equipe pode atualizar oportunidades"
on public.oportunidades
for update
to authenticated
using ((select public.is_team_member()))
with check ((select public.is_team_member()));

drop policy if exists "Super admin pode remover oportunidades" on public.oportunidades;
create policy "Super admin pode remover oportunidades"
on public.oportunidades
for delete
to authenticated
using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- 2. Vinculos e versionamento
-- ---------------------------------------------------------------------------

alter table public.solicitacoes_cotacao
  add column if not exists oportunidade_id uuid references public.oportunidades(id) on delete set null,
  add column if not exists capture_token uuid,
  add column if not exists capture_status text not null default 'complete',
  add column if not exists last_form_step text,
  add column if not exists capture_completed_at timestamptz;

-- Permite lead parcial com apenas WhatsApp, mantendo nome obrigatorio.
alter table public.solicitacoes_cotacao
  alter column cliente_email drop not null;

create unique index if not exists solicitacoes_capture_token_idx
  on public.solicitacoes_cotacao (capture_token)
  where capture_token is not null;

create index if not exists solicitacoes_oportunidade_idx
  on public.solicitacoes_cotacao (oportunidade_id, updated_at desc);

alter table public.propostas
  add column if not exists oportunidade_id uuid references public.oportunidades(id) on delete set null,
  add column if not exists versao integer not null default 1,
  add column if not exists is_current boolean not null default true,
  add column if not exists publication_status text not null default 'sent',
  add column if not exists sent_at timestamptz,
  add column if not exists superseded_at timestamptz;

create index if not exists propostas_oportunidade_idx
  on public.propostas (oportunidade_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Backfill: preserva todo o historico existente
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  opp_id uuid;
begin
  -- Primeiro, cada solicitacao recebe uma oportunidade. Propostas ligadas a ela
  -- passam a compartilhar a mesma oportunidade.
  for r in
    select *
    from public.solicitacoes_cotacao
    where oportunidade_id is null
    order by created_at
  loop
    insert into public.oportunidades (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, origem,
      created_at, updated_at, metadata
    )
    values (
      case
        when r.status in ('novo','em_cotacao','analisado','qualificado','rascunho_cliente') then 'lead_recebido'
        when r.status = 'cancelado' then 'perdido'
        else coalesce(r.status, 'lead_recebido')
      end,
      r.cliente_nome, r.cliente_email, r.cliente_whatsapp, r.empresa,
      r.tipo_evento, r.data_evento, r.horario_evento, r.convidados, r.origem,
      r.created_at, coalesce(r.updated_at, r.created_at),
      jsonb_build_object('migrado_de', 'solicitacoes_cotacao', 'solicitacao_id', r.id)
    )
    returning id into opp_id;

    update public.solicitacoes_cotacao
      set oportunidade_id = opp_id
      where id = r.id;

    update public.propostas
      set oportunidade_id = opp_id
      where solicitacao_id = r.id
        and oportunidade_id is null;
  end loop;

  -- Propostas antigas criadas manualmente, sem solicitacao.
  for r in
    select *
    from public.propostas
    where oportunidade_id is null
    order by created_at
  loop
    insert into public.oportunidades (
      status, cliente_nome, cliente_email, cliente_whatsapp,
      tipo_evento, data_evento, horario_evento, convidados, valor_atual,
      responsavel_id, responsavel_email, created_at, updated_at, metadata
    )
    values (
      case
        when r.status = 'cancelado' then 'perdido'
        else coalesce(r.status, 'proposta_enviada')
      end,
      r.cliente_nome, r.cliente_email, r.cliente_whatsapp,
      r.tipo_evento, r.data_evento, r.horario_evento, r.convidados, coalesce(r.total,0),
      r.responsavel_id, r.responsavel_email, r.created_at, coalesce(r.updated_at, r.created_at),
      jsonb_build_object('migrado_de', 'propostas', 'proposta_id', r.id)
    )
    returning id into opp_id;

    update public.propostas
      set oportunidade_id = opp_id
      where id = r.id;
  end loop;
end
$$;

-- Numera versoes antigas por oportunidade e deixa apenas a mais recente como atual.
with ranked as (
  select
    id,
    row_number() over (
      partition by oportunidade_id
      order by created_at asc, id asc
    ) as rn,
    row_number() over (
      partition by oportunidade_id
      order by created_at desc, id desc
    ) as reverse_rn
  from public.propostas
  where oportunidade_id is not null
)
update public.propostas p
set
  versao = ranked.rn,
  is_current = (ranked.reverse_rn = 1),
  publication_status = 'sent',
  sent_at = coalesce(p.sent_at, p.created_at),
  superseded_at = case when ranked.reverse_rn = 1 then null else coalesce(p.updated_at, p.created_at) end
from ranked
where p.id = ranked.id;

create unique index if not exists propostas_uma_atual_por_oportunidade_idx
  on public.propostas (oportunidade_id)
  where oportunidade_id is not null and is_current = true;

-- ---------------------------------------------------------------------------
-- 4. Triggers: nova versao nunca apaga a anterior
-- ---------------------------------------------------------------------------

create or replace function public.prepare_proposal_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  if new.oportunidade_id is null then
    return new;
  end if;

  select coalesce(max(p.versao), 0) + 1
    into next_version
  from public.propostas p
  where p.oportunidade_id = new.oportunidade_id;

  if coalesce(new.versao, 0) <= 1 and next_version > 1 then
    new.versao := next_version;
  elsif coalesce(new.versao, 0) <= 0 then
    new.versao := next_version;
  end if;

  if coalesce(new.is_current, true) then
    update public.propostas
      set is_current = false,
          superseded_at = now()
      where oportunidade_id = new.oportunidade_id
        and is_current = true;
    new.is_current := true;
    new.superseded_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists propostas_prepare_version on public.propostas;
create trigger propostas_prepare_version
before insert on public.propostas
for each row
execute function public.prepare_proposal_version();

create or replace function public.promote_proposal_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.oportunidade_id is not null
     and coalesce(new.is_current, false) = true
     and coalesce(old.is_current, false) = false then
    update public.propostas
      set is_current = false,
          superseded_at = now()
      where oportunidade_id = new.oportunidade_id
        and id <> new.id
        and is_current = true;
    new.publication_status := 'sent';
    new.sent_at := coalesce(new.sent_at, now());
    new.superseded_at := null;
  end if;
  return new;
end;
$;

drop trigger if exists propostas_promote_version on public.propostas;
create trigger propostas_promote_version
before update of is_current on public.propostas
for each row
execute function public.promote_proposal_version();

create or replace function public.sync_opportunity_from_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oportunidade_id is null or not coalesce(new.is_current, true) then
    return new;
  end if;

  update public.oportunidades
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
    responsavel_id = new.responsavel_id,
    responsavel_email = new.responsavel_email,
    ultima_resposta_cliente_em = coalesce(new.cliente_resposta_em, ultima_resposta_cliente_em),
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
$$;

drop trigger if exists propostas_sync_opportunity on public.propostas;
create trigger propostas_sync_opportunity
after insert or update on public.propostas
for each row
execute function public.sync_opportunity_from_proposal();

create or replace function public.sync_opportunity_from_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oportunidade_id is null then
    return new;
  end if;

  update public.oportunidades
  set
    status = case
      when new.status in ('novo','em_cotacao','analisado','qualificado','rascunho_cliente') then 'lead_recebido'
      when new.status = 'cancelado' then 'perdido'
      else new.status
    end,
    cliente_nome = coalesce(new.cliente_nome, cliente_nome),
    cliente_email = coalesce(new.cliente_email, cliente_email),
    cliente_whatsapp = coalesce(new.cliente_whatsapp, cliente_whatsapp),
    empresa = coalesce(new.empresa, empresa),
    tipo_evento = coalesce(new.tipo_evento, tipo_evento),
    data_evento = coalesce(new.data_evento, data_evento),
    horario_evento = coalesce(new.horario_evento, horario_evento),
    convidados = coalesce(new.convidados, convidados),
    origem = coalesce(new.origem, origem),
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
$$;

drop trigger if exists solicitacoes_sync_opportunity on public.solicitacoes_cotacao;
create trigger solicitacoes_sync_opportunity
after insert or update on public.solicitacoes_cotacao
for each row
execute function public.sync_opportunity_from_request();

-- ---------------------------------------------------------------------------
-- 5. Captura parcial publica
-- ---------------------------------------------------------------------------

create or replace function public.upsert_public_quote_draft(
  p_capture_token uuid,
  p_snapshot jsonb,
  p_last_step text default null
)
returns table (
  request_id uuid,
  opportunity_id uuid,
  capture_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_opportunity_id uuid;
  v_name text := nullif(trim(coalesce(p_snapshot #>> '{cliente,nome}', '')), '');
  v_email text := nullif(lower(trim(coalesce(p_snapshot #>> '{cliente,email}', ''))), '');
  v_phone text := nullif(trim(coalesce(p_snapshot #>> '{cliente,whatsapp}', '')), '');
  v_company text := nullif(trim(coalesce(p_snapshot #>> '{cliente,empresa}', '')), '');
  v_event_type text := nullif(trim(coalesce(p_snapshot #>> '{evento,tipo}', '')), '');
  v_event_date date;
  v_event_time time;
  v_guests integer;
  v_duration numeric;
begin
  if p_capture_token is null then
    raise exception 'capture_token obrigatorio';
  end if;

  -- So criamos lead parcial quando ja existe uma pessoa identificavel e um canal.
  if v_name is null or length(v_name) < 2 or (v_email is null and v_phone is null) then
    return;
  end if;

  begin
    v_event_date := nullif(p_snapshot #>> '{evento,data}', '')::date;
  exception when others then
    v_event_date := null;
  end;

  begin
    v_event_time := nullif(p_snapshot #>> '{evento,horario}', '')::time;
  exception when others then
    v_event_time := null;
  end;

  begin
    v_guests := greatest(1, least(500, coalesce(nullif(p_snapshot #>> '{evento,convidados}', '')::integer, 1)));
  exception when others then
    v_guests := 1;
  end;

  begin
    v_duration := nullif(p_snapshot #>> '{evento,duracao}', '')::numeric;
  exception when others then
    v_duration := null;
  end;

  select s.id, s.oportunidade_id
    into v_request_id, v_opportunity_id
  from public.solicitacoes_cotacao s
  where s.capture_token = p_capture_token
  limit 1;

  if v_request_id is null then
    insert into public.oportunidades (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, origem,
      metadata
    )
    values (
      'lead_recebido', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, 'formulario',
      jsonb_build_object('capture_status','partial')
    )
    returning id into v_opportunity_id;

    insert into public.solicitacoes_cotacao (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, duracao,
      motivo_evento, preferencias, observacoes, origem, proposta_id,
      snapshot, oportunidade_id, capture_token, capture_status, last_form_step
    )
    values (
      'rascunho_cliente', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, v_duration,
      nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      'formulario', null,
      p_snapshot, v_opportunity_id, p_capture_token, 'partial', p_last_step
    )
    returning id into v_request_id;
  else
    update public.solicitacoes_cotacao
    set
      cliente_nome = v_name,
      cliente_email = v_email,
      cliente_whatsapp = v_phone,
      empresa = v_company,
      tipo_evento = v_event_type,
      data_evento = v_event_date,
      horario_evento = v_event_time,
      convidados = v_guests,
      duracao = v_duration,
      motivo_evento = nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      preferencias = nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      observacoes = nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      snapshot = p_snapshot,
      capture_status = 'partial',
      last_form_step = p_last_step
    where id = v_request_id;
  end if;

  return query select v_request_id, v_opportunity_id, p_capture_token;
end;
$$;

create or replace function public.submit_public_quote_request(
  p_capture_token uuid,
  p_snapshot jsonb
)
returns table (
  request_id uuid,
  opportunity_id uuid,
  capture_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_opportunity_id uuid;
  v_name text := nullif(trim(coalesce(p_snapshot #>> '{cliente,nome}', '')), '');
  v_email text := nullif(lower(trim(coalesce(p_snapshot #>> '{cliente,email}', ''))), '');
  v_phone text := nullif(trim(coalesce(p_snapshot #>> '{cliente,whatsapp}', '')), '');
  v_company text := nullif(trim(coalesce(p_snapshot #>> '{cliente,empresa}', '')), '');
  v_event_type text := nullif(trim(coalesce(p_snapshot #>> '{evento,tipo}', '')), '');
  v_event_date date;
  v_event_time time;
  v_guests integer;
  v_duration numeric;
begin
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nome obrigatorio.';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'Informe e-mail ou WhatsApp.';
  end if;

  begin
    v_event_date := nullif(p_snapshot #>> '{evento,data}', '')::date;
  exception when others then
    v_event_date := null;
  end;
  begin
    v_event_time := nullif(p_snapshot #>> '{evento,horario}', '')::time;
  exception when others then
    v_event_time := null;
  end;
  begin
    v_guests := greatest(1, least(500, coalesce(nullif(p_snapshot #>> '{evento,convidados}', '')::integer, 1)));
  exception when others then
    v_guests := 1;
  end;
  begin
    v_duration := nullif(p_snapshot #>> '{evento,duracao}', '')::numeric;
  exception when others then
    v_duration := null;
  end;

  if p_capture_token is not null then
    select s.id, s.oportunidade_id
      into v_request_id, v_opportunity_id
    from public.solicitacoes_cotacao s
    where s.capture_token = p_capture_token
    limit 1;
  end if;

  if v_opportunity_id is null then
    insert into public.oportunidades (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, origem,
      metadata
    )
    values (
      'lead_recebido', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, 'formulario',
      jsonb_build_object('capture_status','complete')
    )
    returning id into v_opportunity_id;
  end if;

  if v_request_id is null then
    insert into public.solicitacoes_cotacao (
      status, cliente_nome, cliente_email, cliente_whatsapp, empresa,
      tipo_evento, data_evento, horario_evento, convidados, duracao,
      motivo_evento, preferencias, observacoes, origem, proposta_id,
      snapshot, oportunidade_id, capture_token, capture_status,
      last_form_step, capture_completed_at
    )
    values (
      'novo', v_name, v_email, v_phone, v_company,
      v_event_type, v_event_date, v_event_time, v_guests, v_duration,
      nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      'formulario', null,
      p_snapshot, v_opportunity_id, p_capture_token, 'complete',
      'completed', now()
    )
    returning id into v_request_id;
  else
    update public.solicitacoes_cotacao
    set
      status = 'novo',
      cliente_nome = v_name,
      cliente_email = v_email,
      cliente_whatsapp = v_phone,
      empresa = v_company,
      tipo_evento = v_event_type,
      data_evento = v_event_date,
      horario_evento = v_event_time,
      convidados = v_guests,
      duracao = v_duration,
      motivo_evento = nullif(trim(coalesce(p_snapshot #>> '{evento,motivo}', '')), ''),
      preferencias = nullif(trim(coalesce(p_snapshot #>> '{evento,preferencias}', '')), ''),
      observacoes = nullif(trim(coalesce(p_snapshot #>> '{evento,observacoes}', '')), ''),
      snapshot = p_snapshot,
      capture_status = 'complete',
      last_form_step = 'completed',
      capture_completed_at = now()
    where id = v_request_id;
  end if;

  update public.oportunidades
  set
    status = 'lead_recebido',
    cliente_nome = v_name,
    cliente_email = v_email,
    cliente_whatsapp = v_phone,
    empresa = v_company,
    tipo_evento = v_event_type,
    data_evento = v_event_date,
    horario_evento = v_event_time,
    convidados = v_guests,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('capture_status','complete')
  where id = v_opportunity_id;

  return query select v_request_id, v_opportunity_id, p_capture_token;
end;
$$;

grant execute on function public.upsert_public_quote_draft(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.submit_public_quote_request(uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Historico do cliente via OTP do Supabase Auth
-- ---------------------------------------------------------------------------

create or replace function public.get_my_event_history()
returns table (
  proposal_id uuid,
  oportunidade_id uuid,
  versao integer,
  status text,
  cliente_nome text,
  tipo_evento text,
  data_evento date,
  horario_evento time,
  convidados integer,
  total numeric,
  public_token uuid,
  snapshot jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select lower(nullif(trim(coalesce(auth.jwt() ->> 'email','')), '')) as email
  )
  select
    p.id,
    p.oportunidade_id,
    p.versao,
    p.status,
    p.cliente_nome,
    p.tipo_evento,
    p.data_evento,
    p.horario_evento,
    p.convidados,
    p.total,
    p.public_token,
    jsonb_strip_nulls(jsonb_build_object(
      'client', p.snapshot -> 'client',
      'event', p.snapshot -> 'event',
      'selectedItems', p.snapshot -> 'selectedItems',
      'qualificacao', p.snapshot -> 'qualificacao',
      'sourceRequestSnapshot', p.snapshot -> 'sourceRequestSnapshot'
    )),
    p.created_at,
    p.updated_at
  from public.propostas p, me
  where me.email is not null
    and lower(coalesce(p.cliente_email,'')) = me.email
    and coalesce(p.is_current, true) = true
  order by coalesce(p.data_evento, p.created_at::date) desc, p.updated_at desc
  limit 12;
$$;

grant execute on function public.get_my_event_history() to authenticated;

create or replace function public.refresh_my_proposal_link(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_email text := lower(nullif(trim(coalesce(auth.jwt() ->> 'email','')), ''));
  token uuid;
begin
  if my_email is null then
    raise exception 'Autenticacao obrigatoria.';
  end if;

  update public.propostas
  set public_token_expires_at = greatest(public_token_expires_at, now() + interval '30 days'),
      public_token_revoked_at = null
  where id = p_proposal_id
    and lower(coalesce(cliente_email,'')) = my_email
    and coalesce(is_current, true) = true
  returning public_token into token;

  if token is null then
    raise exception 'Proposta nao encontrada para este usuario.';
  end if;

  return token;
end;
$$;

grant execute on function public.refresh_my_proposal_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Link antigo sempre resolve para a versao atual da oportunidade
-- ---------------------------------------------------------------------------

create or replace function public.get_public_proposal(proposal_token uuid)
returns table (
  id uuid,
  created_at timestamptz,
  cliente_nome text,
  cliente_email text,
  tipo_evento text,
  data_evento date,
  horario_evento time,
  convidados integer,
  duracao numeric,
  subtotal numeric,
  taxa_servico numeric,
  privatizacao numeric,
  total numeric,
  status text,
  snapshot jsonb,
  cliente_resposta text,
  cliente_resposta_em timestamptz,
  cliente_mensagem text,
  cliente_solicitacao jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
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
      'event', p.snapshot -> 'event',
      'totals', p.snapshot -> 'totals',
      'selectedItems', p.snapshot -> 'selectedItems',
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
$$;

grant execute on function public.get_public_proposal(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Defaults de proxima acao: ajudam a tela "Hoje" sem obrigar treinamento
-- ---------------------------------------------------------------------------

create or replace function public.set_default_next_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'lead_recebido' then
    new.proxima_acao := 'Responder lead';
    new.proxima_acao_em := now() + interval '2 hours';
  elsif new.status = 'proposta_enviada' then
    new.proxima_acao := 'Retomar cliente';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status = 'negociacao' then
    new.proxima_acao := 'Avancar negociacao';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status in ('confirmado','pagamento_final') then
    new.proxima_acao := 'Fechar pagamento';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status in ('planejamento','evento_proximo') then
    new.proxima_acao := 'Revisar operacao';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status = 'pos_venda' then
    new.proxima_acao := 'Fazer pos-venda';
    new.proxima_acao_em := now() + interval '2 days';
  elsif new.status in ('perdido','cancelado') then
    new.proxima_acao := null;
    new.proxima_acao_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists oportunidades_default_next_action on public.oportunidades;
create trigger oportunidades_default_next_action
before insert or update of status on public.oportunidades
for each row
execute function public.set_default_next_action();

-- Aplica defaults às oportunidades abertas já migradas sem sobrescrever
-- uma próxima ação que já tenha sido definida manualmente.
update public.oportunidades
set
  proxima_acao = case
    when status = 'lead_recebido' then 'Responder lead'
    when status = 'proposta_enviada' then 'Retomar cliente'
    when status = 'negociacao' then 'Avancar negociacao'
    when status in ('confirmado','pagamento_final') then 'Fechar pagamento'
    when status in ('planejamento','evento_proximo') then 'Revisar operacao'
    when status = 'pos_venda' then 'Fazer pos-venda'
    else proxima_acao
  end,
  proxima_acao_em = case
    when status = 'lead_recebido' then now() + interval '2 hours'
    when status in ('proposta_enviada','negociacao','confirmado','pagamento_final','planejamento','evento_proximo')
      then now() + interval '1 day'
    when status = 'pos_venda' then now() + interval '2 days'
    else proxima_acao_em
  end
where proxima_acao is null
  and status not in ('perdido','cancelado');



-- ---------------------------------------------------------------------------
-- 9. Respostas e visualizacoes de links antigos tambem seguem a versao atual
-- ---------------------------------------------------------------------------

create or replace function public.record_public_proposal_view(
  proposal_token uuid,
  user_agent text default null,
  referrer text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  has_store_column boolean;
begin
  select coalesce(current_p.id, requested.id)
    into target_id
  from public.propostas requested
  left join public.propostas current_p
    on current_p.oportunidade_id = requested.oportunidade_id
   and current_p.is_current = true
  where requested.public_token = proposal_token
  limit 1;

  if target_id is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'proposta_visualizacoes'
      and column_name = 'store_id'
  ) into has_store_column;

  if has_store_column then
    execute $sql$
      insert into public.proposta_visualizacoes (proposta_id, public_token, store_id, user_agent, referrer)
      select
        $1,
        $2,
        coalesce(p.store_id, '00000000-0000-4000-8000-000000000001'::uuid),
        left(coalesce($3, ''), 500),
        left(coalesce($4, ''), 500)
      from public.propostas p
      where p.id = $1
    $sql$
    using target_id, proposal_token, user_agent, referrer;
  else
    insert into public.proposta_visualizacoes (proposta_id, public_token, user_agent, referrer)
    values (
      target_id,
      proposal_token,
      left(coalesce(user_agent, ''), 500),
      left(coalesce(referrer, ''), 500)
    );
  end if;

  return true;
end;
$$;

grant execute on function public.record_public_proposal_view(uuid, text, text) to anon, authenticated;

create or replace function public.respond_public_proposal(
  proposal_token uuid,
  action text,
  requested_date date default null,
  requested_time time default null,
  requested_guests integer default null,
  message text default null,
  payment_proof jsonb default null
)
returns table (
  ok boolean,
  status text,
  cliente_resposta text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_action text := lower(trim(coalesce(action, '')));
  clean_message text := nullif(trim(coalesce(message, '')), '');
  target_id uuid;
  current_status text;
  current_snapshot jsonb;
  response_payload jsonb;
  history_entry jsonb;
  proof_history_entry jsonb := null;
  clean_proof jsonb := null;
  signal_payment jsonb := null;
  next_status text;
  new_snapshot jsonb;
  proposal_total numeric := 0;
  proof_name text;
  proof_type text;
  proof_size integer;
  proof_data_url text;
begin
  if normalized_action not in ('confirmar', 'cancelar', 'alteracao') then
    raise exception 'Acao invalida.';
  end if;

  if requested_guests is not null and (requested_guests < 1 or requested_guests > 500) then
    raise exception 'Numero de convidados invalido.';
  end if;

  if normalized_action in ('cancelar', 'alteracao') and length(coalesce(clean_message, '')) < 3 then
    raise exception 'Mensagem obrigatoria.';
  end if;

  select
    coalesce(current_p.id, requested.id),
    coalesce(current_p.status, requested.status),
    coalesce(current_p.snapshot, requested.snapshot, '{}'::jsonb),
    coalesce(current_p.total, requested.total, 0)
  into target_id, current_status, current_snapshot, proposal_total
  from public.propostas requested
  left join public.propostas current_p
    on current_p.oportunidade_id = requested.oportunidade_id
   and current_p.is_current = true
   and current_p.public_token_revoked_at is null
   and current_p.public_token_expires_at > now()
  where requested.public_token = proposal_token
    and requested.public_token_revoked_at is null
  limit 1;

  if target_id is null or current_snapshot is null then
    raise exception 'Proposta nao encontrada ou link expirado.';
  end if;

  if current_status not in ('proposta_enviada', 'negociacao') then
    raise exception 'Esta proposta nao aceita mais respostas pelo link publico.';
  end if;

  if payment_proof is not null then
    proof_name := left(nullif(trim(coalesce(payment_proof ->> 'nome', '')), ''), 160);
    proof_type := lower(nullif(trim(coalesce(payment_proof ->> 'tipo', '')), ''));
    proof_data_url := nullif(trim(coalesce(payment_proof ->> 'dataUrl', '')), '');
    proof_size := nullif(trim(coalesce(payment_proof ->> 'tamanho', '')), '')::integer;

    if proof_name is null or proof_type is null or proof_data_url is null then
      raise exception 'Comprovante incompleto.';
    end if;
    if proof_size is null or proof_size <= 0 or proof_size > 5242880 then
      raise exception 'Comprovante acima do limite permitido.';
    end if;
    if proof_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') then
      raise exception 'Tipo de comprovante nao permitido.';
    end if;
    if length(proof_data_url) > 7200000 or proof_data_url !~ '^data:(application/pdf|image/(jpeg|png|webp|heic|heif));base64,' then
      raise exception 'Formato do comprovante invalido.';
    end if;

    clean_proof := jsonb_strip_nulls(jsonb_build_object(
      'nome', proof_name,
      'tipo', proof_type,
      'tamanho', proof_size,
      'dataUrl', proof_data_url,
      'anexadoEm', coalesce(payment_proof ->> 'anexadoEm', now()::text)
    ));
  end if;

  response_payload := jsonb_strip_nulls(jsonb_build_object(
    'acao', normalized_action,
    'data', requested_date,
    'horario', requested_time,
    'convidados', requested_guests,
    'mensagem', clean_message,
    'comprovante', clean_proof,
    'registradoEm', now()
  ));

  history_entry := jsonb_build_object(
    'id', 'cliente-' || extract(epoch from now())::text,
    'type', 'cliente_resposta',
    'title', case
      when normalized_action = 'confirmar' then 'Cliente aprovou a proposta'
      when normalized_action = 'cancelar' then 'Cliente solicitou cancelamento'
      else 'Cliente solicitou alteração'
    end,
    'detail', coalesce(clean_message, 'Resposta registrada pelo link público.') ||
      case when clean_proof is not null then ' Comprovante anexado: ' || coalesce(clean_proof ->> 'nome', 'arquivo') else '' end,
    'at', now(),
    'actor', 'Cliente'
  );

  next_status := case when normalized_action = 'cancelar' then 'cancelado' else 'negociacao' end;
  new_snapshot := jsonb_set(current_snapshot, '{clienteResposta}', response_payload, true);

  if normalized_action = 'cancelar' then
    new_snapshot := jsonb_set(
      new_snapshot,
      '{cancelamento}',
      jsonb_build_object(
        'motivo', coalesce(clean_message, 'Cancelado pelo cliente'),
        'canceladoEm', now(),
        'canceladoPor', 'cliente'
      ),
      true
    );
  end if;

  if normalized_action = 'confirmar' and clean_proof is not null then
    signal_payment := jsonb_strip_nulls(jsonb_build_object(
      'valor', round(coalesce(proposal_total, 0) * 0.5, 2),
      'data', current_date,
      'bancos', jsonb_build_array('A validar'),
      'comprovante', clean_proof,
      'registradoEm', now(),
      'registradoPor', 'Cliente via proposta pública',
      'origem', 'proposta_publica',
      'validacaoPendente', true
    ));

    proof_history_entry := jsonb_build_object(
      'id', 'sinal-cliente-' || extract(epoch from now())::text,
      'type', 'comprovante_sinal',
      'title', 'Comprovante enviado pelo cliente',
      'detail', 'Comprovante anexado pelo link público. Validar no banco antes da confirmação operacional: ' || coalesce(clean_proof ->> 'nome', 'arquivo'),
      'at', now(),
      'actor', 'Cliente'
    );
  end if;

  new_snapshot := jsonb_set(
    new_snapshot,
    '{commercialHistory}',
    (case when proof_history_entry is not null then jsonb_build_array(proof_history_entry, history_entry) else jsonb_build_array(history_entry) end)
      || coalesce(new_snapshot -> 'commercialHistory', '[]'::jsonb),
    true
  );

  if signal_payment is not null then
    new_snapshot := jsonb_set(new_snapshot, '{pagamentoSinal}', signal_payment, true);
  end if;

  update public.propostas
  set
    status = next_status,
    cliente_resposta = normalized_action,
    cliente_resposta_em = now(),
    cliente_mensagem = clean_message,
    cliente_solicitacao = response_payload,
    snapshot = new_snapshot
  where id = target_id;

  return query select true, next_status, normalized_action;
end;
$$;

grant execute on function public.respond_public_proposal(uuid, text, date, time, integer, text, jsonb) to anon, authenticated;
