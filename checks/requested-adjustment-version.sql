begin;
do $$
declare p public.propostas; q public.propostas; o uuid; actor uuid; before_row jsonb; snap jsonb; r record;
begin
 select id into actor from auth.users where email='eventos@embaixadacarioca.com.br';
 insert into public.oportunidades(cliente_nome,status) values('Synthetic requested V2','proposta_enviada') returning id into o;
 snap:='{"client":{"name":"Synthetic requested V2","email":"fixture@example.test"},"event":{"type":"Coffee Break","date":"2099-11-18","time":"09:00","guests":30,"duration":1},"totals":{"subtotal":1650,"serviceFee":198,"privatizationAmount":0,"total":1848},"selectedItems":[{"nome":"Fixture","calc":{"total":1650}}]}';
 insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,sent_at,snapshot)
 values(o,'Synthetic requested V2','fixture@example.test','proposta_enviada','sent',true,'2099-11-18','09:00',30,1,1650,198,1848,now(),snap) returning * into p;
 insert into event_private.proposal_public_baseline values(p.id,event_private.public_proposal_fingerprint(p));
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select * into r from public.respond_public_proposal_v2(p.public_token,'alteracao',gen_random_uuid(),p.id,p.revision,null,null,null,'Mudar de 30 para 32 convidados',null);
 assert r.ok;reset role;
 select * into p from public.propostas where id=p.id;before_row:=to_jsonb(p);
 snap:=jsonb_set(snap,'{event,guests}','32');
 snap:=jsonb_set(snap,'{totals}','{"subtotal":1760,"serviceFee":211.2,"privatizationAmount":0,"total":1971.2}');
 snap:=jsonb_set(snap,'{selectedItems}','[{"nome":"Fixture","calc":{"total":1760}}]');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);set local role authenticated;
 select * into q from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',o,'cliente_nome','Synthetic requested V2','cliente_email','fixture@example.test',
 'tipo_evento','Coffee Break','data_evento','2099-11-18','horario_evento','09:00','convidados',32,'duracao',1,'subtotal',1760,'taxa_servico',211.2,'privatizacao',0,'total',1971.2,
 'status','proposta_pronta','is_current',true,'publication_status','ready','snapshot',snap),p.revision,p.id);
 assert q.versao=p.versao+1 and q.id<>p.id and q.convidados=32 and q.total=1971.2 and q.publication_status='ready';
 reset role;
 select * into p from public.propostas where id=p.id;
 assert p.convidados=30 and p.total=1848 and p.snapshot=before_row->'snapshot' and p.cliente_resposta='alteracao','Original commercial content and response survive new version';
 assert q.cliente_resposta is null and q.sent_at is null,'New version has no inferred send or acceptance';
 assert not exists(select 1 from public.event_outbox where proposal_id=q.id),'Saving V2 does not send';
 assert not exists(select 1 from public.event_reservations where opportunity_id=o),'Saving V2 does not reserve';
end $$;
rollback;
