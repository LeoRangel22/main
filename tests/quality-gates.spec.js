const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
const {collectTextContrast}=require('./contrast-helpers.cjs');
async function reflow(page){const s=await page.evaluate(()=>{const text=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(!n.textContent.trim()||n.parentElement.closest('script,style'))continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height&&(r.right>innerWidth+1||r.left<0))text.push({tag:n.parentElement.tagName,id:n.parentElement.id,className:n.parentElement.className,right:r.right,text:n.textContent.slice(0,70)});}return{width:innerWidth,scroll:document.documentElement.scrollWidth,scrollX,text:text.slice(0,8),overflow:[...document.querySelectorAll('body *')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).slice(-12).map(e=>({tag:e.tagName,id:e.id,className:e.className,client:e.clientWidth,scroll:e.scrollWidth}))};});expect(s.scroll,JSON.stringify(s)).toBeLessThanOrEqual(s.width+1);}
function clean(c){expect(c.external).toEqual([]);expect(c.errors).toEqual([]);}
async function namedControls(root){for(const control of await root.locator('input:not([type=hidden]),select,textarea,button').all())if(await control.isVisible())await expect(control).toHaveAccessibleName(/\S/);}
for(const lang of ['pt','en','es'])test(`public ${lang}: keyboard, contact labels, live error and 320px reflow without submission`,async({page})=>{
 const c=await isolate(page);await page.setViewportSize({width:320,height:900});await page.goto('/formulario.html?lang='+lang);
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 const name=page.locator('#requestClientName');await name.focus();await expect(name).toBeFocused();await page.keyboard.type('Pessoa Sintetica');await page.keyboard.press('Tab');
 await expect(page.locator('#requestClientEmail')).toBeFocused();await expect(page.locator('#requestClientEmail')).toHaveAccessibleName(/\S/);await expect(page.locator('#requestClientPhone')).toHaveAccessibleName(/\S/);
 await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#clientFormStatus')).toHaveAttribute('data-status','error');await expect(page.locator('#clientFormStatus')).toHaveAttribute('aria-live','polite');await expect(page.locator('#clientFormStatus')).toContainText(/\S/);
 await namedControls(page.locator('#contactStep'));await reflow(page);
 await page.locator('#requestEventDate').fill('2099-11-04');await expect(page.locator('#requestEventDate')).toHaveValue('2099-11-04');await page.locator('#requestTimeRange').selectOption('morning');await expect(page.locator('#requestTimeRange')).toHaveValue('morning');await reflow(page);clean(c);
});
test('clients: keyboard comparison preserves independent quote records and reflows',async({page})=>{
 const c=await isolate(page);await page.setViewportSize({width:320,height:900});await page.goto('/clientes.html?qa=1');
 await expect(page.locator('.client-registry-card')).toHaveCount(2);const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});const comparison=page.locator('.client-quote-comparison');await comparison.locator('summary').focus();await page.keyboard.press('Enter');await expect(comparison).toHaveAttribute('open','');
 await comparison.getByRole('region').focus();await expect(comparison.getByRole('region')).toBeFocused();await expect(comparison.getByRole('region')).toHaveAccessibleName(/\S/);await reflow(page);
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});
test('new proposal: cancelling from keyboard preserves values and focus',async({page})=>{
 const c=await isolate(page);await page.goto('/index.html?qa=1');await page.locator('#clientName').fill('Rascunho sintetico');const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss();});const button=page.locator('#topbarNewProposalBtn');await button.focus();await page.keyboard.press('Enter');await expect(button).toBeFocused();
 await expect(page.locator('#clientName')).toHaveValue('Rascunho sintetico');expect(dialogs).toBe(1);expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});
test('calendar: navigation is read-only and accessible at enlarged text',async({page})=>{
 const c=await isolate(page);await page.goto('/index.html?qa=1');await page.evaluate(()=>{commercialCalendarMonth='2099-11';renderCommercialCalendar();document.documentElement.style.fontSize='200%';});const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 const month=page.locator('[data-commercial-calendar-month]');await expect(month).toHaveAccessibleName(/\S/);await month.fill('2099-10');await month.dispatchEvent('change');await expect(page.locator('[data-commercial-calendar-month]')).toBeFocused();await reflow(page);expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});
test('clients: synthetic scaling stays bounded and records lab-only render samples',async({page},info)=>{
 const c=await isolate(page);await page.goto('/clientes.html?qa=1');const samples=await page.evaluate(()=>{
  const seed=structuredClone(state.proposals[0]),report=[];
  for(const count of [100,500,1000]){state.proposals=Array.from({length:count},(_,i)=>({...structuredClone(seed),id:'scale-'+i,oportunidade_id:'scale-'+i,cliente_nome:'Pessoa Sintetica '+i,cliente_email:'person'+i+'@example.test',cliente_whatsapp:'',snapshot:{...structuredClone(seed.snapshot),clientName:'Pessoa Sintetica '+i,email:'person'+i+'@example.test',phone:''}}));const before=JSON.stringify(state.proposals),times=[];renderClientRegistry();for(let i=0;i<7;i++){const start=performance.now();renderClientRegistry();times.push(performance.now()-start);}times.sort((a,b)=>a-b);report.push({records:count,medianMs:times[3],maxMs:times[6],cards:document.querySelectorAll('.client-registry-card').length,recordsUnchanged:JSON.stringify(state.proposals)===before});}
  return report;
 });
 for(const row of samples){expect(row.cards).toBe(24);expect(row.recordsUnchanged).toBe(true);}
 await info.attach('synthetic-render-lab.json',{contentType:'application/json',body:Buffer.from(JSON.stringify({labOnly:true,fieldWebVitals:false,realLCP:false,realINP:false,realCLS:false,browser:info.project.name,samples},null,2))});clean(c);
});

test('contrast analyzer: detects insufficient ink and excludes unsupported overlays',async({page})=>{
 await page.setContent('<style>body{background:white;color:black;font:16px sans-serif}.overlay{position:relative}.overlay::before{content:"";position:absolute;inset:0;background:#333}</style><p id="contrast-black">Black</p><p id="contrast-white-fail" style="color:white">White</p><p id="contrast-normal-fail" style="color:#888">Normal</p><p id="contrast-large" style="color:#888;font-size:24px">Large</p><p id="contrast-alpha" style="background:black;color:rgba(255,255,255,.92)">Alpha</p><div class="overlay"><span id="contrast-overlay" style="color:white">Overlay</span></div><div style="opacity:.5"><p id="contrast-ancestor-opacity" style="background:white;color:black">Group opacity</p></div><div style="filter:opacity(.5)"><p id="contrast-ancestor-filter" style="background:white;color:black">Group filter</p></div><button disabled style="color:white;background:white">Disabled</button>');
 const report=await collectTextContrast(page);expect(report.failures.map(x=>x.selector).sort()).toEqual(['#contrast-normal-fail','#contrast-white-fail']);expect(report.checked).toBe(5);expect(report.skipped.map(x=>x.selector)).toEqual(expect.arrayContaining(['#contrast-ancestor-opacity','#contrast-ancestor-filter','#contrast-overlay']));
 await page.setContent('<style>html,body{background:transparent;color:white;font:16px sans-serif}</style><p id="contrast-unknown-canvas" style="background:rgba(0,0,0,.5)">Unknown canvas</p>');const canvas=await collectTextContrast(page);expect(canvas.checked).toBe(0);expect(canvas.failures).toEqual([]);expect(canvas.skipped.map(x=>x.selector)).toContain('#contrast-unknown-canvas');
});

test('contrast workspace: readable stage labels in sales and complete views',async({page},info)=>{
 const c=await isolate(page);await page.goto('/index.html?qa=1');await page.waitForFunction(()=>typeof state!=='undefined'&&state.proposals.length===3);const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 for(const mode of ['sales','full']){await page.locator('[data-workspace-mode="'+mode+'"]').click();if(mode==='full')await expect(page.locator('.metric-stage-pg-restante')).toBeVisible();const targets=await page.locator('.owner-metrics button:visible').evaluateAll(buttons=>buttons.flatMap(button=>[...button.querySelectorAll('span,strong')].map(el=>{const key=button.dataset.pipelineStageJump+'-'+el.tagName.toLowerCase();el.dataset.contrastTarget=key;return key;})));expect(targets.length).toBe(mode==='full'?18:10);const report=await collectTextContrast(page);await info.attach('contrast-workspace-'+mode+'.json',{contentType:'application/json',body:Buffer.from(JSON.stringify(report,null,2))});expect(report.checkedTargets.sort()).toEqual(targets.sort());expect(report.failures,JSON.stringify(report.failures)).toEqual([]);await page.locator('.owner-metrics').screenshot({path:info.outputPath('synthetic-metrics-'+mode+'.png')});}
 await page.setViewportSize({width:1440,height:1000});await page.locator('.owner-metrics').screenshot({path:info.outputPath('synthetic-metrics-desktop.png')});
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});

test('contrast clients: supported solid surfaces and read-only comparison',async({page},info)=>{
 const c=await isolate(page);await page.goto('/clientes.html?qa=1');await expect(page.locator('.client-registry-card')).toHaveCount(2);const before=await page.evaluate(()=>JSON.stringify(state.proposals));await page.locator('.client-quote-comparison summary').click();const report=await collectTextContrast(page);await info.attach('contrast-clients.json',{contentType:'application/json',body:Buffer.from(JSON.stringify(report,null,2))});expect(report.checked).toBeGreaterThanOrEqual(3);expect(report.failures,JSON.stringify(report.failures)).toEqual([]);expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});

test('contrast public form: readable solid panels and error feedback',async({page},info)=>{
 const c=await isolate(page);await page.goto('/formulario.html?lang=pt');await page.locator('.public-form-hero').screenshot({path:info.outputPath('synthetic-form-hero.png')});await page.locator('#submitClientQuoteBtn').click();const report=await collectTextContrast(page);await info.attach('contrast-public-form.json',{contentType:'application/json',body:Buffer.from(JSON.stringify(report,null,2))});expect(report.checked).toBeGreaterThanOrEqual(60);expect(report.failures,JSON.stringify(report.failures)).toEqual([]);clean(c);
});
