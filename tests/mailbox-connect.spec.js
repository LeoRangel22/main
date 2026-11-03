const {test,expect}=require('@playwright/test');
const OWNER='11111111-1111-4111-8111-111111111111',ATTEMPT='22222222-2222-4222-8222-222222222222';
async function fixture(context,mode='success'){
 const state={value:'absent',complete:0,exchanges:0};
 await context.exposeBinding('mailboxFixture',async(source,{kind,payload})=>{
  if(kind==='role')return {data:true,error:null};
  const meta=()=>({ok:true,state:state.value,captureActivated:false,...(state.value==='prepared'?{attemptId:ATTEMPT,expiresAt:'2099-01-01T00:00:00Z'}:{})});
  if(payload.action==='status')return {data:meta(),error:null};
  if(payload.action==='prepare'){state.value='prepared';return {data:meta(),error:null};}
  if(payload.action==='complete'){
   state.complete++;if(state.value!=='prepared')return {data:null,error:{}};
   state.value='claimed';state.exchanges++;await new Promise(r=>setTimeout(r,40));
   if(mode==='uncertain'){state.value='uncertain';return {data:null,error:{}};}
   state.value='stored';return {data:meta(),error:null};
  }
  return {data:null,error:{}};
 });
 await context.route('**/vendor/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:`window.fixtureUser={id:'${OWNER}'};window.fixtureCallbacks=[];window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:window.fixtureUser},error:null}),onAuthStateChange:fn=>window.fixtureCallbacks.push(fn)},rpc:async()=>window.mailboxFixture({kind:'role'}),functions:{invoke:async(name,{body})=>window.mailboxFixture({kind:'invoke',payload:body})}})};`}));
 // No external provider/network access. Existing web-font imports use offline fixtures.
 await context.route('https://**',route=>route.fulfill({status:200,contentType:route.request().resourceType()==='stylesheet'?'text/css':'application/octet-stream',body:''}));
 return state;
}
test('mailbox connection keeps code private, one submit, same-user refresh and 320px reflow',async({page,context})=>{
 const state=await fixture(context);await page.setViewportSize({width:320,height:900});await page.goto('/conectar-email.html');
 await page.locator('#scopeConfirmed').check();await page.locator('#prepareConnection').click();await expect(page.locator('#authorizationCode')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.evaluate(()=>{for(const cb of window.fixtureCallbacks)cb('TOKEN_REFRESHED',{user:window.fixtureUser})});
 await page.locator('#authorizationCode').fill('fixture-code');await page.locator('#connectionForm').dispatchEvent('submit');await page.locator('#connectionForm').dispatchEvent('submit');
 await expect(page.locator('#connectionStatus')).toContainText('Conta verificada');expect(state.exchanges).toBe(1);expect(state.complete).toBe(1);
 await expect(page.locator('#authorizationCode')).toHaveValue('');expect(await page.evaluate(()=>JSON.stringify(sessionStorage).includes('fixture-code'))).toBe(false);
 await page.evaluate(()=>{window.fixtureUser=null;for(const cb of window.fixtureCallbacks)cb('SIGNED_OUT',null)});await expect(page.locator('#connectionWorkspace')).toBeHidden();
});
test('mailbox connection uncertain result survives reload without replay',async({page,context})=>{
 const state=await fixture(context,'uncertain');await page.goto('/conectar-email.html');await page.locator('#scopeConfirmed').check();await page.locator('#prepareConnection').click();
 await page.locator('#authorizationCode').fill('fixture-code');await page.locator('#authorizationCode').press('Enter');await expect(page.locator('#connectionOutcome')).toContainText('Resultado não confirmado');
 await expect(page.locator('#authorizationCode')).toHaveValue('');await expect(page.locator('#completeConnection')).toBeDisabled();await page.reload();
 await expect(page.locator('#connectionStatus')).toContainText('Resultado incerto');expect(state.complete).toBe(1);expect(state.exchanges).toBe(1);
});
