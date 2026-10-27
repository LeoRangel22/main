-- Isolated, rollback-only diagnostic receipts. No provider, grant or channel.
begin;
do $$
declare owner_id uuid; target_id uuid:=gen_random_uuid(); candidate record; v jsonb; r jsonb; bad jsonb; blocked boolean; before_count integer; rejected_message text;
begin
 for candidate in select id,email from auth.users loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.id,'email',candidate.email,'role','authenticated')::text,true);
  if public.is_super_admin() then owner_id:=candidate.id;exit;end if;
 end loop;
 assert owner_id is not null;
 update auth.users set email_confirmed_at=now(),banned_until=null where id=owner_id;
 insert into event_private.whatsapp_pilots(id,owner_id,destination,body,content_hash,approval_reference,created_at,expires_at,status,attempts,claimed_at,finished_at,provider_id,network_attempted)
 values(target_id,owner_id,'5511999999999','SYNTHETIC RECEIPT ONLY',repeat('a',64),'test/diagnostic-receipt',now()-interval '20 minutes',now()-interval '5 minutes','accepted',1,now()-interval '19 minutes',now()-interval '18 minutes','DIAGNOSTIC_TEST_PROVIDER',true);
 assert not has_function_privilege('anon','public.get_event_whatsapp_pilot_receipt(uuid)','execute');
 assert not has_function_privilege('authenticated','public.reconcile_event_whatsapp_pilot(uuid,jsonb)','execute');
 assert has_function_privilege('service_role','public.reconcile_event_whatsapp_pilot(uuid,jsonb)','execute');
 assert not has_table_privilege('service_role','event_private.whatsapp_pilot_receipts','SELECT,INSERT,UPDATE,DELETE');
 assert (select relrowsecurity from pg_class where oid='event_private.whatsapp_pilot_receipts'::regclass);
 v:=jsonb_build_object('key','DIAGNOSTIC_TEST_EVENT','kind','status','message_id','DIAGNOSTIC_TEST_PROVIDER','reply_to_id',null,'destination','5511999999999','body',null,'signal','read','occurred_at',now()-interval '10 minutes','captured_at',now()-interval '9 minutes');
 set local role service_role;
 r:=public.reconcile_event_whatsapp_pilot(target_id,jsonb_build_array(v));assert r->>'inserted'='1';
 r:=public.reconcile_event_whatsapp_pilot(target_id,jsonb_build_array(v));assert r->>'inserted'='0';
 reset role;
 select count(*) into before_count from event_private.whatsapp_pilot_receipts where pilot_id=target_id;
 bad:=v||jsonb_build_object('key','MALFORMED_TIMESTAMP','occurred_at','DO_NOT_ECHO_SYNTHETIC_PRIVATE_DETAIL');
 blocked:=false;
 begin
  perform public.reconcile_event_whatsapp_pilot(target_id,jsonb_build_array(v||'{"key":"MUST_ROLL_BACK"}'::jsonb,bad));
 exception when sqlstate '22023' then blocked:=true;rejected_message:=sqlerrm;end;
 assert blocked and rejected_message='Invalid diagnostic receipt value';
 assert (select count(*)=before_count from event_private.whatsapp_pilot_receipts where pilot_id=target_id),'A malformed later event cannot partially commit';
 blocked:=false;begin perform public.reconcile_event_whatsapp_pilot(target_id,jsonb_build_array(v||'{"signal":"delivered"}'::jsonb));exception when sqlstate 'PT409' then blocked:=true;end;assert blocked;
 v:=v||jsonb_build_object('key','DIAGNOSTIC_TEST_REPLY','kind','inbound','message_id','DIAGNOSTIC_TEST_REPLY_ID','reply_to_id','DIAGNOSTIC_TEST_PROVIDER','signal',null,'body','TESTE RECEBIDO');
 perform public.reconcile_event_whatsapp_pilot(target_id,jsonb_build_array(v));
 assert not exists(select 1 from information_schema.columns where table_schema='event_private' and table_name='whatsapp_pilot_receipts' and column_name in ('body','destination'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'email',(select email from auth.users where id=owner_id),'role','authenticated')::text,true);
 set local role authenticated;
 r:=public.get_event_whatsapp_pilot_receipt(target_id);assert r->>'deliveryConfirmed'='true' and r->>'replyConfirmed'='true';
 assert not (r?'destination') and not (r?'body');
 reset role;
 assert (select status='accepted' and attempts=1 and not enabled from event_private.whatsapp_pilots where id=target_id),'Reconciliation must never reopen or reset sending';
end $$;
rollback;
