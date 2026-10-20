const {test,expect}=require('@playwright/test');const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
async function open(page){await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');await page.evaluate(()=>{
 const p=structuredClone(state.proposals.find(p=>p.status==='confirmado')||state.proposals[0]);p.oportunidade_id='ops-fixture-opp';state.proposals.push(p);Object.assign(p,{id:'ops-fixture',status:'confirmado',is_current:true,data_evento:EventWorkspace.dateKey(),horario_evento:'16:30',cliente_nome:'Operação fixture'});p.snapshot={...p.snapshot,pagamentoSinal:{valor:500,validacaoPendente:false,validadoPor:'qa',validadoEmail:'leorangel@gmail.com',validadoEm:new Date().toISOString()}};getOperationalHandoffData(p);renderPipeline();
 });await page.getByRole('button',{name:'Operação',exact:true}).click();}
test('dedicated operation agenda opens the current eight tasks without creating another checklist',async({page})=>{
 const errors=collectBrowserErrors(page);await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();
 await expect(page.locator('#operationWorkspace')).toBeVisible();await expect(page.locator('.operation-detail [data-handoff-task-id]')).toHaveCount(8);
 await expect(page.locator('.operation-detail')).toContainText(/reserva/i);await expect(page.locator('#salesPipeline')).toBeHidden();await expectNoBrowserErrors(errors);
});
test('planning a named owner does not acknowledge or complete the task; block records a reason',async({page})=>{
 await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();const root=page.locator('.operation-detail');
 await root.locator('[data-handoff-task-plan]').first().click();await page.locator('dialog [name="person"]').fill('Pessoa de teste');await page.getByRole('button',{name:'Salvar responsável e prazo'}).click();
 await expect(page.locator('dialog')).toHaveCount(0);await expect(root).toContainText('Pessoa de teste');
 const t=await page.evaluate(()=>getOperationalHandoffData(state.proposals.find(p=>p.id==='ops-fixture')).tasks[0]);expect(t.status).toBe('pending');expect(t.acknowledged_at).toBeNull();
 page.once('dialog',d=>d.accept('Aguardando confirmação do fornecedor'));await root.locator('[data-handoff-task-block]').first().click();await expect(root).toContainText('Aguardando confirmação do fornecedor');
});
test('operation workspace remains usable on a phone',async({page})=>{await page.setViewportSize({width:390,height:844});await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();await expectNoHorizontalOverflow(page);});
test('cohort reporting distinguishes mature decisions and does not invent QA conversion',async({page})=>{await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');await page.locator('#eventOperations summary').click();await page.locator('[data-ops-tab="metrics"]').click();await expect(page.getByRole('heading',{name:'Conversão por oportunidade'})).toBeVisible();await expect(page.locator('[aria-label="Conversão com evidências"]')).toContainText('Aguardando coorte madura');});
test('focused selling moves through context without losing entered data or hiding a review target',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');await page.evaluate(()=>{state.activeProposalId='';state.manualSourceKey='manual:new';renderAll();});
 await page.locator('[data-sales-focus]').check();await page.locator('#clientName').fill('Teste de foco');await page.locator('[data-sales-next]').click();await expect(page.locator('#clientDataSection')).toBeHidden();await expect(page.locator('#eventConfigSection')).toBeVisible();await page.locator('[data-sales-step="0"]').click();await expect(page.locator('#clientName')).toHaveValue('Teste de foco');
 await page.evaluate(()=>scrollToReviewTarget('items'));await expect(page.locator('#quoteItemsSection')).toBeVisible();
});
test('payment screen separates references from bank transactions and requires statement identification',async({page})=>{await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');await page.locator('#eventOperations summary').click();await page.locator('[data-ops-tab="payments"]').click();await page.locator('[data-ops-selector]').selectOption('qa-opp-qa-proposal-sem-resposta');await expect(page.getByRole('heading',{name:'Pagamento e conciliação'})).toBeVisible();await page.locator('[data-payment-record]').click();await expect(page.locator('dialog [name="reference"]')).toHaveAttribute('required','');await expect(page.locator('dialog [name="confirmed"]')).not.toBeChecked();await page.locator('dialog [data-ops-close]').click();});
test('production requires declared quantities and stock and never fabricates margin',async({page})=>{
 await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();await page.locator('[data-production-edit]').click();
 const d=page.locator('dialog');await d.locator('[data-production-add]').click();await d.locator('[data-field="ingredient"]').fill('Insumo fixture');await d.locator('[data-field="quantity"]').fill('0.1');await d.locator('[name="setup"]').fill('30');await d.locator('[name="teardown"]').fill('15');await d.getByRole('button',{name:'Salvar planejamento',exact:true}).click();
 await expect(d).toHaveCount(0);await expect(page.locator('.operation-detail')).toContainText('comprar: a conferir');await expect(page.locator('.operation-detail')).toContainText('Custos incompletos');
});

test('switching events removes old actions immediately, and a failed read never targets the new event',async({page})=>{
 await open(page);await page.locator('[data-operation-select="ops-fixture"]').click();
 await page.evaluate(()=>{
  const p=structuredClone(state.proposals.find(p=>p.id==='ops-fixture'));Object.assign(p,{id:'ops-second',oportunidade_id:'ops-second-opp',cliente_nome:'Segundo evento'});state.proposals.push(p);getOperationalHandoffData(p);renderOperationWorkspace();
  const original=ensureFullProposal;ensureFullProposal=async id=>id==='ops-second'?await new Promise((resolve,reject)=>window.finishSecondRead={resolve,reject}):original(id);
 });
 await page.locator('[data-operation-select="ops-second"]').click();await expect(page.locator('.operation-detail')).toContainText('Consultando o acordo escolhido');
 await expect(page.locator('.operation-detail button')).toHaveCount(0);await expect(page.locator('.operation-detail [data-handoff-task-id]')).toHaveCount(0);
 await page.evaluate(()=>window.finishSecondRead.reject(Error('Fixture unavailable')));await expect(page.locator('.operation-detail')).toContainText('Fixture unavailable');await expect(page.locator('.operation-detail button')).toHaveCount(0);
 const untouched=await page.evaluate(()=>getOperationalHandoffData(state.proposals.find(p=>p.id==='ops-second')).tasks.every(t=>!t.acknowledged_at&&!t.completed_at));expect(untouched).toBe(true);
 await page.locator('[data-operation-select="ops-fixture"]').click();await expect(page.locator('.operation-detail [data-handoff-task-id]')).toHaveCount(8);
});

test('agenda exposes unnamed people and unacknowledged tasks without implying completion',async({page})=>{
 await open(page);const card=page.locator('[data-operation-select="ops-fixture"]');await expect(card).toContainText('8 sem pessoa responsável');await expect(card).toContainText('8 sem ciência registrada');await expect(card).toContainText('0/8 tarefas');
});

test('discount decision remains bound to reviewed revision and cancel creates no approval',async({page})=>{
 await open(page);await page.evaluate(()=>{const p=state.proposals.find(p=>p.id==='ops-fixture');p.revision=1;p.snapshot.totals={...p.snapshot.totals,adjustment:-2000};return showOpsDiscountApproval(p.id);});
 let d=page.locator('dialog');await expect(d).toContainText('revisão 1');await expect(d).toContainText('Desconto comercial: R$');await expect(d).toContainText('privatização tem alçada própria');
 await page.evaluate(()=>{state.proposals.find(p=>p.id==='ops-fixture').revision=2;});await d.locator('input[type=checkbox]').check();await d.getByRole('button',{name:'Aprovar esta versão',exact:true}).click();await expect(d.locator('[role=alert]')).toContainText('proposta mudou');
 await d.getByRole('button',{name:'Voltar',exact:true}).click();expect(await page.evaluate(()=>window.EventOperationsState.approvals.some(a=>a.proposal_id==='ops-fixture'))).toBe(false);
 await page.evaluate(()=>showOpsDiscountApproval('ops-fixture'));d=page.locator('dialog');await expect(d).toContainText('revisão 2');await expect(d.locator('input[type=checkbox]')).not.toBeChecked();await d.getByRole('button',{name:'Voltar',exact:true}).click();
});
