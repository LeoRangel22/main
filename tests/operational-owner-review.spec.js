const {test,expect}=require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors}=require('./support');

for(const responsible of ['Ana <Responsável> & Equipe',null,'   ']) {
 test(`operational screen, checklist, technical sheets and copied summary agree on owner ${JSON.stringify(responsible)}`,async({page})=>{
  const errors=collectBrowserErrors(page);
  await page.route('https://**',route=>route.abort());
  await page.goto('/index.html?qa=1');
  const result=await page.evaluate(responsible=>{
   const p=state.proposals.find(p=>p.status==='confirmado');
   openSavedProposal(p.id);
   const data=getOperationalHandoffData(p);
   for(const task of data.tasks) {
    task.responsible_name=responsible;
    task.owner_label='GENERIC TEAM LABEL MUST NOT REPLACE A PERSON';
   }
   const before=JSON.stringify(data.tasks);
   renderOperationalChecklist(p);
   const htmls=[buildOperationalChecklistHtml(p),buildTechnicalSheetHtml(p),buildTechnicalSheetHtml(p,{showFinance:false})];
   const docs=htmls.map(html=>{
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {text:doc.body.textContent,unsafe:doc.querySelectorAll('responsável').length};
   });
   return {screen:nodes.operationalChecklist.textContent,docs,summary:buildOperationalSummaryText(p),
    total:data.tasks.length,unchanged:before===JSON.stringify(data.tasks)};
  },responsible);
  const expected=responsible?.trim()||'Pessoa responsável a definir';
  expect(result.total).toBe(8);
  expect(result.screen).toContain(expected);
  expect(result.summary).toContain(expected);
  expect(result.summary).toContain('Eventos');
  expect(result.summary).not.toContain('GENERIC TEAM LABEL');
  for(const doc of result.docs) {
   expect(doc.text).toContain(expected);
   expect(doc.text).not.toContain('GENERIC TEAM LABEL');
   expect(doc.unsafe).toBe(0);
  }
  expect(result.unchanged).toBe(true);
  await expectNoBrowserErrors(errors);
 });
}
