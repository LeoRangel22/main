-- Isolated synthetic fixtures. All changes roll back; no provider/network calls.
begin;
create function pg_temp.tariff_request(s jsonb,v integer default null) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('schema',1,'kind','request','mode','use_current_table','requestId',gen_random_uuid(),
  'eventDate',s#>>'{event,date}','validUntil',event_private.tariff_valid_until(s->>'generalTerms')::text,
  'catalogVersion',v,'reviewedBasis',event_private.tariff_application_basis(s));
$$;
create function pg_temp.tariff_enqueue(p public.propostas) returns text
language plpgsql security definer set search_path='' as $$
declare inserted_id uuid;
begin
 insert into public.event_outbox(opportunity_id,proposal_id,fingerprint,channel,destination,body,status,approved_by)
 values(p.oportunidade_id,p.id,gen_random_uuid()::text,'email','tariff@example.test','Isolated tariff fixture','sending',auth.uid()) returning event_outbox.id into inserted_id;
 delete from public.event_outbox b where b.id=inserted_id;
 return 'allowed';
exception when others then return sqlstate||':'||sqlerrm;
end; $$;
do $$
declare u record; actor uuid; actor_email text; other_actor uuid; other_email text;
 opp uuid; other_opp uuid; p public.propostas; prior public.propostas; versioned public.propostas; copied public.propostas;
 snap jsonb; request jsonb; invalid jsonb; proof jsonb; original_proof jsonb; projection jsonb; changes jsonb;
 blocked boolean; outcome text; part text; v integer; saved_revision bigint;
begin
 -- Derive authority from the existing bootstrap fixture, not a new real email literal.
 for u in select id,email from auth.users order by id loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text,true);
  if public.is_super_admin() then actor:=u.id; actor_email:=u.email;
  elsif public.is_team_member() then other_actor:=u.id; other_email:=u.email; end if;
 end loop;
 assert actor is not null and other_actor is not null,'Existing isolated team fixtures are required';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 assert event_private.tariff_valid_until('VALIDADE: até o dia 31/12/2026.')='2026-12-31';
 assert event_private.tariff_valid_until('validade: eventos até 29/02/2028')='2028-02-29';
 assert event_private.tariff_valid_until('VALIDADE: até 31/02/2026') is null;
 assert event_private.tariff_valid_until('Sem prazo explícito') is null;
 assert not has_table_privilege('authenticated','event_private.tariff_applications','select');
 assert not has_table_privilege('service_role','event_private.tariff_applications','insert');
 assert not has_function_privilege('anon','event_private.guard_tariff_application()','execute');
 assert not has_function_privilege('authenticated','event_private.tariff_application_valid(public.propostas)','execute');
 assert not has_function_privilege('service_role','event_private.public_tariff_application(public.propostas)','execute');
 assert (select relrowsecurity from pg_class where oid='event_private.tariff_applications'::regclass);
 insert into public.oportunidades(cliente_nome,status,data_evento) values('Future tariff fixture','negociacao','2099-04-20') returning id into opp;
 snap:=jsonb_build_object('client',jsonb_build_object('name','Tariff fixture','email','tariff@example.test'),
  'event',jsonb_build_object('date','2099-04-20','time','10:00','guests',20,'duration',2),
  'prices','[{"id":"fixture-a","formula":"por_pessoa","preco1h":50},{"id":"fixture-b","precoFixo":100}]'::jsonb,
  'privatizationRules','[{"day":"Monday","minimo":1000}]'::jsonb,
  'selectedItems','[{"id":"fixture-a","formula":"por_pessoa","preco1h":50,"qty":20,"calc":{"total":1000}}]'::jsonb,
  'generalTerms','VALIDADE: exclusivamente para eventos até 31/12/2026.',
  'totals','{"subtotal":1000,"serviceFee":120,"privatizationAmount":0,"adjustment":0,"total":1120}'::jsonb);
 assert event_private.tariff_application_basis(snap)->'selectedPrices'='[{"id":"fixture-a","formula":"por_pessoa","preco1h":50,"preco2h":null,"precoMeiaHoraExtra":null,"precoFixo":null,"valorAdicional":null,"minimo":null}]'::jsonb,
  'Unit-rate projection uses exact keys and explicit nulls, not quantities/calculated totals';
 set local role authenticated;
 select * into p from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',opp,
  'cliente_nome','Tariff fixture','cliente_email','tariff@example.test','status','negociacao','publication_status','ready',
  'data_evento','2099-04-20','horario_evento','10:00','convidados',20,'duracao',2,
  'subtotal',1000,'taxa_servico',120,'total',1120,'snapshot',snap),null,null);
 reset role;
 assert pg_temp.tariff_enqueue(p) like '%vigência%','Missing future tariff confirmation is blocked';
 -- False, malformed, client-authored proof and copied audit metadata are never authority.
 for invalid in select x from jsonb_array_elements('[false,true,"confirmed",{}, {"schema":1,"kind":"confirmed","mode":"use_current_table","confirmedBy":"00000000-0000-0000-0000-000000000000"}]') x loop
  select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(snap,'{event,tariffApplication}',invalid)),p.revision,null);
  assert p.snapshot#>'{event,tariffApplication}' is null;
  assert pg_temp.tariff_enqueue(p) like '%vigência%';
 end loop;
 request:=pg_temp.tariff_request(snap,7);
 -- Strict schema, UUID, date, basis and integer-version contract.
 for invalid in select x from jsonb_array_elements(jsonb_build_array(
   request-'catalogVersion',request||'{"schema":"1"}',request||'{"mode":"automatic"}',request||'{"extra":true}',
   request||'{"requestId":"not-a-uuid"}',request||'{"eventDate":"2099-04-21"}',request||'{"validUntil":"2027-12-31"}',
   request||'{"catalogVersion":"7"}',request||'{"catalogVersion":1.5}',request||'{"reviewedBasis":{}}',
   jsonb_set(request,'{reviewedBasis,selectedPrices,0,preco1h}','51'),
   jsonb_set(request,'{reviewedBasis,generalTerms}','"VALIDADE: até 31/12/2027."'),
   jsonb_set(request,'{reviewedBasis,prices}','[]'),jsonb_set(request,'{reviewedBasis,privatizationRules}','[]'))) x loop
  blocked:=false;
  begin perform public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(snap,'{event,tariffApplication}',invalid)),p.revision,null);
  exception when sqlstate 'PT409' then blocked:=true;end;
  assert blocked,'Malformed or stale request must fail with a recoverable conflict';
 end loop;
 blocked:=false;
 begin perform public.save_event_proposal(p.id,jsonb_build_object('data_evento','2099-04-21','snapshot',jsonb_set(snap,'{event,tariffApplication}',request)),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'Database date must equal reviewed event date';
 -- Worker/service credentials without a real authenticated actor cannot self-confirm.
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 set local role service_role;
 blocked:=false;
 begin update public.propostas set snapshot=jsonb_set(snap,'{event,tariffApplication}',request) where id=p.id;
 exception when others then blocked:=true;end;
 reset role;
 assert blocked and not exists(select 1 from event_private.tariff_applications where proposal_id=p.id);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 -- A JWT naming an allowed email without a real matching actor cannot mint proof.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'email',actor_email,'role','authenticated')::text,true);
 blocked:=false;
 begin perform public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(snap,'{event,tariffApplication}',request)),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'A real existing actor is mandatory, not just an allowed email claim';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 -- A mismatched catalog version is honestly labeled frozen proposal_snapshot, not latest.
 insert into public.commercial_settings(config_key,value,version) values('catalog','[{"id":"different-current"}]',7)
 on conflict(config_key) do update set value=excluded.value,version=excluded.version;
 set local role authenticated;
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(snap,'{event,tariffApplication}',request)),p.revision,null);
 reset role;
 proof:=p.snapshot#>'{event,tariffApplication}'; original_proof:=proof;
 assert proof->>'kind'='confirmed' and proof->>'confirmedBy'=actor::text and (proof->>'confirmedAt')::timestamptz<=clock_timestamp();
 assert proof->>'proposalId'=p.id::text and proof->>'requestId'=request->>'requestId';
 assert proof#>>'{catalog,source}'='proposal_snapshot' and proof#>'{catalog,version}'='null';
 assert proof->>'basisHash'=encode(extensions.digest(event_private.tariff_application_basis(snap)::text,'sha256'),'hex');
 assert proof#>>'{catalog,reference}'=encode(extensions.digest((snap->'prices')::text,'sha256'),'hex');
 assert not proof ? 'reviewedBasis' and event_private.tariff_application_valid(p);
 assert p.snapshot#-'{event,tariffApplication}'=snap,'Server does not change dates, rates, rules, totals or terms';
 outcome:=pg_temp.tariff_enqueue(p); assert outcome='allowed','Explicit valid confirmation permits the outbox: '||outcome;
 -- Same request/actor is retry-safe and keeps the original stamp exactly.
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(snap,'{event,tariffApplication}',request)),p.revision,null);
 assert p.snapshot#>'{event,tariffApplication}'=proof;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'email',other_email,'role','authenticated')::text,true);
 blocked:=false;
 begin perform public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(snap,'{event,tariffApplication}',request)),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'Another actor must not receive a false own-confirmation stamp by replay';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 -- Customer output is explicitly sanitized and original terms remain visible.
 select snapshot into projection from public.get_public_proposal(p.public_token);
 assert projection#>>'{event,tariffApplication,mode}'='use_current_table';
 assert projection#>>'{event,date}'=p.data_evento::text;
 assert projection#>>'{event,tariffApplication,validUntil}'='2026-12-31';
 assert projection->'generalTerms'=snap->'generalTerms';
 assert not (projection#>'{event,tariffApplication}') ?| array['confirmedBy','confirmedAt','requestId','proposalId','basisHash','reviewedBasis'];
 perform set_config('request.jwt.claims','{"email":"tariff@example.test","role":"authenticated"}',true);
 select snapshot into projection from public.get_my_event_history() where proposal_id=p.id;
 assert projection#>>'{event,tariffApplication,mode}'='use_current_table';
 assert projection#>>'{event,date}'=p.data_evento::text;
 assert not (projection#>'{event,tariffApplication}') ?| array['confirmedBy','confirmedAt','requestId','proposalId','basisHash','reviewedBasis'];
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 -- Normal history, notes, quantities/totals and audited payment patches preserve proof.
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"internalComments":[{"text":"fixture history"}]}'),p.revision,null);
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,notes}','"ordinary note"')),p.revision,null);
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{selectedItems,0,qty}','25')),p.revision,null);
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||jsonb_build_object('pagamentoSinal',jsonb_build_object('valor',560,'data',current_date::text,'bancos',jsonb_build_array('fixture-bank'),'bankConferido',true))),p.revision,null);
 assert p.snapshot#>'{event,tariffApplication}'=proof and event_private.tariff_application_valid(p),'Routine history/payment patches preserve exact actor/time';
 -- Unit rates, full catalog (including unselected rows), rules and terms invalidate.
 for part in select unnest(array['rate','catalog','rules','terms','order']) loop
  prior:=p;
  invalid:=case part when 'rate' then jsonb_set(p.snapshot,'{selectedItems,0,preco1h}','51')
   when 'catalog' then jsonb_set(p.snapshot,'{prices,1,precoFixo}','101')
   when 'rules' then jsonb_set(p.snapshot,'{privatizationRules,0,minimo}','1001')
   when 'terms' then jsonb_set(p.snapshot,'{generalTerms}','"VALIDADE: até 31/12/2026. Condição alterada."')
   else jsonb_set(p.snapshot,'{prices}',jsonb_build_array(p.snapshot#>'{prices,1}',p.snapshot#>'{prices,0}')) end;
  select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',invalid),p.revision,null);
  assert p.snapshot#>'{event,tariffApplication}' is null and not event_private.tariff_application_valid(p),part||' must invalidate proof';
  assert pg_temp.tariff_enqueue(p) like '%vigência%';
  -- Restoring prior data and prior proof cannot resurrect consumed consent.
  select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',prior.snapshot),p.revision,null);
  assert p.snapshot#>'{event,tariffApplication}' is null;
  request:=pg_temp.tariff_request(p.snapshot);
  select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,tariffApplication}',request)),p.revision,null);
  proof:=p.snapshot#>'{event,tariffApplication}';
 end loop;
 prior:=p;
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('data_evento','2099-04-21','snapshot',jsonb_set(p.snapshot,'{event,date}','"2099-04-21"')),p.revision,null);
 assert p.snapshot#>'{event,tariffApplication}' is null;
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('data_evento','2099-04-20','snapshot',prior.snapshot),p.revision,null);
 assert p.snapshot#>'{event,tariffApplication}' is null and pg_temp.tariff_enqueue(p) like '%vigência%';
 blocked:=false;
 begin perform public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,tariffApplication}',request)),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'Consumed request cannot be resurrected after date away/back';
 -- Historical catalog matching the exact saved list has honest version provenance.
 insert into public.commercial_settings_history(config_key,value,version) values('catalog',snap->'prices',6)
 on conflict(config_key,version) do update set value=excluded.value;
 request:=pg_temp.tariff_request(p.snapshot,6);
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,tariffApplication}',request)),p.revision,null);
 proof:=p.snapshot#>'{event,tariffApplication}';
 assert proof#>>'{catalog,source}'='shared_catalog' and proof#>>'{catalog,version}'='6';
 -- A true new version in this opportunity carries original actor/time, rebinding ID.
 changes:=jsonb_build_object('oportunidade_id',opp,'cliente_nome','Tariff version fixture','cliente_email','tariff@example.test',
  'status','negociacao','publication_status','draft','is_current',false,'data_evento',p.data_evento,'snapshot',p.snapshot);
 select * into versioned from public.save_event_proposal(null,changes,p.revision,p.id);
 assert versioned.id<>p.id and versioned.versao>p.versao;
 assert versioned.snapshot#>>'{event,tariffApplication,proposalId}'=versioned.id::text;
 assert (versioned.snapshot#>'{event,tariffApplication}')-'proposalId'=proof-'proposalId';
 assert event_private.tariff_application_valid(versioned);
 insert into public.oportunidades(cliente_nome,status) values('Tariff copy fixture','negociacao') returning id into other_opp;
 changes:=changes||jsonb_build_object('oportunidade_id',other_opp,'is_current',true,'publication_status','ready');
 select * into copied from public.save_event_proposal(null,changes,null,null);
 assert copied.snapshot#>'{event,tariffApplication}' is null and not event_private.tariff_application_valid(copied),'New opportunity must never inherit consent';
 assert pg_temp.tariff_enqueue(copied) like '%vigência%';
 -- A fabricated confirmed proof cannot alter actor/time/hash on an existing row.
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,tariffApplication,confirmedBy}',to_jsonb(other_actor))),p.revision,null);
 assert p.snapshot#>'{event,tariffApplication}' is null and not event_private.tariff_application_valid(p);
 -- Within-validity and undated/invalid legacy terms retain previous behavior.
 select * into copied from public.save_event_proposal(copied.id,jsonb_build_object('snapshot',jsonb_set(copied.snapshot,'{generalTerms}','"VALIDADE: até 31/12/2099."')),copied.revision,null);
 assert pg_temp.tariff_enqueue(copied)='allowed';
 blocked:=false;
 begin perform public.save_event_proposal(copied.id,jsonb_build_object('snapshot',jsonb_set(copied.snapshot,'{event,tariffApplication}',pg_temp.tariff_request(copied.snapshot))),copied.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'No beyond-validity confirmation is invented for an already-valid table';
 for invalid in select x from jsonb_array_elements('["Condições sem prazo explícito","VALIDADE: até 31/02/2026"]') x loop
  select * into copied from public.save_event_proposal(copied.id,jsonb_build_object('snapshot',jsonb_set(copied.snapshot,'{generalTerms}',invalid)),copied.revision,null);
  assert pg_temp.tariff_enqueue(copied)='allowed';
 end loop;
 -- Existing approved-manager and optimistic-revision gates remain authoritative.
 request:=pg_temp.tariff_request(p.snapshot);
 select * into p from public.save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,tariffApplication}',request)),p.revision,null);
 update event_private.proposal_approval_policy set enabled=true,approver_id=actor,approver_email=actor_email where id;
 blocked:=false;
 begin perform public.begin_event_send_reviewed(p.id,p.revision,'email','tariff@example.test','Fixture','Fixture',null);
 exception when others then blocked:=true;end;
 assert blocked and not exists(select 1 from public.event_outbox where proposal_id=p.id),'Tariff confirmation never bypasses manager approval';
 update event_private.proposal_approval_policy set enabled=false where id;
 blocked:=false;
 begin perform public.begin_event_send_reviewed(p.id,p.revision-1,'email','tariff@example.test','Fixture','Fixture',null);
 exception when others then blocked:=position('proposta mudou' in lower(sqlerrm))>0;end;
 assert blocked,'Existing stale revision protection is unchanged';
end $$;
-- INSERT proof, submitted-amendment freeze, and exact accepted-amendment application.
do $$
declare u record; actor uuid; actor_email text; opp uuid; base public.propostas; draft public.propostas;
 snap jsonb; request jsonb; base_proof jsonb; draft_proof jsonb; a jsonb; aid uuid; token uuid; evidence jsonb; blocked boolean; result jsonb;
begin
 for u in select id,email from auth.users loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text,true);
  if public.is_super_admin() then actor:=u.id;actor_email:=u.email;exit;end if;
 end loop;
 assert actor is not null;
 insert into public.oportunidades(cliente_nome,status,data_evento) values('Tariff amendment fixture','negociacao','2100-05-15') returning id into opp;
 snap:=jsonb_build_object('event',jsonb_build_object('date','2100-05-15','time','10:00','guests',20,'duration',2),
  'prices','[{"id":"amendment-item","formula":"fixo","precoFixo":1000}]'::jsonb,
  'privatizationRules','[]'::jsonb,'selectedItems','[{"id":"amendment-item","formula":"fixo","precoFixo":1000,"calc":{"total":1000}}]'::jsonb,
  'generalTerms','VALIDADE: até 31/12/2026.',
  'totals','{"subtotal":1000,"serviceFee":120,"privatizationAmount":0,"adjustment":0,"total":1120}'::jsonb,
  'pagamentoSinal',jsonb_build_object('valor',560,'data',current_date::text,'bancos',jsonb_build_array('fixture-bank'),'bankConferido',true));
 update public.commercial_settings set value=snap->'prices',version=8 where config_key='catalog';
 request:=pg_temp.tariff_request(snap,8);
 snap:=jsonb_set(snap,'{event,tariffApplication}',request);
 set local role authenticated;
 select * into base from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',opp,'cliente_nome','Tariff amendment fixture',
  'cliente_email','tariff-amendment@example.test','status','confirmado','publication_status','ready','data_evento','2100-05-15',
  'horario_evento','10:00','convidados',20,'duracao',2,'subtotal',1000,'taxa_servico',120,'total',1120,'snapshot',snap),null,null);
 reset role;
 base_proof:=base.snapshot#>'{event,tariffApplication}';
 assert event_private.tariff_application_valid(base) and base_proof#>>'{catalog,source}'='shared_catalog'
  and base_proof#>>'{catalog,version}'='8','Explicit INSERT uses exact current catalog provenance';
 assert (base_proof->>'confirmedAt')::timestamptz<=clock_timestamp() and base_proof->>'confirmedBy'=actor::text;
 snap:=(base.snapshot-'pagamentoSinal')||jsonb_build_object('amendmentOf',jsonb_build_object('id',base.id,'revision',base.revision));
 snap:=jsonb_set(snap#-'{event,tariffApplication}','{event,date}','"2100-05-16"');
 request:=pg_temp.tariff_request(snap,8);
 select * into draft from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',opp,'cliente_nome','Tariff amendment fixture',
  'cliente_email','tariff-amendment@example.test','status','negociacao','publication_status','draft','is_current',false,'data_evento','2100-05-16',
  'horario_evento','10:00','convidados',20,'duracao',2,'subtotal',1000,'taxa_servico',120,'total',1120,
  'snapshot',jsonb_set(snap,'{event,tariffApplication}',request)),base.revision,base.id);
 draft_proof:=draft.snapshot#>'{event,tariffApplication}';
 assert event_private.tariff_application_valid(draft) and draft_proof->>'requestId'<>base_proof->>'requestId';
 a:=public.request_event_amendment(draft.id,draft.revision,'Remarcação explicitamente revista com aplicação da tabela preservada.');aid:=(a->>'id')::uuid;
 blocked:=false;
 begin perform public.save_event_proposal(draft.id,jsonb_build_object('snapshot',jsonb_set(draft.snapshot,'{event,tariffApplication}',pg_temp.tariff_request(draft.snapshot,8))),draft.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'A submitted amendment cannot use a new confirmation to bypass the freeze';
 perform public.decide_event_amendment(aid,'approve','pending_manager','Revisão sintética das condições e data.');
 select client_token into token from event_private.event_amendments where id=aid;
 perform set_config('request.jwt.claims','',true);
 evidence:=public.get_public_event_amendment(token);
 perform public.respond_public_event_amendment(token,evidence->>'hash','accept','Tariff client fixture','',gen_random_uuid());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 result:=public.apply_event_amendment(aid,base.revision,draft.revision,'');
 assert result->>'status'='applied';
 select p.* into draft from public.propostas p where p.id=draft.id;
 assert draft.snapshot#>'{event,tariffApplication}'=draft_proof and event_private.tariff_application_valid(draft),
  'Accepted amendment application preserves exact reviewed proof and transaction-local final-row safeguards';
 assert (select p.snapshot#>'{event,tariffApplication}'=base_proof from public.propostas p where p.id=base.id),
  'The original agreement retains its own audited tariff proof';
 assert not exists(select 1 from event_private.amendment_apply_context),'No amendment bypass context remains';
end $$;
-- Rollback fixtures still explicitly validate deferred provenance foreign keys.
set constraints all immediate;
rollback;
