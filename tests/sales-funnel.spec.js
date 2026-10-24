const {test,expect}=require('@playwright/test');
const {expectNoHorizontalOverflow}=require('./support');
async function setup(page){
 await page.route('https://**',route=>route.abort());await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const template=structuredClone(state.proposals.find(p=>p.id==='qa-proposal-sem-resposta'));
  const make=(id,changes={})=>({...structuredClone(template),id,oportunidade_id:id,solicitacao_id:null,cliente_nome:`Fixture ${id}`,data_evento:'2099-11-04',status:'negociacao',is_current:true,publication_status:'sent',versao:1,sent_at:null,cliente_resposta:null,cliente_resposta_em:null,cliente_solicitacao:null,snapshot:{...structuredClone(template.snapshot),clienteResposta:null,pagamentoSinal:null,pagamentoRestante:null},...changes});
  state.proposals=[make('approved',{cliente_resposta:'confirmar'}),make('change',{cliente_resposta:'alteracao'}),make('waiting',{status:'proposta_enviada',sent_at:'2026-01-01T12:00:00Z'}),make('unsent',{status:'proposta_enviada'}),make('ready',{status:'proposta_pronta',publication_status:'ready'}),make('proof',{status:'confirmado',snapshot:{...structuredClone(template.snapshot),pagamentoSinal:{valor:500,validacaoPendente:true},pagamentoRestante:null}})];
  state.quoteRequests=[];state.opportunities=[];eventOps.messages=[];eventOps.loadedFor=state.session.user.id;eventOps.error='';eventOps.loading=null;state.activePipelineFilter='all';renderPipeline();
 });
}
test('sales overview separates approval, revision, recorded send and unverified send',async({page})=>{
 await setup(page);const root=page.locator('#salesFunnelOverview');await expect(root).toBeVisible();
  expect(await root.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('#commercialCalendar')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 for(const id of ['approved','changes','waiting','review','ready','validation'])await expect(root.locator(`[data-sales-funnel="${id}"] strong`)).toHaveText('1');
 await expect(root.locator('[data-sales-funnel="preparation"] strong')).toHaveText('0');
 await expect(root.locator('[data-sales-funnel="won"] strong')).toHaveText('0');
 const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 await root.locator('[data-sales-funnel="approved"]').click();await expect(root.locator('[data-sales-funnel="approved"]')).toBeFocused();
 await expect(page.locator('#pipelineBoard .pipeline-card')).toHaveCount(1);await expect(page.locator('#pipelineBoard .pipeline-card')).toContainText('Fixture approved');
  await expect(page.locator('#pipelineBoard [data-sales-state="approved"]')).toContainText('Aprovadas · aguardam sinal');
  await page.locator('#pipelineBoard .pipeline-card-details > summary').click();
  await expect(page.locator('#pipelineBoard .pipeline-sales-evidence')).toBeVisible();
  await expect(page.locator('#pipelineBoard .pipeline-sales-evidence')).toContainText('Aprovação ainda não é sinal recebido');
 await root.locator('[data-sales-funnel="changes"]').click();await expect(page.locator('#pipelineBoard .pipeline-card')).toHaveCount(1);await expect(page.locator('#pipelineBoard .pipeline-card')).toContainText('Fixture change');
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);
});
test('signal filter excludes unapproved proposals and pending proof validation',async({page})=>{
 await setup(page);await page.locator('[data-pipeline-filter="awaitingSignal"]').click();
 await expect(page.locator('#pipelineBoard .pipeline-card')).toHaveCount(1);await expect(page.locator('#pipelineBoard .pipeline-card')).toContainText('Fixture approved');
});
test('fresh cross-channel response moves waiting to reply, stale or foreign session messages are ignored',async({page})=>{
 await setup(page);await page.evaluate(()=>{eventOps.messages=[{id:'reply',opportunity_id:'waiting',direction:'inbound',source:'provider',channel:'whatsapp',body:'Dúvida sintética',occurred_at:new Date().toISOString()}];renderPipeline();});
 await expect(page.locator('[data-sales-funnel="reply"] strong')).toHaveText('1');await expect(page.locator('[data-sales-funnel="waiting"] strong')).toHaveText('0');
 await page.evaluate(()=>{eventOps.loadedFor='another-session';renderPipeline();});await expect(page.locator('[data-sales-funnel="reply"] strong')).toHaveText('0');
 await page.evaluate(()=>{eventOps.loadedFor=state.session.user.id;eventOps.error='Fixture error';renderPipeline();});await expect(page.locator('[data-sales-funnel="reply"] strong')).toHaveText('0');
});
test('overview is usable on mobile and clears customer data after logout',async({page})=>{
 await page.setViewportSize({width:390,height:900});await setup(page);await expectNoHorizontalOverflow(page);
 await page.locator('[data-sales-funnel="validation"]').click();await expect(page.locator('#pipelineBoard .pipeline-card')).toHaveCount(1);await expect(page.locator('#pipelineBoard .pipeline-card')).toContainText('Comprovante pendente');
 await page.evaluate(()=>{state.session=null;renderPipeline();});await expect(page.locator('#salesFunnelOverview')).toBeHidden();await expect(page.locator('#salesFunnelOverview')).toHaveText('');
});
