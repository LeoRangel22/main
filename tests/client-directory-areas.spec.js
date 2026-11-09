const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
const loadFixtures=`function loadQaFixtures() {
 const types=["Agência de turismo receptivo / DMC","Agência de marketing / eventos","Empresa","Pessoa física"];
 const statuses=["negociacao","confirmado","pos_venda","cancelado","proposta_pronta"];
 state.proposals=Array.from({length:56},(_,i)=>createQaProposal({
  id:'directory-'+i,reference:'SYN-'+i,clientName:i===0?'Mariana Alfa':'Contato '+String(i).padStart(2,'0'),
  email:'client'+i+'@example.test',phone:i===0?'+55 (21) 99999-0000':'',
  company:i===0?'Fábrica Aurora':'Empresa '+i,clientType:types[i%4],type:'Coquetel',
  date:i%2?'2099-11-05':'2099-11-04',time:'19:00',guests:30,duration:2,
  selectedIds:['coquetel-carioca'],total:2520,status:statuses[i%5]
 }));
 for(let i=0;i<2;i++)state.proposals.push(createQaProposal({id:'homonym-'+i,clientName:'Mesmo Nome',
  company:'Mesma Empresa',email:'',phone:'',type:'Coquetel',date:'2099-11-04',time:'19:00',guests:30,duration:2,
  selectedIds:['coquetel-carioca'],total:2520,status:'negociacao'}));
 state.proposals.forEach(p=>{p.created_at='2099-01-09T12:00:00Z';p.updated_at=p.created_at;});
 state.quoteRequests=[createQaRequest({id:'declared-unknown',clientName:'Agência Turismo sem classificação',
  company:'Turismo Sintético',email:'unknown@example.test',phone:'',eventType:'Coquetel',
  date:'2099-11-04',time:'19:00',guests:40,duration:2})];
 state.quoteRequests[0].snapshot.qualificacao={};
 state.opportunities=[...state.proposals,...state.quoteRequests].map(p=>({
  id:p.oportunidade_id,status:p.status,responsavel_email:QA_USER_EMAIL,proxima_acao:'Conferir caso sintético'
 }));state.proposalViews=[];
}`;
async function open(page,width=390,hash=''){
 const audit=await isolate(page,{loadFixtures});await page.setViewportSize({width,height:950});
 await page.goto('/clientes.html?qa=1'+hash);
 await expect(page.locator('body')).toHaveClass(/auth-connected/);
 await expect(page.locator('.client-registry-card')).toHaveCount(24);
 return audit;
}
async function history(page){
 await page.evaluate(()=>{
  window.syntheticHistoryCalls=[];
  EventCrmHistory.setSession({user:{id:'synthetic-directory-owner'},client:{rpc:async(name,params)=>{
   window.syntheticHistoryCalls.push({name,params});
   return {error:null,data:{available:true,batch_id:'synthetic-directory',summary:{organization:40,contact:0,event:0,realized:0},
    period_start:'2098-01-01',period_end:'2099-01-01',total:40,offset:0,limit:20,
    records:Array.from({length:20},(_,i)=>({id:'account-'+i,name:'Conta Sintética '+i,domain:'company'+i+'.example.test',segment:'Empresa',source_count:0}))}};
  }}});
 });
 await expect(page.locator('#clientHistoryLink')).toBeVisible();
 await expect(page.locator('#crmHistoryResults .crm-history-card')).toHaveCount(20);
}
function clean(a){expect(a.external).toEqual([]);expect(a.errors).toEqual([]);}
for(const width of [320,390,768,900,1440])test('client areas use keyboard navigation without rebuilding history at '+width+'px',async({page,browserName})=>{
 const a=await open(page,width);await history(page);
 await page.locator('#globalSearchInput').fill('Contato');
 await page.locator('#clientSegmentFilter').selectOption('company');
 await expect(page.locator('.client-registry-card')).toHaveCount(14);
 const hit=await page.locator('#globalSearchResults .global-search-hit').first().evaluate(n=>{
  const text=n.querySelector('strong').getBoundingClientRect(), action=n.querySelector('button').getBoundingClientRect();
  return {textLeft:text.left,actionLeft:action.left,actionWidth:action.width,width:n.getBoundingClientRect().width,actionHeight:action.height};
 });
 expect(hit.textLeft).toBeLessThan(hit.actionLeft);expect(hit.actionWidth).toBeLessThan(hit.width/2);expect(hit.actionHeight).toBeGreaterThanOrEqual(44);
 await page.getByRole('link',{name:'Histórico recuperado',exact:true}).press('Enter');
 await expect(page.locator('#currentClients')).toBeHidden();
 await expect(page.locator('#clientHistoryArea')).toBeVisible();
 await expect(page.locator('#clientHistoryArea')).toBeFocused();
 await expect(page.locator('#clientHistoryLink')).toHaveAttribute('aria-current','location');
 await expect(page.locator('#crmHistorySearch')).toBeInViewport();
 await page.locator('#crmHistorySearch').fill('Conta Aurora');
 await page.locator('#crmHistorySearch').press('Enter');
 await page.locator('#crmHistoryNext').click();
 await expect(page.locator('#crmHistoryPage')).toContainText('21–40 de 40');
 const calls=await page.evaluate(()=>syntheticHistoryCalls.length);
 await page.getByRole('link',{name:'Clientes atuais',exact:true}).press('Enter');
 await expect(page.locator('#currentClients')).toBeFocused();
 await expect(page.locator('#globalSearchInput')).toHaveValue('Contato');
 await expect(page.locator('#clientSegmentFilter')).toHaveValue('company');
 await expect(page.locator('.client-registry-card')).toHaveCount(14);
 await expect(page.locator('#clientHistoryArea')).toBeHidden();
 await page.goBack();
 await expect(page.locator('#clientHistoryArea')).toBeVisible();
 await expect(page.locator('#crmHistorySearch')).toHaveValue('Conta Aurora');
 await expect(page.locator('#crmHistoryPage')).toContainText('21–40 de 40');
 expect(await page.evaluate(()=>syntheticHistoryCalls.length)).toBe(calls);
 await page.goForward();await expect(page.locator('#currentClients')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if([390,900].includes(width))await page.screenshot({path:'quality-results/client-directory-'+width+'-'+browserName+'.png'});
 clean(a);
});
test('client search combines names company event or receipt date and formatted phone',async({page})=>{
 const a=await open(page);
 for(const query of ['Mariana Aurora 04/11/2099','client0@example.test 09/01/2099','+55 (21) 99999-0000','Fabrica Aurora','Mariana 30 pax']){
  await page.locator('#globalSearchInput').fill(query);
  await expect(page.locator('.client-registry-card')).toHaveCount(1);
  await expect(page.locator('#clientDirectory')).toContainText('Mariana Alfa');
  await expect(page.locator('#globalSearchResults')).toContainText('Mariana Alfa');
 }
 await page.locator('#globalSearchInput').fill('Contato 19');
 await expect(page.locator('.client-registry-card')).toHaveCount(1);
 await expect(page.locator('#clientDirectory')).toContainText('Contato 19');
 await page.locator('#globalSearchInput').fill('Mariana 31/02/2099');
 await expect(page.locator('#clientRegistryMeta')).toContainText('0 de 0');
 await expect(page.locator('#globalSearchResults')).toContainText('Nada encontrado');
 clean(a);
});
test('segments are declared data and homonyms remain separate contacts',async({page})=>{
 const a=await open(page);
 await page.locator('#clientSegmentFilter').selectOption('unknown');
 await expect(page.locator('.client-registry-card')).toHaveCount(3);
 await expect(page.locator('#clientDirectory')).toContainText('Sem segmento informado');
 await page.locator('#globalSearchInput').fill('Mesmo Nome');
 await expect(page.locator('.client-registry-card')).toHaveCount(2);
 await page.locator('#globalSearchInput').fill('Agência Turismo sem classificação');
 await expect(page.locator('.client-registry-card')).toHaveCount(1);
 await page.locator('#clientSegmentFilter').selectOption('tourism');
 await expect(page.locator('#clientRegistryMeta')).toContainText('0 de 0');
 await page.locator('#clearClientFilters').click();
 await expect(page.locator('#globalSearchInput')).toBeFocused();
 await expect(page.locator('#clientRegistryMeta')).toContainText('24 de 59');
 clean(a);
});
test('relationship filters use existing states and survive returning from the right record',async({page})=>{
 const a=await open(page);
 await page.locator('#clientRegistryMore').click();
 await expect(page.locator('.client-registry-card')).toHaveCount(48);
 await page.locator('#clientSegmentFilter').selectOption('company');
 await expect(page.locator('.client-registry-card')).toHaveCount(14);
 await page.locator('#clientRelationshipFilter').selectOption('realized');
 await expect(page.locator('.client-registry-card')).toHaveCount(3);
 await page.locator('#clientRelationshipFilter').selectOption('open');
 await expect(page.locator('.client-registry-card')).toHaveCount(6);
 await expect(page.locator('#clientRegistryMeta')).toContainText('6 de 6');
 await expect(page.locator('#clientRegistryMeta')).toContainText('59 na carteira');
 await page.locator('#clientDirectory [data-proposal-id="directory-10"]').click();
 await expect(page.locator('#clientName')).toHaveValue('Contato 10');
 await page.getByRole('link',{name:'Voltar aos clientes',exact:true}).click();
 await expect(page.locator('#clientSegmentFilter')).toHaveValue('company');
 await expect(page.locator('#clientRelationshipFilter')).toHaveValue('open');
 await expect(page.locator('.client-registry-card')).toHaveCount(6);
 await page.locator('#logoutBtn').click();
 await expect(page.locator('body')).toHaveClass(/auth-locked/);
 await expect(page.locator('#clientSegmentFilter')).toHaveValue('all');
 await expect(page.locator('#clientRelationshipFilter')).toHaveValue('all');
 expect(await page.evaluate(()=>sessionStorage.getItem('events_client_directory_view_v1'))).toBeNull();
 clean(a);
});
test('unavailable history request waits for access and clears on revocation',async({page})=>{
 const a=await open(page);
 await page.evaluate(()=>EventCrmHistory.setSession(null));
 await expect(page.locator('#clientHistoryLink')).toBeHidden();
 await page.evaluate(()=>new Promise(resolve=>{window.addEventListener('hashchange',()=>resolve(),{once:true});location.hash='crmHistoryMount';}));
 await expect(page.locator('#clientHistoryArea')).toBeHidden();
 await history(page);
 await expect(page.locator('#clientHistoryArea')).toBeVisible();
 await expect(page.locator('#currentClients')).toBeHidden();
 await page.evaluate(()=>EventCrmHistory.setSession(null));
 await expect(page.locator('#clientHistoryLink')).toBeHidden();
 await expect(page.locator('#clientHistoryArea')).toBeHidden();
 await expect(page.locator('#currentClients')).toBeVisible();
 await expect(page.locator('#crmHistoryResults .crm-history-card')).toHaveCount(0);
 await expect(page).toHaveURL(/#currentClients$/);
 clean(a);
});
test('client filters and current area reflow with 200 percent text and a short window',async({page})=>{
 const a=await open(page,390);await page.addStyleTag({content:'html{font-size:200% !important}'});
 await page.setViewportSize({width:390,height:480});
 await expect(page.locator('.client-section-nav')).toHaveCSS('position','static');
 for(const id of ['clientSegmentFilter','clientRelationshipFilter']){
  await page.locator('#'+id).selectOption(id.includes('Segment')?'company':'open');
  const bounds=await page.locator('#'+id).boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#clearClientFilters').click();await expect(page.locator('#globalSearchInput')).toBeFocused();
 clean(a);
});
