const {test,expect}=require('@playwright/test');
const id='00000000-0000-4000-8000-000000000799';
async function mount(page,options={}){
 await page.route('**/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:'window.supabase={createClient:()=>window.evidenceClient};'}));
 await page.addInitScript(({id,options})=>{
  let listener=()=>{},user={id:'manager',email:'manager@example.test'};
  window.evidenceCalls=[];window.expireSession=()=>{user=null;listener('SIGNED_OUT');};
  const a={id,revision:3,review_hash:'reviewed',status:options.transport?'approved':'pending',can_decide:true,expired:false,stale:false,expires_at:'2099-11-18T10:00:00Z',approver_email:user.email,notifications:[],send_id:options.transport?id:null,send:options.transport?{status:options.transport,delivery_status:options.receipt}:null,
   proposal_snapshot:{versao:1,cliente_nome:'Controlled evidence fixture',tipo_evento:'Coffee Break',data_evento:'2099-11-18',horario_evento:'10:00',convidados:20,duracao:2,total:1120,subtotal:1000,taxa_servico:120,privatizacao:0,snapshot:{event:{},totals:{},selectedItems:[],generalTerms:'Terms',paymentTerms:'50%'}},content:{channel:'whatsapp',destination:'5521000000000',title:'Fixture',body:'Exact fixture message',sender:'Fixture'}};
  window.evidenceClient={auth:{getUser:async()=>({data:{user},error:window.authFailure?Error('Session expired'):null}),onAuthStateChange:fn=>{listener=fn;},signOut:async()=>{window.expireSession();return {};},signInWithPassword:async()=>({data:{}})},
   rpc:async name=>name==='get_event_approval_watch_health'?{data:{enabled:true,last_success_at:options.watchDate==='future'?new Date(Date.now()+3600000).toISOString():options.watchDate==='invalid'?'invalid':new Date().toISOString(),unresolved_count:options.badCount?null:0,alerts:[]}}:window.denyPolicy?{error:Error('Denied')}:{data:{enabled:true,is_approver:true}},
   functions:{invoke:async(name,{body})=>{
    window.evidenceCalls.push(body);
    if(body.action==='notify'||window.holdRead){await new Promise((resolve,reject)=>{window.releaseEvidence=()=>{if(options.lateError)reject(Error('Private previous-session detail'));else resolve();};});}
    return {data:{ok:true,approval:structuredClone(a)}};
   }}};
 },{id,options});
 await page.goto('/aprovacoes.html?id='+id);await expect(page.locator('#detail')).toBeVisible();
}
for(const [receipt,label] of [['delivered','entrega confirmada pelo provedor'],['read','leitura registrada pelo provedor'],['failed','falha de entrega informada'],['uncertain','entrega com resultado incerto'],['accepted','Entrega não confirmada']])test(`approval displays real delivery state ${receipt} without reenabling send`,async({page})=>{
 await mount(page,{transport:'accepted',receipt});await expect(page.locator('.status')).toContainText(label);
 await expect(page.locator('[data-decision]')).toHaveCount(0);expect(await page.evaluate(()=>window.evidenceCalls.map(x=>x.action))).toEqual(['get']);
});
for(const receipt of ['delivered','read','uncertain','accepted'])test(`conflicting failed transport and ${receipt} cannot offer another dispatch`,async({page})=>{
 await mount(page,{transport:'failed',receipt});await expect(page.locator('[data-decision]')).toHaveCount(0);
});
for(const lateError of [false,true])test(`a late notification ${lateError?'error':'result'} cannot restore private content after logout`,async({page})=>{
 await mount(page,{lateError});await page.getByText('Avisos e rastreabilidade',{exact:true}).click();await page.locator('#retryNotifications').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.releaseEvidence)).toBe('function');
 await page.evaluate(()=>{window.expireSession();window.releaseEvidence();});
 await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#detail')).toBeEmpty();await expect(page.locator('#identity')).toBeEmpty();await expect(page.locator('#watchStatus')).toBeEmpty();
 await expect(page.locator('#notice')).toContainText('Sessão encerrada');await expect(page.locator('#notice')).not.toContainText('Private');
 await expect(page.locator('#loginForm button')).toBeEnabled();
 expect(await page.evaluate(()=>window.evidenceCalls.map(x=>x.action))).toEqual(['get','notify']);
});
test('late refreshed approval cannot repopulate a signed-out workspace',async({page})=>{
 await mount(page);await page.evaluate(()=>{window.holdRead=true;});await page.locator('#refresh').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.releaseEvidence)).toBe('function');await expect(page.locator('#detail')).toBeEmpty();
 await page.evaluate(()=>{window.expireSession();window.releaseEvidence();});await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#detail')).toBeEmpty();await expect(page.locator('#notice')).toContainText('Sessão encerrada');
});
test('failed policy revalidation clears the prior review rather than leaving it visible',async({page})=>{
 await mount(page);await page.evaluate(()=>{window.denyPolicy=true;});await page.locator('#refresh').click();
 await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#detail')).toBeEmpty();await expect(page.locator('#identity')).toBeEmpty();await expect(page.locator('#notice')).toContainText('não possui acesso');
 expect(await page.evaluate(()=>window.evidenceCalls)).toHaveLength(1);
});
test('an authentication error cannot reuse a cached user to display protected content',async({page})=>{
 await mount(page);await page.evaluate(()=>{window.authFailure=true;});await page.locator('#refresh').click();
 await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#login')).toBeVisible();await expect(page.locator('#detail')).toBeEmpty();expect(await page.evaluate(()=>window.evidenceCalls)).toHaveLength(1);
});
for(const watchDate of ['invalid','future'])test(`monitor ${watchDate} timestamp cannot report healthy`,async({page})=>{
 await mount(page,{watchDate});await expect(page.locator('#watchStatus')).toContainText('sem verificação recente');await expect(page.locator('#detail')).toBeVisible();
});
test('incomplete monitor evidence remains unavailable without blocking the core review',async({page})=>{
 await mount(page,{badCount:true});await expect(page.locator('#watchStatus')).toContainText('Estado do monitor indisponível');await expect(page.locator('#exactMessage')).toHaveValue('Exact fixture message');
});
test('mobile navigation reaches the existing commercial and operational panel without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:320,height:760});await mount(page);
 await expect(page.getByRole('link',{name:'Painel comercial e operação'})).toHaveAttribute('href','./index.html');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
