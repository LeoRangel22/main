-- Disposable database only. Rolled back; HTTP is an explicit local fixture.
begin;
create temporary table owner_pilot_http(id bigserial,body jsonb);
create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$declare result bigint;begin
 if $1<>'https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-mailbox-sync' or $2<>'{"action":"sync"}'::jsonb then raise exception 'unexpected_fixture_http';end if;
 insert into owner_pilot_http(body) values($2) returning id into result;return result;
end $$;
do $$
declare principal record;actor uuid;owner_email text;o uuid;p uuid;p2 uuid;b uuid;wrong_send uuid;
 v bigint;r jsonb;old_route uuid;result jsonb;claim jsonb;blocked boolean;old_capture jsonb;job bigint;
begin
 assert not has_table_privilege('anon','event_private.mailbox_owner_pilot','SELECT');
 assert not has_table_privilege('authenticated','event_private.mailbox_owner_pilot','UPDATE');
 assert not has_function_privilege('anon','public.event_owner_mailbox_pilot(text,bigint,uuid[],uuid,boolean)','EXECUTE');
 assert not has_function_privilege('service_role','public.event_owner_mailbox_pilot(text,bigint,uuid[],uuid,boolean)','EXECUTE');
 assert not has_function_privilege('authenticated','public.event_email_owner_pilot_config()','EXECUTE');
 assert has_function_privilege('service_role','public.event_email_owner_pilot_config()','EXECUTE');
 assert not exists(select 1 from event_private.mailbox_sync_state where enabled or cardinality(capture_send_ids)>0),'Installed OFF';
 assert public.event_email_owner_pilot_config() is null,'No pilot configured by installation';
 perform set_config('request.jwt.claims','{}',true);
 blocked:=false;begin perform public.event_owner_mailbox_pilot('status');exception when others then blocked:=true;end;assert blocked,'Anonymous origin rejected';
 for principal in select id,email from auth.users order by id loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',principal.id,'email',principal.email,'role','authenticated')::text,true);
  if public.is_super_admin() then actor:=principal.id;owner_email:=lower(principal.email);exit;end if;
 end loop;
 assert actor is not null;
 update auth.users set email_confirmed_at=null where id=actor; -- explicit negative fixture
 blocked:=false;begin perform public.event_owner_mailbox_pilot('status');exception when others then blocked:=true;end;assert blocked,'Unconfirmed owner is denied even through direct RPC';
 update auth.users set email_confirmed_at=clock_timestamp() where id=actor; -- disposable identity only
 result:=public.event_owner_mailbox_pilot('status');assert result->>'state'='closed';
 assert (select count(*)=0 from owner_pilot_http),'Status cannot contact provider';
 update event_private.mailbox_sync_state set account_id='123',mailbox='eventos@embaixadacarioca.com.br',watermark_ms=null,activated_at_ms=null where singleton;
 update event_private.channel_credentials set enabled=false,delivery_job_key='disposable-fixture-key',expected_account='eventos@embaixadacarioca.com.br' where provider='mailbox';
 insert into public.oportunidades(cliente_nome,cliente_email,data_evento,status) values('Synthetic pilot',owner_email,'2099-12-01','negociacao') returning id into o;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,privatizacao,total,status,publication_status,public_token_expires_at,snapshot)
 values(o,'[TESTE SEM VALOR COMERCIAL] QA-VENDA-01',owner_email,'2099-12-01','09:00',45,1,1000,120,0,1120,'negociacao','ready',clock_timestamp()+interval '1 day','{"event":{},"totals":{"adjustment":0}}') returning id into p;
 blocked:=false;begin perform public.event_owner_mailbox_pilot('open',0,array[p],null,false);exception when others then blocked:=true;end;assert blocked,'Explicit confirmation mandatory';
 blocked:=false;begin perform public.event_owner_mailbox_pilot('open',0,array[p,p],null,true);exception when others then blocked:=true;end;assert blocked,'Duplicate proposal scope rejected';
 old_route:=(public.event_email_reply_route_prepare(p,1,owner_email,repeat('a',64))->>'id')::uuid;
 result:=public.event_owner_mailbox_pilot('open',0,array[p],null,true);v:=(result->>'version')::bigint;
 assert result->>'state'='open' and result->>'captureEnabled'='false','Opening routes does not open capture';
 assert (result->>'expiresAt')::timestamptz-(result->>'startsAt')::timestamptz=interval '15 minutes';
 assert public.event_email_owner_pilot_config()->>'recipient'=owner_email;
 blocked:=false;begin perform public.event_owner_mailbox_pilot('open',0,array[p],null,true);exception when others then blocked:=true;end;assert blocked,'Stale mutation rejected';
 r:=public.event_email_reply_route_prepare(p,1,owner_email,repeat('a',64));
 assert (r->>'id')::uuid<>old_route and (select revoked_at is not null from event_private.mailbox_reply_routes where id=old_route),'Stale unbound preview is refreshed, not mistaken for this window';
 claim:=public.begin_event_send(p,'email',owner_email,'Owner pilot fixture','Synthetic fixture',null);b:=(claim#>>'{send,id}')::uuid;
 update public.event_outbox set created_at=clock_timestamp() where id=b; -- transaction-time adapter, fixture only
 perform public.event_email_reply_route_bind((r->>'id')::uuid,b,1,repeat('a',64),repeat('b',64),'Owner pilot fixture');
 blocked:=false;begin perform public.event_owner_mailbox_pilot('capture',v,array[b],null,true);exception when others then blocked:=true;end;assert blocked,'Sending transport cannot authorize capture';
 perform public.finish_event_send(b,'accepted','fixture-provider-receipt');
 insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,attempts,approved_by,reviewed_revision)
 select proposal_id,opportunity_id,fingerprint||':unbound',channel,destination,body,status,attempts,approved_by,reviewed_revision from public.event_outbox where id=b returning id into wrong_send;
 blocked:=false;begin perform public.event_owner_mailbox_pilot('capture',v,array[wrong_send],null,true);exception when others then blocked:=true;end;assert blocked,'Unbound third send cannot be captured';
 result:=public.event_owner_mailbox_pilot('capture',v,array[b],null,true);v:=(result->>'version')::bigint;
 assert result->>'captureScoped'='true';assert (result->'captureSendIds')=jsonb_build_array(b);
 assert (select capture_message_limit=4 and cardinality(capture_send_ids)=1 from event_private.mailbox_sync_state where singleton);
 result:=public.event_owner_mailbox_pilot('queue',v,'{}','00000000-0000-4000-8000-000000000111');
 assert (select count(*)=1 from owner_pilot_http);
 perform public.event_owner_mailbox_pilot('queue',v,'{}','00000000-0000-4000-8000-000000000111');
 assert (select count(*)=1 from owner_pilot_http),'Same queue request is idempotent';
 blocked:=false;begin perform public.event_owner_mailbox_pilot('queue',v,'{}','00000000-0000-4000-8000-000000000222');exception when others then blocked:=true;end;assert blocked,'Uncertain job cannot be replayed';
 select last_job into job from event_private.mailbox_owner_pilot where singleton;
 insert into net._http_response(id,status_code,timed_out) values(job,200,false);
 blocked:=false;begin perform public.event_owner_mailbox_pilot('queue',v,'{}','00000000-0000-4000-8000-000000000222');exception when others then blocked:=true;end;assert blocked,'Polling bounded by interval';
 update event_private.mailbox_owner_pilot set last_queued_at=clock_timestamp()-interval '46 seconds' where singleton;
 perform public.event_owner_mailbox_pilot('queue',v,'{}','00000000-0000-4000-8000-000000000222');
 assert (select count(*)=2 from owner_pilot_http),'Next known polling cycle is distinct';
 perform public.event_owner_mailbox_pilot('queue',v,'{}','00000000-0000-4000-8000-000000000111');
 assert (select count(*)=2 from owner_pilot_http),'A delayed older request never creates another job';
 select to_jsonb(s) into old_capture from event_private.mailbox_sync_state s where singleton;
 update event_private.mailbox_sync_state set enabled=false,capture_send_ids=array[wrong_send] where singleton;
 update event_private.channel_credentials set enabled=false where provider='mailbox';
 blocked:=false;begin perform public.event_owner_mailbox_pilot('close',v);exception when others then blocked:=true;end;assert blocked,'Closing cannot overwrite another inactive scope';
 update event_private.mailbox_sync_state set enabled=true,capture_send_ids=array[b] where singleton;
 update event_private.channel_credentials set enabled=true where provider='mailbox';
 result:=public.event_owner_mailbox_pilot('close',v);v:=(result->>'version')::bigint;
 assert result->>'state'='closed' and result->>'captureEnabled'='false';
 assert (select cardinality(capture_send_ids)=0 and not enabled from event_private.mailbox_sync_state where singleton);
 assert (select revoked_at is not null from event_private.mailbox_reply_routes where id=(r->>'id')::uuid);
 assert (select status='accepted' and attempts=1 from public.event_outbox where id=b),'Closing preserves send history';
 assert public.event_email_owner_pilot_config()->>'state'='closed','Closed routing policy stays explicit';
 blocked:=false;begin perform public.event_owner_mailbox_pilot('open',v,array[p],null,true);exception when others then blocked:=true;end;assert blocked,'Already accepted proposal cannot open another send pilot';
 assert (select count(*)=2 from owner_pilot_http),'No extra polling or sending at closure';
end $$;
rollback;
