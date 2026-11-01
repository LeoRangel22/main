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
function clean({remote,errors}) { expect(remote).toEqual([]); expect(errors).toEqual([]); }


test('new proposal: confirmed keyboard entry clears only the draft and focuses client name',async({page})=>{
 const c=await isolate(page,390);await page.goto('/index.html?qa=1');
 await page.locator('#clientName').fill('Rascunho sintetico');
 const before=await page.evaluate(()=>JSON.stringify(state.proposals));let confirmations=0;
 page.on('dialog',async d=>{confirmations++;await d.accept();});
 await page.locator('#topbarNewProposalBtn').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#clientName')).toHaveValue('');expect(confirmations).toBe(1);
 await expect(page.locator('#clientName')).toBeFocused();
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});
test('new proposal: cancelling preserves draft and focus on the initiating control',async({page})=>{
 const c=await isolate(page,390);await page.goto('/index.html?qa=1');
 await page.locator('#clientName').fill('Rascunho sintetico');
 const before=await page.evaluate(()=>JSON.stringify(state.proposals));let confirmations=0;
 page.on('dialog',async d=>{confirmations++;await d.dismiss();});
 const start=page.locator('#topbarNewProposalBtn');await start.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#clientName')).toHaveValue('Rascunho sintetico');expect(confirmations).toBe(1);await expect(start).toBeFocused();
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});
test('new proposal: in-flight save retains draft and does not move focus',async({page})=>{
 const c=await isolate(page,390);await page.goto('/index.html?qa=1');
 await page.locator('#clientName').fill('Rascunho sintetico');
 const before=await page.evaluate(()=>JSON.stringify(state.proposals));let confirmations=0;
 page.on('dialog',async d=>{confirmations++;await d.dismiss();});
 await page.evaluate(()=>{state.proposalSaveInProgress=true;});
 const start=page.locator('#topbarNewProposalBtn');await start.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#clientName')).toHaveValue('Rascunho sintetico');expect(confirmations).toBe(0);await expect(start).toBeFocused();
 expect(await page.evaluate(()=>JSON.stringify(state.proposals))).toBe(before);clean(c);
});
