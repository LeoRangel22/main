-- Isolated fixtures: no HTTP call; every row and policy change is rolled back.
begin;
do $$
declare manager uuid;seller uuid;opp uuid;p public.propostas;before_send public.propostas;a public.event_proposal_approvals;
 b public.event_proposal_approvals;c jsonb;claim jsonb;batch jsonb;k text:=repeat('a',64);blocked boolean;
 old_run uuid:=gen_random_uuid();old_alert uuid;recent_alert uuid;success_before timestamptz;outbound public.event_outbox;
 fp text;changed public.propostas;
begin
 select id into manager from auth.users where email='leorangel@gmail.com';
 select id into seller from auth.users where email='eventos@embaixadacarioca.com.br';
 update event_private.proposal_approval_policy set enabled=true,approver_id=manager,approver_email='manager@example.test',whatsapp='5521000000000' where id;
 update event_private.approval_watch_config set enabled=true,job_key=k where id;
 assert not has_function_privilege('authenticated','event_private.approval_request_fingerprint(public.propostas,jsonb,uuid)','execute');
 assert not has_function_privilege('anon','event_private.approval_dispatch_needs_attention(public.event_outbox,timestamptz)','execute');
 insert into oportunidades(cliente_nome,status,data_evento) values('Closure regression fixture','proposta_pronta','2099-11-18') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,cliente_email,cliente_whatsapp,tipo_evento,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,status,publication_status,is_current,snapshot)
 values(opp,'Closure regression fixture','fixture@example.test','5521000000001','Coffee Break','2099-11-18','10:00',20,2,1000,120,0,1120,'proposta_pronta','ready',true,
 '{"event":{"type":"Coffee Break","guests":20,"signalDeadlineHours":48},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"name":"Fixture","calc":{"total":1000}}],"paymentTerms":"50% signal"}') returning * into p;
 c:=jsonb_build_object('channel','whatsapp','destination','5521000000001','body','Fixture reviewed content','message','Fixture reviewed content','title','Fixture','contentHash',null,'reviewedResponseAt',null,'proposalUrl','https://leorangel22.github.io/main/proposta.html?p='||p.public_token);
 select * into a from event_create_proposal_approval(p.id,p.revision,seller,c);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 perform event_decide_proposal_approval(a.id,'approve',a.review_hash,true,'');
 claim:=begin_event_approved_send(a.id,p.revision,'whatsapp',c->>'destination',c->>'body',c->>'title',null,null);
 assert (claim->>'claimed')::boolean;
 before_send:=p;
 perform finish_event_send((claim#>>'{send,id}')::uuid,'accepted','synthetic-provider-id');
 select * into p from propostas where id=p.id;
 assert p.publication_status='sent' and p.status='proposta_enviada' and p.sent_at is not null;
 assert p.snapshot#>>'{event,signalDeadlineAt}' is not null;
 select * into b from event_create_proposal_approval(p.id,p.revision,seller,c);
 assert b.id=a.id,'Dispatch metadata must reuse the accepted approval';
 update event_proposal_approvals set expires_at=now()-interval '1 second' where id=a.id;
 select * into b from event_create_proposal_approval(p.id,p.revision,seller,c);
 assert b.id=a.id,'Even expired accepted approvals cannot renew into a second send';
 assert (select count(*)=1 from event_proposal_approvals where proposal_id=p.id);
 assert (select count(*)=2 from event_approval_notifications where approval_id=a.id),'No new manager notices after dispatch';
 fp:=event_private.approval_request_fingerprint(before_send,c,manager);
 assert fp=event_private.approval_request_fingerprint(p,c,manager);
 -- Email preview hash includes revision, but exact HTML/text/sender remain reviewed.
 assert event_private.approval_request_fingerprint(before_send,c||'{"contentHash":"old","html":"<p>Exact</p>"}',manager)
       =event_private.approval_request_fingerprint(p,c||'{"contentHash":"new","html":"<p>Exact</p>"}',manager);
 assert fp<>event_private.approval_request_fingerprint(p,c||'{"body":"Changed message"}',manager);
 assert fp<>event_private.approval_request_fingerprint(p,c||'{"destination":"5521000000099"}',manager);
 assert fp<>event_private.approval_request_fingerprint(p,c||'{"title":"Changed subject"}',manager);
 assert fp<>event_private.approval_request_fingerprint(p,c||'{"channel":"email"}',manager);
 assert fp<>event_private.approval_request_fingerprint(p,c,seller);
 changed:=p;changed.total:=1200;assert fp<>event_private.approval_request_fingerprint(changed,c,manager);
 changed:=p;changed.snapshot:=jsonb_set(p.snapshot,'{paymentTerms}','"Negotiated 30%"');
 assert fp<>event_private.approval_request_fingerprint(changed,c,manager),'Payment conditions are commercial content';
 changed:=p;changed.snapshot:=jsonb_set(p.snapshot,'{selectedItems,0,name}','"Changed menu"');
 assert fp<>event_private.approval_request_fingerprint(changed,c,manager),'Same-total menu changes still require review';
 select * into b from event_create_proposal_approval(p.id,p.revision,seller,c||'{"body":"New follow-up","message":"New follow-up"}');
 assert b.id<>a.id and b.status='pending','Actual reviewed content changes require a new decision';
 update event_proposal_approvals set status='rejected' where id=b.id;
 -- Accepted transport + definitive provider receipt failure must be actionable.
 update event_outbox set delivery_status='failed' where id=(claim#>>'{send,id}')::uuid returning * into outbound;
 assert outbound.status='accepted';
 assert event_private.approval_dispatch_needs_attention(outbound,now());
 batch:=event_claim_approval_watch(k);
 assert (select count(*)=2 from event_approval_watch_alerts where approval_id=a.id and kind='dispatch_attention'),'Failed delivery must create both manager alerts';
 outbound.delivery_status:='uncertain';assert event_private.approval_dispatch_needs_attention(outbound,now());
 outbound.delivery_status:='delivered';assert not event_private.approval_dispatch_needs_attention(outbound,now()),'Recovered delivery must fail the shared claim predicate';
 outbound.delivery_status:='read';assert not event_private.approval_dispatch_needs_attention(outbound,now());
 outbound.delivery_status:=null;outbound.status:='sending';outbound.updated_at:=now()-interval '11 minutes';
 assert event_private.approval_dispatch_needs_attention(outbound,now());
 outbound.updated_at:=now();assert not event_private.approval_dispatch_needs_attention(outbound,now());
 -- Settle only synthetic rows to isolate the abandoned-run regression.
 update event_approval_watch_alerts set status='accepted';
 update event_outbox set delivery_status='delivered' where id=(claim#>>'{send,id}')::uuid;
 update event_private.approval_watch_config set last_started_at=now()-interval '20 minutes',last_success_at=now()-interval '1 hour' where id returning last_success_at into success_before;
 insert into event_approval_watch_alerts(approval_id,dedupe_key,kind,channel,status,run_id,attempts,updated_at)
 values(a.id,'stranded-fixture','dispatch_attention','email','sending',old_run,1,now()-interval '11 minutes') returning id into old_alert;
 insert into event_approval_watch_alerts(approval_id,dedupe_key,kind,channel,status,run_id,attempts,updated_at)
 values(a.id,'inflight-fixture','dispatch_attention','whatsapp','sending',old_run,1,now()-interval '1 minute') returning id into recent_alert;
 batch:=event_claim_approval_watch(k);
 assert jsonb_array_length(batch->'jobs')=0,'Never blindly resend an old claim';
 assert (select status='uncertain' and run_id=old_run and attempts=1 from event_approval_watch_alerts where id=old_alert),'Old claim quarantined with lineage intact';
 assert (select status='sending' and attempts=1 from event_approval_watch_alerts where id=recent_alert),'Recent claim remains in flight';
 blocked:=false;begin perform event_complete_approval_watch((batch->>'run_id')::uuid);exception when others then blocked:=true;end;
 assert blocked,'Empty new run must not hide unresolved old attempts';
 assert (select last_success_at=success_before from event_private.approval_watch_config where id);
 assert (get_event_approval_watch_health()->>'unresolved_count')::integer=2;
 update event_approval_watch_alerts set status='accepted' where id=recent_alert;
 blocked:=false;begin perform event_complete_approval_watch((batch->>'run_id')::uuid);exception when others then blocked:=true;end;
 assert blocked,'Uncertain abandoned request still blocks healthy completion';
 -- Explicit synthetic reconciliation, no transport retry.
 update event_approval_watch_alerts set status='accepted' where id=old_alert;
 blocked:=false;begin perform event_complete_approval_watch(old_run);exception when others then blocked:=true;end;
 assert blocked,'Late completion of a superseded run cannot mark health';
 perform event_complete_approval_watch((batch->>'run_id')::uuid);
 assert (get_event_approval_watch_health()->>'unresolved_count')::integer=0;
 assert (select last_success_at>success_before from event_private.approval_watch_config where id);
 assert (select count(*)=1 from event_outbox where proposal_id=p.id),'Monitoring never dispatches or retries client messages';
end; $$;
rollback;
