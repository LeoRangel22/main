-- Resolve analytics through the existing public visibility and redirect contract.
-- No permission, historical data, channel or commercial-rule changes.
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
  select visible.id into target_id
  from public.get_public_proposal(proposal_token) visible
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
