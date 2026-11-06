const {test,expect}=require('@playwright/test');
const ids={send:'00000000-0000-4000-8000-000000000101',proposal:'00000000-0000-4000-8000-000000000102',message:'00000000-0000-4000-8000-000000000103'};
async function fixture(page,owner=true){
 await page.route('https://**',r=>r.abort());
 await page.route('**/vendor/supabase.js',r=>r.fulfill({contentType:'text/javascript',body:`
  const ids=${JSON.stringify(ids)};window.fixtureCalls=[];window.fixtureOwner=${owner};
  window.fixtureCapture=JSON.parse(localStorage.getItem('fixture-capture')||'null')||{version:0,state:'closed',enabled:false,testOnly:true,captureEnabled:false,captureActive:false,captureMode:'pilot',connectionReady:true,schedulerRegistered:false,jobState:'none',targetSendIds:[],replies:[],testSends:[{sendId:ids.send,proposalId:ids.proposal,version:2,reviewedRevision:2,name:'[TESTE SEM VALOR COMERCIAL] QA-VENDA-01',guests:45,recipient:'owner@example.test',replyTo:'eventos+'+'a'.repeat(52)+'@embaixadacarioca.com.br',routeRevoked:true}]};
  window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:fixtureOwner?{id:'owner',email:'owner@example.test'}:null}}),onAuthStateChange:cb=>{window.fixtureAuth=cb;return{data:{subscription:{unsubscribe(){}}}};}},rpc:async(name,args)=>{
   if(name==='is_super_admin')return{data:fixtureOwner};fixtureCalls.push(structuredClone(args));
   if(window.fixturePause)await new Promise(resolve=>window.fixtureRelease=resolve);
   if(window.fixtureFailure===args.action)return{error:{message:'Synthetic failure'}};
   const d=fixtureCapture;
   if(['start_test','start'].includes(args.action)){d.version++;d.state='active';d.enabled=true;d.captureEnabled=true;d.captureActive=true;d.captureMode='continuous';d.testOnly=args.action==='start_test';d.targetSendIds=args.target_ids;d.schedulerRegistered=true;d.startsAt=new Date().toISOString();d.expiresAt=d.testOnly?new Date(Date.now()+3600000).toISOString():null;}
   if(args.action==='stop'){d.version++;d.state='closed';d.enabled=false;d.captureEnabled=false;d.captureActive=false;d.captureMode='pilot';d.schedulerRegistered=false;}
   localStorage.setItem('fixture-capture',JSON.stringify(d));return{data:structuredClone(d)};
  }})};
 `}));
 await page.goto('/captura-respostas.html');if(owner)await expect(page.locator('#captureStatus')).toContainText('Captura desligada');
}
for(const width of [1440,390])test(`continuous capture: explicit admission, bound readback and stop at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixture(page);
 expect(await page.evaluate(()=>fixtureCalls.map(x=>x.action))).toEqual(['status']);
 await page.locator('#testSends input').check();await expect(page.locator('#testRouteDetails')).toContainText('owner@example.test');
 await expect(page.locator('#startTestCapture')).toBeDisabled();await page.locator('#testConsent').check();await page.locator('#startTestCapture').click();
 await expect(page.locator('#captureStatus')).toContainText('restrito ao teste');
 const action=await page.evaluate(()=>fixtureCalls.find(x=>x.action==='start_test'));expect(action.target_ids).toEqual([ids.send]);expect(action.confirmed).toBe(true);expect(action.request_id).toMatch(/^[a-f0-9-]{36}$/);
 await page.evaluate(ids=>{fixtureCapture.startsAt=new Date(Date.now()-1200000).toISOString();fixtureCapture.lastSuccessAt=new Date().toISOString();fixtureCapture.jobState='completed';fixtureCapture.replies=[{messageId:ids.message,proposalId:ids.proposal,sendId:ids.send,revision:2,persisted:true}];},ids);
 await page.locator('#readCapture').click();await expect(page.locator('#captureProof')).toContainText('Resposta persistida e relida');await expect(page.locator('#captureSchedule')).toContainText('além de 15 minutos');
 await page.reload();await expect(page.locator('#captureProof')).toContainText(ids.message);expect(await page.evaluate(()=>fixtureCalls.map(x=>x.action))).toEqual(['status']);
 await page.locator('#stopConsent').check();await page.locator('#stopCapture').click();await expect(page.locator('#captureStatus')).toContainText('Captura desligada');
 expect(await page.evaluate(()=>fixtureCalls.every(x=>['status','stop'].includes(x.action)))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4)).toBe(true);
});
test('uncertain activation remains blocked until readback and is never replayed automatically',async({page})=>{
 await fixture(page);await page.locator('#testSends input').check();await page.locator('#testConsent').check();await page.evaluate(()=>fixtureFailure='start_test');await page.locator('#startTestCapture').click();
 await expect(page.locator('#captureOutcome')).toContainText('Resultado não confirmado');await page.locator('#testConsent').check();await expect(page.locator('#startTestCapture')).toBeDisabled();
 await page.evaluate(()=>fixtureFailure=null);await page.locator('#readCapture').click();expect(await page.evaluate(()=>fixtureCalls.filter(x=>x.action==='start_test').length)).toBe(1);
 await page.locator('#testConsent').check();await expect(page.locator('#startTestCapture')).toBeEnabled();
});
test('session absence and logout hide all state and discard a late reply',async({page})=>{
 await fixture(page,false);await expect(page.locator('#captureWorkspace')).toBeHidden();expect(await page.evaluate(()=>fixtureCalls.length)).toBe(0);
 await page.evaluate(()=>{fixtureOwner=true;fixtureAuth('SIGNED_IN',{user:{id:'owner'}});});await expect(page.locator('#captureWorkspace')).toBeVisible();
 await page.evaluate(()=>fixturePause=true);await page.locator('#readCapture').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.fixtureRelease))).toBe(true);
 await page.evaluate(()=>{fixtureOwner=false;fixtureAuth('SIGNED_OUT',null);fixtureRelease();});await expect(page.locator('#captureWorkspace')).toBeHidden();await expect(page.locator('#captureProof')).toBeEmpty();await expect(page.locator('#testRouteDetails')).toBeEmpty();
});
