const {test,expect}=require('@playwright/test');
async function setup(page){
 await page.route('https://**',route=>route.abort());
 await page.goto('/index.html?qa=1');
 await expect(page.locator('body')).not.toHaveClass(/auth-locked/);
 await expect(page.locator('[data-sales-mode="manual"]')).toBeVisible();
}
async function openPanel(page){if(!await page.locator('#consultativePanel').evaluate(n=>n.open))await page.locator('#consultativePanel > summary').click();}
async function manual(page){await page.evaluate(()=>{window.confirm=()=>true;startNewProposal();});await expect(page.locator('#consultativeOrigin')).toContainText('Cadastro manual');}
async function form(page){
 await page.evaluate(async()=>{
  const r=state.quoteRequests[0];if(!r)throw Error('Missing synthetic request fixture');
  Object.assign(r,{cliente_nome:'Ana Formulario',data_evento:'2099-11-20',horario_evento:'17:30',convidados:40,tipo_evento:'Coquetel',preferencias:'Vegetarianos',observacoes:'Cliente quer levar um bolo',motivo_evento:'Aniversário'});
  r.snapshot={origem:'formulario',cliente:{idioma:'pt'},evento:{extras:'DJ sujeito a consulta',preferencias:'Vegetarianos',observacoes:'Cliente quer levar um bolo'},qualificacao:{tipoCliente:'Cliente direto'}};
  await applyQuoteRequest(r.id);renderSalesGuide();
 });await openPanel(page);
}
test('manual and assisted modes share the same data and never force a form submission',async({page})=>{
 await setup(page);await manual(page);
 await page.locator('#clientName').fill('Ana manual');await page.locator('#eventDate').fill('2099-11-20');await page.locator('#notes').fill('Cliente quer conversar com tranquilidade');
 const before=await page.evaluate(()=>({name:fields.clientName.value,date:fields.eventDate.value,notes:fields.notes.value,source:state.manualSourceKey,request:state.activeQuoteRequestId,items:[...state.selectedIds]}));
 await page.locator('[data-sales-mode="guided"]').click();await expect(page.locator('#eventConfigSection')).toBeHidden();
 await page.locator('[data-sales-step="1"]').click();await expect(page.locator('#eventConfigSection')).toBeVisible();
 await page.locator('[data-sales-mode="manual"]').click();
 for(const id of ['clientDataSection','eventConfigSection','quoteItemsSection','quoteCalcSection','quoteTermsSection'])await expect(page.locator('#'+id)).toBeVisible();
 expect(await page.evaluate(()=>({name:fields.clientName.value,date:fields.eventDate.value,notes:fields.notes.value,source:state.manualSourceKey,request:state.activeQuoteRequestId,items:[...state.selectedIds]}))).toEqual(before);
 expect(before.request).toBe('');
});
test('partial manual quote can be saved from the guide and reopened with the entered details',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);
 await page.locator('#clientName').fill('Rascunho manual consultivo');await page.locator('#notes').fill('Ainda vamos definir a data e avaliar o bolo da família.');
 await page.locator('[data-consultative-action="draft"]').click();
 await expect.poll(()=>page.evaluate(()=>getActiveProposal()?.cliente_nome)).toBe('Rascunho manual consultivo');
 const row=await page.evaluate(()=>structuredClone(getActiveProposal()));expect(row.publication_status).toBe('draft');expect(row.solicitacao_id||null).toBeNull();expect(row.sent_at||null).toBeNull();
 await page.evaluate(id=>openSavedProposal(id),row.id);
 await expect(page.locator('#notes')).toHaveValue('Ainda vamos definir a data e avaliar o bolo da família.');
});
test('linked form keeps original briefing and allows manual editing of the same record',async({page})=>{
 await setup(page);await form(page);
 await expect(page.locator('#consultativeBrief')).toContainText('Vegetarianos');await expect(page.locator('#consultativeBrief')).toContainText('DJ sujeito a consulta');
 const request=await page.evaluate(()=>state.activeQuoteRequestId);
 await page.locator('[data-sales-mode="manual"]').click();await page.locator('#guestCount').fill('45');
 await expect(page.locator('#consultativeBrief')).toContainText('45 pessoas');expect(await page.evaluate(()=>state.activeQuoteRequestId)).toBe(request);
});
test('suggestion is editable and transfers to first reply without sending or recording contact',async({page})=>{
 await setup(page);await form(page);await page.evaluate(()=>{window.confirm=()=>true;});
 await page.locator('[data-consultative-action="suggest"]').click();
 const text=await page.locator('#consultativeReply').inputValue();expect(text).toContain('Vegetarianos');expect(text).toContain('DJ sujeito a consulta');expect(text).not.toContain('confirmar data desejada');
 await page.locator('#consultativeReply').fill(text+'\n\nVamos cuidar dos detalhes juntos.');
 await page.locator('[data-consultative-action="firstReply"]').click();
 await expect(page.locator('#firstReplyText')).toHaveValue(text+'\n\nVamos cuidar dos detalhes juntos.');
 expect(await page.evaluate(()=>state.firstReplyChannel)).toBe('');
});
test('operator can compose manually without invoking suggestions',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.locator('[data-consultative-action="write"]').click();
 await page.locator('#consultativeReply').fill('Olá! Entendi os detalhes e vou verificar as alternativas com nossa equipe.');
 await expect(page.locator('[data-consultative-action="copy"]')).toBeEnabled();
 await expect(page.locator('[data-consultative-action="firstReply"]')).toBeDisabled();
});
test('changing briefing retains edited text but requires a new explicit review before copying',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.locator('#consultativeReply').fill('Meu atendimento personalizado.');
 await page.locator('#guestCount').fill('45');
 await expect(page.locator('#consultativeReply')).toHaveValue('Meu atendimento personalizado.');await expect(page.locator('[data-consultative-action="copy"]')).toBeDisabled();
 await expect(page.locator('#consultativeStatus')).toContainText('O briefing mudou');
 await page.locator('[data-consultative-action="recheck"]').click();await expect(page.locator('[data-consultative-action="copy"]')).toBeEnabled();
});
test('regeneration cannot overwrite manual wording without consent',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.locator('#consultativeReply').fill('Texto escrito pela gerente.');
 await page.evaluate(()=>{window.confirm=()=>false;});await page.locator('[data-consultative-action="suggest"]').click();await expect(page.locator('#consultativeReply')).toHaveValue('Texto escrito pela gerente.');
});
test('new manual quotation clears ephemeral reply even when both records are otherwise blank',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.locator('#consultativeReply').fill('Detalhe exclusivo do cliente anterior');
 await page.locator('[data-consultative-action="new"]').click();await expect(page.locator('#consultativeReply')).toHaveValue('');
});
test('switching proposal removes prior client reply, without changing proposals',async({page})=>{
 await setup(page);await form(page);await page.locator('#consultativeReply').fill('Mensagem particular de Ana');
 await page.evaluate(()=>openSavedProposal(state.proposals.find(p=>p.id==='qa-proposal-sem-resposta').id));await expect(page.locator('#consultativeReply')).toHaveValue('');
});
test('internal notes and markup are not copied into the suggested client message',async({page})=>{
 await setup(page);await form(page);await page.locator('#notes').fill('CUSTO INTERNO: segredo; margem 32%.');
 await page.evaluate(()=>{const r=getActiveQuoteRequest();r.preferencias='<img src=x onerror="window.leaked=true">';state.sourceOverrides={};renderFormSourcePanel();renderSalesGuide();});
 await page.locator('[data-consultative-action="suggest"]').click();const text=await page.locator('#consultativeReply').inputValue();expect(text).not.toContain('segredo');expect(text).not.toContain('32%');expect(await page.evaluate(()=>window.leaked)).toBeUndefined();
 await expect(page.locator('#consultativeBrief img')).toHaveCount(0);
});
test('failure copying leaves a selectable manual fallback and never claims a send',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}},configurable:true}));
 await page.locator('#consultativeReply').fill('Texto para copiar manualmente');await page.locator('[data-consultative-action="copy"]').click();
 await expect(page.locator('#consultativeStatus')).toContainText('copie manualmente');await expect(page.locator('#consultativeReply')).toHaveValue('Texto para copiar manualmente');
});
test('logout clears private summary and draft; a delayed clipboard result cannot restore them',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.locator('#clientName').fill('Nome privado');await page.locator('#consultativeReply').fill('Rascunho privado');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>new Promise(r=>window.finishCopy=r)},configurable:true}));
 await page.locator('[data-consultative-action="copy"]').click();await page.evaluate(()=>{state.session=null;document.body.classList.add('auth-locked');});
 await expect(page.locator('#consultativePanel')).toBeHidden();await page.evaluate(()=>window.finishCopy());
 await expect(page.locator('#consultativeReply')).toHaveValue('');await expect(page.locator('#consultativeBrief')).toBeEmpty();await expect(page.locator('#consultativeStatus')).toBeEmpty();
});
test('review action reveals the existing gated send panel without saving or dispatching',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);const before=await page.evaluate(()=>state.proposals.length);
 await page.locator('[data-sales-mode="guided"]').click();await page.locator('[data-consultative-action="review"]').click();
 await expect(page.locator('#sendReviewPanel')).toBeVisible();expect(await page.evaluate(()=>state.proposals.length)).toBe(before);expect(await page.evaluate(()=>state.activeProposalId)).toBe('');
});
test('manual guidance and expanded intake fit 320px without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:320,height:850});await setup(page);await manual(page);await openPanel(page);
 await page.locator('#clientName').fill('Cliente com um nome extenso para teste de interface');await page.locator('[data-consultative-action="suggest"]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
