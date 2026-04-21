-- Embaixada Carioca - Orcamentos de eventos
-- Rode este arquivo no SQL Editor do Supabase.
-- Politica escolhida: historico compartilhado apenas entre os e-mails da equipe.
-- E-mails autorizados: leorangel@gmail.com e eventos@embaixadacarioca.com.br.

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
    'eventos@embaixadacarioca.com.br'
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
create policy "Equipe autenticada pode remover propostas"
on public.propostas
for delete
to authenticated
using ((select public.is_team_member()));

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
create policy "Equipe autenticada pode remover solicitacoes"
on public.solicitacoes_cotacao
for delete
to authenticated
using ((select public.is_team_member()));
