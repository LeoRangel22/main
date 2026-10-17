(function(root){
 'use strict';
 const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
 const text=v=>Array.isArray(v)?v.map(text).join('\n'):v&&typeof v==='object'?Object.entries(v).map(([k,x])=>`${k}: ${text(x)}`).join('\n'):String(v??'');
 const labels={pending_manager:'Aguardando gestor',awaiting_client:'Aguardando aceite do cliente',client_accepted:'Cliente aceitou · aplicação pendente',changes_requested:'Ajustes solicitados',rejected:'Recusado pelo gestor',withdrawn:'Solicitação retirada',applied:'Aditivo aplicado'};
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):'Data não informada';
 const at=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília)':'Ainda não registrado';
 function compare(before={},after={}){
  const fields=[['client','Cliente'],['type','Formato'],['date','Data'],['time','Horário (Brasília)'],['guests','Convidados'],['duration','Duração (horas)'],['subtotal','Subtotal'],['service','Taxa de serviço'],['private','Privatização'],['total','Total']];
  return `<div class="comparison-table"><table><caption>Comparação do acordo</caption><thead><tr><th scope="col">Condição</th><th scope="col">Acordo vigente</th><th scope="col">Alteração proposta</th></tr></thead><tbody>${fields.map(([key,label])=>{const format=v=>['subtotal','service','private','total'].includes(key)?money(v):key==='date'?date(v):key==='time'?String(v||'').slice(0,5):String(v??'Não informado');const changed=String(before[key]??'')!==String(after[key]??'');return `<tr${changed?' class="changed"':''}><th scope="row">${esc(label)}${changed?'<small>Alterado</small>':''}</th><td>${esc(format(before[key]))}</td><td>${esc(format(after[key]))}</td></tr>`;}).join('')}</tbody></table></div><div class="agreement-grid">${[[before,'Acordo vigente'],[after,'Alteração proposta']].map(([p,title])=>`<section class="agreement"><h3>${title} · versão ${esc(p.version)}</h3><h4>Itens e serviços</h4><ul>${(Array.isArray(p.items)?p.items:[]).map(i=>`<li><strong>${esc(i.name||i.nome||'Item')} · ${esc(money(i.calc?.total??i.total))}</strong><p>${esc(i.description||i.descricao||'')}</p><small>${esc(i.calc?.detail||i.calc?.label||'')}</small></li>`).join('')||'<li>Itens não informados</li>'}</ul><h4>Condições gerais</h4><p class="terms">${esc(text(p.terms))||'Não informadas'}</p><h4>Condições de pagamento</h4><p class="terms">${esc(text(p.payment_terms))||'Não informadas'}</p></section>`).join('')}</div>`;
 }
 const api={esc,money,text,labels,date,at,compare};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.AmendmentUI=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
