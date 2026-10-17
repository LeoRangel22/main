-- Disposable fixtures only. HTTP transport is mocked and all changes roll back.
begin;
create temporary table diagnostic_test_requests(id bigserial,url text,body jsonb,headers jsonb);
create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$ declare result bigint; begin
 insert into pg_temp.diagnostic_test_requests(url,body,headers) values(url,body,headers) returning id into result;return result;
end; $$;
do $$
declare actor uuid; outsider uuid:=gen_random_uuid(); batch uuid; result jsonb; blocked boolean; n integer; p public.propostas; p2 public.propostas; opp uuid; opp2 uuid; send uuid; before_rows bigint; source jsonb;
begin
 assert not has_function_privilege('anon','public.event_request_channel_diagnostics()','execute');
 assert not has_function_privilege('anon','public.event_channel_diagnostics_status()','execute');
 assert not has_function_privilege('anon','public.event_journey_evidence(uuid,bigint)','execute');
 assert not has_function_privilege('anon','public.confirm_event_reservation(uuid,bigint)','execute');
 assert not has_function_privilege('authenticated','event_private.queue_channel_diagnostics()','execute');
 assert not has_table_privilege('authenticated','event_private.channel_diagnostic_batch','select');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'email','outsider@example.test','role','authenticated')::text,true);
 blocked:=false;begin perform public.event_request_channel_diagnostics(); exception when others then blocked:=true;end;
 assert blocked and (select count(*)=0 from diagnostic_test_requests),'Unauthorized request cannot make HTTP calls';
 select id into actor from auth.users where email='leorangel@gmail.com';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 select jsonb_agg(to_jsonb(c)) into source from event_private.channel_credentials c;
 batch:=public.event_request_channel_diagnostics();
 assert public.event_request_channel_diagnostics()=batch and (select count(*)=2 from diagnostic_test_requests),'Concurrent/repeated requests share a bounded diagnostic batch';
 assert (select bool_and(body='{"action":"diagnose"}'::jsonb and (url like '%/event-bot-bridge' or url like '%/event-email-delivery')) from diagnostic_test_requests),'Only fixed diagnostic routes may be requested';
 result:=public.event_channel_diagnostics_status();assert result#>>'{bridge,state}'='pending';
 insert into net._http_response(id,status_code,content) select bridge_request,409,'{"ok":false,"diagnostic":{"urlConfigured":false,"secretConfigured":false},"secret":"LEAKME"}' from event_private.channel_diagnostic_batch;
 insert into net._http_response(id,status_code,content) select delivery_request,200,'{"ok":true,"diagnostic":{"emailLogsConfigured":false,"whatsapp":{"connected":false,"received":{"present":true,"ours":false}}},"token":"LEAKME"}' from event_private.channel_diagnostic_batch;
 result:=public.event_channel_diagnostics_status();
 assert result#>>'{bridge,state}'='blocked' and result#>'{bridge,bridge_url}'='false' and result#>'{delivery,whatsapp_connected}'='false' and result#>'{delivery,email_oauth}'='false';
 assert result::text not like '%LEAKME%' and result::text not like '%x-event-job-key%','No raw response/credential escapes the diagnostic RPC';
 assert (select jsonb_agg(to_jsonb(c))=source from event_private.channel_credentials c),'Probe never changes channel activation/readiness';
 update net._http_response set content='{"ok":true,"diagnostic":{"emailLogsConfigured":"true","whatsapp":{"connected":"true"}}}' where id=(select delivery_request from event_private.channel_diagnostic_batch);
 result:=public.event_channel_diagnostics_status();assert result#>'{delivery,email_oauth}'='null' and result#>'{delivery,whatsapp_connected}'='null','String booleans are not evidence';
 update net._http_response set content='<html>LEAKME</html>' where id=(select delivery_request from event_private.channel_diagnostic_batch);
 assert public.event_channel_diagnostics_status()#>>'{delivery,state}'='failed','Malformed response fails closed';
 update net._http_response set content='{}' where id=(select delivery_request from event_private.channel_diagnostic_batch);
 assert public.event_channel_diagnostics_status()#>>'{delivery,state}'='failed','Missing typed diagnostics is not an observation';
 delete from net._http_response where id in(select bridge_request from event_private.channel_diagnostic_batch);
 update event_private.channel_diagnostic_batch set requested_at=now()-interval '16 minutes';
 result:=public.event_channel_diagnostics_status();assert (result->>'stale')::boolean and result#>>'{bridge,state}'='expired','Missing old transport result is never healthy';
 assert (select count(*)=2 from diagnostic_test_requests),'Status polling does not enqueue HTTP';

 -- Journey is an evidence reader, not a transition or a provider test.
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status,data_evento) values('Evidence fixture','proposta_pronta','2099-11-18') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Evidence fixture','proposta_pronta','ready',true,'2099-11-18','10:00',20,2,1000,120,1120,
 '{"event":{"date":"2099-11-18","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning * into p;
 select count(*) into before_rows from event_outbox;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 result:=public.event_journey_evidence(p.id,p.revision);
 assert jsonb_array_length(result->'steps')=10;
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='proposal');
 assert (select bool_and(s->>'state'='pending') from jsonb_array_elements(result->'steps') s where s->>'key'<>'proposal');
 assert (select count(*)=before_rows from event_outbox),'Reading journey cannot send';
 blocked:=false;begin perform public.event_journey_evidence(p.id,p.revision+1);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Stale revision must be rejected';
 insert into event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,provider_id,approved_by)
 values(p.id,opp,'evidence-fixture','email','fixture@example.test','Isolated fixture','accepted','provider-fixture',actor) returning id into send;
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='dispatch');
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='delivery'),'Accepted is not delivered';
 update event_outbox set delivery_status='delivered' where id=send;
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='delivery'),'Delivery requires a recorded observation timestamp';
 update event_outbox set delivery_updated_at=now() where id=send;
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='delivery');
 update event_outbox set status='uncertain',provider_id=null where id=send;
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='delivery'),'Authenticated late receipt proves delivery despite uncertain transport';
 update event_outbox set status='accepted',provider_id='provider-fixture' where id=send;
 insert into event_proposal_approvals(proposal_id,revision,proposal_fingerprint,review_hash,proposal_snapshot,content,requested_by,approver_id,approver_email,status,expires_at,request_fingerprint)
 values(p.id,p.revision,event_private.proposal_fingerprint(p),'pending-evidence-'||gen_random_uuid(),to_jsonb(p),'{"channel":"email"}',actor,actor,'leorangel@gmail.com','pending',now()+interval '1 day','pending-evidence-fixture');
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='dispatch'),'New pending request cannot erase an earlier successful send';
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='delivery'),'New pending request cannot erase delivery evidence';
 insert into event_messages(opportunity_id,channel,direction,source,body,occurred_at) values(opp,'phone','inbound','manual','Reported manually',now()+interval '1 second');
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='manual' from jsonb_array_elements(result->'steps') s where s->>'key'='reply'),'Manual report is not authenticated ingress';
 insert into event_messages(opportunity_id,channel,direction,source,body,occurred_at) values(opp,'email','inbound','provider','Authenticated reply',now()+interval '0.5 second');
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='confirmed' and s->>'source'='provider' from jsonb_array_elements(result->'steps') s where s->>'key'='reply'),'A later manual note cannot hide an authenticated reply';
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status,data_evento) values('Manual sharing evidence fixture','proposta_enviada','2099-11-20') returning id into opp2;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,subtotal,taxa_servico,total,snapshot,cliente_resposta,cliente_resposta_em)
 values(opp2,'Manual sharing evidence fixture','proposta_enviada','sent',true,'2099-11-20',1000,120,1120,p.snapshot,'confirmar',now()) returning * into p2;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 result:=public.event_journey_evidence(p2.id,p2.revision);
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='client_acceptance'),'Public acceptance from a manually shared link needs no outbox row';
 assert (select s->>'state'='confirmed' from jsonb_array_elements(result->'steps') s where s->>'key'='reply');
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='dispatch'),'Public acceptance never invents an integrated send';
 perform set_config('request.jwt.claims','',true);
 update propostas set snapshot=snapshot||'{"pagamentoSinal":{"valor":560,"data":"2026-10-17"}}' where id=p.id returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='legacy' from jsonb_array_elements(result->'steps') s where s->>'key'='payment'),'Legacy payment without actor/time is not an audited pilot';
 perform set_config('request.jwt.claims','',true);
 update propostas set snapshot=jsonb_set(snapshot,'{pagamentoSinal,validacaoPendente}','true') where id=p.id returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 result:=public.event_journey_evidence(p.id,p.revision);
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='payment'),'Proof pending cannot count as money received';
 assert (select s->>'state'='pending' from jsonb_array_elements(result->'steps') s where s->>'key'='operation'),'No sector science inferred';
 -- Isolated maintenance fixture reproduces a legacy booking without a reservation.
 perform set_config('request.jwt.claims','',true);
 update propostas set status='confirmado',snapshot=jsonb_set(snapshot,'{pagamentoSinal}','{"valor":560,"data":"2026-10-17"}') where id=p.id returning * into p;
 delete from event_reservations where opportunity_id=opp;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 blocked:=false;begin perform public.confirm_event_reservation(p.id,p.revision);exception when others then blocked:=true;end;
 assert blocked and not exists(select 1 from event_reservations where opportunity_id=opp),'Legacy amount without finance audit cannot confirm reservation';
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":560,"data":"2026-10-17","bancos":["Fixture"]}}'),p.revision,null);
 assert not exists(select 1 from event_reservations where opportunity_id=opp),'Financial validation preserves stage and creates no silent reservation';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where email='eventos@embaixadacarioca.com.br'),'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 blocked:=false;begin perform public.confirm_event_reservation(p.id,p.revision);exception when insufficient_privilege then blocked:=true;end;assert blocked,'Seller cannot reconcile legacy reservation';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 blocked:=false;begin perform public.confirm_event_reservation(p.id,p.revision+1);exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Reservation requires reviewed revision';
 update event_commercial_policy set capacity=10 where id;
 blocked:=false;begin perform public.confirm_event_reservation(p.id,p.revision);exception when others then blocked:=true;end;
 assert blocked and not exists(select 1 from event_reservations where opportunity_id=opp),'Capacity conflict cannot produce a reservation or change the agreement';
 update event_commercial_policy set capacity=200 where id;
 result:=public.confirm_event_reservation(p.id,p.revision);assert result#>>'{reservation,status}'='confirmed' and result->>'already_confirmed'='false';
 select count(*) into n from event_messages where proposal_id=p.id and channel='note';
 result:=public.confirm_event_reservation(p.id,p.revision);assert result->>'already_confirmed'='true';
 assert (select count(*)=n from event_messages where proposal_id=p.id and channel='note'),'Retry cannot duplicate reservation audit';
 assert (select revision=p.revision and status='confirmado' from propostas where id=p.id),'Reservation preserves agreement revision and stage';
 assert (select count(*)=before_rows+1 from event_outbox),'Reservation cannot send a message';
end $$;
rollback;
