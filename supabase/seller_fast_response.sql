-- Aplicar antes de publicar a interface. Preserva propostas e oportunidades antigas.
-- Os valores atuais de proxima_acao permanecem intactos até serem editados pela equipe.
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

  if tg_op = 'UPDATE'
     and old.metadata ->> 'next_action_source' = 'default'
     and new.proxima_acao is not distinct from old.proxima_acao
     and new.proxima_acao_em is not distinct from old.proxima_acao_em then
    new.proxima_acao := null;
    new.proxima_acao_em := null;
  end if;

  -- Um plano preenchido pela equipe (inclusive em registros antigos) prevalece.
  if nullif(trim(coalesce(new.proxima_acao, '')), '') is not null then
    return new;
  end if;

  if new.status = 'lead_recebido' then
    new.proxima_acao := 'Responder lead';
    new.proxima_acao_em := now() + interval '2 hours';
  elsif new.status = 'proposta_pronta' then
    new.proxima_acao := 'Enviar proposta';
    new.proxima_acao_em := now() + interval '2 hours';
  elsif new.status = 'proposta_enviada' then
    new.proxima_acao := 'Retomar cliente';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status = 'negociacao' then
    new.proxima_acao := 'Avancar negociacao';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status in ('confirmado', 'pagamento_final') then
    new.proxima_acao := 'Fechar pagamento';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status in ('planejamento', 'evento_proximo') then
    new.proxima_acao := 'Revisar operacao';
    new.proxima_acao_em := now() + interval '1 day';
  elsif new.status = 'pos_venda' then
    new.proxima_acao := 'Fazer pos-venda';
    new.proxima_acao_em := now() + interval '2 days';
  end if;
  if new.proxima_acao is not null then
    new.metadata := jsonb_set(coalesce(new.metadata, '{}'::jsonb), '{next_action_source}', '"default"'::jsonb, true);
  end if;
  return new;
end;
$$;

-- A migração original já criou o trigger. Reinstalar torna o arquivo independente
-- de sua ordem de execução em bancos que receberam a fase 1 parcialmente.
drop trigger if exists oportunidades_default_next_action on public.oportunidades;
create trigger oportunidades_default_next_action
before insert or update of status on public.oportunidades
for each row
execute function public.set_default_next_action();

-- A fase 1 promovia toda versão a 'sent' ao torná-la atual. Uma versão
-- pode estar publicada no link e ainda aguardar o envio do canal.
create or replace function public.promote_proposal_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oportunidade_id is not null
     and coalesce(new.is_current, false) = true
     and coalesce(old.is_current, false) = false then
    update public.propostas
      set is_current = false, superseded_at = now()
      where oportunidade_id = new.oportunidade_id
        and id <> new.id
        and is_current = true;
    if new.status = 'proposta_pronta' then
      new.publication_status := 'ready';
      new.sent_at := null;
    else
      new.publication_status := 'sent';
      new.sent_at := coalesce(new.sent_at, now());
    end if;
    new.superseded_at := null;
  end if;
  return new;
end;
$$;

-- Configuração comercial única com versões e histórico imutável.
-- A importação inicial deve partir do navegador que contém a tabela
-- aprovada pela gestão; nenhum valor local é substituído nesta migração.
create table if not exists public.commercial_settings (
  config_key text primary key check (config_key in ('catalog', 'privatization', 'communication')),
  value jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.commercial_settings_history (
  id bigint generated always as identity primary key,
  config_key text not null,
  value jsonb not null,
  version integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (config_key, version)
);

create index if not exists commercial_settings_history_latest_idx
  on public.commercial_settings_history (config_key, version desc);

alter table public.commercial_settings enable row level security;
alter table public.commercial_settings_history enable row level security;
grant select on public.commercial_settings, public.commercial_settings_history to authenticated;
revoke insert, update, delete on public.commercial_settings, public.commercial_settings_history from anon, authenticated;

drop policy if exists "Equipe le configuracoes comerciais" on public.commercial_settings;
create policy "Equipe le configuracoes comerciais" on public.commercial_settings
for select to authenticated using ((select public.is_team_member()));

drop policy if exists "Equipe le historico das configuracoes" on public.commercial_settings_history;
create policy "Equipe le historico das configuracoes" on public.commercial_settings_history
for select to authenticated using ((select public.is_team_member()));

create or replace function public.save_commercial_setting(
  p_key text,
  p_value jsonb,
  p_expected_version integer
)
returns public.commercial_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.commercial_settings;
begin
  if not (select public.is_team_member()) then
    raise exception 'Acesso negado.';
  end if;
  if p_key not in ('catalog', 'privatization', 'communication')
     or jsonb_typeof(p_value) <> 'array'
     or jsonb_array_length(p_value) > 500
     or length(p_value::text) > 500000 then
    raise exception 'Configuracao comercial invalida.';
  end if;
  if p_expected_version = 0 then
    insert into public.commercial_settings (config_key, value, version, updated_by)
    values (p_key, p_value, 1, (select auth.uid()))
    on conflict do nothing
    returning * into result;
  else
    update public.commercial_settings
       set value = p_value, version = version + 1,
           updated_at = now(), updated_by = (select auth.uid())
     where config_key = p_key and version = p_expected_version
     returning * into result;
  end if;
  if result.config_key is null then
    raise exception 'Configuracao mudou em outro navegador. Recarregue antes de salvar.';
  end if;
  insert into public.commercial_settings_history (config_key, value, version, updated_at, updated_by)
  values (result.config_key, result.value, result.version, result.updated_at, result.updated_by);
  return result;
end;
$$;

revoke all on function public.save_commercial_setting(text, jsonb, integer) from public;
grant execute on function public.save_commercial_setting(text, jsonb, integer) to authenticated;
