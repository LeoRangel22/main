const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
const fixtures=`function loadQaFixtures() {
 const make=(id,name,date,status='proposta_pronta')=>({...createQaProposal({id,reference:id,clientName:name,email:id+'@example.test',phone:'',company:'Empresa Sintetica',type:'Coquetel',date,time:'19:00',guests:25,duration:3,selectedIds:['coquetel-carioca'],total:1200,status}),sent_at:null,publication_status:'ready'});
 state.proposals=[make('p-a','Ana','2099-11-20'),make('p-b','Bruna','2099-11-19'),make('p-c','Carlos','2099-11-18')];
 state.quoteRequests=[];state.opportunities=[];state.proposalViews=[];
}`;
async function setup(page,width=390){
 const audit=await isolate(page,{loadFixtures:fixtures});await page.setViewportSize({width,height:844});
 await page.goto('/index.html?qa=1');await expect(page.locator('body')).toHaveClass(/auth-connected/);
 await page.locator('.admin-quick-nav').getByRole('link',{name:'Funil',exact:true}).click();
 return audit;
}
for(const width of [320,390,768,1440])test('search and stage are direct at '+width+'px',async({page})=>{
 const audit=await setup(page,width);
 const panel=page.locator('#salesPipeline'),search=page.locator('#pipelineSearchInput'),stage=page.locator('#pipelineStageSelect');
 const rects=await page.evaluate(()=>['salesPipeline','pipelineSearchInput','pipelineStageSelect'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{top:r.top,bottom:r.bottom};}));
 expect(rects[1].top).toBeGreaterThanOrEqual(rects[0].top);expect(rects[2].bottom).toBeLessThan(844);
 await expect(search).toBeVisible();await expect(stage).toBeVisible();
 const widths=await page.evaluate(()=>{const nativeControls=[...document.querySelectorAll('input[type=date],input[type=month],input[type=time],select')].filter(n=>n.getClientRects().length).map(n=>({tag:n.tagName,id:n.id,type:n.type,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right,parent:n.parentElement.className,parentWidth:n.parentElement.getBoundingClientRect().width}));return{width:innerWidth,scroll:document.documentElement.scrollWidth,nativeControls,outside:[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().right>innerWidth+1).slice(0,16).map(n=>({tag:n.tagName,id:n.id,cls:n.className,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width,overflow:getComputedStyle(n).overflowX}))};});expect(widths.scroll,JSON.stringify(widths)).toBeLessThanOrEqual(widths.width+1);
 if(width<=600){await expect(page.locator('#pipelineViewMode')).toHaveValue('list');await expect(page.locator('#salesFunnelOverview details')).not.toHaveAttribute('open','');}
 else await expect(page.locator('#pipelineViewMode')).toHaveValue('board');
 await stage.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(stage).toBeFocused();expect(audit.external).toEqual([]);expect(audit.errors).toEqual([]);
});
test('stage list uses the page scroll and retains an explicit empty stage',async({page})=>{
 const audit=await setup(page);await page.locator('#pipelineStageSelect').selectOption('sales_ready');
 const list=page.locator('[data-view-stage="sales_ready"] .pipeline-column-list');
 const style=await list.evaluate(n=>({overflow:getComputedStyle(n).overflowY,max:getComputedStyle(n).maxHeight}));
 expect(style).toEqual({overflow:'visible',max:'none'});
 await expect(page.locator('#pipelineBoard .pipeline-column:visible')).toHaveCount(1);
 await page.locator('#pipelineStageSelect').selectOption('sales_lead');
 await expect(page.locator('[data-view-stage="sales_lead"]')).toBeVisible();
 await page.evaluate(()=>renderPipeline());
 await expect(page.locator('#pipelineStageSelect')).toHaveValue('sales_lead');
 await expect(page.locator('#pipelineSearchStatus')).toContainText('0 nesta etapa');
 await page.locator('#pipelineSearchInput').fill('Bruna');
 await expect(page.locator('#pipelineStageSelect')).toHaveValue('sales_ready');
 await expect(page.locator('#pipelineBoard .pipeline-card:visible')).toHaveCount(1);
 expect(audit.external).toEqual([]);expect(audit.errors).toEqual([]);
});
test('list and board preserve independent sort, filters and record context on return',async({page})=>{
 const audit=await setup(page);const before=await page.evaluate(()=>JSON.stringify([state.proposals,state.quoteRequests,state.opportunities]));
 await page.locator('#pipelineStageSelect').selectOption('sales_ready');
 const sort=page.locator('[data-pipeline-sort="sales_ready"]');await sort.selectOption('event');
 await page.locator('#pipelineSearchInput').fill('Empresa');
 await page.locator('#pipelineFilterSelect').selectOption('noPlan');
 const selected=page.locator('#pipelineBoard .pipeline-card:visible').first();
 const id=await selected.getAttribute('data-pipeline-card-id');
 await selected.locator('.pipeline-open-button').click();
 await expect(page.locator('#loadedEditorBar')).toBeVisible();
 await page.getByRole('button',{name:'Voltar ao funil',exact:true}).click();
 await expect(page.locator('#pipelineViewMode')).toHaveValue('list');
 await expect(page.locator('#pipelineStageSelect')).toHaveValue('sales_ready');
 await expect(page.locator('#pipelineFilterSelect')).toHaveValue('noPlan');
 await expect(page.locator('#pipelineSearchInput')).toHaveValue('Empresa');
 await expect(sort).toHaveValue('event');
 await expect(page.locator('[data-pipeline-card-id="'+id+'"]')).toBeFocused();
 await page.waitForTimeout(1600);
 expect(await page.locator('[data-pipeline-card-id="'+id+'"]').evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;})).toBe(true);
 await page.locator('#pipelineViewMode').selectOption('board');await expect(sort).toHaveValue('event');
 expect(await page.evaluate(()=>JSON.stringify([state.proposals,state.quoteRequests,state.opportunities]))).toBe(before);
 expect(audit.external).toEqual([]);expect(audit.errors).toEqual([]);
});
test('keyboard list at enlarged text and logout retain access boundaries',async({page})=>{
 const audit=await setup(page);await page.addStyleTag({content:'html{font-size:200%}'});
 await page.locator('#pipelineViewMode').selectOption('list');
 await page.locator('#pipelineStageSelect').selectOption('sales_ready');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('#pipelineSearchStatus')).toContainText('registros carregados');
 await page.evaluate(()=>{state.session=null;renderPipeline();});
 await expect(page.locator('#pipelineSearchInput')).toBeDisabled();await expect(page.locator('#pipelineStageSelect')).toBeDisabled();
 await expect(page.locator('#pipelineBoard .pipeline-card')).toHaveCount(0);await expect(page.locator('#salesFunnelOverview')).toBeHidden();
 expect(audit.external).toEqual([]);expect(audit.errors).toEqual([]);
});
