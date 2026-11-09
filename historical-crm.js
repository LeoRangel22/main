(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EventCrmHistory = api;
})(typeof window === "undefined" ? null : window, function (window) {
  "use strict";
  const kinds = { organization:"Contas", contact:"Contatos", event:"Eventos documentados", case:"Conversas", action:"Oportunidades de retomada" };
  const phases = { realizado_comprovado:"Realização comprovada", reserva_documentada:"Reserva documentada",
    contratado_documentado:"Contratação documentada", orcamento_documentado:"Orçamento documentado",
    cotacao_documentada:"Cotação documentada", negociacao_documentada:"Negociação documentada",
    nao_comprovado:"Não comprovado", desconhecido:"Desconhecido", a_revisar:"A revisar" };
  const labels = {
    name:"Nome", title:"Identificação", domain:"Domínio", segment:"Segmento",
    legal_name_reported:"Razão social informada", trade_name_reported:"Nome comercial informado",
    classification_basis:"Base da classificação", legal_details_basis:"Origem dos dados da empresa",
    customer_status:"Relacionamento", email:"E-mail", company_reported:"Empresa informada",
    organization_name:"Conta relacionada", contact_kind:"Tipo de contato", phones:"Telefones identificados",
    first_contact_at:"Primeiro contato registrado", last_contact_at:"Último contato registrado",
    last_contact_basis:"Origem do último contato", languages:"Idiomas", historical_roles:"Responsáveis históricos",
    current_owner:"Responsável atual", current_owner_basis:"Origem do responsável atual",
    marketing_permission:"Permissão de contato comercial", opt_out:"Solicitação de não contato",
    revalidation_required:"Contato precisa de atualização", relationship_qualification:"Qualificação",
    contacts_identified:"Contatos identificados", negotiation_threads:"Conversas identificadas",
    documented_events:"Eventos e reservas documentados", realized_events_identified:"Realizações comprovadas",
    realized_success_identified:"Avaliações positivas comprovadas", invoiced_documented_brl:"Valor fiscal documentado",
    contracted_documented_brl:"Valor contratado documentado", amount_scope:"Cobertura dos valores",
    value_coverage_events:"Eventos com informação de valor", has_global_history_complete:"Histórico completo",
    agency:"Agência", end_client:"Cliente final", booking_ref:"Referência do grupo", booking_refs:"Referências mencionadas",
    event_date:"Data do evento", event_date_planned:"Data planejada", event_date_raw:"Data na fonte",
    event_date_candidates:"Datas em conflito", event_date_confidence:"Situação da data", event_time:"Horário",
    duration_hours:"Duração em horas", event_type:"Tipo de evento", guests_planned:"Convidados planejados",
    guides_planned:"Guias planejados", guests_billed:"Pessoas faturadas", guests_actual:"Presença comprovada",
    unit_brl:"Preço unitário documentado", invoiced_brl:"Valor fiscal documentado",
    quoted_documented_brl:"Valor orçado documentado", payment_claimed_brl:"Pagamento informado na fonte",
    currency:"Moeda", phase:"Situação documentada", success:"Avaliação do resultado", post_sale:"Pós-venda",
    responsible_historical:"Responsáveis históricos", last_document_at:"Último documento",
    notes:"Observações", value_basis:"Base do valor", signature_status:"Situação da assinatura",
    current_contact_reported:"Contato atual informado", language_required:"Idioma solicitado",
    related_parties:"Partes envolvidas", category:"Classificação da conversa", message_count:"Mensagens",
    dates_mentioned:"Datas mencionadas", pax_mentioned:"Quantidades mencionadas", event_types:"Formatos mencionados",
    historical_team_mentioned:"Equipe mencionada", signals:"Sinais identificados", outcome:"Desfecho",
    review_required:"Revisão necessária", organization:"Conta", priority:"Prioridade", reasons:"Motivos",
    next_action:"Próxima ação recomendada", post_sale_review_required:"Revisar pós-venda",
    automatic_contact_authorized:"Contato automático autorizado", conversion_probability:"Probabilidade validada",
    kind:"Tipo", raw:"Informação original", digits:"Número", context:"Contexto", attribution:"Atribuição",
    also_seen_on_contacts:"Compartilhado com outros contatos", data:"Informação extraída", assessment:"Classificação",
    amount_brl:"Valor documentado", date:"Data", guests:"Pessoas", amount:"Valor", reason:"Motivo",
    status:"Situação", text:"Trecho", type:"Tipo", value:"Informação", confidence:"Confiança", evidence:"Evidência"
  };
  const hidden = new Set(["id","thread_id","organization_id","organization_domain","contact_ids","document_ids",
    "source_ids","source_id","case_id","payment_document_ids","observations","source_count"]);
  function formatDate(value) {
    if (!value) return "Não informado";
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (dateOnly) return dateOnly[3]+"/"+dateOnly[2]+"/"+dateOnly[1];
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat("pt-BR", {
      timeZone:"America/Sao_Paulo", dateStyle:"short", timeStyle:"short"
    }).format(d);
  }
  function formatMoney(value) {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "Não informado";
    return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value));
  }
  function formatValue(value, key) {
    if (value === null || value === undefined || value === "") return "Não informado";
    if (/_brl$/.test(key)) return formatMoney(value);
    if (/(?:_at|_date)$/.test(key) || key === "date") return formatDate(value);
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (Array.isArray(value)) return value.length ? value.map(v=>formatValue(v,key)).join(" · ") : "Não informado";
    if (typeof value === "object") return Object.entries(value).filter(([k])=>!hidden.has(k))
      .map(([k,v])=>(labels[k]||k.replaceAll("_"," "))+": "+formatValue(v,k)).join("; ") || "Não informado";
    return phases[value] || (["phase","success","category","priority","contact_kind","outcome","assessment","customer_status","relationship_qualification","signature_status","event_date_confidence","attribution"].includes(key) ? String(value).replaceAll("_"," ") : String(value));
  }
  function params(state, extra) {
    return Object.assign({p_kind:state.kind,p_query:state.query,p_sort:state.sort,p_limit:20,
      p_offset:state.offset,p_record_id:null,p_organization_id:state.organization?.id||null},extra);
  }
  function createController(root, doc) {
    const byId = id=>doc.getElementById(id);
    const nodes = { form:byId("crmHistoryForm"), search:byId("crmHistorySearch"), kind:byId("crmHistoryKind"),
      sort:byId("crmHistorySort"), list:byId("crmHistoryResults"), status:byId("crmHistoryStatus"),
      stats:byId("crmHistoryStats"), period:byId("crmHistoryPeriod"), prev:byId("crmHistoryPrevious"),
      next:byId("crmHistoryNext"), page:byId("crmHistoryPage"), refresh:byId("crmHistoryRefresh"),
      scope:byId("crmHistoryScope"), scopeName:byId("crmHistoryScopeName"), clearScope:byId("crmHistoryClearScope"),
      dialog:byId("crmHistoryDialog"), detail:byId("crmHistoryDetail"), detailTitle:byId("crmHistoryDetailTitle"),
      close:byId("crmHistoryClose") };
    let client=null, identity=null, generation=0, request=0, detailRequest=0, timer=null;
    let listAbort=null, detailAbort=null;
    const state={kind:"organization",query:"",sort:"recent",offset:0,organization:null,total:0,selected:null,sourceOffset:0};
    function element(tag,text,className) {
      const n=doc.createElement(tag); if(text!==null&&text!==undefined)n.textContent=String(text);
      if(className)n.className=className; return n;
    }
    function line(parent,label,value) {
      const row=element("p",null,"crm-history-line"); row.append(element("strong",label+" "),element("span",value));parent.append(row);
    }
    function button(text,fn) { const n=element("button",text,"secondary");n.type="button";n.addEventListener("click",fn);return n; }
    function status(text,error) { nodes.status.textContent=text; nodes.status.classList.toggle("crm-history-error",Boolean(error)); }
    function loading(on) { root.setAttribute("aria-busy",String(on));nodes.refresh.disabled=on;nodes.prev.disabled=on||state.offset===0;nodes.next.disabled=on||state.offset+20>=state.total; }
    function clear() {
      generation++;request++;detailRequest++;if(timer)window.clearTimeout(timer);timer=null;
      listAbort?.abort();detailAbort?.abort();listAbort=null;detailAbort=null;
      state.selected=null;state.organization=null;state.query="";state.offset=0;state.total=0;
      nodes.search.value="";nodes.scope.hidden=true;nodes.scopeName.textContent="";nodes.period.textContent="";
      const historyLink=byId("clientHistoryLink");if(historyLink)historyLink.hidden=true;
      nodes.list.replaceChildren();nodes.stats.replaceChildren();nodes.detail.replaceChildren();nodes.detailTitle.textContent="";
      nodes.page.textContent="";nodes.status.textContent="";root.hidden=true;
      if(nodes.dialog.open)nodes.dialog.close();
    }
    async function call(extra, signal) {
      let q=client.rpc("event_crm_history",params(state,extra));
      if(signal&&typeof q.abortSignal==="function")q=q.abortSignal(signal);
      const response=await q;
      if(response.error)throw response.error;
      if(!response.data||typeof response.data!=="object")throw Error("HISTORY_UNAVAILABLE");
      return response.data;
    }
    function stats(data) {
      nodes.stats.replaceChildren();
      for(const [key,label]of [["organization","Contas"],["contact","Contatos"],["event","Eventos e reservas"],["realized","Realizações comprovadas"]]){
        const box=element("div",null,"crm-history-stat");box.append(element("dt",label),element("dd",data.summary?.[key]??0));nodes.stats.append(box);
      }
      nodes.period.textContent=data.period_start&&data.period_end?"Fontes de "+formatDate(data.period_start)+" a "+formatDate(data.period_end):"";
    }
    function scopeTo(record,kind) {
      state.organization={id:record.id,name:record.name};state.kind=kind;state.query="";state.offset=0;
      nodes.kind.value=kind;nodes.search.value="";nodes.scopeName.textContent=record.name;nodes.scope.hidden=false;
      updateSort();nodes.dialog.close();load();
    }
    function card(record) {
      const article=element("article",null,"crm-history-card");
      article.append(element("h3",record.name||record.title||record.organization||record.email||"Registro histórico"));
      const kind=state.kind;
      if(kind==="organization"){
        line(article,"Segmento:",record.segment||"A confirmar");
        if(record.domain)line(article,"Domínio:",record.domain);
        line(article,"Realizações comprovadas:",record.realized_events_identified??0);
        line(article,"Eventos e reservas documentados:",record.documented_events??0);
        if(record.invoiced_documented_brl!==null&&record.invoiced_documented_brl!==undefined)
          line(article,"Valor fiscal documentado:",formatMoney(record.invoiced_documented_brl));
      }else if(kind==="contact"){
        line(article,"Conta:",record.organization_name||record.company_reported||"A confirmar");
        line(article,"E-mail:",record.email||"Não informado");
        const phones=(record.phones||[]).slice(0,2).map(p=>p.raw||p.digits).filter(Boolean).join(" · ");
        if(phones)line(article,"Telefone identificado:",phones);
        if(record.revalidation_required)article.append(element("span","Conferir contato","crm-history-tag"));
      }else if(kind==="event"){
        article.append(element("span",formatValue(record.phase,"phase"),"crm-history-tag"));
        line(article,"Data:",formatDate(record.event_date));
        line(article,"Formato:",record.event_type||"Não informado");
        line(article,"Convidados planejados:",record.guests_planned??"Não informado");
        if(record.guests_billed!==null&&record.guests_billed!==undefined&&record.guests_billed!==record.guests_planned)
          line(article,"Pessoas faturadas:",record.guests_billed);
        for(const [key,label]of [["invoiced_brl","Valor fiscal:"],["contracted_documented_brl","Valor contratado:"],["quoted_documented_brl","Valor orçado:"]]){
          if(record[key]!==null&&record[key]!==undefined){line(article,label,formatMoney(record[key]));break;}
        }
      }else if(kind==="case"){
        line(article,"Mensagens:",record.message_count??"Não informado");
        line(article,"Desfecho:",formatValue(record.outcome,"outcome"));
        if(record.event_types?.length)line(article,"Formatos mencionados:",record.event_types.join(" · "));
      }else{
        article.append(element("span","Prioridade "+formatValue(record.priority,"priority"),"crm-history-tag"));
        article.append(element("p",record.next_action||"Revisar relacionamento"));
        if(record.post_sale_review_required)article.append(element("span","Revisar pós-venda","crm-history-tag"));
      }
      line(article,"Último registro:",formatDate(record.last_contact_at||record.last_document_at));
      article.append(button("Ver histórico e fontes",()=>openRecord(record.id)));
      return article;
    }
    async function load() {
      if(!client||!identity)return;
      const g=generation,n=++request;listAbort?.abort();listAbort=new AbortController();
      loading(true);status("Consultando histórico…");nodes.list.replaceChildren();
      try{
        const data=await call(null,listAbort.signal);
        if(g!==generation||n!==request)return;
        if(!data.available){state.total=0;status("Nenhuma base histórica validada disponível.");stats({summary:{}});return;}
        stats(data);state.total=Number(data.total)||0;
        const records=Array.isArray(data.records)?data.records:[];
        nodes.list.replaceChildren(...records.map(card));
        if(!records.length)nodes.list.append(element("p","Nenhum registro encontrado com estes filtros."));
        nodes.page.textContent=state.total?(state.offset+1)+"–"+Math.min(state.offset+20,state.total)+" de "+state.total:"0 registros";
        status(state.total+" registro(s) encontrado(s).");
      }catch(e){
        if(g!==generation||n!==request)return;
        state.total=0;nodes.page.textContent="";
        status(e.code==="42501"||e.status===401?"Entre novamente com a sessão Master para consultar o histórico.":"Não foi possível consultar o histórico. Tente atualizar.",true);
      }finally{if(g===generation&&n===request)loading(false);}
    }
    function renderSources(data) {
      const area=element("section",null,"crm-history-sources");area.append(element("h3","Fontes do registro"));
      const sources=Array.isArray(data.sources)?data.sources:[];
      area.append(element("p",data.source_total?(data.offset+1)+"–"+Math.min(data.offset+data.limit,data.source_total)+" de "+data.source_total+" fontes":"Nenhuma fonte indexada para este registro."));
      for(const source of sources){
        const item=element("article",null,"crm-history-source");
        item.append(element("strong",source.subject||"Documento de origem"));
        line(item,"Origem:",source.kind==="email"?"E-mail":source.format||"Documento");
        if(source.occurred_at)line(item,"Data:",formatDate(source.occurred_at));
        if(source.from_email)line(item,"Remetente:",source.from_email);
        if(source.message_id){
          const d=element("details");d.append(element("summary","Identificador do e-mail"),element("p",source.message_id));item.append(d);
        }
        area.append(item);
      }
      if(data.source_total>data.limit){
        const nav=element("div",null,"crm-history-pager");
        const back=button("Fontes anteriores",()=>openRecord(state.selected.id,Math.max(0,state.sourceOffset-20)));
        back.disabled=state.sourceOffset===0;
        const next=button("Próximas fontes",()=>openRecord(state.selected.id,state.sourceOffset+20));
        next.disabled=state.sourceOffset+data.limit>=data.source_total;
        nav.append(back,next);area.append(nav);
      }
      return area;
    }
    async function openRecord(id,offset) {
      if(!identity||!client)return;
      state.selected={id,kind:state.kind};state.sourceOffset=offset||0;
      const g=generation,n=++detailRequest,kind=state.kind;
      detailAbort?.abort();detailAbort=new AbortController();nodes.detail.replaceChildren(element("p","Consultando registro…"));
      nodes.detailTitle.textContent="Histórico e fontes";
      if(!nodes.dialog.open)nodes.dialog.showModal();
      try{
        const data=await call({p_kind:kind,p_record_id:id,p_offset:state.sourceOffset,p_limit:20},detailAbort.signal);
        if(g!==generation||n!==detailRequest||!nodes.dialog.open)return;
        const record=data.record;
        if(!record)throw Error("RECORD_UNAVAILABLE");
        nodes.detailTitle.textContent=record.name||record.title||record.organization||record.email||"Registro histórico";
        const dl=element("dl",null,"crm-history-definition");
        for(const [key,value]of Object.entries(record)){
          if(hidden.has(key)||value===null||value===undefined||value===""||(Array.isArray(value)&&!value.length))continue;
          dl.append(element("dt",labels[key]||key.replaceAll("_"," ")),element("dd",formatValue(value,key)));
        }
        nodes.detail.replaceChildren(dl);
        const account=kind==="organization"?record:data.organization;
        if(account?.id){
          const nav=element("div",null,"crm-history-related");
          nav.append(element("h3","Consultar esta conta"));
          for(const [target,label]of [["contact","Contatos"],["event","Eventos"],["case","Conversas"],["action","Oportunidades"]])
            nav.append(button(label,()=>scopeTo(account,target)));
          nodes.detail.append(nav);
        }
        if(Array.isArray(record.observations)&&record.observations.length){
          const observations=element("details",null,"crm-history-observations");
          observations.append(element("summary","Observações extraídas ("+record.observations.length+")"));
          for(const fact of record.observations){
            const p=element("p");p.append(element("strong",formatValue(fact.kind,"kind")+": "),element("span",formatValue(fact.data,"data")));
            if(fact.assessment)p.append(element("small",formatValue(fact.assessment,"assessment")));
            observations.append(p);
          }
          nodes.detail.append(observations);
        }
        nodes.detail.append(renderSources(data));
      }catch(e){
        if(g!==generation||n!==detailRequest||!nodes.dialog.open)return;
        nodes.detail.replaceChildren(element("p",e.code==="42501"?"Sessão Master indisponível. Entre novamente.":"Não foi possível consultar este registro."));
      }
    }
    function updateSort(){
      const option=nodes.sort.querySelector('[value="event_date"]');if(option)option.disabled=state.kind!=="event";
      if(state.kind!=="event"&&state.sort==="event_date")state.sort="recent";
      nodes.sort.value=state.sort;
    }
    nodes.form.addEventListener("submit",e=>{e.preventDefault();if(timer)window.clearTimeout(timer);state.offset=0;load();});
    nodes.search.addEventListener("input",()=>{state.query=nodes.search.value.trim();state.offset=0;if(timer)window.clearTimeout(timer);timer=window.setTimeout(load,350);});
    nodes.kind.addEventListener("change",()=>{state.kind=nodes.kind.value;state.offset=0;updateSort();load();});
    nodes.sort.addEventListener("change",()=>{state.sort=nodes.sort.value;state.offset=0;load();});
    nodes.refresh.addEventListener("click",()=>load());
    nodes.prev.addEventListener("click",()=>{state.offset=Math.max(0,state.offset-20);load();});
    nodes.next.addEventListener("click",()=>{if(state.offset+20<state.total){state.offset+=20;load();}});
    nodes.clearScope.addEventListener("click",()=>{state.organization=null;state.offset=0;nodes.scope.hidden=true;nodes.scopeName.textContent="";load();});
    nodes.close.addEventListener("click",()=>nodes.dialog.close());
    nodes.dialog.addEventListener("close",()=>{detailRequest++;detailAbort?.abort();state.selected=null;nodes.detail.replaceChildren();nodes.detailTitle.textContent="";});
    updateSort();
    return {
      setSession(next) {
        const nextIdentity=next?.user?.id||null,nextClient=next?.client||null;
        if(nextIdentity===identity&&nextClient===client)return;
        clear();identity=nextIdentity;client=nextClient;
        if(identity&&client){root.hidden=false;const historyLink=byId("clientHistoryLink");if(historyLink)historyLink.hidden=false;load();}
      },
      destroy(){clear();identity=null;client=null;}
    };
  }
  let controller=null;
  if(window?.document){
    const mount=window.document.getElementById("crmHistoryMount");
    if(mount){const template=window.document.createElement("template");template.innerHTML="<section id=\"crmHistory\" class=\"crm-history ph-no-capture ph-mask\" aria-label=\"Histórico recuperado de clientes\" hidden>\n          <header><span>Relacionamentos anteriores</span><h2>Histórico recuperado</h2>\n            <p>Consulte contas, contatos, eventos e conversas com suas fontes.</p>\n            <p id=\"crmHistoryPeriod\"></p></header>\n          <dl id=\"crmHistoryStats\" class=\"crm-history-stats\"></dl>\n          <form id=\"crmHistoryForm\" class=\"crm-history-toolbar\">\n            <label>Buscar no histórico<input id=\"crmHistorySearch\" type=\"search\" maxlength=\"200\" autocomplete=\"off\" placeholder=\"Nome, empresa, e-mail, telefone ou data\" /></label>\n            <label>Consultar<select id=\"crmHistoryKind\"><option value=\"organization\">Contas</option><option value=\"contact\">Contatos</option><option value=\"event\">Eventos documentados</option><option value=\"case\">Conversas</option><option value=\"action\">Oportunidades de retomada</option></select></label>\n            <label>Ordenar por<select id=\"crmHistorySort\"><option value=\"recent\">Último contato</option><option value=\"name\">Nome</option><option value=\"event_date\">Data do evento</option></select></label>\n            <button id=\"crmHistoryRefresh\" class=\"secondary\" type=\"button\">Atualizar histórico</button>\n          </form>\n          <div id=\"crmHistoryScope\" class=\"crm-history-scope\" hidden><span>Conta: <strong id=\"crmHistoryScopeName\"></strong></span><button id=\"crmHistoryClearScope\" type=\"button\" class=\"secondary\">Todas as contas</button></div>\n          <p id=\"crmHistoryStatus\" class=\"crm-history-status\" role=\"status\" aria-live=\"polite\"></p>\n          <div id=\"crmHistoryResults\" class=\"crm-history-results\"></div>\n          <nav class=\"crm-history-pager\" aria-label=\"Páginas do histórico\"><button id=\"crmHistoryPrevious\" class=\"secondary\" type=\"button\">Anterior</button><span id=\"crmHistoryPage\"></span><button id=\"crmHistoryNext\" class=\"secondary\" type=\"button\">Próxima</button></nav>\n          <p>Contagens distinguem conversas, reservas e realizações comprovadas. Valores documentados não representam recebimentos conciliados.</p>\n        </section>\n        <dialog id=\"crmHistoryDialog\" class=\"crm-history-dialog ph-no-capture ph-mask\" aria-labelledby=\"crmHistoryDetailTitle\">\n          <div class=\"crm-history-dialog-header\"><h2 id=\"crmHistoryDetailTitle\"></h2><button id=\"crmHistoryClose\" type=\"button\" class=\"secondary\">Fechar</button></div>\n          <div id=\"crmHistoryDetail\"></div>\n        </dialog>";mount.replaceChildren(template.content);}
    const root=window.document.getElementById("crmHistory");if(root)controller=createController(root,window.document);
  }
  return Object.freeze({formatDate,formatMoney,formatValue,params,
    setSession(next){controller?.setSession(next);}});
});
