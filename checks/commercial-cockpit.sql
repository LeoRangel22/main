begin;
do $$
declare actor uuid; o uuid; p public.propostas; m jsonb; page jsonb; compact jsonb; saved public.propostas; kind text; descriptors jsonb; ids text[];
begin
 select id into actor from auth.users where lower(email)='leorangel@gmail.com' limit 1;
 assert actor is not null,'Fixture team actor is required';
 insert into public.oportunidades(cliente_nome,status,data_evento,metadata) values('Cockpit fixture','proposta_enviada',current_date+20,'{"first_reply_sent_at":"invalid date"}') returning id into o;
 insert into public.propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,snapshot) values(o,'Cockpit fixture','proposta_enviada','sent',current_date+20,jsonb_build_object('prices',jsonb_build_array(jsonb_build_object('id','catalog','description',repeat('x',20000))),'generalTerms','Terms must survive','referencia','fixture-preserve','pagamentoSinal',jsonb_build_object('valor',50,'comprovante',jsonb_build_object('nome','proof.pdf','dataUrl','data:application/pdf;base64,'||repeat('A',40000))),'commercialHistory',jsonb_build_array(jsonb_build_object('type','envio','at',now(),'title','Sent','approval',jsonb_build_object('large',repeat('x',20000)))))) returning * into p;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 m=public.get_event_dashboard_manifest();
 assert m->>'version'='1','Manifest version';
 for kind,descriptors in select key,value from jsonb_each(m->'records') loop
  select array_agg(x->>'id') into ids from (select value x from jsonb_array_elements(descriptors) limit 80) d;
  if cardinality(ids)>0 then
   page=public.get_event_dashboard_rows(kind,ids);
   assert jsonb_array_length(page)=cardinality(ids),kind||' page incomplete';
  end if;
 end loop;
 assert exists(select 1 from jsonb_array_elements(m->'records'->'propostas') d where d->>'id'=p.id::text and d->>'version'=p.revision::text),'Revision descriptor';
 assert (m->'summary'->>'open')::integer>=1,'Future commercial scope';
 page=public.get_event_dashboard_rows('propostas',array[p.id::text]);compact=page->0;
 assert compact->>'_dashboard_summary'='true','Explicit summary marker';
 assert compact->'snapshot'->>'referencia'='fixture-preserve','Summary references retained';
 assert compact->'snapshot'->'pagamentoSinal'->>'valor'='50','Payment value retained';
 assert compact->'snapshot'->'pagamentoSinal'->'comprovante'->>'nome'='proof.pdf','Proof metadata retained';
 assert not (compact->'snapshot' ? 'prices'),'Catalog not copied into listing';
 assert (compact::text not like '%data:application/pdf%'),'Files not copied into listing';
 assert (compact::text not like '%Terms must survive%'),'Conditions loaded only in details';
 assert length(compact::text)<length(to_jsonb(p)::text)/4,'Substantial fixture payload reduction';
 begin
  select * into saved from public.save_event_proposal(p.id,jsonb_build_object('snapshot',compact->'snapshot'),p.revision,null);
  raise exception 'Summary snapshot unexpectedly persisted';
 exception when sqlstate 'PT409' then null; end;
 assert (select snapshot->>'generalTerms'='Terms must survive' from public.propostas where id=p.id),'Full details untouched';
 begin perform public.get_event_dashboard_rows('propostas',array_fill(p.id::text,array[81]));raise exception 'Oversize page accepted';exception when raise_exception then assert sqlerrm='Informe entre 1 e 80 registros';end;
 begin perform public.get_event_dashboard_rows('auth.users',array[p.id::text]);raise exception 'Invalid source accepted';exception when raise_exception then assert sqlerrm='Tipo de registro inválido';end;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','cockpit-outsider@example.test','role','authenticated')::text,true);
 set local role authenticated;
 begin perform public.get_event_dashboard_manifest();raise exception 'Outsider read allowed';exception when others then assert sqlerrm!='Outsider read allowed';end;
 reset role;
 set local role anon;
 begin perform public.get_event_dashboard_manifest();raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
 reset role;
end; $$;
rollback;
