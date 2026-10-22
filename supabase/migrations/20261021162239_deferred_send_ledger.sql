-- Record a shared gateway refusal before any provider call as a known non-attempt.
-- Preserve existing channel choice, policy/configuration, history and privileges.
-- No channel is activated and no pending backlog is released by this migration.
alter table public.event_outbox drop constraint event_outbox_status_check;
alter table public.event_outbox add constraint event_outbox_status_check check(status in ('sending','accepted','failed','uncertain','paused'));
alter table public.event_approval_notifications drop constraint event_approval_notifications_status_check;
alter table public.event_approval_notifications add constraint event_approval_notifications_status_check check(status in ('pending','sending','accepted','failed','uncertain','paused'));
alter table public.event_approval_watch_alerts drop constraint event_approval_watch_alerts_status_check;
alter table public.event_approval_watch_alerts add constraint event_approval_watch_alerts_status_check check(status in ('pending','sending','accepted','failed','uncertain','paused'));


-- Evidence belongs to a new explicit send claim, never inferred for history.
alter table public.event_outbox add column reviewed_revision bigint check(reviewed_revision>0), add column reviewed_fingerprint text;

create or replace function public.begin_event_send(target_proposal uuid,send_channel text,send_destination text,send_body text,send_title text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas; b public.event_outbox; fp text; response_at timestamptz;
begin
  perform event_private.require_team();

  select * into p from public.propostas where id=target_proposal for update;
  if not found then raise exception 'Proposta não encontrada'; end if;
  if not coalesce(p.is_current,false) or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Envio exige versão atual e evento em aberto'; end if;
  if length(trim(send_body)) not between 1 and 12000 or length(trim(send_destination)) not between 5 and 320 then raise exception 'Confira mensagem e destinatário'; end if;
  if p.oportunidade_id is null then raise exception 'Salve a proposta e vincule a oportunidade antes de enviar'; end if;
  select ultima_resposta_cliente_em into response_at from public.oportunidades where id=p.oportunidade_id for update;
  if response_at is distinct from reviewed_response_at then raise exception 'Há resposta nova. Atualize e revise antes de enviar'; end if;
  perform event_private.assert_money(p);
  perform event_private.check_discount(p);
  fp:=encode(extensions.digest(event_private.proposal_fingerprint(p)||'|'||send_channel||'|'||lower(trim(send_destination))||'|'||send_body||'|'||send_title,'sha256'),'hex');
  insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,approved_by,reviewed_revision,reviewed_fingerprint)
    values(p.id,p.oportunidade_id,fp,send_channel,trim(send_destination),send_body,auth.uid(),p.revision,event_private.public_proposal_fingerprint(p)) on conflict(fingerprint) do nothing returning * into b;
  if b.id is not null then return jsonb_build_object('claimed',true,'send',to_jsonb(b)); end if;
  select * into b from public.event_outbox where fingerprint=fp for update;
  if b.status in ('failed','paused') and coalesce(b.delivery_status,'failed')='failed'
    and (b.status<>'paused' or (b.provider_id is null and b.provider_reference is null and b.engagement is null and b.delivery_status is null and b.delivery_updated_at is null and b.delivery_checked_at is null)) then
    update public.event_outbox set reviewed_revision=p.revision,reviewed_fingerprint=event_private.public_proposal_fingerprint(p),status='sending',provider_id=null,provider_reference=null,delivery_status=null,delivery_updated_at=null,delivery_checked_at=null,engagement=null,attempts=attempts+1,approved_by=auth.uid(),updated_at=now() where id=b.id returning * into b;
    return jsonb_build_object('claimed',true,'send',to_jsonb(b));
  end if;
  return jsonb_build_object('claimed',false,'send',to_jsonb(b));
end; $$;

create or replace function public.begin_event_approved_send(target_approval uuid,reviewed_revision bigint,send_channel text,send_destination text,send_body text,send_title text,content_hash text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.event_proposal_approvals; p public.propostas; c event_private.proposal_approval_policy; pid uuid; result jsonb; prior_send public.event_outbox;
begin
 perform event_private.require_team();
 select * into c from event_private.proposal_approval_policy where id;
 if not c.enabled or auth.uid() is distinct from c.approver_id or not public.is_super_admin() then raise exception 'Envio exige o gestor designado'; end if;
 select proposal_id into pid from public.event_proposal_approvals where id=target_approval;
 select * into p from public.propostas where id=pid for update;
 perform 1 from public.oportunidades where id=p.oportunidade_id for update;
 select * into a from public.event_proposal_approvals where id=target_approval for update;
 if a.status is distinct from 'approved' or a.decided_by is distinct from auth.uid() or a.approver_id is distinct from c.approver_id then raise exception 'Aprovação do gestor ausente'; end if;
 if a.content->>'channel' is distinct from send_channel or a.content->>'destination' is distinct from send_destination or a.content->>'body' is distinct from send_body or a.content->>'title' is distinct from send_title or a.content->>'contentHash' is distinct from content_hash or (a.content->>'reviewedResponseAt')::timestamptz is distinct from reviewed_response_at then raise exception 'Mensagem, destinatário ou prévia divergente da aprovação'; end if;
 if a.send_id is not null then
  select * into prior_send from public.event_outbox where id=a.send_id for update;
  -- Only an explicit manager retry after rejection or proven non-attempt can claim again.
  if coalesce(prior_send.status,'') not in ('failed','paused') or coalesce(prior_send.delivery_status,'failed')<>'failed'
    or (prior_send.status='paused' and (prior_send.provider_id is not null or prior_send.provider_reference is not null or prior_send.engagement is not null or prior_send.delivery_status is not null or prior_send.delivery_updated_at is not null or prior_send.delivery_checked_at is not null)) then
   return jsonb_build_object('claimed',false,'send',to_jsonb(prior_send));
  end if;
 end if;
 if a.expires_at<=now() or p.revision is distinct from a.revision or p.revision is distinct from reviewed_revision or event_private.proposal_fingerprint(p) is distinct from a.proposal_fingerprint then raise exception using errcode='PT409',message='A versão aprovada mudou ou expirou'; end if;
 result:=public.begin_event_send(p.id,send_channel,send_destination,send_body,send_title,reviewed_response_at);
 update public.event_proposal_approvals set send_id=(result#>>'{send,id}')::uuid where id=a.id;
 insert into public.event_approval_audit(approval_id,action,actor_id) values(a.id,'dispatch_claimed',auth.uid());
 return result;
end; $$;

create or replace function public.finish_event_send(send_id uuid,send_status text,external_message_id text default null,error_detail text default null) returns void language plpgsql security definer set search_path='' as $$
declare b public.event_outbox;
begin
  if send_status not in ('accepted','failed','uncertain','paused') then raise exception 'Estado de envio inválido'; end if;
  select * into b from public.event_outbox where id=send_id;
  if b.id is null then return; end if;
  perform 1 from public.propostas where id=b.proposal_id for update;
  perform 1 from public.oportunidades where id=b.opportunity_id for update;
  -- A last-moment pause is valid only for an unattempted claim. A receipt racing
  -- this finalization wins; never erase its provider/delivery evidence.
  if send_status='paused' then
    if external_message_id is not null then raise exception 'Pausa não admite identificação do provedor'; end if;
    update public.event_outbox set status='paused',detail=left(error_detail,1000),updated_at=now()
      where id=send_id and status='sending' and provider_id is null and provider_reference is null and delivery_status is null and engagement is null and delivery_updated_at is null and delivery_checked_at is null;
    return;
  end if;
  update public.event_outbox set status=send_status,provider_id=external_message_id,detail=left(error_detail,1000),updated_at=now() where id=send_id and status='sending' returning * into b;
  if b.id is null then return; end if;
  if b.opportunity_id is not null then
    insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by,delivery_status,external_id)
      values(b.opportunity_id,b.proposal_id,b.channel,'outbound','provider',left(b.body,6000),b.approved_by,send_status,'send:'||b.id::text) on conflict(channel,external_id) where external_id is not null do nothing;
    update public.event_messages set body=left(b.body,6000),delivery_status=send_status,occurred_at=now() where channel=b.channel and external_id='send:'||b.id::text;
    if send_status='accepted' then
      update public.propostas set snapshot=case when nullif(snapshot#>>'{event,signalDeadlineAt}','') is null then jsonb_set(coalesce(snapshot,'{}'),'{event}',coalesce(snapshot->'event','{}')||jsonb_build_object('signalDeadlineAt',now()+make_interval(hours=>coalesce((snapshot#>>'{event,signalDeadlineHours}')::integer,48)))) else snapshot end,publication_status='sent',sent_at=coalesce(sent_at,now()),status=case when status='proposta_pronta' then 'proposta_enviada' else status end where id=b.proposal_id;
      update public.oportunidades set ultimo_contato_em=now(),metadata=coalesce(metadata,'{}')||case when metadata->>'first_reply_sent_at' is null then jsonb_build_object('first_reply_sent_at',now(),'first_reply_channel',b.channel,'first_reply_source','provider_accepted') else '{}'::jsonb end where id=b.opportunity_id;
    end if;
  end if;
end; $$;

create or replace function public.event_finish_approval_notification(target_approval uuid,target_channel text,result_status text,external_id text default null,result_detail text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if result_status not in ('accepted','failed','uncertain','paused') then raise exception 'Estado inválido'; end if;
 if result_status='paused' and external_id is not null then raise exception 'Pausa não admite identificação do provedor'; end if;
 update public.event_approval_notifications set status=result_status,provider_id=left(external_id,300),detail=left(result_detail,500),updated_at=now() where approval_id=target_approval and channel=target_channel and status='sending' and (result_status<>'paused' or provider_id is null);
end; $$;

create or replace function public.event_finish_approval_watch_alert(target_id uuid,result_status text,external_id text default null,result_detail text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if result_status not in ('accepted','failed','uncertain','paused') then raise exception 'Resultado inválido'; end if;
 if result_status='paused' and external_id is not null then raise exception 'Pausa não admite identificação do provedor'; end if;
 update public.event_approval_watch_alerts set status=result_status,provider_id=left(external_id,300),detail=left(result_detail,500),updated_at=now()
 where id=target_id and status='sending' and (result_status<>'paused' or provider_id is null);
 if not found then raise exception 'Tentativa inexistente ou já finalizada'; end if;
end; $$;

-- Only this explicit team request can requeue a proven paused notification.
create or replace function public.event_retry_approval_notifications(target_approval uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform event_private.require_team();
 if not exists(select 1 from public.event_proposal_approvals where id=target_approval and status='pending' and expires_at>now()) then raise exception 'Solicitação não está pendente'; end if;
 update public.event_approval_notifications set status='pending',updated_at=now() where approval_id=target_approval and (status='failed' or (status='paused' and provider_id is null)) and attempts<3;
 insert into public.event_approval_audit(approval_id,action,actor_id) values(target_approval,'notification_retry_requested',auth.uid());
end; $$;

-- Preserve eligibility and claim behavior; add stable transport identity only.
create or replace function public.event_claim_approval_watch(supplied_key text,probe_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c event_private.approval_watch_config; p event_private.proposal_approval_policy; a record; n record;
 reason text; channel_name text; jobs jsonb:='[]'; run uuid:=gen_random_uuid(); local_time time;
begin
 select * into c from event_private.approval_watch_config where id for update;
 if supplied_key is null or length(supplied_key)<>64 or c.job_key is distinct from supplied_key then
  raise exception using errcode='42501',message='Credencial do monitor inválida';
 end if;
 select * into p from event_private.proposal_approval_policy where id;
 if not c.enabled or not p.enabled then return jsonb_build_object('skipped',true,'jobs',jobs); end if;
 -- A crashed worker may already have contacted the provider. Quarantine its
 -- abandoned claims as uncertain, never reset to pending or resend automatically.
 update public.event_approval_watch_alerts set status='uncertain',
  detail='Tentativa anterior sem resultado confirmado; conferir o provedor antes de qualquer nova ação.',updated_at=now()
 where status='sending' and updated_at<=now()-interval '10 minutes';
 if probe_id is not null then
  if exists(select 1 from public.event_approval_watch_alerts where dedupe_key='probe:'||probe_id::text||':email') then
   return jsonb_build_object('skipped',true,'jobs',jobs);
  end if;
  if c.last_probe_at>now()-interval '1 hour' then raise exception 'Teste real já executado na última hora'; end if;
  update event_private.approval_watch_config set last_probe_at=now() where id;
  foreach channel_name in array array['whatsapp','email'] loop
   insert into public.event_approval_watch_alerts(dedupe_key,kind,channel)
   values('probe:'||probe_id::text||':'||channel_name,'probe',channel_name);
  end loop;
 else
  if c.last_started_at>now()-interval '4 minutes' then return jsonb_build_object('skipped',true,'jobs',jobs); end if;
  -- Scan continuously; outbound alerts are restricted to local business hours.
  for a in
   select q.*,b as send_row
   from public.event_proposal_approvals q join public.propostas v on v.id=q.proposal_id
   left join public.event_outbox b on b.id=q.send_id
   where q.status in ('pending','approved') and q.approver_id=p.approver_id
    and v.is_current and v.status not in ('cancelado','pos_venda')
    and (q.status='approved' or (v.revision=q.revision and event_private.proposal_fingerprint(v)=q.proposal_fingerprint))
    and not exists(select 1 from public.event_proposal_approvals newer where newer.supersedes_id=q.id)
  loop
   reason:=null;
   if a.status='pending' then
    if a.expires_at<=now() then reason:='approval_expired';
    elsif exists(select 1 from public.event_approval_notifications notice_row where notice_row.approval_id=a.id and notice_row.status='failed') then reason:='notification_failed';
    elsif exists(select 1 from public.event_approval_notifications notice_row where notice_row.approval_id=a.id and
      (notice_row.status='uncertain' or (notice_row.status in ('pending','sending') and notice_row.updated_at<=now()-interval '10 minutes'))) then reason:='notification_stalled';
    elsif a.created_at<=now()-interval '2 hours' then reason:='approval_waiting';
    end if;
   elsif event_private.approval_dispatch_needs_attention(a.send_row,a.decided_at) then reason:='dispatch_attention';
   end if;
   if reason is not null then
    foreach channel_name in array array['whatsapp','email'] loop
     insert into public.event_approval_watch_alerts(approval_id,dedupe_key,kind,channel)
     values(a.id,a.id::text||':'||reason||':'||channel_name,reason,channel_name) on conflict(dedupe_key) do nothing;
    end loop;
   end if;
  end loop;
 end if;
 update event_private.approval_watch_config set last_started_at=now(),run_id=run where id;
 local_time:=(now() at time zone 'America/Sao_Paulo')::time;
 for n in
  select w.*,q.revision as approval_revision from public.event_approval_watch_alerts w
  left join public.event_proposal_approvals q on q.id=w.approval_id
  where (w.status='pending' or (w.status='failed' and w.attempts<3 and w.updated_at<=now()-interval '1 hour'))
   and ((probe_id is not null and w.dedupe_key like 'probe:'||probe_id::text||':%') or
    (probe_id is null and w.kind<>'probe' and local_time between '08:30'::time and '21:00'::time
     and q.approver_id=p.approver_id and q.status in ('pending','approved')
     and not exists(select 1 from public.event_proposal_approvals newer where newer.supersedes_id=q.id)
     and exists(select 1 from public.propostas v where v.id=q.proposal_id and v.is_current and v.status not in ('cancelado','pos_venda')
      and (q.status='approved' or (v.revision=q.revision and event_private.proposal_fingerprint(v)=q.proposal_fingerprint)))
     and case w.kind
      when 'approval_expired' then q.status='pending' and q.expires_at<=now()
      when 'approval_waiting' then q.status='pending' and q.expires_at>now() and q.created_at<=now()-interval '2 hours'
      when 'notification_failed' then q.status='pending' and q.expires_at>now() and exists(select 1 from public.event_approval_notifications nn where nn.approval_id=q.id and nn.status='failed')
      when 'notification_stalled' then q.status='pending' and q.expires_at>now() and exists(select 1 from public.event_approval_notifications nn where nn.approval_id=q.id and (nn.status='uncertain' or (nn.status in ('pending','sending') and nn.updated_at<=now()-interval '10 minutes')))
      when 'dispatch_attention' then q.status='approved' and event_private.approval_dispatch_needs_attention((select bb from public.event_outbox bb where bb.id=q.send_id),q.decided_at)
      else false end))
  order by w.created_at,w.id limit 8 for update of w skip locked
 loop
  update public.event_approval_watch_alerts set status='sending',attempts=attempts+1,updated_at=now(),run_id=run where id=n.id;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',n.id,'kind',n.kind,'channel',n.channel,
   'destination',case n.channel when 'email' then p.approver_email else p.whatsapp end,
   'approval_id',n.approval_id,'reference',n.dedupe_key,'created_at',n.created_at,
   'context_id',coalesce(n.approval_id,n.id),'revision',coalesce(n.approval_revision,1)));
 end loop;
 return jsonb_build_object('run_id',run,'jobs',jobs);
end; $$;

-- Scope provisioning remains a separate, explicit private configuration action.
-- An upgraded legacy row retains all prior state; a missing scope fails closed.
alter table event_private.bot_bridge_state add column scope_id uuid;
create function event_private.guard_bot_bridge_scope() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.scope_id is distinct from old.scope_id and (new.enabled or new.cursor<>0) then
  raise exception 'Altere o escopo somente com a ponte desativada e o cursor zerado';
 end if;
 return new;
end; $$;
revoke all on function event_private.guard_bot_bridge_scope() from public,anon,authenticated,service_role;
create trigger guard_bot_bridge_scope before update of scope_id on event_private.bot_bridge_state
for each row execute function event_private.guard_bot_bridge_scope();

create or replace function public.event_bot_bridge_worker_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('job_key',c.delivery_job_key,'channel_enabled',c.enabled,'enabled',s.enabled,'cursor',s.cursor,'expected_account',c.expected_account,'scope_id',s.scope_id)
 from event_private.channel_credentials c cross join event_private.bot_bridge_state s where c.provider='zapi' and s.singleton;
$$;

create or replace function public.event_bot_bridge_activate(account_id text,initial_cursor bigint) returns void language plpgsql security definer set search_path='' as $$
declare supplied_scope uuid;
begin
 -- V2 input binds the verified probe to the exact privately provisioned scope.
 -- Stored account identity remains canonical; legacy unscoped activation fails.
 if account_id is null or account_id !~ '^bot:embaixada_urca\|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  or initial_cursor is null or initial_cursor<0 then raise exception 'Ponte inválida'; end if;
 supplied_scope:=split_part(account_id,'|',2)::uuid;
 perform 1 from event_private.channel_credentials where provider='zapi' for update;
 perform 1 from event_private.bot_bridge_state where singleton for update;
 if not exists(select 1 from event_private.bot_bridge_state where singleton and scope_id=supplied_scope) then
  raise exception 'O escopo privado da ponte mudou ou não foi configurado';
 end if;
 update event_private.channel_credentials set expected_account='bot:embaixada_urca',enabled=true,updated_at=now() where provider='zapi';
 update event_private.bot_bridge_state set cursor=initial_cursor,enabled=true,last_success_at=null,diagnostic='Ponte autenticada; aguardando novos eventos.',updated_at=now() where singleton;
end; $$;

-- Same private worker API and ACL, with a scope-bound V2 JSONB envelope.
-- An empty page is also bound; stale scoped workers cannot advance a new cursor.
create or replace function public.event_bot_bridge_commit(account_id text,expected_cursor bigint,next_cursor_value bigint,events jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c event_private.channel_credentials; s event_private.bot_bridge_state; payload jsonb; v jsonb; b public.event_outbox; p public.propostas; reference_id text; matches integer;
begin
 -- Same order as receipt reconciliation: global ingestion lock before row locks.
 perform pg_advisory_xact_lock(716612);
 select * into c from event_private.channel_credentials where provider='zapi' for update;
 select * into s from event_private.bot_bridge_state where singleton for update;
 if not c.enabled or not s.enabled or c.expected_account is distinct from account_id or s.cursor is distinct from expected_cursor then raise exception 'A conta ou o cursor da ponte mudou'; end if;
 if jsonb_typeof(events) is distinct from 'object' or s.scope_id is null or (events->>'scope')::uuid is distinct from s.scope_id then raise exception 'O escopo do lote da ponte mudou'; end if;
 payload:=events->'events';
 if account_id is distinct from 'bot:embaixada_urca' or expected_cursor is null or expected_cursor<0 or next_cursor_value is null or next_cursor_value<expected_cursor or jsonb_typeof(payload) is distinct from 'array' then raise exception 'Lote inválido'; end if;
 if jsonb_array_length(payload)>100 then raise exception 'Lote inválido'; end if;
 -- Revalidate the exact authorized proposal send under the normal lock order.
 -- A raw contact match must never substitute for the scoped Bot correlation.
 for v in select value from jsonb_array_elements(payload) loop
  if v->>'channel' is distinct from 'whatsapp' or v->>'purpose' is distinct from 'event_proposal'
    or v->>'kind' not in ('inbound','status') or nullif(v->>'send_id','') is null or nullif(v->>'context_id','') is null
    or nullif(v->>'revision','') is null then raise exception 'Correlação de evento ausente'; end if;
  select * into p from public.propostas where id=(v->>'context_id')::uuid for update;
  if p.id is null then raise exception 'Proposta correlacionada ausente'; end if;
  perform 1 from public.oportunidades where id=p.oportunidade_id for update;
  select * into b from public.event_outbox where id=(v->>'send_id')::uuid for update;
  reference_id:=case when v->>'kind'='inbound' then v->>'reply_to_id' else v->>'message_id' end;
  if b.id is null or b.proposal_id<>p.id or b.channel<>'whatsapp' or b.destination is distinct from v->>'destination'
    or b.status<>'accepted' or b.provider_id is distinct from reference_id or reference_id is null
    or b.reviewed_revision is distinct from (v->>'revision')::bigint
    or b.reviewed_fingerprint is distinct from event_private.public_proposal_fingerprint(p)
    or not p.is_current or p.status in ('cancelado','pos_venda') then raise exception 'Envio correlacionado mudou ou não foi confirmado'; end if;
  select count(*) into matches from public.event_outbox where channel='whatsapp' and destination=b.destination and (provider_id=reference_id or provider_reference=reference_id);
  if matches<>1 then raise exception 'Referência de envio ambígua'; end if;
 end loop;
 perform public.ingest_event_provider_events('zapi',payload);
 update event_private.bot_bridge_state set cursor=next_cursor_value,last_success_at=now(),updated_at=now(),diagnostic='Ponte consultada; '||jsonb_array_length(payload)||' evento(s) recebido(s).' where singleton;
end; $$;
