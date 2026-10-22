-- Synthetic fixtures only. Run on the disposable test database; no contact/provider calls.
begin;
set local session_replication_role=replica;
do $$
declare
  token uuid; rid uuid; oid uuid; actor uuid; p public.propostas; updated public.propostas;
  snap jsonb := '{"cliente":{"nome":"Attribution fixture","email":"attribution@example.test","idioma":" EN "},"evento":{"tipo":"Coquetel","convidados":20}}';
  attr jsonb := '{"version":1,"utm_source":"embaixadacarioca","utm_medium":"website","utm_campaign":"eventos","utm_content":"index_en"}';
  other jsonb; invalid jsonb; content text; before_snapshot jsonb;
begin
  -- Every supported entry point; exact shape and typed version are required.
  foreach content in array array['index','index_en','index_es','eventos','eventos-corporativos','en-eventos-corporativos','es-eventos-corporativos','contato','en-contato','es-contato','formulario'] loop
    token:=gen_random_uuid(); other:=jsonb_set(attr,'{utm_content}',to_jsonb(content));
    select request_id,opportunity_id into rid,oid from public.submit_public_quote_request(token,snap||jsonb_build_object('attribution',other));
    assert (select snapshot->'attribution'=other and snapshot#>>'{cliente,idioma}'='en' from public.solicitacoes_cotacao where id=rid),'Whitelist/language';
    assert (select metadata->'attribution'=other from public.oportunidades where id=oid),'Opportunity mirror';
  end loop;
  foreach invalid in array array['null'::jsonb,'[]'::jsonb,'"text"'::jsonb,'{}'::jsonb,
    attr-'utm_source',attr||'{"version":"1"}',attr||'{"version":2}',attr||'{"utm_content":"https://example.test"}',
    attr||'{"utm_source":"forged"}',attr||'{"utm_medium":"email"}',attr||'{"utm_campaign":"other"}',
    attr||'{"referrer":"https://example.test/private"}',attr||'{"utm_content":null}'] loop
    token:=gen_random_uuid();
    select request_id,opportunity_id into rid,oid from public.upsert_public_quote_draft(token,
      jsonb_set(snap,'{cliente,idioma}','"unknown"')||jsonb_build_object('attribution',invalid),'essencial');
    assert (select not(snapshot?'attribution') and snapshot#>>'{cliente,idioma}'='pt' from public.solicitacoes_cotacao where id=rid),'Invalid attribution must be stripped / PT fallback';
    assert (select not(metadata?'attribution') from public.oportunidades where id=oid),'Invalid attribution cannot claim website';
  end loop;
  token:=gen_random_uuid();
  select request_id,opportunity_id into rid,oid from public.upsert_public_quote_draft(token,snap,'essencial');
  update public.oportunidades set metadata=metadata||'{"unrelated":{"keep":true}}' where id=oid;
  perform public.upsert_public_quote_draft(token,snap||jsonb_build_object('attribution',attr),'evento');
  other:=jsonb_set(attr,'{utm_content}','"contato"');
  perform public.upsert_public_quote_draft(token,snap||jsonb_build_object('attribution',other),'evento');
  perform public.submit_public_quote_request(token,snap||jsonb_build_object('attribution',other));
  assert (select snapshot->'attribution'=attr from public.solicitacoes_cotacao where id=rid),'FIRST valid attribution survives draft and submit';
  assert (select metadata->'attribution'=attr and metadata#>>'{unrelated,keep}'='true' from public.oportunidades where id=oid),'Mirror preserves unrelated metadata';
  select snapshot into before_snapshot from public.solicitacoes_cotacao where id=rid;
  perform public.submit_public_quote_request(token,snap);
  perform public.upsert_public_quote_draft(token,snap,'essencial');
  assert (select snapshot=before_snapshot from public.solicitacoes_cotacao where id=rid),'Completed retries do not mutate';
  assert (select count(*)=1 from public.solicitacoes_cotacao where capture_token=token),'Capture dedup';
  set local session_replication_role=origin;
  select id into actor from auth.users where lower(email)='leorangel@gmail.com' limit 1;
  assert actor is not null,'Authorized synthetic actor required';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
  select * into p from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',oid,'solicitacao_id',rid,
    'cliente_nome','Attribution fixture','snapshot',jsonb_build_object('attribution',other,'sourceRequestSnapshot',jsonb_build_object('attribution',other))),null,null);
  assert p.snapshot->'attribution'=attr and p.snapshot#>'{sourceRequestSnapshot,attribution}'=attr,'Authoritative request defeats forged proposal/source snapshot';
  assert p.snapshot#>>'{event,clientLanguage}'='en','Source language fallback';
  select * into updated from public.save_event_proposal(p.id,'{"snapshot":{"event":{"clientLanguage":" ES "}}}',p.revision,null);
  assert updated.snapshot#>>'{event,clientLanguage}'='es','Assisted correction has priority';
  select * into p from public.save_event_proposal(updated.id,'{"snapshot":{"event":{"clientLanguage":"invalid"}}}',updated.revision,null);
  assert p.snapshot#>>'{event,clientLanguage}'='es' and p.snapshot->'attribution'=attr,'Invalid edit preserves previous valid language and attribution';
  select * into updated from public.save_event_proposal(p.id,'{"publication_status":"ready"}',p.revision,null);
  select * into p from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',updated.oportunidade_id,
    'cliente_nome','Attribution version fixture','snapshot',jsonb_build_object('attribution',other),
    'is_current',false,'publication_status','draft'),updated.revision,updated.id);
  assert p.solicitacao_id=updated.solicitacao_id and p.snapshot->'attribution'=attr
    and p.snapshot#>'{sourceRequestSnapshot,attribution}'=attr and p.snapshot#>>'{event,clientLanguage}'='es',
    'New version preserves request attribution and assisted language correction';
  -- A source without attribution also wins over a forged website claim.
  token:=gen_random_uuid();
  select request_id,opportunity_id into rid,oid from public.submit_public_quote_request(token,snap);
  select * into p from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',oid,'solicitacao_id',rid,
    'cliente_nome','No attribution fixture','snapshot',jsonb_build_object('attribution',attr,'sourceRequestSnapshot',jsonb_build_object('attribution',attr))),null,null);
  assert not(p.snapshot?'attribution') and not((p.snapshot->'sourceRequestSnapshot')?'attribution'),'Absent authoritative attribution strips forged claim';
  insert into public.oportunidades(cliente_nome,status) values('Language-only fixture','lead_recebido') returning id into oid;
  select * into p from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',oid,'cliente_nome','Language-only fixture',
    'snapshot','{"event":{"clientLanguage":"invalid"},"untouched":true}'::jsonb),null,null);
  assert not((p.snapshot->'event')?'clientLanguage') and p.snapshot->'untouched'='true'::jsonb,
    'Invalid proposal-only language is stripped without inventing historical language';
  assert position('pg_advisory_xact_lock' in pg_get_functiondef('public.submit_public_quote_request(uuid,jsonb)'::regprocedure))>0,'Submit lock preserved';
  assert position('pg_advisory_xact_lock' in pg_get_functiondef('public.upsert_public_quote_draft(uuid,jsonb,text)'::regprocedure))>0,'Draft lock preserved';
end $$;
rollback;
