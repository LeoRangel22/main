-- Synthetic, isolated database only. No provider calls or production records.
begin;
do $$
declare scope uuid:=gen_random_uuid(); actor uuid; opp uuid; p public.propostas;
 sends uuid[]:='{}'; proposals uuid[]:='{}'; revisions bigint[]:='{}'; events jsonb:='[]';
 v jsonb; i integer; blocked boolean; before_events integer; health jsonb; before_messages integer; canonical_mailbox text;
begin
 select id into actor from auth.users order by id limit 1;
 for i in 1..2 loop
  insert into public.oportunidades(cliente_nome,status,data_evento)
   values('Quarantine fixture '||i,'proposta_pronta','2099-11-21') returning id into opp;
  insert into public.propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,horario_evento,total,subtotal,taxa_servico,snapshot)
   values(opp,'Quarantine fixture '||i,'proposta_pronta','ready','2099-11-21','10:00',1120,1000,120,'{}') returning * into p;
  proposals:=array_append(proposals,p.id); revisions:=array_append(revisions,p.revision);
  sends:=array_append(sends,gen_random_uuid());
  insert into public.event_outbox(id,proposal_id,opportunity_id,fingerprint,channel,destination,body,status,provider_id,approved_by,reviewed_revision,reviewed_fingerprint)
   values(sends[i],p.id,opp,sends[i]::text,'whatsapp','5521000000001','Synthetic reviewed content','accepted','quarantine-provider-'||i,actor,p.revision,event_private.public_proposal_fingerprint(p));
  events:=events||jsonb_build_array(jsonb_build_object('key','quarantine-receipt-'||i,'channel','whatsapp','kind','status',
   'message_id','quarantine-provider-'||i,'destination','5521000000001','signal','delivered','occurred_at',now(),'captured_at',now(),
   'send_id',sends[i],'context_id',p.id,'revision',p.revision,'purpose','event_proposal'));
 end loop;
 update event_private.bot_bridge_state set enabled=false,cursor=0,scope_id=scope where singleton;
 perform public.event_bot_bridge_activate('bot:embaixada_urca|'||scope::text,0);
 update public.propostas set horario_evento='12:00' where id=proposals[1];
 -- Regression: a genuinely correlated old receipt must not poison the next valid event.
 perform public.event_bot_bridge_commit('bot:embaixada_urca',0,2,jsonb_build_object('scope',scope,'events',events));
 assert (select cursor=2 from event_private.bot_bridge_state where singleton),'Authenticated page advances atomically';
 assert (select delivery_status='delivered' from event_outbox where id=sends[2]),'Following current receipt is applied';
 assert (select delivery_status is null from event_outbox where id=sends[1]),'Stale receipt is not applied to changed proposal';
 assert (select count(*)=1 from event_private.bot_bridge_quarantine where scope_id=scope),'Old receipt is retained as minimal audit metadata';
 perform public.event_bot_bridge_commit('bot:embaixada_urca',2,3,jsonb_build_object('scope',scope,'events',jsonb_build_array(events->0)));
 assert (select count(*)=1 from event_private.bot_bridge_quarantine where scope_id=scope),'Repeated old event does not inflate quarantine';
 update public.propostas set horario_evento='10:00' where id=proposals[1];
 perform public.event_bot_bridge_commit('bot:embaixada_urca',3,4,jsonb_build_object('scope',scope,'events',jsonb_build_array(events->0)));
 assert (select delivery_status is null from event_outbox where id=sends[1]),'Commercial reversion cannot replay quarantined history';
 -- All identity/content failures still abort the page, even for an old event.
 select count(*) into before_events from public.event_provider_events;
 for v in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('destination','5521000000099'),jsonb_build_object('send_id',gen_random_uuid()),
  jsonb_build_object('context_id',proposals[2]),jsonb_build_object('revision',revisions[1]+1),
  jsonb_build_object('message_id','unmatched-provider'),jsonb_build_object('message_id',''),
  jsonb_build_object('purpose','reservation'),jsonb_build_object('kind',null),jsonb_build_object('key',''),jsonb_build_object('provider_reference','injected-reference'),
  jsonb_build_object('occurred_at','infinity'),jsonb_build_object('occurred_at',now()+interval '1 day'),
  jsonb_build_object('captured_at',null),jsonb_build_object('signal','invented'),jsonb_build_object('signal','read'),jsonb_build_object('body','Changed duplicate'),jsonb_build_object('body',repeat('x',6001)),
  jsonb_build_object('kind','inbound','reply_to_id','quarantine-provider-1','body','')))
 loop
  blocked:=false;
  begin perform public.event_bot_bridge_commit('bot:embaixada_urca',4,5,jsonb_build_object('scope',scope,'events',jsonb_build_array((events->0)||v)));
  exception when others then blocked:=true; end;
  assert blocked,'Malformed or miscorrelated event cannot be bypassed via quarantine';
  assert (select cursor=4 from event_private.bot_bridge_state where singleton),'Rejected page preserves cursor';
  assert (select count(*)=before_events from public.event_provider_events),'Rejected page has no partial ingestion';
 end loop;
 blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',4,5,jsonb_build_object('scope',gen_random_uuid(),'events',events));exception when others then blocked:=true;end;
 assert blocked,'Wrong scope never advances a quarantined page';
 blocked:=false;begin perform public.event_bot_bridge_commit('bot:other',4,5,jsonb_build_object('scope',scope,'events',events));exception when others then blocked:=true;end;
 assert blocked,'Wrong account never advances a quarantined page';
 blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',3,5,jsonb_build_object('scope',scope,'events',events));exception when others then blocked:=true;end;
 assert blocked,'Concurrent stale worker never advances a quarantined page';
 -- Current events cannot hide a conflicting duplicate inside the same page.
 blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',4,5,jsonb_build_object('scope',scope,'events',jsonb_build_array(
  (events->1)||'{"key":"conflicting-page"}'::jsonb,(events->1)||'{"key":"conflicting-page","signal":"read"}'::jsonb)));
 exception when others then blocked:=true;end;
 assert blocked and (select cursor=4 from event_private.bot_bridge_state where singleton),'Conflicting within-page keys abort atomically';
 perform public.event_bot_bridge_commit('bot:embaixada_urca',4,4,jsonb_build_object('scope',scope,'events',jsonb_build_array(events->1,events->1)));
 assert (select count(*)=before_events from public.event_provider_events),'Exact duplicate page items remain idempotent';
 -- A new quarantine entry rolls back if any later identity is invalid.
 update public.propostas set horario_evento='12:00' where id=proposals[2];
 perform public.event_bot_bridge_commit('bot:embaixada_urca',4,4,jsonb_build_object('scope',scope,'events',jsonb_build_array(events->1)));
 assert (select count(*)=1 from event_private.bot_bridge_quarantine where scope_id=scope),'A previously applied duplicate does not become a false quarantine after an edit';
 blocked:=false;begin perform public.event_bot_bridge_commit('bot:embaixada_urca',4,5,jsonb_build_object('scope',scope,'events',jsonb_build_array(
  (events->1)||'{"key":"atomic-old"}'::jsonb,(events->0)||'{"message_id":"forged-reference"}'::jsonb)));
 exception when others then blocked:=true;end;
 assert blocked and (select cursor=4 from event_private.bot_bridge_state where singleton),'Mixed invalid page is atomic';
 assert (select count(*)=1 from event_private.bot_bridge_quarantine where scope_id=scope),'Quarantine entry rolls back with rejected page';
 update public.propostas set horario_evento='10:00' where id=proposals[2];
 update public.propostas set is_current=false where id=proposals[1];
 perform public.event_bot_bridge_commit('bot:embaixada_urca',4,5,jsonb_build_object('scope',scope,'events',jsonb_build_array((events->0)||'{"key":"superseded-old"}'::jsonb)));
 assert exists(select 1 from event_private.bot_bridge_quarantine where scope_id=scope and reason='proposal_superseded'),'Superseded send is quarantined';
 update public.propostas set is_current=true,status='cancelado' where id=proposals[1];
 select count(*) into before_messages from public.event_messages;
 perform public.event_bot_bridge_commit('bot:embaixada_urca',5,6,jsonb_build_object('scope',scope,'events',jsonb_build_array(
  (events->0)||jsonb_build_object('key','cancelled-reply','kind','inbound','message_id','old-client-reply','reply_to_id','quarantine-provider-1','body','Synthetic old reply'),
  (events->1)||jsonb_build_object('key','current-read','signal','read'))));
 assert exists(select 1 from event_private.bot_bridge_quarantine where scope_id=scope and reason='proposal_closed' and kind='inbound'),'Cancelled proposal reply is quarantined';
 assert (select count(*)=before_messages from public.event_messages),'Old inbound body is not copied into a current conversation';
 assert (select delivery_status='read' from event_outbox where id=sends[2]),'Valid later receipt continues past cancelled proposal reply';
 assert (select cursor=6 from event_private.bot_bridge_state where singleton);
 health:=event_private.channel_diagnostics_snapshot();
 assert health#>>'{runtime,bridge,state}'='degraded' and (health#>>'{runtime,bridge,quarantined_total}')::int=3,'Fresh transport with quarantine is degraded, not unqualified green';
 assert health#>>'{runtime,mailbox,state}'='disabled','Installed mailbox is not operational proof';
 assert position('5521000000001' in health::text)=0 and position('Synthetic old reply' in health::text)=0 and position(scope::text in health::text)=0,'Diagnostic contains no raw contact, message, or private scope';
 update event_private.bot_bridge_state set last_success_at=now()-interval '16 minutes' where singleton;
 assert event_private.channel_diagnostics_snapshot()#>>'{runtime,bridge,state}'='stale','Old success becomes stale';
 update event_private.bot_bridge_state set last_success_at=null where singleton;
 assert event_private.channel_diagnostics_snapshot()#>>'{runtime,bridge,state}'='not_observed','Missing success is not healthy';
 update event_private.bot_bridge_state set enabled=false where singleton;
 assert event_private.channel_diagnostics_snapshot()#>>'{runtime,bridge,state}'='disabled','Disabled remains explicit';
 -- A new private grant cannot silently replay a known obsolete provider event.
 scope:=gen_random_uuid();
 update event_private.bot_bridge_state set enabled=false,cursor=0,scope_id=scope where singleton;
 perform public.event_bot_bridge_activate('bot:embaixada_urca|'||scope::text,0);
 update public.propostas set status='proposta_pronta',horario_evento='10:00',is_current=true where id=proposals[1];
 perform public.event_bot_bridge_commit('bot:embaixada_urca',0,1,jsonb_build_object('scope',scope,'events',jsonb_build_array(events->0)));
 assert (select delivery_status is null from public.event_outbox where id=sends[1]),'Grant rotation does not replay quarantine after a commercial reversion';
 assert (select count(*)=3 from event_private.bot_bridge_quarantine),'Scope rotation does not duplicate old quarantine';
 update event_private.channel_credentials set expected_account='bot:other' where provider='zapi';
 assert event_private.channel_diagnostics_snapshot()#>>'{runtime,bridge,state}'='blocked','Wrong bridge identity is not healthy despite old success';
 -- Reuse the schema-defined canonical mailbox without adding contact literals.
 select substring(pg_get_constraintdef(oid) from 'mailbox = ''([^'']+)''') into canonical_mailbox from pg_constraint
  where conrelid='event_private.mailbox_sync_state'::regclass and conname='mailbox_sync_state_mailbox_check';
 assert canonical_mailbox is not null;
 update event_private.mailbox_sync_state set enabled=true,account_id='100',mailbox=canonical_mailbox,activated_at_ms=1700000000000,watermark_ms=1700000000000,last_success_at=now() where singleton;
 update event_private.channel_credentials set enabled=true,expected_account='different@example.test' where provider='mailbox';
 assert event_private.channel_diagnostics_snapshot()#>>'{runtime,mailbox,state}'='blocked','Mismatched mailbox identity is not healthy despite old success';
 update event_private.channel_credentials set expected_account=canonical_mailbox where provider='mailbox';
 assert event_private.channel_diagnostics_snapshot()#>>'{runtime,mailbox,state}'='observed','Matching mailbox and fresh success are visible without a provider call';
 assert not has_table_privilege('anon','event_private.bot_bridge_quarantine','select');
 assert not has_table_privilege('authenticated','event_private.bot_bridge_quarantine','select');
 assert not has_table_privilege('service_role','event_private.bot_bridge_quarantine','select');
 assert not has_function_privilege('anon','public.event_bot_bridge_commit(text,bigint,bigint,jsonb)','execute');
 assert not has_function_privilege('authenticated','public.event_bot_bridge_commit(text,bigint,bigint,jsonb)','execute');
 assert has_function_privilege('service_role','public.event_bot_bridge_commit(text,bigint,bigint,jsonb)','execute');
end $$;
rollback;
