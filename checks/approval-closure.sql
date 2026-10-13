-- Synthetic approval lifecycles and alerts. Never call a provider; rollback everything.
begin;
do $$
declare manager uuid;seller uuid;opp uuid;p public.propostas;a public.event_proposal_approvals;b public.event_proposal_approvals;c jsonb;batch jsonb;k text:=repeat('a',64);blocked boolean;probe uuid:=gen_random_uuid();job jsonb;before_sends bigint;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 update event_private.proposal_approval_policy set enabled=true,approver_id=manager,approver_email='manager@example.test',whatsapp='5521000000000' where id;
 update event_private.approval_watch_config set enabled=true,job_key=k where id;
 assert not has_function_privilege('anon','public.event_claim_approval_watch(text,uuid)','execute');
 assert not has_function_privilege('authenticated','public.event_claim_approval_watch(text,uuid)','execute');
 assert not has_table_privilege('authenticated','event_private.approval_watch_config','select');
 assert not has_table_privilege('authenticated','public.event_approval_watch_alerts','insert');
 assert not has_table_privilege('anon','public.event_approval_watch_alerts','select');
 insert into oportunidades(cliente_nome,status,data_evento) values('Closure synthetic fixture','proposta_pronta','2099-11-18') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,cliente_email,cliente_whatsapp,tipo_evento,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,status,publication_status,is_current,snapshot)
 values(opp,'Closure synthetic fixture','fixture@example.test','5521000000001','Coffee Break','2099-11-18','10:00',20,2,1000,120,0,1120,'proposta_pronta','ready',true,
 '{"event":{"type":"Coffee Break","guests":20},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"name":"Fixture","calc":{"total":1000}}]}') returning * into p;
 c:=jsonb_build_object('channel','whatsapp','destination','5521000000001','body','Fixture approved content','message','Fixture approved content','title','Fixture','contentHash',null,'reviewedResponseAt',null,'proposalUrl','https://leorangel22.github.io/main/proposta.html?p='||p.public_token);
 select * into a from event_create_proposal_approval(p.id,p.revision,seller,c);
 assert (select id=a.id from event_create_proposal_approval(p.id,p.revision,seller,c));
 update event_proposal_approvals set expires_at=now()-interval '1 second' where id=a.id;
 select * into b from event_create_proposal_approval(p.id,p.revision,seller,c);
 assert b.id<>a.id and b.supersedes_id=a.id and b.review_hash<>a.review_hash;
 assert b.request_fingerprint=a.request_fingerprint and b.revision=p.revision and b.expires_at>now();
 assert (select revision=p.revision and public_token=p.public_token from propostas where id=p.id),'Renewal never edits a proposal';
 assert (select status='invalidated' and expires_at<now() from event_proposal_approvals where id=a.id),'Old link stays unusable';
 assert event_claim_approval_notification(a.id,'email') is null;
 assert (select count(*)=2 from event_approval_notifications where approval_id=b.id);
 assert (select id=b.id from event_create_proposal_approval(p.id,p.revision,seller,c)),'Renewal deduplicates without fake edits';
 a:=b;
 update event_proposal_approvals set status='rejected',reason='Manager fixture rejected' where id=a.id;
 select * into b from event_create_proposal_approval(p.id,p.revision,seller,c);
 assert b.id<>a.id and b.supersedes_id=a.id and b.status='pending';
 assert (select reason='Manager fixture rejected' from event_proposal_approvals where id=a.id),'Prior decision reason preserved';
 assert (select id=b.id from event_create_proposal_approval(p.id,p.revision,seller,c));
 select count(*) into before_sends from event_outbox;
 blocked:=false;begin perform event_claim_approval_watch(repeat('b',64));exception when insufficient_privilege then blocked:=true;end;
 assert blocked and not exists(select 1 from event_approval_watch_alerts),'Wrong key never reads or claims alerts';
 update event_proposal_approvals set created_at=now()-interval '3 hours' where id=b.id;
 update event_approval_notifications set status='accepted' where approval_id=b.id;
 batch:=event_claim_approval_watch(k);
 assert (select count(*)=2 from event_approval_watch_alerts where approval_id=b.id and kind='approval_waiting');
 assert (select count(*)=before_sends from event_outbox),'Monitoring never dispatches a proposal';
 assert (select status='pending' from event_proposal_approvals where id=b.id),'Monitoring never approves';
 for job in select value from jsonb_array_elements(batch->'jobs') loop
  perform event_finish_approval_watch_alert((job->>'id')::uuid,'accepted','fixture-id','Fixture accepted');
 end loop;
 perform event_complete_approval_watch((batch->>'run_id')::uuid);
 update event_private.approval_watch_config set last_started_at=now()-interval '5 minutes' where id;
 batch:=event_claim_approval_watch(k);
 assert jsonb_array_length(batch->'jobs')=0,'Identical accepted alerts are not duplicated';
 -- Controlled channel probes have their own ledger and no commercial entities.
 batch:=event_claim_approval_watch(k,probe);
 assert jsonb_array_length(batch->'jobs')=2;
 for job in select value from jsonb_array_elements(batch->'jobs') loop
  assert job->>'destination' in ('manager@example.test','5521000000000');
  perform event_finish_approval_watch_alert((job->>'id')::uuid,'uncertain',null,'Fixture timeout');
 end loop;
 perform event_complete_approval_watch((batch->>'run_id')::uuid);
 assert (event_claim_approval_watch(k,probe)->>'skipped')::boolean,'Real probe cannot be repeated by retry';
 assert (select count(*)=2 from event_approval_watch_alerts where kind='probe');
 update event_private.approval_watch_config set last_started_at=now()-interval '5 minutes' where id;
 update event_approval_notifications set status='sending',updated_at=now()-interval '11 minutes' where approval_id=b.id and channel='whatsapp';
 batch:=event_claim_approval_watch(k);
 assert exists(select 1 from event_approval_watch_alerts where approval_id=b.id and kind='notification_stalled');
 assert (select status='sending' from event_approval_notifications where approval_id=b.id and channel='whatsapp'),'Stalled notices are NOT resent or presumed failed';
 update event_private.approval_watch_config set last_started_at=now()-interval '5 minutes' where id;
 update event_approval_notifications set status='failed' where approval_id=b.id and channel='email';
 batch:=event_claim_approval_watch(k);
 assert exists(select 1 from event_approval_watch_alerts where approval_id=b.id and kind='notification_failed');
 update event_private.approval_watch_config set last_started_at=now()-interval '5 minutes' where id;
 update event_proposal_approvals set expires_at=now()-interval '1 second' where id=b.id;
 batch:=event_claim_approval_watch(k);
 assert exists(select 1 from event_approval_watch_alerts where approval_id=b.id and kind='approval_expired');
 assert (select count(*)=before_sends from event_outbox);
 assert (select revision=p.revision from propostas where id=p.id);
end; $$;
rollback;
