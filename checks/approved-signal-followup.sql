begin;
do $$
declare p public.propostas; o public.oportunidades; fixture uuid; actor uuid; r record; preserved jsonb; deadline timestamptz:=now()+interval '18 hours';
begin
 select id into actor from auth.users where email='eventos@embaixadacarioca.com.br';
 insert into public.oportunidades(cliente_nome,status,responsavel_id,responsavel_email) values('Synthetic approval followup','proposta_enviada',actor,'eventos@embaixadacarioca.com.br') returning id into fixture;
 insert into public.propostas(oportunidade_id,cliente_nome,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,sent_at,snapshot)
 values(fixture,'Synthetic approval followup','proposta_enviada','sent',true,'2099-11-18','10:00',20,2,1000,120,1120,now(),
 jsonb_build_object('event',jsonb_build_object('date','2099-11-18','time','10:00','guests',20,'duration',2,'signalDeadlineAt',deadline),'totals',jsonb_build_object('subtotal',1000,'serviceFee',120,'total',1120),'selectedItems','[{"nome":"Fixture","calc":{"total":1000}}]'::jsonb)) returning * into p;
 insert into event_private.proposal_public_baseline values(p.id,event_private.public_proposal_fingerprint(p));
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select * into r from public.respond_public_proposal_v2(p.public_token,'confirmar',gen_random_uuid(),p.id,p.revision,null,null,null,'Synthetic commercial approval',null);
 assert r.ok;
 reset role;
 select * into p from public.propostas where id=p.id;
 select * into o from public.oportunidades where id=fixture;
 assert p.status='negociacao';
 assert o.proxima_acao='Acompanhar sinal' and o.proxima_acao_em=deadline,'Approval persists exact followup deadline';
 assert o.responsavel_email='eventos@embaixadacarioca.com.br' and o.responsavel_id=actor,'Assigned owner survives public approval';
 assert nullif(p.snapshot->'pagamentoSinal','null'::jsonb) is null;
 assert not exists(select 1 from public.event_reservations where opportunity_id=fixture),'Approval does not reserve';
 preserved:=to_jsonb(o);
 update public.propostas set cliente_resposta_em=cliente_resposta_em where id=p.id;
 select * into o from public.oportunidades where id=fixture;
 assert o.proxima_acao=preserved->>'proxima_acao' and o.proxima_acao_em=(preserved->>'proxima_acao_em')::timestamptz,'Retry does not move deadline';
 update public.oportunidades set proxima_acao='Plano humano específico',metadata=metadata||'{"next_action_source":"manual"}' where id=fixture;
 update public.propostas set cliente_resposta_em=now()+interval '1 second' where id=p.id;
 select * into o from public.oportunidades where id=fixture;
 assert o.proxima_acao='Plano humano específico','Explicit human plan is preserved';
end $$;
rollback;
