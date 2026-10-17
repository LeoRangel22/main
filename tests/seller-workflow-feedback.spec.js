const {test,expect}=require('@playwright/test');

async function fixture(page) {
 await page.route('https://**',route=>route.abort());
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const p=state.proposals.find(x=>x.id==='qa-proposal-sem-resposta');
  Object.assign(p,{revision:1,is_current:true,publication_status:'sent',status:'proposta_enviada'});
  openSavedProposal(p.id);
 });
}

test('custom-only proposal keeps separate title and description after save and reopening',async({page})=>{
 await fixture(page);
 const r=await page.evaluate(async()=>{
  state.selectedIds.clear();
  fields.quickItemName.value='Serviço exclusivo';
  fields.quickItemDescription.value='Montagem, equipe e equipamento <especial>\nInclui operação durante o evento.';
  fields.quickItemValue.value='1500';fields.quickItemCategory.value='Sob medida';
  createQuickBudgetItem();
  const review=getProposalReviewItems().find(x=>x.id==='items');
  const selected=getSelectedItems();
  const saved=await saveCurrentProposal('negociacao');
  if(saved)openSavedProposal(saved.id);
  return {review,selected:selected.map(x=>({name:x.nome,description:x.descricao,quoteOnly:x.quoteOnly})),saved:Boolean(saved),
    error:state.lastProposalSaveError,reopened:getSelectedItems().map(x=>x.descricao),preview:nodes.proposalContent.innerHTML};
 });
 expect(r.review.status).toBe('ok');
 expect(r.selected).toHaveLength(1);expect(r.selected[0].quoteOnly).toBe(true);
 expect(r.selected[0].name).toBe('Serviço exclusivo');
 expect(r.selected[0].description).toContain('Montagem, equipe e equipamento <especial>');
 expect(r.saved,r.error).toBe(true);expect(r.reopened).toEqual([r.selected[0].description]);
 expect(r.preview).toContain('equipamento &lt;especial&gt;');
 expect(r.preview).not.toContain('equipamento <especial>');
});

test('privatization discount has seller autonomy while general discount retains its limit',async({page})=>{
 await fixture(page);
 const r=await page.evaluate(()=>{
  fields.manualAdjustment.value='0';fields.privatizationAdjustment.value='-5000';
  const privatization=getCommercialApprovalRequirement();
  fields.manualAdjustment.value='-2000';const commercial=getCommercialApprovalRequirement();
  return {privatization,commercial};
 });
 expect(r.privatization.required).toBe(false);expect(r.commercial.required).toBe(true);
});

test('Events records actual bank-attested signal and moves directly from Sem resposta',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>{
  const p=getActiveProposal();p.snapshot.pagamentoSinal=null;p.snapshot.pagamentoRestante=null;
  state.session.user.email='eventos@embaixadacarioca.com.br';
  window.directStageAttempt=updateProposalStatus(p.id,'confirmado');
 });
 const modal=page.locator('.signal-modal');
 await expect(modal).toBeVisible();
 await modal.locator('[name="amount"]').click();await modal.locator('[name="date"]').click();
 await modal.locator('[name="bank"]').first().check();
 await modal.locator('button[type="submit"]').click();
 await expect(modal.locator('.signal-error')).toContainText('extrato');
 await modal.locator('[name="bankConfirmed"]').check();
 await modal.locator('button[type="submit"]').click();
 await expect(modal).not.toBeVisible();
 const r=await page.evaluate(async()=>{
  await window.directStageAttempt;const p=getActiveProposal();
  return {status:p.status,signal:p.snapshot.pagamentoSinal,stage:canMoveProposalStatus('proposta_enviada','confirmado')};
 });
 expect(r.stage.ok).toBe(true);expect(r.status).toBe('confirmado');expect(r.signal.valor).toBeGreaterThan(0);
 expect(r.signal.bankConferido).toBe(true);expect(r.signal.registradoPor).toBe('eventos@embaixadacarioca.com.br');
});

for(const width of [1440,390])test('Sem resposta has page scrolling and an accessible direct stage control at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await fixture(page);
 await page.evaluate(()=>{setWorkspaceMode('sales');renderPipeline();});
 const column=page.locator('.pipeline-stage-proposta_enviada .pipeline-column-list').first();
 const styles=await column.evaluate(el=>({max:getComputedStyle(el).maxHeight,overflow:getComputedStyle(el).overflowY}));
 expect(styles.max).toBe('none');expect(styles.overflow).toBe('visible');
 const card=column.locator('.pipeline-card').first();
 await expect(card.locator('.pipeline-card-details')).not.toHaveAttribute('open','');
 const control=card.locator('.pipeline-card-bottom-row > .pipeline-status-control');
 await control.locator('summary').click();
 await expect(control.locator('select option[value="confirmado"]')).toHaveCount(1);
 await expect(control.locator('select')).toBeVisible();
});
