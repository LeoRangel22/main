const {test,expect}=require('@playwright/test');const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
async function start(page){await page.goto('/index.html?qa=1');await page.locator('#eventOperations summary').click();}
async function journey(page){
 await page.evaluate(()=>{const original=state.supabase.rpc.bind(state.supabase);state.supabase.rpc=async(name,args)=>{
  if(name==='event_journey_evidence')return {data:{proposal_id:args.target_proposal,revision:args.expected_revision,is_current:true,generated_at:new Date().toISOString(),steps:Object.keys(journeyStepLabels).map(key=>({key,state:key==='dispatch'?'confirmed':key==='reply'?'manual':key==='payment'?'legacy':'pending',tasks:key==='operation'?8:undefined,acknowledged:0,completed:0}))}};
  return original(name,args);
 };});
 await page.locator('[data-ops-tab="journey"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');
}
test('journey separates accepted, delivered, manual contact and legacy finance without business writes',async({page})=>{
 const errors=collectBrowserErrors(page);await start(page);const before=await page.evaluate(()=>JSON.stringify([state.proposals,window.EventOperationsState.outbox]));await journey(page);
 await expect(page.locator('[data-journey-step="dispatch"]')).toContainText('Evidência registrada');await expect(page.locator('[data-journey-step="delivery"]')).toContainText('Pendente');await expect(page.locator('[data-journey-step="reply"]')).toContainText('manualmente');await expect(page.locator('[data-journey-step="payment"]')).toContainText('legado');await expect(page.locator('[data-journey-step="operation"]')).toContainText('0/8');
 expect(await page.evaluate(()=>JSON.stringify([state.proposals,window.EventOperationsState.outbox]))).toBe(before);await expectNoBrowserErrors(errors);
});
test('channel diagnostics expose setup blockers and never claim real homologation',async({page})=>{
 await start(page);await page.evaluate(()=>{const c=readinessCache('channels');Object.assign(c,{attemptedAt:Date.now(),data:{id:'batch',requested_at:new Date().toISOString(),bridge:{state:'blocked',bridge_url:false,bridge_secret:false,bridge_reachable:false},delivery:{state:'observed',whatsapp_connected:false,email_oauth:false,foreign_callbacks:true}}});});
 await page.locator('[data-ops-tab="channels"]').click();const d=page.getByRole('region',{name:'Diagnóstico das integrações'});await expect(d).toContainText('Desconectado');await expect(d).toContainText('Pendente');await expect(d).toContainText('Preserve-os');await expect(d).not.toContainText('Homologado');
});
for(const width of [320,390,1440])test(`journey and diagnostic evidence fit ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await start(page);await journey(page);await expect(page.locator('[data-journey-step="operation"]')).toBeVisible();await expectNoHorizontalOverflow(page);await page.locator('[data-ops-tab="channels"]').click();await expectNoHorizontalOverflow(page);});
test('unavailable journey keeps other actions usable and does not invent successful evidence',async({page})=>{
 await start(page);await page.evaluate(()=>{state.supabase.rpc=async()=>({error:{message:'Fixture offline'}});});await page.locator('[data-ops-tab="journey"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');await expect(page.locator('#eventOperations [role="alert"]')).toContainText('offline');await expect(page.locator('[data-journey-step]')).toHaveCount(0);await page.locator('[data-ops-tab="pending"]').click();await expect(page.locator('[data-ops-bulk]')).toBeVisible();
});
