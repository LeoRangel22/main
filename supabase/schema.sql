-- Embaixada Carioca - Orcamentos de eventos
-- Rode este arquivo no SQL Editor do Supabase.
-- Politica escolhida: historico compartilhado apenas entre os e-mails da equipe.
-- E-mails autorizados: leorangel@gmail.com, eventos@embaixadacarioca.com.br e financeiro@embaixadacarioca.com.br.

create extension if not exists pgcrypto;

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'leorangel@gmail.com',
    'eventos@embaixadacarioca.com.br',
    'financeiro@embaixadacarioca.com.br'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'leorangel@gmail.com'
  );
$$;

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responsavel_id uuid references auth.users(id) on delete set null,
  responsavel_email text,
  cliente_nome text not null,
  cliente_email text,
  cliente_whatsapp text,
  tipo_evento text,
  data_evento date,
  horario_evento time,
  convidados integer not null default 1 check (convidados > 0),
  duracao numeric(4, 2) not null default 1 check (duracao > 0),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  taxa_servico numeric(12, 2) not null default 0 check (taxa_servico >= 0),
  privatizacao numeric(12, 2) not null default 0 check (privatizacao >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  status text not null default 'rascunho',
  solicitacao_id uuid,
  snapshot jsonb not null
);

create index if not exists propostas_created_at_idx
  on public.propostas (created_at desc);

create index if not exists propostas_cliente_nome_idx
  on public.propostas (lower(cliente_nome));

create index if not exists propostas_data_evento_idx
  on public.propostas (data_evento)
  where data_evento is not null;

create index if not exists propostas_status_updated_at_idx
  on public.propostas (status, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists propostas_set_updated_at on public.propostas;
create trigger propostas_set_updated_at
before update on public.propostas
for each row
execute function public.set_updated_at();

alter table public.propostas enable row level security;

drop policy if exists "Equipe autenticada pode ler propostas" on public.propostas;
create policy "Equipe autenticada pode ler propostas"
on public.propostas
for select
to authenticated
using ((select public.is_team_member()));

drop policy if exists "Equipe autenticada pode criar propostas" on public.propostas;
create policy "Equipe autenticada pode criar propostas"
on public.propostas
for insert
to authenticated
with check ((select public.is_team_member()));

drop policy if exists "Equipe autenticada pode atualizar propostas" on public.propostas;
create policy "Equipe autenticada pode atualizar propostas"
on public.propostas
for update
to authenticated
using ((select public.is_team_member()))
with check ((select public.is_team_member()));

drop policy if exists "Equipe autenticada pode remover propostas" on public.propostas;
drop policy if exists "Super admin pode remover propostas" on public.propostas;
create policy "Super admin pode remover propostas"
on public.propostas
for delete
to authenticated
using ((select public.is_super_admin()));

create table if not exists public.solicitacoes_cotacao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'novo',
  cliente_nome text not null,
  cliente_email text not null,
  cliente_whatsapp text,
  empresa text,
  tipo_evento text,
  data_evento date,
  horario_evento time,
  convidados integer not null default 1 check (convidados > 0),
  duracao numeric(4, 2) check (duracao is null or duracao > 0),
  motivo_evento text,
  preferencias text,
  observacoes text,
  origem text not null default 'formulario',
  proposta_id uuid references public.propostas(id) on delete set null,
  snapshot jsonb not null
);

alter table public.propostas
  add column if not exists solicitacao_id uuid;

alter table public.propostas
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists cliente_resposta text,
  add column if not exists cliente_resposta_em timestamptz,
  add column if not exists cliente_mensagem text,
  add column if not exists cliente_solicitacao jsonb;

create unique index if not exists propostas_public_token_idx
  on public.propostas (public_token);

create table if not exists public.proposta_visualizacoes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  public_token uuid not null,
  user_agent text,
  referrer text
);

create index if not exists proposta_visualizacoes_proposta_idx
  on public.proposta_visualizacoes (proposta_id, created_at desc);

alter table public.proposta_visualizacoes enable row level security;

drop policy if exists "Equipe autenticada pode ler visualizacoes de proposta" on public.proposta_visualizacoes;
create policy "Equipe autenticada pode ler visualizacoes de proposta"
on public.proposta_visualizacoes
for select
to authenticated
using ((select public.is_team_member()));

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
begin
  select p.id
    into target_id
  from public.propostas p
  where p.public_token = proposal_token
  limit 1;

  if target_id is null then
    return false;
  end if;

  insert into public.proposta_visualizacoes (proposta_id, public_token, user_agent, referrer)
  values (target_id, proposal_token, left(coalesce(user_agent, ''), 500), left(coalesce(referrer, ''), 500));

  return true;
end;
$$;

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
    p.snapshot,
    p.cliente_resposta,
    p.cliente_resposta_em,
    p.cliente_mensagem,
    p.cliente_solicitacao
  from public.propostas p
  where p.public_token = proposal_token
  limit 1;
$$;

create or replace function public.respond_public_proposal(
  proposal_token uuid,
  action text,
  requested_date date default null,
  requested_time time default null,
  requested_guests integer default null,
  message text default null
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
  response_payload jsonb;
  history_entry jsonb;
  next_status text;
  new_snapshot jsonb;
begin
  if normalized_action not in ('confirmar', 'cancelar', 'alteracao') then
    raise exception 'Acao invalida.';
  end if;

  if requested_guests is not null and requested_guests < 1 then
    raise exception 'Numero de convidados invalido.';
  end if;

  if normalized_action in ('cancelar', 'alteracao') and length(coalesce(clean_message, '')) < 3 then
    raise exception 'Mensagem obrigatoria.';
  end if;

  response_payload := jsonb_strip_nulls(jsonb_build_object(
    'acao', normalized_action,
    'data', requested_date,
    'horario', requested_time,
    'convidados', requested_guests,
    'mensagem', clean_message,
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
    'detail', coalesce(clean_message, 'Resposta registrada pelo link público.'),
    'at', now(),
    'actor', 'Cliente'
  );

  next_status := case
    when normalized_action = 'cancelar' then 'cancelado'
    else 'negociacao'
  end;

  select jsonb_set(coalesce(p.snapshot, '{}'::jsonb), '{clienteResposta}', response_payload, true)
    into new_snapshot
  from public.propostas p
  where p.public_token = proposal_token;

  if new_snapshot is null then
    raise exception 'Proposta nao encontrada.';
  end if;

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

  new_snapshot := jsonb_set(
    new_snapshot,
    '{commercialHistory}',
    jsonb_build_array(history_entry) || coalesce(new_snapshot -> 'commercialHistory', '[]'::jsonb),
    true
  );

  update public.propostas
    set
      status = next_status,
      cliente_resposta = normalized_action,
      cliente_resposta_em = now(),
      cliente_mensagem = clean_message,
      cliente_solicitacao = response_payload,
      snapshot = new_snapshot
    where public_token = proposal_token;

  return query select true, next_status, normalized_action;
end;
$$;

grant execute on function public.get_public_proposal(uuid) to anon, authenticated;
grant execute on function public.respond_public_proposal(uuid, text, date, time, integer, text) to anon, authenticated;
grant execute on function public.record_public_proposal_view(uuid, text, text) to anon, authenticated;

create index if not exists solicitacoes_cotacao_created_at_idx
  on public.solicitacoes_cotacao (created_at desc);

create index if not exists solicitacoes_cotacao_status_idx
  on public.solicitacoes_cotacao (status, created_at desc);

create index if not exists solicitacoes_cotacao_cliente_nome_idx
  on public.solicitacoes_cotacao (lower(cliente_nome));

create index if not exists solicitacoes_cotacao_data_evento_idx
  on public.solicitacoes_cotacao (data_evento)
  where data_evento is not null;

drop trigger if exists solicitacoes_cotacao_set_updated_at on public.solicitacoes_cotacao;
create trigger solicitacoes_cotacao_set_updated_at
before update on public.solicitacoes_cotacao
for each row
execute function public.set_updated_at();

alter table public.solicitacoes_cotacao enable row level security;

drop policy if exists "Cliente pode enviar solicitacao" on public.solicitacoes_cotacao;
create policy "Cliente pode enviar solicitacao"
on public.solicitacoes_cotacao
for insert
to anon
with check (
  status = 'novo'
  and proposta_id is null
  and origem = 'formulario'
);

drop policy if exists "Equipe autenticada pode enviar solicitacao" on public.solicitacoes_cotacao;
create policy "Equipe autenticada pode enviar solicitacao"
on public.solicitacoes_cotacao
for insert
to authenticated
with check (
  (select public.is_team_member())
  and status = 'novo'
  and proposta_id is null
  and origem = 'formulario'
);

drop policy if exists "Equipe autenticada pode ler solicitacoes" on public.solicitacoes_cotacao;
create policy "Equipe autenticada pode ler solicitacoes"
on public.solicitacoes_cotacao
for select
to authenticated
using ((select public.is_team_member()));

drop policy if exists "Equipe autenticada pode atualizar solicitacoes" on public.solicitacoes_cotacao;
create policy "Equipe autenticada pode atualizar solicitacoes"
on public.solicitacoes_cotacao
for update
to authenticated
using ((select public.is_team_member()))
with check ((select public.is_team_member()));

drop policy if exists "Equipe autenticada pode remover solicitacoes" on public.solicitacoes_cotacao;
drop policy if exists "Super admin pode remover solicitacoes" on public.solicitacoes_cotacao;
create policy "Super admin pode remover solicitacoes"
on public.solicitacoes_cotacao
for delete
to authenticated
using ((select public.is_super_admin()));
