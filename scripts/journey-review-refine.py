from pathlib import Path
p=Path('supabase/migrations/20261014084722_journey_integrity.sql');s=p.read_text()
s=s.replace('add column journey_commercial_locked boolean not null default false;','add column journey_commercial_locked boolean not null default false,\n  add column journey_booked_locked boolean not null default false;')
s=s.replace(" if tg_op='UPDATE' then\n  new.journey_commercial_locked", " if tg_op='UPDATE' then\n  new.journey_booked_locked:=old.journey_booked_locked or old.status=any(booked) or new.status=any(booked);\n  new.journey_commercial_locked")
s=s.replace("old.journey_commercial_locked or old.publication_status='sent'", "old.journey_commercial_locked or old.journey_booked_locked or old.publication_status='sent'")
s=s.replace("old.is_current and old.status=any(booked) and not new.is_current", "old.is_current and (old.journey_booked_locked or old.status=any(booked)) and not new.is_current")
s=s.replace("and p.id<>new.id and p.status=any(booked) for update;", "and p.id<>new.id and (p.journey_booked_locked or p.status=any(booked)) for update;")
s=s.replace(" if tg_op='INSERT' then new.journey_commercial_locked:=new.publication_status='sent' or new.status=any(booked); end if;", """ if tg_op='INSERT' then
  new.journey_booked_locked:=new.status=any(booked);
  new.journey_commercial_locked:=new.publication_status='sent' or new.journey_booked_locked;
 end if;
 if new.snapshot ? 'amendmentOf' and (new.is_current or new.publication_status<>'draft' or new.status=any(booked)
    or nullif(new.snapshot->'pagamentoSinal','null'::jsonb) is not null or nullif(new.snapshot->'pagamentoRestante','null'::jsonb) is not null) then
  raise exception using errcode='PT409',message='Aditivo em rascunho não pode confirmar venda, pagamento, envio ou operação. Preserve o acordo atual.';
 end if;""")
p.write_text(s)
p=Path('app.js');s=p.read_text();old='''  return Boolean(proposal && proposal.publication_status !== "draft" &&
    ["confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"].includes(normalizeProposalStatus(proposal.status)));''';new='''  return Boolean(proposal && proposal.publication_status !== "draft" &&
    (proposal.journey_booked_locked || ["confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"].includes(normalizeProposalStatus(proposal.status))));''';assert old in s;s=s.replace(old,new);p.write_text(s)
p=Path('checks/journey-integrity.sql');s=p.read_text();needle=" assert not d.is_current and d.publication_status='draft';";assert needle in s;s=s.replace(needle,needle+"""
 blocked:=false;begin perform save_event_proposal(d.id,jsonb_build_object('status','confirmado','snapshot',d.snapshot||'{"pagamentoSinal":{"valor":560}}'),d.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Amendment draft cannot create a payment or confirmation';
 select * into p from save_event_proposal(p.id,'{"status":"negociacao"}'::jsonb,p.revision,null);
 assert p.journey_booked_locked,'Restaging cannot forget the previously closed agreement';
 blocked:=false;begin perform save_event_proposal(d.id,'{"is_current":true,"publication_status":"ready"}'::jsonb,d.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Restaging cannot allow a draft to replace a closed agreement';
 select * into p from save_event_proposal(p.id,'{"status":"confirmado"}'::jsonb,p.revision,null);
""");needle=" assert (select status='pending' and completed_at is null from event_handoff_tasks where id=release_id),'Reopened prerequisite invalidates release';";assert needle in s;s=s.replace(needle,needle+"""
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,notes}','"Revised operational note requiring renewed science"')),p.revision,null);
 assert not exists(select 1 from event_handoff_tasks where opportunity_id=opp and acknowledged_at is not null),'Source invalidation may clear financial science without impersonating Finance';
""");p.write_text(s)
p=Path('tests/journey-integrity.spec.js');s=p.read_text();s+='''
test('restaged booked agreement is still treated as an amendment source',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(async()=>{
  const p=getActiveProposal();p.status='negociacao';p.journey_booked_locked=true;upsertProposalState(p);openSavedProposal(p.id);
  fields.guestCount.value=String(Number(fields.guestCount.value)+1);
  const draft=await saveCurrentProposal('negociacao');return {source:draft?.snapshot.amendmentOf?.id,expected:p.id,current:draft?.is_current};
 });expect(r.source).toBe(r.expected);expect(r.current).toBe(false);
});
''';p.write_text(s)
p=Path('app.js');s=p.read_text()
needle='"generalTerms", "paymentTerms", "publicOfferOptions"]';assert needle in s
s=s.replace(needle,'"generalTerms", "paymentTerms", "publicOfferOptions", "versionChanges"]')
a=s.index('function getProposalSnapshot() {');b=s.index('function getDebugProposalState()',a);part=s[a:b]
needle='    proposalText: buildProposalText(),';assert needle in part
part=part.replace(needle,'    ...(Object.hasOwn(activeProposal?.snapshot || {}, "versionChanges") ? {versionChanges: structuredClone(activeProposal.snapshot.versionChanges)} : {}),\n'+needle)
s=s[:a]+part+s[b:];p.write_text(s)
p=Path('supabase/migrations/20261014084722_journey_integrity.sql');s=p.read_text();needle="'paymentTerms',p.snapshot->'paymentTerms','offers',p.snapshot->'publicOfferOptions',";assert needle in s;s=s.replace(needle,needle+"'versionChanges',p.snapshot->'versionChanges',");p.write_text(s)
p=Path('tests/journey-integrity.spec.js');s=p.read_text();s+='''
test('internal notes preserve the customer-visible revision comparison',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(async()=>{
  const p=getActiveProposal();p.snapshot.versionChanges=[{label:'Itens',from:'Coffee break inicial',to:'Coffee break revisado'}];
  upsertProposalState(p);openSavedProposal(p.id);fields.notes.value='Nota interna sem alterar a revisão pública';
  const saved=await saveCurrentProposal('confirmado');return {same:saved?.id===p.id,changes:saved?.snapshot.versionChanges,expected:p.snapshot.versionChanges};
 });expect(r.same).toBe(true);expect(r.changes).toEqual(r.expected);
});
''';p.write_text(s)
