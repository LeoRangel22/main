const {test,expect}=require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
async function open(page){
 await page.route('https://**',route=>route.abort());await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');
  Object.assign(p,{status:'negociacao',publication_status:'ready',is_current:true,revision:1,sent_at:null});
  openSavedProposal(p.id);markEditorClean();window.fixtureProposal=structuredClone(p);
 });
}
test('manual sending a ready negotiation records this version and leaves preparation without manufacturing a payment',async({page})=>{
 const errors=collectBrowserErrors(page);await open(page);
 await page.locator('#manualSendBtn').click();const dialog=page.locator('dialog');
 await dialog.locator('[name=channel]').selectOption('WhatsApp');await dialog.locator('[name=sent]').check();
 await dialog.getByRole('button',{name:'Registrar envio',exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await page.evaluate(()=>{const p=state.proposals.find(p=>p.id===window.fixtureProposal.id);const item=getPipelineItems().find(x=>x.id===p.id);return {status:p.status,publication:p.publication_status,sent:Boolean(p.sent_at),state:getSalesFunnelState(item)?.id,signal:p.snapshot.pagamentoSinal||null,history:getCommercialHistory(p.snapshot).map(x=>x.title)};});
 expect(result.status).toBe('negociacao');expect(result.publication).toBe('sent');expect(result.sent).toBe(true);expect(result.state).toBe('waiting');expect(result.signal).toBeNull();expect(result.history).toContain('Envio manual registrado');await expectNoBrowserErrors(errors);
});
for(const width of [390,1440])test(`paused automatic send has a durable explicit result and preserves the stage at ${width}px`,async({page})=>{
 const errors=collectBrowserErrors(page);await page.setViewportSize({width,height:1000});await open(page);
 await page.evaluate(()=>{
  state.supabase.functions.invoke=async()=>({data:null,error:{message:'non-2xx',context:new Response(JSON.stringify({ok:false,deliveryStatus:'paused'}),{status:409,headers:{'Content-Type':'application/json'}})}});
  window.attempt=sendProposalWhatsAppViaZapi({proposal:window.fixtureProposal,proposalUrl:'https://example.test/proposta',message:'Proposta sintética para revisão'});
 });
 const confirm=page.locator('.send-confirm-dialog');await confirm.locator('input[type=checkbox]').check();await confirm.getByRole('button',{name:'Confirmar envio',exact:true}).click();
 await expect(page.locator('.proposal-send-result')).toContainText('Proposta não enviada: canal pausado');
 await expect(page.locator('.proposal-send-result')).toContainText('registrar o envio manual');
 const result=await page.evaluate(async()=>{await window.attempt;const p=state.proposals.find(p=>p.id===window.fixtureProposal.id);return {sent:p.sent_at,publication:p.publication_status};});
 expect(result).toEqual({sent:null,publication:'ready'});
 await page.getByRole('button',{name:'Entendi, voltar ao orçamento'}).click();
 await expect(page.locator(`[data-proposal-send-feedback="qa-proposal-sem-resposta"]`)).toContainText('Proposta não enviada');await expectNoHorizontalOverflow(page);await expectNoBrowserErrors(errors);
});
test('manual confirmation cannot stamp a changed proposal or new session',async({page})=>{
 await open(page);await page.locator('#manualSendBtn').click();const d=page.locator('dialog');await d.locator('[name=channel]').selectOption('E-mail');await d.locator('[name=sent]').check();
 await page.evaluate(()=>{state.session.user.id='other-user';});await d.getByRole('button',{name:'Registrar envio',exact:true}).click();
 await expect(d.locator('.manual-send-error')).toContainText('sessão mudou');expect(await page.evaluate(()=>state.proposals.find(p=>p.id===window.fixtureProposal.id).sent_at)).toBeNull();
});
