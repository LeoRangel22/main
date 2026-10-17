-- Human-reviewed bank reconciliation with explicit references and idempotent retries.
create table event_private.payment_operations(
 request_id uuid primary key, proposal_id uuid not null references public.propostas(id),
 fingerprint text not null, kind text not null check(kind in ('sinal','saldo','estorno')),
 amount numeric not null check(amount>0), bank text not null, bank_reference text not null,
 reference_hash text not null unique, receipt_date date not null, reason text,
 recorded_by uuid not null references auth.users(id), recorded_at timestamptz not null default now(), result jsonb not null
);
alter table event_private.payment_operations enable row level security;
revoke all on event_private.payment_operations from public,anon,authenticated;
create table event_private.payment_requests(
 id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.propostas(id),
 fingerprint text not null,purpose text not null check(purpose in ('sinal','saldo')),amount numeric not null check(amount>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(proposal_id,fingerprint,purpose)
);
alter table event_private.payment_requests enable row level security;
revoke all on event_private.payment_requests from public,anon,authenticated;

create function public.record_event_bank_payment(target_proposal uuid,expected_revision bigint,request_key uuid,
 payment_kind text,payment_amount numeric,receipt_date date,bank_name text,bank_reference text,credit_confirmed boolean,reason text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; next_p public.propostas; prior event_private.payment_operations;
 fp text; ref_hash text; snap jsonb; value jsonb; signal numeric:=0; remaining numeric:=0; refund numeric; result jsonb;
begin
 perform event_private.require_team();
 if payment_kind='estorno' and not public.is_super_admin() then raise insufficient_privilege using message='Estorno exige gestor e conferência da saída bancária.';end if;
 if payment_kind='saldo' and not event_private.journey_financial_operator() then raise insufficient_privilege using message='Pagamento restante exige Financeiro ou gestor.';end if;
 if payment_kind not in ('sinal','saldo','estorno') or request_key is null or credit_confirmed is distinct from true
  or payment_amount is null or payment_amount::text in ('NaN','Infinity','-Infinity') or payment_amount<=0 or payment_amount<>round(payment_amount,2)
  or receipt_date is null or receipt_date>(now() at time zone 'America/Sao_Paulo')::date
  or length(trim(coalesce(bank_name,''))) not between 2 and 80 or length(trim(coalesce(bank_reference,''))) not between 3 and 160 then
  raise exception 'Informe valor, data efetiva, banco, identificação do extrato e confirmação da movimentação.';end if;
 fp:=encode(extensions.digest(jsonb_build_array(target_proposal,payment_kind,payment_amount,receipt_date,trim(bank_name),trim(bank_reference),trim(reason))::text,'sha256'),'hex');
 ref_hash:=encode(extensions.digest(upper(trim(bank_name))||':'||upper(trim(bank_reference)),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into prior from event_private.payment_operations where request_id=request_key;
 if found then
  if prior.fingerprint<>fp or prior.proposal_id<>target_proposal then raise exception using errcode='PT409',message='A identificação desta tentativa já foi usada com dados diferentes.';end if;
  return prior.result||'{"existing":true}'::jsonb;
 end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize antes de registrar o pagamento.';end if;
 if p.is_current is distinct from true or p.snapshot ? 'amendmentOf' or p.publication_status='draft' then raise exception 'Use o acordo vigente, sem rascunho de aditivo.';end if;
 if exists(select 1 from event_private.payment_operations where reference_hash=ref_hash) then raise exception using errcode='PT409',message='Esta movimentação bancária já foi registrada. Confira o histórico; não repita o crédito.';end if;
 if event_private.audited_payment(p) then signal:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric;end if;
 if event_private.audited_payment(p,'pagamentoRestante') then remaining:=(p.snapshot#>>'{pagamentoRestante,valor}')::numeric;end if;
 snap:=p.snapshot;
 if payment_kind='estorno' then
  if length(trim(reason))<10 or payment_amount>signal+remaining+0.01 or (p.status<>'cancelado' and payment_amount>greatest(0,signal+remaining-p.total)+0.01) then
   raise exception 'Estorno exige motivo e valor recebido auditado. Acordo ativo permite devolver apenas crédito excedente; cancelamento deve ser decidido antes.';end if;
  refund:=least(payment_amount,remaining);
  if refund>0 then
   if remaining-refund<0.01 then snap:=snap-'pagamentoRestante';
   else snap:=jsonb_set(snap,'{pagamentoRestante}',snap->'pagamentoRestante'||jsonb_build_object('valor',remaining-refund,'primeiraValidacaoEm',coalesce(snap#>>'{pagamentoRestante,primeiraValidacaoEm}',snap#>>'{pagamentoRestante,validadoEm}')));end if;
  end if;
  refund:=payment_amount-refund;
  if refund>0 then
   if signal-refund<0.01 then snap:=snap-'pagamentoSinal';
   else snap:=jsonb_set(snap,'{pagamentoSinal}',snap->'pagamentoSinal'||jsonb_build_object('valor',signal-refund,'motivoExcecao',reason,'primeiraValidacaoEm',coalesce(snap#>>'{pagamentoSinal,primeiraValidacaoEm}',snap#>>'{pagamentoSinal,validadoEm}')));end if;
  end if;
 else
  if p.status in ('cancelado','pos_venda') then raise exception 'Não registre novo crédito por este fluxo em acordo cancelado ou encerrado.';end if;
  if payment_kind='sinal' and signal>0 then raise exception 'Já existe sinal validado. Use pagamento restante ou a correção financeira existente.';end if;
  if payment_kind='saldo' and signal<=0 then raise exception 'Confira e valide o sinal antes de registrar parcelas do saldo.';end if;
  if signal+remaining+payment_amount>p.total+0.01 then raise exception 'Valor acima do saldo atual. Confira o extrato e o acordo antes de registrar.';end if;
  value:=jsonb_build_object('valor',case when payment_kind='saldo' then remaining+payment_amount else payment_amount end,
   'data',receipt_date,'bancos',jsonb_build_array(trim(bank_name)),'bankConferido',true,'referenciaBancaria',trim(bank_reference),'requestId',request_key,'motivoExcecao',trim(reason),
   'primeiraValidacaoEm',case when payment_kind='saldo' then coalesce(snap#>>'{pagamentoRestante,primeiraValidacaoEm}',snap#>>'{pagamentoRestante,validadoEm}',now()::text) else now()::text end);
  snap:=jsonb_set(snap,array[case when payment_kind='sinal' then 'pagamentoSinal' else 'pagamentoRestante' end],value,true);
 end if;
 select * into next_p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',snap,
  'status',case when payment_kind='sinal' and p.status not in ('confirmado','pagamento_final','planejamento','evento_proximo') then 'confirmado' else p.status end),p.revision,null);
 result:=jsonb_build_object('proposal_id',p.id,'revision',next_p.revision,'request_id',request_key,'kind',payment_kind,'amount',payment_amount,'existing',false);
 insert into event_private.payment_operations(request_id,proposal_id,fingerprint,kind,amount,bank,bank_reference,reference_hash,receipt_date,reason,recorded_by,result)
 values(request_key,p.id,fp,payment_kind,payment_amount,trim(bank_name),trim(bank_reference),ref_hash,receipt_date,left(trim(reason),2000),auth.uid(),result);
 return result;
end; $$;
revoke all on function public.record_event_bank_payment(uuid,bigint,uuid,text,numeric,date,text,text,boolean,text) from public,anon;
grant execute on function public.record_event_bank_payment(uuid,bigint,uuid,text,numeric,date,text,text,boolean,text) to authenticated;

create function public.prepare_event_payment_request(target_proposal uuid,expected_revision bigint,payment_purpose text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; charge event_private.payment_requests; amount_due numeric; paid numeric:=0; fp text;
begin
 perform event_private.require_team();
 if not event_private.operations_coordinator() and not event_private.journey_financial_operator() then raise insufficient_privilege;end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize antes de preparar a referência.';end if;
 if p.is_current is distinct from true or p.publication_status='draft' or p.snapshot ? 'amendmentOf' or p.status in ('cancelado','pos_venda') or payment_purpose not in ('sinal','saldo') then raise exception 'Use um acordo vigente aberto e escolha sinal ou saldo.';end if;
 if event_private.audited_payment(p) then paid:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric;end if;
 if event_private.audited_payment(p,'pagamentoRestante') then paid:=paid+(p.snapshot#>>'{pagamentoRestante,valor}')::numeric;end if;
 amount_due:=case when payment_purpose='sinal' then case when paid>0 then 0 else round(p.total*0.5,2) end else greatest(0,p.total-paid) end;
 if amount_due<=0 then raise exception 'Não há valor pendente para esta finalidade.';end if;
 if coalesce(p.snapshot#>>'{pagamentoSinal,valor}','0')::numeric>0 and not event_private.audited_payment(p) then raise exception 'Há sinal informado sem auditoria. Confira o banco antes de preparar outra solicitação de pagamento.';end if;
 fp:=event_private.proposal_fingerprint(p);
 insert into event_private.payment_requests(proposal_id,fingerprint,purpose,amount,created_by) values(p.id,fp,payment_purpose,amount_due,auth.uid())
  on conflict(proposal_id,fingerprint,purpose) do update set amount=excluded.amount returning * into charge;
 return jsonb_build_object('id',charge.id,'reference','EC-'||upper(replace(charge.id::text,'-','')),'amount',charge.amount,'purpose',charge.purpose,'provider_charge',false);
end; $$;
revoke all on function public.prepare_event_payment_request(uuid,bigint,text) from public,anon;
grant execute on function public.prepare_event_payment_request(uuid,bigint,text) to authenticated;

create function public.event_payment_history(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; paid numeric:=0;
begin
 perform event_private.require_team();select * into p from public.propostas where id=target_proposal;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize o histórico.';end if;
 if event_private.audited_payment(p) then paid:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric;end if;
 if event_private.audited_payment(p,'pagamentoRestante') then paid:=paid+(p.snapshot#>>'{pagamentoRestante,valor}')::numeric;end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'paid',paid,'due',case when p.status='cancelado' then 0 else greatest(0,p.total-paid) end,'credit',greatest(0,paid-p.total),
  'operations',coalesce((select jsonb_agg(jsonb_build_object('id',request_id,'kind',kind,'amount',amount,'bank',bank,'bank_reference',bank_reference,'date',receipt_date,'at',recorded_at) order by recorded_at) from event_private.payment_operations where proposal_id=p.id),'[]'),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('reference','EC-'||upper(replace(id::text,'-','')),'purpose',purpose,'amount',amount,'at',created_at)) from event_private.payment_requests where proposal_id=p.id and fingerprint=event_private.proposal_fingerprint(p)),'[]'));
end; $$;
revoke all on function public.event_payment_history(uuid,bigint) from public,anon;
grant execute on function public.event_payment_history(uuid,bigint) to authenticated;

create function public.get_public_event_payment_requests(proposal_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; resolved uuid; paid numeric:=0; signal_ok boolean;
begin
 select x.id into resolved from public.get_public_proposal(proposal_token) x;
 if resolved is null then return null;end if;
 select * into p from public.propostas where id=resolved;
 if p.is_current is distinct from true or p.status in ('cancelado','pos_venda') then return null;end if;
 signal_ok:=event_private.audited_payment(p);
 if coalesce(p.snapshot#>>'{pagamentoSinal,valor}','0')::numeric>0 and not signal_ok then return jsonb_build_object('proposal_id',p.id,'requests','[]'::jsonb);end if;
 if signal_ok then paid:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric;end if;
 if event_private.audited_payment(p,'pagamentoRestante') then paid:=paid+(p.snapshot#>>'{pagamentoRestante,valor}')::numeric;end if;
 return jsonb_build_object('proposal_id',p.id,'requests',coalesce((select jsonb_agg(jsonb_build_object('reference','EC-'||upper(replace(id::text,'-','')),'purpose',purpose,'amount',least(amount,case when purpose='sinal' then round(p.total*0.5,2) else greatest(0,p.total-paid) end)))
 from event_private.payment_requests where proposal_id=p.id and fingerprint=event_private.proposal_fingerprint(p) and (purpose<>'sinal' or not signal_ok) and p.total-paid>0),'[]'));
end; $$;
revoke all on function public.get_public_event_payment_requests(uuid) from public;
grant execute on function public.get_public_event_payment_requests(uuid) to anon,authenticated;

-- Pseudonymous analytics correlation; no raw opportunity ID or internal metadata.
CREATE OR REPLACE FUNCTION public.get_public_proposal(proposal_token uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, cliente_nome text, cliente_email text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, duracao numeric, subtotal numeric, taxa_servico numeric, privatizacao numeric, total numeric, status text, snapshot jsonb, cliente_resposta text, cliente_resposta_em timestamp with time zone, cliente_mensagem text, cliente_solicitacao jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     and event_private.remote_proposal_is_public(current_p)
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
      'analyticsEntityHash', left(encode(extensions.digest('ec-events:v1:'||p.oportunidade_id::text,'sha256'),'hex'),24),
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
      'selectedItems', event_private.public_proposal_items(p.snapshot),
      'versionChanges', p.snapshot -> 'versionChanges',
      'publicOfferOptions', p.snapshot -> 'publicOfferOptions',
      'generalTerms', p.snapshot -> 'generalTerms',
      'paymentTerms', p.snapshot -> 'paymentTerms',
      'clienteResposta', p.snapshot -> 'clienteResposta',
      'versao', p.versao,
      'publicRevision', p.revision
    )) as snapshot,
    p.cliente_resposta,
    p.cliente_resposta_em,
    p.cliente_mensagem,
    p.cliente_solicitacao
  from public.propostas p
  join resolved r on r.resolved_id = p.id
  where p.public_token_revoked_at is null
    and p.public_token_expires_at > now()
    and p.publication_status <> 'draft'
    and event_private.remote_proposal_is_public(p)
  limit 1;
$function$
;

