const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../event-operations.js'),'utf8');
const start=source.indexOf('// Scoped receipt operator:'),end=source.indexOf('// End scoped receipt operator.');
const operator=source.slice(start,end);
const css=fs.readFileSync(path.resolve(__dirname,'../styles.css'),'utf8');
const ids=[1,2].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const proposal=[3,4].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
async function harness(page,mode='success'){
 const backend={calls:[],reads:[],reconciles:0,rows:ids.map((id,i)=>({id,proposal_id:proposal[i],reviewed_revision:2,provider_id:'synthetic-'+i,channel:'email',attempts:1,status:'accepted',delivery_status:null,delivery_checked_at:null}))};
 const diagnostic={deliveryRead:{clientId:true,clientSecret:true,refreshToken:true},mailboxRead:{clientId:false,clientSecret:false,refreshToken:false},agentPinned:true,automaticSyncOff:true};
 await page.route('**/*',route=>route.fulfill({status:204,body:''}));
 await page.exposeFunction('__fixtureInvoke',async body=>{
  backend.calls.push(body);expect(JSON.stringify(body)).not.toMatch(/destination|@|access_token|client_secret/i);
  if(body.action==='prepare-email-scoped'){
   expect(body.sendIds).toEqual(ids);
   if(mode==='setup_http409')return{safeBody:{ok:false,code:'setup_pending',diagnostic:{...diagnostic,agentPinned:false,deliveryRead:{clientId:false,clientSecret:false,refreshToken:false}}}};
   const data={ok:true,diagnostic,agent:'synthetic-agent',references:backend.rows.map(r=>({sendId:r.id,proposalId:r.proposal_id,revision:r.reviewed_revision,providerId:r.provider_id,attempt:r.attempts}))};
   if(backend.rows.some(r=>r.delivery_checked_at))return{data:{ok:false,code:'scope_conflict',diagnostic}};
   if(mode==='conflicting_prepare')return{data,error:{message:'private-fixture-never-show'}};
   return{data};
  }
  expect(body.action).toBe('reconcile-email-scoped');expect(body.references.map(r=>r.sendId)).toEqual(ids);expect(Date.parse(body.expiresAt)-Date.parse(body.startedAt)).toBe(120000);
  backend.reconciles++;backend.rows.forEach(r=>{r.delivery_checked_at=new Date().toISOString();if(mode!=='uncertain_unsaved')r.delivery_status='delivered';});
  if(mode.startsWith('uncertain'))return{throwPrivate:true};
  return{data:{ok:true,results:ids.map(sendId=>({sendId,state:'confirmed'}))}};
 });
 await page.exposeFunction('__fixtureRead',async wanted=>{backend.reads.push(wanted);expect(wanted).toEqual(ids);if(mode==='uncertain_unsaved')return{error:{message:'private-fixture-never-show'}};return{data:backend.rows};});
 async function attach(){
  await page.setContent('<!doctype html><html lang="pt-BR"><body><button id="open">Abrir operador</button></body></html>');
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:`window.QA_MODE=false;window.__master=true;window.__expired=false;window.__unsubscribed=false;window.state={session:{user:{id:'owner'}},supabase:{auth:{onAuthStateChange:fn=>{window.__auth=fn;return{data:{subscription:{unsubscribe:()=>window.__unsubscribed=true}}}}},functions:{invoke:async(_name,{body})=>{const r=await window.__fixtureInvoke(body);if(r.throwPrivate)throw Error('private-fixture-never-show');if(r.safeBody)return{data:null,error:{message:'private-fixture-never-show',context:{json:async()=>r.safeBody}}};return r;}},from:table=>{if(table!=='event_outbox')throw Error('unexpected-table');return{select:columns=>{if(/body|destination/.test(columns))throw Error('forbidden-column');return{in:async(_key,wanted)=>window.__fixtureRead(wanted)}}}}}};window.isSuperAdminSession=()=>window.__master;window.ensureTeamSessionForWrite=async()=>({ok:!window.__expired});`});
  await page.addScriptTag({content:operator});
  await page.evaluate(()=>document.querySelector('#open').onclick=()=>showOpsScopedEmailReceipts());
  await page.getByRole('button',{name:'Abrir operador'}).click();
  await page.locator('[name=sendA]').fill(ids[0]);await page.locator('[name=sendB]').fill(ids[1]);
 }
 await attach();return{backend,attach};
}
for(const width of [390,1440])test(`scoped operator native DOM preserves pins, single attempt and focus at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const {backend}=await harness(page);
 await expect(page.getByRole('dialog',{name:'Conciliar dois recibos de e-mail'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();
 await page.getByRole('button',{name:'Conferir referências'}).click();await expect(page.locator('[data-receipt-preview]')).toContainText('revisão 2');
 await expect(page.locator('[data-receipt-diagnostic]')).toContainText('Presença não comprova autorização');
 await page.locator('[name=confirmed]').check();await page.evaluate(()=>{const f=document.querySelector('#opsScopedReceiptDialog form');f.requestSubmit();f.requestSubmit();});
 await expect(page.getByRole('status')).toContainText('Entrega registrada');expect(backend.reconciles).toBe(1);expect(backend.calls.map(x=>x.action)).toEqual(['prepare-email-scoped','reconcile-email-scoped']);
 await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();expect(await page.locator('body').innerText()).not.toMatch(/synthetic-agent|synthetic-0|private-fixture|@/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('dialog')).toHaveCount(0);await expect(page.locator('#open')).toBeFocused();expect(await page.evaluate(()=>window.__unsubscribed)).toBe(true);
});
test('editing a send reference invalidates the prepared revision',async({page})=>{const {backend}=await harness(page);await page.getByRole('button',{name:'Conferir referências'}).click();await page.locator('[name=confirmed]').check();await page.locator('[name=sendB]').fill(ids[0]);await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();await expect(page.locator('[data-receipt-preview]')).toBeEmpty();expect(backend.reconciles).toBe(0);});
test('same-user token refresh preserves review; different user clears it',async({page})=>{const {backend}=await harness(page);await page.getByRole('button',{name:'Conferir referências'}).click();await page.locator('[name=confirmed]').check();await page.evaluate(()=>window.__auth('TOKEN_REFRESHED',{user:{id:'owner'}}));await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeEnabled();await page.evaluate(()=>window.__auth('SIGNED_IN',{user:{id:'other'}}));await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();await expect(page.locator('[data-receipt-preview]')).toBeEmpty();await expect(page.getByRole('status')).toContainText('Sessão alterada');expect(backend.reconciles).toBe(0);});
test('HTTP409 metadata remains visible without exposing errors or allowing execution',async({page})=>{const {backend}=await harness(page,'setup_http409');await page.getByRole('button',{name:'Conferir referências'}).click();await expect(page.getByRole('alert')).toContainText('Configuração de leitura pendente');await expect(page.locator('[data-receipt-diagnostic]')).toContainText('pendentes');await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();expect(backend.reconciles).toBe(0);expect(await page.locator('body').innerText()).not.toContain('private-fixture');});
test('a transport error cannot keep a contradictory successful preparation',async({page})=>{const {backend}=await harness(page,'conflicting_prepare');await page.getByRole('button',{name:'Conferir referências'}).click();await expect(page.getByRole('alert')).toContainText('Resultado não confirmado');await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();expect(backend.reconciles).toBe(0);});
for(const mode of ['uncertain_saved','uncertain_unsaved'])test(`uncertainty reads only the stored records once, never retries: ${mode}`,async({page})=>{const {backend}=await harness(page,mode);await page.getByRole('button',{name:'Conferir referências'}).click();await page.locator('[name=confirmed]').check();await page.getByRole('button',{name:'Conciliar uma vez'}).click();await expect.poll(()=>backend.reads.length).toBe(1);await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();expect(backend.reconciles).toBe(1);expect(await page.locator('body').innerText()).not.toContain('private-fixture');await expect(page.getByRole('status')).toContainText(mode==='uncertain_saved'?'Entrega registrada':'Registro salvo não confirmado');});
test('reload keeps a server reservation and offers only stored-record reconciliation',async({page})=>{const {backend,attach}=await harness(page);await page.getByRole('button',{name:'Conferir referências'}).click();await page.locator('[name=confirmed]').check();await page.getByRole('button',{name:'Conciliar uma vez'}).click();await expect(page.getByRole('status')).toContainText('Entrega registrada');await page.reload();await attach();await page.getByRole('button',{name:'Conferir referências'}).click();await expect(page.getByRole('alert')).toContainText('não confirmados');await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();await page.getByRole('button',{name:'Consultar registro salvo'}).click();await expect(page.getByRole('status')).toContainText('Entrega registrada');expect(backend.reconciles).toBe(1);});
test('expired session cannot call the administrative action',async({page})=>{const {backend}=await harness(page);await page.evaluate(()=>window.__expired=true);await page.getByRole('button',{name:'Conferir referências'}).click();await expect(page.getByRole('alert')).toContainText('Sessão indisponível');expect(backend.calls.length).toBe(0);});
for(const [event,session] of [['SIGNED_OUT',null],['SIGNED_IN',{user:{id:'other'}}]])test(`session cleanup clears identifiers, diagnostics and alerts: ${event}`,async({page})=>{const {backend}=await harness(page);await page.getByRole('button',{name:'Conferir referências'}).click();await expect(page.locator('[data-receipt-preview]')).toContainText('revisão 2');await page.evaluate(({event,session})=>{const a=document.querySelector('[role=alert]');a.hidden=false;a.textContent='old-session-error';window.__auth(event,session);},{event,session});await expect(page.locator('[name=sendA]')).toHaveValue('');await expect(page.locator('[name=sendB]')).toHaveValue('');await expect(page.locator('[data-receipt-preview]')).toBeEmpty();await expect(page.locator('[data-receipt-diagnostic]')).toBeEmpty();await expect(page.getByRole('alert',{includeHidden:true})).toBeHidden();expect(await page.locator('body').innerText()).not.toContain('old-session-error');await expect(page.getByRole('button',{name:'Conciliar uma vez'})).toBeDisabled();expect(backend.reconciles).toBe(0);});
