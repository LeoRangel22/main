begin;
do $$
declare o uuid; p public.propostas; actor uuid; blocked boolean;
begin
 assert event_private.tariff_valid_until('VALIDADE: exclusivamente para eventos até o dia 31/12/2026.')='2026-12-31';
 assert event_private.tariff_valid_until('Condições próprias sem data explícita') is null;
 assert event_private.tariff_valid_until('VALIDADE: até 31/02/2026') is null;
 select id into actor from auth.users where email='leorangel@gmail.com';
 perform set_config('request.jwt.claims','',true);
 insert into oportunidades(cliente_nome,status) values('Tariff fixture','proposta_pronta') returning id into o;
 insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,snapshot)
 values(o,'Tariff fixture','proposta_pronta','ready','2099-01-01','{"generalTerms":"VALIDADE: eventos realizados até o dia 31/12/2026."}') returning * into p;
 blocked:=false;begin
 insert into event_outbox(opportunity_id,proposal_id,fingerprint,channel,destination,body,status,approved_by)
 values(o,p.id,'expired-tariff-fixture','email','fixture@example.test','Fixture','pending',actor);
 exception when others then blocked:=true;end;assert blocked,'Expired explicit tariff cannot enter the dispatch ledger';
 assert not exists(select 1 from event_outbox where proposal_id=p.id);
end $$;
rollback;
