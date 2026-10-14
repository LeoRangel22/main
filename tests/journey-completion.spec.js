const {test,expect}=require('@playwright/test');
async function fixture(page,confirmed=false){
 await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');
 await page.evaluate(confirmed=>{
  const p=state.proposals.find(x=>x.id==='qa-proposal-sem-resposta');
  p.id='00000000-0000-4000-8000-000000000721';
  Object.assign(p,{revision:1,versao:1,status:confirmed?'confirmado':'negociacao',publication_status:'sent',is_current:true});
  openSavedProposal(p.id);p.snapshot=structuredClone(getProposalSnapshot());
  p.snapshot.pagamentoSinal=confirmed?{valor:p.total/2,data:'2026-10-14',bancos:['Fixture']}:null;
  p.snapshot.pagamentoRestante=null;upsertProposalState(p);openSavedProposal(p.id);
  for(const h of window.EventOperationsState.handoffs)if(h.opportunity_id===p.oportunidade_id)h.proposal_id=p.id;
 },confirmed);
}
test('a saved amendment keeps the booked event in pipeline and makes the draft separately reachable',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(async()=>{
  const old=structuredClone(getActiveProposal());fields.guestCount.value=String(Number(fields.guestCount.value)+5);
  const draft=await saveCurrentProposal('confirmado');const working=getWorkingProposals().find(p=>p.oportunidade_id===old.oportunidade_id);
  const pipeline=getPipelineItems().find(p=>p.opportunityId===old.oportunidade_id);
  return {oldId:old.id,workingId:working.id,status:pipeline.status,total:working.total,oldTotal:old.total,draft:working.pendingDraftId,expected:draft.id};
 });expect(r.workingId).toBe(r.oldId);expect(r.status).toBe('confirmado');expect(r.total).toBe(r.oldTotal);expect(r.draft).toBe(r.expected);
});
test('public comparison describes changes without IDs formulas or calculation JSON',async({page})=>{
 await fixture(page);const r=await page.evaluate(()=>{
  const a=getProposalSnapshot(),b=structuredClone(a);
  b.selectedItems[0].id='INTERNAL-SECRET-ID';b.selectedItems[0].formula='private_formula';b.selectedItems[0].descricao='Nova composição do pacote';b.selectedItems[0].commercialSummary='Nova composição do pacote';
  b.paymentTerms=['30% na contratação'];b.totals.adjustment=-10;b.totals.adjustmentLabel='Condição revisada';
  return getClientVisibleProposalChanges(a,b);
 });const text=JSON.stringify(r);expect(text).toContain('Nova composição');expect(text).toContain('30% na contratação');expect(text).not.toContain('INTERNAL-SECRET-ID');expect(text).not.toContain('private_formula');expect(text).not.toContain('precoMeiaHoraExtra');expect(text).not.toContain('calculo');expect(r.find(x=>x.label==='Itens').to).not.toContain('{');
});
for(const booked of [false,true])test(`rescheduling preserves the sent agreement (booked=${booked})`,async({page})=>{
 await fixture(page,booked);const r=await page.evaluate(async booked=>{
  const p=getActiveProposal();p.data_evento='2020-01-10';p.snapshot.event.date=p.data_evento;upsertProposalState(p);openSavedProposal(p.id);
  const original=structuredClone(p);requestPastEventOutcome=async()=>({outcome:'remarcado',newDate:'2099-11-20',detail:'Solicitação sintética de remarcação'});
  await classifyPastEvent('proposal',p.id);
  const draft=state.proposals.find(x=>x.oportunidade_id===p.oportunidade_id&&x.publication_status==='draft');
  const preserved=state.proposals.find(x=>x.id===p.id);const working=getWorkingProposals().find(x=>x.oportunidade_id===p.oportunidade_id);
  return {draft:Boolean(draft),oldDate:preserved.data_evento,oldStatus:preserved.status,expectedStatus:original.status,newDate:draft?.data_evento,current:draft?.is_current,amendment:Boolean(draft?.snapshot.amendmentOf),working:working?.id,oldId:p.id};
 },booked);
 expect(r.draft).toBe(true);expect(r.oldDate).toBe('2020-01-10');expect(r.oldStatus).toBe(r.expectedStatus);expect(r.newDate).toBe('2099-11-20');expect(r.current).toBe(false);expect(r.amendment).toBe(booked);if(booked)expect(r.working).toBe(r.oldId);
});
test('the ready button promotes a completed draft without creating a send',async({page})=>{
 await fixture(page);await page.evaluate(()=>{
  const p=getActiveProposal();p.publication_status='draft';p.status='proposta_pronta';p.sent_at=null;upsertProposalState(p);openSavedProposal(p.id);
  // Isolate the actual button transition; readiness validation has separate UI coverage.
  getProposalReviewItems=()=>[];getProposalReviewSummary=()=>({ready:true});isSendReviewApproved=()=>true;getReadinessBlockingItems=()=>[];
 });
 await page.locator('#saveProposalBtn').click();
 await expect.poll(()=>page.evaluate(()=>getActiveProposal().publication_status)).toBe('ready');
 const r=await page.evaluate(()=>({status:getActiveProposal().status,sent:getActiveProposal().sent_at,current:getActiveProposal().is_current}));
 expect(r).toEqual({status:'proposta_pronta',sent:null,current:true});
});
test('incomplete ready transition is refused and retains a recoverable draft',async({page})=>{
 await fixture(page);const r=await page.evaluate(async()=>{
  window.confirm=()=>true;startNewProposal();fields.clientName.value='Trabalho parcial';fields.eventDate.value='';state.selectedIds.clear();
  const draft=await saveCurrentProposal(null,null,{asDraft:true});const ready=await saveCurrentProposal(null,null,{markReady:true});
  return {saved:Boolean(draft),ready,pub:getActiveProposal().publication_status};
 });expect(r.saved).toBe(true);expect(r.ready).toBeNull();expect(r.pub).toBe('draft');
});
test('pending proof does not count as collected money or skip finance validation',async({page})=>{
 await fixture(page);const r=await page.evaluate(async()=>{
  const p=getActiveProposal();p.snapshot.pagamentoSinal={valor:p.total,validacaoPendente:true};upsertProposalState(p);openSavedProposal(p.id);
  const coverage=getPaymentCoverage(p.total,p.snapshot.pagamentoSinal);const operational=shouldShowOperationalChecklist(p);let dialogs=0;
  showSignalPaymentDialog=async()=>{dialogs++;return null;};await updateProposalStatus(p.id,'confirmado');
  return {paid:coverage.paidTotal,full:coverage.isFullyPaid,operational,dialogs,status:getActiveProposal().status};
 });expect(r).toEqual({paid:0,full:false,operational:false,dialogs:1,status:'negociacao'});
});

test('legacy pending proof is not displayed as received and cannot release an otherwise complete operation',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(()=>{
  const p=getActiveProposal();p.snapshot.pagamentoSinal={valor:p.total,validacaoPendente:true};upsertProposalState(p);openSavedProposal(p.id);
  const d=getOperationalHandoffData(p);for(const t of d.tasks){t.status='done';t.acknowledged_at='2026-10-14T08:00:00Z';}
  return {summary:renderPaymentSummaryLine('Sinal registrado',p.snapshot.pagamentoSinal),
    next:getProposalNextStepConfig(),doc:buildOperationalPaymentStatusBlock(getOperationalDocContext(p)),blockers:getOperationalReleaseBlockers(p)};
 });expect(r.summary).toContain('Recebimento ainda não confirmado');expect(r.summary).not.toContain('Sinal registrado');
 expect(r.next.action).toBe('mark_signal');expect(r.doc).toContain('pendente de validação');expect(r.doc).not.toContain('Sem saldo restante aparente');
 expect(r.blockers.join(' ')).toContain('validar o sinal');
});
test('rescheduling takes request and owner from its source, not another editor',async({page})=>{
 await fixture(page);const r=await page.evaluate(async()=>{
  const p=getActiveProposal();p.data_evento='2020-01-10';p.snapshot.event.date=p.data_evento;
  p.solicitacao_id='00000000-0000-4000-8000-000000000733';p.responsavel_id='00000000-0000-4000-8000-000000000734';p.responsavel_email='eventos@embaixadacarioca.com.br';
  upsertProposalState(p);state.activeQuoteRequestId='00000000-0000-4000-8000-000000000735';
  requestPastEventOutcome=async()=>({outcome:'remarcado',newDate:'2099-11-20',detail:'Fixture'});
  await classifyPastEvent('proposal',p.id);
  const draft=state.proposals.find(x=>x.oportunidade_id===p.oportunidade_id&&x.publication_status==='draft');
  return {request:draft?.solicitacao_id,owner:draft?.responsavel_id,email:draft?.responsavel_email};
 });expect(r).toEqual({request:'00000000-0000-4000-8000-000000000733',owner:'00000000-0000-4000-8000-000000000734',email:'eventos@embaixadacarioca.com.br'});
});
