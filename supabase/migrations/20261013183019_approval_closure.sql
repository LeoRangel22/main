-- Approval identity is separate from unchanged reviewed content. Historical links remain immutable.
alter table public.event_proposal_approvals add column request_fingerprint text;
alter table public.event_proposal_approvals add column request_generation integer not null default 1;
update public.event_proposal_approvals set request_fingerprint=review_hash;
alter table public.event_proposal_approvals alter column request_fingerprint set not null;
alter table public.event_proposal_approvals add column supersedes_id uuid references public.event_proposal_approvals(id);
create index event_approvals_request_fingerprint_idx on public.event_proposal_approvals(request_fingerprint,created_at desc);
create index event_approvals_supersedes_idx on public.event_proposal_approvals(supersedes_id) where supersedes_id is not null;

create or replace function public.event_create_proposal_approval(target_proposal uuid,expected_revision bigint,requester uuid,prepared_content jsonb) returns public.event_proposal_approvals language plpgsql security definer set search_path='' as $$
declare p public.propostas; c event_private.proposal_approval_policy; a public.event_proposal_approvals; response_at timestamptz; fp text; deadline timestamptz; prior public.event_proposal_approvals; request_id uuid;
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
 -- The proposal row lock serializes requests, including simultaneous renewals.
 select * into prior from public.event_proposal_approvals
 where request_fingerprint=fp order by request_generation desc,created_at desc,id desc limit 1 for update;
 if prior.id is not null then
  if prior.status in ('pending','approved') and prior.expires_at>now() then return prior; end if;
  -- Never renew an already accepted, in-flight or uncertain dispatch into a retry.
  if exists(select 1 from public.event_outbox b where b.id=prior.send_id
    and (b.status in ('accepted','sending','uncertain') or b.delivery_status in ('delivered','read'))) then return prior; end if;
  if prior.status in ('pending','approved') then
   update public.event_proposal_approvals set status='invalidated',reason='Solicitação expirada substituída por nova revisão.' where id=prior.id;
  end if;
 end if;
 request_id:=gen_random_uuid();
 insert into public.event_proposal_approvals(id,proposal_id,revision,proposal_fingerprint,request_fingerprint,review_hash,proposal_snapshot,content,requested_by,approver_id,approver_email,expires_at,supersedes_id,request_generation)
 values(request_id,p.id,p.revision,event_private.proposal_fingerprint(p),fp,
  encode(extensions.digest(fp||':'||request_id::text,'sha256'),'hex'),to_jsonb(p),prepared_content,requester,c.approver_id,c.approver_email,deadline,prior.id,coalesce(prior.request_generation,0)+1)
 returning * into a;
 if prior.id is not null then
  insert into public.event_approval_audit(approval_id,action,actor_id,detail) values(prior.id,'superseded',requester,'Nova solicitação: '||a.id::text);
 end if;
 insert into public.event_approval_notifications(approval_id,channel) values(a.id,'whatsapp'),(a.id,'email');
 insert into public.event_approval_audit(approval_id,action,actor_id) values(a.id,'requested',requester);
 return a;
end; $$;
revoke all on function public.event_create_proposal_approval(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.event_create_proposal_approval(uuid,bigint,uuid,jsonb) to service_role;

-- Watchdog credentials are private and independent from user approval credentials.
create table event_private.approval_watch_config (
 id boolean primary key default true check(id), enabled boolean not null default false,
 job_key text not null default encode(extensions.gen_random_bytes(32),'hex'), project_url text,
 last_started_at timestamptz,last_success_at timestamptz,run_id uuid,last_probe_at timestamptz,
 check(project_url is null or project_url ~ '^https://[a-z0-9]+\.supabase\.co$')
);
insert into event_private.approval_watch_config(id) values(true);
alter table event_private.approval_watch_config enable row level security;
revoke all on event_private.approval_watch_config from public,anon,authenticated;
create table public.event_approval_watch_alerts (
 id uuid primary key default gen_random_uuid(),approval_id uuid references public.event_proposal_approvals(id),
 dedupe_key text not null unique,kind text not null,channel text not null check(channel in ('whatsapp','email')),
 status text not null default 'pending' check(status in ('pending','sending','accepted','failed','uncertain')),
 attempts integer not null default 0,provider_id text,detail text,run_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(kind in ('approval_waiting','approval_expired','notification_failed','notification_stalled','dispatch_attention','probe'))
);
create index event_approval_watch_pending_idx on public.event_approval_watch_alerts(status,updated_at);
create index event_approval_watch_approval_idx on public.event_approval_watch_alerts(approval_id);
alter table public.event_approval_watch_alerts enable row level security;
revoke all on public.event_approval_watch_alerts from public,anon,authenticated;
grant select on public.event_approval_watch_alerts to authenticated;
grant all on public.event_approval_watch_alerts to service_role;
create policy approval_watch_team_read on public.event_approval_watch_alerts for select to authenticated using ((select public.is_team_member()));

create function public.event_claim_approval_watch(supplied_key text,probe_id uuid default null) returns jsonb
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
   select q.*,b.status as send_status,b.updated_at as send_updated_at
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
    elsif exists(select 1 from public.event_approval_notifications n where n.approval_id=a.id and n.status='failed') then reason:='notification_failed';
    elsif exists(select 1 from public.event_approval_notifications n where n.approval_id=a.id and
      (n.status='uncertain' or (n.status in ('pending','sending') and n.updated_at<=now()-interval '10 minutes'))) then reason:='notification_stalled';
    elsif a.created_at<=now()-interval '2 hours' then reason:='approval_waiting';
    end if;
   elsif (a.send_id is null and a.decided_at<=now()-interval '5 minutes') or a.send_status in ('failed','uncertain') or
     (a.send_status='sending' and a.send_updated_at<=now()-interval '10 minutes') then reason:='dispatch_attention';
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
  select w.* from public.event_approval_watch_alerts w
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
      when 'dispatch_attention' then q.status='approved' and ((q.send_id is null and q.decided_at<=now()-interval '5 minutes') or exists(select 1 from public.event_outbox bb where bb.id=q.send_id and (bb.status in ('failed','uncertain') or (bb.status='sending' and bb.updated_at<=now()-interval '10 minutes'))))
      else false end))
  order by w.created_at,w.id limit 8 for update of w skip locked
 loop
  update public.event_approval_watch_alerts set status='sending',attempts=attempts+1,updated_at=now(),run_id=run where id=n.id;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',n.id,'kind',n.kind,'channel',n.channel,
   'destination',case n.channel when 'email' then p.approver_email else p.whatsapp end,
   'approval_id',n.approval_id,'reference',n.dedupe_key));
 end loop;
 return jsonb_build_object('run_id',run,'jobs',jobs);
end; $$;
revoke all on function public.event_claim_approval_watch(text,uuid) from public,anon,authenticated;
grant execute on function public.event_claim_approval_watch(text,uuid) to service_role;

create function public.event_finish_approval_watch_alert(target_id uuid,result_status text,external_id text default null,result_detail text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if result_status not in ('accepted','failed','uncertain') then raise exception 'Resultado inválido'; end if;
 update public.event_approval_watch_alerts set status=result_status,provider_id=left(external_id,300),detail=left(result_detail,500),updated_at=now()
 where id=target_id and status='sending';
 if not found then raise exception 'Tentativa inexistente ou já finalizada'; end if;
end; $$;
revoke all on function public.event_finish_approval_watch_alert(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.event_finish_approval_watch_alert(uuid,text,text,text) to service_role;

create function public.event_complete_approval_watch(target_run uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.event_approval_watch_alerts where run_id=target_run and status='sending') then raise exception 'Resultados do monitor ainda não confirmados'; end if;
 update event_private.approval_watch_config set last_success_at=now() where id and run_id=target_run;
end; $$;
revoke all on function public.event_complete_approval_watch(uuid) from public,anon,authenticated;
grant execute on function public.event_complete_approval_watch(uuid) to service_role;

create function public.get_event_approval_watch_health() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform event_private.require_team();
 return jsonb_build_object('enabled',(select enabled from event_private.approval_watch_config where id),
 'last_success_at',(select last_success_at from event_private.approval_watch_config where id),
 'alerts',coalesce((select jsonb_agg(to_jsonb(w)) from (
  select id,approval_id,kind,channel,status,created_at,updated_at,detail from public.event_approval_watch_alerts
  where kind<>'probe' order by created_at desc limit 30) w),'[]'::jsonb));
end; $$;
revoke all on function public.get_event_approval_watch_health() from public,anon;
grant execute on function public.get_event_approval_watch_health() to authenticated;

create function event_private.run_approval_watch(probe_id uuid default null) returns bigint
language plpgsql security definer set search_path='' as $$
declare c event_private.approval_watch_config;
begin
 select * into c from event_private.approval_watch_config where id;
 if not c.enabled or c.project_url is null then return null; end if;
 return net.http_post(url:=c.project_url||'/functions/v1/event-approval-monitor',
  headers:=jsonb_build_object('Content-Type','application/json','x-approval-watch-key',c.job_key),
  body:=case when probe_id is null then '{}'::jsonb else jsonb_build_object('probeId',probe_id) end,timeout_milliseconds:=55000);
end; $$;
revoke all on function event_private.run_approval_watch(uuid) from public,anon,authenticated,service_role;
select cron.schedule('event-approval-watch','*/5 * * * *','select event_private.run_approval_watch();');
