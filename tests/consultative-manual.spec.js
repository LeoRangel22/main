const {test,expect}=require('@playwright/test');
async function setup(page){
 // QA uses synthetic data; keep the browser library available, block provider writes.
 await page.route('**/functions/v1/**',route=>route.abort());
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
test('manual initial defaults require review before they enter the suggested response',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);await page.locator('#clientName').fill('Ana');await page.locator('#eventDate').fill('2099-11-20');
 await page.locator('[data-consultative-action="suggest"]').click();const first=await page.locator('#consultativeReply').inputValue();expect(first).not.toContain('30 pessoas');expect(first).not.toContain('18:00');expect(first).toContain('confirmar horário e número de pessoas');
 await page.evaluate(()=>{fields.eventTime.value='17:30';fields.eventTime.dispatchEvent(new Event('input',{bubbles:true}));fields.eventTime.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#guestCount').fill('40');await page.locator('[data-consultative-action="suggest"]').click();
 const final=await page.locator('#consultativeReply').inputValue();expect(final).toContain('40 pessoas');expect(final).toContain('17:30');
});
test('missing form time and headcount are not replaced by editor defaults in a client reply',async({page})=>{
 await setup(page);await page.evaluate(async()=>{const r=state.quoteRequests[0];r.horario_evento=null;r.convidados=null;r.snapshot={cliente:{idioma:'pt'},evento:{}};await applyQuoteRequest(r.id);});await openPanel(page);await page.locator('[data-consultative-action="suggest"]').click();
 const text=await page.locator('#consultativeReply').inputValue();expect(text).not.toContain('30 pessoas');expect(text).not.toContain('18:00');
});
test('manual reply survives first save',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);
 await page.locator('#clientName').fill('Mensagem durante gravação');await page.locator('#consultativeReply').fill('Resposta escrita pela gerente, preservar ao salvar.');
 await page.locator('[data-consultative-action="draft"]').click();
 await expect.poll(()=>page.evaluate(()=>getActiveProposal()?.cliente_nome)).toBe('Mensagem durante gravação');
 await expect(page.locator('#consultativeReply')).toHaveValue('Resposta escrita pela gerente, preservar ao salvar.');
});
test('edited source reason is acknowledged instead of the old main field',async({page})=>{
 await setup(page);await form(page);
 await page.evaluate(()=>{const node=document.querySelector('[data-source-field="reason"]');if(!node)throw Error('Campo de motivo não encontrado');node.value='Celebração dos 25 anos da empresa';node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));renderSalesGuide();});
 await page.locator('[data-consultative-action="suggest"]').click();
 await expect(page.locator('#consultativeReply')).toHaveValue(/Celebração dos 25 anos da empresa/);
});
test('clipboard result identifies an older text if the operator edits during copy',async({page})=>{
 await setup(page);await manual(page);await openPanel(page);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:text=>{window.copiedText=text;return new Promise(r=>window.finishCopy=r);}},configurable:true}));
 await page.locator('#consultativeReply').fill('Versão antes da cópia');await page.locator('[data-consultative-action="copy"]').click();
 await page.locator('#consultativeReply').fill('Versão ajustada durante a cópia');await page.evaluate(()=>window.finishCopy());
 await expect(page.locator('#consultativeStatus')).toContainText('versão anterior');
 expect(await page.evaluate(()=>window.copiedText)).toBe('Versão antes da cópia');
 await expect(page.locator('#consultativeReply')).toHaveValue('Versão ajustada durante a cópia');
});

test('guided format is acknowledged without certifying an automatic lunch time',async({page})=>{
 await setup(page);await manual(page);
 await page.locator('[data-flow-event="almoco"]').click();await openPanel(page);
 await page.locator('[data-consultative-action="suggest"]').click();
 const text=await page.locator('#consultativeReply').inputValue();
 expect(text).toContain('Almoço');expect(text).not.toContain('11:30');
 expect(await page.evaluate(()=>getConsultativeModel().knownType)).toBe(true);
});
for(const source of ['manual','form'])test(`unconfirmed ${source} defaults remain missing after saving and reopening`,async({page})=>{
 await setup(page);
 if(source==='manual')await manual(page);
 else await page.evaluate(async()=>{const r=state.quoteRequests[0];r.horario_evento=null;r.convidados=null;r.snapshot={cliente:{idioma:'en'},evento:{}};await applyQuoteRequest(r.id);});
 await page.locator('#clientName').fill('Briefing parcial');
 const saved=await page.evaluate(async()=>{const p=await saveCurrentProposal('proposta_pronta',null,{asDraft:true});if(!p)throw Error(state.lastProposalSaveError);openSavedProposal(p.id);return p;});
 expect(saved.snapshot.briefingConfirmation.time).toBe(false);expect(saved.snapshot.briefingConfirmation.guests).toBe(false);
 await openPanel(page);await page.locator('[data-consultative-action="suggest"]').click();
 const text=await page.locator('#consultativeReply').inputValue();expect(text).not.toContain('18:00');expect(text).not.toMatch(/30 (pessoas|guests)/);
 expect(await page.evaluate(()=>getConsultativeModel().knownTime)).toBe(false);
 expect(await page.evaluate(()=>getConsultativeModel().knownGuests)).toBe(false);
});
test('explicit confirmation of unchanged defaults persists on reopening',async({page})=>{
 await setup(page);await manual(page);await page.locator('#clientName').fill('Dados confirmados');
 await page.evaluate(()=>{for(const field of [fields.eventTime,fields.guestCount])field.dispatchEvent(new Event('input',{bubbles:true}));});
 const saved=await page.evaluate(async()=>{const p=await saveCurrentProposal('proposta_pronta',null,{asDraft:true});if(!p)throw Error(state.lastProposalSaveError);openSavedProposal(p.id);return p;});
 expect(saved.snapshot.briefingConfirmation.time).toBe(true);expect(saved.snapshot.briefingConfirmation.guests).toBe(true);
 await openPanel(page);await page.locator('[data-consultative-action="suggest"]').click();
 await expect(page.locator('#consultativeReply')).toHaveValue(/18:00 · 30 pessoas/);
});
test('linked request reply remains editable and copyable after its first save',async({page})=>{
 await setup(page);await form(page);await page.locator('#consultativeReply').fill('Resposta personalizada que deve permanecer.');
 await page.locator('[data-consultative-action="draft"]').click();
 await expect.poll(()=>page.evaluate(()=>Boolean(getActiveProposal()))).toBe(true);
 await expect(page.locator('#consultativeReply')).toHaveValue('Resposta personalizada que deve permanecer.');
 await expect(page.locator('[data-consultative-action="copy"]')).toBeEnabled();
});
test('cleared source details never return when the editor rerenders or reopens',async({page})=>{
 await setup(page);await form(page);
 for(const key of ['reason','preferences','extras'])await page.locator(`[data-source-field="${key}"]`).fill('');
 await page.locator('#guestCount').fill('45');
 for(const key of ['reason','preferences','extras'])await expect(page.locator(`[data-source-field="${key}"]`)).toHaveValue('');
 await page.locator('[data-consultative-action="suggest"]').click();
 await expect(page.locator('#consultativeReply')).not.toHaveValue(/Aniversário|Vegetarianos|DJ sujeito a consulta/);
 await page.evaluate(async()=>{const p=await saveCurrentProposal('proposta_pronta',null,{asDraft:true});if(!p)throw Error(state.lastProposalSaveError);state.sourceOverrides={};openSavedProposal(p.id);});
 for(const key of ['reason','preferences','extras'])await expect(page.locator(`[data-source-field="${key}"]`)).toHaveValue('');
});
test('new manual action waits for pending save and cannot attach the old event to a blank editor',async({page})=>{
 await setup(page);await manual(page);await page.locator('#clientName').fill('Evento em gravação');await openPanel(page);await page.locator('#consultativeReply').fill('Resposta do evento em gravação.');
 await page.evaluate(()=>{
  const original=state.supabase.rpc.bind(state.supabase);
  state.supabase.rpc=async(name,args)=>{if(name==='save_event_proposal')await new Promise(resolve=>window.releaseConsultativeSave=resolve);return original(name,args);};
  window.pendingConsultativeSave=saveCurrentProposal('proposta_pronta',null,{asDraft:true});
 });
 await expect.poll(()=>page.evaluate(()=>Boolean(window.releaseConsultativeSave))).toBe(true);
 await page.locator('[data-consultative-action="new"]').click();
 await expect(page.locator('#clientName')).toHaveValue('Evento em gravação');
 await page.evaluate(async()=>{window.releaseConsultativeSave();await window.pendingConsultativeSave;});
 await expect(page.locator('#consultativeReply')).toHaveValue('Resposta do evento em gravação.');
 await page.locator('[data-consultative-action="new"]').click();
 await expect(page.locator('#clientName')).toHaveValue('');await expect(page.locator('#consultativeReply')).toHaveValue('');
 expect(await page.evaluate(()=>state.activeProposalId)).toBe('');
});
test('briefing confirmation is private metadata, not a changed commercial agreement',async({page})=>{
 await setup(page);await manual(page);await page.locator('#clientName').fill('Conferência sem alteração comercial');
 const result=await page.evaluate(async()=>{
  const before=await saveCurrentProposal('proposta_pronta',null,{asDraft:true});if(!before)throw Error(state.lastProposalSaveError);
  for(const field of [fields.eventTime,fields.guestCount])field.dispatchEvent(new Event('input',{bubbles:true}));
  const dirty=hasUnsavedEditorChanges(),commercial=hasCommercialEditorInputChanges();
  const after=await saveCurrentProposal('proposta_pronta',null,{asDraft:true});if(!after)throw Error(state.lastProposalSaveError);
  return {dirty,commercial,beforeEvent:before.snapshot.event,afterEvent:after.snapshot.event,known:after.snapshot.briefingConfirmation,changes:getProposalChangeList(before.snapshot,after.snapshot)};
 });
 expect(result.dirty).toBe(true);expect(result.commercial).toBe(false);
 expect(result.afterEvent).toEqual(result.beforeEvent);expect(result.known.time).toBe(true);expect(result.known.guests).toBe(true);expect(result.changes).toEqual([]);
});
