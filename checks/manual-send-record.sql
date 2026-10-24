-- Disposable database fixture only. No transport is called; rollback removes records.
begin;
do $$
declare actor uuid; actor_email text; opp uuid; p public.propostas; sent public.propostas;
 snapshot jsonb; blocked boolean:=false;
begin
 select id,email into actor,actor_email from auth.users where lower(email)='eventos@embaixadacarioca.com.br';
 assert actor is not null,'Existing Events test identity is required';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',actor_email,'role','authenticated')::text,true);
 insert into public.oportunidades(cliente_nome,status,data_evento) values('Manual send synthetic fixture','negociacao','2099-04-20') returning id into opp;
 snapshot:=jsonb_build_object('client',jsonb_build_object('name','Manual send synthetic fixture','email','manual-send@example.test'),
  'event',jsonb_build_object('date','2099-04-20','time','10:00','guests',20,'duration',1),
  'generalTerms','VALIDADE: até 31/12/2099.',
  'prices','[{"id":"manual-fixture","formula":"por_pessoa","preco1h":50}]'::jsonb,'privatizationRules','[]'::jsonb,
  'selectedItems','[{"id":"manual-fixture","formula":"por_pessoa","preco1h":50,"calc":{"total":1000}}]'::jsonb,
  'totals','{"subtotal":1000,"serviceFee":120,"privatizationAmount":0,"adjustment":0,"total":1120}'::jsonb);
 set local role authenticated;
 select * into p from public.save_event_proposal(null,jsonb_build_object('oportunidade_id',opp,'cliente_nome','Manual send synthetic fixture',
  'status','negociacao','publication_status','ready','data_evento','2099-04-20','horario_evento','10:00','convidados',20,'duracao',1,
  'subtotal',1000,'taxa_servico',120,'total',1120,'snapshot',snapshot),null,null);
 select * into sent from public.save_event_proposal(p.id,jsonb_build_object('status','negociacao','publication_status','sent','sent_at',now(),
  'snapshot',snapshot||jsonb_build_object('ultimoEnvioManualEm',now(),'commercialHistory',jsonb_build_array(jsonb_build_object('type','envio','title','Envio manual registrado','detail','Canal sintético declarado pela equipe')))),p.revision,null);
 assert sent.id=p.id and sent.revision=p.revision+1 and sent.status='negociacao' and sent.publication_status='sent' and sent.sent_at is not null;
 assert sent.snapshot->'pagamentoSinal' is null,'Manual send is not a payment or booking';
 begin
  perform public.save_event_proposal(p.id,jsonb_build_object('publication_status','sent','sent_at',now()),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;
 assert blocked,'The reviewed revision is required';
 reset role;
 assert not exists(select 1 from public.event_outbox where proposal_id=p.id),'Manual declaration never dispatches';
 assert not exists(select 1 from public.event_reservations where proposal_id=p.id),'Manual declaration never reserves';
end $$;
rollback;
