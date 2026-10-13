-- Keep one customer-visible version per opportunity while its replacement awaits approval.
create or replace function public.get_my_event_history()
returns table(proposal_id uuid, oportunidade_id uuid, versao integer, status text, cliente_nome text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, total numeric, public_token uuid, snapshot jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path='' as $$
with me as (
  select lower(nullif(trim(coalesce(auth.jwt()->>'email','')),'')) as email
), visible as (
  select distinct on (coalesce(p.oportunidade_id,p.id)) p.*
  from public.propostas p,me
  where me.email is not null and lower(coalesce(p.cliente_email,''))=me.email
    and p.publication_status<>'draft' and p.public_token_revoked_at is null
    and event_private.remote_proposal_is_public(p)
  order by coalesce(p.oportunidade_id,p.id),coalesce(p.is_current,false) desc,p.versao desc nulls last,p.updated_at desc,p.id
)
select p.id,p.oportunidade_id,p.versao,p.status,p.cliente_nome,p.tipo_evento,p.data_evento,p.horario_evento,p.convidados,p.total,p.public_token,
  jsonb_strip_nulls(jsonb_build_object('client',p.snapshot->'client','event',p.snapshot->'event','selectedItems',p.snapshot->'selectedItems','qualificacao',p.snapshot->'qualificacao','sourceRequestSnapshot',p.snapshot->'sourceRequestSnapshot')),
  p.created_at,p.updated_at
from visible p
order by coalesce(p.data_evento,p.created_at::date) desc,p.updated_at desc limit 12;
$$;
revoke all on function public.get_my_event_history() from public,anon;
grant execute on function public.get_my_event_history() to authenticated;
