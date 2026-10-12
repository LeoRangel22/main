const {test,expect}=require('@playwright/test');

async function startPreview(page, {delay=false,error=false}={}) {
  await page.goto('/index.html?qa=1');
  await page.evaluate(({delay,error})=>{
    const proposal=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');
    proposal.revision=3;openSavedProposal(proposal.id);
    window.emailCalls=[];
    const original=state.supabase.functions.invoke.bind(state.supabase.functions);
    state.supabase.functions.invoke=async(name,options)=>{
      if(name!=='send-proposal-email')return original(name,options);
      window.emailCalls.push(structuredClone(options.body));
      if(options.body.preview){
        if(delay)await new Promise(resolve=>window.releasePreview=resolve);
        if(error)return {data:null,error:{message:'Prévia indisponível'}};
        return {data:{ok:true,mode:'preview',reviewedRevision:3,contentHash:'exact-approved-content',sender:'Eventos <events@example.test>',subject:'Proposta completa revisada',
          html:'<h1>Proposta completa</h1><p>Item aprovado: Café</p><p>Total: R$ 1.120,00</p><p>Prazo do sinal: 3 dias</p>',
          text:'Item aprovado: Café\nTotal: R$ 1.120,00\nPrazo do sinal: 3 dias'},error:null};
      }
      return original(name,options);
    };
    window.emailAttempt=sendProposalEmailViaZepto({proposal,proposalUrl:'https://example.test/proposta',email:'review@example.test'});
  },{delay,error});
}

test('aprovação exibe HTML e texto completos; cancelar não envia',async({page})=>{
  await startPreview(page);
  const dialog=page.locator('.send-confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveAttribute('sandbox','');
  await expect(dialog.frameLocator('iframe').getByText('Item aprovado: Café')).toBeVisible();
  await expect(dialog.locator('.send-confirm-message')).toHaveValue(/Total: R\$ 1.120,00/);
  await expect(dialog).toContainText('Proposta completa revisada');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  const result=await page.evaluate(async()=>({ok:await window.emailAttempt,calls:window.emailCalls,locked:state.sendLocks.email}));
  expect(result.ok).toBe(false);expect(result.calls).toHaveLength(1);expect(result.calls[0].preview).toBe(true);expect(result.locked).toBe(false);
});

test('envio leva a assinatura do conteúdo exatamente revisado',async({page})=>{
  await startPreview(page);
  const dialog=page.locator('.send-confirm-dialog');
  await dialog.locator('input[type=checkbox]').check();
  await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();
  const result=await page.evaluate(async()=>{await window.emailAttempt;return {calls:window.emailCalls,locked:state.sendLocks.email};});
  expect(result.calls).toHaveLength(2);
  expect(result.calls[1].reviewedContentHash).toBe('exact-approved-content');
  expect(result.calls[1].reviewedRevision).toBe(3);
  expect(result.calls[1].email).toBe('review@example.test');
  expect(result.locked).toBe(false);
});

test('mudança enquanto prévia carrega invalida revisão e bloqueia envio',async({page})=>{
  await startPreview(page,{delay:true});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.releasePreview))).toBe(true);
  await page.locator('#notes').fill('Alteração posterior à prévia');
  const result=await page.evaluate(async()=>{window.releasePreview();return {ok:await window.emailAttempt,count:window.emailCalls.length,locked:state.sendLocks.email};});
  expect(result).toEqual({ok:false,count:1,locked:false});await expect(page.locator('.send-confirm-dialog')).toHaveCount(0);
});

test('falha na prévia não abre confirmação nem cria envio',async({page})=>{
  await startPreview(page,{error:true});
  const result=await page.evaluate(async()=>({ok:await window.emailAttempt,count:window.emailCalls.length,locked:state.sendLocks.email}));
  expect(result).toEqual({ok:false,count:1,locked:false});await expect(page.locator('.send-confirm-dialog')).toHaveCount(0);
});


test('prévia permanece isolada e não executa scripts ou ações no painel', async ({page}) => {
  await page.goto('/index.html?qa=1');
  await page.evaluate(() => {
    window.unsafeEmailExecuted = false;
    window.sandboxReview = confirmClientSend({channel:'E-mail',destination:'review@example.test',message:'Conteúdo estático',
      html:'<p>Conteúdo estático</p><script>parent.unsafeEmailExecuted = true;</script><img src="data:image/png,invalid" onerror="parent.unsafeEmailExecuted = true">'});
  });
  const dialog = page.locator('.send-confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveAttribute('sandbox','');
  await expect(dialog.frameLocator('iframe').getByText('Conteúdo estático')).toBeVisible();
  expect(await page.evaluate(() => window.unsafeEmailExecuted)).toBe(false);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(() => window.sandboxReview)).toBe(false);
});
