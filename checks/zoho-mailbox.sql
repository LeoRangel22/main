begin;
do $$
declare activation bigint:=floor(extract(epoch from now())*1000)-3600000;
 received bigint:=activation+1000; initial_events bigint; before_seen bigint; current_version bigint; next_time bigint; event jsonb; items jsonb; blocked boolean;
begin
 if has_function_privilege('anon','public.event_mailbox_worker_config()','EXECUTE')
  or has_function_privilege('authenticated','public.event_mailbox_worker_config()','EXECUTE')
  or has_function_privilege('authenticated','public.event_mailbox_seen(jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.event_mailbox_commit(bigint,text,bigint,bigint,jsonb)','EXECUTE')
  or has_function_privilege('anon','event_private.queue_mailbox_sync()','EXECUTE') then raise exception 'Mailbox worker exposed'; end if;
 if has_table_privilege('authenticated','event_private.mailbox_sync_state','SELECT')
  or has_table_privilege('authenticated','event_private.mailbox_seen','SELECT') then raise exception 'Mailbox private state exposed'; end if;
 if exists(select 1 from event_private.mailbox_sync_state where enabled or account_id is not null or watermark_ms is not null) then raise exception 'Mailbox must install dormant'; end if;
 if not (select relrowsecurity from pg_class where oid='event_private.mailbox_sync_state'::regclass)
  or not (select relrowsecurity from pg_class where oid='event_private.mailbox_seen'::regclass) then raise exception 'Mailbox RLS missing'; end if;
 select count(*) into initial_events from public.event_provider_events where provider='mailbox';
 event:=jsonb_build_object('key','<mailbox-fixture-transaction@example.test>','message_id','<mailbox-fixture-transaction@example.test>','kind','inbound','channel','email','destination','mailbox-fixture-client@example.test','body','Isolated mailbox fixture','occurred_at',to_timestamp(received/1000.0));
 items:=jsonb_build_array(jsonb_build_object('provider_id','1709876190693100009','received_at_ms',received,'event',event));
 blocked:=false;
 begin perform public.event_mailbox_commit(0,'2560636000000008002',activation,received,items); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Disabled mailbox committed'; end if;
 -- Explicit isolated fixture, not production activation.
 update event_private.channel_credentials set enabled=true,expected_account='eventos@embaixadacarioca.com.br' where provider='mailbox';
 update event_private.mailbox_sync_state set enabled=true,account_id='2560636000000008002',mailbox='eventos@embaixadacarioca.com.br',activated_at_ms=activation,watermark_ms=activation where singleton;
 perform public.event_mailbox_commit(0,'2560636000000008002',activation,received,items);
 if (select version<>1 or watermark_ms<>received or last_success_at is null from event_private.mailbox_sync_state where singleton) then raise exception 'Atomic cursor not committed'; end if;
 if (select count(*) from public.event_provider_events where provider='mailbox')<>initial_events+1 then raise exception 'Inbound missing'; end if;
 if (select count(*) from event_private.mailbox_seen)<>1 then raise exception 'Dedup marker missing'; end if;
 if public.event_mailbox_seen('["1709876190693100009","1709876190693100008"]')<>'["1709876190693100009"]'::jsonb then raise exception 'Seen identity invalid'; end if;
 -- Replay is idempotent, including same RFC ID under a different provider ID.
 perform public.event_mailbox_commit(1,'2560636000000008002',received,received,items);
 items:=jsonb_build_array(jsonb_build_object('provider_id','1709876190693100010','received_at_ms',received,'event',event));
 perform public.event_mailbox_commit(2,'2560636000000008002',received,received,items);
 if (select count(*) from public.event_provider_events where provider='mailbox')<>initial_events+1 then raise exception 'RFC replay duplicated inbound'; end if;
 -- A stale racing worker cannot commit even if its message is new.
 blocked:=false;
 begin perform public.event_mailbox_commit(2,'2560636000000008002',received,received+1,'[]'); exception when sqlstate 'PT409' then blocked:=true; end;
 if not blocked or (select version from event_private.mailbox_sync_state where singleton)<>3 then raise exception 'CAS accepted stale worker'; end if;
 -- Failure in canonical ingestion rolls back seen markers and watermark as one unit.
 select count(*) into before_seen from event_private.mailbox_seen;
 event:=event||jsonb_build_object('key','<mailbox-fixture-invalid@example.test>','message_id','<mailbox-fixture-invalid@example.test>','destination',repeat('x',321));
 items:=jsonb_build_array(jsonb_build_object('provider_id','1709876190693100011','received_at_ms',received,'event',event));
 blocked:=false;
 begin perform public.event_mailbox_commit(3,'2560636000000008002',received,received+1,items); exception when others then blocked:=true; end;
 if not blocked or (select count(*) from event_private.mailbox_seen)<>before_seen or (select version from event_private.mailbox_sync_state where singleton)<>3 then raise exception 'Failed ingestion partially committed'; end if;
 -- Header-only exclusions are deduplicated without creating public inbound records.
 items:=jsonb_build_array(jsonb_build_object('provider_id','1709876190693100012','received_at_ms',received,'event',null));
 perform public.event_mailbox_commit(3,'2560636000000008002',received,received+1,items);
 if (select count(*) from public.event_provider_events where provider='mailbox')<>initial_events+1 then raise exception 'Ignored alias became inbound'; end if;
 blocked:=false;
 begin perform public.event_mailbox_commit(4,'0000000000000000001',received+1,received+2,'[]'); exception when sqlstate 'PT409' then blocked:=true; end;
 if not blocked then raise exception 'Wrong account accepted'; end if;
 -- Channel disablement gates pending sync independently of private state.
 update event_private.channel_credentials set enabled=false where provider='mailbox';
 blocked:=false;
 begin perform public.event_mailbox_commit(4,'2560636000000008002',received+1,received+2,'[]'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Disabled channel accepted'; end if;
end; $$;
rollback;
