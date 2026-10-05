-- Run with the project's SQL editor/maintenance connection.
-- Uses existing rows inside a rolled-back transaction; no messages are sent.
begin;
do $verify$
declare
  proposal_row public.propostas%rowtype;
  opp public.oportunidades%rowtype;
  plan_owner text := 'eventos@embaixadacarioca.com.br';
  reassigned_owner text;
  f record;
begin
  select p.* into proposal_row from public.propostas p
    join public.oportunidades o on o.id = p.oportunidade_id
    where p.is_current and p.publication_status <> 'draft'
    order by p.created_at limit 1;
  assert proposal_row.id is not null, 'An existing current proposal is required';
  update public.oportunidades set responsavel_email = plan_owner, responsavel_id = null
    where id = proposal_row.oportunidade_id;
  update public.propostas set cliente_mensagem = cliente_mensagem where id = proposal_row.id;
  select * into opp from public.oportunidades where id = proposal_row.oportunidade_id;
  assert opp.responsavel_email = plan_owner, 'Proposal updates must preserve the planned owner';

  reassigned_owner := case when proposal_row.responsavel_email = 'leorangel@gmail.com'
    then 'eventos@embaixadacarioca.com.br' else 'leorangel@gmail.com' end;
  update public.propostas set responsavel_email = reassigned_owner, responsavel_id = null
    where id = proposal_row.id;
  select * into opp from public.oportunidades where id = proposal_row.oportunidade_id;
  assert opp.responsavel_email = reassigned_owner, 'Explicit reassignment must still work';

  update public.oportunidades set status = 'proposta_enviada',
    proxima_acao = 'Retorno combinado', proxima_acao_em = now() + interval '3 days',
    metadata = jsonb_set(metadata, '{next_action_source}', '"manual"'::jsonb)
    where id = proposal_row.oportunidade_id;
  update public.oportunidades set status = 'negociacao' where id = proposal_row.oportunidade_id;
  select * into opp from public.oportunidades where id = proposal_row.oportunidade_id;
  assert opp.proxima_acao = 'Retorno combinado', 'Manual plan must survive a stage transition';
  update public.oportunidades set status = 'perdido' where id = proposal_row.oportunidade_id;
  select * into opp from public.oportunidades where id = proposal_row.oportunidade_id;
  assert opp.proxima_acao is null and opp.proxima_acao_em is null, 'Closed opportunity must clear sales deadlines';

  assert position('versionChanges' in pg_get_functiondef('public.get_public_proposal(uuid)'::regprocedure)) > 0,
    'Public proposal must include the customer-visible version comparison';
  assert not has_function_privilege('anon', 'public.get_my_event_history()', 'execute'), 'History requires authentication';
  assert not has_function_privilege('anon', 'public.refresh_my_proposal_link(uuid)', 'execute'), 'Link refresh requires authentication';
  for f in select oid from pg_proc where pronamespace = 'public'::regnamespace
      and prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    assert not has_function_privilege('anon', f.oid, 'execute'), 'Internal trigger must not be an anonymous RPC';
  end loop;
end
$verify$;
select 'sales_funnel_completion: all assertions passed; changes will be rolled back' as result;
rollback;
