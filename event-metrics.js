/* Read-only cohort reporting; no individual customer values leave the database. */
const eventCohort={client:null,user:null,data:null,error:'',pending:null,attemptedAt:0};
function cohortCurrent(c){return eventCohort.client===c&&state.supabase===c&&eventCohort.user===state.session?.user?.id;}
async function loadEventCohort({force=false}={}){
 if(!state.session||!state.supabase)return;
 const client=state.supabase,user=state.session.user.id;
 if(eventCohort.client!==client||eventCohort.user!==user)Object.assign(eventCohort,{client,user,data:null,error:'',pending:null,attemptedAt:0});
 if(eventCohort.pending||!force&&Date.now()-eventCohort.attemptedAt<30000)return;
 eventCohort.attemptedAt=Date.now();eventCohort.error='';
 const to=EventWorkspace.dateKey(),from=EventWorkspace.addDate(to,-89);
 eventCohort.pending=Promise.resolve().then(async()=>{try{
  if(QA_MODE){eventCohort.data={total:0,mature:0,pending_window:0,prepared:0,dispatched:0,delivered:0,replied:0,paid:0,conversion:null,from,to,decision_days:30,generated_at:new Date().toISOString()};return;}
  const r=await readinessAwait(client.rpc('event_sales_cohort',{from_date:from,to_date:to,decision_days:30}));if(!cohortCurrent(client))return;
  if(r.error||!Number.isInteger(r.data?.mature)||!Number.isInteger(r.data?.total)||r.data?.decision_days!==30)throw Error(r.error?.message||'Relatório indisponível.');eventCohort.data=r.data;
 }catch(error){if(cohortCurrent(client)){eventCohort.data=null;eventCohort.error=error.message;}}
 finally{if(cohortCurrent(client)){eventCohort.pending=null;renderEventOperations();}}});return eventCohort.pending;
}
function renderOpsMetrics(){
 if(eventCohort.client!==state.supabase||eventCohort.user!==state.session?.user?.id)Object.assign(eventCohort,{client:state.supabase,user:state.session?.user?.id,data:null,error:'',pending:null,attemptedAt:0});
 if(!eventCohort.attemptedAt)queueMicrotask(()=>loadEventCohort());const d=eventCohort.data;
 return `<section aria-label="Conversão com evidências"><h3>Conversão por oportunidade</h3><p>Entrada no sistema nos últimos 90 dias · janela de decisão de 30 dias. Cada oportunidade conta uma vez. Coortes recentes aguardam a janela completa.</p><button type="button" class="secondary" data-cohort-refresh>Atualizar resultados</button>${eventCohort.error?`<p role="alert">${escapeHtml(eventCohort.error)}</p>`:''}${d?`<p>${d.total} entradas · ${d.mature} com janela completa · ${d.pending_window} ainda em observação. ${QA_MODE?'Demonstração sem dados reais.':''}</p><div class="event-ops-metrics">${[['Preparadas',d.prepared],['Envio aceito',d.dispatched],['Entrega comprovada',d.delivered],['Resposta autenticada',d.replied],['Sinal auditado',d.paid],['Conversão auditada',d.conversion===null?'Aguardando coorte madura':d.conversion.toLocaleString('pt-BR')+'%']].map(([k,v])=>`<span>${escapeHtml(k)}<strong>${escapeHtml(String(v))}</strong></span>`).join('')}</div><p>Os marcos podem ocorrer por canais diferentes; estes totais não formam uma sequência obrigatória. Perdas permanecem no denominador. Registros marcados como teste são excluídos. Sem auditoria, um sinal antigo não entra como venda comprovada.</p><small>Consulta: ${escapeHtml(formatSavedAt(d.generated_at))}. Esta medição não demonstra ganho causado por uma melhoria.</small>`:'<p>Consultando as evidências…</p>'}</section>`;
}
document.querySelector('#eventOperations')?.addEventListener('click',e=>{if(e.target.closest('[data-cohort-refresh]'))void loadEventCohort({force:true});});
