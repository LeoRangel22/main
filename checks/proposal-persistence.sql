-- Real RPC/roles and read-back, isolated fixtures; no provider call; all writes roll back.
begin;
do $$
declare actor uuid; opp uuid; original public.propostas; saved public.propostas; draft public.propostas;
  reread public.propostas; snap jsonb; blocked boolean; claim jsonb;
begin
  select id into actor from auth.users where lower(email)='leorangel@gmail.com' limit 1;
  assert actor is not null, 'An authorized test actor is required';
  assert not has_function_privilege('authenticated','public.begin_event_send(uuid,text,text,text,text,timestamptz)','EXECUTE'), 'Legacy contextual claim must be private';
  assert not has_function_privilege('authenticated','public.begin_event_send(uuid,text,text,text,text)','EXECUTE'), 'Oldest claim must be private';
  assert not has_function_privilege('anon','public.begin_event_send_reviewed(uuid,bigint,text,text,text,text,timestamptz)','EXECUTE'), 'Anonymous reviewed claim forbidden';
  insert into public.oportunidades(cliente_nome,status,data_evento)
    values('Persistence rollback fixture','negociacao','2099-11-18') returning id into opp;
  snap := jsonb_build_object(
    'client',jsonb_build_object('name','Persistence rollback fixture','email','persistence@example.test','phone','5521000000011'),
    'event',jsonb_build_object('type','Coffee Break','date','2099-11-18','time','10:00','guests',20,'duration',2,'notes','Original notes'),
    'totals',jsonb_build_object('subtotal',1000,'serviceFee',120,'privatizationAmount',0,'adjustment',0,'total',1120),
    'selectedItems',jsonb_build_array(jsonb_build_object('id','fixture-item','nome','Coffee Break','calc',jsonb_build_object('total',1000))),
    'prices',jsonb_build_array(jsonb_build_object('id','fixture-item','preco1h',50)),
    'generalTerms','Condições preservadas',
    'internalComments',jsonb_build_array(jsonb_build_object('text','Contexto interno preservado')),
    'eventAttachments',jsonb_build_array(jsonb_build_object('nome','briefing-fixture.txt','dataUrl','data:text/plain;base64,dGVzdA==')));
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
  set local role authenticated;
  select * into original from public.save_event_proposal(null,jsonb_build_object(
    'oportunidade_id',opp,'responsavel_id',actor,'responsavel_email','leorangel@gmail.com',
    'cliente_nome','Persistence rollback fixture','cliente_email','persistence@example.test','cliente_whatsapp','5521000000011',
    'tipo_evento','Coffee Break','data_evento','2099-11-18','horario_evento','10:00','convidados',20,'duracao',2,
    'subtotal',1000,'taxa_servico',120,'privatizacao',0,'total',1120,'status','negociacao',
    'is_current',true,'publication_status','ready','snapshot',snap),null,null);
  select * into reread from public.propostas where id=original.id;
  assert reread.snapshot=snap and reread.total=1120 and reread.revision=1, 'Create/read-back preserves full payload and money';
  assert reread.oportunidade_id=opp and reread.public_token is not null, 'Create links the correct opportunity and public token';
  snap := jsonb_set(snap,'{event,notes}','"Edited and read back"');
  select * into saved from public.save_event_proposal(original.id,jsonb_build_object('snapshot',snap,'cliente_nome','Persistence edited fixture'),original.revision,null);
  select * into reread from public.propostas where id=original.id;
  assert reread.snapshot=snap and reread.cliente_nome='Persistence edited fixture' and reread.revision=original.revision+1, 'Edit/read-back is complete';
  assert reread.public_token=original.public_token, 'Editing the same version preserves its link';
  assert (select valor_atual=1120 and cliente_nome='Persistence edited fixture' from public.oportunidades where id=opp), 'Opportunity is synchronized atomically';
  blocked:=false;
  begin perform public.save_event_proposal(original.id,'{"snapshot":{"lost":"must not persist"}}',original.revision,null);
  exception when sqlstate 'PT409' then blocked:=true; end;
  assert blocked and (select snapshot=snap from public.propostas where id=original.id), 'Stale save cannot overwrite current data';
  blocked:=false;
  begin perform public.save_event_proposal(original.id,'{"snapshot":{"_dashboard_summary":true}}',saved.revision,null);
  exception when others then blocked:=true; end;
  assert blocked, 'A dashboard summary cannot replace full content';
  select * into draft from public.save_event_proposal(null,jsonb_build_object(
    'oportunidade_id',opp,'responsavel_id',actor,'responsavel_email','leorangel@gmail.com',
    'cliente_nome','Persistence V2 fixture','cliente_email','persistence@example.test','cliente_whatsapp','5521000000011',
    'tipo_evento','Coffee Break','data_evento','2099-11-18','horario_evento','10:00','convidados',20,'duracao',2,
    'subtotal',1000,'taxa_servico',120,'privatizacao',0,'total',1120,'status','negociacao',
    'is_current',false,'publication_status','draft','snapshot',snap),saved.revision,saved.id);
  assert draft.versao>saved.versao and draft.snapshot=snap, 'A new draft preserves full content and increments version';
  assert (select is_current from public.propostas where id=original.id) and not draft.is_current, 'Draft does not replace published version';
  select * into draft from public.save_event_proposal(draft.id,'{"is_current":true,"publication_status":"ready"}',draft.revision,null);
  assert (select count(*)=1 from public.propostas where oportunidade_id=opp and is_current), 'Publication has one current version';
  assert not (select is_current from public.propostas where id=original.id), 'Previous version is retained as history';
  blocked:=false;
  begin perform public.begin_event_send(draft.id,'email','persistence@example.test','Fixture body','Fixture',null);
  exception when insufficient_privilege then blocked:=true; end;
  assert blocked and not exists(select 1 from public.event_outbox where proposal_id=draft.id), 'Legacy entry cannot claim an outbox record';
  blocked:=false;
  begin perform public.begin_event_send_reviewed(draft.id,draft.revision-1,'email','persistence@example.test','Fixture body','Fixture',null);
  exception when others then blocked:=true; end;
  assert blocked and not exists(select 1 from public.event_outbox where proposal_id=draft.id), 'Stale review cannot claim a send';
  claim:=public.begin_event_send_reviewed(draft.id,draft.revision,'email','persistence@example.test','Fixture body','Fixture',null);
  assert (claim->>'claimed')::boolean, 'Reviewed wrapper can still claim internally after revocation';
  reset role;
end $$;
rollback;
