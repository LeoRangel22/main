-- Synthetic data only. Preparation must leave business rows and ledgers intact.
begin;
do $$
declare actor uuid;actor_email text;p public.propostas;opp uuid;plan jsonb;again jsonb;claim jsonb;before_state jsonb;
 expiry timestamptz:=date_trunc('milliseconds',now()+interval '1 hour');bad boolean;value text;review_fp text;scope uuid:=gen_random_uuid();envelope jsonb;send_uuid uuid;
 legacy uuid:=gen_random_uuid();manager uuid;manager_email text;approval_id uuid;response_at timestamptz;manager_approval public.event_proposal_approvals;
begin
 for actor,actor_email in select id,email from auth.users order by email loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
  exit when public.is_team_member() and not public.is_super_admin();
 end loop;
 assert public.is_team_member();
 assert not has_function_privilege('anon','public.event_whatsapp_preparation(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz)','execute');
 assert not has_function_privilege('authenticated','event_private.whatsapp_prepared_id(text)','execute');
 assert has_function_privilege('authenticated','public.event_whatsapp_preparation(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz)','execute');
 assert not has_function_privilege('anon','public.begin_event_prepared_whatsapp_send(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz,uuid,text)','execute');
 insert into oportunidades(cliente_nome,status,data_evento) values('Preparation fixture','proposta_pronta','2099-11-18') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,status,publication_status,is_current,snapshot)
 values(opp,'Preparation fixture','2099-11-18','10:00',20,2,1000,120,1120,'proposta_pronta','ready',true,
 '{"event":{"guests":20},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"name":"Fixture","calc":{"total":1000}}]}') returning * into p;
 before_state:=jsonb_build_object('proposal',to_jsonb(p),'outbox',(select count(*) from event_outbox),'messages',(select count(*) from event_messages),'audit',(select count(*) from event_approval_audit));
 set local role authenticated;
 plan:=event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);
 again:=event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);
 assert plan=again and plan->>'attempted'='false' and plan->>'claimable'='true';
 reset role;
 assert before_state=jsonb_build_object('proposal',(select to_jsonb(x) from propostas x where id=p.id),'outbox',(select count(*) from event_outbox),'messages',(select count(*) from event_messages),'audit',(select count(*) from event_approval_audit)),'Preparation is not a send, claim, contact or approval';
 assert (event_whatsapp_preparation(p.id,p.revision,'15550002222','Synthetic proposal body','Fixture',null,null,expiry)->>'id')<>plan->>'id';
 assert (event_whatsapp_preparation(p.id,p.revision,'15550001111','Different synthetic body','Fixture',null,null,expiry)->>'id')<>plan->>'id';
 foreach value in array array['552133334444','5215512345678','541112345678','549111512345678','2123456789'] loop
  assert not event_private.whatsapp_canonical(value);
 end loop;
 foreach value in array array['5521999999999','525512345678','5491112345678','14155550123','447700900001'] loop
  assert event_private.whatsapp_canonical(value);
 end loop;
 bad:=false;begin perform event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,now()-interval '1 minute');exception when others then bad:=true;end;assert bad,'Expired plan refused';
 bad:=false;begin perform event_whatsapp_preparation(p.id,p.revision+1,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);exception when others then bad:=true;end;assert bad,'Stale revision refused';
 update oportunidades set ultima_resposta_cliente_em=now() where id=opp;
 bad:=false;begin perform event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);exception when others then bad:=true;end;assert bad,'New response requires review';
 update oportunidades set ultima_resposta_cliente_em=null where id=opp;
 update event_private.proposal_approval_policy set enabled=true where id;
 bad:=false;begin perform event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);exception when others then bad:=true;end;assert bad,'Manager gate is not bypassed';
 update event_private.proposal_approval_policy set enabled=false where id;
 bad:=false;begin perform begin_event_prepared_whatsapp_send(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry,(plan->>'id')::uuid,'stale');exception when others then bad:=true;end;assert bad,'Atomic context check refuses stale preparation';
 assert not exists(select 1 from event_outbox where proposal_id=p.id);
 set local role authenticated;
 claim:=begin_event_prepared_whatsapp_send(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry,(plan->>'id')::uuid,plan->>'fingerprint');
 assert claim->>'claimed'='true' and claim#>>'{send,id}'=plan->>'id' and claim#>>'{send,attempts}'='1';
 assert (event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry)->>'claimable')='false';
 again:=begin_event_prepared_whatsapp_send(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry,(plan->>'id')::uuid,plan->>'fingerprint');
 assert again->>'claimed'='false' and again#>>'{send,attempts}'='1';
 reset role;
 perform finish_event_send((plan->>'id')::uuid,'uncertain',null,'Synthetic timeout');
 again:=event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);
 assert again->>'id'=plan->>'id' and again->>'claimable'='false' and again->>'existingStatus'='uncertain';
 assert exists(select 1 from event_messages where external_id='send:'||(plan->>'id') and delivery_status='uncertain'),'Uncertain attempt remains explicitly uncertain in audit history';
 assert (select ultimo_contato_em is null from oportunidades where id=opp),'Uncertain attempt must not update confirmed contact';
 assert (select sent_at is null from propostas where id=p.id),'Preparation and uncertainty never mark sent';
 insert into event_outbox(id,proposal_id,opportunity_id,fingerprint,channel,destination,body,approved_by,status,reviewed_revision,reviewed_fingerprint)
 values(legacy,p.id,opp,encode(extensions.digest(event_private.proposal_fingerprint(p)||'|whatsapp|15550001111|Legacy prepared body|Fixture','sha256'),'hex'),
  'whatsapp','15550001111','Legacy prepared body',actor,'uncertain',p.revision,event_private.public_proposal_fingerprint(p));
 again:=event_whatsapp_preparation(p.id,p.revision,'15550001111','Legacy prepared body','Fixture',null,null,expiry);
 assert (again->>'id')::uuid=legacy and again->>'claimable'='false','Historical random ID is preserved, never replaced to evade uncertainty';
 -- A different explicitly reviewed message uses its own identity. Acceptance,
 -- delivery and a quoted reply remain different events through the shared Bot.
 plan:=event_whatsapp_preparation(p.id,p.revision,'15550001111','Second synthetic proposal','Fixture',null,null,expiry);
 claim:=begin_event_prepared_whatsapp_send(p.id,p.revision,'15550001111','Second synthetic proposal','Fixture',null,null,expiry,(plan->>'id')::uuid,plan->>'fingerprint');
 send_uuid:=(plan->>'id')::uuid;
 perform finish_event_send(send_uuid,'accepted','synthetic-prepared-provider');
 assert (select status='accepted' and delivery_status is null from event_outbox where id=send_uuid),'Acceptance does not imply delivery';
 assert (select ultima_resposta_cliente_em is null from oportunidades where id=opp),'Acceptance does not imply reply';
 update event_private.bot_bridge_state set enabled=false,cursor=0,scope_id=scope where singleton;
 perform event_bot_bridge_activate('bot:embaixada_urca|'||scope::text,0);
 envelope:=jsonb_build_object('scope',scope,'events',jsonb_build_array(jsonb_build_object('key','prepared-delivery','channel','whatsapp','kind','status',
  'message_id','synthetic-prepared-provider','destination','15550001111','signal','delivered','occurred_at',now(),'captured_at',now(),
  'send_id',send_uuid,'context_id',p.id,'revision',p.revision,'purpose','event_proposal')));
 perform event_bot_bridge_commit('bot:embaixada_urca',0,1,envelope);
 perform event_bot_bridge_commit('bot:embaixada_urca',1,2,envelope);
 assert (select status='accepted' and delivery_status='delivered' from event_outbox where id=send_uuid);
 assert (select ultima_resposta_cliente_em is null from oportunidades where id=opp),'Delivery does not imply reply';
 envelope:=jsonb_build_object('scope',scope,'events',jsonb_build_array(jsonb_build_object('key','prepared-reply','channel','whatsapp','kind','inbound',
  'message_id','synthetic-prepared-reply','reply_to_id','synthetic-prepared-provider','destination','15550001111','body','Synthetic change request','occurred_at',clock_timestamp(),'captured_at',clock_timestamp(),
  'send_id',send_uuid,'context_id',p.id,'revision',p.revision,'purpose','event_proposal')));
 bad:=false;begin perform event_bot_bridge_commit('bot:embaixada_urca',2,3,jsonb_set(envelope,'{events,0,revision}',to_jsonb(p.revision+1)));exception when others then bad:=true;end;assert bad,'Wrong revision cannot attach a reply';
 bad:=false;begin perform event_bot_bridge_commit('bot:embaixada_urca',2,3,jsonb_set(envelope,'{events,0,destination}','"15550009999"'));exception when others then bad:=true;end;assert bad,'Wrong recipient cannot attach a reply';
 assert (select cursor=2 from event_private.bot_bridge_state where singleton),'Rejected page preserves cursor';
 perform event_bot_bridge_commit('bot:embaixada_urca',2,3,envelope);
 perform event_bot_bridge_commit('bot:embaixada_urca',3,4,envelope);
 assert (select count(*)=1 from event_messages where external_id='zapi:prepared-reply'),'Repeated quoted reply is idempotent';
 assert (select ultima_resposta_cliente_em is not null from oportunidades where id=opp),'Quoted reply reaches the opportunity';
 assert (select status not in ('confirmado','pagamento_final') from propostas where id=p.id),'Text reply never approves sale or payment';
 -- Positive manager path and immutable approval content, with synthetic decision.
 select * into p from propostas where id=p.id;
 select ultima_resposta_cliente_em into response_at from oportunidades where id=opp;
 for manager,manager_email in select id,email from auth.users order by email loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email',manager_email,'role','authenticated')::text,true);
  exit when public.is_super_admin();
 end loop;
 assert public.is_super_admin();
 update event_private.proposal_approval_policy set enabled=true,approver_id=manager,approver_email=manager_email,whatsapp='15550001111' where id;
 select * into manager_approval from event_create_proposal_approval(p.id,p.revision,actor,
  jsonb_build_object('channel','whatsapp','destination','15550001111','body','Manager reviewed body','message','Manager reviewed body','title','Fixture','contentHash',null,
   'reviewedResponseAt',response_at,'proposalUrl','https://leorangel22.github.io/main/proposta.html?p='||p.public_token));
 approval_id:=manager_approval.id;
 set local role authenticated;
 perform event_decide_proposal_approval(approval_id,'approve',manager_approval.review_hash,true,'');
 plan:=event_whatsapp_preparation(p.id,p.revision,'15550001111','Manager reviewed body','Fixture',response_at,approval_id,expiry);
 bad:=false;begin perform event_whatsapp_preparation(p.id,p.revision,'15550001111','Changed manager body','Fixture',response_at,approval_id,expiry);exception when others then bad:=true;end;assert bad,'Manager content cannot be substituted';
 claim:=begin_event_prepared_whatsapp_send(p.id,p.revision,'15550001111','Manager reviewed body','Fixture',response_at,approval_id,expiry,(plan->>'id')::uuid,plan->>'fingerprint');
 assert claim->>'claimed'='true' and (select send_id=(plan->>'id')::uuid from event_proposal_approvals where id=approval_id),'Explicit claim binds approval to the prepared ID';
 reset role;
 perform set_config('request.jwt.claims','{}',true);
 bad:=false;begin perform event_whatsapp_preparation(p.id,p.revision,'15550001111','Synthetic proposal body','Fixture',null,null,expiry);exception when others then bad:=true;end;assert bad,'Anonymous identity denied even with privileged SQL caller';
end; $$;
rollback;
