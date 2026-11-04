-- Synthetic DB fixtures only. No HTTP, credentials or scheduled execution.
begin;
do $$
declare actor uuid;o uuid;p uuid;b uuid;other_b uuid;result jsonb;binding jsonb;event jsonb;item jsonb;dupe jsonb;before_o jsonb;blocked boolean;
 activation bigint:=floor(extract(epoch from now())*1000)-3600000;received bigint:=floor(extract(epoch from now())*1000)-60000;
 original_version bigint;original_watermark bigint;initial_messages bigint;
begin
 assert not has_function_privilege('anon','public.event_mailbox_resolve_binding(text,text,text,text,jsonb)','EXECUTE'),'Anonymous resolver denied';
 assert not has_function_privilege('authenticated','public.event_mailbox_commit_bound(bigint,text,bigint,bigint,jsonb)','EXECUTE'),'Seller commit denied';
 assert not has_function_privilege('service_role','public.event_mailbox_commit(bigint,text,bigint,bigint,jsonb)','EXECUTE'),'Legacy commit denied';
 assert not has_function_privilege('service_role','event_private.ingest_event_provider_events(text,jsonb)','EXECUTE'),'Generic private bypass denied';
 assert not has_table_privilege('authenticated','event_private.mailbox_bound_receipts','SELECT'),'Receipts private';
 assert not has_table_privilege('service_role','event_private.mailbox_outbound_headers','INSERT'),'Header provenance cannot be client registered';
 assert (select relrowsecurity from pg_class where oid='event_private.mailbox_outbound_headers'::regclass),'Headers RLS';
 assert (select relrowsecurity from pg_class where oid='event_private.mailbox_bound_receipts'::regclass),'Receipt RLS';
 assert not exists(select 1 from event_private.mailbox_sync_state where enabled or cardinality(capture_send_ids)>0 or capture_started_at is not null),'Dormant install';
 select id into actor from auth.users where email='leorangel@gmail.com';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 insert into public.oportunidades(cliente_nome,cliente_email,data_evento,status) values('Bound mail fixture','bound-client@example.test','2099-12-01','proposta_pronta') returning id into o;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,status,publication_status,snapshot)
 values(o,'Bound mail fixture','bound-client@example.test','2099-12-01','10:00',20,2,1000,120,0,1120,'proposta_pronta','ready','{"event":{},"totals":{"adjustment":0}}') returning id into p;
 result:=public.begin_event_send(p,'email','bound-client@example.test','Synthetic bound email','Fixture',null);b:=(result#>>'{send,id}')::uuid;
 perform public.finish_event_send(b,'accepted','opaque-provider-request-id');
 update event_private.channel_credentials set enabled=true,expected_account='eventos@embaixadacarioca.com.br' where provider='mailbox';
 update event_private.mailbox_sync_state set enabled=true,account_id='123',mailbox='eventos@embaixadacarioca.com.br',activated_at_ms=activation,watermark_ms=activation where singleton;
 blocked:=false;begin perform public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]');exception when others then blocked:=true;end;assert blocked,'Enabled flag without bounded scope is insufficient';
 update event_private.mailbox_sync_state set capture_send_ids=array[b],capture_started_at=now()-interval '2 minutes',capture_expires_at=now()+interval '10 minutes',capture_message_limit=1;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]') is null,'No inferred Message-ID mapping';
 insert into event_private.mailbox_outbound_headers select '123','<proposal@example.test>',b,attempts,reviewed_revision,repeat('a',64) from public.event_outbox where id=b;

 -- Header provenance can precede a durable transport result; leave the reply unconsumed.
 update public.event_outbox set status='sending' where id=b;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]')->>'code'='transport_pending','Known sending transport is deferred';
 update public.event_outbox set status='uncertain' where id=b;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]')->>'code'='transport_pending','Known uncertain transport is deferred';
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','other@example.test','<reply@example.test>','["<proposal@example.test>"]') is null,'No pending context leaks to another sender';
 blocked:=false;begin perform public.event_mailbox_resolve_binding('456','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]');exception when others then blocked:=true;end;assert blocked,'Another account remains denied';
 update public.event_outbox set status='accepted' where id=b;
 binding:=public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]');
 -- Known but out-of-scope ancestor must remain ambiguous, never disappear before count.
 insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,attempts,approved_by,reviewed_revision)
 select proposal_id,opportunity_id,fingerprint||':out-of-scope',channel,destination,body,status,attempts,approved_by,reviewed_revision from public.event_outbox where id=b returning id into other_b;
 insert into event_private.mailbox_outbound_headers select '123','<other-proposal@example.test>',other_b,attempts,reviewed_revision,repeat('b',64) from public.event_outbox where id=other_b;

 -- An unresolved ancestor outside the allowlist must not disappear from a mixed chain.
 update public.event_outbox set status='sending' where id=other_b;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>","<other-proposal@example.test>"]')->>'code'='transport_pending','Accepted plus out-of-scope sending defers';
 update public.event_outbox set status='uncertain' where id=other_b;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>","<other-proposal@example.test>"]')->>'code'='transport_pending','Accepted plus out-of-scope uncertain defers';
 update public.event_outbox set status='accepted' where id=other_b;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>","<other-proposal@example.test>"]')->>'code'='ambiguous','Complete chain checked before allowlist';
 delete from event_private.mailbox_outbound_headers where outbound_message_id='<other-proposal@example.test>';
 assert binding->>'send_id'=b::text and (binding->>'proposal_revision')::bigint=(select reviewed_revision from public.event_outbox where id=b),'Exact immutable revision binding';
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','other@example.test','<reply@example.test>','["<proposal@example.test>"]') is null,'Sender mismatch denied';
 event:=jsonb_build_object('key','<reply@example.test>','message_id','<reply@example.test>','kind','inbound','channel','email','destination','bound-client@example.test','body','Synthetic bound reply','occurred_at',to_timestamp(received/1000.0));
 item:=jsonb_build_object('provider_id','100','received_at_ms',received,'state','prepared','reason',null,'inbound_message_id','<reply@example.test>','sender','bound-client@example.test','reply_candidates',jsonb_build_array('<proposal@example.test>'),'binding',binding,'event',event);
 select version,watermark_ms into original_version,original_watermark from event_private.mailbox_sync_state;
 update event_private.mailbox_sync_state set capture_send_ids=array[gen_random_uuid()];
 blocked:=false;begin perform public.event_mailbox_commit_bound(original_version,'123',original_watermark,received,jsonb_build_array(item));exception when others then blocked:=true;end;assert blocked,'Unlisted send cannot persist';
 update event_private.mailbox_sync_state set capture_send_ids=array[b];
 perform public.event_mailbox_commit_bound(original_version,'123',original_watermark,received,jsonb_build_array(item));
 assert (select count(*)=1 from public.event_messages where opportunity_id=o and direction='inbound' and proposal_id=p and proposal_revision=(binding->>'proposal_revision')::bigint),'One message with exact revision';
 select to_jsonb(x) into before_o from public.oportunidades x where id=o;
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<new-reply@example.test>','["<proposal@example.test>"]')->>'code'='capture_limit','New reply beyond cap rejected before content';
 assert public.event_mailbox_resolve_binding('123','eventos@embaixadacarioca.com.br','bound-client@example.test','<reply@example.test>','["<proposal@example.test>"]')->>'code'='duplicate','RFC dedup before body despite exhausted cap';
 dupe:=item||jsonb_build_object('provider_id','101','state','duplicate','event',null);
 perform public.event_mailbox_commit_bound(original_version+1,'123',received,received,jsonb_build_array(dupe));
 assert (select to_jsonb(x)=before_o from public.oportunidades x where id=o),'Duplicate preserves entire opportunity';
 assert (select count(*)=1 from public.event_messages where opportunity_id=o and direction='inbound'),'RFC alias never duplicates content';
 assert (select count(*)=2 from event_private.mailbox_seen where account_id='123'),'Both provider IDs tracked';
 blocked:=false;begin perform public.event_mailbox_commit_bound(original_version+1,'123',received,received,'[]');exception when others then blocked:=true;end;assert blocked,'Stale cursor denied';
 update event_private.mailbox_sync_state set capture_started_at=now()-interval '3 minutes',capture_expires_at=now()-interval '1 minute';
 blocked:=false;begin perform public.event_mailbox_commit_bound(original_version+2,'123',received,received,'[]');exception when others then blocked:=true;end;assert blocked,'Expired capture cannot commit';
 blocked:=false;begin update event_private.mailbox_sync_state set capture_started_at=now(),capture_expires_at=now()+interval '16 minutes';exception when others then blocked:=true;end;assert blocked,'Overlong capture prohibited';
 update event_private.mailbox_sync_state set capture_started_at=now()-interval '2 minutes',capture_expires_at=now()+interval '10 minutes';
 update event_private.channel_credentials set enabled=false where provider='mailbox';
 blocked:=false;begin perform public.event_mailbox_commit_bound(original_version+2,'123',received,received,'[]');exception when others then blocked:=true;end;assert blocked,'Channel OFF denies commit';
 blocked:=false;begin perform public.ingest_event_provider_events('mailbox',jsonb_build_array(event));exception when others then blocked:=sqlerrm='mailbox_bound_path_required';end;assert blocked,'Generic mailbox fallback blocked';
end $$;
rollback;
