/* Progressive disclosure is optional and does not replace the reviewed commercial editor. */
const salesGuide={step:0,focused:false};
const salesSteps=[['clientDataSection','Cliente'],['eventConfigSection','Evento'],['quoteItemsSection','Itens'],['quoteCalcSection','Valores'],['quoteTermsSection','Revisão']];
function proposalQualityIssues(snapshot=null){
 if (!snapshot) snapshot={event:{date:fields.eventDate?.value,notes:fields.notes?.value},generalTerms:fields.generalTerms?.value,selectedItems:getSelectedItems()};
 const event=snapshot.event||{},terms=String(snapshot.generalTerms||'');
 const match=terms.match(/VALIDADE[^\r\n]*?(\d{2})\/(\d{2})\/(\d{4})/i),issues=[];
 if(match){const limit=`${match[3]}-${match[2]}-${match[1]}`,date=event.date||'';if(date&&date>limit)issues.push({id:'tariff_expired',label:'Vigência do tarifário',detail:`O evento está após ${match[1]}/${match[2]}/${match[3]}. Revise as condições antes de enviar; o sistema não atualiza preços ou validade automaticamente.`,status:'error',target:'review'});}
 const items=(snapshot.selectedItems||[]).map(i=>String(i.nome||i.name||'')).join(' ').toLocaleLowerCase('pt-BR'),notes=String(event.notes||'').toLocaleLowerCase('pt-BR');
 if(/almo[cç]o|lunch/.test(items)&&/full breakfast|caf[eé] da manh[aã]/.test(notes))issues.push({id:'scope_conflict',label:'Escopo a esclarecer',detail:'Os itens indicam almoço e as observações mencionam café da manhã. Confirme o serviço com o cliente antes de mobilizar a operação.',status:'warning',target:'notes'});
 return issues;
}
function renderSalesGuide(){
 const nav=document.querySelector('.quote-section-nav');if(!nav)return;
 nav.classList.add('sales-step-guide');nav.setAttribute('aria-label','Etapas da proposta');
 const guideState=JSON.stringify([salesGuide.step,salesGuide.focused]);
 if(nav.dataset.guideState!==guideState){nav.dataset.guideState=guideState;nav.innerHTML=`<div class="sales-step-buttons">${salesSteps.map(([id,label],i)=>`<button class="secondary" type="button" data-sales-step="${i}" aria-current="${salesGuide.step===i?'step':'false'}">${i+1}. ${label}</button>`).join('')}</div><div class="sales-guide-controls"><label><input type="checkbox" data-sales-focus ${salesGuide.focused?'checked':''}/> Focar nesta etapa</label><button type="button" class="primary" data-sales-next>${salesGuide.step<salesSteps.length-1?'Continuar: '+salesSteps[salesGuide.step+1][1]:'Revisar proposta para envio'}</button></div><p class="sales-quality-message" role="status">${proposalQualityIssues().map(i=>escapeHtml(i.detail)).join(' ')||'Preencha os dados essenciais, escolha os itens e revise antes de enviar.'}</p>`;}
 const status=nav.querySelector('.sales-quality-message');if(status)status.textContent=proposalQualityIssues().map(i=>i.detail).join(' ')||'Preencha os dados essenciais, escolha os itens e revise antes de enviar.';
 salesSteps.forEach(([id],i)=>{const n=document.getElementById(id);if(n)n.classList.toggle('sales-step-hidden',salesGuide.focused&&i!==salesGuide.step);});
}
function activateSalesStep(index){salesGuide.step=Math.max(0,Math.min(salesSteps.length-1,Number(index)));renderSalesGuide();const section=document.getElementById(salesSteps[salesGuide.step][0]);section?.scrollIntoView({block:'start',behavior:'smooth'});section?.querySelector('input:not([type="hidden"]),select,textarea,button')?.focus({preventScroll:true});}
const salesNav=document.querySelector('.quote-section-nav');
salesNav?.addEventListener('click',e=>{const step=e.target.closest('[data-sales-step]');if(step){activateSalesStep(step.dataset.salesStep);return;}if(e.target.closest('[data-sales-next]')){if(salesGuide.step<salesSteps.length-1)activateSalesStep(salesGuide.step+1);else{salesGuide.focused=false;renderSalesGuide();nodes.sendReviewPanel?.scrollIntoView({block:'start'});}}});
salesNav?.addEventListener('change',e=>{if(e.target.matches('[data-sales-focus]')){salesGuide.focused=e.target.checked;renderSalesGuide();}});
document.querySelector('#quoteForm')?.addEventListener('change',()=>renderSalesGuide());
renderSalesGuide();
