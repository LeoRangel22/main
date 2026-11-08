const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
async function capture(page,info,label){
 const metrics=await page.evaluate(()=>({
  viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,
  mode:document.body.className,
  currentSearchTop:document.querySelector('#globalSearchInput')?.getBoundingClientRect().top??null,
  historyTop:document.querySelector('#crmHistory')?.getBoundingClientRect().top??null,
  pipelineVisible:!!document.querySelector('#salesPipeline')?.getClientRects().length
 }));
 console.log('NAVIGATION_AUDIT '+JSON.stringify({label,...metrics}));
 await page.screenshot({path:info.outputPath('synthetic-'+label+'.png')});
}
for(const width of [320,390,1440])test('commercial Funil shortcut is reachable from Operations at '+width+'px',async({page},info)=>{
 const c=await isolate(page);await page.setViewportSize({width,height:950});await page.goto('/index.html?qa=1');
 await expect(page.locator('body')).toHaveClass(/auth-connected/);
 const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 await page.locator('[data-workspace-mode="operations"]').click();
 await expect(page.locator('#salesPipeline')).toBeHidden();
 await page.locator('.admin-quick-nav').getByRole('link',{name:'Funil',exact:true}).click();
 await capture(page,info,'funil-from-operations-'+width);
 await expect(page.locator('#salesPipeline')).toBeVisible();
 await expect(page.locator('#salesPipeline')).toBeFocused();
 // The existing sticky header is accommodated by the section's scroll margin.
 await expect.poll(()=>page.locator('#salesPipeline').evaluate(n=>
  Math.abs(n.getBoundingClientRect().top-parseFloat(getComputedStyle(n).scrollMarginTop))
 )).toBeLessThan(2);
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);
 expect(c.external).toEqual([]);expect(c.errors).toEqual([]);
});
test('current client search stays reachable when historical accounts are loaded',async({page},info)=>{
 const c=await isolate(page);await page.setViewportSize({width:390,height:950});await page.goto('/clientes.html?qa=1');
 await expect(page.locator('.client-registry-card')).toHaveCount(2);
 await page.evaluate(()=>{
  EventCrmHistory.setSession({user:{id:'synthetic-navigation-owner'},client:{rpc:async()=>({data:{
   available:true,batch_id:'synthetic-navigation',summary:{organization:20,contact:0,event:0,realized:0},
   period_start:'2098-01-01',period_end:'2099-01-01',
   records:Array.from({length:20},(_,i)=>({id:'navigation-account-'+i,name:'Conta Sintética '+i,domain:'company'+i+'.example.test',segment:'Empresa',source_count:0})),
   total:20,offset:0,limit:20
  },error:null})}});
 });
 await expect(page.locator('#crmHistoryResults .crm-history-card')).toHaveCount(20);
 await page.evaluate(()=>scrollTo(0,0));
 await capture(page,info,'clients-history-and-current');
 await expect(page.locator('#globalSearchInput')).toBeInViewport();
 await expect(page.getByRole('link',{name:'Histórico recuperado',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Histórico recuperado',exact:true}).press('Enter');
 await expect(page.locator('#crmHistorySearch')).toBeInViewport();
 await page.getByRole('link',{name:'Clientes atuais',exact:true}).press('Enter');
 await expect(page.locator('#globalSearchInput')).toBeInViewport();
 await page.locator('#globalSearchInput').fill('Pessoa Sintetica quality-a1');
 await expect(page.locator('.client-registry-card')).toHaveCount(1);
 await page.evaluate(()=>EventCrmHistory.setSession(null));
 await expect(page.locator('#clientHistoryLink')).toBeHidden();
 await expect(page.locator('#crmHistoryResults .crm-history-card')).toHaveCount(0);
 expect(c.external).toEqual([]);expect(c.errors).toEqual([]);
});

for(const width of [320,1440])test('workspace shortcuts preserve the draft and support repeated keyboard navigation at '+width+'px',async({page})=>{
 const c=await isolate(page);await page.setViewportSize({width,height:950});await page.goto('/index.html?qa=1');
 await expect(page.locator('body')).toHaveClass(/auth-connected/);
 await page.locator('#clientName').fill('Rascunho sintético de navegação');
 const before=await page.evaluate(()=>({records:JSON.stringify(state.proposals),editor:getCurrentEditorSignature()}));
 const nav=page.locator('.admin-quick-nav');
 for(const [name,id] of [['Operação','operationWorkspace'],['Hoje','salesCommand'],['Operação','operationWorkspace'],['Proposta','quoteWorkspace']]){
  await nav.getByRole('link',{name,exact:true}).press('Enter');
  await expect(page.locator('#'+id)).toBeVisible();await expect(page.locator('#'+id)).toBeFocused();
 }
 // Same fragment: no hashchange occurs, but the destination must still open.
 await page.locator('[data-workspace-mode="operations"]').click();
 await nav.getByRole('link',{name:'Proposta',exact:true}).click();
 await expect(page.locator('body')).toHaveClass(/workspace-mode-sales/);
 await expect(page.locator('#quoteWorkspace')).toBeFocused();
 expect(await page.evaluate(()=>({records:JSON.stringify(state.proposals),editor:getCurrentEditorSignature()}))).toEqual(before);
 expect(c.external).toEqual([]);expect(c.errors).toEqual([]);
});

test('section fragments survive reload and browser history without overriding the complete view',async({page})=>{
 const c=await isolate(page);await page.goto('/index.html?qa=1');
 await page.locator('[data-workspace-mode="operations"]').click();
 await page.goto('/index.html?qa=1#salesPipeline');
 await expect(page.locator('body')).toHaveClass(/workspace-mode-sales/);
 await expect(page.locator('#salesPipeline')).toBeVisible();
 await page.locator('.admin-quick-nav').getByRole('link',{name:'Operação',exact:true}).click();
 await expect(page.locator('#operationWorkspace')).toBeVisible();
 await page.goBack();
 await expect(page.locator('#salesPipeline')).toBeVisible();
 await page.goForward();
 await expect(page.locator('#operationWorkspace')).toBeVisible();
 await page.reload();
 await expect(page.locator('#operationWorkspace')).toBeVisible();
 await page.locator('[data-workspace-mode="full"]').click();
 await page.locator('.admin-quick-nav').getByRole('link',{name:'Funil',exact:true}).click();
 await expect(page.locator('body')).toHaveClass(/workspace-mode-full/);
 await page.evaluate(()=>{location.hash='unknown-section';});
 await expect(page.locator('body')).toHaveClass(/workspace-mode-full/);
 expect(c.external).toEqual([]);expect(c.errors).toEqual([]);
});
