-- Technical probes and read-only journey evidence. No business transitions or sends.
create table event_private.channel_diagnostic_batch (
 singleton boolean primary key default true check(singleton),
 id uuid not null default gen_random_uuid(), requested_at timestamptz not null default now(),
 bridge_request bigint not null, delivery_request bigint not null
);
alter table event_private.channel_diagnostic_batch enable row level security;
revoke all on event_private.channel_diagnostic_batch from public,anon,authenticated;

create function event_private.queue_channel_diagnostics() returns uuid
language plpgsql security definer set search_path='' as $$
declare batch event_private.channel_diagnostic_batch; bridge_id bigint; delivery_id bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('events-channel-diagnostics',0));
 select * into batch from event_private.channel_diagnostic_batch where singleton;
 if batch.requested_at>now()-interval '60 seconds' then return batch.id; end if;
 select net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-bot-bridge',
  body:='{"action":"diagnose"}',headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',delivery_job_key),timeout_milliseconds:=30000)
 into bridge_id from event_private.channel_credentials where provider='zapi';
 select net.http_post(url:='https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-email-delivery',
  body:='{"action":"diagnose"}',headers:=jsonb_build_object('Content-Type','application/json','x-event-job-key',delivery_job_key),timeout_milliseconds:=30000)
 into delivery_id from event_private.channel_credentials where provider='zepto';
 insert into event_private.channel_diagnostic_batch(singleton,bridge_request,delivery_request)
 values(true,bridge_id,delivery_id)
 on conflict(singleton) do update set id=gen_random_uuid(),requested_at=now(),bridge_request=excluded.bridge_request,delivery_request=excluded.delivery_request
 returning * into batch;
 return batch.id;
end; $$;
revoke all on function event_private.queue_channel_diagnostics() from public,anon,authenticated;

create function public.event_request_channel_diagnostics() returns uuid
language plpgsql security definer set search_path='' as $$
begin
 perform event_private.require_team();
 return event_private.queue_channel_diagnostics();
end; $$;
revoke all on function public.event_request_channel_diagnostics() from public,anon;
grant execute on function public.event_request_channel_diagnostics() to authenticated;

create function event_private.channel_probe_response(request_id bigint,started_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; payload jsonb;
begin
 select status_code,timed_out,error_msg,content into r from net._http_response where id=request_id order by created desc limit 1;
 if not found then return jsonb_build_object('state',case when started_at>now()-interval '45 seconds' then 'pending' else 'expired' end); end if;
 if r.timed_out or r.error_msg is not null or r.status_code is null or r.status_code not in (200,409) then return '{"state":"failed"}'; end if;
 begin payload:=r.content::jsonb; exception when others then return '{"state":"failed"}'; end;
 if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'ok') is distinct from 'boolean' or jsonb_typeof(payload->'diagnostic') is distinct from 'object' then return '{"state":"failed"}'; end if;
 -- All returned fields are fixed booleans; no keys, URLs, identifiers or raw errors.
 if r.status_code=409 then
  return jsonb_build_object('state','blocked','bridge_url',case when payload#>'{diagnostic,urlConfigured}'='false' then false else null end,
   'bridge_secret',case when payload#>'{diagnostic,secretConfigured}'='false' then false else null end,'bridge_reachable',false);
 end if;
 if payload->'ok'<>'true' then return '{"state":"failed"}'; end if;
 return jsonb_build_object('state','observed',
  'bridge_url',case when payload#>'{diagnostic,configured}'='true' then true else null end,
  'bridge_secret',case when payload#>'{diagnostic,configured}'='true' then true else null end,
  'bridge_reachable',case when payload#>'{diagnostic,reachable}'='true' and payload#>>'{diagnostic,account}'='bot:embaixada_urca' then true else null end,
  'email_oauth',case when payload#>'{diagnostic,emailLogsConfigured}'='true' then true when payload#>'{diagnostic,emailLogsConfigured}'='false' then false else null end,
  'whatsapp_credentials',case when payload#>'{diagnostic,whatsapp,credentialsConfigured}'='false' then false when jsonb_typeof(payload#>'{diagnostic,whatsapp,connected}')='boolean' then true else null end,
  'whatsapp_connected',case when payload#>'{diagnostic,whatsapp,connected}'='true' then true when payload#>'{diagnostic,whatsapp,connected}'='false' then false else null end,
  'foreign_callbacks',case when payload#>'{diagnostic,whatsapp,received,present}'='true' and payload#>'{diagnostic,whatsapp,received,ours}'='false'
    or payload#>'{diagnostic,whatsapp,receipts,present}'='true' and payload#>'{diagnostic,whatsapp,receipts,ours}'='false' then true else null end);
end; $$;
revoke all on function event_private.channel_probe_response(bigint,timestamptz) from public,anon,authenticated;

create function event_private.channel_diagnostics_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare batch event_private.channel_diagnostic_batch;
begin
 select * into batch from event_private.channel_diagnostic_batch where singleton;
 if not found then return '{"state":"not_checked"}'; end if;
 return jsonb_build_object('id',batch.id,'requested_at',batch.requested_at,'stale',batch.requested_at<now()-interval '15 minutes',
 'bridge',event_private.channel_probe_response(batch.bridge_request,batch.requested_at),
 'delivery',event_private.channel_probe_response(batch.delivery_request,batch.requested_at));
end; $$;
revoke all on function event_private.channel_diagnostics_snapshot() from public,anon,authenticated;

create function public.event_channel_diagnostics_status() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform event_private.require_team(); return event_private.channel_diagnostics_snapshot();
end; $$;
revoke all on function public.event_channel_diagnostics_status() from public,anon;
grant execute on function public.event_channel_diagnostics_status() to authenticated;

create function public.event_journey_evidence(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.propostas; a public.event_proposal_approvals; b public.event_outbox; h public.event_handoffs;
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
  jsonb_build_object('key','approval','state',case when a.status='approved' and a.decided_by is not null and a.decided_at is not null then 'confirmed' when a.status='pending' and a.expires_at<=now() then 'expired' when a.id is not null then a.status else 'pending' end,'at',a.decided_at,'evidence_id',a.id),
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

-- Explicit reconciliation for an already booked agreement; no automatic backfill.
create function public.confirm_event_reservation(target_proposal uuid,expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.propostas; payment jsonb; before_row public.event_reservations; after_row public.event_reservations; unchanged boolean;
begin
 perform event_private.require_team();
 if not public.is_super_admin() then raise insufficient_privilege using message='A confirmação de disponibilidade é exclusiva do gestor.'; end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision then raise exception using errcode='PT409',message='A proposta mudou. Revise o acordo atual antes de reservar.'; end if;
 if p.is_current is distinct from true or coalesce(p.publication_status,'') not in ('ready','sent') or p.snapshot ? 'amendmentOf' or coalesce(p.status,'') not in ('confirmado','pagamento_final','planejamento','evento_proximo')
  or p.data_evento is null or p.horario_evento is null or (p.data_evento+p.horario_evento) at time zone 'America/Sao_Paulo'<=now() then
  raise exception 'Use um acordo atual já confirmado e com início futuro. A reserva não reabre nem confirma a venda.';
 end if;
 payment:=p.snapshot->'pagamentoSinal';
 if payment->>'validacaoPendente'='true' or not (case when jsonb_typeof(payment->'valor')='number' then (payment->>'valor')::numeric>0 else false end)
  or nullif(payment->>'validadoEm','') is null or not exists(select 1 from auth.users u where u.id::text=payment->>'validadoPor' and lower(u.email) in ('leorangel@gmail.com','financeiro@embaixadacarioca.com.br')) then
  raise exception 'Confira o crédito e registre a validação auditada do Financeiro antes de reservar.';
 end if;
 if (payment->>'valor')::numeric+0.01<p.total*0.5 and (length(trim(coalesce(payment->>'motivoExcecao','')))<10 or nullif(payment->>'excecaoAutorizadaEm','') is null
  or not exists(select 1 from auth.users u where u.id::text=payment->>'excecaoAutorizadaPor' and lower(u.email)='leorangel@gmail.com')) then
  raise exception 'Revalide a exceção do sinal abaixo do padrão com o gestor antes de reservar.';
 end if;
 select * into before_row from public.event_reservations where opportunity_id=p.oportunidade_id;
 -- Existing shared lock, money/discount checks, overlapping reservations and legacy bookings.
 after_row:=event_private.reserve_proposal(p,'confirmed',null);
 unchanged:=before_row.proposal_id is not distinct from after_row.proposal_id and before_row.status='confirmed'
  and (before_row.starts_at,before_row.ends_at,before_row.guests,before_row.exclusive) is not distinct from (after_row.starts_at,after_row.ends_at,after_row.guests,after_row.exclusive);
 if not coalesce(unchanged,false) then
  insert into public.event_messages(opportunity_id,proposal_id,channel,direction,source,body,created_by)
  values(p.oportunidade_id,p.id,'note','internal','system','Disponibilidade e capacidade conferidas; reserva confirmada pelo gestor para a revisão '||p.revision::text||'. Esta ação não registra pagamento ou contato com cliente.',auth.uid());
 end if;
 return jsonb_build_object('proposal_id',p.id,'revision',p.revision,'reservation',to_jsonb(after_row),'already_confirmed',coalesce(unchanged,false));
end; $$;
revoke all on function public.confirm_event_reservation(uuid,bigint) from public,anon;
grant execute on function public.confirm_event_reservation(uuid,bigint) to authenticated;
