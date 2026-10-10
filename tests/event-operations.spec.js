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
test('venda assistida monta três níveis cumulativos e explicáveis',async({page})=>{
  await inbox(page);
  await page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"] .pipeline-open-button').click();
  const result=await page.evaluate(()=>{
    fields.eventType.value='Coquetel';fields.eventDate.value='2028-10-24';fields.eventTime.value='17:00';fields.eventDuration.value='3';fields.guestCount.value='60';state.selectedIds=new Set(['coquetel-caipirinha']);
    const before=[...state.selectedIds],options=buildEventOfferOptions(getSuggestedEventOfferIds());
    return {before,after:[...state.selectedIds],names:options.map((item)=>item.name),totals:options.map((item)=>item.total),reasons:options.map((item)=>item.reason)};
  });
  expect(result.after).toEqual(result.before);
  expect(result.names).toEqual(['Essencial','Recomendada','Premium']);
  expect(result.totals[1]).toBeGreaterThan(result.totals[0]);
  expect(result.totals[2]).toBeGreaterThanOrEqual(result.totals[1]);
  expect(result.reasons[1].length).toBeGreaterThan(10);
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
test('inspeção de outra instância invalida a aprovação anterior',async({page})=>{
  await page.goto('/index.html?qa=1');
  const result=await page.evaluate(()=>{
    const dialog=document.createElement('div');dialog.innerHTML='<input name="account" value="instancia-digitada"><input name="approved" type="checkbox" checked>';
    applyInspectedChannelInstance(dialog,{instanceId:'instancia-inspecionada'});
    const changed={account:dialog.querySelector('[name="account"]').value,approved:dialog.querySelector('[name="approved"]').checked};
    dialog.querySelector('[name="approved"]').checked=true;
    applyInspectedChannelInstance(dialog,{instanceId:'instancia-inspecionada'});
    return{changed,unchangedApproved:dialog.querySelector('[name="approved"]').checked};
  });
  expect(result).toEqual({changed:{account:'instancia-inspecionada',approved:false},unchangedApproved:true});
});

test('venda assistida encerra edição quando a proposta foi vendida e bloqueia ação antiga',async({page})=>{
  await inbox(page);
  await page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"] .pipeline-open-button').click();
  const result=await page.evaluate(()=>{
    fields.eventType.value='Coquetel';fields.eventDate.value='2028-10-24';fields.eventTime.value='17:00';fields.eventDuration.value='3';fields.guestCount.value='60';state.selectedIds=new Set(['coquetel-caipirinha']);renderAll();renderEventOfferBuilder();
    const p=getActiveProposal(),button=document.querySelector('[data-offer-auto]');
    p.snapshot.publicOfferOptions=[{id:'essential',total:8000},{id:'premium',total:12000}];p.snapshot.offerConfiguration={itemIds:['welcome-caipirinha'],approvedAt:'2026-10-06T12:00:00Z'};
    const before=JSON.stringify(p.snapshot);
    p.status='confirmado';button.click();renderEventOfferBuilder();
    const saved=getProposalSnapshot();
    return {hidden:document.querySelector('#eventOfferBuilder').hidden,unchanged:before===JSON.stringify(p.snapshot),forced:state.forceNewVersionDraft,canEdit:canEditEventOffer(),preserved:JSON.stringify(saved.publicOfferOptions)===JSON.stringify(p.snapshot.publicOfferOptions)&&JSON.stringify(saved.offerConfiguration)===JSON.stringify(p.snapshot.offerConfiguration)};
  });
  expect(result).toEqual({hidden:true,unchanged:true,forced:false,canEdit:false,preserved:true});
});
test('evento cancelado com sinal não exibe tarefas operacionais',async({page})=>{
  await page.goto('/index.html?qa=1');
  const result=await page.evaluate(()=>{
    const p={status:'cancelado',snapshot:{pagamentoSinal:{valor:1000}}};
    return {cancelled:shouldShowOperationalChecklist(p),sold:shouldShowOperationalChecklist({...p,status:'confirmado'})};
  });
  expect(result).toEqual({cancelled:false,sold:true});
});

for(const outcome of ['cancelado','realizado'])test(`evento aberto recolhe checklist imediatamente ao ser ${outcome}`,async({page})=>{
  await page.goto('/index.html?qa=1');
  await page.getByRole('button',{name:'Visão completa'}).click();
  await page.locator('[data-pipeline-card-id="qa-proposal-sinal"]').click();
  await expect(page.locator('#operationalChecklist')).toBeVisible();
  if(outcome==='cancelado'){
    await page.evaluate(()=>{getCancelReason=async()=> 'Teste de cancelamento';return cancelPipelineItem('proposal',state.activeProposalId);});
  }else{
    await page.evaluate(async()=>{
      const p=getActiveProposal();p.data_evento='2020-01-01';p.snapshot.event.date='2020-01-01';
      requestPastEventOutcome=async()=>({outcome:'realizado',detail:'Evento concluído'});
      await classifyPastEvent('proposal',p.id);
    });
  }
  await expect(page.locator('#operationalChecklist')).toBeHidden();
});

test('fila diária inclui confirmados próximos e preserva planos e contatos',async({page})=>{
  await inbox(page);
  const result=await page.evaluate(()=>{
    const before=JSON.stringify(state.opportunities),items=getOpsWorkItems();
    return {ids:items.map(i=>i.id),after:JSON.stringify(state.opportunities),before};
  });
  expect(result.ids).toContain('qa-proposal-sinal');expect(result.after).toBe(result.before);
  await page.locator('[data-ops-tab="pending"]').click();await expect(page.locator('#eventOperations')).toContainText('comercial e operação');
  await page.locator('[data-ops-tab="closure"]').click();await expect(page.locator('#eventOperations')).toContainText('desfecho confirmado');
});
test('ficha de cliente não mistura homônimos ou contatos diferentes da mesma empresa',async({page})=>{
  await inbox(page);
  const lengths=await page.evaluate(()=>{
    const base={kind:'request',name:'Maria Silva',company:'Empresa X',status:'lead_recebido'};
    const rows=[{...base,id:'a',opportunityId:'oa',email:'a@example.test'},{...base,id:'b',opportunityId:'ob',email:'b@example.test'},{...base,id:'c',opportunityId:'oc'},{...base,id:'d',opportunityId:'od'}];
    return {separate:getClientRegistry(rows).length,same:getClientRegistry([{...base,id:'e',email:' A@example.test '},{...base,id:'f',email:'a@example.test'}]).length,phone:getClientRegistry([{...base,id:'g',phone:'(21) 99999-1111'},{...base,id:'h',phone:'+55 21 99999-1111'}]).length};
  });
  expect(lengths).toEqual({separate:4,same:1,phone:1});
});
test('aprovação final mostra corpo e invalida mudança de dados durante revisão',async({page})=>{
  await inbox(page);
  await page.evaluate(()=>{window.qaReviewResult=null;confirmClientSend({channel:'E-mail',destination:'review@example.test',subject:'Assunto exato',message:'Mensagem completa revisada\nLinha final',proposalUrl:'https://example.test/proposta'}).then(result=>window.qaReviewResult=result);});
  const d=page.locator('.send-confirm-dialog');await expect(d.locator('.send-confirm-message')).toHaveValue('Mensagem completa revisada\nLinha final');await expect(d).toContainText('Assunto exato');
  await d.locator('input[type="checkbox"]').check();await page.evaluate(()=>fields.clientEmail.value='changed@example.test');await d.getByRole('button',{name:'Confirmar envio'}).click();
  await expect.poll(()=>page.evaluate(()=>window.qaReviewResult)).toBe(false);
});
