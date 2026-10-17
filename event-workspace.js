/* Shared operational projections. Dates are always interpreted in Brasília. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EventWorkspace=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const booked=new Set(['confirmado','pagamento_final','planejamento','evento_proximo']);
 function dateKey(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(value));}
 function addDate(value,days){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
 function progress(tasks=[]){return {done:tasks.filter(t=>t.status==='done'&&t.acknowledged_at&&t.acknowledged_by&&t.completed_at&&t.completed_by).length,total:tasks.length};}
 function agenda(proposals,handoffs=[],tasks=[],{now=new Date(),range='30',sector='',query=''}={}){
  const today=dateKey(now),end=range==='all'?'9999-12-31':addDate(today,range==='today'?0:Number(range)-1);
  return proposals.filter(p=>p.is_current!==false&&!p.snapshot?.amendmentOf&&booked.has(p.status)&&p.data_evento>=today&&p.data_evento<=end)
   .map(p=>{const h=handoffs.find(h=>h.opportunity_id===p.oportunidade_id&&h.proposal_id===p.id);const current=h?tasks.filter(t=>t.opportunity_id===p.oportunidade_id&&Number(t.source_version)===Number(h.version)):[];return {proposal:p,handoff:h,tasks:current,progress:progress(current),overdue:current.filter(t=>t.status!=='done'&&t.due_at&&new Date(t.due_at)<now).length};})
   .filter(row=>(!sector||row.tasks.some(t=>t.sector===sector))&&(!query||String(row.proposal.cliente_nome||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))))
   .sort((a,b)=>(a.proposal.data_evento+' '+a.proposal.horario_evento).localeCompare(b.proposal.data_evento+' '+b.proposal.horario_evento)||String(a.proposal.id).localeCompare(String(b.proposal.id)));
 }
 return {dateKey,addDate,progress,agenda};
});
