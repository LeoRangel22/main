const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
const {diagnoseOverflow}=require('./overflow-diagnostics.cjs');
const fixtures=`function loadQaFixtures() {
 const p=createQaProposal({id:'editor-current',reference:'editor-current',clientName:'Cliente Sintetico com nome extenso para conferir o contexto durante a edicao',email:'visitor@example.test',phone:'',company:'Empresa Sintetica',type:'Coquetel',date:'2099-11-20',time:'19:00',guests:25,duration:3,selectedIds:['coquetel-carioca'],total:1200,status:'proposta_pronta'});
 Object.assign(p,{versao:1,revision:2,is_current:true,publication_status:'draft',sent_at:null});
 state.proposals=[p];state.quoteRequests=[];state.opportunities=[];state.proposalViews=[];
}`;
async function setup(page,width=390,height=844){
 const audit=await isolate(page,{loadFixtures:fixtures});await page.setViewportSize({width,height});
 await page.goto('/index.html?qa=1&proposal=editor-current');
 await expect(page.locator('body')).toHaveClass(/auth-connected/);
 await expect(page.locator('#loadedEditorBar')).toBeVisible();
 return audit;
}
function clean(audit){expect(audit.external).toEqual([]);expect(audit.errors).toEqual([]);}
async function reflow(page){const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));if(size.scroll>size.width+1)throw Error('Editor overflow '+JSON.stringify({size,diagnostics:await diagnoseOverflow(page)}));}
for(const width of [320,390,768,900,1440])test('current quote actions stay visible beyond the catalog at '+width,async({page},testInfo)=>{
 const audit=await setup(page,width);const bar=page.locator('#loadedEditorBar');
 await page.locator('#quoteCalcSection').scrollIntoViewIfNeeded();
 await expect(bar).toBeInViewport({ratio:1});
 await expect(bar.getByRole('button',{name:'Salvar agora como rascunho',exact:true})).toBeEnabled();
 await expect(bar.getByRole('button',{name:'Revisar esta versão',exact:true})).toBeEnabled();
 await expect(bar.locator('[data-editor-summary]')).toContainText('V1');
 await expect(bar.locator('[data-editor-summary]')).toContainText('25 pax');
 await expect(bar.locator('[data-editor-total]')).toHaveText(await page.locator('#grandTotal').innerText());
 const positions=await page.evaluate(()=>{const h=document.querySelector('.topbar'),b=document.querySelector('#loadedEditorBar');return{header:getComputedStyle(h).position==='sticky'?h.getBoundingClientRect().bottom:0,barTop:b.getBoundingClientRect().top,barBottom:b.getBoundingClientRect().bottom,height:innerHeight};});
 expect(positions.barTop).toBeGreaterThanOrEqual(positions.header+7);
 expect(positions.barBottom).toBeLessThan(positions.height*.65);
 await reflow(page);if(width===390||width===900)await page.screenshot({path:'quality-results/editor-context-'+width+'-'+testInfo.project.name+'.png'});clean(audit);
});
test('draft shortcut delegates once and respects disabled busy and missing-session states',async({page})=>{
 const audit=await setup(page);const shortcut=page.locator('#loadedEditorBar [data-editor-action="draft"]');
 await page.evaluate(()=>{window.__draftClicks=0;document.querySelector('#saveDraftBtn').addEventListener('click',event=>{event.stopImmediatePropagation();event.preventDefault();window.__draftClicks++;},true);});
 await shortcut.click();expect(await page.evaluate(()=>window.__draftClicks)).toBe(1);
 await page.evaluate(()=>document.querySelector('#saveDraftBtn').disabled=true);await expect(shortcut).toBeDisabled();await shortcut.dispatchEvent('click');expect(await page.evaluate(()=>window.__draftClicks)).toBe(1);
 await page.evaluate(()=>document.querySelector('#saveDraftBtn').disabled=false);await expect(shortcut).toBeEnabled();await shortcut.focus();
 await page.evaluate(()=>{state.proposalSaveInProgress=true;document.querySelector('#saveProposalBtn').setAttribute('aria-busy','true');});
 await expect(shortcut).toBeFocused();
 await expect(shortcut).toBeDisabled();await shortcut.dispatchEvent('click');expect(await page.evaluate(()=>window.__draftClicks)).toBe(1);
 await page.evaluate(()=>{state.proposalSaveInProgress=false;document.querySelector('#saveProposalBtn').removeAttribute('aria-busy');});await expect(shortcut).toBeEnabled();
 await shortcut.focus();await shortcut.press('Enter');expect(await page.evaluate(()=>window.__draftClicks)).toBe(2);
 await page.evaluate(()=>{state.session=null;renderLoadedEditorBar();});await expect(shortcut).toBeDisabled();await shortcut.dispatchEvent('click');expect(await page.evaluate(()=>window.__draftClicks)).toBe(2);
 clean(audit);
});
test('review shortcut is read-only and returns to event configuration with keyboard focus',async({page})=>{
 const audit=await setup(page,900);const before=await page.evaluate(()=>JSON.stringify([state.proposals,state.quoteRequests,state.opportunities]));
 await page.locator('#loadedEditorBar [data-editor-action="review"]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#sendReviewPanel')).toBeFocused();await expect(page.locator('dialog[open]')).toHaveCount(0);
 const reviewTop=await page.locator('#sendReviewPanel').evaluate(n=>n.getBoundingClientRect().top),headerBottom=await page.locator('.topbar').evaluate(n=>n.getBoundingClientRect().bottom);
 expect(reviewTop).toBeGreaterThanOrEqual(headerBottom-1);
 await page.locator('#sendReviewPanel [data-review-target="items"]').first().click();
 await expect(page.locator('#eventConfigSection h2')).toBeFocused();
 expect(await page.evaluate(()=>JSON.stringify([state.proposals,state.quoteRequests,state.opportunities]))).toBe(before);
 await expect(page.locator('dialog[open]')).toHaveCount(0);clean(audit);
});
test('dirty context keeps typing focus and cancelling New preserves the same version',async({page})=>{
 const audit=await setup(page);await page.locator('#notes').fill('Synthetic draft kept while navigating.');
 await expect(page.locator('#loadedEditorBar')).toContainText('Não salvo');
 await page.waitForTimeout(1000);await expect(page.locator('#notes')).toBeFocused();
 await expect(page.locator('#loadedEditorBar [data-editor-summary]')).toContainText('V1');
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('#newProposalBtn').click();
 await expect(page.locator('#notes')).toHaveValue('Synthetic draft kept while navigating.');
 await expect(page.locator('#loadedEditorBar')).toContainText('Não salvo');
 expect(await page.evaluate(()=>state.activeProposalId)).toBe('editor-current');clean(audit);
});
test('large text and short windows keep the editor usable without clipping',async({page})=>{
 const audit=await setup(page,320);await page.addStyleTag({content:'html{font-size:200%}'});
 await page.locator('#quoteCalcSection').scrollIntoViewIfNeeded();await reflow(page);
 await expect(page.locator('#loadedEditorBar [data-editor-action="draft"]')).toBeVisible();
 await page.setViewportSize({width:390,height:480});await expect(page.locator('#loadedEditorBar')).toHaveCSS('position','static');
 await page.locator('#notes').click();await expect(page.locator('#notes')).toBeFocused();
 const box=await page.locator('#notes').boundingBox();expect(box.y).toBeGreaterThanOrEqual(-1);expect(box.y+box.height).toBeLessThanOrEqual(481);expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(391);
 await reflow(page);clean(audit);
});
