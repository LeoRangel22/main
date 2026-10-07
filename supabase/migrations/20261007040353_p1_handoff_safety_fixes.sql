-- Corrige a elegibilidade pos-sinal, isola de forma nao destrutiva os registros
-- legados criados por JSON null e vincula a ciencia a versao revisada.

do $fix_sync_predicate$
declare
  function_definition text;
begin
  select pg_get_functiondef('event_private.sync_event_handoff(public.propostas)'::regprocedure)
  into function_definition;

  function_definition := replace(
    function_definition,
    'p.snapshot -> ''pagamentoSinal'' is not null',
    'jsonb_typeof(p.snapshot -> ''pagamentoSinal'') = ''object'''
  );
  execute function_definition;
end
$fix_sync_predicate$;

revoke execute on function event_private.sync_event_handoff(public.propostas) from public, anon, authenticated;

create or replace view public.active_event_handoffs
with (security_invoker = true)
as
select h.*
from public.event_handoffs h
join public.propostas p on p.id = h.proposal_id
where coalesce(p.is_current, true)
  and (
    p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
    or jsonb_typeof(p.snapshot -> 'pagamentoSinal') = 'object'
  );

revoke all on public.active_event_handoffs from public, anon, authenticated;
grant select on public.active_event_handoffs to authenticated;

create or replace view public.active_event_handoff_tasks
with (security_invoker = true)
as
select t.*
from public.event_handoff_tasks t
join public.active_event_handoffs h on h.opportunity_id = t.opportunity_id;

create or replace view public.active_event_handoff_changes
with (security_invoker = true)
as
select c.*
from public.event_handoff_changes c
join public.active_event_handoffs h on h.opportunity_id = c.opportunity_id;

revoke all on public.active_event_handoff_tasks, public.active_event_handoff_changes from public, anon, authenticated;
grant select on public.active_event_handoff_tasks, public.active_event_handoff_changes to authenticated;

do $revoke_legacy_ack$
begin
  if to_regprocedure('public.acknowledge_event_handoff_changes(uuid)') is not null then
    execute 'revoke execute on function public.acknowledge_event_handoff_changes(uuid) from public, anon, authenticated';
  end if;
end
$revoke_legacy_ack$;

create or replace function public.acknowledge_event_handoff_changes(
  target_opportunity uuid,
  target_version integer
)
returns public.event_handoffs
language plpgsql
security definer
set search_path = ''
as $$
declare
  handoff public.event_handoffs;
begin
  perform event_private.require_team();

  select * into handoff
  from public.event_handoffs
  where opportunity_id = target_opportunity
  for update;

  if handoff.opportunity_id is null then
    raise exception 'Handoff operacional nao encontrado.';
  end if;
  if handoff.version <> target_version then
    raise exception 'O handoff mudou. Recarregue antes de registrar a ciencia.';
  end if;

  update public.event_handoff_changes
  set acknowledged_at = coalesce(acknowledged_at, now()),
      acknowledged_by = coalesce(acknowledged_by, auth.uid())
  where opportunity_id = target_opportunity
    and acknowledged_at is null
    and handoff_version <= target_version;

  update public.event_handoffs h
  set changes_pending = exists (
        select 1
        from public.event_handoff_changes c
        where c.opportunity_id = h.opportunity_id
          and c.acknowledged_at is null
      ),
      status = case
        when not exists (
          select 1
          from public.event_handoff_changes c
          where c.opportunity_id = h.opportunity_id
            and c.acknowledged_at is null
        ) and not exists (
          select 1
          from public.event_handoff_tasks t
          where t.opportunity_id = h.opportunity_id
            and t.status <> 'done'
        ) then 'completed'
        else 'active'
      end,
      updated_at = now()
  where h.opportunity_id = target_opportunity
  returning * into handoff;

  return handoff;
end;
$$;

revoke execute on function public.acknowledge_event_handoff_changes(uuid, integer) from public, anon;
grant execute on function public.acknowledge_event_handoff_changes(uuid, integer) to authenticated;
