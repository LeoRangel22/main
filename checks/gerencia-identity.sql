-- Synthetic account binding only. No user creation or grant in production.
begin;
do $$
declare candidate auth.users; manager auth.users; finance auth.users; seller auth.users; outsider auth.users;
 opp uuid; p public.propostas; h public.event_handoffs; cfg jsonb; evidence jsonb; before_proposal jsonb;
 current_version integer; fingerprint text; historical_signed_at timestamptz; failed boolean; role_name text; signature_count integer; outbox_count integer;
begin
 for candidate in select * from auth.users loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.id,'email',candidate.email,'role','authenticated')::text,true);
  if public.is_super_admin() then manager:=candidate;
  elsif event_private.journey_financial_operator() then finance:=candidate;
  elsif public.is_team_member() then seller:=candidate;end if;
 end loop;
 assert manager.id is not null and finance.id is not null and seller.id is not null;
 perform set_config('request.jwt.claims','',true);
 assert (select not enabled from event_private.operation_contact_config where id);
 assert (select user_id is null and expected_email is null and not retired from event_private.operation_gerencia_identity where singleton);
 assert not exists(select 1 from event_private.operation_gerencia_identity_audit);
 foreach role_name in array array['anon','authenticated','service_role'] loop
  assert not has_table_privilege(role_name,'event_private.operation_gerencia_identity','SELECT,INSERT,UPDATE,DELETE');
  assert not has_table_privilege(role_name,'event_private.operation_gerencia_identity_audit','SELECT,INSERT,UPDATE,DELETE');
  assert not has_function_privilege(role_name,'event_private.configure_gerencia_identity(integer,uuid,text,boolean)','execute');
  assert not has_function_privilege(role_name,'event_private.gerencia_can_sign()','execute');
  assert not has_function_privilege(role_name,'event_private.gerencia_team_emails()','execute');
 end loop;
 assert (select relrowsecurity from pg_class where oid='event_private.operation_gerencia_identity'::regclass);
 assert (select relrowsecurity from pg_class where oid='event_private.operation_gerencia_identity_audit'::regclass);
 current_version:=(select version from event_private.operation_contact_config where id);
 insert into auth.users(email,email_confirmed_at,raw_user_meta_data) values('gerencia-extra@example.test',clock_timestamp(),'{"role":"gerencia","master":true}') returning * into outsider;
 failed:=false;begin perform event_private.configure_gerencia_identity(current_version,outsider.id,outsider.email,true);exception when others then failed:=true;end;assert failed,'Verified outsider cannot appear configured as a signer';
 assert (select user_id is null from event_private.operation_gerencia_identity where singleton);
 failed:=false;begin perform event_private.configure_gerencia_identity(current_version,seller.id,seller.email,false);exception when others then failed:=true;end;assert failed;
 failed:=false;begin perform event_private.configure_gerencia_identity(current_version,seller.id,seller.email,true);exception when others then failed:=true;end;assert failed,'Unverified account cannot receive authority';
 update auth.users set email_confirmed_at=clock_timestamp() where id=seller.id;
 failed:=false;begin perform event_private.configure_gerencia_identity(current_version,seller.id,'wrong@example.test',true);exception when others then failed:=true;end;assert failed;
 cfg:=event_private.configure_gerencia_identity(current_version,seller.id,seller.email,true);assert cfg->>'changed'='true';
 assert (select not enabled from event_private.operation_contact_config where id),'Identity assignment must not activate obligations';
 assert (select bool_and(email is null and whatsapp is null) from event_private.operation_contacts),'Binding is separate from contacts';
 failed:=false;begin perform event_private.configure_gerencia_identity(current_version,null,null,true);exception when sqlstate 'PT409' then failed:=true;end;assert failed;
 current_version:=(cfg->>'version')::integer;
 cfg:=event_private.configure_gerencia_identity(current_version,seller.id,seller.email,true);assert cfg->>'changed'='false';assert (select count(*)=1 from event_private.operation_gerencia_identity_audit);
 -- Owner-only fixture represents an incomplete legacy agreement, not an API
 -- confirmation or reservation. All signing below still uses real team claims.
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Gerencia identity fixture','confirmado') returning id into opp;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(opp,'Gerencia identity fixture','confirmado','ready',true,20,2,1000,120,1120,
 '{"event":{"guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning * into p;
 select * into h from event_handoffs where opportunity_id=opp;
 before_proposal:=to_jsonb(p);outbox_count:=(select count(*) from event_outbox);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller.id,'email',seller.email,'role','authenticated')::text,true);
 set local role authenticated;
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,repeat('0',64),'gerencia',true);exception when others then failed:=true;end;assert failed,'Policy OFF still refuses signing';
 failed:=false;begin perform event_private.configure_gerencia_identity(current_version,seller.id,seller.email,true);exception when insufficient_privilege then failed:=true;end;assert failed;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager.id,'email',manager.email,'role','authenticated')::text,true);
 set local role authenticated;
 cfg:=configure_event_operational_contacts(current_version,'[{"role":"financeiro","email":null,"whatsapp":null},{"role":"gerencia","email":null,"whatsapp":null},{"role":"salao","email":null,"whatsapp":null},{"role":"eventos","email":null,"whatsapp":null}]',true);
 evidence:=event_operation_readiness(p.id,p.revision);fingerprint:=evidence->'operational_signoffs'->>'review_fingerprint';
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,fingerprint,'gerencia',true);exception when insufficient_privilege then failed:=true;end;assert failed,'Master is not an automatic substitute';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider.id,'email',outsider.email,'role','authenticated','user_metadata',outsider.raw_user_meta_data)::text,true);
 set local role authenticated;
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,fingerprint,'gerencia',true);exception when sqlstate 'P0001' then if sqlerrm='Acesso exclusivo da equipe' then failed:=true;else raise;end if;end;assert failed,'Outside account remains rejected by existing team boundary';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller.id,'email',seller.email,'role','authenticated')::text,true);
 set local role authenticated;
 evidence:=event_operation_readiness(p.id,p.revision);
 assert evidence->'operational_signoffs'->'roles'->1->>'can_sign'='true';assert evidence->'operational_signoffs'->'roles'->1->>'identity_pending'='false';
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,fingerprint,'financeiro',true);exception when insufficient_privilege then failed:=true;end;assert failed,'Gerencia does not acquire Financeiro';
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,fingerprint,'salao',true);exception when insufficient_privilege then failed:=true;end;assert failed;
 failed:=false;begin perform sign_event_operation(p.id,p.revision+1,h.version,fingerprint,'gerencia',true);exception when sqlstate 'PT409' then failed:=true;end;assert failed;
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version+1,fingerprint,'gerencia',true);exception when sqlstate 'PT409' then failed:=true;end;assert failed;
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,repeat('0',64),'gerencia',true);exception when sqlstate 'PT409' then failed:=true;end;assert failed;
 failed:=false;begin perform sign_event_operation(p.id,p.revision,h.version,fingerprint,'gerencia',false);exception when others then failed:=true;end;assert failed;
 evidence:=sign_event_operation(p.id,p.revision,h.version,fingerprint,'gerencia',true);assert evidence->'operational_signoffs'->'roles'->1->>'signed'='true';assert evidence->>'ready'='false','Signature does not invent signal/reservation/capacity or finance';
 evidence:=sign_event_operation(p.id,p.revision,h.version,fingerprint,'gerencia',true);
 reset role;
 assert (select count(*)=1 and bool_and(signed_by=seller.id) from event_private.operation_signoffs where proposal_id=p.id and role='gerencia');
 select s.signed_at into historical_signed_at from event_private.operation_signoffs s where proposal_id=p.id and role='gerencia';
 assert (select to_jsonb(x)=before_proposal from propostas x where id=p.id);assert outbox_count=(select count(*) from event_outbox);
 update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=seller.id;
 assert not event_private.gerencia_can_sign();
 update auth.users set banned_until=null,email='changed-identity@example.test' where id=seller.id;
 assert not event_private.gerencia_can_sign();update auth.users set email=seller.email where id=seller.id;
 current_version:=(select version from event_private.operation_contact_config where id);
 perform event_private.configure_gerencia_identity(current_version,null,null,true);
 assert not event_private.gerencia_can_sign();
 assert (select count(*)=1 and bool_and(s.signed_at=historical_signed_at and signed_by=seller.id) from event_private.operation_signoffs s where proposal_id=p.id and role='gerencia'),'Historical authorship preserved on revoke';
 evidence:=event_private.operation_signoff_evidence(p);assert evidence->'roles'->1->>'signed'='false';assert evidence->'roles'->1->>'identity_pending'='true';
 assert (select count(*)=2 from event_private.operation_gerencia_identity_audit);
end $$;
rollback;
