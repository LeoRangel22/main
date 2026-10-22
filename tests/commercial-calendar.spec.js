const {test,expect}=require('@playwright/test');
const {expectNoHorizontalOverflow}=require('./support');
async function prepare(page){
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const original=structuredClone(state.proposals.find(p=>p.id==='qa-proposal-sem-resposta'));
  const make=(id,date,time,status='negociacao')=>({...structuredClone(original),id,oportunidade_id:id,cliente_nome:`Cliente ${id}`,data_evento:date,horario_evento:time,duracao:3,convidados:30,total:12000,status,is_current:true,publication_status:'sent',versao:2,sent_at:null});
  const sold=make('fechado','2099-11-04','19:00','confirmado');
  const amendment={...structuredClone(sold),id:'rascunho-aditivo',versao:3,publication_status:'draft',snapshot:{...structuredClone(sold.snapshot),amendmentOf:{proposalId:sold.id}}};
  state.proposals=[sold,amendment,make('concorrente','2099-11-04','20:00'),make('madrugada','2099-10-31','23:00'),make('amanhecer','2099-11-01','00:30'),make('sem-hora','2099-11-05',''),make('cancelado','2099-11-04','19:00','cancelado')];
  state.quoteRequests=[];commercialCalendarMonth='2099-11';renderCommercialCalendar();
 });
}
test('commercial calendar separates negotiation and booked agreement without duplicate amendments',async({page})=>{
 await prepare(page);const calendar=page.locator('#commercialCalendar');await expect(calendar).toBeVisible();
 await expect(calendar.locator('[data-calendar-id="fechado"]')).toContainText('Fechado comercialmente');
 await expect(calendar.locator('[data-calendar-id="concorrente"]')).toContainText('sem reserva');
 await expect(calendar.locator('[data-calendar-id="fechado"]')).toContainText('30 pax');await expect(calendar.locator('[data-calendar-id="fechado"]')).toContainText('12.000,00');
 await expect(calendar.locator('[data-calendar-id="fechado"]')).toContainText('V2');await expect(calendar.locator('[data-calendar-id="rascunho-aditivo"]')).toHaveCount(0);await expect(calendar.locator('[data-calendar-id="cancelado"]')).toHaveCount(0);
 await expect(calendar.locator('[data-calendar-id="fechado"]')).toContainText('Cliente concorrente');await expect(calendar.locator('[data-calendar-id="amanhecer"]')).toContainText('Cliente madrugada');
 await expect(calendar.locator('[data-calendar-id="sem-hora"]')).toContainText('Sem hor');await expect(calendar).toContainText('a confirmar no planejamento');
});
test('month navigation changes only the view and keeps keyboard focus',async({page})=>{
 await prepare(page);const before=await page.evaluate(()=>JSON.stringify(state.proposals));
 await page.locator('[data-commercial-calendar-month]').fill('2099-10');await page.locator('[data-commercial-calendar-month]').dispatchEvent('change');
 await expect(page.locator('[data-calendar-id="madrugada"]')).toBeVisible();await expect(page.locator('[data-calendar-id="fechado"]')).toHaveCount(0);await expect(page.locator('[data-commercial-calendar-month]')).toBeFocused();expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);
});
test('calendar hides its data after logout and fits a mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:900});await prepare(page);await expectNoHorizontalOverflow(page);
 await page.evaluate(()=>{state.session=null;renderCommercialCalendar();});await expect(page.locator('#commercialCalendar')).toBeHidden();await expect(page.locator('#commercialCalendar')).toHaveText('');
});
