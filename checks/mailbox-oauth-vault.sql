-- Synthetic database fixtures only. Every mutation rolls back. No HTTP/OAuth.
begin;
do $$
declare actor uuid;a uuid;r jsonb;blocked boolean;before_state jsonb;before_channel jsonb;
begin
 assert not has_table_privilege('authenticated','event_private.mailbox_oauth_connection','select'),'Connection table private';
 assert not has_function_privilege('authenticated','public.event_mailbox_oauth_store(uuid,uuid,text,text,text)','execute'),'Client cannot store tokens';
 assert not has_function_privilege('authenticated','public.event_mailbox_oauth_worker_credential(text)','execute'),'Client cannot read tokens';
 assert not has_function_privilege('anon','public.event_mailbox_oauth_status()','execute'),'Anonymous cannot inspect setup';
 assert (select bool_and(relrowsecurity) from pg_class where oid in ('event_private.mailbox_oauth_attempts'::regclass,'event_private.mailbox_oauth_connection'::regclass)),'Private RLS enabled';
 select id into actor from auth.users where email='leorangel@gmail.com';
 select to_jsonb(s) into before_state from event_private.mailbox_sync_state s where singleton;
 select to_jsonb(c) into before_channel from event_private.channel_credentials c where provider='mailbox';
 update auth.users set email_confirmed_at=clock_timestamp() where id=actor;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','email','leorangel@gmail.com')::text,true);
 r:=public.event_mailbox_oauth_prepare(repeat('a',64));a:=(r->>'attempt_id')::uuid;
 assert public.event_mailbox_oauth_status()->>'state'='prepared','Owner preparation metadata';
 perform public.event_mailbox_oauth_claim(a,repeat('a',64));
 blocked:=false;begin perform public.event_mailbox_oauth_claim(a,repeat('a',64));exception when others then blocked:=true;end;assert blocked,'Claim cannot repeat';
 perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
 r:=public.event_mailbox_oauth_store(a,actor,'12345678901234567890','fixture-refresh-not-a-real-credential',repeat('a',64));
 assert (r->>'stored')::boolean,'Backend commits one synthetic Vault credential';
 assert (select count(*)=1 from vault.secrets where name='events-mailbox-refresh-v1'),'One Vault entry';
 assert public.event_mailbox_oauth_worker_credential('12345678901234567890')->>'refresh_token'='fixture-refresh-not-a-real-credential','Backend-only exact-account retrieval';
 assert (select enabled=false and capture_send_ids='{}'::uuid[] and capture_started_at is null and capture_expires_at is null from event_private.mailbox_sync_state where singleton),'Capture remains off';
 assert (select enabled=false from event_private.channel_credentials where provider='mailbox'),'Channel remains off';
 assert (select (to_jsonb(s)-array['account_id','mailbox','version'])=(before_state-array['account_id','mailbox','version']) from event_private.mailbox_sync_state s where singleton),'Cursor and operational state preserved';
 assert (select (to_jsonb(c)-'expected_account')=(before_channel-'expected_account') from event_private.channel_credentials c where provider='mailbox'),'Other channel credentials preserved';
 perform public.event_mailbox_oauth_uncertain(a,actor,'STORE');
 assert (select state='stored' from event_private.mailbox_oauth_attempts where id=a),'Late uncertainty cannot undo a stored result';
 blocked:=false;begin perform public.event_mailbox_oauth_store(a,actor,'12345678901234567890','replacement-fixture',repeat('a',64));exception when others then blocked:=true;end;assert blocked,'No overwrite';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','email','leorangel@gmail.com')::text,true);
 assert public.event_mailbox_oauth_status()->>'state'='stored','Owner readback contains only metadata';
end $$;
rollback;
