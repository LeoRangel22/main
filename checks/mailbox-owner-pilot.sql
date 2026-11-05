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
 assert (select cardinality(capture_send_ids)=0 and not enabled and capture_message_limit=4 from event_private.mailbox_sync_state where singleton),'Closure keeps a schema-valid bounded limit while removing the entire capture scope';
 assert (select revoked_at is not null from event_private.mailbox_reply_routes where id=(r->>'id')::uuid);
 assert (select status='accepted' and attempts=1 from public.event_outbox where id=b),'Closing preserves send history';
 assert public.event_email_owner_pilot_config()->>'state'='closed','Closed routing policy stays explicit';
 blocked:=false;begin perform public.event_owner_mailbox_pilot('open',v,array[p],null,true);exception when others then blocked:=true;end;assert blocked,'Already accepted proposal cannot open another send pilot';
 assert (select count(*)=2 from owner_pilot_http),'No extra polling or sending at closure';
end $$;

-- Regression: a draft revision inherits the opportunity's commercial sent status.
do $
declare actor uuid:=auth.uid(); owner_email text; opportunity uuid; sent_proposal uuid; draft_proposal uuid;
 template_send uuid; guarded_send uuid; version bigint; result jsonb; blocked boolean; email_state text;
begin
 select lower(email) into owner_email from auth.users where id=actor;
 select capture_send_ids[1] into template_send from event_private.mailbox_owner_pilot where singleton;
 assert template_send is not null;
 version:=(public.event_owner_mailbox_pilot('status')->>'version')::bigint;
 insert into public.oportunidades(cliente_nome,cliente_email,data_evento,status)
 values('Synthetic revision pilot',owner_email,'2099-12-02','proposta_enviada') returning id into opportunity;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,data_evento,horario_evento,convidados,duracao,
  subtotal,taxa_servico,privatizacao,total,status,publication_status,public_token_expires_at,snapshot,versao,is_current)
 values(opportunity,'[TESTE SEM VALOR COMERCIAL] QA-VENDA-02',owner_email,'2099-12-02','19:00',50,2,
  1000,120,0,1120,'proposta_enviada','sent',clock_timestamp()+interval '1 day','{"event":{},"totals":{"adjustment":0}}',1,true)
 returning id into sent_proposal;
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,data_evento,horario_evento,convidados,duracao,
  subtotal,taxa_servico,privatizacao,total,status,publication_status,public_token_expires_at,snapshot,versao,is_current)
 values(opportunity,'[TESTE SEM VALOR COMERCIAL] QA-VENDA-02',owner_email,'2099-12-02','19:00',80,2,
  1600,192,0,1792,'proposta_enviada','draft',clock_timestamp()+interval '1 day','{"event":{},"totals":{"adjustment":0}}',2,false)
 returning id into draft_proposal;
 blocked:=false;begin
  perform public.event_owner_mailbox_pilot('open',version,array[sent_proposal],null,true);
 exception when others then blocked:=SQLERRM='pilot_proposals_unverified';end;
 assert blocked,'A published version remains excluded even without an email outbox entry';
 insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,attempts,approved_by,reviewed_revision)
 select sent_proposal,opportunity,repeat(md5(sent_proposal::text),2),channel,destination,body,'accepted',1,approved_by,1
 from public.event_outbox where id=template_send;
 update public.propostas set status='rascunho' where id=draft_proposal;
 blocked:=false;begin
  perform public.event_owner_mailbox_pilot('open',version,array[draft_proposal],null,true);
 exception when others then blocked:=SQLERRM='pilot_proposals_unverified';end;
 assert blocked,'Commercial readiness restrictions remain enforced';
 update public.propostas set status='proposta_enviada' where id=draft_proposal;
 result:=public.event_owner_mailbox_pilot('open',version,array[draft_proposal],null,true);
 version:=(result->>'version')::bigint;
 assert result->>'state'='open' and result->>'captureEnabled'='false',
  'A new unsent draft is admitted despite an accepted older version in the same opportunity';
 assert result->'proposalIds'=jsonb_build_array(draft_proposal);
 assert (select status='proposta_enviada' and publication_status='draft' from public.propostas where id=draft_proposal),
  'Opening does not rewrite commercial status or publish the draft';
 result:=public.event_owner_mailbox_pilot('close',version);version:=(result->>'version')::bigint;
 assert result->>'state'='closed' and result->>'captureEnabled'='false';
 insert into public.event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,attempts,approved_by,reviewed_revision)
 select draft_proposal,opportunity,repeat(md5(draft_proposal::text),2),b.channel,b.destination,b.body,'sending',1,b.approved_by,q.revision
 from public.event_outbox b join public.propostas q on q.id=draft_proposal where b.id=template_send returning id into guarded_send;
 foreach email_state in array array['sending','uncertain','accepted'] loop
  update public.event_outbox set status=email_state where id=guarded_send;
  blocked:=false;begin
   perform public.event_owner_mailbox_pilot('open',version,array[draft_proposal],null,true);
  exception when others then blocked:=SQLERRM='pilot_proposals_unverified';end;
  assert blocked,'A draft with its own sending, uncertain or accepted email cannot reopen a send pilot';
 end loop;
 assert (select count(*)=2 from owner_pilot_http),'Admission tests queue no reads or emails';
 assert (select count(*)=1 from public.event_outbox where proposal_id=sent_proposal and status='accepted' and attempts=1),
  'The accepted earlier version is preserved';
 assert (select state='closed' from event_private.mailbox_owner_pilot where singleton);
 assert (select not enabled and cardinality(capture_send_ids)=0 from event_private.mailbox_sync_state where singleton);
end $;
rollback;
