-- Feature flag defaults off. Configure the verified manager separately from source.
create table event_private.proposal_approval_policy(id boolean primary key default true check(id), enabled boolean not null default false, approver_id uuid references auth.users(id), approver_email text, whatsapp text, enabled_at timestamptz);
insert into event_private.proposal_approval_policy(id) values(true);
alter table event_private.proposal_approval_policy enable row level security;
revoke all on event_private.proposal_approval_policy from public,anon,authenticated;
create table public.event_proposal_approvals (
 id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.propostas(id), revision bigint not null check(revision>0),
 proposal_fingerprint text not null, review_hash text not null unique, proposal_snapshot jsonb not null, content jsonb not null,
 requested_by uuid not null references auth.users(id), approver_id uuid not null references auth.users(id), approver_email text not null,
 status text not null default 'pending' check(status in ('pending','approved','changes_requested','rejected','invalidated')),
 reason text, decided_by uuid references auth.users(id), decided_at timestamptz, send_id uuid references public.event_outbox(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 check(jsonb_typeof(content)='object'), check(content->>'channel' in ('email','whatsapp'))
);
create index event_proposal_approvals_proposal_idx on public.event_proposal_approvals(proposal_id,created_at desc);
create index event_proposal_approvals_pending_idx on public.event_proposal_approvals(status,expires_at) where status='pending';
create table public.event_approval_notifications (
 approval_id uuid not null references public.event_proposal_approvals(id), channel text not null check(channel in ('whatsapp','email')),
 status text not null default 'pending' check(status in ('pending','sending','accepted','failed','uncertain')),
 attempts integer not null default 0, provider_id text, detail text, updated_at timestamptz not null default now(), primary key(approval_id,channel)
);
create table public.event_approval_audit(id uuid primary key default gen_random_uuid(),approval_id uuid not null references public.event_proposal_approvals(id),action text not null,actor_id uuid references auth.users(id),detail text,created_at timestamptz not null default now());
create index event_approval_audit_request_idx on public.event_approval_audit(approval_id,created_at);
alter table public.event_proposal_approvals enable row level security;
alter table public.event_approval_notifications enable row level security;
alter table public.event_approval_audit enable row level security;
revoke all on public.event_proposal_approvals,public.event_approval_notifications,public.event_approval_audit from public,anon,authenticated;
grant select on public.event_proposal_approvals,public.event_approval_notifications,public.event_approval_audit to authenticated;
grant all on public.event_proposal_approvals,public.event_approval_notifications,public.event_approval_audit to service_role;
create policy approval_team_read on public.event_proposal_approvals for select to authenticated using ((select public.is_team_member()));
create policy approval_notification_read on public.event_approval_notifications for select to authenticated using ((select public.is_team_member()));
create policy approval_audit_read on public.event_approval_audit for select to authenticated using ((select public.is_team_member()));

create function public.event_approval_policy() returns jsonb language plpgsql security definer set search_path='' as $$
declare c event_private.proposal_approval_policy;
begin
 perform event_private.require_team(); select * into c from event_private.proposal_approval_policy where id;
 return jsonb_build_object('enabled',c.enabled,'approver_email',c.approver_email,'is_approver',auth.uid()=c.approver_id);
end; $$;
revoke all on function public.event_approval_policy() from public,anon;
grant execute on function public.event_approval_policy() to authenticated;

-- Only the Edge service may store a generated preview. Team clients cannot forge it.
create function public.event_create_proposal_approval(target_proposal uuid,expected_revision bigint,requester uuid,prepared_content jsonb) returns public.event_proposal_approvals language plpgsql security definer set search_path='' as $$
declare p public.propostas; c event_private.proposal_approval_policy; a public.event_proposal_approvals; response_at timestamptz; fp text; deadline timestamptz;
begin
 select * into c from event_private.proposal_approval_policy where id;
 if not c.enabled or c.approver_id is null or c.approver_email is null then raise exception 'Aprovação remota não configurada'; end if;
 if not exists(select 1 from auth.users where id=requester) then raise exception 'Solicitante inválido'; end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='A proposta mudou. Salve e revise antes de solicitar aprovação.'; end if;
 if not p.is_current or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.oportunidade_id is null then raise exception 'Salve uma versão atual pronta para envio'; end if;
 deadline:=least(now()+interval '48 hours',(p.data_evento+coalesce(p.horario_evento,'23:59:00'::time)) at time zone 'America/Sao_Paulo');
 if p.data_evento is null or deadline<=now() then raise exception 'Confira a data e o horário futuro do evento'; end if;
 perform event_private.assert_money(p);
 select ultima_resposta_cliente_em into response_at from public.oportunidades where id=p.oportunidade_id for update;
 if response_at is distinct from (prepared_content->>'reviewedResponseAt')::timestamptz then raise exception using errcode='PT409',message='Há resposta nova do cliente. Revise antes de solicitar aprovação.'; end if;
 if coalesce(prepared_content->>'channel','') not in ('email','whatsapp') or length(trim(coalesce(prepared_content->>'body',''))) not between 1 and 12000 or length(coalesce(prepared_content->>'destination','')) not between 5 and 320 then raise exception 'Conteúdo de envio inválido'; end if;
 if prepared_content->>'proposalUrl' is distinct from ('https://leorangel22.github.io/main/proposta.html?p='||p.public_token::text||case when p.snapshot#>>'{event,clientLanguage}'='en' then '&lang=en' else '' end) then raise exception 'Link divergente da proposta'; end if;
 if prepared_content->>'channel'='email' and (coalesce(prepared_content->>'contentHash','') !~ '^[a-f0-9]{64}$' or length(coalesce(prepared_content->>'html',''))=0) then raise exception 'Prévia completa do e-mail obrigatória'; end if;
 fp:=encode(extensions.digest(jsonb_build_object('proposal',to_jsonb(p),'content',prepared_content,'approver',c.approver_id)::text,'sha256'),'hex');
 insert into public.event_proposal_approvals(proposal_id,revision,proposal_fingerprint,review_hash,proposal_snapshot,content,requested_by,approver_id,approver_email,expires_at)
 values(p.id,p.revision,event_private.proposal_fingerprint(p),fp,to_jsonb(p),prepared_content,requester,c.approver_id,c.approver_email,deadline) on conflict(review_hash) do nothing returning * into a;
 if a.id is null then select * into a from public.event_proposal_approvals where review_hash=fp; return a; end if;
 insert into public.event_approval_notifications(approval_id,channel) values(a.id,'whatsapp'),(a.id,'email');
 insert into public.event_approval_audit(approval_id,action,actor_id) values(a.id,'requested',requester);
 return a;
end; $$;
revoke all on function public.event_create_proposal_approval(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.event_create_proposal_approval(uuid,bigint,uuid,jsonb) to service_role;

create function public.event_get_proposal_approval(target_approval uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.event_proposal_approvals; p public.propostas; c event_private.proposal_approval_policy;
begin
 perform event_private.require_team(); select * into a from public.event_proposal_approvals where id=target_approval;
 if not found then raise exception 'Solicitação não encontrada'; end if;
 select * into p from public.propostas where id=a.proposal_id; select * into c from event_private.proposal_approval_policy where id;
 return to_jsonb(a)||jsonb_build_object('expired',a.expires_at<=now(),'stale',p.revision is distinct from a.revision or not p.is_current or event_private.proposal_fingerprint(p) is distinct from a.proposal_fingerprint,
 'can_decide',c.enabled and auth.uid()=c.approver_id and auth.uid()=a.approver_id,
 'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from public.event_approval_notifications n where approval_id=a.id),'[]'),
 'send',(select jsonb_build_object('id',b.id,'status',b.status,'delivery_status',b.delivery_status,'detail',b.detail) from public.event_outbox b where b.id=a.send_id));
end; $$;
revoke all on function public.event_get_proposal_approval(uuid) from public,anon;
grant execute on function public.event_get_proposal_approval(uuid) to authenticated;

create function public.event_decide_proposal_approval(target_approval uuid,decision text,reviewed_hash text,confirmed boolean,decision_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.event_proposal_approvals; p public.propostas; c event_private.proposal_approval_policy; pid uuid; response_at timestamptz; discount numeric;
begin
 perform event_private.require_team(); select * into c from event_private.proposal_approval_policy where id;
 if not c.enabled or auth.uid() is distinct from c.approver_id or not public.is_super_admin() or not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=lower(c.approver_email)) then raise exception using errcode='42501',message='Somente o gestor designado pode liberar propostas'; end if;
 if decision not in ('approve','changes_requested','rejected') or confirmed is distinct from true then raise exception 'Confirme explicitamente sua decisão'; end if;
 select proposal_id into pid from public.event_proposal_approvals where id=target_approval;
 select * into p from public.propostas where id=pid for update;
 select ultima_resposta_cliente_em into response_at from public.oportunidades where id=p.oportunidade_id for update;
 select * into a from public.event_proposal_approvals where id=target_approval for update;
 if a.id is null or a.approver_id is distinct from auth.uid() or a.review_hash is distinct from reviewed_hash then raise exception 'Solicitação ou conteúdo revisado inválido'; end if;
 if a.status='approved' and decision='approve' then return public.event_get_proposal_approval(a.id); end if;
 if a.status<>'pending' then raise exception 'Esta solicitação já foi decidida ou invalidada'; end if;
 if a.expires_at<=now() or p.revision is distinct from a.revision or not p.is_current or event_private.proposal_fingerprint(p) is distinct from a.proposal_fingerprint or response_at is distinct from (a.content->>'reviewedResponseAt')::timestamptz then raise exception using errcode='PT409',message='A proposta mudou ou a aprovação expirou. Solicite uma nova revisão.'; end if;
 if decision<>'approve' and length(trim(coalesce(decision_reason,'')))<3 then raise exception 'Informe o motivo para orientar a equipe'; end if;
 if decision='approve' then
 perform event_private.assert_money(p);
 discount:=greatest(0,-coalesce((p.snapshot#>>'{totals,adjustment}')::numeric,0))+greatest(0,-coalesce((p.snapshot#>>'{totals,privatizationAdjustment}')::numeric,0));
 if discount>1000 or discount/greatest(coalesce(p.subtotal,0),1)>0.10 then perform public.approve_event_discount(p.id); end if;
 end if;
 update public.event_proposal_approvals set status=case when decision='approve' then 'approved' else decision end,reason=left(trim(decision_reason),2000),decided_by=auth.uid(),decided_at=now() where id=a.id;
 insert into public.event_approval_audit(approval_id,action,actor_id,detail) values(a.id,decision,auth.uid(),left(trim(decision_reason),2000));
 return public.event_get_proposal_approval(a.id);
end; $$;
revoke all on function public.event_decide_proposal_approval(uuid,text,text,boolean,text) from public,anon;
grant execute on function public.event_decide_proposal_approval(uuid,text,text,boolean,text) to authenticated;

create function public.begin_event_approved_send(target_approval uuid,reviewed_revision bigint,send_channel text,send_destination text,send_body text,send_title text,content_hash text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.event_proposal_approvals; p public.propostas; c event_private.proposal_approval_policy; pid uuid; result jsonb;
begin
 perform event_private.require_team(); select * into c from event_private.proposal_approval_policy where id;
 if not c.enabled or auth.uid() is distinct from c.approver_id or not public.is_super_admin() then raise exception 'Envio exige o gestor designado'; end if;
 select proposal_id into pid from public.event_proposal_approvals where id=target_approval;
 select * into p from public.propostas where id=pid for update;
 perform 1 from public.oportunidades where id=p.oportunidade_id for update;
 select * into a from public.event_proposal_approvals where id=target_approval for update;
 if a.status is distinct from 'approved' or a.decided_by is distinct from auth.uid() or a.approver_id is distinct from c.approver_id then raise exception 'Aprovação do gestor ausente'; end if;
 if a.content->>'channel' is distinct from send_channel or a.content->>'destination' is distinct from send_destination or a.content->>'body' is distinct from send_body or a.content->>'title' is distinct from send_title or a.content->>'contentHash' is distinct from content_hash or (a.content->>'reviewedResponseAt')::timestamptz is distinct from reviewed_response_at then raise exception 'Mensagem, destinatário ou prévia divergente da aprovação'; end if;
 if a.send_id is not null then return jsonb_build_object('claimed',false,'send',(select to_jsonb(b) from public.event_outbox b where b.id=a.send_id)); end if;
 if a.expires_at<=now() or p.revision is distinct from a.revision or p.revision is distinct from reviewed_revision or event_private.proposal_fingerprint(p) is distinct from a.proposal_fingerprint then raise exception using errcode='PT409',message='A versão aprovada mudou ou expirou'; end if;
 result:=public.begin_event_send(p.id,send_channel,send_destination,send_body,send_title,reviewed_response_at);
 update public.event_proposal_approvals set send_id=(result#>>'{send,id}')::uuid where id=a.id;
 insert into public.event_approval_audit(approval_id,action,actor_id) values(a.id,'dispatch_claimed',auth.uid());
 return result;
end; $$;
revoke all on function public.begin_event_approved_send(uuid,bigint,text,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.begin_event_approved_send(uuid,bigint,text,text,text,text,text,timestamptz) to authenticated;

create or replace function public.begin_event_send_reviewed(target_proposal uuid,reviewed_revision bigint,send_channel text,send_destination text,send_body text,send_title text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas;
begin
 perform event_private.require_team();
 if exists(select 1 from event_private.proposal_approval_policy where id and enabled) then raise exception using errcode='42501',message='Solicite a aprovação do gestor. O envio direto está bloqueado.'; end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or reviewed_revision is null or p.revision is distinct from reviewed_revision then raise exception 'A proposta mudou. Revise a versão atual antes de enviar'; end if;
 return public.begin_event_send(target_proposal,send_channel,send_destination,send_body,send_title,reviewed_response_at);
end; $$;
create function event_private.invalidate_proposal_approvals() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.revision is distinct from old.revision or new.is_current is distinct from old.is_current then
 with changed as (update public.event_proposal_approvals set status='invalidated',reason='A versão da proposta foi alterada.' where proposal_id=new.id and status in ('pending','approved') and send_id is null returning id)
 insert into public.event_approval_audit(approval_id,action) select id,'invalidated' from changed;
 end if; return new;
end; $$;
revoke all on function event_private.invalidate_proposal_approvals() from public,anon,authenticated;
create trigger invalidate_remote_approval after update on public.propostas for each row execute function event_private.invalidate_proposal_approvals();
create function public.event_claim_approval_notification(target_approval uuid,target_channel text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.event_proposal_approvals; n public.event_approval_notifications; c event_private.proposal_approval_policy;
begin
 select * into c from event_private.proposal_approval_policy where id; select * into a from public.event_proposal_approvals where id=target_approval;
 if not c.enabled or a.id is null or a.status<>'pending' or a.expires_at<=now() or a.approver_id is distinct from c.approver_id then return null; end if;
 update public.event_approval_notifications set status='sending',attempts=attempts+1,updated_at=now() where approval_id=a.id and channel=target_channel and status='pending' returning * into n;
 if n.approval_id is null then return null; end if;
 return jsonb_build_object('approval',to_jsonb(a),'channel',target_channel,'destination',case when target_channel='whatsapp' then c.whatsapp else c.approver_email end);
end; $$;
create function public.event_finish_approval_notification(target_approval uuid,target_channel text,result_status text,external_id text default null,result_detail text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if result_status not in ('accepted','failed','uncertain') then raise exception 'Estado inválido'; end if;
 update public.event_approval_notifications set status=result_status,provider_id=left(external_id,300),detail=left(result_detail,500),updated_at=now() where approval_id=target_approval and channel=target_channel and status='sending';
end; $$;
revoke all on function public.event_claim_approval_notification(uuid,text) from public,anon,authenticated;
revoke all on function public.event_finish_approval_notification(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.event_claim_approval_notification(uuid,text) to service_role;
grant execute on function public.event_finish_approval_notification(uuid,text,text,text,text) to service_role;
create function public.event_retry_approval_notifications(target_approval uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform event_private.require_team();
 if not exists(select 1 from public.event_proposal_approvals where id=target_approval and status='pending' and expires_at>now()) then raise exception 'Solicitação não está pendente'; end if;
 update public.event_approval_notifications set status='pending',updated_at=now() where approval_id=target_approval and status='failed' and attempts<3;
 insert into public.event_approval_audit(approval_id,action,actor_id) values(target_approval,'notification_retry_requested',auth.uid());
end; $$;
revoke all on function public.event_retry_approval_notifications(uuid) from public,anon;
grant execute on function public.event_retry_approval_notifications(uuid) to authenticated;

-- Public visibility is based on the customer-visible commercial content, not only
-- on publication_status. Prior published records are grandfathered during activation.
create table event_private.proposal_public_baseline(proposal_id uuid primary key references public.propostas(id),fingerprint text not null);
alter table event_private.proposal_public_baseline enable row level security;
revoke all on event_private.proposal_public_baseline from public,anon,authenticated;
create function event_private.public_proposal_fingerprint(p public.propostas) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object('id',p.id,'version',p.versao,'name',p.cliente_nome,'email',p.cliente_email,
 'type',p.tipo_evento,'date',p.data_evento,'time',p.horario_evento,'guests',p.convidados,'duration',p.duracao,
 'subtotal',p.subtotal,'service',p.taxa_servico,'private',p.privatizacao,'total',p.total,
 'event',coalesce(p.snapshot->'event','{}')-'notes'-'signalDeadlineAt',
 'totals',p.snapshot->'totals','items',p.snapshot->'selectedItems','terms',p.snapshot->'generalTerms',
 'payment',p.snapshot->'paymentTerms','offers',p.snapshot->'publicOfferOptions','changes',p.snapshot->'versionChanges')::text,'sha256'),'hex');
$$;
create function event_private.remote_proposal_is_public(p public.propostas) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from event_private.proposal_approval_policy where id and enabled)
 or exists(select 1 from event_private.proposal_public_baseline b where b.proposal_id=p.id and b.fingerprint=event_private.public_proposal_fingerprint(p))
 or exists(select 1 from public.event_proposal_approvals a where a.proposal_id=p.id and a.status='approved' and a.send_id is not null
 and event_private.public_proposal_fingerprint(jsonb_populate_record(null::public.propostas,a.proposal_snapshot))=event_private.public_proposal_fingerprint(p));
$$;
revoke all on function event_private.public_proposal_fingerprint(public.propostas) from public,anon,authenticated;
revoke all on function event_private.remote_proposal_is_public(public.propostas) from public,anon,authenticated;
create function public.event_proposal_can_share(target_proposal uuid,expected_revision bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.propostas;
begin
 perform event_private.require_team(); select * into p from public.propostas where id=target_proposal;
 return found and p.revision=expected_revision and event_private.remote_proposal_is_public(p) and p.publication_status<>'draft' and p.public_token_revoked_at is null and p.public_token_expires_at>now();
end; $$;
revoke all on function public.event_proposal_can_share(uuid,bigint) from public,anon;
grant execute on function public.event_proposal_can_share(uuid,bigint) to authenticated;

create or replace function event_private.lock_public_proposal(proposal_token uuid) returns public.propostas language plpgsql security definer set search_path='' as $$
declare requested public.propostas; resolved public.propostas;
begin
  select * into requested from public.propostas where public_token=proposal_token and public_token_revoked_at is null;
  if not found then raise exception 'Proposta nao encontrada ou link expirado'; end if;
  if requested.oportunidade_id is not null then perform event_private.lock_proposal_group(requested.oportunidade_id); end if;
  -- Re-read the bearer capability after the group lock, including revocation.
  select * into requested from public.propostas where public_token=proposal_token and public_token_revoked_at is null;
  if not found then raise exception 'Proposta nao encontrada ou link expirado'; end if;
  select * into resolved from public.propostas where oportunidade_id=requested.oportunidade_id and is_current
    and public_token_revoked_at is null and public_token_expires_at>now() and event_private.remote_proposal_is_public(propostas);
  if not found then resolved:=requested; end if;
  select * into resolved from public.propostas where id=resolved.id for update;
  if resolved.id is null or resolved.public_token_revoked_at is not null or resolved.public_token_expires_at<=now() or resolved.publication_status='draft' or not event_private.remote_proposal_is_public(resolved) then
    raise exception 'Proposta nao encontrada ou link expirado';
  end if;
  return resolved;
end; $$;

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
      'selectedItems', p.snapshot -> 'selectedItems',
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
CREATE OR REPLACE FUNCTION public.get_my_event_history()
 RETURNS TABLE(proposal_id uuid, oportunidade_id uuid, versao integer, status text, cliente_nome text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, total numeric, public_token uuid, snapshot jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (
    select lower(nullif(trim(coalesce(auth.jwt() ->> 'email','')), '')) as email
  )
  select
    p.id,
    p.oportunidade_id,
    p.versao,
    p.status,
    p.cliente_nome,
    p.tipo_evento,
    p.data_evento,
    p.horario_evento,
    p.convidados,
    p.total,
    p.public_token,
    jsonb_strip_nulls(jsonb_build_object(
      'client', p.snapshot -> 'client',
      'event', p.snapshot -> 'event',
      'selectedItems', p.snapshot -> 'selectedItems',
      'qualificacao', p.snapshot -> 'qualificacao',
      'sourceRequestSnapshot', p.snapshot -> 'sourceRequestSnapshot'
    )),
    p.created_at,
    p.updated_at
  from public.propostas p, me
  where me.email is not null
    and lower(coalesce(p.cliente_email,'')) = me.email
    and coalesce(p.is_current, true) = true
    and p.publication_status <> 'draft'
    and event_private.remote_proposal_is_public(p)
  order by coalesce(p.data_evento, p.created_at::date) desc, p.updated_at desc
  limit 12;
$function$
;
