from pathlib import Path

def replace(path, old, new):
 p=Path(path);s=p.read_text();assert s.count(old)==1,(path,old[:100],s.count(old));p.write_text(s.replace(old,new))

replace('app.js','''function buildProposalText() {''','''function getProposalPaymentTerms() {
  const source = state.editorProposalBase?.id === state.activeProposalId
    ? state.editorProposalBase : getActiveProposal();
  return Array.isArray(source?.snapshot?.paymentTerms) ? [...source.snapshot.paymentTerms] : [...paymentTerms];
}

function buildProposalText() {''')
replace('app.js','''  lines.push(``, `Pagamento:`, ...paymentTerms);''','''  lines.push(``, `Pagamento:`, ...getProposalPaymentTerms());''')
replace('app.js','''    paymentTerms: activeProposal?.snapshot?.paymentTerms || paymentTerms,''','''    paymentTerms: getProposalPaymentTerms(),''')
replace('app.js','''        ${paymentTerms.map((term) => `<div><span></span><strong>${escapeHtml(term)}</strong></div>`).join("")}''','''        ${getProposalPaymentTerms().map((term) => `<div><span></span><strong>${escapeHtml(term)}</strong></div>`).join("")}''')
replace('app.js','''  if (!isContractedProposal(proposal) || !proposal.is_current) blockers.push("Confira o acordo confirmado atual.");''','''  // The persistent lock preserves a prior agreement; it is not authorization to
  // release a canceled or renegotiating event. Match the server's active stages.
  if (!proposal?.is_current || !["confirmado", "pagamento_final", "planejamento", "evento_proximo"].includes(normalizeProposalStatus(proposal?.status))) {
    blockers.push("Confira o acordo confirmado atual; um evento em renegociação não está liberado para execução.");
  }''')
path='supabase/migrations/20261014084722_journey_integrity.sql'
replace(path,""" if new.task_key='financeiro_saldo' and ((new.status='done' and old.status is distinct from new.status) or (new.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at))
   and not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='A ciência financeira deve ser registrada pelo Financeiro ou gestor';
 end if;
 if new.task_key='gerencia_go_no_go' and (new.status='done' or (new.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at)) then""",""" -- Only nested database invalidations may clear a prior decision without
 -- impersonating its owner. Direct RPC updates fire at depth 1 and never qualify.
 if pg_trigger_depth()>1 then
  if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
  if new.status='pending' and new.acknowledged_at is null and new.acknowledged_by is null
    and new.completed_at is null and new.completed_by is null and new.source_version>=old.source_version
    and (new.source_version>old.source_version or
      (to_jsonb(new)-array['status','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at'])=
      (to_jsonb(old)-array['status','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at'])) then
   return new;
  end if;
 end if;
 if new.task_key='financeiro_saldo' and not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='Somente Financeiro ou gestor podem alterar a tarefa de validação financeira';
 end if;
 if new.task_key='gerencia_go_no_go' then""")
replace('checks/journey-integrity.sql',""" assert (select status='done' and acknowledged_by=manager from event_handoff_tasks where id=release_id);
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='salao_montagem';""",""" assert (select status='done' and acknowledged_by=manager from event_handoff_tasks where id=release_id);
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='financeiro_saldo';
 blocked:=false;begin perform update_event_handoff_task(t.id,'done','Seller changed owner',now(),'Changed after financial validation',h.version);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'A seller cannot alter a completed finance task while retaining the finance signature';
 assert (select notes=t.notes and owner_label=t.owner_label and acknowledged_by=manager from event_handoff_tasks where id=t.id);
 blocked:=false;begin perform update_event_handoff_task(release_id,'pending',null,null,'Seller reopening final release',h.version);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked and (select status='done' from event_handoff_tasks where id=release_id),'Only the manager may directly reopen the management release';
 -- A legitimate sector prerequisite reopening must still invalidate the release.
 select * into t from event_handoff_tasks where opportunity_id=opp and task_key='salao_montagem';""")
p=Path('tests/journey-completion.spec.js');p.write_text(p.read_text()+'''
test('retained payment terms agree in the editor preview, copied text and saved snapshot',async({page})=>{
 await fixture(page);const r=await page.evaluate(()=>{
  const terms=['30% na assinatura do acordo especial.','70% até a data contratada.'];
  const p=getActiveProposal();p.snapshot.paymentTerms=terms;upsertProposalState(p);openSavedProposal(p.id);renderProposal();
  const result={preview:document.querySelector('#proposalContent').innerText,text:buildProposalText(),saved:getProposalSnapshot().paymentTerms};
  window.confirm=()=>true;startNewProposal();result.fresh=getProposalSnapshot().paymentTerms;result.defaults=[...paymentTerms];return result;
 });expect(r.saved).toEqual(['30% na assinatura do acordo especial.','70% até a data contratada.']);
 for(const term of r.saved){expect(r.preview).toContain(term);expect(r.text).toContain(term);}
 expect(r.preview).not.toContain(r.defaults[0]);expect(r.text).not.toContain(r.defaults[0]);expect(r.fresh).toEqual(r.defaults);
});
test('a historical booked lock does not release an event currently back in negotiation',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(()=>{
  const p=getActiveProposal();p.journey_booked_locked=true;p.status='negociacao';upsertProposalState(p);openSavedProposal(p.id);
  const d=getOperationalHandoffData(p);for(const t of d.tasks){t.status='done';t.acknowledged_at='2026-10-14T08:00:00Z';}
  return {protected:isContractedProposal(p),blockers:getOperationalReleaseBlockers(p)};
 });expect(r.protected).toBe(true);expect(r.blockers.join(' ')).toContain('em renegociação');
});
''')
print('Payment terms and guarded task ownership now match their displayed workflows.')
