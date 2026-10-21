-- Disposable local upgrade fixture. Intentionally includes a legacy enabled bridge.
-- No actual credential/contact values or external request are introduced.
create temp table deferred_upgrade_fixture(proposal_id uuid,opportunity_id uuid,approval_id uuid,bridge_before jsonb);
create temp table deferred_upgrade_rows(relation_name text primary key,rows_before jsonb);
create temp table deferred_upgrade_functions as
 select p.oid,p.proacl,p.proowner,p.prosecdef,p.pronamespace from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','event_private');
create temp table deferred_upgrade_tables as
 select c.oid,c.relacl,c.relowner,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','event_private') and c.relkind='r';
do $$
declare actor uuid;opp uuid;p public.propostas;a uuid:=gen_random_uuid();state_name text;table_name text;prior_bridge jsonb;snapshot jsonb;
begin
 select id into actor from auth.users order by id limit 1;
 select to_jsonb(s) into prior_bridge from event_private.bot_bridge_state s where singleton;
 insert into oportunidades(cliente_nome,status,data_evento) values('Deferred migration history fixture','proposta_pronta','2099-11-19') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,total,subtotal,taxa_servico,snapshot)
 values(opp,'Deferred migration history fixture','proposta_pronta','ready','2099-11-19',1120,1000,120,'{"historyMarker":"preserve-deferred-upgrade"}') returning * into p;
 insert into event_proposal_approvals(id,proposal_id,revision,proposal_fingerprint,review_hash,proposal_snapshot,content,requested_by,approver_id,approver_email,expires_at,request_fingerprint)
 values(a,p.id,p.revision,event_private.proposal_fingerprint(p),'synthetic-review-'||a,to_jsonb(p),'{"channel":"email","body":"Synthetic historical approval"}',actor,actor,'fixture@example.test',now()+interval '1 day','synthetic-request-'||a);
 insert into event_approval_notifications(approval_id,channel,status,provider_id,attempts) values(a,'email','accepted','synthetic-email-history',1),(a,'whatsapp','uncertain',null,1);
 foreach state_name in array array['accepted','failed','uncertain'] loop
  insert into event_outbox(proposal_id,opportunity_id,fingerprint,channel,destination,body,status,provider_id,approved_by)
  values(p.id,opp,'synthetic-history:'||a||':'||state_name,'email','fixture@example.test','Preserve '||state_name,state_name,case when state_name='accepted' then 'synthetic-accepted-history' end,actor);
  insert into event_approval_watch_alerts(approval_id,dedupe_key,kind,channel,status,attempts,provider_id)
  values(a,'synthetic-history:'||a||':'||state_name,'approval_waiting','email',state_name,1,case when state_name='accepted' then 'synthetic-watch-history' end);
 end loop;
 update event_private.bot_bridge_state set enabled=true,cursor=42,diagnostic='Synthetic legacy enabled history',last_success_at=now()-interval '1 day' where singleton;
 insert into deferred_upgrade_fixture values(p.id,opp,a,prior_bridge);
 foreach table_name in array array['public.propostas','public.oportunidades','public.event_outbox','public.event_proposal_approvals','public.event_approval_notifications','public.event_approval_watch_alerts','public.event_messages','public.event_commercial_policy','event_private.proposal_approval_policy','event_private.approval_watch_config','event_private.channel_credentials','event_private.bot_bridge_state'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %s t',table_name) into snapshot;
  insert into deferred_upgrade_rows values(table_name,snapshot);
 end loop;
end; $$;
