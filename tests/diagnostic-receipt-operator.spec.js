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
  if(s.fastTimeouts){const original=setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===8000||ms===30000?30:ms,...args);}
  if(s.signOutBeforeInvoke){const write=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){write.apply(this,args);queueMicrotask(()=>m.listener('SIGNED_OUT',null));};}
  if(s.storageFail)Storage.prototype.setItem=function(){throw Error('PRIVATE_SENTINEL');};
  m.client={auth:{getUser:async()=>{m.userCalls++;if(s.hangIdentity)return new Promise(()=>{});return s.unauthenticated||s.expire&&m.userCalls>1?{error:{message:'PRIVATE_SENTINEL'}}:{data:{user:{id:user}}};},onAuthStateChange:fn=>{m.listener=fn;}},
   rpc:async(name,args)=>{m.calls.push({kind:'rpc',name,args});if(name==='is_super_admin'){if(s.hangRole)return new Promise(()=>{});return {data:s.notMaster?false:true};}if(name!=='get_event_whatsapp_pilot_receipt')throw Error('UNEXPECTED_RPC');m.ownedCalls++;if(s.hangOwned)return new Promise(()=>{});if(s.notOwner||s.failReadback&&m.ownedCalls>2)return{error:{message:'PRIVATE_SENTINEL'}};return{data:{...evidence,...(s.badOwned?{pilotId:'wrong'}:{})}};},
   functions:{invoke:async(name,args)=>{m.calls.push({kind:'invoke',name,args});if(s.hangInvoke)return new Promise(()=>{});await new Promise(r=>setTimeout(r,80));if(s.signOutDuringInvoke){m.listener('SIGNED_OUT',null);return{data:{ok:true,willSend:false,inserted:1,receipt:evidence}};}if(s.uncertain)return {error:{message:'PRIVATE_SENTINEL'},data:{writeMayHaveOccurred:true}};return{data:{ok:true,willSend:s.badSuccess?true:false,inserted:s.duplicate?0:1,receipt:{...evidence,replyAt:'2026-10-27T18:17:39.000Z',replyConfirmed:true,replyImpliesReceipt:true}}};}}
  };
  window.supabase={createClient:()=>{if(s.sdkThrow)throw Error('PRIVATE_SENTINEL');return m.client;}};window.APPROVAL_CONFIG={url:'https://synthetic.invalid',key:'publishable-fixture'};
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
 if(!scenario.unauthenticated&&!scenario.notMaster&&!scenario.sdkThrow&&!scenario.hangIdentity&&!scenario.hangRole){await page.locator('#receiptPilotId').fill('11111111-1111-4111-8111-111111111111');await page.locator('#readReceipt').click();await page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);}
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
 const f=await fixture(browser);await reconcile(f.page);await f.page.reload();await f.page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('Acesso Master'));await f.page.locator('#receiptPilotId').fill('11111111-1111-4111-8111-111111111111');await f.page.locator('#readReceipt').click();await f.page.waitForFunction(()=>document.getElementById('receiptStatus').textContent.includes('Já houve'));assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('uncertain request performs only saved read and permits manual saved read',async browser=>{
 const f=await fixture(browser,{uncertain:true});await reconcile(f.page);await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);assert.equal((await f.invocations()).length,1);assert.match(await f.page.locator('#receiptOutcome').innerText(),/não confirmado/);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);await f.page.locator('#readReceipt').click();await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);assert.equal((await f.invocations()).length,1);await f.context.close();
});
check('uncertain plus failed readback remains uncertain without raw error',async browser=>{
 const f=await fixture(browser,{uncertain:true,failReadback:true});await reconcile(f.page);await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);assert.equal((await f.invocations()).length,1);assert.match(await f.page.locator('#receiptOutcome').innerText(),/não confirmado/);assert.ok(!(await f.page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));await f.context.close();
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
 const f=await fixture(browser,{badSuccess:true});await reconcile(f.page);assert.match(await f.page.locator('#receiptOutcome').innerText(),/não confirmado/);assert.equal((await f.invocations()).length,1);await f.context.close();
});
check('idempotent zero insert response succeeds',async browser=>{
 const f=await fixture(browser,{duplicate:true});await reconcile(f.page);assert.match(await f.page.locator('#receiptOutcome').innerText(),/Conciliação confirmada/);assert.equal((await f.invocations()).length,1);await f.context.close();
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
for(const [label,scenario]of [['identity',{hangIdentity:true,fastTimeouts:true}],['role',{hangRole:true,fastTimeouts:true}],['sdk',{sdkThrow:true}]])check('wait: '+label,async browser=>{
 const f=await fixture(browser,scenario);await f.page.waitForFunction(()=>!document.getElementById('receiptLogin').hidden,{},{timeout:2000});assert.equal(await f.page.locator('#receiptWorkspace').isVisible(),false);assert.ok(!(await f.page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('wait: saved read',async browser=>{
 const f=await fixture(browser,{fastTimeouts:true});await f.page.evaluate(()=>__mock.scenario.hangOwned=true);await f.page.locator('#readReceipt').click();await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled,{},{timeout:2000});assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('wait: reconcile uncertainty',async browser=>{
 const f=await fixture(browser,{fastTimeouts:true});await f.page.evaluate(()=>__mock.scenario.hangInvoke=true);await reconcile(f.page);await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled,{},{timeout:2000});assert.match(await f.page.locator('#receiptOutcome').innerText(),/não confirmado/);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal((await f.invocations()).length,1);await f.context.close();
});
check('wait: signout queued before invocation never invokes',async browser=>{
 const f=await fixture(browser,{signOutBeforeInvoke:true});await f.page.locator('#receiptConfirm').check();await f.page.locator('#reconcileReceipt').click();await f.page.waitForFunction(()=>document.getElementById('receiptWorkspace').hidden);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('wait: late success cannot overwrite timeout uncertainty',async browser=>{
 const f=await fixture(browser,{fastTimeouts:true});await reconcile(f.page);await f.page.waitForTimeout(120);assert.match(await f.page.locator('#receiptOutcome').innerText(),/não confirmado/);assert.doesNotMatch(await f.page.locator('#receiptOutcome').innerText(),/Conciliação confirmada/);assert.equal((await f.invocations()).length,1);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);await f.context.close();
});
check('public receipt assets preserve UTF-8 text',async()=>{
 const html=fs.readFileSync(path.join(candidate,'recibo-whatsapp.html'),'utf8'),js=fs.readFileSync(path.join(candidate,'recibo-whatsapp.js'),'utf8');assert.doesNotMatch(html,/\uFFFD/);assert.doesNotMatch(js,/\uFFFD/);assert.ok(html.includes('Recibo do teste já enviado'));assert.ok(js.includes('Já houve uma solicitação'));assert.ok(js.includes('Não foi possível iniciar'));
});
for(const event of ['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'])check('auth: same owner '+event+' preserves reference and proof',async browser=>{
 const f=await fixture(browser);await f.page.locator('#receiptConfirm').check();
 const before=await f.page.evaluate(()=>({calls:__mock.calls.length,userCalls:__mock.userCalls}));
 await f.page.evaluate(event=>__mock.listener(event,{user:{id:'synthetic-owner'}}),event);
 await f.page.waitForTimeout(50);
 assert.equal(await f.page.locator('#receiptPilotId').inputValue(),'11111111-1111-4111-8111-111111111111');
 assert.equal(await f.page.locator('#receiptConfirm').isChecked(),true);assert.equal(await f.page.locator('#reconcileReceipt').isEnabled(),true);
 assert.deepEqual(await f.page.evaluate(()=>({calls:__mock.calls.length,userCalls:__mock.userCalls})),before);
 assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('auth: repeated same-owner focus events still allow exactly one explicit reconciliation',async browser=>{
 const f=await fixture(browser);await f.page.evaluate(()=>{for(let i=0;i<5;i++){__mock.listener('SIGNED_IN',{user:{id:'synthetic-owner'}});__mock.listener('TOKEN_REFRESHED',{user:{id:'synthetic-owner'}});}});
 await reconcile(f.page);assert.equal((await f.invocations()).length,1);assert.match(await f.page.locator('#receiptOutcome').innerText(),/confirmada/);await f.context.close();
});
check('auth: same-owner focus never bypasses revoked Master permission',async browser=>{
 const f=await fixture(browser);await f.page.evaluate(()=>{__mock.scenario.notMaster=true;__mock.listener('SIGNED_IN',{user:{id:'synthetic-owner'}});});
 await reconcile(f.page);assert.equal((await f.invocations()).length,0);assert.match(await f.page.locator('#receiptOutcome').innerText(),/Nenhuma/);await f.context.close();
});
check('auth: same-owner refresh never bypasses revoked ownership',async browser=>{
 const f=await fixture(browser);await f.page.evaluate(()=>{__mock.scenario.notOwner=true;__mock.listener('TOKEN_REFRESHED',{user:{id:'synthetic-owner'}});});
 await reconcile(f.page);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('auth: same-owner refresh during invoke preserves result without retry',async browser=>{
 const f=await fixture(browser);await f.page.locator('#receiptConfirm').check();await f.page.locator('#reconcileReceipt').click();
 await f.page.waitForFunction(()=>__mock.calls.some(x=>x.kind==='invoke'));
 await f.page.evaluate(()=>__mock.listener('TOKEN_REFRESHED',{user:{id:'synthetic-owner'}}));
 await f.page.waitForFunction(()=>document.getElementById('receiptOutcome').textContent.includes('confirmada'));
 assert.equal((await f.invocations()).length,1);assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);await f.context.close();
});
for(const event of ['SIGNED_OUT','TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED','PASSWORD_RECOVERY'])check('auth: invalidating '+event+' clears proof synchronously',async browser=>{
 const f=await fixture(browser);await f.page.locator('#receiptConfirm').check();
 const state=await f.page.evaluate(event=>{__mock.listener(event,event==='SIGNED_OUT'?null:{user:{id:event==='USER_UPDATED'||event==='PASSWORD_RECOVERY'?'synthetic-owner':'different-user'}});return{reference:document.getElementById('receiptPilotId').value,checked:document.getElementById('receiptConfirm').checked,hidden:document.getElementById('receiptWorkspace').hidden,evidence:document.getElementById('receiptEvidence').textContent};},event);
 assert.deepEqual(state,{reference:'',checked:false,hidden:true,evidence:''});assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('auth: missing session refresh clears proof',async browser=>{
 const f=await fixture(browser);await f.page.evaluate(()=>__mock.listener('TOKEN_REFRESHED',null));assert.equal(await f.page.locator('#receiptWorkspace').isVisible(),false);assert.equal((await f.invocations()).length,0);await f.context.close();
});
check('auth: focus after uncertain attempt cannot reset attempt marker',async browser=>{
 const f=await fixture(browser,{uncertain:true});await reconcile(f.page);await f.page.waitForFunction(()=>!document.getElementById('readReceipt').disabled);
 await f.page.evaluate(()=>__mock.listener('SIGNED_IN',{user:{id:'synthetic-owner'}}));
 assert.equal(await f.page.locator('#reconcileReceipt').isDisabled(),true);assert.equal((await f.invocations()).length,1);assert.match(await f.page.locator('#receiptOutcome').innerText(),/confirmado/);await f.context.close();
});

for(const item of cases)test(item.name,async({browser})=>item.fn(browser));
