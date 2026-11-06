-- Disposable PostgreSQL fixtures. Normal triggers remain enabled.
-- The CJS harness owns BEGIN/ROLLBACK; never apply this file in production.
select set_config('request.jwt.claims','{}',true);
create temp table _view_visibility_cases(kind text primary key,token uuid,requested_id uuid,target_id uuid,readable boolean,history_before bigint,original_history bigint) on commit drop;
do $$
declare kind text;opp uuid;p public.propostas;next_p public.propostas;target uuid;visible boolean;recorded boolean;c record;valid_token uuid;
 before_total bigint;fixture_snapshot jsonb;
begin
 select jsonb_build_object('event',jsonb_build_object('type','Synthetic view fixture'),
  'totals',jsonb_build_object('subtotal',1000,'serviceFee',120,'total',1120),
  'selectedItems',jsonb_agg(jsonb_build_object('nome','Synthetic item '||i,'calc',jsonb_build_object('total',50))))
 into fixture_snapshot from generate_series(1,20) i;
 foreach kind in array array['valid','expired','revoked','draft','old-link','old-revoked'] loop
  insert into public.oportunidades(cliente_nome,cliente_email,status)
   values('Synthetic visibility '||kind,'visibility@example.invalid','proposta_enviada') returning id into opp;
  insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,is_current,
   data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
  values(opp,'Synthetic visibility '||kind,'visibility@example.invalid','proposta_enviada',
   case when kind='draft' then 'draft' else 'sent' end,true,'2099-11-18','09:00',30,1,1000,120,1120,fixture_snapshot) returning * into p;
  insert into event_private.proposal_public_baseline values(p.id,event_private.public_proposal_fingerprint(p));
  -- Seed legitimate history before invalidating a once-visible link.
  if kind<>'draft' then
   set local role anon;
   recorded:=public.record_public_proposal_view(p.public_token,'prior fixture view','');
   reset role;
   assert recorded,'Visible fixture creates its original history with normal triggers';
  end if;
  target:=p.id;
  if kind in ('old-link','old-revoked') then
   update public.propostas set is_current=false,public_token_expires_at=now()-interval '1 day' where id=p.id;
   insert into public.propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,is_current,
    versao,revision,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
   values(opp,'Synthetic visible successor','visibility@example.invalid','proposta_enviada','sent',true,
    2,1,'2099-11-18','09:00',30,1,1000,120,1120,fixture_snapshot) returning * into next_p;
   insert into event_private.proposal_public_baseline values(next_p.id,event_private.public_proposal_fingerprint(next_p));
   target:=next_p.id;
  end if;
  if kind='expired' then update public.propostas set public_token_expires_at=now()-interval '1 day' where id=p.id;end if;
  if kind in ('revoked','old-revoked') then update public.propostas set public_token_revoked_at=now() where id=p.id;end if;
  insert into _view_visibility_cases values(kind,p.public_token,p.id,target,kind in ('valid','old-link'),
   (select count(*) from public.proposta_visualizacoes where proposta_id=target),
   (select count(*) from public.proposta_visualizacoes where proposta_id=p.id));
 end loop;
 for c in select * from _view_visibility_cases loop
  set local role anon;
  assert exists(select 1 from public.get_public_proposal(c.token))=c.readable,'Fixture matches existing public visibility contract';
  if c.readable then assert (select id=c.target_id from public.get_public_proposal(c.token)),'Existing redirect resolves to the expected version';end if;
  recorded:=public.record_public_proposal_view(c.token,'synthetic visibility','https://example.invalid/');
  reset role;
  assert recorded=c.readable,'Analytics accepts exactly the proposals the existing getter exposes';
  assert (select count(*) from public.proposta_visualizacoes v where v.proposta_id=c.target_id)
   =c.history_before+case when c.readable then 1 else 0 end,'Invalid links add no views and existing history survives';
  if c.kind in ('old-link','old-revoked') then
   assert (select count(*) from public.proposta_visualizacoes v where v.proposta_id=c.requested_id)
    =c.original_history,'Original-version history is retained';
  end if;
 end loop;
 select count(*) into before_total from public.proposta_visualizacoes;
 set local role anon;
 assert not public.record_public_proposal_view(gen_random_uuid(),'unknown fixture',''),'Unknown token is rejected';
 assert not public.record_public_proposal_view(null,'null fixture',''),'Null token is rejected';
 reset role;
 assert (select count(*)=before_total from public.proposta_visualizacoes),'Rejected tokens create no extra rows';
 select v.token into valid_token from _view_visibility_cases v where v.kind='valid';
 set local role anon;
 assert public.record_public_proposal_view(valid_token,repeat('u',700),repeat('r',700)),'Valid metadata remains accepted';
 reset role;
 assert exists(select 1 from public.proposta_visualizacoes v where v.public_token=valid_token
  and length(user_agent)=500 and length(referrer)=500),'Existing 500-character metadata bounds are preserved';
 assert not exists(select 1 from public.event_outbox b where b.proposal_id in
  (select requested_id from _view_visibility_cases union select target_id from _view_visibility_cases)),'Visibility fixtures send no messages';
end $$;
