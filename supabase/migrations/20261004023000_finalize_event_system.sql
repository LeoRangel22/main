-- Finalize the remaining database-side work for the event system.
-- Safe to run repeatedly in production. Preview branches without the legacy
-- schema receive notices instead of failing their deployment.

do $migration$
begin
  if to_regclass('public.propostas') is null then
    raise notice 'Skipping get_public_proposal: public.propostas is not present in this preview branch';
  else
    execute $function$
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
      as $body$
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
            'event', jsonb_build_object(
              'type', p.snapshot #> '{event,type}',
              'validity', p.snapshot #> '{event,validity}',
              'signalDeadlineHours', p.snapshot #> '{event,signalDeadlineHours}',
              'signalDeadlineAt', p.snapshot #> '{event,signalDeadlineAt}',
              'clientLanguage', p.snapshot #> '{event,clientLanguage}'
            ),
            'totals', jsonb_build_object(
              'subtotal', p.subtotal,
              'serviceFee', p.taxa_servico,
              'privatizationAmount', p.privatizacao,
              'total', p.total,
              'privatization', jsonb_build_object('mode', p.snapshot #> '{totals,privatization,mode}')
            ),
            'selectedItems', p.snapshot -> 'selectedItems',
            'versionChanges', p.snapshot -> 'versionChanges',
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
        limit 1
      $body$;
    $function$;

    execute 'grant execute on function public.get_public_proposal(uuid) to anon, authenticated';
  end if;

  if to_regclass('public.solicitacoes_cotacao') is null
     or to_regprocedure('public.notify_new_lead_fn()') is null then
    raise notice 'Skipping completion trigger: legacy lead table or notification function is not present in this preview branch';
  elsif not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.solicitacoes_cotacao'::regclass
      and tgname = 'notify_completed_quote_webhook'
      and not tgisinternal
  ) then
    create trigger notify_completed_quote_webhook
    after update of capture_status on public.solicitacoes_cotacao
    for each row
    when (old.capture_status = 'partial' and new.capture_status = 'complete')
    execute function public.notify_new_lead_fn();
  end if;
end
$migration$;
