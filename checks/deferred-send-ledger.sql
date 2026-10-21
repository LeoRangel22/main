-- Disposable database fixtures only. No HTTP, real provider ID or external data.
-- Every simulated configuration change and event is rolled back.
begin;
do $$
declare manager uuid;manager_email text;seller uuid;seller_email text;opp uuid;
 p public.propostas;a public.event_proposal_approvals;notice public.event_proposal_approvals;
 content jsonb;claim jsonb;batch jsonb;job jsonb;before_row jsonb;before_proposal jsonb;before_opportunity jsonb;
 send_id uuid;accepted_id uuid;alert_id uuid;probe_id uuid:=gen_random_uuid();
 channel_name text;destination text;signal text;field_name text;blocked boolean;i integer;
 old_alerts jsonb;k text:=repeat('d',64);scope uuid:='00000000-0000-4000-8000-000000000002';
begin
 -- Discover the existing synthetic bootstrap identities through their existing roles.
 for manager,manager_email in select id,email from auth.users order by email loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email',manager_email,'role','authenticated')::text,true);
  exit when public.is_super_admin();
 end loop;
 assert public.is_super_admin(),'Bootstrap manager exists';
 for seller,seller_email in select id,email from auth.users where id<>manager order by email loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email',seller_email,'role','authenticated')::text,true);
  exit when public.is_team_member();
 end loop;
 assert public.is_team_member(),'Bootstrap seller exists';
 assert not (select enabled from event_private.proposal_approval_policy where id);
 assert not (select enabled from event_private.approval_watch_config where id);
 assert (select not enabled and cursor=0 and scope_id is null from event_private.bot_bridge_state where singleton),'Install does not provision or activate bridge';
 assert not exists(select 1 from information_schema.columns where table_schema='public' and table_name='event_commercial_policy' and column_name in ('email_enabled','whatsapp_enabled')),'No email-only policy is introduced';
 assert not has_function_privilege('authenticated','public.begin_event_send(uuid,text,text,text,text,timestamptz)','execute');
 assert not has_function_privilege('authenticated','public.finish_event_send(uuid,text,text,text)','execute');
 assert not has_function_privilege('anon','public.event_finish_approval_watch_alert(uuid,text,text,text)','execute');
 assert not has_function_privilege('authenticated','public.event_bot_bridge_worker_config()','execute');
 assert not has_table_privilege('authenticated','event_private.bot_bridge_state','update');
 assert not has_function_privilege('service_role','event_private.guard_bot_bridge_scope()','execute');
 assert has_function_privilege('service_role','public.finish_event_send(uuid,text,text,text)','execute');
 assert has_function_privilege('authenticated','public.event_retry_approval_notifications(uuid)','execute');

 foreach channel_name in array array['email','whatsapp'] loop
  perform set_config('request.jwt.claims','',true);
  insert into oportunidades(cliente_nome,status,data_evento) values('Deferred fixture '||channel_name,'proposta_pronta','2099-11-18') returning id into opp;
  insert into propostas(oportunidade_id,cliente_nome,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,status,publication_status,is_current,snapshot)
  values(opp,'Deferred fixture '||channel_name,'2099-11-18','10:00',20,2,1000,120,1120,'proposta_pronta','ready',true,
   '{"event":{"guests":20},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"name":"Fixture","calc":{"total":1000}}]}') returning * into p;
  select to_jsonb(x) into before_proposal from propostas x where id=p.id;
  select to_jsonb(x) into before_opportunity from oportunidades x where id=opp;
  destination:=case channel_name when 'email' then 'fixture@example.test' else '15550001111' end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email',seller_email,'role','authenticated')::text,true);
  set local role authenticated;
  claim:=begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null);
  assert (claim->>'claimed')::boolean and claim#>>'{send,channel}'=channel_name,'Choice of channel remains unchanged';
  send_id:=(claim#>>'{send,id}')::uuid;
  assert not (begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null)->>'claimed')::boolean,'Sending cannot replay';
  reset role;
  blocked:=false;begin perform finish_event_send(send_id,'paused','synthetic-provider-id','Invalid pause');exception when others then blocked:=true;end;
  assert blocked,'Paused cannot invent a provider ID';
  perform finish_event_send(send_id,'paused',null,'Synthetic gateway refusal before POST');
  assert (select status='paused' and provider_id is null and provider_reference is null and delivery_status is null and engagement is null from event_outbox where id=send_id);
  assert not exists(select 1 from event_messages where external_id='send:'||send_id::text),'Non-attempt is not a contact';
  assert (select to_jsonb(x)=before_proposal from propostas x where id=p.id),'Pause never alters proposal history or sent marker';
  assert (select to_jsonb(x)=before_opportunity from oportunidades x where id=opp),'Pause never fabricates contact or follow-up dates';
  -- Any delivery/engagement/provider marker prevents both retry and late pause.
  foreach field_name in array array['provider_id','provider_reference','engagement','delivery_updated_at','delivery_checked_at'] loop
   execute format('update event_outbox set %I=%s where id=$1',field_name,case when field_name like 'delivery_%' then 'now()' when field_name='engagement' then quote_literal('opened') else quote_literal('synthetic-proof') end) using send_id;
   select to_jsonb(x) into before_row from event_outbox x where id=send_id;
   assert not (begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null)->>'claimed')::boolean,'Evidence blocks retry';
   assert (select to_jsonb(x)=before_row from event_outbox x where id=send_id),'Retry preserves evidence';
   update event_outbox set status='sending' where id=send_id;
   perform finish_event_send(send_id,'paused',null,'Raced evidence');
   assert (select status='sending' from event_outbox where id=send_id),'Evidence wins pause race';
   execute format('update event_outbox set %I=null,status=''paused'' where id=$1',field_name) using send_id;
  end loop;
  foreach signal in array array['accepted','uncertain','failed','delivered','read'] loop
   update event_outbox set delivery_status=signal where id=send_id;
   assert not (begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null)->>'claimed')::boolean,'Even failed receipt proves paused was not a non-attempt';
   update event_outbox set status='sending' where id=send_id;
   perform finish_event_send(send_id,'paused',null,'Raced receipt');
   assert (select status='sending' and delivery_status=signal from event_outbox where id=send_id);
   update event_outbox set status='paused',delivery_status=null where id=send_id;
  end loop;
  blocked:=false;begin perform begin_event_send_reviewed(p.id,p.revision+1,channel_name,destination,'Reviewed fixture','Fixture',null);exception when others then blocked:=true;end;
  assert blocked,'Retry still requires reviewed current revision';
  update oportunidades set ultima_resposta_cliente_em=now() where id=opp;
  blocked:=false;begin perform begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null);exception when others then blocked:=true;end;
  assert blocked,'Retry still requires reviewed latest response';
  update oportunidades set ultima_resposta_cliente_em=null where id=opp;
  claim:=begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null);
  assert (claim->>'claimed')::boolean and (claim#>>'{send,attempts}')::integer=2,'Only explicit reviewed retry reclaims proven non-attempt';
  perform finish_event_send(send_id,'uncertain',null,'Synthetic uncertain attempt');
  perform finish_event_send(send_id,'paused',null,'Cannot erase uncertainty');
  assert not (begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Reviewed fixture','Fixture',null)->>'claimed')::boolean;
  assert (select status='uncertain' from event_outbox where id=send_id);
  claim:=begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Accepted fixture','Fixture',null);
  accepted_id:=(claim#>>'{send,id}')::uuid;
  perform finish_event_send(accepted_id,'accepted','synthetic-accepted');
  select * into p from propostas where id=p.id;
  perform finish_event_send(accepted_id,'paused',null,'Cannot erase acceptance');
  assert not (begin_event_send_reviewed(p.id,p.revision,channel_name,destination,'Accepted fixture','Fixture',null)->>'claimed')::boolean;
  assert (select status='accepted' and provider_id='synthetic-accepted' from event_outbox where id=accepted_id);
 end loop;

 -- Manager notices pause per channel; only an explicit team retry may requeue them.
 update event_private.proposal_approval_policy set enabled=true,approver_id=manager,approver_email='manager@example.test',whatsapp='15550002222' where id;
 content:=jsonb_build_object('channel','whatsapp','destination','15550001111','body','Approved fixture','message','Approved fixture','title','Fixture','contentHash',null,'reviewedResponseAt',null,'proposalUrl','https://leorangel22.github.io/main/proposta.html?p='||p.public_token);
 select * into notice from event_create_proposal_approval(p.id,p.revision,seller,content);
 foreach channel_name in array array['whatsapp','email'] loop
  assert event_claim_approval_notification(notice.id,channel_name) is not null;
  perform event_finish_approval_notification(notice.id,channel_name,'paused',null,'Synthetic non-attempt');
  assert event_claim_approval_notification(notice.id,channel_name) is null,'Paused notice never auto-claims';
 end loop;
 update event_approval_notifications set provider_id='synthetic-proof' where approval_id=notice.id and channel='email';
 perform event_retry_approval_notifications(notice.id);
 assert (select status='paused' and provider_id='synthetic-proof' from event_approval_notifications where approval_id=notice.id and channel='email'),'Proven evidence blocks explicit retry';
 assert event_claim_approval_notification(notice.id,'whatsapp') is not null;
 perform event_finish_approval_notification(notice.id,'whatsapp','accepted','synthetic-notice');
 perform event_finish_approval_notification(notice.id,'whatsapp','paused',null,'Cannot erase notice acceptance');
 assert (select status='accepted' and provider_id='synthetic-notice' from event_approval_notifications where approval_id=notice.id and channel='whatsapp');
 update event_approval_notifications set provider_id=null,status='sending' where approval_id=notice.id and channel='email';
 perform event_finish_approval_notification(notice.id,'email','uncertain',null,'Synthetic uncertainty');
 perform event_retry_approval_notifications(notice.id);
 assert (select status='uncertain' from event_approval_notifications where approval_id=notice.id and channel='email');

 -- Approved proposal retry retains every original content/revision/response guard.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email',manager_email,'role','authenticated')::text,true);
 update event_proposal_approvals set status='approved',decided_by=manager,decided_at=now() where id=notice.id;
 claim:=begin_event_approved_send(notice.id,p.revision,'whatsapp',content->>'destination',content->>'body',content->>'title',null,null);
 send_id:=(claim#>>'{send,id}')::uuid;
 perform finish_event_send(send_id,'paused',null,'Synthetic approved non-attempt');
 update event_outbox set provider_id='synthetic-proof' where id=send_id;
 assert not (begin_event_approved_send(notice.id,p.revision,'whatsapp',content->>'destination',content->>'body',content->>'title',null,null)->>'claimed')::boolean;
 update event_outbox set provider_id=null where id=send_id;
 blocked:=false;begin perform begin_event_approved_send(notice.id,p.revision,'whatsapp',content->>'destination','Changed body',content->>'title',null,null);exception when others then blocked:=true;end;assert blocked;
 blocked:=false;begin perform begin_event_approved_send(notice.id,p.revision+1,'whatsapp',content->>'destination',content->>'body',content->>'title',null,null);exception when others then blocked:=true;end;assert blocked;
 update event_proposal_approvals set expires_at=now()-interval '1 second' where id=notice.id;
 blocked:=false;begin perform begin_event_approved_send(notice.id,p.revision,'whatsapp',content->>'destination',content->>'body',content->>'title',null,null);exception when others then blocked:=true;end;assert blocked;
 update event_proposal_approvals set expires_at=now()+interval '1 hour' where id=notice.id;
 claim:=begin_event_approved_send(notice.id,p.revision,'whatsapp',content->>'destination',content->>'body',content->>'title',null,null);
 assert (claim->>'claimed')::boolean and (claim#>>'{send,attempts}')::integer=2;
 perform finish_event_send(send_id,'paused',null,'Synthetic repeated non-attempt');

 -- Reproduce the historical twenty waiting alerts: nine approved plus one invalidated, per channel.
 for i in 1..10 loop
  select * into a from event_create_proposal_approval(p.id,p.revision,seller,content||jsonb_build_object('body','Historical fixture '||i));
  update event_proposal_approvals set status=case when i=10 then 'invalidated' else 'approved' end,decided_by=manager,decided_at=now()-interval '3 hours',send_id=accepted_id where id=a.id;
  foreach channel_name in array array['whatsapp','email'] loop
   insert into event_approval_watch_alerts(approval_id,dedupe_key,kind,channel,created_at,updated_at)
   values(a.id,'old-waiting-fixture:'||i||':'||channel_name,'approval_waiting',channel_name,now()-interval '3 hours',now()-interval '3 hours');
  end loop;
 end loop;
 select jsonb_agg(to_jsonb(w) order by w.id) into old_alerts from event_approval_watch_alerts w where dedupe_key like 'old-waiting-fixture:%';
 assert jsonb_array_length(old_alerts)=20;
 update event_private.approval_watch_config set enabled=false,job_key=k,last_started_at=null where id;
 batch:=event_claim_approval_watch(k);assert (batch->>'skipped')::boolean;
 assert (select jsonb_agg(to_jsonb(w) order by w.id)=old_alerts from event_approval_watch_alerts w where dedupe_key like 'old-waiting-fixture:%'),'Inactive monitor preserves history';
 update event_private.approval_watch_config set enabled=true where id;
 batch:=event_claim_approval_watch(k);
 assert jsonb_array_length(batch->'jobs')=0,'Stale twenty waiting alerts are never claimed on activation';
 assert (select jsonb_agg(to_jsonb(w) order by w.id)=old_alerts from event_approval_watch_alerts w where dedupe_key like 'old-waiting-fixture:%'),'Activation does not relabel old alerts';
 batch:=event_claim_approval_watch(k,probe_id);
 assert jsonb_array_length(batch->'jobs')=2,'Both transport choices remain supported';
 for job in select value from jsonb_array_elements(batch->'jobs') loop
  alert_id:=(job->>'id')::uuid;
  assert job->>'context_id'=job->>'id' and (job->>'revision')::bigint=1;
  assert (select created_at=(job->>'created_at')::timestamptz from event_approval_watch_alerts where id=alert_id),'Stable creation timestamp is returned';
  perform event_finish_approval_watch_alert(alert_id,'paused',null,'Synthetic gateway non-attempt');
 end loop;
 perform event_complete_approval_watch((batch->>'run_id')::uuid);
 assert (event_claim_approval_watch(k,probe_id)->>'skipped')::boolean,'Paused probe never auto-retries';
 update event_private.approval_watch_config set last_started_at=null where id;
 assert jsonb_array_length(event_claim_approval_watch(k)->'jobs')=0,'Paused alerts never enter periodic backlog';
 insert into event_approval_watch_alerts(dedupe_key,kind,channel,status,provider_id)
 values('raced-deferred-fixture','probe','email','sending','synthetic-proof') returning id into alert_id;
 blocked:=false;begin perform event_finish_approval_watch_alert(alert_id,'paused',null,'Raced proof');exception when others then blocked:=true;end;
 assert blocked and (select status='sending' and provider_id='synthetic-proof' from event_approval_watch_alerts where id=alert_id);

 -- Private scope provisioning is never inferred from an account or old cursor.
 blocked:=false;begin perform event_bot_bridge_activate('bot:embaixada_urca|'||scope::text,0);exception when others then blocked:=true;end;
 assert blocked and (select not enabled and cursor=0 and scope_id is null from event_private.bot_bridge_state where singleton);
 update event_private.bot_bridge_state set scope_id=scope where singleton;
 assert (event_bot_bridge_worker_config()->>'scope_id')::uuid=scope;
 blocked:=false;begin perform event_bot_bridge_activate('bot:embaixada_urca',7);exception when others then blocked:=true;end;assert blocked,'Legacy activation fails closed';
 blocked:=false;begin perform event_bot_bridge_activate('bot:embaixada_urca|'||gen_random_uuid()::text,7);exception when others then blocked:=true;end;assert blocked,'Activation must bind the reviewed scope';
 perform event_bot_bridge_activate('bot:embaixada_urca|'||scope::text,7);
 blocked:=false;begin update event_private.bot_bridge_state set scope_id=gen_random_uuid() where singleton;exception when others then blocked:=true;end;
 assert blocked and (select scope_id=scope and cursor=7 from event_private.bot_bridge_state where singleton),'Active cursor cannot silently change scope';
 blocked:=false;begin perform event_bot_bridge_commit('bot:embaixada_urca',7,8,'[]');exception when others then blocked:=true;end;assert blocked,'Legacy unscoped page fails closed';
 blocked:=false;begin perform event_bot_bridge_commit('bot:embaixada_urca',7,8,jsonb_build_object('scope',gen_random_uuid(),'events','[]'::jsonb));exception when others then blocked:=true;end;
 assert blocked and (select cursor=7 and last_success_at is null from event_private.bot_bridge_state where singleton),'Wrong-scope empty page cannot advance or report health';
 perform event_bot_bridge_commit('bot:embaixada_urca',7,8,jsonb_build_object('scope',scope,'events','[]'::jsonb));
 assert (select cursor=8 and last_success_at is not null from event_private.bot_bridge_state where singleton);
 update event_private.bot_bridge_state set enabled=false where singleton;
 blocked:=false;begin update event_private.bot_bridge_state set scope_id=gen_random_uuid() where singleton;exception when others then blocked:=true;end;
 assert blocked,'Nonzero cursor remains bound to its prior scope';
 update event_private.bot_bridge_state set scope_id=null,enabled=false,cursor=0 where singleton;
 blocked:=false;begin perform event_bot_bridge_activate('bot:embaixada_urca|'||scope::text,0);exception when others then blocked:=true;end;assert blocked;
end; $$;
rollback;
