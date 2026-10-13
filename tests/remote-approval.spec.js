const {test,expect}=require('@playwright/test');
const aid='00000000-0000-4000-8000-000000000702';
async function setup(page,options={}){
 await page.route('**/vendor/supabase.js',route=>route.fulfill({contentType:'application/javascript',body:'window.supabase={createClient:()=>window.approvalMock};'}));
 await page.addInitScript(({aid,options})=>{
  window.approvalCalls=[];let listener=()=>{};
  const a={id:aid,proposal_id:aid,revision:3,review_hash:'exact-review',status:'pending',can_decide:!options.seller,expired:!!options.expired,stale:!!options.stale,expires_at:'2099-11-18T10:00:00Z',approver_email:'manager@example.test',notifications:[{channel:'whatsapp',status:'accepted'},{channel:'email',status:'failed'}],proposal_snapshot:{versao:1,cliente_nome:'Cliente de teste <script>alert(1)</script>',tipo_evento:'Coffee Break',data_evento:'2099-11-18',horario_evento:'10:00:00',convidados:20,duracao:2,total:1120,subtotal:1000,taxa_servico:120,privatizacao:0,snapshot:{event:{signalDeadlineHours:48,notes:'Observações preservadas'},totals:{},selectedItems:[{name:'Café e frutas',description:'Descrição completa',calc:{total:1000}}],generalTerms:'Condições aprovadas',paymentTerms:'50% de sinal'}},content:{channel:'email',destination:'client@example.test',sender:'sender@example.test',title:'Assunto exato',body:'Mensagem exata que será enviada',html:'<p>Resumo completo</p><script>parent.window.executed=true</script>'},send_id:null};
  if(options.sendStatus){a.status='approved';a.send_id='send';a.send={status:options.sendStatus};}
  let user=options.unauthenticated?null:{id:'manager',email:'manager@example.test'};
  window.approvalMock={
   auth:{getUser:async()=>({data:{user}}),onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}}},signInWithPassword:async()=>({data:{}}),signOut:async()=>{user=null;listener('SIGNED_OUT');return {};}},
   rpc:async()=>({data:{enabled:true,is_approver:!options.seller}}),
   functions:{invoke:async(name,{body})=>{window.approvalCalls.push(body);if(body.action==='approve'){await new Promise(r=>setTimeout(r,100));a.status='approved';a.send_id='send';a.send={status:'accepted'};}if(['changes_requested','rejected'].includes(body.action)){a.status=body.action;a.reason=body.reason;}return {data:{ok:true,approval:structuredClone(a)}};}}
  };
 },{aid,options});
 await page.goto('/aprovacoes.html?id='+aid);
 if(!options.unauthenticated)await expect(page.locator('#detail')).toBeVisible();
}
test('aprovação remota: abrir link mostra revisão mas não decide nem envia',async({page})=>{await setup(page);await expect(page.locator('#exactMessage')).toHaveValue('Mensagem exata que será enviada');await expect(page.locator('#detail')).toContainText('client@example.test');await expect(page.locator('#detail')).toContainText('50% de sinal');expect(await page.evaluate(()=>window.approvalCalls.every(c=>c.action==='get'))).toBe(true);expect(await page.evaluate(()=>window.executed)).toBeUndefined();await expect(page.locator('#emailPreview')).toHaveAttribute('sandbox','');});
test('aprovação remota: conta não autenticada não lê propostas',async({page})=>{await setup(page,{unauthenticated:true});await expect(page.locator('#login')).toBeVisible();expect(await page.evaluate(()=>window.approvalCalls)).toEqual([]);await expect(page.locator('#workspace')).toBeHidden();});
test('aprovação remota: aprovação exige confirmação e duplo clique só despacha uma vez',async({page})=>{await setup(page);const b=page.getByRole('button',{name:'Aprovar e enviar ao cliente',exact:true});await b.click();await expect(page.locator('#notice')).toContainText('Marque a confirmação');expect(await page.evaluate(()=>window.approvalCalls.filter(x=>x.action==='approve').length)).toBe(0);await page.locator('#confirmed').check();await b.evaluate(el=>{el.click();el.click();});await expect(page.locator('#notice')).toContainText('envio aceito');const calls=await page.evaluate(()=>window.approvalCalls.filter(x=>x.action==='approve'));expect(calls).toHaveLength(1);expect(calls[0].reviewHash).toBe('exact-review');expect(calls[0].confirmed).toBe(true);await expect(b).toHaveCount(0);});
for(const action of [['Solicitar ajustes','changes_requested'],['Rejeitar esta versão','rejected']])test(`aprovação remota: ${action[0]} exige motivo e não aprova`,async({page})=>{await setup(page);await page.getByRole('button',{name:action[0],exact:true}).click();await expect(page.locator('#notice')).toContainText('Informe o motivo');await page.locator('#reason').fill('Revisar o número de convidados');await page.getByRole('button',{name:action[0],exact:true}).click();await expect(page.locator('#detail')).toContainText('Revisar o número de convidados');const calls=await page.evaluate(()=>window.approvalCalls);expect(calls.some(x=>x.action===action[1])).toBe(true);expect(calls.some(x=>x.action==='approve')).toBe(false);});
for(const option of ['seller','expired','stale'])test(`aprovação remota: ${option} não permite liberação`,async({page})=>{await setup(page,{[option]:true});await expect(page.getByRole('button',{name:'Aprovar e enviar ao cliente',exact:true})).toHaveCount(0);});
test('aprovação remota: painel cabe no celular e saída apaga dados',async({page})=>{await page.setViewportSize({width:320,height:760});await setup(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.locator('#logout').click();await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#detail')).toBeEmpty();});
test('aprovação remota: equipe solicita revisão sem alterar estado comercial ou enviar',async({page})=>{
 await page.goto('/index.html?qa=1');
 const result=await page.evaluate(async()=>{
  const proposal=state.proposals.find(x=>x.id==='qa-proposal-sem-resposta');openSavedProposal(proposal.id);
  let captured;const status=proposal.status;state.supabase.functions.invoke=async(name,{body})=>{captured={name,body};return {data:{ok:true,approval:{id:'request-test',status:'pending',notifications:[{channel:'whatsapp',status:'accepted'},{channel:'email',status:'failed'}]}}};};
  const ok=await requestRemoteProposalApproval('whatsapp',{proposal,proposalUrl:getPublicProposalUrl(proposal),message:'Mensagem exata de teste'});
  return {ok,captured,status:proposal.status,before:status};
 });
 expect(result.ok).toBe(true);expect(result.captured.name).toBe('event-proposal-approval');expect(result.captured.body.action).toBe('request');expect(result.status).toBe(result.before);await expect(page.locator('#remoteApprovalResult')).toContainText('Aguardando aprovação');
});

for(const sendStatus of ['failed','sending','uncertain','accepted'])test(`aprovação remota: tentativa após ${sendStatus} depende de confirmação`,async({page})=>{
 await setup(page,{sendStatus});const b=page.getByRole('button',{name:'Repetir envio recusado',exact:true});
 if(sendStatus!=='failed'){await expect(b).toHaveCount(0);return;}
 await expect(b).toBeVisible();await b.click();expect(await page.evaluate(()=>window.approvalCalls.filter(c=>c.action==='approve').length)).toBe(0);
 await page.locator('#confirmed').check();await b.click();await expect(page.locator('#notice')).toContainText('envio aceito');
 expect(await page.evaluate(()=>window.approvalCalls.filter(c=>c.action==='approve').length)).toBe(1);
});
