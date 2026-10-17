/* Authenticated internal approval bridge. Never stores credentials or approves from a link. */
// Only a verified disabled policy restores legacy sending. Read failures fail closed.
async function remoteProposalApprovalEnabled() {
  if (QA_MODE) return false;
  const client=state.supabase, userId=state.session?.user?.id;
  if (!client || !userId) { showToast('Entre com sua conta da equipe.'); return null; }
  try {
    const {data,error}=await client.rpc('event_approval_policy');
    if(error || typeof data?.enabled!=='boolean' || state.supabase!==client || state.session?.user?.id!==userId) throw Error('Não foi possível conferir a política de aprovação. Nenhum envio autorizado.');
    const labels=data.enabled?{whatsappBtn:'Solicitar aprovação · WhatsApp',emailBtn:'Solicitar aprovação · e-mail'}:{whatsappBtn:'Enviar por WhatsApp',emailBtn:'Enviar por e-mail'};
    for(const [id,label] of Object.entries(labels)){const el=document.getElementById(id);if(el)el.textContent=label;}
    return data.enabled;
  } catch(error) { showToast(error.message || 'Não foi possível conferir a liberação.'); return null; }
}
async function requestRemoteProposalApproval(channel, options) {
  if (!state.supabase || !state.session) { showToast('Entre com sua conta da equipe.'); return false; }
  if (state.sendLocks[channel]) { showToast('A solicitação já está sendo preparada.'); return false; }
  if (!options.proposal?.id || hasUnsavedEditorChanges()) { showToast('Salve e revise as alterações antes de solicitar aprovação.'); return false; }
  const client = state.supabase, userId = state.session.user.id;
  const proposal = structuredClone(options.proposal);
  const context = getQuickReplyContext();
  const template = getCommunicationTemplate('proposta');
  const destination = channel === 'email' ? (options.email || context.email || proposal.cliente_email) : (context.phone || proposal.cliente_whatsapp);
  const message = channel === 'email'
    ? (options.message ?? renderCommunicationTemplateText(template.emailBody, context, options.proposalUrl))
    : appendBotWhatsAppNotice(options.message || buildProposalWhatsAppMessage(options.proposalUrl));
  const title = channel === 'email' ? (options.subject || template.subject || 'Sua proposta de evento na Embaixada Carioca') : (options.title || 'Proposta comercial');
  const reviewedResponseAt = getOpportunityForItem({opportunityId:proposal.oportunidade_id})?.ultima_resposta_cliente_em || null;
  state.sendLocks[channel] = true;
  try {
    showToast('Solicitando aprovação do gestor. Nenhum envio ao cliente será feito agora.');
    const {data,error} = await client.functions.invoke('event-proposal-approval',{body:{action:'request',channel,proposalId:proposal.id,reviewedRevision:Number(proposal.revision),destination,message,title,reviewedResponseAt}});
    if(error || !data?.ok || !data.approval?.id) throw Error(data?.message || await getFunctionErrorMessage(error) || 'Não foi possível confirmar a solicitação. Confira Aprovações antes de repetir.');
    if(state.supabase !== client || state.session?.user?.id !== userId || state.activeProposalId !== proposal.id) return false;
    const a = data.approval;
    const accepted = (a.notifications || []).filter(n=>n.status==='accepted').map(n=>n.channel==='email'?'e-mail':'WhatsApp');
    const banner = document.getElementById('remoteApprovalResult') || document.createElement('div');
    banner.id='remoteApprovalResult';banner.className='remote-approval-result';banner.setAttribute('role','status');
    banner.textContent = `${a.status==='pending'?'Aguardando aprovação do gestor':'Solicitação: '+a.status}. ${accepted.length?'Aviso aceito pelo provedor em '+accepted.join(' e ')+'. Entrega não confirmada.':'Confira o estado dos avisos na solicitação.'} ${a.send_id?'Consulte o resultado do envio no histórico.':'Nenhuma proposta enviada ao cliente por esta solicitação.'}`;
    const link=document.createElement('a');link.href=`./aprovacoes.html?id=${encodeURIComponent(a.id)}`;link.textContent='Ver solicitação e decisão';link.style.display='block';banner.append(link);
    (document.querySelector('#sendReviewPanel') || document.querySelector('main') || document.body).append(banner);
    showToast('Solicitação registrada. Acompanhe em Aprovações.');
    return true;
  } catch(error) { showToast(error.message || 'Falha ao solicitar aprovação. Nenhum envio autorizado.'); return false; }
  finally { state.sendLocks[channel]=false; }
}
async function remoteProposalMayShare() {
  const enabled=await remoteProposalApprovalEnabled();
  if(enabled===null) return false;
  if(!enabled) return true;
  if(hasUnsavedEditorChanges()) { showToast('Salve e solicite a aprovação antes de compartilhar.'); return false; }
  const client=state.supabase,userId=state.session?.user?.id,base=state.editorProposalBase;
  const p=getActiveProposal();
  if(!p?.id || !base || base.id!==p.id) { showToast('Abra a proposta completa antes de compartilhar.'); return false; }
  const unchanged=()=>state.supabase===client && state.session?.user?.id===userId && state.activeProposalId===p.id && state.editorProposalBase===base && !hasUnsavedEditorChanges();
  try {
    const read=await client.from('propostas').select('*').eq('id',p.id).single();
    if(read.error || !read.data || !unchanged()) throw Error('Não foi possível atualizar a revisão. Suas alterações foram preservadas.');
    const latest=read.data;
    if(Number(latest.revision)!==Number(base.revision) && !isOwnProposalSendRevision(base,latest)) throw Error('A proposta mudou. Reabra e confira a versão atual antes de compartilhar.');
    const {data,error}=await client.rpc('event_proposal_can_share',{target_proposal:latest.id,expected_revision:Number(latest.revision)});
    if(error || data!==true || !unchanged()) throw Error('A versão ainda não está liberada. Use Solicitar aprovação.');
    // A manager send changes delivery metadata only; never replace local input.
    state.editorProposalBase=structuredClone(latest);upsertProposalState(latest);renderLoadedEditorBar();
    return true;
  } catch(error) { showToast(error.message || 'Não foi possível verificar a liberação. Compartilhamento bloqueado.'); return false; }
}
document.addEventListener('DOMContentLoaded',()=>{
  if(typeof QA_MODE!=='undefined' && QA_MODE) return;
  const bar=document.querySelector('.topbar-actions') || document.querySelector('header') || document.body;
  const link=document.createElement('a');link.href='./aprovacoes.html';link.textContent='Aprovações de propostas';link.className='secondary';link.style.margin='8px';bar.append(link);
  const labels={whatsappBtn:'Revisar e enviar · WhatsApp',emailBtn:'Revisar e enviar · e-mail'};
  for(const [id,label] of Object.entries(labels)){const el=document.getElementById(id);if(el)el.textContent=label;}
});
