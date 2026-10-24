const {test,expect} = require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors} = require('./support');
test('assisted sales keeps unrelated and shared-phone histories unlinked', async ({page}) => {
  const errors=collectBrowserErrors(page);
  await page.goto('/index.html?qa=1');
  const result=await page.evaluate(() => {
    fields.clientName.value='Alex Teste';
    const rows=[
      {id:'synthetic-a',kind:'proposal',name:'Alex Teste',company:'Empresa Teste',email:'alex@example.test',phone:'+55 (11) 90000-0001',total:1200,status:'negociacao'},
      {id:'synthetic-b',kind:'proposal',name:'Alex Teste',company:'Empresa Teste',email:'outro@example.test',phone:'+55 (11) 90000-0001',total:2200,status:'negociacao'},
    ];
    getPipelineItems=()=>rows;
    const unknown={email:'novo@example.test',phone:rows[0].phone,clientName:'Alex Teste',company:'Empresa Teste'};
    const unrelated=getServiceClientMatch(unknown);
    const ambiguous=getServiceClientMatch({phone:rows[0].phone});
    const matched=getServiceClientMatch({email:' ALEX@EXAMPLE.TEST '});
    getActiveServiceContext=()=>({...unknown,eventType:'Coquetel',eventDate:'2028-10-24',eventTime:'17:00',guests:30});
    renderServiceCockpit();
    return {unrelated,ambiguous,matchedIds:matched.items.map(item=>item.id),total:matched.totalValue};
  });
  expect(result).toEqual({unrelated:null,ambiguous:null,matchedIds:['synthetic-a'],total:1200});
  await expect(page.locator('.service-client-context')).toContainText('Histórico não vinculado');
  await expect(page.locator('.service-client-context')).not.toContainText('Total registrado');
  await expectNoBrowserErrors(errors);
});

test('registry does not invent a country code or merge shared-phone opportunities into safe history',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/index.html?qa=1');
 const result=await page.evaluate(()=>{
  const rows=[{id:'a',kind:'proposal',opportunityId:'a',name:'Fixture A',email:'',phone:'11900000001',total:100,status:'negociacao'},
   {id:'b',kind:'proposal',opportunityId:'b',name:'Fixture B',email:'',phone:'5511900000001',total:200,status:'negociacao'}];
  getPipelineItems=()=>rows;const distinct=getClientRegistry(rows).length;
  rows.push({...rows[0],id:'c',opportunityId:'c',name:'Fixture C'});
  return {distinct,shared:getServiceClientMatch({phone:'11900000001'}),full:getServiceClientMatch({phone:'5511900000001'})?.items.map(x=>x.id)};
 });
 expect(result).toEqual({distinct:2,shared:null,full:['b']});
});
