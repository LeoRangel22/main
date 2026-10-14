-- Public evidence is not financial validation. Isolated fixtures; no provider requests.
begin;
do $$
declare p public.propostas; q public.propostas; r record; o uuid; actor uuid; token uuid:=gen_random_uuid(); evidence jsonb;
begin
 select id into actor from auth.users where email='financeiro@embaixadacarioca.com.br';
 insert into oportunidades(cliente_nome,status) values('Public proof journey fixture','proposta_enviada') returning id into o;
 insert into propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
 values(o,'Proof fixture','fixture@example.test','proposta_enviada','sent',true,'2099-11-18','10:00',20,2,1000,120,1120,
 '{"event":{"type":"Coffee Break","date":"2099-11-18","time":"10:00","guests":20,"duration":2},"totals":{"subtotal":1000,"serviceFee":120,"total":1120},"selectedItems":[{"nome":"Fixture","calc":{"total":1000}}]}') returning * into p;
 insert into event_private.proposal_public_baseline values(p.id,event_private.public_proposal_fingerprint(p));
 evidence:='{"nome":"fixture.png","tipo":"image/png","tamanho":3,"dataUrl":"data:image/png;base64,YWJj"}';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 set local role anon;
 select * into r from respond_public_proposal_v2(p.public_token,'confirmar',token,p.id,p.revision,null,null,null,'Aceite com comprovante',evidence);
 assert r.ok and r.status='negociacao';
 select * into r from respond_public_proposal_v2(p.public_token,'confirmar',token,p.id,p.revision,null,null,null,'Aceite com comprovante',evidence);
 assert r.ok,'An identical proof response remains idempotent';
 reset role;
 select * into q from propostas where id=p.id;
 assert q.cliente_solicitacao#>>'{comprovante,nome}'='fixture.png';
 assert q.snapshot#>>'{clienteResposta,comprovante,dataUrl}'='data:image/png;base64,YWJj';
 assert nullif(q.snapshot->'pagamentoSinal','null'::jsonb) is null,'Customer proof creates no inferred deposit';
 assert not exists(select 1 from event_reservations where opportunity_id=o),'Customer acceptance never reserves capacity';
 assert q.revision=p.revision+1,'Duplicate submission cannot mutate the row twice';
 assert event_private.remote_proposal_is_public(q),'Evidence preserves the published commercial content';
 assert not has_function_privilege('anon','public.respond_public_proposal(uuid,text,date,time,integer,text,jsonb)','execute');
 -- Only the real finance role may turn reviewed evidence into a recorded payment.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into q from save_event_proposal(q.id,jsonb_build_object('snapshot',q.snapshot||'{"pagamentoSinal":{"valor":560,"data":"2026-10-14"}}','status','confirmado'),q.revision,null);
 assert q.snapshot#>>'{pagamentoSinal,validadoPor}'=actor::text;
 assert q.snapshot#>>'{pagamentoSinal,validacaoPendente}'='false';
 assert q.snapshot#>>'{clienteResposta,comprovante,nome}'='fixture.png','Validation retains submitted evidence';
 reset role;
end $$;
rollback;
