(function(root,factory){const api=factory(root);if(typeof module==="object"&&module.exports)module.exports=api;else root.EventCrmClassification=api;})(typeof window==="undefined"?null:window,function(window){
"use strict";
function create(context){const {element,line,button,formatDate,nodes,state,load,openRecord,updateSort}=context;
    const reviewClasses={customer:"Cliente ou potencial cliente",supplier:"Fornecedor",service:"Serviço",other:"Outro correspondente",unknown:"A revisar"};
    const reviewSegments={tourism:"Agência de turismo",events:"Agência de eventos ou marketing",company:"Empresa",person:"Pessoa física",unknown:"Não definido"};
    let reviewEdit=null;
    const pendingKey=()=> "event-crm-review-pending:"+encodeURIComponent(context.identity()||"");
    function pendingReview(){try{const raw=window.sessionStorage.getItem(pendingKey());if(!raw)return null;const p=JSON.parse(raw);return p&&typeof p==="object"&&["organization","contact"].includes(p.kind)&&["batch_id","record_id"].every(k=>typeof p[k]==="string"&&p[k].length>0&&p[k].length<=160)&&/^[0-9a-f-]{36}$/i.test(p.request_id)?p:{invalid:true};}catch(e){return {invalid:true};}}
    function storePending(value){window.sessionStorage.setItem(pendingKey(),JSON.stringify(value));}
    function forgetPending(){try{window.sessionStorage.removeItem(pendingKey());}catch(e){}}
    function sameReview(p,data){return p&&p.batch_id===data.batch_id&&p.kind===data.kind&&p.record_id===data.record.id;}
    function preventReviewExit(e){
      if(!reviewEdit)return false;
      e?.preventDefault();reviewEdit.message.textContent="Salve ou cancele a revisão antes de sair. Se o resultado for incerto, consulte o estado.";
      reviewEdit.message.focus();return true;
    }
    async function classificationStatus(data,offset,requestId){
      const r=await context.client().rpc("event_crm_classification_status",{p_batch_id:data.batch_id,p_kind:data.kind,
        p_record_id:data.record.id,p_offset:offset||0,p_request_id:requestId||null});
      if(r.error)throw r.error;
      const x=r.data;
      if(!x||x.batch_id!==data.batch_id||x.kind!==data.kind||x.record_id!==data.record.id||
        !Number.isSafeInteger(x.current?.revision)||!Array.isArray(x.history))throw Error("REVIEW_READBACK_MISMATCH");
      return x;
    }
    function renderReview(data){
      const area=element("section",null,"crm-classification-review");
      const heading=element("h3","Classificação revisada");heading.tabIndex=-1;area.append(heading);
      area.setAttribute("aria-label","Revisão da classificação");
      const view=data.classification_review;
      if(!view||view.batch_id!==data.batch_id||view.kind!==data.kind||view.record_id!==data.record.id||!Number.isSafeInteger(view.current?.revision)||!Array.isArray(view.history)||!["organization","contact"].includes(data.kind)){
        area.append(element("p","A classificação manual não está disponível para este registro. As fontes originais continuam preservadas."));
        return area;
      }
      const current=view.current||{revision:0};
      line(area,"Revisão manual:",current.revision?"V"+current.revision+" · "+formatDate(current.created_at):"Ainda não realizada");
      line(area,"Classificação:",reviewClasses[current.classification]||"Mantida da fonte");
      line(area,"Segmento:",reviewSegments[current.segment]||"Mantido da fonte");
      if(current.reason)line(area,"Motivo:",current.reason);
      if(current.actor_email)line(area,"Autor da revisão:",current.actor_email);
      area.append(element("p","Esta revisão não altera fontes, contatos, valores ou realizações e não autoriza contato automático."));
      const message=element("p","", "crm-review-status");message.setAttribute("role","status");message.tabIndex=-1;area.append(message);
      const g=context.generation(),n=context.detailRequest(),recordId=data.record.id;
      const active=()=>g===context.generation()&&n===context.detailRequest()&&nodes.dialog.open&&state.selected?.id===recordId&&state.selected?.kind===data.kind;
      function replace(next,text){
        reviewEdit=null;data.classification_review=next;
        const newer=renderReview(data);area.replaceWith(newer);
        newer.querySelector(".crm-review-status").textContent=text||"";
        newer.querySelector("h3").focus({preventScroll:true});
      }
      async function consult(offset,requestId){
        const controls=[...area.querySelectorAll("button")].map(x=>({node:x,disabled:x.disabled}));controls.forEach(x=>x.node.disabled=true);
        message.textContent="Consultando revisão, sem repetir a gravação…";
        try{
          const next=await classificationStatus(data,offset,requestId);
          if(!active())return;
          if(requestId&&!next.receipt){message.textContent="Ainda não há comprovação desta gravação. Aguarde e consulte novamente; não repita.";return;}
          if(requestId){forgetPending();replace(next,"Revisão registrada e relida neste registro.");load();}
          else replace(next);
        }catch(e){if(active())message.textContent="Não foi possível comprovar a revisão. Nenhuma gravação foi repetida.";}
        finally{if(active())controls.forEach(x=>x.node.disabled=x.disabled);}
      }
      const pending=pendingReview();
      if(pending){
        message.textContent="Há uma revisão pendente nesta aba. Consulte o estado antes de registrar outra.";
        if(sameReview(pending,data))area.append(button("Consultar revisão pendente",()=>consult(0,pending.request_id)));
        else if(!pending.invalid){message.textContent="Existe uma revisão pendente em outro registro desta aba. Consulte-a antes de editar.";area.append(button("Abrir revisão pendente",()=>{state.kind=pending.kind;nodes.kind.value=pending.kind;updateSort();openRecord(pending.record_id);}));}
      }else{
        area.append(button("Revisar classificação",()=>{
          if(reviewEdit){preventReviewExit();return;}
          const form=element("form",null,"crm-review-form");
          const fields={};const controls=[];
          for(const [key,title,options,value]of [
            ["classification","Classificação manual",reviewClasses,current.classification],
            ["segment","Segmento manual",reviewSegments,current.segment]]){
            const label=element("label",title);const select=element("select");select.setAttribute("aria-label",title);
            const original=element("option","Manter da fonte");original.value="";select.append(original);
            for(const [v,text]of Object.entries(options)){const o=element("option",text);o.value=v;select.append(o);}
            select.value=value||"";label.append(select);form.append(label);fields[key]=select;controls.push(select);
          }
          const label=element("label","Motivo da revisão");
          const reason=element("textarea");reason.required=true;reason.minLength=10;reason.maxLength=500;reason.rows=3;reason.setAttribute("aria-label","Motivo da revisão");
          label.append(reason);form.append(label);controls.push(reason);
          const save=element("button","Registrar revisão","primary");save.type="submit";
          const cancel=button("Cancelar revisão",()=>{if(reviewEdit?.busy)return;reviewEdit=null;form.remove();start.disabled=false;start.focus();});
          form.append(save,cancel);controls.push(save,cancel);
          const start=area.querySelector("button");start.disabled=true;area.append(form);
          reviewEdit={message,busy:false};fields.classification.focus();
          form.addEventListener("submit",async e=>{
            e.preventDefault();if(!active()||!reviewEdit||reviewEdit.busy||pendingReview())return;
            if(!form.reportValidity())return;
            const reasonValue=reason.value.trim();if(reasonValue.length<10){message.textContent="Explique o motivo em pelo menos 10 caracteres.";reason.focus();return;}
            const requestId=window.crypto.randomUUID();
            const marker={batch_id:data.batch_id,kind:data.kind,record_id:recordId,request_id:requestId};
            try{storePending(marker);}catch(err){message.textContent="Não foi possível preparar esta aba. Nenhuma gravação foi iniciada.";return;}
            reviewEdit.busy=true;controls.forEach(x=>x.disabled=true);message.textContent="Registrando revisão…";
            let sentResult;
            try{
              const q=context.client().rpc("event_crm_review_classification",{p_batch_id:data.batch_id,p_kind:data.kind,
                p_record_id:recordId,p_expected_revision:current.revision,p_request_id:requestId,
                p_classification:fields.classification.value||null,p_segment:fields.segment.value||null,p_reason:reasonValue});
              const timeout=new Promise((_,reject)=>window.setTimeout(()=>reject(Error("REVIEW_TIMEOUT")),15000));
              sentResult=await Promise.race([q,timeout]);
              if(!active())return;
              if(sentResult.error)throw sentResult.error;
              if(!["saved","already_saved"].includes(sentResult.data?.status)||sentResult.data.request_id!==requestId||
                sentResult.data.revision!==current.revision+1)throw Error("REVIEW_UNCERTAIN");
              const next=await classificationStatus(data,0,requestId);
              if(!active())return;
              if(next.receipt?.request_id!==requestId||next.receipt.revision!==sentResult.data.revision)throw Error("REVIEW_UNCERTAIN");
              forgetPending();replace(next,next.current.revision===next.receipt.revision?
                "Revisão registrada e relida neste registro.":"Revisão registrada. Existe uma revisão posterior; confira o estado atual.");
              load();
            }catch(err){
              if(!active())return;
              if(["22023","42501","PT409"].includes(err.code)){
                forgetPending();reviewEdit.busy=false;
                message.textContent=err.code==="PT409"?"Outra revisão ou base mudou. Consulte o estado antes de registrar novamente.":
                  "Revisão não registrada. Confira os dados e sua sessão Master.";
                cancel.disabled=false;area.append(button("Consultar estado da classificação",()=>consult(0,null)));
              }else{
                reviewEdit.busy=true;message.textContent="Resultado incerto. Consulte o estado; esta gravação não será repetida.";
                area.append(button("Consultar revisão pendente",()=>consult(0,requestId)));
                area.append(button("Fechar revisão pendente",()=>{reviewEdit=null;nodes.dialog.close();}));
              }
            }
          });
        }));
      }
      const history=element("details",null,"crm-review-history");
      history.append(element("summary","Histórico das revisões ("+(view.total||0)+")"));
      for(const item of view.history||[]){
        const row=element("article",null,"crm-review-history-item");
        row.append(element("strong","V"+item.revision+" · "+formatDate(item.created_at)));
        line(row,"Classificação:",reviewClasses[item.classification]||"Mantida da fonte");
        line(row,"Segmento:",reviewSegments[item.segment]||"Mantido da fonte");line(row,"Motivo:",item.reason);if(item.actor_email)line(row,"Autor:",item.actor_email);
        history.append(row);
      }
      if(view.total>view.limit){
        const nav=element("nav",null,"crm-history-pager");nav.setAttribute("aria-label","Revisões da classificação");
        const prev=button("Revisões mais recentes",()=>consult(Math.max(0,view.offset-10)));
        prev.disabled=view.offset===0;const next=button("Revisões anteriores",()=>consult(view.offset+10));
        next.disabled=view.offset+view.limit>=view.total;nav.append(prev,next);history.append(nav);
      }
      area.append(history);return area;
    }


return {renderReview,preventReviewExit,clear(){reviewEdit=null;}};
}
return Object.freeze({create});
});
