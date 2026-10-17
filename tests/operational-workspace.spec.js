const {test,expect}=require('@playwright/test');const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
async function open(page){await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');await page.evaluate(()=>{
 const p=state.proposals.find(p=>p.status==='confirmado')||state.proposals[0];Object.assign(p,{id:'ops-fixture',status:'confirmado',is_current:true,data_evento:EventWorkspace.dateKey(),horario_evento:'16:30',cliente_nome:'Operação fixture'});p.snapshot={...p.snapshot,pagamentoSinal:{valor:500,validacaoPendente:false,validadoPor:'qa',validadoEmail:'leorangel@gmail.com',validadoEm:new Date().toISOString()}};getOperationalHandoffData(p);renderPipeline();
 });await page.getByRole('button',{name:'Operação',exact:true}).click();}
test('dedicated operation agenda opens the current eight tasks without creating another checklist',async({page})=>{
 const errors=collectBrowserErrors(page);await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();
 await expect(page.locator('#operationWorkspace')).toBeVisible();await expect(page.locator('.operation-detail [data-handoff-task-id]')).toHaveCount(8);
 await expect(page.locator('.operation-detail')).toContainText('Reserva');await expect(page.locator('#salesPipeline')).toBeHidden();await expectNoBrowserErrors(errors);
});
test('planning a named owner does not acknowledge or complete the task; block records a reason',async({page})=>{
 await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();const root=page.locator('.operation-detail');
 await root.locator('[data-handoff-task-plan]').first().click();await page.locator('dialog [name="person"]').fill('Pessoa de teste');await page.getByRole('button',{name:'Salvar responsável e prazo'}).click();
 await expect(page.locator('dialog')).toHaveCount(0);await expect(root).toContainText('Pessoa de teste');
 const t=await page.evaluate(()=>getOperationalHandoffData(state.proposals.find(p=>p.id==='ops-fixture')).tasks[0]);expect(t.status).toBe('pending');expect(t.acknowledged_at).toBeNull();
 page.once('dialog',d=>d.accept('Aguardando confirmação do fornecedor'));await root.locator('[data-handoff-task-block]').first().click();await expect(root).toContainText('Aguardando confirmação do fornecedor');
});
test('operation workspace remains usable on a phone',async({page})=>{await page.setViewportSize({width:390,height:844});await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();await expectNoHorizontalOverflow(page);});
