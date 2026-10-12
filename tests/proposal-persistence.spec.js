const { test, expect } = require('@playwright/test');

async function openDraft(page) {
  await page.goto('/index.html?qa=1');
  await page.evaluate(() => {
    const proposal = state.proposals.find(row => row.id === 'qa-proposal-sem-resposta');
    proposal.id = '00000000-0000-4000-8000-000000000654';
    proposal.revision = 1;
    proposal.publication_status = 'draft';
    proposal.is_current = false;
    proposal.status = 'negociacao';
    openSavedProposal(proposal.id);
  });
}

async function pauseSave(page) {
  await page.evaluate(() => {
    window.originalSaveRpc = state.supabase.rpc.bind(state.supabase);
    state.supabase.rpc = async (name, args) => {
      if (name !== 'save_event_proposal') return window.originalSaveRpc(name, args);
      window.capturedWrite = structuredClone(args);
      window.writeCount = (window.writeCount || 0) + 1;
      await new Promise(resolve => window.releaseSave = resolve);
      return window.originalSaveRpc(name, args);
    };
    window.pendingSave = saveCurrentProposal('negociacao');
  });
  await expect.poll(() => page.evaluate(() => Boolean(window.capturedWrite))).toBe(true);
}

test('salvar e reabrir mantém dados completos e a identidade da proposta', async ({ page }) => {
  await openDraft(page);
  await page.locator('#clientName').fill('Cliente de persistência');
  await page.locator('#notes').fill('Condição especial a preservar');
  const saved = await page.evaluate(async () => {
    const expected = getProposalSnapshot();
    const row = await saveCurrentProposal('negociacao');
    if (!row) return {error:state.lastProposalSaveError};
    document.querySelector('#clientName').value = 'Texto não salvo';
    openSavedProposal(row.id);
    return { id:row.id, revision:row.revision, name:document.querySelector('#clientName').value,
      notes:document.querySelector('#notes').value, selected:row.snapshot.selectedItems,
      expectedItems:expected.selectedItems, dirty:hasUnsavedEditorChanges(),
      count:state.proposals.filter(p => p.id === row.id).length };
  });
  expect(saved.error).toBeUndefined();
  expect(saved.id).toBe('00000000-0000-4000-8000-000000000654');
  expect(saved.revision).toBe(2);
  expect(saved.name).toBe('Cliente de persistência');
  expect(saved.notes).toBe('Condição especial a preservar');
  expect(saved.selected).toEqual(saved.expectedItems);
  expect(saved.count).toBe(1);
  expect(saved.dirty).toBe(false);
});

test('digitação durante gravação não é marcada como salva nem entra no payload anterior', async ({ page }) => {
  await openDraft(page);
  await page.locator('#notes').fill('Conteúdo enviado ao banco');
  await pauseSave(page);
  await page.locator('#notes').fill('Edição posterior ainda local');
  const result = await page.evaluate(async () => {
    const id = window.capturedWrite.p_changes.snapshot.selectedItems[0]?.id;
    const price = state.prices.find(p => p.id === id);
    if (price) price.nome += ' edição durante a gravação';
    window.releaseSave();
    const saved = await window.pendingSave;
    return {savedNotes:saved?.snapshot.event.notes, currentNotes:document.querySelector('#notes').value,
      savedPrices:saved?.snapshot.prices, capturedPrices:window.capturedWrite.p_changes.snapshot.prices,
      dirty:hasUnsavedEditorChanges(), locked:state.proposalSaveInProgress};
  });
  expect(result.savedNotes).toBe('Conteúdo enviado ao banco');
  expect(result.currentNotes).toBe('Edição posterior ainda local');
  expect(result.savedPrices).toEqual(result.capturedPrices);
  expect(result.dirty).toBe(true);
  expect(result.locked).toBe(false);
  await expect(page.locator('#loadedEditorBar')).toContainText('Não salvo');
});

test('salvamentos simultâneos e troca de evento não duplicam nem desviam a gravação', async ({ page }) => {
  await openDraft(page);
  await page.locator('#notes').fill('Uma única gravação');
  await pauseSave(page);
  const result = await page.evaluate(async () => {
    const duplicate = await saveCurrentProposal('negociacao');
    const canSwitch = await confirmEditorSwitch();
    window.releaseSave(); const saved = await window.pendingSave;
    return {duplicate, canSwitch, count:window.writeCount, saved:Boolean(saved), dirty:hasUnsavedEditorChanges()};
  });
  expect(result).toEqual({duplicate:null,canSwitch:false,count:1,saved:true,dirty:false});
});

for (const mode of ['empty', 'network']) test(`gravação ${mode} não confirma sucesso e mantém alterações`, async ({ page }) => {
  await openDraft(page);
  await page.locator('#notes').fill('Alteração que não pode desaparecer');
  const result = await page.evaluate(async mode => {
    state.supabase.rpc = async () => {if(mode === 'network') throw Error('Network unavailable'); return {data:[],error:null};};
    const saved = await saveCurrentProposal('negociacao');
    return {saved,error:state.lastProposalSaveError,notes:document.querySelector('#notes').value,
      dirty:hasUnsavedEditorChanges(),locked:state.proposalSaveInProgress,disabled:document.querySelector('#saveProposalBtn').disabled};
  }, mode);
  expect(result.saved).toBeNull(); expect(result.error).toMatch(/confirm/i);
  expect(result.notes).toBe('Alteração que não pode desaparecer');
  expect(result.dirty).toBe(true); expect(result.locked).toBe(false); expect(result.disabled).toBe(false);
});

test('segunda gravação persiste a edição posterior sem criar outro registro', async ({ page }) => {
  await openDraft(page);
  await page.locator('#notes').fill('Primeira gravação');
  await pauseSave(page);
  await page.locator('#notes').fill('Segunda gravação');
  const result = await page.evaluate(async () => {
    window.releaseSave(); await window.pendingSave;
    state.supabase.rpc = window.originalSaveRpc;
    const saved = await saveCurrentProposal('negociacao');
    return {notes:saved?.snapshot.event.notes,revision:saved?.revision,dirty:hasUnsavedEditorChanges(),
      count:state.proposals.filter(p=>p.id === saved?.id).length};
  });
  expect(result).toEqual({notes:'Segunda gravação',revision:3,dirty:false,count:1});
});


test('compartilhamento não continua quando há edição durante a gravação', async ({page}) => {
  await openDraft(page);
  await page.locator('#notes').fill('Proposta a gravar');
  await page.evaluate(() => {
    // Readiness is covered by the existing sales suite; isolate the post-save gate.
    ensureProposalReadyForSending = () => true;
    const original = state.supabase.rpc.bind(state.supabase);
    state.supabase.rpc = async (name, args) => {
      if (name === 'save_event_proposal') {
        window.capturedWrite = structuredClone(args);
        await new Promise(resolve => window.releaseSave = resolve);
      }
      return original(name, args);
    };
    window.pendingShare = ensureProposalForSharing();
  });
  await expect.poll(() => page.evaluate(() => Boolean(window.releaseSave))).toBe(true);
  await page.locator('#notes').fill('Alteração ainda não gravada');
  const result = await page.evaluate(async () => {
    window.releaseSave();
    return {share:await window.pendingShare,dirty:hasUnsavedEditorChanges(),error:state.lastProposalShareError};
  });
  expect(result.share).toBeNull();expect(result.dirty).toBe(true);expect(result.error).toMatch(/alterações posteriores/i);
});


test('abrir proposta não rouba o foco de quem já começou a digitar', async ({page}) => {
  await openDraft(page);
  const result = await page.evaluate(async () => {
    const proposal = getActiveProposal();
    openSavedProposal(proposal.id);
    const name = fields.clientName.value;
    fields.notes.focus();
    fields.notes.value = 'Texto permanece nas observações';
    await new Promise(resolve => setTimeout(resolve, 420));
    return {focused:document.activeElement.id,name:fields.clientName.value,expectedName:name,notes:fields.notes.value};
  });
  expect(result.focused).toBe('notes');
  expect(result.name).toBe(result.expectedName);
  expect(result.notes).toBe('Texto permanece nas observações');
});
