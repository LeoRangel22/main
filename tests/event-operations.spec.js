const { test, expect } = require('@playwright/test');
const { collectBrowserErrors, expectNoBrowserErrors, expectNoHorizontalOverflow } = require('./support');
async function inbox(page) {
  await page.goto('/index.html?qa=1');
  await page.locator('#eventOperations summary').click();
  await page.locator('[data-ops-tab="inbox"]').click();
  await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');
}
test('planejar pendências não registra contato', async ({ page }) => {
  await inbox(page);
  const r = await page.evaluate(async () => {
    const item = getOpsItems().find(i => i.id === 'qa-proposal-sem-resposta'), o = getOpportunityForItem(item);
    const before = o.metadata?.first_reply_sent_at;
    await eventOpsRpc('plan_event_opportunities', { opportunity_ids: [o.id], owner_email: 'eventos@embaixadacarioca.com.br', action_text: 'Revisar proposta', due_at: new Date(Date.now()+3600000).toISOString() });
    return { owner:o.responsavel_email, action:o.proxima_acao, unchanged:o.metadata?.first_reply_sent_at===before };
  });
  expect(r).toEqual({owner:'eventos@embaixadacarioca.com.br',action:'Revisar proposta',unchanged:true});
});
test('mensagem recebida ganha prioridade e pode ser marcada como lida', async ({ page }) => {
  const errors=collectBrowserErrors(page); await inbox(page);
  await page.locator('[data-ops-record]').click();
  await page.locator('.event-ops-dialog [name="body"]').fill('Podemos trocar o cardápio?');
  await page.getByRole('button',{name:'Salvar registro',exact:true}).click();
  await expect(page.locator('.event-ops-thread')).toContainText('Podemos trocar o cardápio?');
  const r=await page.evaluate(()=>{const i=getOpsItems().find(i=>i.id==='qa-proposal-sem-resposta');return {incoming:!!getOpsIncoming(i),badge:getProposalFollowUpInfo(i),task:getActionTasks([i])[0].title};});
  expect(r.incoming).toBe(true);expect(r.badge).toBeNull();expect(r.task).toContain('Responder');
  await page.locator('[data-ops-read]').click();
  await expect(page.locator('.event-ops-thread')).not.toContainText('não lida');await expectNoBrowserErrors(errors);
});
test('contato manual exige confirmação de envio realizado',async({page})=>{
  await inbox(page);await page.locator('[data-ops-record]').click();
  const d=page.locator('.event-ops-dialog');await d.locator('[name="direction"]').selectOption('outbound');await d.locator('[name="body"]').fill('Contato realizado pelo WhatsApp');
  await d.getByRole('button',{name:'Salvar registro',exact:true}).click();await expect(d.locator('[role="alert"]')).toContainText('Confirme');
  await d.locator('[name="sent"]').check();await d.getByRole('button',{name:'Salvar registro',exact:true}).click();await expect(d).toHaveCount(0);
  await expect(page.locator('.event-ops-thread')).toContainText('Envio manual confirmado');
});
test('edição do rascunho invalida aprovação e resposta nova impede ação antiga',async({page})=>{
  await inbox(page);await page.evaluate(()=>{const o=state.opportunities.find(o=>o.id==='qa-opp-qa-proposal-sem-resposta');o.proxima_acao_em=null;o.ultimo_contato_em=null;});
  await page.locator('[data-ops-prepare]').click();const d=page.locator('.event-ops-dialog');await d.locator('[name="approved"]').check();await d.locator('[name="body"]').fill('Texto revisado com contexto do evento');await expect(d.locator('[name="approved"]')).not.toBeChecked();
  await d.locator('[name="approved"]').check();await page.evaluate(async()=>eventOpsRpc('record_event_message',{target_opportunity:'qa-opp-qa-proposal-sem-resposta',message_body:'Nova resposta',message_channel:'email',message_direction:'inbound',message_at:new Date().toISOString(),request_id:crypto.randomUUID()}));
  await d.getByRole('button',{name:'Executar ação revisada'}).click();await expect(d.locator('[role="alert"]')).toContainText('resposta mudou');
});
for(const width of [320,390,1440])test(`central comercial cabe em ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await inbox(page);await expectNoHorizontalOverflow(page);await page.locator('[data-ops-record]').click();await expectNoHorizontalOverflow(page);});
test('alternativas usam catálogo compatível e não alteram o carrinho',async({page})=>{
  await inbox(page);
  await page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"] .pipeline-open-button').click();
  const r=await page.evaluate(()=>{
    fields.eventType.value='Coquetel';state.selectedIds=new Set(['coquetel-caipirinha']);
    const ids=[...state.selectedIds],base=getQuoteTotals().total,candidates=getEventOfferCandidates(),candidate=candidates.find(i=>i.id==='welcome-caipirinha')||candidates[0];
    const options=buildEventOfferOptions([candidate.id]);return {ids:[...state.selectedIds],before:ids,base,options,compatible:candidates.every(i=>getAllowedCategoriesForEvent(getCurrentEventType()).includes(i.tipoEvento))};
  });
  expect(r.compatible).toBe(true);expect(r.ids).toEqual(r.before);expect(r.options).toHaveLength(2);expect(r.options[0].total).toBe(r.base);expect(r.options[1].total).toBeGreaterThan(r.base);
});
test('pré-reserva exige capacidade e preserva etapa comercial',async({page})=>{
  await inbox(page);await page.locator('[data-ops-tab="reservations"]').click();
  await page.locator('[data-ops-hold]').click();const d=page.locator('.event-ops-dialog');
  await d.locator('[name="until"]').fill(await page.evaluate(()=>opsLocalTime(new Date(Date.now()+3600000))));
  await d.getByRole('button',{name:'Verificar e pré-reservar'}).click();await expect(d.locator('[role="alert"]')).toContainText('Configure a capacidade');await d.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.locator('[data-ops-policy]').click();await page.locator('.event-ops-dialog [name="capacity"]').fill('120');await page.getByRole('button',{name:'Salvar regras',exact:true}).click();
  const before=await page.evaluate(()=>state.proposals.find(p=>p.id==='qa-proposal-sem-resposta').status);
  await page.locator('[data-ops-hold]').click();await page.locator('.event-ops-dialog [name="until"]').fill(await page.evaluate(()=>opsLocalTime(new Date(Date.now()+3600000))));await page.getByRole('button',{name:'Verificar e pré-reservar',exact:true}).click();
  await expect(page.locator('#eventOperations')).toContainText('Pré-reserva até');expect(await page.evaluate(()=>state.proposals.find(p=>p.id==='qa-proposal-sem-resposta').status)).toBe(before);
});
test('primeira resposta em inglês pede dados faltantes sem inventar preços',async({page})=>{
  await inbox(page);const draft=await page.evaluate(()=>buildFirstReplyDraft({cliente_nome:'Ana',tipo_evento:'Cocktail',snapshot:{cliente:{idioma:'en'}}}));expect(draft).toContain('Hello, Ana');expect(draft).toContain('what time');expect(draft).not.toContain('Olá');expect(draft).not.toContain('R$');
});
