const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {test}=require('@playwright/test');
const candidate=path.resolve(__dirname,'..');
const cases=[];const check=(name,fn)=>cases.push({name,fn});
async function fixture(browser,scenario={}){
 const context=await browser.newContext();
 await context.addInitScript(s=>{
  const user='synthetic-owner',pilot='11111111-1111-4111-8111-111111111111';
  const evidence={pilotId:pilot,sendStatus:'accepted',attempts:1,deliveredAt:null,readAt:null,replyAt:null,deliveryConfirmed:false,replyConfirmed:false,replyImpliesReceipt:false,context:{body:'PRIVATE_SENTINEL',destination:'PRIVATE_SENTINEL',content_hash:'PRIVATE_SENTINEL'}};
  const m=window.__mock={calls:[],userCalls:0,ownedCalls:0,listener:null,scenario:s};
  if(s.storageFail)Storage.prototype.setItem=function(){throw Error('PRIVATE_SENTINEL');};
  m.client={auth:{getUser:async()=>{m.userCalls++;return s.unauthenticated||s.expire&&m.userCalls>1?{error:{message:'PRIVATE_SENTINEL'}}:{data:{user:{id:user}}};},onAuthStateChange:fn=>{m.listener=fn;}},
   rpc:async(name,args)=>{m.calls.push({kind:'rpc',name,args});if(name==='is_super_admin')return {data:s.notMaster?false:true};if(name!=='get_event_whatsapp_pilot_receipt')throw Error('UNEXPECTED_RPC');m.ownedCalls++;if(s.notOwner||s.failReadback&&m.ownedCalls>2)return{error:{message:'PRIVATE_SENTINEL'}};return{data:{...evidence,...(s.badOwned?{pilotId:'wrong'}:{})}};},
   functions:{invoke:async(name,args)=>{m.calls.push({kind:'invoke',name,args});await new Promise(r=>setTimeout(r,80));if(s.signOutDuringInvoke){m.listener('SIGNED_OUT',null);return{data:{ok:true,willSend:false,inserted:1,receipt:evidence}};}if(s.uncertain)return {error:{message:'PRIVATE_SENTINEL'},data:{writeMayHaveOccurred:true}};return{data:{ok:true,willSend:s.badSuccess?true:false,inserted:s.duplicate?0:1,receipt:{...evidence,replyAt:'2026-10-27T18:17:39.000Z',replyConfirmed:true,replyImpliesReceipt:true}}};}}
  };
  window.supabase={createClient:()=>m.client};window.APPROVAL_CONFIG={url:'https://synthetic.invalid',key:'publishable-fixture'};
 },scenario);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());assert.equal(url.hostname,'receipt.test','EXTERNAL_NETWORK_BLOCKED');
  const file=url.pathname.slice(1)||'recibo-whatsapp.html';
  if(['recibo-whatsapp.html','recibo-whatsapp.js'].includes(file))return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(candidate,file),'utf8')});
  if(['vendor/supabase.js','approval-config.js','approval.css'].includes(file))return route.fulfill({body:'',contentType:file.endsWith('.css')?'text/css':'text/javascript'});
  throw Error('UNEXPECTED_REQUEST');
 });
 const page=await context.newPage();await page.goto('https://receipt.test/recibo-whatsapp.html');
 await page.waitForFunction(()=>!document.getElementById('receiptStatus').textContent.includes('Verificando'));
 if(!scenario.unauthenticated&&!scenario.notMaster){await page.locator('#receiptPilotId').fill('11111111-1111-4111-8111-111111111111');await page.locator('#readReceipt').click();await page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);}
 const invocations=()=>page.evaluate(()=>__mock.calls.filter(x=>x.kind==='invoke'));
 return{page,context,invocations};
}
async function reconcile(page){await page.locator('#receiptConfirm').check();await page.locator('#reconcileReceipt').click();await page.waitForFunction(()=>document.getElementById('receiptOutcome').textContent.length>0);}
for(const [name,scenario]of [['anonymous',{unauthenticated:true}],['not master',{notMaster:true}],['not owner',{notOwner:true}],['wrong pilot',{badOwned:true}]])check(name,async browser=>{
 const f=await fixture(browser,scenario);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('initial and explicit saved read never invoke Edge or expose context',async browser=>{
 const f=await fixture(browser);await f.page.locator('#readReceipt').click();await f.page.waitForFunction(()=>document.getElementById('receiptOutcome').textContent.length>0);assert.equal((await f.invocations()).length,0);assert.ok(!(await f.page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));await f.context.close();
});
check('confirmation mandatory and double click invokes exactly once',async browser=>{
 const f=await fixture(browser);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);await f.page.locator('#receiptConfirm').check();await f.page.locator('#reconcileReceipt').evaluate(b=>{b.click();b.click();});await f.page.waitForFunction(()=>document.getElementById('receiptOutcome').textContent.length>0);
 const calls=await f.invocations();assert.deepEqual(calls,[{kind:'invoke',name:'event-whatsapp-pilot',args:{body:{action:'reconcileReceipt',pilotId:'11111111-1111-4111-8111-111111111111'}}}]);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.match(await f.page.locator('#receiptEvidence').innerText(),/Resposta correlacionada\s+Registrada/);assert.ok(!(await f.page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));await f.context.close();
});
check('reload retains attempted marker and never repeats',async browser=>{
 const f=await fixture(browser);await reconcile(f.page);await f.page.reload();await f.page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('Acesso Master'));await f.page.locator('#receiptPilotId').fill('11111111-1111-4111-8111-111111111111');await f.page.locator('#readReceipt').click();await f.page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('J� houve'));assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('uncertain request performs only saved read and permits manual saved read',async browser=>{
 const f=await fixture(browser,{uncertain:true});await reconcile(f.page);await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);assert.equal((await f.invocations()).length,1);assert.match(await f.page.locator('#receiptOutcome').innerText(),/n�o confirmado/);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);await f.page.locator('#readReceipt').click();await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);assert.equal((await f.invocations()).length,1);await f.context.close();
});
check('uncertain plus failed readback remains uncertain without raw error',async browser=>{
 const f=await fixture(browser,{uncertain:true,failReadback:true});await reconcile(f.page);await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);assert.equal((await f.invocations()).length,1);assert.match(await f.page.locator('#receiptOutcome').innerText(),/n�o confirmado/);assert.ok(!(await f.page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));await f.context.close();
});
check('expired identity is rechecked before invoke',async browser=>{
 const f=await fixture(browser);await f.page.evaluate(()=>__mock.scenario.expire=true);await reconcile(f.page);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('session change during request clears stale evidence and never retries',async browser=>{
 const f=await fixture(browser,{signOutDuringInvoke:true});await f.page.locator('#receiptConfirm').check();await f.page.locator('#reconcileReceipt').click();await f.page.waitForFunction(()=>document.getElementById('receiptWorkspace').hidden);assert.equal((await f.invocations()).length,1);assert.equal(await f.page.locator('#receiptEvidence').innerText(),'');assert.equal(await f.page.locator('#receiptOutcome').innerText(),'');await f.context.close();
});
check('storage failure stops before invoke',async browser=>{
 const f=await fixture(browser,{storageFail:true});await reconcile(f.page);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('malformed success becomes uncertainty not resend',async browser=>{
 const f=await fixture(browser,{badSuccess:true});await reconcile(f.page);assert.match(await f.page.locator('#receiptOutcome').innerText(),/n�o confirmado/);assert.equal((await f.invocations()).length,1);await f.context.close();
});
check('idempotent zero insert response succeeds',async browser=>{
 const f=await fixture(browser,{duplicate:true});await reconcile(f.page);assert.match(await f.page.locator('#receiptOutcome').innerText(),/Concilia��o confirmada/);assert.equal((await f.invocations()).length,1);await f.context.close();
});
check('editing pilot invalidates owner proof, confirmation and old evidence',async browser=>{
 const f=await fixture(browser);await f.page.locator('#receiptConfirm').check();await f.page.locator('#receiptPilotId').fill('22222222-2222-4222-8222-222222222222');assert.equal(await f.page.locator('#receiptConfirm').isChecked(),false);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal(await f.page.locator('#receiptEvidence').innerText(),'');assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('ownership loss is checked again before invocation',async browser=>{
 const f=await fixture(browser);await f.page.evaluate(()=>__mock.scenario.notOwner=true);await reconcile(f.page);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('mobile keyboard confirmation and no horizontal page overflow',async browser=>{
 const f=await fixture(browser);await f.page.setViewportSize({width:390,height:844});await f.page.locator('#receiptConfirm').focus();await f.page.keyboard.press('Space');assert.equal(await f.page.locator('#receiptConfirm').isChecked(),true);assert.equal(await f.page.locator('#reconcileReceipt').isEnabled(),true);assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await f.context.close();
});
for(const item of cases)test(item.name,async({browser})=>item.fn(browser));
