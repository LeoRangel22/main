-- Run immediately before 20261018082200_cohort_preparation_review.sql, on an
-- isolated test database only. The paired assertion removes all fixture rows.
create temporary table cohort_preparation_upgrade_expected (
 case_name text primary key,proposal_id uuid not null,opportunity_id uuid not null,
 expected_at timestamptz,expected_source text,before_row jsonb
);
do $$
declare actor uuid; fixture text; opp uuid; p public.propostas; a public.event_proposal_approvals; b uuid; stamped timestamptz; source_kind text;
begin
 assert to_regclass('event_private.proposal_preparation_evidence') is null;
 select id into actor from auth.users where email='leorangel@gmail.com';
 perform set_config('request.jwt.claims','',true);
 foreach fixture in array array['ready_without_evidence','sent_timestamp_only','approval_late','approval_in_window',
  'approval_draft_snapshot','approval_future','accepted_send','send_without_provider','send_without_message','amendment'] loop
  insert into oportunidades(cliente_nome,status,created_at,metadata)
  values('Preparation upgrade '||fixture,'negociacao',now()-interval '240 days','{}') returning id into opp;
  insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,created_at,sent_at,snapshot)
  values(opp,'Preparation upgrade '||fixture,'negociacao',
   case when fixture='sent_timestamp_only' or fixture like 'send_%' or fixture='accepted_send' then 'sent' when fixture='amendment' then 'draft' else 'ready' end,
   false,now()-interval '239 days',case when fixture='sent_timestamp_only' or fixture like 'send_%' or fixture='accepted_send' then now()-interval '238 days' end,
   case when fixture='amendment' then '{"amendmentOf":{"id":"00000000-0000-4000-8000-000000000001"}}'::jsonb else '{}'::jsonb end)
  returning * into p;
  stamped:=null;source_kind:=null;
  if fixture like 'approval_%' or fixture='amendment' then
   -- jsonb_populate_record also supports the runner's late approval_closure
   -- scenario, where request_fingerprint/request_generation do not exist yet.
   a:=jsonb_populate_record(null::public.event_proposal_approvals,jsonb_build_object(
    'id',gen_random_uuid(),'proposal_id',p.id,'revision',p.revision,'proposal_fingerprint','upgrade-fixture',
    'review_hash',gen_random_uuid()::text,'request_fingerprint',gen_random_uuid()::text,'request_generation',1,
    'proposal_snapshot',to_jsonb(p)||jsonb_build_object('publication_status',case when fixture='approval_draft_snapshot' then 'draft' else 'ready' end),
    'content','{"channel":"whatsapp"}'::jsonb,'requested_by',actor,'approver_id',actor,'approver_email','leorangel@gmail.com','status','pending',
    'created_at',case when fixture='approval_late' then now()-interval '200 days' when fixture='approval_future' then now()+interval '1 day' else now()-interval '230 days' end,
    'expires_at',now()+interval '2 days'));
   insert into event_proposal_approvals select a.*;
   if fixture='approval_in_window' then
    -- A later observation must not replace the earliest proven preparation.
    a.id:=gen_random_uuid();a.review_hash:=gen_random_uuid()::text;a.created_at:=now()-interval '229 days';
    insert into event_proposal_approvals select a.*;
    stamped:=now()-interval '230 days';source_kind:='approval_snapshot';
   elsif fixture='approval_late' then stamped:=now()-interval '200 days';source_kind:='approval_snapshot';end if;
  elsif fixture='accepted_send' or fixture like 'send_%' then
   insert into event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,provider_id,approved_by,created_at)
   values(p.id,opp,gen_random_uuid()::text,'email','fixture@example.test','Preparation evidence fixture','accepted',
    case when fixture<>'send_without_provider' then 'provider-fixture' end,actor,now()-interval '235 days') returning id into b;
   if fixture<>'send_without_message' then
    insert into event_messages(proposal_id,opportunity_id,channel,direction,source,body,delivery_status,external_id,occurred_at,created_by)
    values(p.id,opp,'email','outbound','provider','Preparation evidence fixture','accepted','send:'||b::text,now()-interval '225 days',actor);
   end if;
   if fixture='accepted_send' then stamped:=now()-interval '225 days';source_kind:='accepted_send';end if;
  end if;
  insert into cohort_preparation_upgrade_expected(case_name,proposal_id,opportunity_id,expected_at,expected_source,before_row)
  values(fixture,p.id,opp,stamped,source_kind,to_jsonb(p));
 end loop;
end $$;
