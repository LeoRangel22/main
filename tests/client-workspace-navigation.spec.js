const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
const loadFixtures=`function loadQaFixtures() {
 state.proposals=Array.from({length:60},(_,i)=>createQaProposal({
  id:'navigation-proposal-'+i,reference:'SYNTHETIC-'+i,
  clientName:'Cliente sintético '+String(i).padStart(2,'0'),
  email:'client'+i+'@example.test',phone:'',company:'Empresa sintética '+i,
  type:'Coquetel',date:'2099-11-04',time:'19:00',guests:30,duration:2,
  selectedIds:['coquetel-carioca'],total:2520,status:'negociacao'
 }));
 state.quoteRequests=[createQaRequest({id:'navigation-lead',clientName:'Lead sintético único',
  email:'lead@example.test',phone:'',eventType:'Coquetel',date:'2099-11-05',time:'19:00',guests:40,duration:2})];
 state.opportunities=[...state.proposals,...state.quoteRequests].map(p=>({
  id:p.oportunidade_id,status:p.status,responsavel_email:QA_USER_EMAIL,proxima_acao:'Revisar caso sintético'
 }));state.proposalViews=[];
}`;
async function openClients(page,width=390){
 const audit=await isolate(page,{loadFixtures});
 await page.setViewportSize({width,height:900});
 await page.goto('/clientes.html?qa=1');
 await expect(page.locator('body')).toHaveClass(/auth-connected/);
 await expect(page.locator('.client-registry-card')).toHaveCount(24);
 return audit;
}
for(const width of [390,1440])for(const origin of ['card','search'])test('client '+origin+' opens the correct authenticated proposal at '+width+'px',async({page})=>{
 const a=await openClients(page,width);
 await page.locator('#globalSearchInput').fill('Cliente sintético 00');
 const host=page.locator(origin==='card'?'#clientDirectory':'#globalSearchResults');
 await host.locator('button[data-proposal-id="navigation-proposal-0"]').first().click();
 await expect(page).toHaveURL(/index.html\?.*proposal=navigation-proposal-0/);
 await expect(page.locator('#clientName')).toHaveValue('Cliente sintético 00');
 await expect.poll(()=>page.evaluate(()=>state.activeProposalId)).toBe('navigation-proposal-0');
 expect(await page.evaluate(()=>hasUnsavedEditorChanges())).toBe(false);
 await expect(page.getByRole('link',{name:'Voltar aos clientes',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.locator('#clientName')).toHaveValue('Cliente sintético 00');
 await page.getByRole('link',{name:'Voltar aos clientes',exact:true}).click();
 await expect(page.locator('#globalSearchInput')).toHaveValue('Cliente sintético 00');
 await expect(page.locator('.client-registry-card')).toHaveCount(1);
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
test('lead from client search opens the lead without creating a proposal',async({page})=>{
 const a=await openClients(page);
 await page.locator('#globalSearchInput').fill('Lead sintético único');
 await page.locator('#globalSearchResults [data-use-request="navigation-lead"]').first().click();
 await expect(page).toHaveURL(/index.html\?.*lead=navigation-lead/);
 await expect(page.locator('#clientName')).toHaveValue('Lead sintético único');
 expect(await page.evaluate(()=>({lead:state.activeQuoteRequestId,proposal:state.activeProposalId,count:state.proposals.length})))
  .toEqual({lead:'navigation-lead',proposal:'',count:60});
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
test('all clients are reachable and pagination/query survive returning from the editor',async({page})=>{
 const a=await openClients(page);
 await expect(page.locator('#clientRegistryMeta')).toContainText('24 de 61');
 await page.locator('#clientRegistryMore').click();
 await expect(page.locator('.client-registry-card')).toHaveCount(48);
 await expect(page.locator('#clientRegistryMeta')).toContainText('48 de 61');
 await page.locator('#clientRegistryMore').click();
 await expect(page.locator('.client-registry-card')).toHaveCount(61);
 await expect(page.locator('#clientRegistryMeta')).toContainText('61 de 61');
 await expect(page.locator('#clientRegistryMore')).toBeHidden();
 await page.locator('#globalSearchInput').fill('Cliente sintético');
 await expect(page.locator('.client-registry-card')).toHaveCount(24);
 await page.locator('#clientRegistryMore').click();
 await expect(page.locator('.client-registry-card')).toHaveCount(48);
 await page.locator('#clientDirectory [data-proposal-id="navigation-proposal-0"]').click();
 await expect(page.locator('#clientName')).toHaveValue('Cliente sintético 00');
 await page.getByRole('link',{name:'Voltar aos clientes',exact:true}).click();
 await expect(page.locator('#globalSearchInput')).toHaveValue('Cliente sintético');
 await expect(page.locator('.client-registry-card')).toHaveCount(48);
 await page.locator('#globalSearchInput').fill('no-synthetic-match');
 await expect(page.locator('#clientDirectory')).toContainText('Nenhum cliente encontrado');
 await expect(page.locator('#clientRegistryMeta')).toContainText('0 de 0');
 await expect(page.locator('#clientRegistryMore')).toBeHidden();
 await page.locator('#globalSearchInput').fill('');
 await expect(page.locator('.client-registry-card')).toHaveCount(24);
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
test('unavailable target reports a problem without opening a different record',async({page})=>{
 const a=await isolate(page,{loadFixtures});await page.goto('/index.html?qa=1&proposal=unavailable-synthetic');
 await expect(page.locator('#dashboardTargetFeedback')).toContainText('ainda não está disponível');
 await expect(page.locator('#clientName')).toHaveValue('');
 expect(await page.evaluate(()=>state.activeProposalId)).toBe('');
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
test('tab-only client view is cleared after confirmed logout',async({page})=>{
 const a=await openClients(page);
 await page.locator('#globalSearchInput').fill('Cliente sintético 00');
 await page.locator('#clientDirectory [data-proposal-id="navigation-proposal-0"]').click();
 await expect(page.locator('#clientName')).toHaveValue('Cliente sintético 00');
 await page.getByRole('link',{name:'Voltar aos clientes',exact:true}).click();
 await expect(page.locator('#globalSearchInput')).toHaveValue('Cliente sintético 00');
 await page.locator('#logoutBtn').click();
 await expect(page.locator('body')).toHaveClass(/auth-locked/);
 expect(await page.evaluate(()=>sessionStorage.getItem('events_client_directory_view_v1'))).toBeNull();
 expect(a.external).toEqual([]);expect(a.errors).toEqual([]);
});
