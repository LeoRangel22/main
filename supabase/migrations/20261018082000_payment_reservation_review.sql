-- Review fixes are additive. No payment, reservation or acknowledgement is backfilled.
-- NULL/malformed JSON is not a positive audited receipt. Keep this one predicate
-- shared by the portal, reservation, financial coverage and operational release.
create or replace function event_private.audited_payment(p public.propostas, payment_key text default 'pagamentoSinal') returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v jsonb:=p.snapshot->payment_key; actor text; stamped timestamptz;
begin
 if payment_key is null or payment_key not in ('pagamentoSinal','pagamentoRestante')
   or jsonb_typeof(v) is distinct from 'object'
   or jsonb_typeof(v->'valor') is distinct from 'number'
   or v->'validacaoPendente' is distinct from 'false'::jsonb then return false;end if;
 if (v->>'valor')::numeric<=0 then return false;end if;
 begin stamped:=(v->>'validadoEm')::timestamptz;exception when others then return false;end;
 if stamped is null or not isfinite(stamped) or stamped>now()+interval '1 minute' then return false;end if;
 select lower(email) into actor from auth.users where id::text=v->>'validadoPor';
 return coalesce(actor in ('leorangel@gmail.com','financeiro@embaixadacarioca.com.br')
   or (payment_key='pagamentoSinal' and actor='eventos@embaixadacarioca.com.br' and v->'bankConferido'='true'::jsonb),false);
end; $$;
revoke all on function event_private.audited_payment(public.propostas,text) from public,anon,authenticated;

-- A non-null payment record must be reviewed before any further payment is solicited.
create function event_private.payment_review_required(p public.propostas) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from unnest(array['pagamentoSinal','pagamentoRestante']) payment_key
  where nullif(p.snapshot->payment_key,'null'::jsonb) is not null
    and event_private.audited_payment(p,payment_key) is distinct from true
 );
$$;
revoke all on function event_private.payment_review_required(public.propostas) from public,anon,authenticated;


create or replace function event_private.public_payment_summary(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 r:=event_private.operation_readiness(p);
 return jsonb_build_object('signalAudited',r->'signal_audited','reservationAudited',r->'reservation_audited',
  'paidAmount',r->'paid_audited','balanceDue',r->'balance_due',
  'depositDueAmount',case when (r->>'signal_audited')::boolean then 0
    when event_private.deposit_fraction(p)>=0.5 then round(p.total*event_private.deposit_fraction(p),2) end,
  'depositApprovalRequired',not (r->>'signal_audited')::boolean and coalesce(event_private.deposit_fraction(p)<0.5,false),
  'paymentReviewRequired',event_private.payment_review_required(p));
end; $$;

create or replace function public.prepare_event_payment_request(target_proposal uuid,expected_revision bigint,payment_purpose text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; charge event_private.payment_requests; amount_due numeric; paid numeric:=0; fp text;
begin
 perform event_private.require_team();
 if not event_private.operations_coordinator() and not event_private.journey_financial_operator() then raise insufficient_privilege;end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O acordo mudou. Atualize antes de preparar a referência.';end if;
 if p.is_current is distinct from true or p.publication_status='draft' or p.snapshot ? 'amendmentOf' or p.status in ('cancelado','pos_venda') or payment_purpose is null or payment_purpose not in ('sinal','saldo') then raise exception 'Use um acordo vigente aberto e escolha sinal ou saldo.';end if;
 -- The existing exception is authorized when the manager reconciles a real receipt.
 -- It is not advance approval to solicit a smaller deposit from the customer.
 if payment_purpose='sinal' and event_private.deposit_fraction(p)<0.5 then
  raise insufficient_privilege using message='Sinal abaixo de 50% exige revisão e autorização do gestor. Este fluxo não prepara referência para essa condição; o gestor pode conferir e registrar um recebimento real pelo fluxo de exceção existente.';
 end if;
 if event_private.payment_review_required(p) then raise exception 'Há pagamento informado sem auditoria. Confira o sinal e o saldo no banco antes de preparar outra solicitação de pagamento.';end if;
 if event_private.audited_payment(p) then paid:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric;end if;
 if event_private.audited_payment(p,'pagamentoRestante') then paid:=paid+(p.snapshot#>>'{pagamentoRestante,valor}')::numeric;end if;
 amount_due:=case when payment_purpose='sinal' then case when paid>0 then 0 else round(p.total*event_private.deposit_fraction(p),2) end else greatest(0,p.total-paid) end;
 if amount_due is null then raise exception 'Condições de sinal personalizadas: revise o valor acordado antes de preparar a referência.';end if;
 if amount_due<=0 then raise exception 'Não há valor pendente para esta finalidade.';end if;
 fp:=event_private.public_proposal_fingerprint(p);
 insert into event_private.payment_requests(proposal_id,fingerprint,purpose,amount,created_by) values(p.id,fp,payment_purpose,amount_due,auth.uid())
  on conflict(proposal_id,fingerprint,purpose) do update set amount=excluded.amount returning * into charge;
 return jsonb_build_object('id',charge.id,'reference','EC-'||upper(replace(charge.id::text,'-','')),'amount',charge.amount,'purpose',charge.purpose,'provider_charge',false);
end; $$;

create or replace function public.get_public_event_payment_requests(proposal_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; resolved uuid; paid numeric:=0; signal_ok boolean;
begin
 select x.id into resolved from public.get_public_proposal(proposal_token) x;
 if resolved is null then return null;end if;
 select * into p from public.propostas where id=resolved;
 if p.is_current is distinct from true or p.status in ('cancelado','pos_venda') then return null;end if;
 signal_ok:=event_private.audited_payment(p);
 if event_private.payment_review_required(p) then return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'requests','[]'::jsonb);end if;
 if signal_ok then paid:=(p.snapshot#>>'{pagamentoSinal,valor}')::numeric;end if;
 if event_private.audited_payment(p,'pagamentoRestante') then paid:=paid+(p.snapshot#>>'{pagamentoRestante,valor}')::numeric;end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'requests',coalesce((select jsonb_agg(jsonb_build_object('reference','EC-'||upper(replace(id::text,'-','')),'purpose',purpose,'amount',least(amount,case when purpose='sinal' then round(p.total*event_private.deposit_fraction(p),2) else greatest(0,p.total-paid) end)))
 from event_private.payment_requests where proposal_id=p.id and fingerprint=event_private.public_proposal_fingerprint(p) and (purpose<>'sinal' or (not signal_ok and event_private.deposit_fraction(p)>=0.5)) and p.total-paid>0),'[]'));
end; $$;

-- Preserve the original evidence for an unchanged reservation, including retries
-- by another coordinator and reservation upserts caused by financial-only changes.
create or replace function event_private.stamp_reservation_agreement() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.propostas;
begin
 if new.status='confirmed' then
  select * into p from public.propostas where id=new.proposal_id;
  new.agreement_fingerprint:=event_private.proposal_fingerprint(p);
  if tg_op='UPDATE' and old.status='confirmed'
    and old.confirmed_by is not null and old.confirmed_at is not null
    and old.agreement_fingerprint=new.agreement_fingerprint
    and (old.opportunity_id,old.proposal_id,old.starts_at,old.ends_at,old.guests,old.exclusive)
      is not distinct from (new.opportunity_id,new.proposal_id,new.starts_at,new.ends_at,new.guests,new.exclusive) then
   new.confirmed_by:=old.confirmed_by;new.confirmed_at:=old.confirmed_at;
  else
   new.confirmed_by:=auth.uid();new.confirmed_at:=now();
  end if;
 else new.agreement_fingerprint:=null;new.confirmed_by:=null;new.confirmed_at:=null;end if;
 return new;
end; $$;


create or replace function public.confirm_event_reservation(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; payment jsonb; before_row public.event_reservations; after_row public.event_reservations; unchanged boolean;
begin
 perform event_private.require_team();
 if not event_private.operations_coordinator() then raise insufficient_privilege using message='Eventos ou gestor devem conferir a disponibilidade.'; end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='A proposta mudou. Revise o acordo atual antes de reservar.'; end if;
 if p.is_current is distinct from true or coalesce(p.publication_status,'') not in ('ready','sent') or p.snapshot ? 'amendmentOf' or coalesce(p.status,'') not in ('confirmado','pagamento_final','planejamento','evento_proximo')
  or p.data_evento is null or p.horario_evento is null or (p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo'<=now() then
  raise exception 'Use um acordo atual já confirmado e com início futuro. A reserva não reabre nem confirma a venda.';
 end if;
 payment:=p.snapshot->'pagamentoSinal';
 if event_private.audited_payment(p) is distinct from true then
  raise exception 'Confira o crédito e registre a validação auditada do sinal antes de reservar.';
 end if;
 if (payment->>'valor')::numeric+0.01<p.total*0.5 and (length(trim(coalesce(payment->>'motivoExcecao','')))<10 or nullif(payment->>'excecaoAutorizadaEm','') is null
  or not exists(select 1 from auth.users u where u.id::text=payment->>'excecaoAutorizadaPor' and lower(u.email)='leorangel@gmail.com')) then
  raise exception 'Revalide a exceção do sinal abaixo do padrão com o gestor antes de reservar.';
 end if;
 select * into before_row from public.event_reservations where opportunity_id=p.oportunidade_id;
 -- Existing shared lock, money/discount checks, overlapping reservations and legacy bookings.
 after_row:=event_private.reserve_proposal(p,'confirmed',null);
 unchanged:=before_row.proposal_id is not distinct from after_row.proposal_id and before_row.status='confirmed'
  and before_row.confirmed_by is not null and before_row.confirmed_at is not null
  and (before_row.agreement_fingerprint,before_row.confirmed_by,before_row.confirmed_at) is not distinct from (after_row.agreement_fingerprint,after_row.confirmed_by,after_row.confirmed_at)
  and (before_row.starts_at,before_row.ends_at,before_row.guests,before_row.exclusive) is not distinct from (after_row.starts_at,after_row.ends_at,after_row.guests,after_row.exclusive);
 if not coalesce(unchanged,false) then
  insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by)
  values(p.oportunidade_id,p.id,'note','internal','system','Disponibilidade e capacidade conferidas; reserva confirmada pela coordenação para a revisão '||p.revision::text||'. Esta ação não registra pagamento ou contato com cliente.',auth.uid());
 end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'reservation',to_jsonb(after_row),'already_confirmed',coalesce(unchanged,false));
end; $$;

-- Replacement functions retain their narrow existing grants.
revoke all on function event_private.public_payment_summary(public.propostas) from public,anon,authenticated;
revoke all on function event_private.stamp_reservation_agreement() from public,anon,authenticated;
revoke all on function public.prepare_event_payment_request(uuid,bigint,text) from public,anon;
grant execute on function public.prepare_event_payment_request(uuid,bigint,text) to authenticated;
revoke all on function public.confirm_event_reservation(uuid,bigint) from public,anon;
grant execute on function public.confirm_event_reservation(uuid,bigint) to authenticated;
revoke all on function public.get_public_event_payment_requests(uuid) from public;
grant execute on function public.get_public_event_payment_requests(uuid) to anon,authenticated;

-- Applying an accepted amendment moves the reservation as well. Every payment
-- transferred to that agreement must satisfy the same canonical audit predicate.
create or replace function public.apply_event_amendment(target_amendment uuid,expected_base_revision bigint,expected_draft_revision bigint,signal_exception_reason text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a event_private.event_amendments; opp uuid; base public.propostas; draft public.propostas; next_base public.propostas; next_draft public.propostas;
 payment jsonb; remaining jsonb; amount numeric; paid numeric; key text; exception_reason text:=trim(coalesce(signal_exception_reason,''));
begin
 perform event_private.require_team();
 if not public.is_super_admin() then raise insufficient_privilege using message='Aplicação exclusiva do gestor'; end if;
 if length(exception_reason)>2000 then raise exception 'Justificativa muito longa'; end if;
 select opportunity_id into opp from event_private.event_amendments where id=target_amendment;
 if opp is null then raise exception 'Aditivo não encontrado'; end if;
 perform event_private.lock_proposal_group(opp);
 select * into a from event_private.event_amendments where id=target_amendment for update;
 if a.base_revision is distinct from expected_base_revision or a.draft_revision is distinct from expected_draft_revision then raise exception using errcode='PT409',message='Revise as versões do aditivo antes de aplicar'; end if;
 if a.status='applied' then return jsonb_build_object('id',a.id,'status',a.status,'proposal_id',a.draft_id,'existing',true); end if;
 if a.status<>'client_accepted' or a.decided_by is null or a.decided_at is null or a.expires_at is null or a.client_action<>'accept' or a.client_response_at is null or a.expires_at<=now() then raise exception 'A aplicação exige aprovação do gestor e aceite vigente do cliente'; end if;
 perform event_private.assert_amendment_current(a);
 select * into base from public.propostas where id=a.base_id for update;
 select * into draft from public.propostas where id=a.draft_id for update;
 payment:=base.snapshot->'pagamentoSinal'; remaining:=nullif(base.snapshot->'pagamentoRestante','null'::jsonb); paid:=0;
 foreach key in array array['pagamentoSinal','pagamentoRestante'] loop
  payment:=nullif(base.snapshot->key,'null'::jsonb);
  if payment is null and key='pagamentoRestante' then continue; end if;
  if jsonb_typeof(payment->'valor') is distinct from 'number' then raise exception 'Financeiro deve conferir os pagamentos antes de aplicar o aditivo'; end if;
  amount:=(payment->>'valor')::numeric;
  if event_private.audited_payment(base,key) is distinct from true then
   raise exception 'Financeiro deve registrar validação bancária auditada dos pagamentos antes de aplicar o aditivo';
  end if;
  paid:=paid+amount;
 end loop;
 if paid>draft.total+0.01 then raise exception 'Os pagamentos superam o novo total. Resolva o crédito ou estorno com o Financeiro antes de aplicar; nenhum valor foi compensado automaticamente.'; end if;
 payment:=base.snapshot->'pagamentoSinal';
 if (payment->>'valor')::numeric+0.01<draft.total*0.5 then
  if length(exception_reason)<10 then raise exception 'O sinal ficou abaixo de 50%% do novo total. Confira o complemento com o Financeiro ou autorize uma exceção justificada de pelo menos 10 caracteres.'; end if;
  payment:=payment||jsonb_build_object('motivoExcecao',exception_reason,'excecaoAutorizadaPor',auth.uid(),'excecaoAutorizadaEm',now());
 end if;
 next_base:=base;next_base.is_current:=false;next_base.superseded_at:=now();
 next_draft:=draft;next_draft.is_current:=true;next_draft.publication_status:='ready';next_draft.status:=base.status;
 next_draft.journey_booked_locked:=true;next_draft.journey_commercial_locked:=true;
 next_draft.snapshot:=(draft.snapshot-'amendmentOf'-'pagamentoSinal'-'pagamentoRestante'-'clienteResposta')||jsonb_build_object('pagamentoSinal',payment,'appliedAmendment',jsonb_build_object('id',a.id,'baseId',base.id,'approvedBy',a.decided_by,'approvedAt',a.decided_at,'acceptedAt',a.client_response_at));
 if remaining is not null then next_draft.snapshot:=next_draft.snapshot||jsonb_build_object('pagamentoRestante',remaining); end if;
 next_draft.cliente_resposta:='confirmar';next_draft.cliente_resposta_em:=a.client_response_at;next_draft.cliente_mensagem:=a.client_message;
 next_draft.cliente_solicitacao:=jsonb_build_object('source','amendment','amendment_id',a.id,'accepted_name',a.client_name);
 next_draft.public_token_expires_at:=greatest(draft.public_token_expires_at,now()+interval '90 days');
 perform event_private.assert_money(next_draft);
 -- Shared capacity lock/check runs before either agreement changes. Any error rolls back everything.
 perform event_private.reserve_proposal(next_draft,'confirmed',null);
 insert into event_private.amendment_apply_context values
  (txid_current(),pg_backend_pid(),auth.uid(),base.id,base.revision,to_jsonb(next_base)),
  (txid_current(),pg_backend_pid(),auth.uid(),draft.id,draft.revision,to_jsonb(next_draft));
 update public.propostas set is_current=false,superseded_at=next_base.superseded_at where id=base.id;
 update public.propostas set is_current=true,publication_status=next_draft.publication_status,status=next_draft.status,
 journey_booked_locked=true,journey_commercial_locked=true,snapshot=next_draft.snapshot,
 cliente_resposta=next_draft.cliente_resposta,cliente_resposta_em=next_draft.cliente_resposta_em,
 cliente_mensagem=next_draft.cliente_mensagem,cliente_solicitacao=next_draft.cliente_solicitacao,
 public_token_expires_at=next_draft.public_token_expires_at where id=draft.id returning * into next_draft;
 delete from event_private.amendment_apply_context where transaction_id=txid_current() and backend_id=pg_backend_pid();
 -- Manager release and client acceptance authorize this exact newly effective public agreement.
 insert into event_private.proposal_public_baseline(proposal_id,fingerprint) values(next_draft.id,event_private.public_proposal_fingerprint(next_draft))
 on conflict(proposal_id) do update set fingerprint=excluded.fingerprint;
 update event_private.event_amendments set status='applied',applied_by=auth.uid(),applied_at=now() where id=a.id;
 insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by)
 values(opp,draft.id,'note','internal','system','Aditivo aprovado pelo gestor e aceito pelo link do cliente aplicado. Acordo anterior preservado; reserva revista e nova ciência dos setores necessária.',auth.uid());
 return jsonb_build_object('id',a.id,'status','applied','proposal_id',draft.id,'existing',false);
end; $$;
revoke all on function public.apply_event_amendment(uuid,bigint,bigint,text) from public,anon;
grant execute on function public.apply_event_amendment(uuid,bigint,bigint,text) to authenticated;
