/* Optional assistance over the existing editor. No separate quotation store or send API. */
const salesGuide={step:0,focused:false};
const salesSteps=[['clientDataSection','Cliente'],['eventConfigSection','Evento'],['quoteItemsSection','Itens'],['quoteCalcSection','Valores'],['quoteTermsSection','Revisão']];
function proposalQualityIssues(snapshot=null){
 const tariffAccepted = !snapshot && typeof getTariffApplication === 'function' && Boolean(getTariffApplication());
 if (!snapshot) snapshot={event:{date:fields.eventDate?.value,notes:fields.notes?.value},generalTerms:fields.generalTerms?.value,selectedItems:getSelectedItems()};
 const event=snapshot.event||{},terms=String(snapshot.generalTerms||'');
 const match=terms.match(/VALIDADE[^\r\n]*?(\d{2})\/(\d{2})\/(\d{4})/i),issues=[];
 if(match){const limit=`${match[3]}-${match[2]}-${match[1]}`,date=event.date||'';if(date&&date>limit&&!tariffAccepted)issues.push({id:'tariff_expired',label:'Vigência do tarifário',detail:`O evento está após ${match[1]}/${match[2]}/${match[3]}. Deseja aplicar a tabela atual a este evento? Confirme a aplicação ou cancele; os preços e a validade geral não serão alterados automaticamente.`,status:'error',target:'review'});}
 if(tariffAccepted){const application=getTariffApplication();issues.push({id:'tariff_applied',label:'Tarifário aplicado a esta data',detail:tariffApplicationNotice(application)+(application.kind==='request'?' Confirmação no editor; salve para registrar.':` Referência: ${String(application.catalog?.reference||'').slice(0,12)}.`),status:'ok',target:'review'});}
 const items=(snapshot.selectedItems||[]).map(i=>String(i.nome||i.name||'')).join(' ').toLocaleLowerCase('pt-BR'),notes=String(event.notes||'').toLocaleLowerCase('pt-BR');
 if(/almo[cç]o|lunch/.test(items)&&/full breakfast|caf[eé] da manh[aã]/.test(notes))issues.push({id:'scope_conflict',label:'Escopo a esclarecer',detail:'Os itens indicam almoço e as observações mencionam café da manhã. Confirme o serviço com o cliente antes de mobilizar a operação.',status:'warning',target:'notes'});
 return issues;
}
function consultativeText(value){
 if(Array.isArray(value))return value.map(consultativeText).filter(Boolean).join('; ');
 return typeof value==='string'?value.trim():typeof value==='number'&&Number.isFinite(value)?String(value):'';
}
function consultativeGuestCount(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;}
function consultativeMissing(model){
 return [['date','data desejada','preferred date'],['time','horário','time'],['guests','número de pessoas','number of guests']]
  .filter(([key])=>!consultativeText(model[key])||(key==='time'&&model.knownTime===false)||(key==='guests'&&(model.knownGuests===false||!consultativeGuestCount(model[key]))));
}
function buildConsultativeReply(model){
 const en=model.language==='en',tr=(pt,enText)=>en?enText:pt;
 const name=consultativeText(model.name).split(/\s+/)[0];
 const date=consultativeText(model.date),dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.split('-').reverse().join('/'):'';
 const context=[model.knownType===false?'':consultativeText(model.type),dateLabel,model.knownTime===false?'':consultativeText(model.time),model.knownGuests!==false&&consultativeGuestCount(model.guests)?`${model.guests} ${tr('pessoas','guests')}`:''].filter(Boolean).join(' · ');
 const details=[['reason','Objetivo','Purpose'],['preferences','Preferências','Preferences'],['extras','Pedidos especiais','Special requests']]
  .map(([key,pt,eng])=>consultativeText(model[key])?`${tr(pt,eng)}: ${consultativeText(model[key])}`:'').filter(Boolean);
 // Free/internal notes, payment records, costs and margins never enter this draft.
 const missing=consultativeMissing(model).slice(0,2).map(x=>en?x[2]:x[1]);
 const text=[tr(`Olá${name?', '+name:''}! Vamos construir uma proposta para o seu evento na Embaixada Carioca.`,`Hello${name?', '+name:''}! Let's put together a proposal for your event at Embaixada Carioca.`),
  context?tr(`Para alinharmos: ${context}.`,`To align on the details: ${context}.`):'',
  details.length?tr(`Estou considerando os seguintes pontos:\n${details.join('\n')}`,`I am taking these points into account:\n${details.join('\n')}`):'',
  tr('Vou conferir como atender às preferências e aos detalhes do evento. Se algum ponto precisar de adaptação, vamos combinar uma alternativa antes de fechar.','I will check how we can accommodate the preferences and event details. If anything needs adjusting, we will agree on an alternative before finalizing.'),
  missing.length?tr(`Para avançarmos, poderia confirmar ${missing.join(' e ')}?`,`To move forward, could you confirm the ${missing.join(' and ')}?`):tr('Esses dados estão de acordo com o que vocês planejam?','Do these details match what you have in mind?')].filter(Boolean).join('\n\n');
 if(text.length>12000)throw Error('Os detalhes excedem o tamanho do rascunho. Escreva uma resposta objetiva manualmente; o briefing original não foi alterado.');
 return text;
}
// An editor session survives persistence, but never switching/reopening an event.
let consultativeContextNumber=0;
function resetConsultativeEditor(){
 consultativeContextNumber++;
 consultativeTouches.key='';consultativeTouches.fields.clear();clearConsultativeDraft();
}
const consultativeTouches={key:'',fields:new Map()};
const consultativeDraft={key:'',fingerprint:'',text:'',edited:false,busy:false,generation:0,briefFingerprint:''};
function consultativeAccess(){
 return typeof state!=='undefined'&&Boolean(state.session?.user?.email)&&!document.body.classList.contains('auth-locked');
}
function getConsultativeBriefingConfirmation(){
 const model=getConsultativeModel();
 return {type:model.knownType,time:model.knownTime,guests:model.knownGuests};
}
function confirmConsultativeField(key,value){
 getConsultativeModel();
 consultativeTouches.fields.set(key,consultativeText(value));
}
function consultativeMeaning(model){
 const {key,revision,source,context,touchKey,user,proposalId,requestId,manualKey,...content}=model;
 return JSON.stringify(content);
}
function getConsultativeModel(){
 const p=getActiveProposal(),r=typeof getActiveQuoteRequest==='function'?getActiveQuoteRequest():null;
 const source=p?.snapshot||{},event=r?.snapshot?.evento||{};
 const overrides={...(typeof getCurrentSourceOverrides==='function'?getCurrentSourceOverrides():{}),...(typeof collectLiveSourcePanelValues==='function'?collectLiveSourcePanelValues({includeEmpty:true}):{})};
 const user=state.session?.user?.id||state.session?.user?.email;
 const identity=JSON.stringify([user,consultativeContextNumber]);
 const currentIdentity={key:identity,context:consultativeContextNumber,user,proposalId:state.activeProposalId||'',requestId:state.activeQuoteRequestId||'',manualKey:state.manualSourceKey||''};
 if(consultativeTouches.key!==identity){consultativeTouches.key=identity;consultativeTouches.fields.clear();}
 const normalize=(key,value)=>key==='guests'?String(consultativeGuestCount(value)||''):key==='time'?consultativeText(value).slice(0,5):consultativeText(value);
 const known=(key,value,requestValue,savedValue)=>{
  const current=normalize(key,value);if(!current)return false;
  if(consultativeTouches.fields.has(key))return normalize(key,consultativeTouches.fields.get(key))===current;
  const confirmation=source.briefingConfirmation;
  if(typeof confirmation?.[key]==='boolean')return confirmation[key]&&normalize(key,savedValue)===current;
  if(normalize(key,requestValue)===current)return true;
  // Legacy draft values have no provenance; saving alone was never confirmation.
  return Boolean(p&&(key==='type'||p.publication_status!=='draft')&&normalize(key,savedValue)===current);
 };
 const knownType=known('type',fields.eventType?.value,r?.tipo_evento||event.tipo,source.event?.type||p?.tipo_evento);
 const knownTime=known('time',fields.eventTime?.value,r?.horario_evento||event.horario,source.event?.time||p?.horario_evento);
 const knownGuests=known('guests',fields.guestCount?.value,r?.convidados||event.convidados,source.event?.guests||p?.convidados);
 const explicit=(key,fallback)=>Object.prototype.hasOwnProperty.call(overrides,key)?overrides[key]:fallback;
 return {name:fields.clientName?.value||'',type:fields.eventType?.value||'',date:fields.eventDate?.value||'',time:fields.eventTime?.value||'',guests:fields.guestCount?.value||'',
  reason:consultativeText(explicit('reason',fields.eventReason?.value||'')),preferences:consultativeText(explicit('preferences',r?.preferencias||event.preferencias||source.event?.preferences)),
  extras:consultativeText(explicit('extras',event.extras||source.event?.extras)),
  observations:consultativeText(explicit('observations',r?.observacoes||event.observacoes||source.event?.sourceNotes)),
  language:r?.snapshot?.cliente?.idioma||source.event?.clientLanguage||'pt',
  source:r||p?.solicitacao_id?'Solicitação vinculada':state.manualSourceKey==='manual:realized'?'Registro manual de evento realizado':'Cadastro manual pela equipe',
  ...currentIdentity,knownType,knownTime,knownGuests,
  revision:p?.revision||null,internalMarker:fields.notes?.value||''};
}
function consultativeFingerprint(model){return consultativeMeaning(model);}
function clearConsultativeDraft(key=''){
 consultativeDraft.key=key;consultativeDraft.fingerprint='';consultativeDraft.text='';consultativeDraft.edited=false;consultativeDraft.busy=false;consultativeDraft.generation++;consultativeDraft.briefFingerprint='';
 const text=document.getElementById('consultativeReply');if(text)text.value='';
 const preview=document.getElementById('consultativeBrief');if(preview)preview.replaceChildren();
 const status=document.getElementById('consultativeStatus');if(status)status.textContent='';
}
function consultativeMessage(text){const node=document.getElementById('consultativeStatus');if(node)node.textContent=text;}
function ensureConsultativePanel(nav){
 let panel=document.getElementById('consultativePanel');if(panel)return panel;
 panel=document.createElement('details');panel.id='consultativePanel';panel.className='consultative-panel';
 panel.innerHTML=`<summary>Atendimento consultivo e conclusão — opcional</summary>
 <p id="consultativeOrigin"></p><p>O formulário é uma porta de entrada, não uma exigência para a equipe. No manual, registre o que veio por telefone, WhatsApp, e-mail ou atendimento presencial nos mesmos campos.</p>
 <div class="consultative-actions"><a href="./formulario.html" target="_blank" rel="noopener">Abrir formulário do cliente</a><button type="button" class="secondary" data-consultative-action="new">Nova cotação manual</button><button type="button" class="secondary" data-consultative-action="history">Retomar proposta existente</button></div>
 <h3>Entendimento para revisar</h3><div id="consultativeBrief"></div>
 <p>Escolhas e pedidos são interesses a avaliar, não promessas confirmadas. Confira viabilidade, composição e custos antes de oferecer uma condição; custo desconhecido não é zero.</p>
 <div class="consultative-actions"><button type="button" class="secondary" data-consultative-action="details">Completar briefing e detalhes</button><button type="button" class="secondary" data-consultative-action="formats">Ver formatos e personalizar itens</button></div>
 <h3>Resposta de acolhimento</h3><p>Prepare uma sugestão ou escreva livremente. O texto fica somente nesta tela até ser copiado ou usado na primeira resposta; não é uma proposta aprovada nem um envio.</p>
 <div class="consultative-actions"><button type="button" class="secondary" data-consultative-action="suggest">Preparar sugestão editável</button><button type="button" class="secondary" data-consultative-action="write">Escrever manualmente</button></div>
 <label for="consultativeReply">Mensagem para revisar antes de usar</label><textarea id="consultativeReply" rows="6" maxlength="12000" placeholder="Escreva como prefere acolher o pedido e esclarecer o próximo passo."></textarea>
 <div class="consultative-actions"><button type="button" class="secondary" data-consultative-action="copy">Copiar texto revisado</button><button type="button" class="secondary" data-consultative-action="firstReply">Usar na primeira resposta</button><button type="button" class="secondary" data-consultative-action="recheck">Conferi meu texto com o briefing atual</button></div>
 <p id="consultativeStatus" role="status" aria-live="polite"></p>
 <h3>Avançar no mesmo evento</h3><div class="consultative-actions"><button type="button" class="secondary" data-consultative-action="draft">Salvar rascunho</button><button type="button" class="primary" data-consultative-action="review">Revisar e concluir envio</button><button type="button" class="secondary" data-consultative-action="close">Conferir fechamento e operação</button></div>
 <p>Rascunho não é envio. Contato manual só deve ser registrado depois de realizado. Fechamento, pagamentos e operação continuam exigindo suas conferências e autorizações.</p>`;
 nav.insertAdjacentElement('afterend',panel);
 if(!document.getElementById('consultativeStyles')){const style=document.createElement('style');style.id='consultativeStyles';style.textContent='.consultative-panel{margin:12px 0;padding:14px;border:1px solid currentColor;border-radius:12px;min-width:0;overflow-wrap:anywhere}.consultative-panel summary{cursor:pointer;font-weight:700}.consultative-panel p{line-height:1.5}.consultative-panel h3{margin:18px 0 8px}.consultative-panel textarea{width:100%;min-width:0;box-sizing:border-box}.consultative-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}.consultative-actions button,.sales-work-mode button{max-width:100%;white-space:normal}.consultative-brief-line{white-space:pre-wrap;margin:6px 0}.sales-work-mode{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.sales-work-mode [aria-pressed=true]{font-weight:800;text-decoration:underline}.consultative-panel[hidden],section.sales-step-hidden{display:none!important}';document.head.appendChild(style);}
 panel.addEventListener('click',e=>{e.stopPropagation();const button=e.target.closest('[data-consultative-action]');if(button)void runConsultativeAction(button.dataset.consultativeAction);});
 panel.querySelector('textarea').addEventListener('input',e=>{e.stopPropagation();consultativeDraft.text=e.target.value;consultativeDraft.edited=true;if(!consultativeDraft.fingerprint)consultativeDraft.fingerprint=consultativeFingerprint(getConsultativeModel());renderConsultativePanel();});
 return panel;
}
function renderConsultativePanel(){
 const nav=document.querySelector('.quote-section-nav');if(!nav)return;
 const panel=ensureConsultativePanel(nav);panel.hidden=!consultativeAccess();
 if(panel.hidden){clearConsultativeDraft();return;}
 const model=getConsultativeModel(),fingerprint=consultativeFingerprint(model);
 if(consultativeDraft.key!==model.key)clearConsultativeDraft(model.key);
 if(consultativeDraft.briefFingerprint!==fingerprint){
  consultativeDraft.briefFingerprint=fingerprint;document.getElementById('consultativeOrigin').textContent=`Origem do trabalho: ${model.source}. Alternar a forma de preencher não altera o vínculo ou o histórico.`;
  const brief=document.getElementById('consultativeBrief');brief.replaceChildren();
  const parts=[['Cliente',model.name],['Evento',[model.type,model.date,model.time+(model.knownTime?'':' (preenchimento inicial)'),model.guests?model.guests+' pessoas'+(model.knownGuests?'':' (preenchimento inicial)'):''].filter(Boolean).join(' · ')],['Objetivo',model.reason],['Preferências',model.preferences],['Pedidos especiais',model.extras],['Detalhes recebidos — conferir',model.observations]];
  for(const [label,value]of parts){if(!value)continue;const line=document.createElement('p');line.className='consultative-brief-line';const title=document.createElement('strong');title.textContent=label+': ';line.append(title,document.createTextNode(value));brief.appendChild(line);}
  const missing=consultativeMissing(model).map(x=>x[1]);const line=document.createElement('p');line.textContent=missing.length?'Ainda não preenchido: '+missing.join(', ')+'.':'Dados essenciais preenchidos na tela; confirme sua exatidão antes de enviar.';brief.appendChild(line);
 }
 const stale=Boolean(consultativeDraft.fingerprint&&consultativeDraft.fingerprint!==fingerprint);
 panel.querySelector('[data-consultative-action="copy"]').disabled=consultativeDraft.busy||stale||!consultativeDraft.text.trim();
 panel.querySelector('[data-consultative-action="firstReply"]').disabled=consultativeDraft.busy||stale||!consultativeDraft.text.trim()||!getActiveQuoteRequest()||Boolean(getActiveProposal());
 panel.querySelector('[data-consultative-action="recheck"]').hidden=!stale;
 if(stale)consultativeMessage('O briefing mudou. Seu texto foi preservado: revise, atualize a sugestão ou confirme a revisão antes de copiar.');
}
function revealConsultativeTarget(selector){
 salesGuide.focused=false;renderSalesGuide();const node=document.querySelector(selector);
 if(!node||node.hidden||node.classList.contains('is-hidden')){consultativeMessage('Abra ou salve a proposta e use as ações disponíveis no painel. Nenhum registro foi alterado.');return false;}
 node.scrollIntoView({block:'start',behavior:'smooth'});(node.matches('button,input,textarea,select')?node:node.querySelector('input:not([type="hidden"]),textarea,select,button'))?.focus({preventScroll:true});return true;
}
async function runConsultativeAction(action){
 if(!consultativeAccess()){clearConsultativeDraft();renderConsultativePanel();return;}
 renderConsultativePanel();const model=getConsultativeModel(),fingerprint=consultativeFingerprint(model);
 const area=document.getElementById('consultativeReply');
 if(action==='new'){document.getElementById('topbarNewProposalBtn')?.click();return;}
 if(action==='history'){revealConsultativeTarget('#historyList');return;}
 if(action==='details'){revealConsultativeTarget('#clientDataSection');return;}
 if(action==='formats'){activateSalesStep(1);return;}
 if(action==='review'){revealConsultativeTarget('#sendReviewPanel');return;}
 if(action==='close'){revealConsultativeTarget('#proposalNextStep');return;}
 if(action==='draft'){
  const button=document.getElementById('saveDraftBtn');if(button&&!button.disabled)button.click();
  else consultativeMessage('O salvamento está indisponível neste momento. Seu trabalho permanece no editor.');return;
 }
 if(action==='write'){area.focus();return;}
 if(action==='suggest'){
  if(consultativeDraft.edited&&consultativeDraft.text.trim()&&!window.confirm('Substituir o texto que você editou por uma nova sugestão? O briefing e a proposta não serão alterados.'))return;
  try{consultativeDraft.text=buildConsultativeReply(model);consultativeDraft.edited=false;consultativeDraft.fingerprint=fingerprint;area.value=consultativeDraft.text;consultativeMessage('Sugestão preparada para sua revisão. Nenhuma disponibilidade, preço ou pedido especial foi confirmado.');}catch(e){consultativeMessage(e.message);}
  renderConsultativePanel();area.focus();return;
 }
 if(action==='recheck'){consultativeDraft.fingerprint=fingerprint;consultativeMessage('Texto revisado por você para este briefing. Isso não aprova nem envia uma proposta.');renderConsultativePanel();return;}
 if(!['copy','firstReply'].includes(action)||consultativeDraft.busy||!consultativeDraft.text.trim()||consultativeDraft.fingerprint!==fingerprint)return;
 if(action==='firstReply'){
  const request=getActiveQuoteRequest();if(!request||getActiveProposal())return;
  if(state.firstReplyDraft&&state.firstReplyDraft!==consultativeDraft.text&&!window.confirm('Substituir a mensagem atual da primeira resposta pelo texto revisado?'))return;
  state.firstReplySourceId=request.id;state.firstReplyDraft=consultativeDraft.text;state.firstReplyChannel='';renderFirstReplyPanel();
  revealConsultativeTarget('#firstReplyPanel');consultativeMessage('Texto colocado na primeira resposta. Envie pelo canal escolhido e registre o contato somente depois de realizado.');return;
 }
 const generation=consultativeDraft.generation,key=model.key,copiedText=consultativeDraft.text,copiedFingerprint=fingerprint;consultativeDraft.busy=true;renderConsultativePanel();
 try{
  if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
  await navigator.clipboard.writeText(copiedText);
  if(consultativeAccess()&&generation===consultativeDraft.generation&&getConsultativeModel().key===key)consultativeMessage(consultativeDraft.text!==copiedText||consultativeFingerprint(getConsultativeModel())!==copiedFingerprint?'Foi copiada a versão anterior ao último ajuste. Revise e copie novamente o texto atual; nada foi enviado.':'Texto copiado. Nenhuma mensagem foi enviada e nenhum contato foi registrado.');
 }catch{
  if(consultativeAccess()&&generation===consultativeDraft.generation&&getConsultativeModel().key===key){consultativeMessage('A cópia automática não foi permitida. Selecione o texto e copie manualmente.');area.focus();area.select();}
 }finally{if(generation===consultativeDraft.generation){consultativeDraft.busy=false;renderConsultativePanel();}}
}
function renderSalesGuide(){
 const nav=document.querySelector('.quote-section-nav');if(!nav)return;
 nav.classList.add('sales-step-guide');nav.setAttribute('aria-label','Etapas da proposta');
 const guideState=JSON.stringify([salesGuide.step,salesGuide.focused]);
 if(nav.dataset.guideState!==guideState){nav.dataset.guideState=guideState;nav.innerHTML=`<div class="sales-work-mode" role="group" aria-label="Forma de preencher"><button type="button" class="secondary" data-sales-mode="manual" aria-pressed="${!salesGuide.focused}">Manual — todos os campos</button><button type="button" class="secondary" data-sales-mode="guided" aria-pressed="${salesGuide.focused}">Assistido — por etapas</button></div><div class="sales-step-buttons">${salesSteps.map(([id,label],i)=>`<button class="secondary" type="button" data-sales-step="${i}" aria-current="${salesGuide.step===i?'step':'false'}">${i+1}. ${label}</button>`).join('')}</div><div class="sales-guide-controls"><label><input type="checkbox" data-sales-focus ${salesGuide.focused?'checked':''}/> Focar nesta etapa</label><button type="button" class="primary" data-sales-next>${salesGuide.step<salesSteps.length-1?'Continuar: '+salesSteps[salesGuide.step+1][1]:'Revisar proposta para envio'}</button></div><p class="sales-quality-message" role="status"></p>`;}
 const status=nav.querySelector('.sales-quality-message');if(status)status.textContent=proposalQualityIssues().map(i=>i.detail).join(' ')||'Preencha em qualquer ordem ou use a orientação. O cadastro manual não exige formulário; ambos passam pela mesma revisão antes do envio.';
 if(status&&typeof tariffApplicationNeeded==='function'&&tariffApplicationNeeded()){const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.tariffConfirm='';button.textContent='Aplicar tabela atual a esta data';status.append(' ',button);}
 salesSteps.forEach(([id],i)=>{const n=document.getElementById(id);if(n)n.classList.toggle('sales-step-hidden',salesGuide.focused&&i!==salesGuide.step);});
 renderConsultativePanel();
}
function activateSalesStep(index){const value=Number(index);salesGuide.step=Number.isFinite(value)?Math.max(0,Math.min(salesSteps.length-1,Math.trunc(value))):0;renderSalesGuide();const section=document.getElementById(salesSteps[salesGuide.step][0]);section?.scrollIntoView({block:'start',behavior:'smooth'});section?.querySelector('input:not([type="hidden"]),select,textarea,button')?.focus({preventScroll:true});}
const salesNav=document.querySelector('.quote-section-nav');
salesNav?.addEventListener('click',e=>{
 if(e.target.closest('[data-tariff-confirm]')){ensureTariffApplicationConfirmed();return;}
 const mode=e.target.closest('[data-sales-mode]');if(mode){salesGuide.focused=mode.dataset.salesMode==='guided';renderSalesGuide();return;}
 const step=e.target.closest('[data-sales-step]');if(step){activateSalesStep(step.dataset.salesStep);return;}
 if(e.target.closest('[data-sales-next]')){if(salesGuide.step<salesSteps.length-1)activateSalesStep(salesGuide.step+1);else revealConsultativeTarget('#sendReviewPanel');}
});
salesNav?.addEventListener('change',e=>{if(e.target.matches('[data-sales-focus]')){salesGuide.focused=e.target.checked;renderSalesGuide();}});
let consultativeRefreshPending=false;
function trackConsultativeInput(e){
 if(e.target.matches('[data-sales-focus]')){salesGuide.focused=e.target.checked;renderSalesGuide();return;}
 if(!consultativeAccess()||e.target.closest('#consultativePanel'))return;
 getConsultativeModel();
 if(e.target===fields.eventTime||e.target===fields.eventDateTime)confirmConsultativeField('time',e.target===fields.eventDateTime&&!e.target.value?'':fields.eventTime?.value);
 if(e.target===fields.eventType)confirmConsultativeField('type',fields.eventType?.value);
 if(e.target===fields.guestCount)confirmConsultativeField('guests',fields.guestCount?.value);
 queueConsultativeRefresh();
}
function queueConsultativeRefresh(){if(consultativeRefreshPending)return;consultativeRefreshPending=true;queueMicrotask(()=>{consultativeRefreshPending=false;renderSalesGuide();});}
document.querySelector('#quoteForm')?.addEventListener('change',trackConsultativeInput);
document.querySelector('#quoteForm')?.addEventListener('input',trackConsultativeInput);
// Existing renders also run when opening a record or changing authentication;
// observe their output instead of wrapping save/send/approval functions.
if(salesNav&&typeof MutationObserver!=='undefined'){
 const observer=new MutationObserver(queueConsultativeRefresh);
 for(const id of ['proposalContent','formSourcePanel']){const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});}
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
}
renderSalesGuide();
