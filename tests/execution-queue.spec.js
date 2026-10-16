const {test,expect}=require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
test('execution queue exposes financial, readiness and historical actions without writing business facts',async({page})=>{
 const errors=collectBrowserErrors(page);await page.goto('/index.html?qa=1');
 const before=await page.evaluate(()=>{const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');p.snapshot.pagamentoSinal={valor:100,data:'2026-10-12',validacaoPendente:true};renderPipeline();return JSON.stringify(p);});
 await page.locator('#eventOperations summary').click();await page.locator('[data-ops-execution-filter="finance"]').click();await expect(page.locator('[data-execution-kind="finance"]')).toContainText('Sinal sem validação bancária');
 expect(await page.evaluate(()=>JSON.stringify(state.proposals.find(p=>p.id==='qa-proposal-sem-resposta')))).toBe(before);await expectNoBrowserErrors(errors);
});
test('bank review requires explicit credit confirmation and preserves the reported date',async({page})=>{
 await page.goto('/index.html?qa=1');await page.evaluate(()=>{window.bankDialog=showSignalPaymentDialog(1000,{defaultPreset:'custom',requireBankConfirmation:true,existingPayment:{valor:500,data:'2026-10-12'}});});
 const d=page.locator('.signal-modal');await expect(d.locator('[name="date"]')).toHaveValue('2026-10-12');await expect(d.locator('[name="amount"]')).toHaveValue('500,00');await expect(d.locator('[name="bankConfirmed"]')).not.toBeChecked();
 await d.getByRole('button',{name:'Confirmar sinal',exact:true}).click();await expect(d.locator('.signal-error')).toContainText('extrato');await d.locator('[data-signal-cancel]').click();expect(await page.evaluate(()=>window.bankDialog)).toBeNull();
});
test('prepared attendance requests approval and never invokes direct send',async({page})=>{
 await page.goto('/index.html?qa=1');await page.evaluate(()=>{const o=state.opportunities.find(o=>o.id==='qa-opp-qa-proposal-sem-resposta');o.proxima_acao_em=null;o.ultimo_contato_em=null;remoteProposalApprovalEnabled=async()=>true;loadEventOperations=async()=>{};refreshCommercialDashboard=async()=>{};loadCommercialInsights=async()=>{};loadOpsExecution=async()=>{};requestOpsDraftApproval=async(item,proposal,channel,destination,message)=>{window.serviceCall={channel,destination,message,proposalId:proposal.id};};});
 await page.locator('#eventOperations summary').click();await page.locator('[data-ops-tab="inbox"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');await page.locator('[data-ops-prepare]').click();
 const d=page.locator('.event-ops-dialog');await d.locator('[name="mode"]').selectOption('approval');await d.locator('[name="destination"]').fill('5521999999999');await d.locator('[name="body"]').fill('Mensagem revisada para o evento');await d.locator('[name="approved"]').check();await d.getByRole('button',{name:'Executar ação revisada'}).click();
 await expect(d).toHaveCount(0);const call=await page.evaluate(()=>window.serviceCall);expect(call).toMatchObject({channel:'whatsapp',destination:'5521999999999',message:'Mensagem revisada para o evento',proposalId:'qa-proposal-sem-resposta'});
});
for(const width of [320,390,1440])test(`execution queue fits ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await page.goto('/index.html?qa=1');await page.locator('#eventOperations summary').click();await expect(page.getByRole('heading',{name:'Executar agora',exact:true})).toBeVisible();await expectNoHorizontalOverflow(page);});
test('legacy signal shortcut validates the bank evidence without resetting an operational stage',async({page})=>{
 await page.goto('/index.html?qa=1');const result=await page.evaluate(async()=>{
  const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');p.status='planejamento';p.snapshot.pagamentoSinal={valor:p.total/2,validacaoPendente:true};let checked;
  validateOpsSignal=async id=>{checked=id;};await updateProposalStatus(p.id,'confirmado');return {checked,id:p.id,status:p.status};
 });expect(result.checked).toBe(result.id);expect(result.status).toBe('planejamento');
});
