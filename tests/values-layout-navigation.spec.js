const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
async function open(page,width){
 const a=await isolate(page);await page.setViewportSize({width,height:950});
 await page.goto('/valores.html?qa=1');
 await expect(page.locator('body')).toHaveClass(/auth-connected/);
 await expect(page.locator('#pricesTable tr').first()).toBeVisible();
 return a;
}
async function checkTables(page){
 const reflow=await page.evaluate(()=>({width:innerWidth,root:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&!n.closest('[data-table-scroll]')&&n.getBoundingClientRect().right>innerWidth+2).map(n=>({id:n.id,tag:n.tagName,cls:n.className,right:Math.round(n.getBoundingClientRect().right),width:Math.round(n.getBoundingClientRect().width)})).slice(0,16)}));
 if(reflow.root>reflow.width)console.log('VALUES_REFLOW '+JSON.stringify(reflow));
 expect(reflow.root<=reflow.width).toBe(true);
 expect(reflow.offenders).toEqual([]);
 const before=await page.evaluate(()=>JSON.stringify(state.prices));
 for(const name of ['Planilha de produtos','Tabela de privatização']){
  const pane=page.getByRole('region',{name,exact:true});
  await expect(pane).toHaveCSS('overflow-x','auto');
  const size=await pane.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));
  await pane.press('ArrowRight');await expect(pane).toBeFocused();
  if(size.scroll>size.width+1){
   await expect.poll(()=>pane.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
   await pane.evaluate(e=>e.scrollTo({left:e.scrollWidth}));
   const bounds=await pane.evaluate(e=>({pane:e.getBoundingClientRect().right,last:e.querySelector('th:last-child').getBoundingClientRect().right}));
   expect(bounds.last).toBeLessThanOrEqual(bounds.pane+2);
  }
  expect(await page.evaluate(()=>window.scrollX)).toBe(0);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>JSON.stringify(state.prices))).toBe(before);
}
for(const width of [320,390,768,900,1440])test('values tables scroll within the page at '+width+'px',async({page,browserName})=>{
 const a=await open(page,width);await checkTables(page);
 if([390,900].includes(width))await page.screenshot({path:'quality-results/values-layout-'+width+'-'+browserName+'.png'});
 await page.getByRole('link',{name:'Sistema de eventos',exact:true}).press('Enter');
 await expect(page).toHaveURL(/\/index\.html/);
 // The ordinary link leaves ?qa=1; the synthetic identity is not a real persisted session.
 await expect(page.locator('body')).toHaveAttribute('data-page','app');
 await expect(page.locator('body')).toHaveClass(/auth-locked/);
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
test('values controls reflow with 200 percent text without changing catalog values',async({page,browserName})=>{
 const a=await open(page,320);
 await page.locator('#authStatus').evaluate(e=>{e.textContent='Conectado como responsavel-de-eventos@empresa.example.test · Super admin.';});
 await page.addStyleTag({content:'html{font-size:200% !important}'});
 await checkTables(page);
 await page.locator('.values-command-panel').evaluate(e=>e.scrollIntoView({block:'start'}));
 await page.screenshot({path:'quality-results/values-layout-200-'+browserName+'.png'});
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
