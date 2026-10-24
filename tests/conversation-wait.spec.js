const {test,expect}=require('@playwright/test');
const {expectNoHorizontalOverflow}=require('./support');
async function setup(page){
 await page.goto('/index.html?qa=1');
 await page.locator('#eventOperations summary').click();
 await page.locator('[data-ops-tab="inbox"]').click();
 await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');
 await page.evaluate(()=>{
  eventOps.messages=[{id:'inbound-fixture',opportunity_id:eventOps.opportunity,channel:'whatsapp',direction:'inbound',source:'provider',body:'Pode confirmar os detalhes?',occurred_at:new Date(Date.now()-7200000).toISOString()}];
  eventOps.loadedFor=state.session.user.id;eventOps.error='';eventOps.loading=null;renderEventOperations();
 });
}
test('cross-channel reply changes waiting party; marking read alone does not',async({page})=>{
 await setup(page);
 const summary=page.getByRole('region',{name:'Acompanhamento da conversa'});
 await expect(summary).toContainText('Equipe precisa retornar');await expect(summary).toContainText('2 h');
 await page.locator('[data-ops-read]').click();await expect(summary).toContainText('Equipe precisa retornar');
 await page.evaluate(()=>{eventOps.messages.push({id:'outbound-fixture',opportunity_id:eventOps.opportunity,channel:'email',direction:'outbound',source:'provider',body:'Detalhes confirmados.',occurred_at:new Date(Date.now()-600000).toISOString(),delivery_status:'accepted'});renderEventOperations();});
 await expect(summary).toContainText('Equipe aguarda retorno');await expect(summary).toContainText('10 min');await expect(summary).toContainText('entrega');await expect(summary).toContainText('email');
 await expect(page.locator('.event-ops-thread article')).toHaveCount(2);
 await expect(page.locator('.event-ops-thread')).toContainText('Pode confirmar');await expect(page.locator('.event-ops-thread')).toContainText('Detalhes confirmados');
});
test('stale data or another session hides responsibility and elapsed time',async({page})=>{
 await setup(page);const summary=page.getByRole('region',{name:'Acompanhamento da conversa'});
 await page.evaluate(()=>{eventOps.error='fixture refresh error';renderEventOperations();});await expect(summary).toContainText('Atualize a conversa');await expect(summary).not.toContainText('Desde');
 await page.evaluate(()=>{eventOps.error='';eventOps.loadedFor='another-user';renderEventOperations();});await expect(summary).toContainText('Atualize a conversa');await expect(summary).not.toContainText('Desde');
});
test('legacy public reply is shown once and another event cannot change the wait',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');p.cliente_resposta_em=new Date(Date.now()-300000).toISOString();p.cliente_resposta='alteracao';p.cliente_mensagem='Resposta pelo link de teste';eventOps.messages.push({id:'other-event',opportunity_id:'unrelated',direction:'outbound',channel:'email',source:'provider',body:'Other event',occurred_at:new Date().toISOString(),delivery_status:'delivered'});renderEventOperations();});
 const summary=page.getByRole('region',{name:'Acompanhamento da conversa'});await expect(summary).toContainText('Equipe precisa retornar');await expect(summary).toContainText('Resposta pelo link');
 await expect(page.locator('.event-ops-thread article')).toHaveCount(2);
 await page.evaluate(()=>{const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');eventOps.messages.push({id:'public-fixture',opportunity_id:eventOps.opportunity,proposal_id:p.id,direction:'inbound',channel:'link',source:'public',body:'Resposta pelo link de teste',occurred_at:p.cliente_resposta_em});renderEventOperations();});
 await expect(page.locator('.event-ops-thread article')).toHaveCount(2);
});
test('conversation summary fits a mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:900});await setup(page);await expectNoHorizontalOverflow(page);
});
