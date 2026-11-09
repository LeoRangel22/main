const {test,expect}=require('@playwright/test');
const {isolateJourney,clean,proposal,publicProposal}=require('./client-journey-fixtures.cjs');
const {diagnoseOverflow}=require('./overflow-diagnostics.cjs');
async function expectPageWidth(page){const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));if(size.scroll>size.width+1)throw new Error('Page overflow '+JSON.stringify({size,diagnostics:await diagnoseOverflow(page)}));}
const token='00000000-0000-4000-8000-000000000303';
for(const [lang,labels]of[['pt',['Data e grupo','Contato']],['en',['Date & group','Contact']],['es',['Fecha y grupo','Contacto']]]){
 test('essential progress and invalid-field focus '+lang,async({page})=>{
  const audit=await isolateJourney(page);await page.goto('/formulario.html?lang='+lang);
  await expect(page.locator('.public-form-steps li')).toHaveCount(2);
  await expect(page.locator('.public-form-steps em')).toHaveText(labels);
  await expect(page.locator('.public-form-steps li').first()).toBeVisible();
  await expect(page.locator('.form-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow','0');
  await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#requestEventDate')).toBeFocused();
  await expect(page.locator('#requestEventDate')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#requestEventDate')).toBeInViewport({ratio:1});
  await page.locator('#requestEventDate').fill('2099-11-20');await expect(page.locator('.form-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow','1');await page.locator('#submitClientQuoteBtn').click();
  await expect(page.locator('#requestClientName')).toBeFocused();
  await page.locator('#requestClientName').fill('Synthetic Visitor');await page.locator('#submitClientQuoteBtn').click();
  await expect(page.locator('#requestClientEmail')).toBeFocused();
  const other=lang==='en'?'es':'en';await page.locator('[data-lang="'+other+'"]').focus();await page.locator('[data-lang="'+other+'"]').press('Enter');
  await expect(page.locator('[data-lang="'+other+'"]')).toBeFocused();
  await expect(page.locator('#clientFormStatus')).toHaveAttribute('data-status','error');
  await page.locator('#requestClientEmail').fill('not-an-email');await page.locator('#submitClientQuoteBtn').click();
  await expect(page.locator('#requestClientEmail')).toBeFocused();
  expect(audit.calls).toEqual([]);clean(audit);
 });
}
test('optional choices advance explicitly and survive language changes',async({page})=>{
 const audit=await isolateJourney(page);await page.goto('/formulario.html?lang=pt');
 await page.locator('#requestTimeRange').selectOption('night');await page.locator('#requestGuestCount').fill('2');
 await page.locator('#formPersonalizeNav').click();await expect(page.locator('#momentTitle')).toBeFocused();
 const morning=page.locator('[data-choice-value="weekday-morning"]');await morning.focus();await morning.press('Enter');await expect(morning).toBeFocused();
 await expect(page.locator('#requestTimeRange')).toHaveValue('night');
 await page.locator('#momentStep [data-form-next]').click();await expect(page.locator('#profileStep h2')).toBeFocused();
 await page.locator('[data-choice-value="company"]').click();await page.locator('[data-choice-value="corporate"]').click();await page.locator('[data-choice-value="celebration"]').click();
 await page.locator('#profileStep [data-form-next]').click();await expect(page.locator('#recommendationTitle')).toBeFocused();
 await page.locator('[data-format-id="breakfast"]').click();await expect(page.locator('[data-format-id="breakfast"]')).toBeFocused();
 await page.locator('#recommendationStep [data-form-next]').click();await expect(page.locator('#briefingStep h2')).toBeFocused();
 await page.locator('#requestNotes').fill('Synthetic preferences kept.');
 await page.locator('#briefingStep [data-form-next]').click();await expect(page.locator('#finalReviewTitle')).toBeFocused();
 await expect(page.locator('.form-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow','0');
 for(const lang of ['en','es','pt']){
  await page.locator('[data-lang="'+lang+'"]').click();
  await expect(page.locator('#requestNotes')).toHaveValue('Synthetic preferences kept.');
  await expect(page.locator('#requestEventType')).toHaveValue('Café da Manhã / Brunch');
  await expect(page.locator('#requestTimeRange')).toHaveValue('night');
  await expect(page.locator('[data-choice-value="corporate"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-choice-value="celebration"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#timeRangeHelp')).not.toBeEmpty();
  await expect(page).toHaveURL(new RegExp('lang='+lang));
 }
 expect(audit.calls).toEqual([]);clean(audit);
});
test('form anchors preserve keyboard focus and browser history',async({page})=>{
 const audit=await isolateJourney(page);await page.goto('/formulario.html');
 await page.locator('#quickPathLink').click();await expect(page).toHaveURL(/#eventDetailsStep$/);await expect(page.locator('#eventDetailsStep h2')).toBeFocused();
 await page.locator('#quickContactLink').click();await expect(page).toHaveURL(/#contactStep$/);await expect(page.locator('#contactStep h2')).toBeFocused();
 await page.goBack();await expect(page).toHaveURL(/#eventDetailsStep$/);await expect(page.locator('#eventDetailsStep h2')).toBeFocused();
 await page.goForward();await expect(page).toHaveURL(/#contactStep$/);await expect(page.locator('#contactStep h2')).toBeFocused();
 await page.locator('#contactStep [data-form-next]').click();await expect(page.locator('#finalReviewTitle')).toBeFocused();
 expect(audit.calls).toEqual([]);clean(audit);
});
test('form uses page flow at four widths and enlarged Spanish text',async({page})=>{
 const audit=await isolateJourney(page);await page.goto('/formulario.html?lang=es');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:844});
  await expectPageWidth(page);
  await expect(page.locator('.public-form-actions')).toHaveCSS('position','static');
 }
 await page.setViewportSize({width:320,height:740});await page.addStyleTag({content:'html{font-size:200%}'});
 await expectPageWidth(page);
 await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#requestEventDate')).toBeFocused();
 expect(audit.calls).toEqual([]);clean(audit);
});
test('two-step progress preserves granular draft capture context',async({page})=>{
 const audit=await isolateJourney(page);await page.goto('/formulario.html?lang=pt');
 await page.locator('#requestEventDate').fill('2099-11-20');await page.locator('#requestClientName').fill('Synthetic Visitor');await page.locator('#requestClientEmail').fill('visitor@example.test');
 await expect(page.locator('#partialCaptureStatus')).toContainText('salvo e confirmado');
 await page.locator('#formPersonalizeNav').click();
 await page.locator('#momentStep [data-form-next]').click();await page.locator('#profileStep [data-form-next]').click();await page.locator('#recommendationStep [data-form-next]').click();
 await page.locator('#requestNotes').fill('Synthetic detailed preferences.');
 await expect.poll(()=>audit.calls.filter(c=>c.name==='upsert_public_quote_draft').at(-1)?.payload.p_snapshot.evento.observacoes).toContain('Synthetic detailed preferences.');
 await expect(page.locator('#partialCaptureStatus')).toContainText('salvo e confirmado');
 await expect(page.locator('.public-form-steps li')).toHaveCount(2);
 expect(audit.calls.filter(c=>c.name==='upsert_public_quote_draft').at(-1).payload.p_last_step).toBe('briefing');
 await page.locator('#briefingStep [data-form-next]').click();await expect(page.locator('#finalReviewTitle')).toBeFocused();
 expect(audit.calls.filter(c=>c.name==='submit_public_quote_request')).toHaveLength(0);clean(audit);
});
for(const lang of ['pt','en'])test('public read-only navigation and adjustment draft '+lang,async({page})=>{
 const fixture=proposal();fixture.snapshot.publicOfferOptions=[{base:true,name:'Current',total:2240},{base:false,name:'Synthetic Workshop',description:'Synthetic alternative',total:2800}];
 const audit=await publicProposal(page,fixture);await page.goto('/proposta.html?p='+token+'&lang='+lang);
 await expect(page.locator('.public-proposal-summary')).toBeVisible();
 await page.locator('.public-proposal-nav [href="#publicProposalItems"]').click();await expect(page.locator('#publicProposalItems h3')).toBeFocused();
 await page.locator('.public-proposal-nav [href="#commercialTerms"]').click();await expect(page.locator('#commercialTerms')).toHaveAttribute('open','');await expect(page.locator('#commercialTerms > summary')).toBeFocused();
 await page.locator('#commercialTerms > summary').press('Tab');await expect(page.locator('#commercialTerms [href="#decisionActions"]')).toBeFocused();
 await page.locator('#commercialTerms [href="#decisionActions"]').press('Shift+Tab');await expect(page.locator('#commercialTerms > summary')).toBeFocused();
 await page.locator('#commercialTerms [href="#decisionActions"]').click();await expect(page.locator('#decisionActions > .public-proposal-actions-copy h3')).toBeFocused();
 await page.locator('[data-request-offer="1"]').click();await expect(page.locator('#publicProposalResponseForm')).toBeVisible();
 await page.locator('#publicCancelResponse').click();await expect(page.locator('[data-request-offer="1"]')).toBeFocused();
 await page.locator('[data-public-action="alteracao"]').click();await expect(page.locator('#publicRequestedDate')).toBeFocused();
 await page.locator('#publicRequestedDate').fill('2099-11-21');await page.locator('#publicRequestedTime').fill('19:00');await page.locator('#publicRequestedGuests').fill('45');await page.locator('#publicResponseMessage').fill('Synthetic request without commercial acceptance.');
 const other=lang==='pt'?'en':'pt';await page.locator('[data-proposal-lang="'+other+'"]').focus();await page.locator('[data-proposal-lang="'+other+'"]').press('Enter');
 await expect(page.locator('#publicProposalResponseForm')).toBeVisible();await expect(page.locator('#publicRequestedDate')).toHaveValue('2099-11-21');await expect(page.locator('#publicRequestedTime')).toHaveValue('19:00');await expect(page.locator('#publicRequestedGuests')).toHaveValue('45');await expect(page.locator('#publicResponseMessage')).toHaveValue('Synthetic request without commercial acceptance.');
 await expect(page.locator('[data-proposal-lang="'+other+'"]')).toBeFocused();
 await page.locator('#publicCancelResponse').click();await expect(page.locator('#publicProposalResponseForm')).toBeHidden();await expect(page.locator('[data-public-action="alteracao"]')).toBeFocused();
 await page.locator('[data-public-action="alteracao"]').click();await expect(page.locator('#publicResponseMessage')).toHaveValue('Synthetic request without commercial acceptance.');
 expect(audit.calls.filter(c=>c.name==='respond_public_proposal_v2')).toHaveLength(0);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});await expectPageWidth(page);}
 await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%}'});await expectPageWidth(page);
 clean(audit);
});
test('pending submission blocks language remount and preserves an uncertain result',async({page})=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const audit=await publicProposal(page,proposal(),{respond:()=>pending});
 await page.goto('/proposta.html?p='+token);await page.locator('[data-public-action="alteracao"]').click();
 await page.locator('#publicResponseMessage').fill('Synthetic pending request.');await page.locator('#publicSubmitResponse').click();
 await expect.poll(()=>audit.calls.filter(c=>c.name==='respond_public_proposal_v2').length).toBe(1);
 await page.locator('[data-proposal-lang="en"]').click();await expect(page.locator('html')).toHaveAttribute('lang','pt-BR');
 await page.locator('#publicProposalResponseForm').dispatchEvent('submit');
 expect(audit.calls.filter(c=>c.name==='respond_public_proposal_v2')).toHaveLength(1);
 release({data:null,error:{message:'Synthetic transport failure'}});
 await expect(page.locator('#publicProposalStatus')).toHaveAttribute('data-status','error');
 const warning=await page.locator('#publicProposalStatus').innerText();await page.locator('[data-proposal-lang="en"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#publicResponseMessage')).toHaveValue('Synthetic pending request.');await expect(page.locator('#publicProposalStatus')).toHaveText(warning);
 expect(audit.calls.filter(c=>c.name==='respond_public_proposal_v2')).toHaveLength(1);clean(audit);
});
test('deposit receipt form stays open on language change without submission',async({page})=>{
 const fixture=proposal();fixture.status='negociacao';fixture.cliente_resposta='confirmar';fixture.cliente_solicitacao={comprovante:null};
 const audit=await publicProposal(page,fixture);await page.goto('/proposta.html?p='+token);
 await page.locator('[data-upload-proof]').click();await expect(page.locator('#publicLaterProofForm')).toBeVisible();
 await page.locator('[data-proposal-lang="en"]').click();await expect(page.locator('#publicLaterProofForm')).toBeVisible();
 expect(audit.calls.filter(c=>['respond_public_proposal_v2','submit_public_signal_proof'].includes(c.name))).toHaveLength(0);clean(audit);
});
