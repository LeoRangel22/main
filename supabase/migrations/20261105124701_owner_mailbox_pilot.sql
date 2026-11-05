-- Installed closed. No send, mailbox access, schedule, credential or business write.
create table event_private.mailbox_owner_pilot (
 singleton boolean primary key default true check(singleton),
 version bigint not null default 0,
 state text not null default 'closed' check(state in ('open','closed')),
 owner_id uuid references auth.users(id),
 proposal_ids uuid[] not null default '{}', recipient text,
 started_at timestamptz, expires_at timestamptz,
 capture_send_ids uuid[] not null default '{}',
 account_id text, last_request uuid, last_job bigint, last_queued_at timestamptz,
 check(cardinality(proposal_ids)<=2 and cardinality(capture_send_ids)<=2),
 check(state='closed' or (cardinality(proposal_ids) between 1 and 2 and owner_id is not null
   and recipient is not null and account_id is not null and started_at is not null
   and expires_at>started_at and expires_at<=started_at+interval '15 minutes'))
);
alter table event_private.mailbox_owner_pilot enable row level security;
revoke all on event_private.mailbox_owner_pilot from public,anon,authenticated,service_role;
insert into event_private.mailbox_owner_pilot(singleton) values(true);
create table event_private.mailbox_owner_pilot_jobs(
 request_id uuid primary key,owner_id uuid not null references auth.users(id),
 pilot_version bigint not null,job_id bigint not null,created_at timestamptz not null default clock_timestamp()
);
alter table event_private.mailbox_owner_pilot_jobs enable row level security;
revoke all on event_private.mailbox_owner_pilot_jobs from public,anon,authenticated,service_role;

create function public.event_email_owner_pilot_config() returns jsonb
language sql security definer set search_path='' as $$
 select case when p.version=0 then null else jsonb_build_object('version',p.version,'state',p.state,
  'proposal_ids',p.proposal_ids,'recipient',p.recipient,
  'started_at',to_char(p.started_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'expires_at',to_char(p.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end
 from event_private.mailbox_owner_pilot p where singleton;
$$;
revoke all on function public.event_email_owner_pilot_config() from public,anon,authenticated;
grant execute on function public.event_email_owner_pilot_config() to service_role;

create function public.event_owner_mailbox_pilot(action text, expected_version bigint default null,
 target_ids uuid[] default '{}', request_id uuid default null, confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p event_private.mailbox_owner_pilot; s event_private.mailbox_sync_state;
 c event_private.channel_credentials; actor_email text; item uuid; matched integer;
 current_ms bigint; window_start timestamptz; response net._http_response; job_state text:='none'; result jsonb;
begin
 perform event_private.require_mailbox_oauth_owner();
 select lower(u.email) into actor_email from auth.users u where u.id=auth.uid()
   and lower(u.email)=lower(auth.jwt()->>'email');
 if not public.is_super_admin() or actor_email is null then
  raise insufficient_privilege using message='owner_required'; end if;
 if $1 is null or $1 not in ('status','open','capture','queue','close') then raise exception 'pilot_action_invalid';end if;
 if $3 is null or cardinality($3)>2 or array_position($3,null) is not null then raise exception 'pilot_scope_invalid';end if;
 if $1<>'status' then perform pg_advisory_xact_lock(716612);end if;
 select * into p from event_private.mailbox_owner_pilot where singleton for update;
 select * into s from event_private.mailbox_sync_state where singleton for update;
 select * into c from event_private.channel_credentials where provider='mailbox' for update;
 if $1<>'status' and ($2 is null or $2 is distinct from p.version) then raise exception 'pilot_changed';end if;
 if $1 in ('open','capture') and $5 is distinct from true then raise exception 'pilot_confirmation_required';end if;

 if $1='open' then
  if cardinality($3) not between 1 and 2 or cardinality($3)<>(select count(distinct x) from unnest($3) x)
   then raise exception 'pilot_scope_invalid';end if;
  if p.state='open' or s.enabled or c.enabled or cardinality(s.capture_send_ids)>0 then raise exception 'pilot_already_active';end if;
  if s.account_id is null or s.account_id !~ '^[0-9]{1,40}$'
   or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br'
   or c.expected_account is distinct from s.mailbox or nullif(c.delivery_job_key,'') is null
   then raise exception 'pilot_connection_pending';end if;
  select count(*) into matched from public.propostas q where q.id=any($3)
   and lower(trim(q.cliente_email))=actor_email
   and q.cliente_nome ~ '^\[TESTE SEM VALOR COMERCIAL\] QA-VENDA-0[123]($|[^0-9])'
   and q.status in ('proposta_pronta','negociacao') and not q.journey_booked_locked
   and q.public_token_revoked_at is null and q.public_token_expires_at>clock_timestamp()
   and nullif(q.snapshot->'pagamentoSinal','null'::jsonb) is null
   and nullif(q.snapshot->'pagamentoRestante','null'::jsonb) is null
   and not exists(select 1 from public.event_outbox b where b.proposal_id=q.id and b.channel='email'
     and b.status in ('sending','accepted','uncertain'));
  if matched<>cardinality($3) then raise exception 'pilot_proposals_unverified';end if;
  window_start:=date_trunc('milliseconds',clock_timestamp());
  -- An unbound preview is not a send. Refresh it so this window owns its route.
  update event_private.mailbox_reply_routes set revoked_at=window_start
   where proposal_id=any($3) and account_id=s.account_id and destination=actor_email
    and send_id is null and revoked_at is null;
  update event_private.mailbox_owner_pilot set version=version+1,state='open',owner_id=auth.uid(),
   proposal_ids=$3,recipient=actor_email,started_at=window_start,
   expires_at=window_start+interval '15 minutes',
   capture_send_ids='{}',account_id=s.account_id,last_request=null,last_job=null,last_queued_at=null
   where singleton returning * into p;
 end if;

 if $1 in ('capture','queue') then
  if p.state<>'open' or p.owner_id is distinct from auth.uid() or p.account_id is distinct from s.account_id
   or p.recipient is distinct from actor_email or p.started_at>clock_timestamp() or p.expires_at<=clock_timestamp()
   or s.mailbox is distinct from 'eventos@embaixadacarioca.com.br' or c.expected_account is distinct from s.mailbox
   then raise exception 'pilot_closed_or_changed';end if;
 end if;
 if $1='capture' then
  if s.enabled or c.enabled or cardinality(s.capture_send_ids)>0 or cardinality(p.capture_send_ids)>0
   or cardinality($3) not between 1 and 2 or cardinality($3)<>(select count(distinct x) from unnest($3) x)
   then raise exception 'pilot_capture_scope_invalid';end if;
  select count(*) into matched from public.event_outbox b
   join event_private.mailbox_reply_routes r on r.send_id=b.id and r.send_attempt=b.attempts
   where b.id=any($3) and b.proposal_id=any(p.proposal_ids) and b.channel='email' and b.status='accepted'
   and nullif(trim(b.provider_id),'') is not null and lower(trim(b.destination))=p.recipient
   and r.destination=p.recipient and r.account_id=p.account_id and r.proposal_id=b.proposal_id
   and r.proposal_revision=b.reviewed_revision and r.revoked_at is null and r.expires_at>clock_timestamp()
   and r.created_at>=p.started_at and b.created_at>=p.started_at;
  if matched<>cardinality($3) then raise exception 'pilot_send_binding_unverified';end if;
  current_ms:=floor(extract(epoch from p.started_at)*1000)::bigint;
  if s.watermark_ms>floor(extract(epoch from clock_timestamp())*1000)::bigint then raise exception 'pilot_cursor_invalid';end if;
  update event_private.mailbox_sync_state set enabled=true,activated_at_ms=current_ms,
   watermark_ms=greatest(coalesce(watermark_ms,current_ms),current_ms),version=version+1,
   capture_send_ids=$3,capture_started_at=p.started_at,capture_expires_at=p.expires_at,capture_message_limit=4 where singleton;
  update event_private.channel_credentials set enabled=true,updated_at=clock_timestamp() where provider='mailbox';
  update event_private.mailbox_owner_pilot set version=version+1,capture_send_ids=$3 where singleton returning * into p;
 end if;

 if $1='queue' then
  if $4 is null or cardinality(p.capture_send_ids) not between 1 and 2
   or s.enabled is distinct from true or c.enabled is distinct from true
   or s.capture_send_ids is distinct from p.capture_send_ids
   or s.capture_started_at is distinct from p.started_at or s.capture_expires_at is distinct from p.expires_at
   then raise exception 'pilot_capture_inactive';end if;
  if exists(select 1 from event_private.mailbox_owner_pilot_jobs j where j.request_id=$4) then
   if not exists(select 1 from event_private.mailbox_owner_pilot_jobs j where j.request_id=$4
     and j.owner_id=auth.uid() and j.pilot_version=p.version) then raise exception 'pilot_request_reused';end if;
  else
   if p.last_job is not null then
    select * into response from net._http_response where id=p.last_job;
    if not found or response.status_code is distinct from 200 or response.timed_out
      or response.error_msg is not null then raise exception 'pilot_previous_result_unconfirmed';end if;
    if p.last_queued_at>clock_timestamp()-interval '45 seconds' then raise exception 'pilot_poll_too_soon';end if;
   end if;
   update event_private.mailbox_owner_pilot set last_request=$4,last_queued_at=clock_timestamp(),last_job=
    net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync',
     body:='{"action":"sync"}'::jsonb,
     headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',c.delivery_job_key),
     timeout_milliseconds:=120000)
    where singleton returning * into p;
   insert into event_private.mailbox_owner_pilot_jobs(request_id,owner_id,pilot_version,job_id)
    values($4,auth.uid(),p.version,p.last_job);
  end if;
 end if;

 if $1='close' then
  if p.owner_id is distinct from auth.uid() or p.version=0 then raise exception 'pilot_owner_changed';end if;
  if cardinality(p.capture_send_ids)>0 and (s.enabled or c.enabled or cardinality(s.capture_send_ids)>0) and
    (s.account_id is distinct from p.account_id or s.capture_send_ids is distinct from p.capture_send_ids
     or s.capture_started_at is distinct from p.started_at or s.capture_expires_at is distinct from p.expires_at)
    then raise exception 'pilot_configuration_changed';end if;
  if cardinality(p.capture_send_ids)>0 and s.capture_send_ids=p.capture_send_ids
    and s.capture_started_at=p.started_at and s.capture_expires_at=p.expires_at then
   update event_private.mailbox_sync_state set enabled=false,capture_send_ids='{}',
    capture_started_at=null,capture_expires_at=null,capture_message_limit=4,version=version+1 where singleton;
   update event_private.channel_credentials set enabled=false,updated_at=clock_timestamp() where provider='mailbox';
  end if;
  update event_private.mailbox_reply_routes set revoked_at=clock_timestamp()
   where proposal_id=any(p.proposal_ids) and created_at>=p.started_at and revoked_at is null;
  update event_private.mailbox_owner_pilot set state='closed',version=version+1 where singleton returning * into p;
 end if;

 select * into s from event_private.mailbox_sync_state where singleton;
 select * into c from event_private.channel_credentials where provider='mailbox';
 if p.last_job is not null then
  select * into response from net._http_response where id=p.last_job;
  job_state:=case when not found then 'pending_or_unknown'
   when response.status_code=200 and not coalesce(response.timed_out,false) and response.error_msg is null then 'completed'
   else 'unconfirmed' end;
 end if;
 result:=jsonb_build_object('version',p.version,'state',case when p.state='open' and p.expires_at<=clock_timestamp() then 'expired' else p.state end,
  'proposalIds',p.proposal_ids,'recipient',p.recipient,'startsAt',p.started_at,'expiresAt',p.expires_at,
  'captureSendIds',p.capture_send_ids,'captureEnabled',s.enabled and c.enabled,
  'captureScoped',s.enabled and c.enabled and s.capture_send_ids=p.capture_send_ids
    and s.capture_started_at=p.started_at and s.capture_expires_at=p.expires_at,
  'connectionReady',s.account_id is not null and s.mailbox='eventos@embaixadacarioca.com.br'
    and c.expected_account=s.mailbox and nullif(c.delivery_job_key,'') is not null,
  'jobState',job_state,'lastQueuedAt',p.last_queued_at,
  'proposals',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'version',q.versao,'revision',q.revision,
    'name',q.cliente_nome,'guests',q.convidados,'total',q.total,'publication',q.publication_status) order by q.created_at),'[]'::jsonb)
    from public.propostas q where lower(trim(q.cliente_email))=actor_email
     and q.cliente_nome ~ '^\[TESTE SEM VALOR COMERCIAL\] QA-VENDA-0[123]($|[^0-9])'),
  'sends',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'proposalId',b.proposal_id,'revision',b.reviewed_revision,
    'status',b.status,'attempts',b.attempts,'routed',exists(select 1 from event_private.mailbox_reply_routes r
      where r.send_id=b.id and r.send_attempt=b.attempts and r.account_id=p.account_id
       and r.revoked_at is null and r.expires_at>clock_timestamp()))),'[]'::jsonb)
    from public.event_outbox b where b.proposal_id=any(p.proposal_ids) and b.channel='email'
     and lower(trim(b.destination))=actor_email),
  'replies',(select coalesce(jsonb_agg(jsonb_build_object('messageId',r.message_id,'proposalId',r.proposal_id,
    'revision',r.proposal_revision,'sendId',r.send_id,'recordedAt',r.recorded_at,'persisted',m.id is not null
     and m.proposal_id=r.proposal_id and m.opportunity_id=b.opportunity_id and m.direction='inbound'
     and r.proposal_revision=b.reviewed_revision and r.send_attempt=b.attempts)),'[]'::jsonb)
    from event_private.mailbox_bound_receipts r join public.event_outbox b on b.id=r.send_id
     left join public.event_messages m on m.id=r.message_id
    where r.send_id=any(p.capture_send_ids) and r.account_id=p.account_id and r.message_id is not null
     and r.binding_origin='server_generated_reply_to_capability'
     and r.recorded_at>=p.started_at),
  'leadHooks',(select jsonb_build_object('insert',count(*) filter(where t.tgname='notify_new_lead_webhook' and t.tgtype=5 and t.tgenabled in ('O','A'))=1,
    'complete',count(*) filter(where t.tgname='notify_completed_quote_webhook' and t.tgtype=17 and t.tgenabled in ('O','A')
     and pg_get_triggerdef(t.oid) like '%old.capture_status = ''partial''::text%'
     and pg_get_triggerdef(t.oid) like '%new.capture_status = ''complete''::text%')=1,
    'unexpected',count(*) filter(where t.tgname not in ('notify_new_lead_webhook','notify_completed_quote_webhook','solicitacoes_cotacao_set_updated_at','solicitacoes_sync_opportunity')))
    from pg_trigger t where t.tgrelid='public.solicitacoes_cotacao'::regclass and not t.tgisinternal));
 return result;
end $$;
revoke all on function public.event_owner_mailbox_pilot(text,bigint,uuid[],uuid,boolean) from public,anon,service_role;
grant execute on function public.event_owner_mailbox_pilot(text,bigint,uuid[],uuid,boolean) to authenticated;
