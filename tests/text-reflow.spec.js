const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const { test, expect } = require('@playwright/test');
const original = fs.readFileSync(path.join(root, 'dist/app.js'), 'utf8');
const start = original.indexOf('function loadQaFixtures() {');
const end = original.indexOf('\n}', start) + 2;
if (start < 0 || end < start) throw Error('QA_FIXTURE_BOUNDARY');
// Replace demo data in memory before execution; product files stay unchanged.
const fixtures = `function loadQaFixtures() {
  const make = (id, extra={}) => createQaProposal({ id, reference:id,
    clientName:'Pessoa Sintetica '+id, email:id+'@example.test', phone:'', company:'Empresa Sintetica',
    clientType:'Cliente direto', finalClient:'Empresa Sintetica', groupName:'Grupo Sintetico',
    type:'Coquetel', date:'2099-11-04', time:'19:00', guests:25, duration:3,
    selectedIds:['coquetel-carioca'], total:1200, status:'negociacao', ...extra });
  state.proposals = [make('p2-a1',{clientName:'Pessoa Sintetica A',email:'one@example.test',clientResponse:{acao:'alteracao',mensagem:'Ajuste sintetico'}}),
    make('p2-a2',{clientName:'Pessoa Sintetica A',email:'one@example.test',date:'2099-11-05'}),
    make('p2-booked',{status:'confirmado',date:createQaDate(1),signalPayment:{valor:600,data:createQaDate(-1),validacaoPendente:false,validadoPor:'qa-user',validadoEmail:QA_USER_EMAIL,validadoEm:new Date().toISOString()}})];
  state.quoteRequests = [];
  state.opportunities = state.proposals.map(p=>({id:p.oportunidade_id,status:p.status,responsavel_email:QA_USER_EMAIL,proxima_acao:'Revisar caso sintetico'}));
  state.proposalViews = [];
}`;
const qaSource = original.slice(0, start) + fixtures + original.slice(end);
async function isolate(page, width=390) {
  const remote = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width, height: 900 });
  await page.context().route('**/*', route => {
    const u = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(u.hostname)) {
      if (u.pathname.endsWith('/app.js')) return route.fulfill({ contentType:'text/javascript', body:qaSource });
      return route.continue();
    }
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType:'text/css', body:'' });
    remote.push({method:route.request().method(),path:u.pathname}); return route.abort();
  });
  return {remote, errors};
}
async function enlarge(page) {
  await page.evaluate(() => { document.documentElement.style.fontSize='200%'; });
}
async function reflow(page) {
  const result = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,
    wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();let p=e.parentElement;while(p&&p!==document.body){if(['auto','scroll'].includes(getComputedStyle(p).overflowX))return false;p=p.parentElement;}return r.width&&r.height&&(r.right>innerWidth+1||r.left<0)&&!e.closest('.client-comparison-scroll');}).slice(0,20).map(e=>({tag:e.tagName,id:e.id,className:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,display:getComputedStyle(e).display,whiteSpace:getComputedStyle(e).whiteSpace,minWidth:getComputedStyle(e).minWidth}))}));
  expect(result.scroll,JSON.stringify(result)).toBeLessThanOrEqual(result.width+1);
}
async function names(page) {
  const controls = page.locator('input:not([type=hidden]), select, textarea, button');
  for (const element of await controls.all()) if (await element.isVisible()) await expect(element).toHaveAccessibleName(/\S/, {timeout:1000});
}
function clean({remote,errors}) { expect(remote).toEqual([]); expect(errors).toEqual([]); }

test('clients: 320px, enlarged text, keyboard and named controls',async({page})=>{
  const context=await isolate(page,320); await page.goto('/clientes.html?qa=1'); await enlarge(page);
  await expect(page.locator('.client-registry-card')).toHaveCount(2);
  const comparison=page.locator('.client-quote-comparison');
  await comparison.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(comparison).toHaveAttribute('open','');
  await comparison.getByRole('region').focus(); await expect(comparison.getByRole('region')).toBeFocused();
  await reflow(page); await names(page); clean(context);
});
test('calendar: 320px, enlarged text and view navigation without record mutation',async({page})=>{
  const context=await isolate(page,320); await page.goto('/index.html?qa=1');
  await page.evaluate(()=>{commercialCalendarMonth='2099-11';renderCommercialCalendar();}); await enlarge(page);
  const before=await page.evaluate(()=>JSON.stringify(state.proposals));
  await page.locator('[data-commercial-calendar-month]').fill('2099-10');
  await page.locator('[data-commercial-calendar-month]').dispatchEvent('change');
  await expect(page.locator('[data-commercial-calendar-month]')).toBeFocused();
  expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);
  await reflow(page); clean(context);
});
test('operation: 390px enlarged text, task semantics and named controls',async({page})=>{
  const context=await isolate(page,390); await page.goto('/index.html?qa=1');
  await page.evaluate(()=>{const p=state.proposals.find(p=>p.id==='p2-booked');getOperationalHandoffData(p);renderPipeline();});
  await page.getByRole('button',{name:'Operação',exact:true}).click();
  await page.locator('[data-operation-select="p2-booked"]').click(); await enlarge(page);
  await expect(page.locator('.operation-detail [data-handoff-task-id]')).toHaveCount(8);
  await reflow(page); await names(page); clean(context);
});
test('public form: 320px enlarged text and named visible controls',async({page})=>{
  const context=await isolate(page,320);
  await page.context().route('**/vendor/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>({rpc:async()=>({data:[],error:null}),auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};'}));
  await page.goto('/formulario.html'); await enlarge(page);
  await reflow(page); await names(page); clean(context);
});
