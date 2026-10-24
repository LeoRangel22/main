const { test, expect } = require('@playwright/test');

async function start(page) {
  await page.route('https://**', route => route.abort());
  await page.goto('/index.html?qa=1');
}
async function openDraft(page) {
  await start(page);
  await page.evaluate(() => {
    const p = state.proposals.find(p => p.id === 'qa-proposal-sem-resposta');
    Object.assign(p, { id: '00000000-0000-4000-8000-000000000876', revision: 1, publication_status: 'draft', is_current: false, status: 'negociacao' });
    openSavedProposal(p.id);
  });
}

test('regression: reload warns and cancellation preserves unsaved edits', async ({ page }) => {
  await openDraft(page);
  await page.locator('#notes').fill('Edição sintética não salva');
  const nextDialog = page.waitForEvent('dialog');
  await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
  const dialog = await nextDialog;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await expect(page.locator('#notes')).toHaveValue('Edição sintética não salva');
  expect(await page.evaluate(() => hasUnsavedEditorChanges())).toBe(true);
});

test('regression: new proposal does not discard a partial contact on cancellation', async ({ page }) => {
  await start(page); let initializing = true; const dialogs = [];
  page.on('dialog', async dialog => {
    if (initializing) await dialog.accept();
    else { dialogs.push(dialog.message()); await dialog.dismiss(); }
  });
  await page.locator('#topbarNewProposalBtn').click(); initializing = false;
  await page.locator('#clientPhone').fill('+5500000000000');
  const before = await page.locator('#clientPhone').inputValue();
  await page.locator('#topbarNewProposalBtn').click();
  expect(dialogs).toHaveLength(1);
  await expect(page.locator('#clientPhone')).toHaveValue(before);
  expect(await page.evaluate(() => hasUnsavedEditorChanges())).toBe(true);
});

test('regression: pending proof is not received money in the finance summary', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const p = structuredClone(state.proposals.find(p => p.id === 'qa-proposal-sem-resposta'));
    Object.assign(p, { id: 'fixture-finance', oportunidade_id: 'fixture-finance', solicitacao_id: null, data_evento: '2099-11-04', status: 'negociacao', cliente_resposta: 'confirmar', is_current: true, publication_status: 'sent' });
    p.snapshot.pagamentoSinal = { valor: 900, data: new Date().toISOString().slice(0, 10), validacaoPendente: true };
    p.snapshot.pagamentoRestante = null;
    state.proposals = [p]; state.quoteRequests = []; state.opportunities = []; renderPipeline();
  });
  await page.locator('[data-workspace-mode="full"]').click();
  const received = page.locator('#financeCommandPanel article').filter({ hasText: 'Recebido no mês' }).locator('strong');
  await expect(received).toHaveText(/R\$\s*0,00/);
  expect(await page.evaluate(() => getPipelineItems()[0].paymentPaidTotal)).toBe(0);
});

for (const [field, value] of [['notes','Observação parcial'],['eventDate','2099-11-04'],['guestCount','31']]) {
  test(`new proposal preserves partial ${field} until explicit discard`, async ({page}) => {
    await start(page);
    await page.evaluate(() => startNewProposal());
    await page.locator(`#${field}`).fill(value);
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#topbarNewProposalBtn').click();
    await expect(page.locator(`#${field}`)).toHaveValue(value);
    expect(await page.evaluate(() => hasUnsavedEditorChanges())).toBe(true);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#topbarNewProposalBtn').click();
    expect(await page.evaluate(() => hasUnsavedEditorChanges())).toBe(false);
  });
}

test('first edit without clicking New is also protected', async ({page}) => {
  await start(page);
  await page.locator('#notes').fill('Primeiro preenchimento');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#topbarNewProposalBtn').click();
  await expect(page.locator('#notes')).toHaveValue('Primeiro preenchimento');
  expect(await page.evaluate(() => shouldProtectEditorExit())).toBe(true);
});

test('confirmed save removes reload warning', async ({page}) => {
  await openDraft(page);
  await page.locator('#notes').fill('Conteúdo salvo');
  const saved = await page.evaluate(async () => {
    const result = await saveCurrentProposal('negociacao');
    return {ok:Boolean(result), error:state.lastProposalSaveError, dirty:hasUnsavedEditorChanges(), protected:shouldProtectEditorExit()};
  });
  expect(saved.ok, saved.error).toBe(true); expect(saved.dirty).toBe(false); expect(saved.protected).toBe(false);
  const dialogs = []; page.on('dialog', async d => {dialogs.push(d.type()); await d.accept();});
  await page.reload(); expect(dialogs).toEqual([]);
});

for (const mode of ['network','empty','denied']) test(`failed ${mode} save preserves exit protection and allows cancelling contact switch`, async ({page}) => {
  await openDraft(page); await page.locator('#notes').fill('Não descartar');
  const before = await page.evaluate(() => state.activeProposalId);
  await page.evaluate(async mode => {
    state.supabase.rpc = async () => {
      if (mode === 'network') throw Error('Synthetic offline');
      return mode === 'denied' ? {error:{code:'42501',message:'Synthetic rejection'}} : {data:[],error:null};
    };
    window.saveResult = await saveCurrentProposal('negociacao');
  }, mode);
  expect(await page.evaluate(() => ({result:window.saveResult,dirty:hasUnsavedEditorChanges(),protected:shouldProtectEditorExit()})))
    .toEqual({result:null,dirty:true,protected:true});
  const dialogs = []; page.on('dialog', async d => {dialogs.push(d.message()); await d.dismiss();});
  await page.evaluate(async () => safeOpenSavedProposal(state.proposals.find(p=>p.id!==state.activeProposalId).id));
  expect(dialogs).toHaveLength(2);
  expect(await page.evaluate(() => state.activeProposalId)).toBe(before);
  await expect(page.locator('#notes')).toHaveValue('Não descartar');
});

test('pending save blocks logout and duplicate writes, preserving later typing', async ({page}) => {
  await openDraft(page); await page.locator('#notes').fill('Texto enviado ao banco');
  await page.evaluate(() => {
    const original = state.supabase.rpc.bind(state.supabase);
    window.writes = 0; window.exits = 0;
    state.supabase.auth.signOut = async () => {window.exits++; return {error:null};};
    state.supabase.rpc = async (name,args) => {
      if (name === 'save_event_proposal') {window.writes++; await new Promise(resolve => window.finishSave = resolve);}
      return original(name,args);
    };
    window.pendingSave = saveCurrentProposal('negociacao');
  });
  await expect.poll(() => page.evaluate(() => Boolean(window.finishSave))).toBe(true);
  await page.locator('#notes').fill('Texto posterior ainda local');
  const blocked = await page.evaluate(async () => ({logout:await logoutSupabase(), duplicate:await saveCurrentProposal('negociacao'), exits:window.exits, writes:window.writes, protected:shouldProtectEditorExit()}));
  expect(blocked).toEqual({logout:false,duplicate:null,exits:0,writes:1,protected:true});
  const saved = await page.evaluate(async () => {
    window.finishSave(); const result = await window.pendingSave;
    return {notes:result?.snapshot.event.notes,dirty:hasUnsavedEditorChanges(),protected:shouldProtectEditorExit()};
  });
  expect(saved).toEqual({notes:'Texto enviado ao banco',dirty:true,protected:true});
  await expect(page.locator('#notes')).toHaveValue('Texto posterior ainda local');
});

test('cancelled logout preserves the session, proposal and input', async ({page}) => {
  await openDraft(page); await page.locator('#notes').fill('Preservar ao sair');
  await page.evaluate(() => {window.exits=0; state.supabase.auth.signOut=async()=>{window.exits++;return {error:null};};});
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#logoutBtn').click();
  expect(await page.evaluate(() => ({exits:window.exits,loggedIn:!!state.session,dirty:hasUnsavedEditorChanges()})))
    .toEqual({exits:0,loggedIn:true,dirty:true});
  await expect(page.locator('#notes')).toHaveValue('Preservar ao sair');
});

for (const mode of ['network','error']) test(`logout ${mode} failure preserves local state`, async ({page}) => {
  await openDraft(page); await page.locator('#notes').fill('Saída não confirmada');
  page.once('dialog', dialog => dialog.accept());
  const result = await page.evaluate(async mode => {
    const id=state.activeProposalId, proposals=JSON.stringify(state.proposals);
    state.supabase.auth.signOut=async()=>{if(mode==='network')throw Error('offline');return {error:{message:'rejected'}};};
    return {result:await logoutSupabase(), sameId:state.activeProposalId===id, sameRows:JSON.stringify(state.proposals)===proposals,loggedIn:!!state.session,dirty:hasUnsavedEditorChanges()};
  }, mode);
  expect(result).toEqual({result:false,sameId:true,sameRows:true,loggedIn:true,dirty:true});
  await expect(page.locator('#logoutBtn')).toBeEnabled();
  await expect(page.locator('#notes')).toHaveValue('Saída não confirmada');
});

test('logout double click makes one request and cleans only after acknowledgement', async ({page}) => {
  await openDraft(page); await page.locator('#notes').fill('Descartar com confirmação');
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => {
    window.exits=0;state.supabase.auth.signOut=async()=>{window.exits++;await new Promise(resolve=>window.finishExit=resolve);return {error:null};};
    window.pendingExit=logoutSupabase();
  });
  await expect(page.locator('#logoutBtn')).toBeDisabled();
  expect(await page.evaluate(async()=>({repeat:await logoutSupabase(),exits:window.exits,session:!!state.session})))
    .toEqual({repeat:false,exits:1,session:true});
  const result=await page.evaluate(async()=>{window.finishExit();return {result:await window.pendingExit,session:state.session,active:state.activeProposalId,protected:shouldProtectEditorExit()};});
  expect(result).toEqual({result:true,session:null,active:'',protected:false});
});

test('late logout response cannot clear another user session', async ({page}) => {
  await openDraft(page);
  await page.evaluate(() => {
    state.supabase.auth.signOut=async()=>{await new Promise(resolve=>window.finishExit=resolve);return {error:null};};
    window.pendingExit=logoutSupabase();
  });
  const result=await page.evaluate(async()=>{
    state.session={user:{id:'another-synthetic-user',email:'fixture@example.test'}};
    const id=state.activeProposalId;
    window.finishExit();await window.pendingExit;
    return {user:state.session?.user.id,same:state.activeProposalId===id};
  });
  expect(result).toEqual({user:'another-synthetic-user',same:true});
});

test('finance counts the current agreement once, preserving legacy audited payments', async ({page}) => {
  await start(page);
  const result=await page.evaluate(()=>{
    const p=structuredClone(state.proposals.find(p=>p.id==='qa-proposal-sem-resposta'));
    Object.assign(p,{id:'current-agreement',oportunidade_id:'finance-opportunity',solicitacao_id:null,versao:2,is_current:true,publication_status:'sent',status:'confirmado'});
    p.snapshot.pagamentoSinal={valor:900,data:CommercialPriority.today(),validacaoPendente:false,validadoPor:'synthetic',validadoEm:new Date().toISOString()};
    p.snapshot.pagamentoRestante=null;
    const old={...structuredClone(p),id:'old-version',versao:1,is_current:false};
    const draft={...structuredClone(p),id:'amendment-draft',versao:3,is_current:false,publication_status:'draft'};
    draft.snapshot.amendmentOf=p.id;
    state.proposals=[draft,old,p];state.quoteRequests=[];state.opportunities=[];
    const before=JSON.stringify(state.proposals);renderPipeline();
    return {received:document.querySelector('#financeCommandPanel').textContent,same:JSON.stringify(state.proposals)===before};
  });
  expect(result.received).toMatch(/Recebido no mês\s*R\$\s*900,00/); expect(result.same).toBe(true);
});
