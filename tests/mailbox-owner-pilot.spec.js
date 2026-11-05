const {test,expect}=require('@playwright/test');
const ids={proposal:'00000000-0000-4000-8000-000000000111',old:'00000000-0000-4000-8000-000000000222',send:'00000000-0000-4000-8000-000000000333',message:'00000000-0000-4000-8000-000000000444'};
async function fixture(page,{owner=true}={}){
 await page.route('https://**',route=>route.abort());
 await page.route('**/vendor/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:`
  const ids=${JSON.stringify(ids)};
  window.fixtureCalls=[];window.fixtureOwner=${owner};
  window.fixturePilot={version:0,state:'closed',proposalIds:[],captureSendIds:[],captureEnabled:false,captureScoped:false,connectionReady:true,jobState:'none',
   proposals:[{id:ids.old,version:1,revision:4,name:'[TESTE SEM VALOR COMERCIAL] QA-VENDA-01',guests:30,publication:'sent'},
    {id:ids.proposal,version:2,revision:1,name:'[TESTE SEM VALOR COMERCIAL] QA-VENDA-01',guests:45,publication:'draft'}],sends:[],replies:[]};
  window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:window.fixtureOwner?{id:'owner',email:'owner@example.test'}:null}}),
   onAuthStateChange:callback=>{window.fixtureAuth=callback;return {data:{subscription:{unsubscribe(){}}}};}},
   rpc:async()=>({data:window.fixtureOwner}),functions:{invoke:async(_name,{body})=>{
    fixtureCalls.push(structuredClone(body));
    if(window.fixturePause){await new Promise(resolve=>window.fixtureRelease=resolve);}
    if(window.fixtureFailure===body.action)return {error:{message:'fixture failure'}};
    const p=fixturePilot;
    if(body.action==='open'){p.state='open';p.version++;p.proposalIds=body.ids;p.recipient='owner@example.test';p.startsAt=new Date().toISOString();p.expiresAt=new Date(Date.now()+900000).toISOString();}
    if(body.action==='capture'){p.version++;p.captureSendIds=body.ids;p.captureEnabled=true;p.captureScoped=true;}
    if(body.action==='queue')p.jobState='completed';
    if(body.action==='close'){p.state='closed';p.version++;p.captureEnabled=false;p.captureScoped=false;}
    if(p.state==='open'&&Date.parse(p.expiresAt)<=Date.now())p.state='expired';
    return {data:{ok:true,pilot:structuredClone(p),publicRoutingOff:true,connectionStored:true,senderReady:true,sendsPerformed:0,
     leadAlerts:{configured:true,topologyVerified:true,recipient:'team@example.test',safeForPilot:true,maxAlertsPerCompletedLead:2}}};
   }}})};
 `}));
 await page.goto('/piloto-respostas.html');
 if(owner)await expect(page.locator('#pilotStatus')).toContainText('Janela fechada');
}
async function open(page){await page.locator(`#pilotProposals input[value="${ids.proposal}"]`).check();await page.locator('#pilotConfirmed').check();await page.locator('#openPilot').click();await expect(page.locator('#pilotStatus')).toContainText('Janela restrita aberta');}
async function accepted(page){await page.evaluate(ids=>fixturePilot.sends=[{id:ids.send,proposalId:ids.proposal,revision:2,status:'accepted',attempts:1,routed:true}],ids);await page.locator('#readPilot').click();await page.locator(`#pilotSends input[value="${ids.send}"]`).check();await page.locator('#captureConfirmed').check();}
for(const width of [1440,390])test(`piloto Master: fluxo restrito sem envio, retorno e fechamento em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.clock.install();await fixture(page);
 expect(await page.evaluate(()=>fixtureCalls.map(c=>c.action))).toEqual(['status']);
 await expect(page.locator('#leadAlertStatus')).toContainText('Até 2 alertas por lead');
 await expect(page.locator(`#pilotProposals input[value="${ids.old}"]`)).toBeDisabled();
 await open(page);expect(await page.evaluate(()=>fixturePilot.captureEnabled)).toBe(false);
 await accepted(page);await page.locator('#capturePilot').click();
 await expect(page.locator('#pilotStatus')).toContainText('Captura limitada');
 await page.clock.fastForward(60000);
 await expect.poll(()=>page.evaluate(()=>fixtureCalls.filter(c=>c.action==='queue').length)).toBe(1);
 const queued=await page.evaluate(()=>fixtureCalls.find(c=>c.action==='queue'));expect(queued.requestId).toMatch(/^[a-f0-9-]{36}$/);
 await page.evaluate(ids=>fixturePilot.replies=[{proposalId:ids.proposal,revision:2,sendId:ids.send,messageId:ids.message,persisted:true}],ids);
 await page.locator('#readPilot').click();await expect(page.locator('#pilotEvidence')).toContainText(`proposta ${ids.proposal}, revisão 2`);
 await page.locator('#closePilot').click();await expect(page.locator('#pilotStatus')).toContainText('Captura desligada');
 const before=await page.evaluate(()=>fixtureCalls.length);await page.clock.fastForward(120000);expect(await page.evaluate(()=>fixtureCalls.length)).toBe(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4)).toBe(true);
 expect(await page.evaluate(()=>fixtureCalls.every(c=>!['send','approve','pay','reserve'].includes(c.action)))).toBe(true);
});
test('sessão ausente ou alterada não expõe estado nem admite resposta tardia',async({page})=>{
 await fixture(page,{owner:false});await expect(page.locator('#pilotWorkspace')).toBeHidden();expect(await page.evaluate(()=>fixtureCalls.length)).toBe(0);
 await page.evaluate(()=>{fixtureOwner=true;fixtureAuth('SIGNED_IN',{user:{id:'owner'}});});await expect(page.locator('#pilotWorkspace')).toBeVisible();
 await page.evaluate(()=>fixturePause=true);await page.locator('#readPilot').click();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.fixtureRelease))).toBe(true);
 await page.evaluate(()=>{fixtureOwner=false;fixtureAuth('SIGNED_OUT',null);fixtureRelease();});
 await expect(page.locator('#pilotWorkspace')).toBeHidden();await expect(page.locator('#pilotEvidence')).toBeEmpty();await expect(page.locator('#leadAlertStatus')).not.toContainText('team@example.test');
});
test('falha de consulta suspende automação e não repete operação incerta',async({page})=>{
 await page.clock.install();await fixture(page);await open(page);await accepted(page);
 await page.evaluate(()=>fixtureFailure='queue');await page.locator('#capturePilot').click();
 await page.clock.fastForward(60000);await expect(page.locator('#pilotOutcome')).toContainText('Resultado não confirmado');
 await page.clock.fastForward(180000);expect(await page.evaluate(()=>fixtureCalls.filter(c=>c.action==='queue').length)).toBe(1);
 await expect(page.locator('#closePilot')).toBeEnabled();
 await page.locator('#readPilot').click();expect(await page.evaluate(()=>fixtureCalls.filter(c=>c.action==='queue').length)).toBe(1);
 await page.locator('#closePilot').click();await expect(page.locator('#pilotStatus')).toContainText('Janela fechada');
});
