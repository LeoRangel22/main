-- Explicit amendment lifecycle. No existing agreements or operational decisions are backfilled.
create table event_private.event_amendments (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.oportunidades(id),
 base_id uuid not null references public.propostas(id), draft_id uuid not null references public.propostas(id),
 base_revision bigint not null, draft_revision bigint not null, before_record jsonb not null, after_record jsonb not null,
 content_hash text not null, summary text not null check(length(summary) between 10 and 2000),
 status text not null default 'pending_manager' check(status in ('pending_manager','awaiting_client','client_accepted','changes_requested','rejected','withdrawn','applied')),
 requested_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 decided_by uuid references auth.users(id), decided_at timestamptz, decision_note text,
 client_token uuid unique, expires_at timestamptz, client_action text, client_name text, client_message text,
 client_response_at timestamptz, client_request_id uuid, applied_by uuid references auth.users(id), applied_at timestamptz,
 withdrawn_by uuid references auth.users(id),withdrawn_at timestamptz,withdrawal_reason text,
 check(base_id<>draft_id)
);
create unique index event_amendments_active_opportunity on event_private.event_amendments(opportunity_id)
 where status in ('pending_manager','awaiting_client','client_accepted');
create index event_amendments_draft on event_private.event_amendments(draft_id);
alter table event_private.event_amendments enable row level security;
revoke all on event_private.event_amendments from public,anon,authenticated;

-- Transaction-local capability. Clients cannot insert this context or forge it through a GUC.
create table event_private.amendment_apply_context (
 transaction_id bigint not null, backend_id integer not null, actor uuid not null,
 proposal_id uuid not null, original_revision bigint not null, expected_record jsonb not null,
 primary key(transaction_id,backend_id,proposal_id)
);
alter table event_private.amendment_apply_context enable row level security;
revoke all on event_private.amendment_apply_context from public,anon,authenticated;
create function event_private.amendment_application_allowed(prior public.propostas, next_row public.propostas) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from event_private.amendment_apply_context c
 where c.transaction_id=txid_current() and c.backend_id=pg_backend_pid() and c.actor=auth.uid()
 and public.is_super_admin() and c.proposal_id=prior.id and prior.id=next_row.id and prior.revision=c.original_revision
 and (to_jsonb(next_row)-array['revision','updated_at'])=(c.expected_record-array['revision','updated_at']));
$$;
revoke all on function event_private.amendment_application_allowed(public.propostas,public.propostas) from public,anon,authenticated;
grant execute on function event_private.amendment_application_allowed(public.propostas,public.propostas) to service_role;
-- Applying an accepted amendment is not a transport send. Preserve existing promotion behavior elsewhere.
create or replace function public.promote_proposal_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if event_private.amendment_application_allowed(old,new) then return new; end if;
 if new.oportunidade_id is not null and coalesce(new.is_current,false) and not coalesce(old.is_current,false) then
  update public.propostas set is_current=false,superseded_at=now() where oportunidade_id=new.oportunidade_id and id<>new.id and is_current;
  if new.status='proposta_pronta' then new.publication_status:='ready';new.sent_at:=null;
  else new.publication_status:='sent';new.sent_at:=coalesce(new.sent_at,now());end if;
  new.superseded_at:=null;
 end if;
 return new;
end; $$;
revoke all on function public.promote_proposal_version() from public,anon,authenticated;
create function event_private.assert_amendment_application_row() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from event_private.amendment_apply_context where transaction_id=txid_current() and backend_id=pg_backend_pid() and proposal_id=new.id)
 and not event_private.amendment_application_allowed(old,new) then raise exception 'A aplicação encontrou uma alteração inesperada. Nenhum acordo foi substituído.'; end if;
 return new;
end; $$;
revoke all on function event_private.assert_amendment_application_row() from public,anon,authenticated;
create trigger amendment_assert_final after update on public.propostas for each row execute function event_private.assert_amendment_application_row();
-- Keep all original guards. Only exact rows authorized by apply_event_amendment skip them.
drop trigger journey_guard_proposal on public.propostas;
create trigger journey_guard_proposal before insert on public.propostas for each row execute function event_private.guard_journey_proposal();
create trigger journey_guard_proposal_update before update on public.propostas for each row
 when(not event_private.amendment_application_allowed(old,new)) execute function event_private.guard_journey_proposal();
create function event_private.freeze_submitted_amendment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from event_private.event_amendments a where a.draft_id=old.id and a.status in ('pending_manager','awaiting_client','client_accepted'))
 and not event_private.amendment_application_allowed(old,new) then
  raise exception using errcode='PT409',message='Este aditivo está em revisão. Retire a solicitação antes de editar; o conteúdo revisado deve permanecer íntegro.';
 end if;
 return new;
end; $$;
revoke all on function event_private.freeze_submitted_amendment() from public,anon,authenticated;
create trigger amendment_freeze before update on public.propostas for each row execute function event_private.freeze_submitted_amendment();

create function event_private.public_proposal_items(snapshot jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',i->'id','name',coalesce(i->'name',i->'nome'),'nome',coalesce(i->'nome',i->'name'),
  'description',coalesce(i->'description',i->'descricao'),'descricao',coalesce(i->'descricao',i->'description'),
  'calc',jsonb_build_object('total',coalesce(i#>'{calc,total}',i->'total'),'detail',coalesce(i#>'{calc,detail}',i#>'{calc,label}'))
 ))),'[]') from jsonb_array_elements(case when jsonb_typeof(snapshot->'selectedItems')='array' then snapshot->'selectedItems' else '[]' end) i;
$$;
revoke all on function event_private.public_proposal_items(jsonb) from public,anon,authenticated;

create function event_private.amendment_public_record(p public.propostas) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('version',p.versao,'client',p.cliente_nome,'type',p.tipo_evento,'date',p.data_evento,'time',p.horario_evento,
 'guests',p.convidados,'duration',p.duracao,'subtotal',p.subtotal,'service',p.taxa_servico,'private',p.privatizacao,'total',p.total,
 'adjustment',p.snapshot#>'{totals,adjustment}','private_adjustment',p.snapshot#>'{totals,privatizationAdjustment}',
 'items',event_private.public_proposal_items(p.snapshot),'terms',p.snapshot->'generalTerms','payment_terms',p.snapshot->'paymentTerms');
$$;
revoke all on function event_private.amendment_public_record(public.propostas) from public,anon,authenticated;
create function event_private.assert_amendment_current(a event_private.event_amendments) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.propostas p where p.id=a.base_id and p.is_current and p.revision=a.base_revision
  and p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
  and (p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo'>now())
 or not exists(select 1 from public.propostas p where p.id=a.draft_id and p.revision=a.draft_revision and not p.is_current and p.publication_status='draft'
  and (p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo'>now()) then
  raise exception using errcode='PT409',message='O acordo ou o rascunho mudou, ou o evento já começou. Retire esta solicitação e prepare uma nova revisão.';
 end if;
end; $$;
revoke all on function event_private.assert_amendment_current(event_private.event_amendments) from public,anon,authenticated;

create function public.request_event_amendment(target_draft uuid,expected_revision bigint,client_summary text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; base public.propostas; a event_private.event_amendments; opp uuid; note text:=trim(client_summary);
begin
 perform event_private.require_team();
 if note is null or length(note)<10 or length(note)>2000 then raise exception 'Descreva a alteração para o cliente em 10 a 2000 caracteres.'; end if;
 select oportunidade_id into opp from public.propostas where id=target_draft;
 if opp is null then raise exception 'Rascunho não encontrado'; end if;
 perform event_private.lock_proposal_group(opp);
 select * into p from public.propostas where id=target_draft for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='O rascunho mudou. Atualize antes de solicitar revisão.'; end if;
 select * into a from event_private.event_amendments where opportunity_id=opp and status in ('pending_manager','awaiting_client','client_accepted');
 if found then
  if a.draft_id=p.id and a.draft_revision=p.revision then return jsonb_build_object('id',a.id,'status',a.status,'existing',true); end if;
  raise exception 'Já existe um aditivo em andamento para este evento. Conclua ou retire a solicitação anterior.';
 end if;
 select * into base from public.propostas where oportunidade_id=opp and is_current for update;
 if not found or p.is_current or p.publication_status<>'draft' or p.snapshot#>>'{amendmentOf,id}' is distinct from base.id::text
  or p.snapshot#>>'{amendmentOf,revision}' is distinct from base.revision::text then
  raise exception 'Use um rascunho de aditivo criado a partir da revisão atual do acordo confirmado.';
 end if;
 if p.cliente_nome is distinct from base.cliente_nome or p.cliente_email is distinct from base.cliente_email or p.cliente_whatsapp is distinct from base.cliente_whatsapp then
  raise exception 'O aditivo deve manter a identidade e os contatos do cliente do acordo atual.';
 end if;
 if base.status not in ('confirmado','pagamento_final','planejamento','evento_proximo') or base.publication_status not in ('ready','sent')
  or base.data_evento is null or base.horario_evento is null or (base.data_evento+base.horario_evento) at time zone 'America/Sao_Paulo'<=now()
  or p.data_evento is null or p.horario_evento is null or (p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo'<=now()
  or p.convidados is null or p.convidados<1 or p.duracao is null or p.duracao<=0 or p.duracao>24
  or nullif(p.snapshot->'pagamentoSinal','null'::jsonb) is not null or nullif(p.snapshot->'pagamentoRestante','null'::jsonb) is not null then
  raise exception 'Aditivo exige acordo confirmado futuro e rascunho completo, sem novos registros de pagamento.';
 end if;
 perform event_private.assert_money(p);
 if jsonb_typeof(p.snapshot->'selectedItems') is distinct from 'array' then raise exception 'Inclua os itens do novo acordo'; end if;
 if jsonb_array_length(p.snapshot->'selectedItems')=0 then raise exception 'Inclua os itens do novo acordo'; end if;
 if event_private.amendment_public_record(p)-'version'=event_private.amendment_public_record(base)-'version' then raise exception 'O aditivo precisa alterar o escopo comercial do acordo.'; end if;
 insert into event_private.event_amendments(opportunity_id,base_id,draft_id,base_revision,draft_revision,before_record,after_record,content_hash,summary,requested_by)
 values(opp,base.id,p.id,base.revision,p.revision,to_jsonb(base),to_jsonb(p),
 encode(extensions.digest(jsonb_build_array(event_private.amendment_public_record(base),event_private.amendment_public_record(p),note)::text,'sha256'),'hex'),note,auth.uid()) returning * into a;
 return jsonb_build_object('id',a.id,'status',a.status,'existing',false);
end; $$;
revoke all on function public.request_event_amendment(uuid,bigint,text) from public,anon;
grant execute on function public.request_event_amendment(uuid,bigint,text) to authenticated;

create function public.decide_event_amendment(target_amendment uuid,decision text,expected_status text,decision_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a event_private.event_amendments; opp uuid; base public.propostas; draft public.propostas;
begin
 perform event_private.require_team();
 if not public.is_super_admin() then raise insufficient_privilege using message='Decisão exclusiva do gestor'; end if;
 if decision is null or decision not in ('approve','changes_requested','rejected') then raise exception 'Decisão inválida'; end if;
 if length(coalesce(decision_note,''))>2000 or (decision<>'approve' and length(trim(coalesce(decision_note,'')))<10) then raise exception 'Explique a decisão em 10 a 2000 caracteres'; end if;
 select opportunity_id into opp from event_private.event_amendments where id=target_amendment;
 if opp is null then raise exception 'Aditivo não encontrado'; end if;
 perform event_private.lock_proposal_group(opp);
 select * into a from event_private.event_amendments where id=target_amendment for update;
 if a.status is distinct from expected_status or a.status<>'pending_manager' then raise exception using errcode='PT409',message='O aditivo já mudou. Atualize antes de decidir.'; end if;
 perform event_private.assert_amendment_current(a);
 base:=jsonb_populate_record(null::public.propostas,a.before_record); draft:=jsonb_populate_record(null::public.propostas,a.after_record);
 if decision='approve' then
  insert into public.event_discount_approvals(proposal_id,fingerprint,approved_by,approved_email)
  values(draft.id,event_private.proposal_fingerprint(draft),auth.uid(),(select lower(email) from auth.users where id=auth.uid()))
  on conflict(proposal_id) do update set fingerprint=excluded.fingerprint,approved_by=excluded.approved_by,approved_email=excluded.approved_email,approved_at=now();
 end if;
 update event_private.event_amendments set status=case when decision='approve' then 'awaiting_client' else decision end,
 decided_by=auth.uid(),decided_at=now(),decision_note=trim(decide_event_amendment.decision_note),
 client_token=case when decision='approve' then gen_random_uuid() end,
 expires_at=case when decision='approve' then least(now()+interval '7 days',(base.data_evento+base.horario_evento) at time zone 'America/Sao_Paulo',(draft.data_evento+draft.horario_evento) at time zone 'America/Sao_Paulo') end
 where id=a.id returning * into a;
 return jsonb_build_object('id',a.id,'status',a.status);
end; $$;
revoke all on function public.decide_event_amendment(uuid,text,text,text) from public,anon;
grant execute on function public.decide_event_amendment(uuid,text,text,text) to authenticated;

create function public.withdraw_event_amendment(target_amendment uuid,expected_status text,reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a event_private.event_amendments; opp uuid;
begin
 perform event_private.require_team();
 if length(trim(coalesce(reason,'')))<10 or length(reason)>2000 then raise exception 'Informe o motivo da retirada em 10 a 2000 caracteres'; end if;
 select opportunity_id into opp from event_private.event_amendments where id=target_amendment;
 if opp is null then raise exception 'Aditivo não encontrado'; end if;
 perform event_private.lock_proposal_group(opp);
 select * into a from event_private.event_amendments where id=target_amendment for update;
 if not public.is_super_admin() and a.requested_by<>auth.uid() then raise insufficient_privilege using message='Somente o solicitante ou gestor pode retirar este aditivo'; end if;
 if a.status is distinct from expected_status or a.status not in ('pending_manager','awaiting_client','client_accepted') then raise exception using errcode='PT409',message='O aditivo já mudou. Atualize antes de retirar.'; end if;
 update event_private.event_amendments set status='withdrawn',withdrawal_reason=trim(reason),withdrawn_by=auth.uid(),withdrawn_at=now(),client_token=null where id=a.id;
 return jsonb_build_object('id',a.id,'status','withdrawn');
end; $$;
revoke all on function public.withdraw_event_amendment(uuid,text,text) from public,anon;
grant execute on function public.withdraw_event_amendment(uuid,text,text) to authenticated;

create function public.get_public_event_amendment(amendment_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a event_private.event_amendments;
begin
 select * into a from event_private.event_amendments where client_token=amendment_token and status in ('awaiting_client','client_accepted','changes_requested','applied') and decided_by is not null;
 if not found or a.expires_at is null or a.expires_at<=now() then return null; end if;
 if a.status<>'applied' then perform event_private.assert_amendment_current(a); end if;
 return jsonb_build_object('id',a.id,'hash',a.content_hash,'summary',a.summary,'status',a.status,'expires_at',a.expires_at,
 'before',event_private.amendment_public_record(jsonb_populate_record(null::public.propostas,a.before_record)),
 'after',event_private.amendment_public_record(jsonb_populate_record(null::public.propostas,a.after_record)),
 'responded_at',a.client_response_at,'client_action',a.client_action);
end; $$;
revoke all on function public.get_public_event_amendment(uuid) from public;
grant execute on function public.get_public_event_amendment(uuid) to anon,authenticated;

create function public.respond_public_event_amendment(amendment_token uuid,expected_hash text,client_action text,client_name text,client_message text,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a event_private.event_amendments; opp uuid; action text:=client_action; name text:=trim(client_name); message text:=trim(coalesce(client_message,''));
begin
 if action is null or action not in ('accept','changes_requested') or request_id is null or name is null or length(name)<2 or length(name)>120 or length(message)>2000 then raise exception 'Confira seu nome e a resposta ao aditivo'; end if;
 if action='changes_requested' and length(message)<10 then raise exception 'Descreva os ajustes desejados em pelo menos 10 caracteres'; end if;
 select opportunity_id into opp from event_private.event_amendments where client_token=amendment_token;
 if opp is null then raise exception 'Link de aditivo indisponível'; end if;
 perform event_private.lock_proposal_group(opp);
 select * into a from event_private.event_amendments where client_token=amendment_token for update;
 if not found or a.content_hash is distinct from expected_hash or a.decided_by is null or a.decided_at is null or a.expires_at is null or a.expires_at<=now() then raise exception 'Link expirado ou conteúdo alterado. Solicite uma nova revisão.'; end if;
 if a.client_request_id=request_id and a.client_action=action then return jsonb_build_object('id',a.id,'status',a.status); end if;
 if a.status<>'awaiting_client' then raise exception using errcode='PT409',message='Já existe uma resposta para este aditivo. Atualize a página para conferir.'; end if;
 perform event_private.assert_amendment_current(a);
 update event_private.event_amendments set status=case when action='accept' then 'client_accepted' else 'changes_requested' end,
 client_action=action,client_name=name,client_message=message,client_response_at=now(),client_request_id=request_id where id=a.id;
 -- The original proposal, reservation and operational tasks remain untouched.
 return jsonb_build_object('id',a.id,'status',case when action='accept' then 'client_accepted' else 'changes_requested' end);
end; $$;
revoke all on function public.respond_public_event_amendment(uuid,text,text,text,text,uuid) from public;
grant execute on function public.respond_public_event_amendment(uuid,text,text,text,text,uuid) to anon,authenticated;

create function public.apply_event_amendment(target_amendment uuid,expected_base_revision bigint,expected_draft_revision bigint,signal_exception_reason text default '') returns jsonb
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
  if amount<=0 or payment->>'validacaoPendente'='true' or nullif(payment->>'validadoEm','') is null or not exists(select 1 from auth.users u where u.id::text=payment->>'validadoPor' and lower(u.email) in ('leorangel@gmail.com','financeiro@embaixadacarioca.com.br')) then
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

create function event_private.amendment_team_record(a event_private.event_amendments) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'draft_id',a.draft_id,'base_revision',a.base_revision,'draft_revision',a.draft_revision,
   'status',a.status,'summary',a.summary,'created_at',a.created_at,'requested_by',a.requested_by,
   'decided_at',a.decided_at,'decision_note',a.decision_note,'withdrawal_reason',a.withdrawal_reason,'client_token',case when a.status in ('awaiting_client','client_accepted','applied') then a.client_token end,
   'expires_at',a.expires_at,'client_response_at',a.client_response_at,'client_name',a.client_name,'client_message',a.client_message,'applied_at',a.applied_at,
   'stale',a.status<>'applied' and not exists(select 1 from public.propostas b join public.propostas d on d.id=a.draft_id where b.id=a.base_id and b.is_current and b.revision=a.base_revision and d.revision=a.draft_revision and not d.is_current and d.publication_status='draft' and b.status in ('confirmado','pagamento_final','planejamento','evento_proximo') and (b.data_evento+b.horario_evento) at time zone 'America/Sao_Paulo'>now() and (d.data_evento+d.horario_evento) at time zone 'America/Sao_Paulo'>now()),
   'before',event_private.amendment_public_record(jsonb_populate_record(null::public.propostas,a.before_record)),
   'after',event_private.amendment_public_record(jsonb_populate_record(null::public.propostas,a.after_record)));
$$;
revoke all on function event_private.amendment_team_record(event_private.event_amendments) from public,anon,authenticated;

create function public.list_event_amendments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare requests jsonb; drafts jsonb;
begin
 perform event_private.require_team();
 select coalesce(jsonb_agg(q.payload order by q.active desc,q.created_at desc),'[]') into requests from (
  select true active,a.created_at,event_private.amendment_team_record(a) payload from event_private.event_amendments a
   where a.status in ('pending_manager','awaiting_client','client_accepted')
  union all
  select false active,a.created_at,event_private.amendment_team_record(a) payload from (
   select * from event_private.event_amendments where status not in ('pending_manager','awaiting_client','client_accepted') order by created_at desc,id limit 200
  ) a
 ) q;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.revision,'base_revision',b.revision,
  'before',event_private.amendment_public_record(b),'after',event_private.amendment_public_record(p)) order by p.updated_at desc),'[]') into drafts
 from public.propostas p join public.propostas b on b.oportunidade_id=p.oportunidade_id and b.is_current
 where not p.is_current and p.publication_status='draft' and p.snapshot#>>'{amendmentOf,id}'=b.id::text
  and b.status in ('confirmado','pagamento_final','planejamento','evento_proximo') and (b.data_evento+b.horario_evento) at time zone 'America/Sao_Paulo'>now()
  and not exists(select 1 from event_private.event_amendments a where a.opportunity_id=p.oportunidade_id and a.status in ('pending_manager','awaiting_client','client_accepted'));
 return jsonb_build_object('requests',requests,'drafts',drafts,'manager',public.is_super_admin(),'user_id',auth.uid(),'history_truncated',(select count(*)>200 from event_private.event_amendments where status not in ('pending_manager','awaiting_client','client_accepted')));
end; $$;
revoke all on function public.list_event_amendments() from public,anon;
grant execute on function public.list_event_amendments() to authenticated;

create function public.get_event_amendment(target_amendment uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform event_private.require_team();
 return (select event_private.amendment_team_record(a) from event_private.event_amendments a where a.id=target_amendment);
end; $$;
revoke all on function public.get_event_amendment(uuid) from public,anon;
grant execute on function public.get_event_amendment(uuid) to authenticated;

-- The journey recognizes approval recorded by the amendment workflow.
create or replace function public.event_journey_evidence(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; a public.event_proposal_approvals; amendment event_private.event_amendments; b public.event_outbox; h public.event_handoffs;
 reservation public.event_reservations; tasks integer; acknowledged integer; completed integer; release_at timestamptz;
 reply_at timestamptz; reply_source text; response_at timestamptz; payment jsonb; money_ok boolean:=true; steps jsonb;
begin
 perform event_private.require_team();
 select * into p from public.propostas where id=target_proposal;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='A proposta mudou. Atualize as evidências da versão atual.'; end if;
 begin perform event_private.assert_money(p); exception when others then money_ok:=false; end;
 select * into a from public.event_proposal_approvals q where q.proposal_id=p.id
  and event_private.public_proposal_fingerprint(jsonb_populate_record(null::public.propostas,q.proposal_snapshot))=event_private.public_proposal_fingerprint(p)
  order by q.created_at desc,q.id limit 1;
 select * into amendment from event_private.event_amendments m where m.draft_id=p.id and m.status='applied' and m.decided_by is not null and m.decided_at is not null and m.applied_by is not null and event_private.public_proposal_fingerprint(jsonb_populate_record(null::public.propostas,m.after_record))=event_private.public_proposal_fingerprint(p) order by m.applied_at desc limit 1;
 select * into b from public.event_outbox where proposal_id=p.id
  order by (delivery_status in ('delivered','read') and delivery_updated_at is not null) desc nulls last,
   (status='accepted' and nullif(provider_id,'') is not null) desc,created_at desc,id limit 1;
 select occurred_at,source into reply_at,reply_source from public.event_messages where opportunity_id=p.oportunidade_id
  and direction='inbound' and source in ('provider','public','manual') and occurred_at>=coalesce(b.created_at,p.created_at)
  order by (source in ('provider','public')) desc,occurred_at desc,id limit 1;
 -- Public response is bound to this proposal by the portal, including manual link sharing.
 response_at:=p.cliente_resposta_em;
 if response_at is not null and (reply_at is null or reply_source='manual' or reply_at<response_at) then reply_at:=response_at;reply_source:='public';end if;
 payment:=p.snapshot->'pagamentoSinal';
 select * into reservation from public.event_reservations where proposal_id=p.id and opportunity_id=p.oportunidade_id;
 select * into h from public.event_handoffs where proposal_id=p.id and opportunity_id=p.oportunidade_id;
 select count(*),count(*) filter(where acknowledged_at is not null and acknowledged_by is not null),
  count(*) filter(where status='done' and completed_at is not null and completed_by is not null),
  max(completed_at) filter(where task_key='gerencia_go_no_go' and status='done' and acknowledged_at is not null and acknowledged_by is not null and completed_by is not null)
 into tasks,acknowledged,completed,release_at from public.event_handoff_tasks where opportunity_id=h.opportunity_id and source_version=h.version;
 steps:=jsonb_build_array(
  jsonb_build_object('key','proposal','state',case when p.is_current and p.publication_status in ('ready','sent') and money_ok and jsonb_typeof(p.snapshot->'selectedItems')='array'
    and case when jsonb_typeof(p.snapshot->'selectedItems')='array' then jsonb_array_length(p.snapshot->'selectedItems')>0 else false end then 'confirmed' else 'pending' end,'at',p.updated_at),
  jsonb_build_object('key','approval','state',case when a.id is null and amendment.id is not null then 'confirmed' when a.status='approved' and a.decided_by is not null and a.decided_at is not null then 'confirmed' when a.status='pending' and a.expires_at<=now() then 'expired' when a.id is not null then a.status else 'pending' end,'at',coalesce(a.decided_at,amendment.decided_at),'evidence_id',coalesce(a.id,amendment.id),'evidence_type',case when a.id is null and amendment.id is not null then 'amendment' else 'proposal' end),
  jsonb_build_object('key','dispatch','state',case when b.status='accepted' and nullif(b.provider_id,'') is not null then 'confirmed' when b.status in ('sending','uncertain','failed') then b.status else 'pending' end,'at',b.created_at,'evidence_id',b.id),
  jsonb_build_object('key','delivery','state',case when b.delivery_updated_at is not null and b.delivery_status in ('delivered','read') then 'confirmed' else 'pending' end,'at',b.delivery_updated_at,'channel',b.channel),
  jsonb_build_object('key','reply','state',case when reply_source='manual' then 'manual' when reply_at is not null or response_at is not null then 'confirmed' else 'pending' end,'at',coalesce(reply_at,response_at),'source',coalesce(reply_source,case when response_at is not null then 'public' end)),
  jsonb_build_object('key','client_acceptance','state',case when p.cliente_resposta='confirmar' and response_at is not null then 'confirmed' else 'pending' end,'at',response_at),
  jsonb_build_object('key','payment','state',case when payment->>'validacaoPendente'='true' then 'pending'
    when case when jsonb_typeof(payment->'valor')='number' then (payment->>'valor')::numeric>0 else false end then
     case when nullif(payment->>'validadoPor','') is not null and nullif(payment->>'validadoEm','') is not null then 'confirmed' else 'legacy' end else 'pending' end,'at',payment->>'validadoEm'),
  jsonb_build_object('key','reservation','state',case when reservation.status='confirmed' then 'confirmed' else 'pending' end,'at',reservation.updated_at,'reservation_status',reservation.status),
  jsonb_build_object('key','operation','state',case when tasks>=8 and tasks=acknowledged and tasks=completed and not h.changes_pending and release_at is not null then 'confirmed' else 'pending' end,
    'at',release_at,'tasks',tasks,'acknowledged',acknowledged,'completed',completed,'handoff_version',h.version,'changes_pending',h.changes_pending),
  jsonb_build_object('key','outcome','state',case when p.status in ('pos_venda','cancelado') and p.snapshot#>>'{eventOutcome,outcome}' is not null
    and p.snapshot#>>'{eventOutcome,closedAt}' is not null and p.snapshot#>>'{eventOutcome,closedBy}' is not null then 'confirmed' else 'pending' end,'at',p.snapshot#>>'{eventOutcome,closedAt}','outcome',p.snapshot#>>'{eventOutcome,outcome}')
 );
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'is_current',p.is_current,'generated_at',now(),'status',p.status,'steps',steps);
end; $$;
revoke all on function public.event_journey_evidence(uuid,bigint) from public,anon;
grant execute on function public.event_journey_evidence(uuid,bigint) to authenticated;


-- Apply the same item privacy projection to the existing customer portal.
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

-- Preserve customer-history behavior while removing the same internal item metadata.
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
  jsonb_strip_nulls(jsonb_build_object('client',p.snapshot->'client','event',p.snapshot->'event','selectedItems',event_private.public_proposal_items(p.snapshot),'qualificacao',p.snapshot->'qualificacao','sourceRequestSnapshot',p.snapshot->'sourceRequestSnapshot')),
  p.created_at,p.updated_at
from visible p
order by coalesce(p.data_evento,p.created_at::date) desc,p.updated_at desc limit 12;
$$;
revoke all on function public.get_my_event_history() from public,anon;
grant execute on function public.get_my_event_history() to authenticated;
