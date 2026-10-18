const {test,expect}=require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors}=require('./support');
const line='10000000-0000-4000-8000-000000000001';
const crew='10000000-0000-4000-8000-000000000002';
async function open(page){
 await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');
 await page.evaluate(({line,crew})=>{
  const p=structuredClone(state.proposals.find(p=>p.status==='confirmado')||state.proposals[0]);
  Object.assign(p,{id:'production-cost-fixture',oportunidade_id:'production-cost-opp',status:'confirmado',is_current:true,data_evento:EventWorkspace.dateKey(),horario_evento:'16:30',cliente_nome:'Custos fixture',convidados:20});
  p.snapshot={...p.snapshot,pagamentoSinal:{valor:500,validacaoPendente:false,validadoPor:'qa',validadoEmail:'leorangel@gmail.com',validadoEm:new Date().toISOString()}};
  state.proposals.push(p);getOperationalHandoffData(p);
  productionQa.set(p.id,{revision:1,reviewed_at:new Date().toISOString(),costs:{[line]:10,[crew]:20,fixed:0},data:{
   rows:[{id:line,item:0,ingredient:'Limão fixture',sector:'bar',unit:'kg',basis:'guest',quantity:.1,yield:80,loss:10,stock:1}],
   crew:[{id:crew,sector:'bar',lead:'Pessoa fixture',people:1,hours:2}],crew_reason:'',stock_checked_at:new Date().toISOString(),
   logistics:{space:'Lounge fixture',setup:30,teardown:15,access:'Acesso conferido para fixture.',tickets:'Ingressos conferidos para fixture.',weather:'Contingência conferida para fixture.',authorization:'not_required',authorization_notes:'Escopo fixture sem atração externa.'}
  }});renderPipeline();
 },{line,crew});
 await page.getByRole('button',{name:'Operação',exact:true}).click();
 await page.locator('[data-operation-select="production-cost-fixture"]').click();
 await expect(page.locator('.operation-detail')).toContainText('Estimativa de contribuição');
}
test('clearing and reopening a saved cost keeps it unknown, while explicit zero restores a complete estimate',async({page})=>{
 const errors=collectBrowserErrors(page);await open(page);
 await page.locator('[data-production-costs]').click();let d=page.locator('dialog');
 await d.locator(`[data-cost-key="${line}"]`).fill('');await d.getByRole('button',{name:'Salvar custos conhecidos'}).click();
 await expect(d).toHaveCount(0);await expect(page.locator('.operation-detail')).toContainText('1 custo(s) ainda não informados; margem não calculada.');
 await page.locator('[data-production-costs]').click();d=page.locator('dialog');
 await expect(d.locator(`[data-cost-key="${line}"]`)).toHaveValue('');await expect(d.locator('[data-cost-key="fixed"]')).toHaveValue('0');
 await d.locator(`[data-cost-key="${line}"]`).fill('0');await d.getByRole('button',{name:'Salvar custos conhecidos'}).click();
 await expect(page.locator('.operation-detail')).toContainText('Estimativa de contribuição');await expectNoBrowserErrors(errors);
});
test('canceling a cleared cost leaves the prior value intact',async({page})=>{
 await open(page);await page.locator('[data-production-costs]').click();const d=page.locator('dialog');
 await d.locator(`[data-cost-key="${line}"]`).fill('');await d.locator('[data-ops-close]').click();
 await expect(page.locator('.operation-detail')).toContainText('Estimativa de contribuição');
 await page.locator('[data-production-costs]').click();await expect(page.locator(`dialog [data-cost-key="${line}"]`)).toHaveValue('10');
});
test('an ingredient edit with the same UUID requires a new cost even after operational review',async({page})=>{
 await open(page);await page.locator('[data-production-edit]').click();const d=page.locator('dialog');
 await d.locator('[data-field="ingredient"]').fill('Laranja fixture');await d.getByRole('button',{name:'Salvar planejamento',exact:true}).click();
 await expect(d).toHaveCount(0);page.once('dialog',dialog=>dialog.accept());await page.locator('[data-production-review]').click();
 await expect(page.locator('.operation-detail')).toContainText('1 custo(s) ainda não informados; margem não calculada.');
 await page.locator('[data-production-costs]').click();await expect(page.locator(`dialog [data-cost-key="${line}"]`)).toHaveValue('');
 await expect(page.locator(`dialog [data-cost-key="${crew}"]`)).toHaveValue('20');
 await expect(page.locator('dialog')).toContainText('Laranja fixture');
});
test('a stale cost dialog cannot erase an amount saved by another session',async({page})=>{
 await open(page);await page.evaluate(async line=>{delete productionQa.get('production-cost-fixture').costs[line];await loadProductionWorkspace('production-cost-fixture');},line);
 await page.locator('[data-production-costs]').click();const d=page.locator('dialog');
 await expect(d.locator(`[data-cost-key="${line}"]`)).toHaveValue('');
 // Another session submits a known value while this dialog is still open.
 await page.evaluate(line=>{const plan=productionQa.get('production-cost-fixture');plan.costs[line]=15;plan.revision++;},line);
 await d.locator(`[data-cost-key="${crew}"]`).fill('25');await d.getByRole('button',{name:'Salvar custos conhecidos'}).click();
 await expect(d.getByRole('alert')).toContainText('O plano ou acordo mudou');
 expect(await page.evaluate(({line,crew})=>{const p=productionQa.get('production-cost-fixture');return [p.costs[line],p.costs[crew],p.revision];},{line,crew})).toEqual([15,20,2]);
 await d.locator('[data-ops-close]').click();await page.locator('[data-production-refresh]').click();await page.locator('[data-production-costs]').click();
 await expect(page.locator(`dialog [data-cost-key="${line}"]`)).toHaveValue('15');
});
