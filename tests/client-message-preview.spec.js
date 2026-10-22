const {test,expect}=require('@playwright/test');
const {expectNoHorizontalOverflow}=require('./support');

async function prepare(page) {
  await page.goto('/index.html?qa=1');
  await page.evaluate(()=>{
    openSavedProposal('qa-proposal-sem-resposta');
    window.previewCalls=[];
    state.supabase.functions.invoke=async(name,{body})=>{
      window.previewCalls.push({name,body:structuredClone(body)});
      return {data:{ok:false,message:'Simulated delivery disabled'},error:null};
    };
  });
}

for(const width of [320,390,1440])test(`client preview is separate, exact and cancellable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await prepare(page);
  const message='Ola, cliente de teste!\n\nSua proposta: https://example.test/proposta?ref=preview&lang=pt\nTotal: R$ 1.234,56\n\n</textarea><img src=x onerror="window.previewInjected=true">';
  await page.evaluate(message=>{
    window.previewAttempt=confirmClientSend({channel:'WhatsApp',destination:'+55 (00) 00000-0000',message});
  },message);
  const dialog=page.locator('.send-confirm-dialog');
  const preview=dialog.locator('.send-client-preview');
  const internal=dialog.locator('.send-internal-review');
  await expect(preview.getByRole('heading')).toHaveText('Mensagem ao cliente');
  await expect(dialog.locator('#sendConfirmTitle')).toBeFocused();
  expect(await preview.getByRole('heading').evaluate(el=>el.getBoundingClientRect().top>=0 && el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
  await expect(preview.locator('textarea')).toHaveValue(message);
  await expect(preview.locator('textarea')).toHaveAttribute('readonly','');
  await expect(preview).toContainText('+55 (00) 00000-0000');
  await expect(preview.locator('.send-confirm-details')).toHaveCount(0);
  await expect(internal.locator('textarea')).toHaveCount(0);
  expect(await preview.evaluate(el=>Boolean(el.compareDocumentPosition(el.nextElementSibling)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect(await page.evaluate(()=>Boolean(window.previewInjected))).toBe(false);
  await expectNoHorizontalOverflow(page);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await internal.locator('summary').click();
  await expect(internal).not.toHaveAttribute('open','');
  await expect(preview.locator('textarea')).toHaveValue(message);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(()=>window.previewAttempt)).toBe(false);
  expect(await page.evaluate(()=>window.previewCalls)).toEqual([]);
});

test('WhatsApp simulation receives exactly the preview including the human-contact notice',async({page})=>{
  await prepare(page);
  const expected=await page.evaluate(()=>{
    const message='Ola, cliente de teste!\n\nConfira a proposta: https://example.test/proposta';
    window.previewAttempt=sendProposalWhatsAppViaZapi({proposal:getActiveProposal(),proposalUrl:'https://example.test/proposta',message});
    return appendBotWhatsAppNotice(message);
  });
  const dialog=page.locator('.send-confirm-dialog');
  await expect(dialog.locator('.send-confirm-message')).toHaveValue(expected);
  expect(await page.evaluate(()=>window.previewCalls)).toEqual([]);
  await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>window.previewCalls)).toEqual([]);
  await dialog.locator('input[type=checkbox]').check();
  await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();
  const result=await page.evaluate(async()=>({ok:await window.previewAttempt,calls:window.previewCalls}));
  expect(result.ok).toBe(false);
  expect(result.calls).toHaveLength(1);
  expect(result.calls[0].name).toBe('send-proposal-whatsapp');
  expect(result.calls[0].body.message).toBe(expected);
  expect(result.calls[0].body.message).not.toContain('Conferencia interna');
});
