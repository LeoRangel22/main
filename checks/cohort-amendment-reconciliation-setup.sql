create temporary table cohort_amendment_expected(case_name text primary key,proposal_id uuid,opportunity_id uuid,before_row jsonb,keep boolean);
do $$
declare actor uuid; fixture text; opp uuid; p public.propostas; a public.event_proposal_approvals; b uuid;
begin
 perform set_config('request.jwt.claims','',true);
 select id into actor from auth.users where email='leorangel@gmail.com';
 foreach fixture in array array['applied_approval','applied_send','snapshot_only_applied','ordinary_approval','ordinary_send'] loop
  insert into oportunidades(cliente_nome,status,created_at,metadata)
   values('Applied amendment cohort fixture','negociacao',now()-interval '320 days','{}') returning id into opp;
  insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,created_at,snapshot)
   values(opp,'Applied amendment cohort fixture','negociacao','sent',false,now()-interval '319 days',
    case when fixture like 'applied_%' then '{"appliedAmendment":{"id":"synthetic"}}'::jsonb else '{}'::jsonb end) returning * into p;
  -- Model the pre-migration absence of derived evidence without changing agreement data.
  delete from event_private.proposal_preparation_evidence where proposal_id=p.id;
  if fixture in ('applied_approval','ordinary_approval','snapshot_only_applied') then
   a:=jsonb_populate_record(null::public.event_proposal_approvals,jsonb_build_object(
    'id',gen_random_uuid(),'proposal_id',p.id,'revision',p.revision,'proposal_fingerprint','synthetic',
    'review_hash',gen_random_uuid()::text,'request_fingerprint',gen_random_uuid()::text,'request_generation',1,
    'proposal_snapshot',to_jsonb(p)||case when fixture='snapshot_only_applied' then jsonb_build_object('snapshot','{"appliedAmendment":{"id":"synthetic"}}'::jsonb) else '{}'::jsonb end,
    'content','{"channel":"whatsapp"}'::jsonb,'requested_by',actor,'approver_id',actor,'approver_email','leorangel@gmail.com','status','pending',
    'created_at',now()-interval '310 days','expires_at',now()+interval '2 days'));
   insert into event_proposal_approvals select a.*;
  else
   insert into event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,provider_id,approved_by,created_at)
    values(p.id,opp,gen_random_uuid()::text,'email','fixture@example.test','Synthetic backfill fixture','accepted','synthetic-provider',actor,now()-interval '315 days') returning id into b;
   insert into event_messages(proposal_id,opportunity_id,channel,direction,source,body,delivery_status,external_id,occurred_at,created_by)
    values(p.id,opp,'email','outbound','provider','Synthetic backfill fixture','accepted','send:'||b::text,now()-interval '310 days',actor);
  end if;
  insert into cohort_amendment_expected values(fixture,p.id,opp,to_jsonb(p),fixture like 'ordinary_%');
 end loop;
end $$;
