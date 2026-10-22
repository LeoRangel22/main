const {test,expect}=require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');

async function prepare(page) {
  await page.goto('/index.html?qa=1');
  await page.evaluate(()=>{
    openSavedProposal('qa-proposal-sem-resposta');
    state.sendReviewApprovedSignature='';
    state.sendReviewApproval=null;
    window.modalWrites=[];
    const rpc=state.supabase.rpc.bind(state.supabase);
    state.supabase.rpc=async(name,args)=>{
      window.modalWrites.push(name);
      return rpc(name,args);
    };
    window.modalDispatches=[];
    state.supabase.functions.invoke=async(name,args)=>{
      window.modalDispatches.push(name);
      throw Error('No provider calls are expected in this test');
    };
  });
}

for(const width of [320,390,1440])test(`blocked send stays in its modal and cancels without writes at ${width}px`,async({page})=>{
  const errors=collectBrowserErrors(page);
  await page.setViewportSize({width,height:900});
  await prepare(page);
  const before=await page.evaluate(()=>{
    fields.eventTime.value='';
    scheduleLoadedEditorJump('review');
    window.scrollTo({top:120,left:0,behavior:'instant'});
    const before=window.scrollY;
    window.modalAttempt=openWhatsApp();
    return before;
  });
  const dialog=page.locator('.send-readiness-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Aprovar revisão e continuar'})).toBeDisabled();
  await expect(dialog).toContainText('Nenhum envio foi iniciado');
  // Exercise all delayed jumps, including the 1500 ms retry.
  await page.waitForTimeout(1700);
  expect(await page.evaluate(()=>window.scrollY)).toBe(before);
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const result=await page.evaluate(async()=>{
    await window.modalAttempt;
    return {writes:window.modalWrites,dispatches:window.modalDispatches,overflow:document.documentElement.style.overflow,y:window.scrollY};
  });
  expect(result).toEqual({writes:[],dispatches:[],overflow:'',y:before});
  await expectNoBrowserErrors(errors);
});

test('correction is an explicit choice and never continues sending',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    fields.eventTime.value='';
    window.modalAttempt=ensureProposalReadyForSending();
  });
  const dialog=page.locator('.send-readiness-dialog');
  await dialog.locator('[data-send-correction="client"]').first().click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>window.modalAttempt)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#clientDataSection').getBoundingClientRect().top)).toBeLessThan(100);
  expect(await page.evaluate(()=>window.modalWrites)).toEqual([]);
});

test('explicit approval continues the WhatsApp preparation exactly once',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    window.prepared=[];
    sendProposalWhatsAppViaZapi=async payload=>{window.prepared.push({id:payload.proposal.id,url:payload.proposalUrl,message:payload.message});return false;};
    window.modalAttempt=openWhatsApp();
  });
  const dialog=page.locator('.send-readiness-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Aprovar revisão e continuar'})).toBeEnabled();
  await dialog.getByRole('button',{name:'Aprovar revisão e continuar'}).click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>window.prepared)).toEqual([]);
  expect(await page.evaluate(()=>ensureProposalReadyForSending())).toBe(false);
  await dialog.locator('input[type="checkbox"]').check();
  await dialog.getByRole('button',{name:'Aprovar revisão e continuar'}).click();
  await page.evaluate(()=>window.modalAttempt);
  const result=await page.evaluate(()=>({count:window.prepared.length,proposal:window.prepared[0],dispatches:window.modalDispatches}));
  expect(result.count).toBe(1);
  expect(result.proposal.url).toBeTruthy();
  expect(result.proposal.message).toBeTruthy();
  expect(result.dispatches).toEqual([]);
});

for(const change of ['content','proposal','session'])test(`changed ${change} invalidates the open review`,async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{window.modalAttempt=ensureProposalReadyForSending();});
  const dialog=page.locator('.send-readiness-dialog');
  await dialog.locator('input[type="checkbox"]').check();
  await page.evaluate(change=>{
    if(change==='content')fields.notes.value+=' Changed during review';
    if(change==='proposal')state.activeProposalId='synthetic-other-proposal';
    if(change==='session')state.session={user:{id:'synthetic-other-user'}};
  },change);
  await dialog.getByRole('button',{name:'Aprovar revisão e continuar'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Os dados mudaram');
  await expect(dialog.getByRole('button',{name:'Aprovar revisão e continuar'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
  expect(await page.evaluate(()=>window.modalAttempt)).toBe(false);
  expect(await page.evaluate(()=>window.modalWrites)).toEqual([]);
});

test('final message preview also suppresses queued background jumps',async({page})=>{
  await prepare(page);
  const before=await page.evaluate(()=>{
    scheduleLoadedEditorJump('review');
    window.scrollTo({top:120,left:0,behavior:'instant'});
    const before=window.scrollY;
    window.modalAttempt=confirmClientSend({channel:'WhatsApp',destination:'Contato fictício',message:'Mensagem fictícia para revisão.'});
    return before;
  });
  const dialog=page.locator('.send-confirm-dialog');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(1700);
  expect(await page.evaluate(()=>window.scrollY)).toBe(before);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(()=>window.modalAttempt)).toBe(false);
  expect(await page.evaluate(()=>window.modalDispatches)).toEqual([]);
});
