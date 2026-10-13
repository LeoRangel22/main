# Temporary scoped source edits. Removed after full verification, before merge.
from pathlib import Path
import re

def replace(path, old, new):
    p=Path(path); s=p.read_text()
    if s.count(old)!=1: raise RuntimeError('Unexpected source: '+path)
    p.write_text(s.replace(old,new,1))

replace('app.js', '''  const emailMessage = renderCommunicationTemplateText(emailTemplate.emailBody, getQuickReplyContext(), proposalUrl);
  const emailSubject = emailTemplate.subject || "Sua proposta de evento na Embaixada Carioca";''', '''  // A quick reply already contains the chosen follow-up/payment content.
  // Disabling manager approval must not replace it with an initial proposal.
  const emailMessage = typeof message === "string" ? message
    : renderCommunicationTemplateText(emailTemplate.emailBody, getQuickReplyContext(), proposalUrl);
  const emailSubject = typeof subject === "string" && subject.trim() ? subject
    : emailTemplate.subject || "Sua proposta de evento na Embaixada Carioca";''')
for name in ['index.html','clientes.html','comunicacao.html','valores.html','formulario.html','proposta.html','aprovacoes.html']:
    p=Path(name); s=p.read_text()
    s,count=re.subn(r'((?:src|href)="\./(?:app\.js|remote-approval-ui\.js|aprovacoes\.js|approval\.css|formulario\.js|proposta\.js))(?:\?[^\"]*)?(\")',r'\1?v=20261013-approval-closure\2',s)
    if not count: raise RuntimeError('No changed asset in '+name)
    p.write_text(s)

p=Path('supabase/functions/event-proposal-approval/index.ts'); s=p.read_text()
s=s.replace('import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";', 'import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";\nimport { deliverManagerNotice } from "../_shared/approval-notifications.ts";',1)
a=s.index('async function notify('); b=s.index('Deno.serve(',a)
s=s[:a]+'''async function notify(worker: any, approvalId: string, channel: string) {
  const claimed = await rpc(worker,"event_claim_approval_notification", { target_approval: approvalId, target_channel: channel });
  if (!claimed) return;
  const result = await deliverManagerNotice(channel,claimed.destination,notificationText(claimed.approval),
    `Aprovar proposta — ${text(claimed.approval.proposal_snapshot.cliente_nome).slice(0,80)}`,
    `${APPROVAL_SITE}aprovacoes.html?id=${approvalId}`,`APPROVAL:${approvalId}:${channel}`);
  await rpc(worker,"event_finish_approval_notification", { target_approval: approvalId, target_channel: channel, result_status: result.status, external_id: result.providerId, result_detail: result.detail });
}

'''+s[b:];p.write_text(s)
replace('checks/remote-approval.test.cjs',' vm.runInContext(stripTypeScriptTypes(source),context);',r''' const transport=fs.readFileSync(`${__dirname}/../supabase/functions/_shared/approval-notifications.ts`,'utf8').replace(/^export /gm,'');
 vm.runInContext(stripTypeScriptTypes(transport+'\n'+source),context);''')
replace('aprovacoes.html','<div id="list"></div>','<aside id="watchStatus" role="status"></aside><div id="list"></div>')
watch=r'''  async function loadWatch(generation){
    try {
      const result=await client.rpc('get_event_approval_watch_health');
      if(generation!==state.generation||!state.user)return;
      if(result.error||typeof result.data?.enabled!=='boolean')throw Error('unavailable');
      const health=result.data;
      const stale=!health.last_success_at||Date.now()-Date.parse(health.last_success_at)>15*60*1000;
      const label=!health.enabled?'Monitor de aprovações desativado':stale?'Monitor sem verificação recente — confira as pendências':'Monitor de aprovações ativo';
      const names={approval_waiting:'Aguardando decisão',approval_expired:'Aprovação expirada',notification_failed:'Aviso recusado',notification_stalled:'Aviso parado ou incerto',dispatch_attention:'Envio requer conferência'};
      const alerts=(health.alerts||[]).slice(0,8);
      $('watchStatus').innerHTML=`<p>${esc(label)}. Verificação a cada 5 minutos; alertas das 08h30 às 21h (Brasília).</p>${alerts.length?'<details><summary>Histórico recente de alertas</summary>'+alerts.map(a=>`<p>${esc(names[a.kind]||a.kind)} · ${esc(a.channel)} · ${esc(a.status==='accepted'?'aceito pelo provedor; entrega não confirmada':a.status)} ${/^[a-f0-9-]{36}$/i.test(a.approval_id||'')?`<a href="./aprovacoes.html?id=${esc(a.approval_id)}">Conferir solicitação</a>`:''}</p>`).join('')+'</details>':''}`;
    }catch{if(generation===state.generation&&state.user)$('watchStatus').textContent='Estado do monitor indisponível. A revisão da proposta permanece acessível.';}
  }
'''
replace('aprovacoes.js','  async function load(){',watch+'  async function load(){')
replace('aprovacoes.js','    if(state.id){', '    await loadWatch(generation);\n    if(generation!==state.generation)return;\n    if(state.id){')
p=Path('aprovacoes.js');s=p.read_text();old="$('detail').innerHTML='';$('list').innerHTML='';";assert s.count(old)==3;s=s.replace(old,old+"$('watchStatus').textContent='';");p.write_text(s)
replace('scripts/test-database.cjs',"'proposal-persistence','remote-approval']","'proposal-persistence','remote-approval','approval-closure']")
concurrent=r'''    // A renewal uses the proposal lock: concurrent unchanged requests share one successor.
    await c.query("update event_private.proposal_approval_policy set enabled=true,approver_id=$1,approver_email='leorangel@gmail.com',whatsapp='5521000000000' where id",[actor]);
    const renewalOpp=(await c.query("insert into oportunidades(cliente_nome,status,data_evento) values('Renewal race fixture','proposta_pronta','2099-11-18') returning id")).rows[0].id;
    const renewal=(await c.query("insert into propostas(oportunidade_id,cliente_nome,status,publication_status,data_evento,horario_evento,convidados,subtotal,taxa_servico,total,snapshot) values($1,'Renewal race fixture','proposta_pronta','ready','2099-11-18','10:00',20,1000,120,1120,'{\"totals\":{\"subtotal\":1000,\"serviceFee\":120,\"total\":1120},\"selectedItems\":[{\"name\":\"Fixture\",\"calc\":{\"total\":1000}}]}') returning *",[renewalOpp])).rows[0];
    const content=JSON.stringify({channel:'whatsapp',destination:'5521000000001',body:'Renewal race fixture',message:'Renewal race fixture',title:'Fixture',contentHash:null,reviewedResponseAt:null,proposalUrl:'https://leorangel22.github.io/main/proposta.html?p='+renewal.public_token});
    const prior=(await c.query('select * from event_create_proposal_approval($1,$2,$3,$4)',[renewal.id,renewal.revision,actor,content])).rows[0];
    await c.query("update event_proposal_approvals set expires_at=now()-interval '1 second' where id=$1",[prior.id]);
    await Promise.all(writers.map(x=>x.query('set role service_role')));
    const renewed=await Promise.all(writers.map(x=>x.query('select * from event_create_proposal_approval($1,$2,$3,$4)',[renewal.id,renewal.revision,actor,content])));
    assert.equal(renewed[0].rows[0].id,renewed[1].rows[0].id);assert.notEqual(renewed[0].rows[0].id,prior.id);
    assert.equal(Number((await c.query('select count(*) from event_proposal_approvals where proposal_id=$1',[renewal.id])).rows[0].count),2);
    assert.equal(Number((await c.query('select revision from propostas where id=$1',[renewal.id])).rows[0].revision),Number(renewal.revision));
    await c.query('update event_private.proposal_approval_policy set enabled=false where id');
    console.log('PASS concurrent approval expiry renewal without proposal mutation');
'''
replace('scripts/test-database.cjs',"    console.log('PASS concurrent public retry and team/client race');\n", "    console.log('PASS concurrent public retry and team/client race');\n"+concurrent)
p=Path('tests/remote-approval-production.spec.js');s=p.read_text();s+=r'''

test('production disabled approval preserves selected quick-reply subject and text in preview and dispatch',async({page})=>{
 await mount(page);
 const result=await page.evaluate(async()=>{
  const proposal=getActiveProposal();let capturedReview;
  state.supabase.rpc=async()=>({data:{enabled:false}});
  confirmClientSend=async review=>{capturedReview=review;return true;};
  state.supabase.functions.invoke=async(name,{body})=>{
   window.approvalProductionCalls.push({name,body});
   if(body.preview)return {data:{ok:true,mode:'preview',html:'<p>Selected follow-up</p>',text:body.message,subject:body.title,sender:'Fixture',contentHash:'reviewed',reviewedRevision:body.reviewedRevision}};
   return {data:{ok:true,message:'Accepted fixture'}};
  };
  loadCommercialInsights=async()=>{};loadEventOperations=async()=>{};loadProposalHistory=async()=>{};
  reconcileProposalEditorAfterSend=async()=> 'reconciled';
  const ok=await sendProposalEmailViaZepto({proposal,proposalUrl:getPublicProposalUrl(proposal),email:'fixture@example.test',message:'Retorno escolhido sobre o pagamento',subject:'Assunto específico de acompanhamento',title:'Acompanhamento'});
  return {ok,calls:window.approvalProductionCalls,review:capturedReview};
 });
 expect(result.ok).toBe(true);expect(result.calls).toHaveLength(2);
 for(const call of result.calls){expect(call.body.message).toBe('Retorno escolhido sobre o pagamento');expect(call.body.title).toBe('Assunto específico de acompanhamento');}
 expect(result.review.message).toBe('Retorno escolhido sobre o pagamento');expect(result.review.subject).toBe('Assunto específico de acompanhamento');
});
''';p.write_text(s)
replace('tests/remote-approval.spec.js',"   rpc:async()=>({data:{enabled:true,is_approver:!options.seller}}),", "   rpc:async(name)=>({data:name==='get_event_approval_watch_health'?{enabled:true,last_success_at:new Date().toISOString(),alerts:[]}:{enabled:true,is_approver:!options.seller}}),")
p=Path('tests/remote-approval.spec.js');s=p.read_text();s+=r'''

test('monitor banner is authenticated, shows health, and logout removes it',async({page})=>{
 await setup(page);await expect(page.locator('#watchStatus')).toContainText('Monitor de aprovações ativo');
 await page.locator('#logout').click();await expect(page.locator('#watchStatus')).toBeEmpty();
});
''';p.write_text(s)
p=Path('docs/REMOTE-APPROVAL.md');s=p.read_text();s+='''

## Fechamento e alertas — 13/10/2026
O conteúdo determinístico da solicitação agora possui identidade separada da decisão. Pedidos vivos iguais são reaproveitados; expirados ou decisões terminais recebem um sucessor com revisão comercial preservada, nova validade e histórico de vínculo. Despachos aceitos/em andamento/incertos nunca são renovados para gerar repetição. Uma decisão anterior não aprova seu sucessor.

As páginas internas e públicas alteradas usam a identificação `20261013-approval-closure` para invalidar os arquivos antigos no cache. O envio de resposta rápida com aprovação desativada preserva texto e assunto selecionados.

`event-approval-monitor` usa uma credencial de tarefa privada, verificada por RPC exclusiva do serviço. Não depende do navegador ou deste chat. O agendamento de cinco minutos é instalado desativado e só é habilitado após a função e a publicação serem conferidas. Não altera aprovações, propostas, pagamentos, callbacks ou o registro de envio ao cliente.

Detecção: avisos pendentes/em andamento por dez minutos, avisos recusados/incertos, solicitações aguardando decisão por duas horas, solicitações expiradas e decisões aprovadas sem despacho confirmado. Os alertas são enviados ao gestor nos dois destinos privados das 08h30 às 21h de Brasília. Fora desse horário, a detecção continua e a fila é revalidada antes do envio. Cada solicitação/motivo/canal tem uma identidade única; alertas aceitos/em andamento/incertos não se repetem. Somente alertas definitivamente recusados são tentados novamente, no máximo três tentativas, com intervalo mínimo de uma hora. Os avisos originais de aprovação e os envios ao cliente não são repetidos pelo monitor.

O painel autenticado mostra a última execução e o histórico de alertas. Falha de leitura do monitor não impede revisar uma proposta. Aceitação do alerta pelo provedor não comprova sua entrega. O teste real de transporte (`probeId` UUID), restrito à credencial privada, usa somente os destinos configurados do gestor, não cria proposta e não registra aprovação. Repetir o mesmo identificador não envia novamente; outro teste é limitado a um por hora. A primeira decisão real do gestor continua sendo uma validação separada.
''';p.write_text(s)
print('Scoped approval edits applied; full validation required before commit')
