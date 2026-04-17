-- Embaixada Carioca - Orcamentos de eventos
-- Rode este arquivo no SQL Editor do Supabase.
-- Politica escolhida: historico compartilhado por todos os usuarios autenticados
-- do projeto. Use apenas convites/e-mails da equipe no Supabase Auth.

create extension if not exists pgcrypto;

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
  snapshot jsonb not null
);

create index if not exists propostas_created_at_idx
  on public.propostas (created_at desc);

create index if not exists propostas_cliente_nome_idx
  on public.propostas (lower(cliente_nome));

create index if not exists propostas_data_evento_idx
  on public.propostas (data_evento)
  where data_evento is not null;

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
using (true);

drop policy if exists "Equipe autenticada pode criar propostas" on public.propostas;
create policy "Equipe autenticada pode criar propostas"
on public.propostas
for insert
to authenticated
with check (true);

drop policy if exists "Equipe autenticada pode atualizar propostas" on public.propostas;
create policy "Equipe autenticada pode atualizar propostas"
on public.propostas
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Equipe autenticada pode remover propostas" on public.propostas;
create policy "Equipe autenticada pode remover propostas"
on public.propostas
for delete
to authenticated
using (true);
