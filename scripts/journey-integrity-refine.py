from pathlib import Path
p=Path('app.js');s=p.read_text()
def replace(old,new,count=1):
 global s
 assert s.count(old)==count,(old[:100],s.count(old))
 s=s.replace(old,new)
# If only internal notes changed, retain the exact saved commercial representation.
# Operational state transitions must not normalize a previously agreed contract into an amendment.
marker='function isContractedProposal(proposal) {'
insert='''function hasCommercialEditorInputChanges() {
  if (!state.loadedEditorSignature) return true;
  try {
    const before = JSON.parse(state.loadedEditorSignature), after = JSON.parse(getCurrentEditorSignature());
    delete before.notes; delete after.notes;
    return JSON.stringify(proposalSendContent(before)) !== JSON.stringify(proposalSendContent(after));
  } catch (_) { return true; }
}

function preserveUneditedCommercialSnapshot(snapshot, proposal) {
  if (!proposal?.snapshot || state.forceNewVersionDraft || hasCommercialEditorInputChanges()) return;
  for (const key of ["client", "selectedItems", "totals", "generalTerms", "paymentTerms", "publicOfferOptions"]) {
    if (Object.hasOwn(proposal.snapshot, key)) snapshot[key] = structuredClone(proposal.snapshot[key]);
    else delete snapshot[key];
  }
  snapshot.event = {...structuredClone(proposal.snapshot.event || {}), notes: snapshot.event.notes, signalDeadlineAt: snapshot.event.signalDeadlineAt};
}

'''
replace(marker,insert+marker)
replace('  const amendmentSource = activeProposal?.snapshot?.amendmentOf ||','  preserveUneditedCommercialSnapshot(snapshot, activeProposal);\n  const amendmentSource = activeProposal?.snapshot?.amendmentOf ||')
# Complete field comparison, including fields used by the public contract fingerprint.
replace('["Preferências", text(event.preferences)], ["Extras", text(event.extras)],','["Finalidade", text(event.reason)], ["Anotações do briefing", text(event.sourceNotes)],\n    ["Preferências", text(event.preferences)], ["Extras", text(event.extras)],')
replace('"Cliente final", "Grupo"]);','"Cliente final", "Grupo", "Anotações do briefing"]);')
# The historic payment conditions stay attached to that proposal, not replaced by global defaults.
a=s.index('function getProposalSnapshot() {');b=s.index('function getProposalRow(',a)
part=s[a:b];assert part.count('    paymentTerms,')==1
part=part.replace('    paymentTerms,','    paymentTerms: activeProposal?.snapshot?.paymentTerms || paymentTerms,')
s=s[:a]+part+s[b:]
# One validated set of sector tasks backs screen, print and copy.
old='''  return {
    handoff: operations.handoffs.find((item) => item.opportunity_id === opportunityId) || null,
    tasks: operations.handoffTasks.filter((item) => item.opportunity_id === opportunityId).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    changes: operations.handoffChanges.filter((item) => item.opportunity_id === opportunityId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  };'''
new='''  const handoff = operations.handoffs.find(item => item.opportunity_id === opportunityId) || null;
  const valid = handoff?.proposal_id === proposal?.id && shouldShowOperationalChecklist(proposal);
  return {
    handoff: valid ? handoff : null,
    tasks: valid ? operations.handoffTasks.filter(item => item.opportunity_id === opportunityId && Number(item.source_version) === Number(handoff.version)).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)) : [],
    changes: valid ? operations.handoffChanges.filter(item => item.opportunity_id === opportunityId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [],
  };'''
replace(old,new)
replace('  if (action === "summary") {\n    try {','  if (!shouldShowOperationalChecklist(proposal)) { showToast("Use o acordo confirmado atual; o rascunho não foi encaminhado à operação."); return; }\n  if (action === "summary") {\n    try {')
# Persist the full audit, not just the first eight commercial differences.
replace('{ changes: proposalChanges.slice(0, 8) },','{ changes: proposalChanges },')
p.write_text(s)
p=Path('tests/journey-integrity.spec.js');s=p.read_text()
s=s.replace("const saved=await saveCurrentProposal('confirmado');\n    return {after", "const diagnosticDiff=getProposalChangeList(state.editorProposalBase.snapshot,getProposalSnapshot());const diagnosticInput=hasCommercialEditorInputChanges();const saved=await saveCurrentProposal('confirmado');\n    return {diagnosticDiff,diagnosticInput,after")
s=s.replace("expect(r.paid).toBeGreaterThan(0);", "expect(r.paid,JSON.stringify(r)).toBeGreaterThan(0);")
s+='''
test('a stale operational version is not presented as the current checklist',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(()=>{
  const p=getActiveProposal(),d=getOperationalHandoffData(p);d.handoff.version+=1;
  renderOperationalChecklist(p);return {screen:nodes.operationalChecklist.textContent,context:getOperationalDocContext(p).progress,summary:buildOperationalSummaryText(p)};
 });expect(r.context.total).toBe(0);expect(r.summary).toContain('indisponível');expect(r.screen).not.toContain('8/8');
});
test('unchanged commercial inputs preserve exact historical terms and descriptions while saving notes',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(async()=>{
  const p=getActiveProposal();p.snapshot.paymentTerms=['Condição histórica revisada para este cliente'];openSavedProposal(p.id);
  const before=structuredClone(p.snapshot);fields.notes.value='Somente nota interna';
  const saved=await saveCurrentProposal('confirmado');return {same:saved?.id===p.id,terms:saved?.snapshot.paymentTerms,expected:before.paymentTerms,paid:saved?.snapshot.pagamentoSinal?.valor};
 });expect(r.same).toBe(true);expect(r.terms).toEqual(r.expected);expect(r.paid).toBeGreaterThan(0);
});
'''
p.write_text(s)
print('Contractual projection and consistent operational sources refined')
