-- Dormant single neutral owner pilot. No activation, credential, scheduler or historical binding.
create table event_private.smtp_pilot_receipts (
 pilot_key text primary key check(pilot_key='QA-COM-EMAIL-01'),
 send_id uuid not null unique references public.event_outbox(id),
 actor_id uuid not null references auth.users(id),
 proposal_id uuid not null references public.propostas(id),
 account_id text not null check(account_id ~ '^[0-9]{1,40}$'),
 send_attempt integer not null check(send_attempt=1),proposal_revision bigint not null check(proposal_revision=1),
 reviewed_fingerprint text not null,origin_message_id text not null unique,
 mime_sha256 text not null check(mime_sha256 ~ '^[0-9a-f]{64}$'),
 claim_token text not null check(claim_token ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('prepared','sending','accepted','uncertain')),
 prepared_at timestamptz not null default clock_timestamp(),deadline timestamptz not null,
 gate_started_at timestamptz not null,gate_expires_at timestamptz not null,
 started_at timestamptz,finished_at timestamptz,smtp_code integer check(smtp_code=250),smtp_response_sha256 text,
 diagnostic text,evidence_sha256 text,
 check(origin_message_id ~ '^<[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@embaixadacarioca\.com\.br>$'),
 check(gate_expires_at>gate_started_at and gate_expires_at<=gate_started_at+interval '15 minutes'),
 check(deadline>prepared_at and deadline<=prepared_at+interval '45 seconds'),
 check(smtp_response_sha256 is null or smtp_response_sha256 ~ '^[0-9a-f]{64}$'),
 check(evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$')
);
alter table event_private.smtp_pilot_receipts enable row level security;
revoke all on event_private.smtp_pilot_receipts from public,anon,authenticated,service_role;

create function event_private.smtp_pilot_context(target_send uuid,target_actor uuid,target_attempt integer)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare b public.event_outbox;p public.propostas;u auth.users;account text;owner uuid;fp text;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'smtp_worker_required';end if;
 -- Same global ingestion lock and mailbox-before-proposal order as bound capture.
 perform event_private.require_mailbox_oauth_off();
 select * into b from public.event_outbox where id=target_send;
 if not found then raise exception 'smtp_claim_missing';end if;
 select * into p from public.propostas where id=b.proposal_id for update;
 perform 1 from public.oportunidades where id=p.oportunidade_id for update;
 select * into b from public.event_outbox where id=target_send for update;
 select * into u from auth.users where id=target_actor;
 select c.account_id,c.owner_id into account,owner from event_private.mailbox_oauth_connection c where c.singleton;
 if account is null or owner is distinct from target_actor or u.email_confirmed_at is null or lower(u.email) is distinct from lower(trim(b.destination))
  or b.approved_by is distinct from target_actor or b.channel<>'email' or b.status<>'sending' or b.provider_id is not null
  or b.attempts is distinct from target_attempt or target_attempt<>1 or b.reviewed_revision is distinct from 1
  or b.opportunity_id is distinct from p.oportunidade_id or b.opportunity_id is null or p.revision<>1 or not p.is_current
  or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.data_evento<(now() at time zone 'America/Sao_Paulo')::date
  or p.snapshot#>>'{communicationTest,id}' is distinct from 'QA-COM-EMAIL-01' or p.snapshot#>'{communicationTest,neutral}' is distinct from 'true'::jsonb
  or p.total is distinct from 0 or p.snapshot#>'{totals,total}' is distinct from '0'::jsonb
  or p.snapshot->'selectedItems' is distinct from '[]'::jsonb
  or lower(trim(p.cliente_email)) is distinct from lower(u.email)
  or encode(sha256(convert_to(b.body,'UTF8')),'hex') is distinct from '3cb5fe4c494dbfc1153166d1f20d762c2b3d784eabdd6a5d53808616d1267099'
  or b.reviewed_fingerprint is distinct from event_private.public_proposal_fingerprint(p) then raise exception 'smtp_context_invalid';end if;
 perform event_private.assert_money(p);
 perform event_private.check_discount(p);
 if exists(select 1 from event_private.proposal_approval_policy c where c.id and c.enabled and
  (c.approver_id is distinct from target_actor or not exists(select 1 from public.event_proposal_approvals a
   where a.send_id=b.id and a.proposal_id=p.id and a.status='approved' and a.decided_by=target_actor and a.approver_id=target_actor
    and a.revision=p.revision and a.proposal_fingerprint=event_private.proposal_fingerprint(p) and a.expires_at>clock_timestamp()
    and a.content->>'channel'='email' and a.content->>'destination'=b.destination and a.content->>'body'=b.body
    and a.content->>'title'='[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial'))) then raise exception 'smtp_approval_changed';end if;
 fp:=encode(extensions.digest(event_private.proposal_fingerprint(p)||'|email|'||lower(trim(b.destination))||'|'||b.body||'|[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial','sha256'),'hex');
 if b.fingerprint is distinct from fp then raise exception 'smtp_review_changed';end if;
 return jsonb_build_object('account_id',account,'proposal_id',p.id,'reviewed_fingerprint',b.reviewed_fingerprint);
end $$;
revoke all on function event_private.smtp_pilot_context(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function public.event_smtp_pilot_prepare(target_send uuid,actor_id uuid,attempt_no integer,origin_message_id text,mime_sha256 text,gate_started_at timestamptz,gate_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare context jsonb;r event_private.smtp_pilot_receipts;prepared timestamptz;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'smtp_worker_required';end if;
 if origin_message_id is null or origin_message_id !~ '^<[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@embaixadacarioca\.com\.br>$'
  or mime_sha256 is null or mime_sha256 !~ '^[0-9a-f]{64}$' or gate_started_at is null or gate_expires_at is null
  or gate_started_at>clock_timestamp() or gate_expires_at<=clock_timestamp()+interval '60 seconds'
  or gate_expires_at<=gate_started_at or gate_expires_at>gate_started_at+interval '15 minutes' then raise exception 'smtp_prepare_invalid';end if;
 perform pg_advisory_xact_lock(716612);
 context:=event_private.smtp_pilot_context(target_send,actor_id,attempt_no);
 if gate_started_at>clock_timestamp() or gate_expires_at<=clock_timestamp()+interval '60 seconds' then raise exception 'smtp_prepare_expired';end if;
 -- One immutable pilot reservation globally, including failed/uncertain/no-attempt outcomes.
 -- A later explicit pilot needs a separately reviewed identity; no reset/rearm RPC exists.
 prepared:=clock_timestamp();
 insert into event_private.smtp_pilot_receipts(pilot_key,send_id,actor_id,proposal_id,account_id,send_attempt,proposal_revision,reviewed_fingerprint,origin_message_id,mime_sha256,claim_token,state,prepared_at,deadline,gate_started_at,gate_expires_at)
 values('QA-COM-EMAIL-01',target_send,actor_id,(context->>'proposal_id')::uuid,context->>'account_id',1,1,context->>'reviewed_fingerprint',origin_message_id,mime_sha256,encode(extensions.gen_random_bytes(32),'hex'),'prepared',prepared,prepared+interval '45 seconds',gate_started_at,gate_expires_at) returning * into r;
 return jsonb_build_object('state',r.state,'claim_token',r.claim_token,'origin_message_id',r.origin_message_id,'mime_sha256',r.mime_sha256);
end $$;
revoke all on function public.event_smtp_pilot_prepare(uuid,uuid,integer,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.event_smtp_pilot_prepare(uuid,uuid,integer,text,text,timestamptz,timestamptz) to service_role;

create function public.event_smtp_pilot_start(target_send uuid,claim_token text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r event_private.smtp_pilot_receipts;context jsonb;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'smtp_worker_required';end if;
 perform pg_advisory_xact_lock(716612);
 select * into r from event_private.smtp_pilot_receipts where send_id=target_send for update;
 if not found or r.claim_token is distinct from $2 or r.state<>'prepared' or r.deadline<=clock_timestamp() or r.gate_expires_at<=clock_timestamp() then raise exception 'smtp_start_rejected';end if;
 context:=event_private.smtp_pilot_context(r.send_id,r.actor_id,r.send_attempt);
 if context->>'account_id' is distinct from r.account_id or context->>'reviewed_fingerprint' is distinct from r.reviewed_fingerprint then raise exception 'smtp_context_changed';end if;
 if r.deadline<=clock_timestamp() or r.gate_expires_at<=clock_timestamp() then raise exception 'smtp_start_expired';end if;
 update event_private.smtp_pilot_receipts set state='sending',started_at=clock_timestamp() where send_id=target_send returning * into r;
 return jsonb_build_object('state',r.state,'origin_message_id',r.origin_message_id,'mime_sha256',r.mime_sha256,'deadline',r.deadline,'gate_expires_at',r.gate_expires_at);
end $$;
revoke all on function public.event_smtp_pilot_start(uuid,text) from public,anon,authenticated;
grant execute on function public.event_smtp_pilot_start(uuid,text) to service_role;

create function public.event_smtp_pilot_status(target_send uuid,claim_token text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r event_private.smtp_pilot_receipts;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'smtp_worker_required';end if;
 select * into r from event_private.smtp_pilot_receipts where send_id=target_send;
 if not found or r.claim_token is distinct from $2 then raise exception 'smtp_readback_rejected';end if;
 return jsonb_build_object('state',r.state,'origin_message_id',r.origin_message_id,'mime_sha256',r.mime_sha256);
end $$;
revoke all on function public.event_smtp_pilot_status(uuid,text) from public,anon,authenticated;
grant execute on function public.event_smtp_pilot_status(uuid,text) to service_role;

create function public.event_smtp_pilot_finish(target_send uuid,claim_token text,result_code text,mime_sha256 text,origin_message_id text,smtp_response_sha256 text,completed_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r event_private.smtp_pilot_receipts;context jsonb;accepted boolean:=false;evidence text;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'smtp_worker_required';end if;
 if result_code is null or result_code not in ('DATA_250','UNCERTAIN') or completed_at is null or completed_at>clock_timestamp()+interval '5 seconds'
  or (smtp_response_sha256 is not null and smtp_response_sha256 !~ '^[0-9a-f]{64}$') or (result_code='DATA_250' and smtp_response_sha256 is null) then raise exception 'smtp_result_invalid';end if;
 perform pg_advisory_xact_lock(716612);
 select * into r from event_private.smtp_pilot_receipts where send_id=target_send for update;
 if not found or r.claim_token is distinct from $2 or r.mime_sha256 is distinct from $4 or r.origin_message_id is distinct from $5 then raise exception 'smtp_result_changed';end if;
 if r.state='accepted' then
  if result_code<>'DATA_250' or r.smtp_response_sha256 is distinct from $6 then raise exception 'smtp_result_conflict';end if;
  return jsonb_build_object('state',r.state,'origin_message_id',r.origin_message_id,'mime_sha256',r.mime_sha256);
 end if;
 if r.state='uncertain' then return jsonb_build_object('state',r.state,'origin_message_id',r.origin_message_id,'mime_sha256',r.mime_sha256);end if;
 if result_code='DATA_250' and r.state='sending' and completed_at>=r.started_at-interval '5 seconds' and completed_at<=r.deadline and clock_timestamp()<=r.deadline+interval '15 seconds' then
  begin
   context:=event_private.smtp_pilot_context(r.send_id,r.actor_id,r.send_attempt);
   accepted:=context->>'account_id'=r.account_id and context->>'reviewed_fingerprint'=r.reviewed_fingerprint and clock_timestamp()<=r.deadline+interval '15 seconds' and clock_timestamp()<r.gate_expires_at;
  exception when others then accepted:=false;end;
 end if;
 if accepted then
  evidence:=encode(sha256(convert_to(jsonb_build_object('transport','smtp','host','smtp.zeptomail.com','tls',true,'phase','data_final','code',250,'mime_sha256',r.mime_sha256,'message_id',r.origin_message_id,'send_id',r.send_id,'attempt',r.send_attempt,'revision',r.proposal_revision,'account_id',r.account_id,'response_sha256',smtp_response_sha256)::text,'UTF8')),'hex');
  -- Atomic accepted receipt + real sender-origin Message-ID binding; no provider request_id is invented.
  insert into event_private.mailbox_outbound_headers(account_id,outbound_message_id,send_id,send_attempt,proposal_revision,evidence_sha256)
   values(r.account_id,r.origin_message_id,r.send_id,r.send_attempt,r.proposal_revision,evidence);
  if clock_timestamp()>r.deadline+interval '15 seconds' or clock_timestamp()>=r.gate_expires_at then raise exception 'smtp_finish_expired';end if;
  update public.event_outbox set status='accepted',provider_id=null,detail='SMTP aceito; entrega e leitura não comprovadas.',updated_at=now()
   where id=r.send_id and status='sending' and attempts=r.send_attempt;
  if not found then raise exception 'smtp_claim_changed';end if;
  insert into public.event_messages(opportunity_id,proposal_id,proposal_revision,channel,direction,source,body,created_by,delivery_status,external_id)
   select b.opportunity_id,b.proposal_id,r.proposal_revision,'email','outbound','provider',left(b.body,6000),b.approved_by,'accepted','send:'||b.id::text from public.event_outbox b where b.id=r.send_id;
  -- The zero-value neutral QA fixture must not create payment deadlines or commercial state changes.
  update event_private.smtp_pilot_receipts set state='accepted',finished_at=completed_at,smtp_code=250,smtp_response_sha256=$6,evidence_sha256=evidence,diagnostic='DATA_250' where send_id=r.send_id returning * into r;
 else
  update event_private.smtp_pilot_receipts set state='uncertain',finished_at=completed_at,smtp_code=case when result_code='DATA_250' then 250 else null end,smtp_response_sha256=$6,diagnostic=case when result_code='DATA_250' then 'CONTEXT_OR_DEADLINE_CHANGED' else 'RESULT_UNCONFIRMED' end where send_id=r.send_id returning * into r;
  update public.event_outbox set status='uncertain',detail='SMTP sem finalização confirmada; não repetir automaticamente.',updated_at=now() where id=r.send_id and status='sending' and attempts=r.send_attempt;
 end if;
 return jsonb_build_object('state',r.state,'origin_message_id',r.origin_message_id,'mime_sha256',r.mime_sha256);
end $$;
revoke all on function public.event_smtp_pilot_finish(uuid,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.event_smtp_pilot_finish(uuid,text,text,text,text,text,timestamptz) to service_role;

-- An explicit owner action creates one labelled, non-commercial QA case.
-- No form lead, transport, capture, notification or permission is created here.
create table event_private.neutral_email_pilot_case (
 pilot_key text primary key check(pilot_key='QA-COM-EMAIL-01'),
 owner_id uuid not null references auth.users(id),
 proposal_id uuid not null unique references public.propostas(id),
 opportunity_id uuid not null unique references public.oportunidades(id),
 created_at timestamptz not null default clock_timestamp()
);
alter table event_private.neutral_email_pilot_case enable row level security;
revoke all on event_private.neutral_email_pilot_case from public,anon,authenticated,service_role;

create function public.event_neutral_email_pilot(action text default 'status')
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r event_private.neutral_email_pilot_case;p public.propostas;b public.event_outbox;u auth.users;
 owner uuid;mailbox text;op uuid;policy boolean;active_capture boolean;state text;n integer;
begin
 perform event_private.require_mailbox_oauth_owner();
 if action is null or action not in ('status','prepare') then raise exception 'neutral_pilot_action_invalid';end if;
 if action='prepare' then perform pg_advisory_xact_lock(716612);perform event_private.require_mailbox_oauth_owner();end if;
 select c.owner_id,c.mailbox into owner,mailbox from event_private.mailbox_oauth_connection c where c.singleton;
 if owner is distinct from auth.uid() or mailbox is distinct from 'eventos@embaixadacarioca.com.br' then raise exception 'neutral_pilot_connection_required';end if;
 select * into u from auth.users where id=auth.uid();
 select coalesce(bool_or(c.enabled),false) into policy from event_private.proposal_approval_policy c where c.id;
 select coalesce(s.enabled,false) or coalesce(c.enabled,false) or coalesce(cardinality(s.capture_send_ids),0)>0 or s.capture_started_at is not null or s.capture_expires_at is not null into active_capture
  from event_private.mailbox_sync_state s cross join event_private.channel_credentials c where s.singleton and c.provider='mailbox';
 if active_capture is null then raise exception 'neutral_pilot_configuration_missing';end if;
 if action='prepare' then select * into r from event_private.neutral_email_pilot_case where pilot_key='QA-COM-EMAIL-01' for update;
 else select * into r from event_private.neutral_email_pilot_case where pilot_key='QA-COM-EMAIL-01';end if;
 if not found and action='prepare' then
  perform event_private.require_mailbox_oauth_off();
  active_capture:=false;
  if exists(select 1 from event_private.smtp_pilot_receipts) then return jsonb_build_object('state','blocked','approvalRequired',policy,'captureActive',active_capture);end if;
  insert into public.oportunidades(cliente_nome,status,data_evento,metadata)
   values('[TESTE TÉCNICO] QA-COM-EMAIL-01 — SEM VALOR COMERCIAL','proposta_pronta',current_date+30,
    '{"communicationTest":{"id":"QA-COM-EMAIL-01","neutral":true},"nonCommercial":true}'::jsonb) returning id into op;
  insert into public.propostas(oportunidade_id,responsavel_id,cliente_nome,cliente_email,status,publication_status,data_evento,subtotal,taxa_servico,privatizacao,total,snapshot)
   values(op,auth.uid(),'[TESTE TÉCNICO] QA-COM-EMAIL-01 — SEM VALOR COMERCIAL',u.email,'proposta_pronta','ready',current_date+30,0,0,0,0,
    jsonb_build_object('communicationTest',jsonb_build_object('id','QA-COM-EMAIL-01','neutral',true),'totals',jsonb_build_object('total',0),'selectedItems','[]'::jsonb)) returning * into p;
  insert into event_private.neutral_email_pilot_case(pilot_key,owner_id,proposal_id,opportunity_id)values('QA-COM-EMAIL-01',auth.uid(),p.id,op)returning * into r;
 end if;
 if r.pilot_key is null then return jsonb_build_object('state','absent','approvalRequired',policy,'captureActive',active_capture);end if;
 if r.owner_id is distinct from auth.uid() then raise exception 'neutral_pilot_owner_changed';end if;
 select * into p from public.propostas where id=r.proposal_id;
 if not found or p.oportunidade_id is distinct from r.opportunity_id or p.revision<>1 or not p.is_current
  or p.total is distinct from 0 or p.snapshot#>'{totals,total}' is distinct from '0'::jsonb or p.snapshot->'selectedItems' is distinct from '[]'::jsonb
  or p.snapshot#>>'{communicationTest,id}' is distinct from 'QA-COM-EMAIL-01' or p.snapshot#>'{communicationTest,neutral}' is distinct from 'true'::jsonb
  or lower(p.cliente_email) is distinct from lower(u.email) or p.public_token_revoked_at is not null or p.public_token_expires_at<=clock_timestamp() then
  return jsonb_build_object('state','blocked','approvalRequired',policy,'captureActive',active_capture);
 end if;
 select count(*) into n from public.event_outbox where proposal_id=p.id and channel='email';
 if n>1 then return jsonb_build_object('state','blocked','approvalRequired',policy,'captureActive',active_capture);end if;
 select * into b from public.event_outbox where proposal_id=p.id and channel='email';
 state:=case when b.id is null then 'ready' when b.status='sending' then 'sending' when b.status='accepted' and exists(select 1 from event_private.smtp_pilot_receipts t where t.send_id=b.id and t.state='accepted') then 'accepted' else 'uncertain' end;
 return jsonb_strip_nulls(jsonb_build_object('state',state,'proposalId',p.id,'revision',p.revision,'publicToken',p.public_token,'email',u.email,'sendId',b.id,'approvalRequired',policy,'captureActive',active_capture));
end $$;
revoke all on function public.event_neutral_email_pilot(text) from public,anon,service_role;
grant execute on function public.event_neutral_email_pilot(text) to authenticated;
