const {test,expect}=require('@playwright/test');

test('atualização periódica preserva revisão da edição e impede sobrescrita',async({page})=>{
  await page.goto('/index.html?qa=1');
  const result=await page.evaluate(async()=>{
    const p=state.proposals.find(row=>row.id==='qa-proposal-sem-resposta');
    p.id='00000000-0000-4000-8000-000000000321'; p.revision=1;
    openSavedProposal(p.id);
    document.querySelector('#clientName').value='Edição local';
    const refreshed={...structuredClone(p),revision:2,snapshot:{...p.snapshot,remoteMarker:'preserve'}};
    upsertProposalState(refreshed);
    const saved=await saveCurrentProposal('negociacao');
    return {saved,error:state.lastProposalSaveError,baseRevision:state.editorProposalBase.revision,
      remoteMarker:state.proposals.find(row=>row.id===p.id).snapshot.remoteMarker,
      localName:document.querySelector('#clientName').value};
  });
  expect(result.saved).toBeNull();
  expect(result.error).toContain('proposta mudou');
  expect(result.baseRevision).toBe(1);
  expect(result.remoteMarker).toBe('preserve');
  expect(result.localName).toBe('Edição local');
});

test('cancelamento mantém a revisão anterior à janela de confirmação',async({page})=>{
  await page.goto('/index.html?qa=1');
  await page.evaluate(()=>{
    const p=state.proposals.find(row=>row.id==='qa-proposal-sem-resposta');
    p.revision=1;
    window.__cancelAttempt=cancelPipelineItem('proposal',p.id);
  });
  const dialog=page.locator('.cancel-reason-dialog');
  await expect(dialog).toBeVisible();
  await page.evaluate(()=>{
    const p=state.proposals.find(row=>row.id==='qa-proposal-sem-resposta');
    upsertProposalState({...structuredClone(p),revision:2,status:'negociacao',snapshot:{...p.snapshot,remoteMarker:'preserve'}});
  });
  await dialog.getByRole('button',{name:'Registrar cancelamento',exact:true}).click();
  const result=await page.evaluate(async()=>{
    await window.__cancelAttempt;
    const p=state.proposals.find(row=>row.id==='qa-proposal-sem-resposta');
    return {status:p.status,revision:p.revision,marker:p.snapshot.remoteMarker};
  });
  expect(result).toEqual({status:'negociacao',revision:2,marker:'preserve'});
});
