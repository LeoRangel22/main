-- Embaixada Carioca - Fase 1 multi-loja
-- Rode este arquivo no SQL Editor do Supabase depois do supabase/schema.sql.
-- Ele prepara lojas e permissoes por loja sem quebrar a Embaixada atual.

create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  name text not null,
  legal_name text,
  brand jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create index if not exists stores_active_slug_idx
  on public.stores (active, slug);

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row
execute function public.set_updated_at();

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  role text not null default 'eventos' check (role in ('master', 'admin', 'gerente', 'eventos', 'financeiro')),
  active boolean not null default true,
  can_manage_commercial boolean not null default false,
  can_manage_finance boolean not null default false,
  can_manage_operations boolean not null default false,
  can_manage_settings boolean not null default false,
  unique (store_id, email)
);

create index if not exists store_members_email_idx
  on public.store_members (lower(email), active);

create index if not exists store_members_store_idx
  on public.store_members (store_id, active);

drop trigger if exists store_members_set_updated_at on public.store_members;
create trigger store_members_set_updated_at
before update on public.store_members
for each row
execute function public.set_updated_at();

insert into public.stores (
  id,
  slug,
  name,
  legal_name,
  brand,
  contact,
  settings
)
values (
  '00000000-0000-4000-8000-000000000001',
  'embaixada-carioca',
  'Embaixada Carioca',
  'Embaixada Carioca Bar e Restaurante',
  jsonb_build_object(
    'primaryColor', '#123f2d',
    'accentColor', '#f49a13',
    'logo', 'assets/logo-embaixada.svg',
    'logoSmall', 'assets/logo-reducao.svg',
    'venueImage', 'assets/venue.jpg'
  ),
  jsonb_build_object(
    'eventsEmail', 'eventos@embaixadacarioca.com.br',
    'financeEmail', 'financeiro@embaixadacarioca.com.br',
    'eventsWhatsapp', '+55 21 97142-6007'
  ),
  jsonb_build_object(
    'serviceRate', 0.12,
    'defaultProposalValidityDays', 14,
    'defaultSignalDeadlineHours', 48,
    'defaultSignalPercent', 50
  )
)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  legal_name = excluded.legal_name,
  brand = public.stores.brand || excluded.brand,
  contact = public.stores.contact || excluded.contact,
  settings = public.stores.settings || excluded.settings,
  active = true;

insert into public.store_members (
  store_id,
  email,
  role,
  can_manage_commercial,
  can_manage_finance,
  can_manage_operations,
  can_manage_settings
)
values
  ('00000000-0000-4000-8000-000000000001', 'leorangel@gmail.com', 'master', true, true, true, true),
  ('00000000-0000-4000-8000-000000000001', 'eventos@embaixadacarioca.com.br', 'eventos', true, false, true, false),
  ('00000000-0000-4000-8000-000000000001', 'financeiro@embaixadacarioca.com.br', 'financeiro', false, true, false, false)
on conflict (store_id, email) do update
set
  role = excluded.role,
  active = true,
  can_manage_commercial = excluded.can_manage_commercial,
  can_manage_finance = excluded.can_manage_finance,
  can_manage_operations = excluded.can_manage_operations,
  can_manage_settings = excluded.can_manage_settings;

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_store_member(target_store_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members sm
    join public.stores s on s.id = sm.store_id
    where sm.active = true
      and s.active = true
      and lower(sm.email) = public.current_user_email()
      and (target_store_id is null or sm.store_id = target_store_id)
  );
$$;

create or replace function public.has_store_role(target_store_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members sm
    join public.stores s on s.id = sm.store_id
    where sm.active = true
      and s.active = true
      and sm.store_id = target_store_id
      and lower(sm.email) = public.current_user_email()
      and sm.role = any(allowed_roles)
  );
$$;

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_store_member(null);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members sm
    where sm.active = true
      and sm.role = 'master'
      and lower(sm.email) = public.current_user_email()
  );
$$;

alter table public.propostas
  add column if not exists store_id uuid references public.stores(id);

update public.propostas
set store_id = '00000000-0000-4000-8000-000000000001'
where store_id is null;

alter table public.propostas
  alter column store_id set default '00000000-0000-4000-8000-000000000001',
  alter column store_id set not null;

create index if not exists propostas_store_status_updated_idx
  on public.propostas (store_id, status, updated_at desc);

create index if not exists propostas_store_data_evento_idx
  on public.propostas (store_id, data_evento)
  where data_evento is not null;

alter table public.solicitacoes_cotacao
  add column if not exists store_id uuid references public.stores(id);

update public.solicitacoes_cotacao
set store_id = '00000000-0000-4000-8000-000000000001'
where store_id is null;

alter table public.solicitacoes_cotacao
  alter column store_id set default '00000000-0000-4000-8000-000000000001',
  alter column store_id set not null;

create index if not exists solicitacoes_cotacao_store_status_idx
  on public.solicitacoes_cotacao (store_id, status, created_at desc);

alter table public.proposta_visualizacoes
  add column if not exists store_id uuid references public.stores(id);

update public.proposta_visualizacoes pv
set store_id = coalesce(p.store_id, '00000000-0000-4000-8000-000000000001')
from public.propostas p
where pv.proposta_id = p.id
  and pv.store_id is null;

update public.proposta_visualizacoes
set store_id = '00000000-0000-4000-8000-000000000001'
where store_id is null;

alter table public.proposta_visualizacoes
  alter column store_id set default '00000000-0000-4000-8000-000000000001',
  alter column store_id set not null;

create index if not exists proposta_visualizacoes_store_idx
  on public.proposta_visualizacoes (store_id, created_at desc);

alter table public.stores enable row level security;
alter table public.store_members enable row level security;

drop policy if exists "Equipe pode ler lojas liberadas" on public.stores;
create policy "Equipe pode ler lojas liberadas"
on public.stores
for select
to authenticated
using ((select public.is_store_member(id)));

drop policy if exists "Master pode gerenciar lojas" on public.stores;
create policy "Master pode gerenciar lojas"
on public.stores
for all
to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists "Equipe pode ler membros da propria loja" on public.store_members;
create policy "Equipe pode ler membros da propria loja"
on public.store_members
for select
to authenticated
using ((select public.is_store_member(store_id)));

drop policy if exists "Master pode gerenciar membros" on public.store_members;
create policy "Master pode gerenciar membros"
on public.store_members
for all
to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

drop policy if exists "Equipe autenticada pode ler propostas" on public.propostas;
create policy "Equipe autenticada pode ler propostas"
on public.propostas
for select
to authenticated
using ((select public.is_store_member(store_id)));

drop policy if exists "Equipe autenticada pode criar propostas" on public.propostas;
create policy "Equipe autenticada pode criar propostas"
on public.propostas
for insert
to authenticated
with check ((select public.is_store_member(store_id)));

drop policy if exists "Equipe autenticada pode atualizar propostas" on public.propostas;
create policy "Equipe autenticada pode atualizar propostas"
on public.propostas
for update
to authenticated
using ((select public.is_store_member(store_id)))
with check ((select public.is_store_member(store_id)));

drop policy if exists "Super admin pode remover propostas" on public.propostas;
create policy "Super admin pode remover propostas"
on public.propostas
for delete
to authenticated
using ((select public.is_super_admin()));

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
  (select public.is_store_member(store_id))
  and status = 'novo'
  and proposta_id is null
  and origem = 'formulario'
);

drop policy if exists "Equipe autenticada pode ler solicitacoes" on public.solicitacoes_cotacao;
create policy "Equipe autenticada pode ler solicitacoes"
on public.solicitacoes_cotacao
for select
to authenticated
using ((select public.is_store_member(store_id)));

drop policy if exists "Equipe autenticada pode atualizar solicitacoes" on public.solicitacoes_cotacao;
create policy "Equipe autenticada pode atualizar solicitacoes"
on public.solicitacoes_cotacao
for update
to authenticated
using ((select public.is_store_member(store_id)))
with check ((select public.is_store_member(store_id)));

drop policy if exists "Super admin pode remover solicitacoes" on public.solicitacoes_cotacao;
create policy "Super admin pode remover solicitacoes"
on public.solicitacoes_cotacao
for delete
to authenticated
using ((select public.is_super_admin()));

drop policy if exists "Equipe autenticada pode ler visualizacoes de proposta" on public.proposta_visualizacoes;
create policy "Equipe autenticada pode ler visualizacoes de proposta"
on public.proposta_visualizacoes
for select
to authenticated
using ((select public.is_store_member(store_id)));

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
  target_store_id uuid;
begin
  select p.id, p.store_id
    into target_id, target_store_id
  from public.propostas p
  where p.public_token = proposal_token
  limit 1;

  if target_id is null then
    return false;
  end if;

  insert into public.proposta_visualizacoes (proposta_id, public_token, store_id, user_agent, referrer)
  values (
    target_id,
    proposal_token,
    coalesce(target_store_id, '00000000-0000-4000-8000-000000000001'),
    left(coalesce(user_agent, ''), 500),
    left(coalesce(referrer, ''), 500)
  );

  return true;
end;
$$;

grant execute on function public.current_user_email() to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;
grant execute on function public.has_store_role(uuid, text[]) to authenticated;
