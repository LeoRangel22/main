-- Disposable local database only. All provider calls are replaced and rolled back.
begin;
create temporary table continuous_fixture_http(id bigserial,body jsonb);
create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$declare result bigint;begin
 if $1<>'https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync' or $2<>'{"action":"sync"}'::jsonb then raise exception 'unexpected_fixture_http';end if;
 insert into continuous_fixture_http(body) values($2) returning id into result;return result;
end $$;
create or replace function cron.unschedule(target_job bigint) returns boolean language plpgsql as $$
declare removed integer;begin delete from cron.job where jobid=$1;get diagnostics removed=row_count;return removed>0;end $$;
do $$
declare principal record;actor uuid;owner_email text;attempt uuid;opportunity uuid;p uuid;send_id uuid;route jsonb;claim jsonb;
 result jsonb;binding jsonb;items jsonb;cfg jsonb;version bigint;request uuid:=gen_random_uuid();blocked boolean;
 received bigint;started timestamptz;other_channels jsonb;message_count integer;
begin
 assert not has_function_privilege('anon','public.event_continuous_mailbox(text,bigint,uuid[],uuid,boolean)','execute');
 assert not has_function_privilege('service_role','public.event_continuous_mailbox(text,bigint,uuid[],uuid,boolean)','execute');
 assert not has_table_privilege('authenticated','event_private.mailbox_continuous_control','update');
 assert not has_table_privilege('service_role','event_private.mailbox_continuous_audit','select');
 assert not exists(select 1 from event_private.mailbox_continuous_control where enabled);
 assert not exists(select 1 from cron.job where jobname='events-mailbox-continuous'),'Installation creates no schedule';
 assert not exists(select 1 from event_private.mailbox_sync_state where enabled or capture_mode<>'pilot');
 select jsonb_agg(jsonb_build_array(provider,enabled) order by provider) into other_channels from event_private.channel_credentials where provider<>'mailbox';
 perform set_config('request.jwt.claims','{}',true);
 blocked:=false;begin perform public.event_continuous_mailbox('status');exception when others then blocked:=sqlerrm='oauth_owner_required';end;assert blocked;
 for principal in select id,email from auth.users order by id loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',principal.id,'email',principal.email,'role','authenticated')::text,true);
  if public.is_super_admin() then actor:=principal.id;owner_email:=lower(principal.email);exit;end if;
 end loop;
 update auth.users set email_confirmed_at=clock_timestamp() where id=actor;
 update event_private.mailbox_sync_state set account_id='123',mailbox='eventos@embaixadacarioca.com.br' where singleton;
 update event_private.channel_credentials set enabled=false,delivery_job_key='synthetic-job-key',expected_account='eventos@embaixadacarioca.com.br' where provider='mailbox';
 insert into event_private.mailbox_oauth_attempts(owner_id,state,client_fingerprint,prepare_expires_at)
 values(actor,'stored',repeat('a',64),clock_timestamp()+interval '10 minutes') returning id into attempt;
 insert into event_private.mailbox_oauth_connection(singleton,attempt_id,owner_id,account_id,mailbox,vault_secret_id,client_fingerprint)
 values(true,attempt,actor,'123','eventos@embaixadacarioca.com.br',gen_random_uuid(),repeat('a',64));
 insert into public.oportunidades(cliente_nome,cliente_email,data_evento,status)
 values('Synthetic continuous capture',owner_email,'2099-12-01','negociacao') returning id into opportunity;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,status,publication_status,public_token_expires_at,snapshot)
 values(opportunity,'[TESTE SEM VALOR COMERCIAL] QA-VENDA-01',owner_email,'2099-12-01','09:00',45,1,1000,120,0,1120,'negociacao','ready',clock_timestamp()+interval '1 day','{"event":{},"totals":{"adjustment":0}}') returning id into p;
 route:=public.event_email_reply_route_prepare(p,1,owner_email,repeat('a',64));
 claim:=public.begin_event_send(p,'email',owner_email,'Synthetic continuous fixture','Synthetic fixture',null);send_id:=(claim#>>'{send,id}')::uuid;
 perform public.event_email_reply_route_bind((route->>'id')::uuid,send_id,1,repeat('a',64),repeat('b',64),'Synthetic continuous fixture');
 perform public.finish_event_send(send_id,'accepted','synthetic-provider-receipt');
 update event_private.mailbox_reply_routes set revoked_at=clock_timestamp() where id=(route->>'id')::uuid;
 result:=public.event_continuous_mailbox('status');assert result->>'state'='closed';
 assert (select count(*)=0 from continuous_fixture_http),'Status performs no provider call';
 blocked:=false;begin perform public.event_continuous_mailbox('start_test',0,array[send_id],request,false);exception when others then blocked:=sqlerrm='explicit_confirmation_required';end;assert blocked;
 assert (select revoked_at is not null from event_private.mailbox_reply_routes where id=(route->>'id')::uuid),'Unconfirmed admission cannot revive a route';
 blocked:=false;begin perform public.event_continuous_mailbox('start_test',0,array[send_id,send_id],request,true);exception when others then blocked:=sqlerrm='test_scope_invalid';end;assert blocked;
 result:=public.event_continuous_mailbox('start_test',0,array[send_id],request,true);version:=(result->>'version')::bigint;
 assert result->>'state'='active' and result->>'testOnly'='true' and result->>'schedulerRegistered'='true';
 assert (select revoked_at is null from event_private.mailbox_reply_routes where id=(route->>'id')::uuid);
 assert (select count(*)=1 from event_private.mailbox_continuous_audit where action='test_route_readmitted'),'Readmission is explicit and audited';
 perform public.event_continuous_mailbox('start_test',0,array[send_id],request,true);
 assert (select count(*)=1 from cron.job where jobname='events-mailbox-continuous'),'Request replay creates no second schedule';
 assert (select count(*)=0 from continuous_fixture_http),'Activation schedules reading but sends no message or immediate request';
 -- Only this disposable fixture's clock is moved; production timestamps cannot be backdated through the API.
 started:=now()-interval '20 minutes';
 update event_private.mailbox_continuous_control set started_at=started,expires_at=started+interval '1 hour' where singleton;
 update event_private.mailbox_sync_state set activated_at_ms=floor(extract(epoch from started)*1000)::bigint,
  watermark_ms=floor(extract(epoch from started)*1000)::bigint,version=mailbox_sync_state.version+1 where singleton;
 assert event_private.mailbox_capture_active('123','eventos@embaixadacarioca.com.br'),'Capture survives the old fifteen-minute boundary';
 assert event_private.mailbox_capture_contains(send_id);
 assert not event_private.mailbox_capture_contains(gen_random_uuid()),'A third send is outside the test';
 update event_private.mailbox_sync_state set account_id='456' where singleton;
 assert not event_private.mailbox_capture_active('456','eventos@embaixadacarioca.com.br'),'Account drift closes the scope';
 update event_private.mailbox_sync_state set account_id='123' where singleton;
 binding:=public.event_mailbox_resolve_routed_binding('123','eventos@embaixadacarioca.com.br',owner_email,'<continuous-reply@example.test>','[]',jsonb_build_array(route->>'reply_to'));
 assert binding->>'send_id'=send_id::text and binding->>'proposal_id'=p::text;
 assert public.event_mailbox_resolve_routed_binding('123','eventos@embaixadacarioca.com.br','other@example.test','<foreign@example.test>','[]',jsonb_build_array(route->>'reply_to')) is null,'A forged sender cannot inherit the route';
 received:=floor(extract(epoch from now())*1000)::bigint-1000;
 items:=jsonb_build_array(jsonb_build_object('provider_id','501','received_at_ms',received,'state','prepared',
  'inbound_message_id','<continuous-reply@example.test>','sender',owner_email,'reply_candidates','[]'::jsonb,
  'reply_routes',jsonb_build_array(route->>'reply_to'),'binding',binding,
  'event',jsonb_build_object('kind','inbound','channel','email','body','Synthetic return from the breakfast fixture',
   'message_id','<continuous-reply@example.test>','key','<continuous-reply@example.test>','destination',owner_email,'occurred_at',to_timestamp(received/1000.0))));
 cfg:=public.event_mailbox_worker_config();
 perform public.event_mailbox_commit_bound((cfg->>'version')::bigint,'123',(cfg->>'watermark_ms')::bigint,received,items);
 assert (select count(*)=1 from public.event_messages where proposal_id=p and direction='inbound');
 assert public.event_mailbox_seen('["501"]')='["501"]','The next worker scan deduplicates this provider message';
 cfg:=public.event_mailbox_worker_config();
 blocked:=false;begin perform public.event_mailbox_commit_bound((cfg->>'version')::bigint,'123',(cfg->>'watermark_ms')::bigint,received,items);
 exception when others then blocked:=sqlerrm='duplicate_requires_readback';end;assert blocked;
 result:=public.event_continuous_mailbox('status');
 assert result#>>'{replies,0,persisted}'='true','Readback joins the exact send, attempt, proposal and revision';
 assert (result->>'lastSuccessAt')::timestamptz>(result->>'startsAt')::timestamptz+interval '15 minutes';
 result:=public.event_continuous_mailbox('stop',version,'{}',gen_random_uuid(),true);version:=(result->>'version')::bigint;
 assert result->>'state'='closed' and result->>'captureEnabled'='false' and result->>'schedulerRegistered'='false';
 assert (select revoked_at is not null from event_private.mailbox_reply_routes where id=(route->>'id')::uuid);
 assert (select count(*)=1 from public.event_messages where proposal_id=p and direction='inbound'),'Closure preserves the recorded reply';
 assert (select attempts=1 and status='accepted' from public.event_outbox where id=send_id),'No replay of the proposal';
 result:=public.event_continuous_mailbox('start',version,'{}',gen_random_uuid(),true);version:=(result->>'version')::bigint;
 assert result->>'testOnly'='false' and result->'expiresAt'='null'::jsonb;
 assert (select revoked_at is not null from event_private.mailbox_reply_routes where id=(route->>'id')::uuid),'Operational activation does not revive old revoked routes';
 assert not event_private.mailbox_capture_contains(send_id);
 perform event_private.queue_continuous_mailbox();perform event_private.queue_continuous_mailbox();
 assert (select count(*)=1 from continuous_fixture_http),'The scheduler throttles duplicate wake-ups';
 result:=public.event_continuous_mailbox('stop',version,'{}',gen_random_uuid(),true);version:=(result->>'version')::bigint;
 result:=public.event_continuous_mailbox('start_test',version,array[send_id],gen_random_uuid(),true);
 started:=clock_timestamp()-interval '1 hour';
 update event_private.mailbox_continuous_control set started_at=started,expires_at=clock_timestamp()-interval '1 second' where singleton;
 update event_private.mailbox_sync_state set activated_at_ms=floor(extract(epoch from started)*1000)::bigint,watermark_ms=floor(extract(epoch from started)*1000)::bigint where singleton;
 perform event_private.queue_continuous_mailbox();
 assert (public.event_continuous_mailbox('status')->>'state')='closed','Expiry disables flags and removes its own schedule';
 assert (select count(*)=1 from continuous_fixture_http),'Expiry makes no new provider request';
 assert other_channels is not distinct from (select jsonb_agg(jsonb_build_array(provider,enabled) order by provider) from event_private.channel_credentials where provider<>'mailbox'),'Other providers stay unchanged';
end $$;
rollback;
