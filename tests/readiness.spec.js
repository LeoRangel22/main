const {test,expect}=require('@playwright/test');const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
async function start(page){await page.goto('/index.html?qa=1');await page.locator('#eventOperations summary').click();}
async function journey(page){
 await page.evaluate(()=>{buildQaJourneyEvidence=proposal=>({proposal_id:proposal.id,revision:readinessRevision(proposal),is_current:true,generated_at:new Date().toISOString(),steps:Object.keys(journeyStepLabels).map(key=>({key,state:key==='dispatch'?'confirmed':key==='reply'?'manual':key==='payment'?'legacy':'pending',tasks:key==='operation'?8:undefined,acknowledged:0,completed:0}))});});
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
for(const width of [320,390,1440])test(`integration health distinguishes quarantine and disabled reception at ${width}px`,async({page})=>{
 const errors=collectBrowserErrors(page);await page.setViewportSize({width,height:900});await start(page);
 const before=await page.evaluate(()=>JSON.stringify([state.proposals,window.EventOperationsState.outbox]));
 await page.evaluate(()=>{Object.assign(readinessCache('channels'),{attemptedAt:Date.now(),data:{state:'not_checked',runtime:{observed_at:new Date().toISOString(),bridge:{state:'degraded',enabled:true,last_success_at:new Date().toISOString(),quarantined_total:2,quarantined_recent:1},mailbox:{state:'disabled',enabled:false,last_success_at:null}}}});});
 await page.locator('[data-ops-tab="channels"]').click();
 await expect(page.locator('[data-integration-health="bridge"]')).toContainText('Consulta recente com eventos em quarentena');
 await expect(page.locator('[data-integration-health="mailbox"]')).toContainText('Desativada');
 await expect(page.locator('[data-bridge-quarantine]')).toContainText('não reenvie o histórico');
 await expectNoHorizontalOverflow(page);await expectNoBrowserErrors(errors);
 expect(await page.evaluate(()=>JSON.stringify([state.proposals,window.EventOperationsState.outbox]))).toBe(before);
});
test('cached integration success ages into stale and a failed refresh cannot remain green',async({page})=>{
 await start(page);await page.evaluate(()=>{Object.assign(readinessCache('channels'),{attemptedAt:Date.now(),data:{state:'not_checked',runtime:{observed_at:new Date().toISOString(),bridge:{state:'observed',enabled:true,last_success_at:new Date(Date.now()-16*60000).toISOString(),quarantined_total:0,quarantined_recent:0},mailbox:{state:'disabled',enabled:false,last_success_at:null}}}});});
 await page.locator('[data-ops-tab="channels"]').click();await expect(page.locator('[data-integration-health="bridge"]')).toHaveAttribute('data-health-state','stale');
 await page.evaluate(()=>{readinessCache('channels').error='Synthetic refresh failure';renderEventOperations();});
 await expect(page.locator('[data-integration-health="bridge"]')).toHaveAttribute('data-health-state','unknown');
 await expect(page.getByRole('region',{name:'Diagnóstico das integrações'})).not.toContainText('Consulta autenticada recente');
});
test('unavailable journey keeps other actions usable and does not invent successful evidence',async({page})=>{
 await start(page);await page.evaluate(()=>{buildQaJourneyEvidence=()=>{throw Error('Fixture offline')};});await page.locator('[data-ops-tab="journey"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');await expect(page.locator('#eventOperations [role="alert"]')).toContainText('offline');await expect(page.locator('[data-journey-step]')).toHaveCount(0);await page.locator('[data-ops-tab="pending"]').click();await expect(page.locator('[data-ops-bulk]')).toBeVisible();
});
test('reservation review requires a manager decision and QA cannot create a real booking',async({page})=>{
 await start(page);await page.evaluate(()=>{state.proposals.find(p=>p.id==='qa-proposal-sem-resposta').status='confirmado';});await journey(page);
 await page.locator('[data-ops-journey-reserve]').click();const d=page.locator('.event-ops-dialog');await expect(d.locator('[name="reviewed"]')).not.toBeChecked();await d.getByRole('button',{name:'Verificar e confirmar reserva',exact:true}).click();await expect(d).toBeVisible();await expect(d.locator('[name="reviewed"]')).not.toBeChecked();await d.locator('[name="reviewed"]').check();await d.getByRole('button',{name:'Verificar e confirmar reserva',exact:true}).click();await expect(d.locator('[role="alert"]')).toContainText('QA');await d.getByRole('button',{name:'Voltar',exact:true}).click();
 expect(await page.evaluate(()=>window.EventOperationsState.reservations.length)).toBe(0);
});

test('built-in QA can inspect a proposal journey without external RPCs or manual test patching',async({page})=>{await start(page);await page.evaluate(()=>{window.qaJourneyRpcCalls=0;state.supabase.rpc=async()=>{window.qaJourneyRpcCalls++;throw Error('Unexpected external call')};});await page.locator('[data-ops-tab="journey"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');await expect(page.locator('[data-journey-step]')).toHaveCount(10);await expect(page.locator('#eventOperations')).toContainText('Dados fictícios do modo QA');expect(await page.evaluate(()=>window.qaJourneyRpcCalls)).toBe(0);});

test('ordinary seller autonomy is explicit and never disguises a commercial discount exception',async({page})=>{
 await start(page);await page.locator('[data-ops-tab="journey"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');
 await expect(page.locator('[data-journey-step="approval"]')).toContainText('Não exigida pela política atual');
 await page.evaluate(()=>{const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');p.snapshot.totals={...p.snapshot.totals,adjustment:-2000};});await page.locator('[data-ops-journey-refresh]').click();await expect(page.locator('[data-journey-step="approval"]')).toContainText('Pendente');
});
