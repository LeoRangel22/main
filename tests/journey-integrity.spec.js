const {test,expect}=require('@playwright/test');
async function fixture(page,confirmed=false){
  await page.route('https://**',route=>route.abort());
  await page.goto('/index.html?qa=1');
  await page.evaluate(confirmed=>{
    const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');
    p.id='00000000-0000-4000-8000-000000000711';
    Object.assign(p,{revision:1,versao:1,status:confirmed?'confirmado':'negociacao',publication_status:'sent',is_current:true});
    openSavedProposal(p.id);
    p.snapshot=structuredClone(getProposalSnapshot());
    if(confirmed)p.snapshot.pagamentoSinal={valor:p.total/2,data:'2026-10-14',bancos:['Fixture']};
    else {p.snapshot.pagamentoSinal=null;p.snapshot.pagamentoRestante=null;}
    upsertProposalState(p);openSavedProposal(p.id);window.journeyOriginal=structuredClone(p);
    for(const h of window.EventOperationsState.handoffs)if(h.opportunity_id===p.oportunidade_id)h.proposal_id=p.id;
  },confirmed);
}
test('new customer starts with canonical conditions, never the prior exception',async({page})=>{
  await fixture(page);
  const result=await page.evaluate(()=>{
    const p=getActiveProposal();p.snapshot.generalTerms='EXCEÇÃO SOMENTE DO CLIENTE A';openSavedProposal(p.id);
    localStorage.setItem(TERMS_KEY,p.snapshot.generalTerms);window.confirm=()=>true;startNewProposal();
    return {name:fields.clientName.value,terms:fields.generalTerms.value,expected:defaultGeneralTerms,base:state.editorProposalBase,previous:p.snapshot.generalTerms};
  });
  expect(result.name).toBe('');expect(result.terms).toBe(result.expected);expect(result.base).toBeNull();expect(result.previous).toBe('EXCEÇÃO SOMENTE DO CLIENTE A');
});
test('terms-only edit creates a draft and leaves the released proposal intact',async({page})=>{
  await fixture(page);
  const r=await page.evaluate(async()=>{
    const before=structuredClone(getActiveProposal());fields.generalTerms.value+='\nCondição específica desta revisão.';
    const saved=await saveCurrentProposal('negociacao');
    return {ok:Boolean(saved),error:state.lastProposalSaveError,id:saved?.id,oldId:before.id,draft:saved?.publication_status,current:saved?.is_current,
      oldUnchanged:state.proposals.find(p=>p.id===before.id).snapshot.generalTerms===before.snapshot.generalTerms,labels:saved?.snapshot.versionChanges?.map(c=>c.label)};
  });
  expect(r.ok,r.error).toBe(true);expect(r.id).not.toBe(r.oldId);expect(r.draft).toBe('draft');expect(r.current).toBe(false);expect(r.oldUnchanged).toBe(true);expect(r.labels).toContain('Condições gerais');
});
test('same total does not hide changed item descriptions, allocation or payment terms',async({page})=>{
  await fixture(page);const r=await page.evaluate(()=>{
    const a=getProposalSnapshot(),b=structuredClone(a);
    b.selectedItems[0].descricao='Composição alterada sem mudar o total';
    b.selectedItems[0].calc.total+=1;if(b.selectedItems[1])b.selectedItems[1].calc.total-=1;
    b.paymentTerms=['30% conforme negociação específica'];
    return getClientVisibleProposalChanges(a,b).map(c=>c.label);
  });expect(r).toContain('Itens');expect(r).toContain('Condições de pagamento');
});
test('confirmed changes are isolated as an amendment draft, never promoted or sent',async({page})=>{
  await fixture(page,true);const r=await page.evaluate(async()=>{
    const before=structuredClone(getActiveProposal());fields.guestCount.value=String(Number(fields.guestCount.value)+3);
    const draft=await saveCurrentProposal('confirmado');const blocked=await saveCurrentProposal('negociacao',null,{forSharing:true});
    const old=state.proposals.find(p=>p.id===before.id);
    return {ok:Boolean(draft),draft:draft?.publication_status,id:draft?.id,oldId:before.id,current:draft?.is_current,source:draft?.snapshot.amendmentOf?.id,paid:draft?.snapshot.pagamentoSinal,
      preserved:old.status==='confirmado'&&old.is_current&&old.convidados===before.convidados,blocked,error:state.lastProposalSaveError,operation:shouldShowOperationalChecklist(draft)};
  });expect(r.ok).toBe(true);expect(r.id).not.toBe(r.oldId);expect(r.draft).toBe('draft');expect(r.current).toBe(false);expect(r.source).toBe(r.oldId);expect(r.paid).toBeNull();expect(r.preserved).toBe(true);expect(r.blocked).toBeNull();expect(r.error).toContain('Aditivo');expect(r.operation).toBe(false);
});
test('signal confirmation reconciles the editor revision and preserves typing during the write',async({page})=>{
  await fixture(page);
  await page.evaluate(()=>{
    const rpc=state.supabase.rpc.bind(state.supabase);state.supabase.rpc=async(name,args)=>{
      if(name==='save_event_proposal'&&!window.journeyReleased){window.journeyArgs=args;await new Promise(r=>window.journeyRelease=r);}
      return rpc(name,args);
    };
    window.signalAttempt=updateProposalStatus(getActiveProposal().id,'confirmado',{valor:getActiveProposal().total/2,data:'2026-10-14',bancos:['Fixture']});
  });
  await expect.poll(()=>page.evaluate(()=>Boolean(window.journeyRelease))).toBe(true);
  await page.locator('#notes').fill('Digitado durante a validação do sinal');
  const r=await page.evaluate(async()=>{
    window.journeyReleased=true;window.journeyRelease();await window.signalAttempt;
    const after={base:state.editorProposalBase.revision,row:getActiveProposal().revision,dirty:hasUnsavedEditorChanges(),text:fields.notes.value};
    let dialogs=0;showSignalPaymentDialog=async()=>{dialogs++;return null;};const saved=await saveCurrentProposal('confirmado');
    return {after,dialogs,saved:Boolean(saved),error:state.lastProposalSaveError,text:saved?.snapshot.event.notes,paid:saved?.snapshot.pagamentoSinal?.valor};
  });expect(r.after.base).toBe(r.after.row);expect(r.after.dirty).toBe(true);expect(r.dialogs).toBe(0);expect(r.saved,r.error).toBe(true);expect(r.text).toBe('Digitado durante a validação do sinal');expect(r.paid).toBeGreaterThan(0);
});
test('status change in another editor cannot advance the current editing base',async({page})=>{
  await fixture(page);
  const r=await page.evaluate(async()=>{
    const before=state.editorProposalBase;const p=getActiveProposal();p.revision+=1;upsertProposalState(p);
    await updateProposalStatus(p.id,'confirmado',{valor:p.total/2,data:'2026-10-14',bancos:['Fixture']});
    return {same:state.editorProposalBase===before,revision:state.editorProposalBase.revision};
  });expect(r.same).toBe(true);expect(r.revision).toBe(1);
});
test('print, summary and screen reflect the same eight sector tasks, additional controls stay separate',async({page})=>{
  await fixture(page,true);const r=await page.evaluate(()=>{
    const p=getActiveProposal(),data=getOperationalHandoffData(p);
    for(const t of data.tasks){t.status='done';t.acknowledged_at='2026-10-14T08:00:00Z';}
    renderOperationalChecklist(p);
    return {screen:nodes.operationalChecklist.textContent,html:buildOperationalChecklistHtml(p),summary:buildOperationalSummaryText(p),total:getOperationalDocContext(p).progress.total};
  });expect(r.total).toBe(8);expect(r.screen).toContain('8/8');expect(r.html).toContain('8/8');expect(r.summary).toContain('8/8');expect(r.html).toContain('Controles adicionais');expect(r.summary).toContain('Controles adicionais');
});
test('release refuses missing sector acknowledgements and unauthorized seller',async({page})=>{
  await fixture(page,true);const r=await page.evaluate(async()=>{
    const p=getActiveProposal(),d=getOperationalHandoffData(p);let calls=0;window.runEventOperationsRpc=async()=>{calls++;};
    const release=d.tasks.find(t=>t.task_key==='gerencia_go_no_go');
    await updateOperationalHandoffTask(release.id,true);
    for(const t of d.tasks){t.status='done';t.acknowledged_at='2026-10-14T08:00:00Z';}
    state.session.user.email='eventos@embaixadacarioca.com.br';await updateOperationalHandoffTask(release.id,true);
    return calls;
  });expect(r).toBe(0);
});
test('manager can release after every prerequisite is done and acknowledged in the current version',async({page})=>{
  await fixture(page,true);const r=await page.evaluate(async()=>{
    const p=getActiveProposal(),d=getOperationalHandoffData(p);let calls=0;window.runEventOperationsRpc=async()=>{calls++;};
    const release=d.tasks.find(t=>t.task_key==='gerencia_go_no_go');
    for(const t of d.tasks.filter(t=>t.id!==release.id)){t.status='done';t.acknowledged_at='2026-10-14T08:00:00Z';}
    await updateOperationalHandoffTask(release.id,true);return calls;
  });expect(r).toBe(1);
});
test('seller cannot validate or write a payment but can retain existing recorded values',async({page})=>{
  await fixture(page);const r=await page.evaluate(async()=>{
    const p=getActiveProposal();state.session.user.email='eventos@embaixadacarioca.com.br';let calls=0;state.supabase.rpc=async()=>{calls++;return {data:null};};
    const dialog=await showSignalPaymentDialog(p.total);
    const result=await persistEventProposal(p.id,{snapshot:{...p.snapshot,pagamentoSinal:{valor:1}}},p);
    return {dialog,code:result.error?.code,calls,modals:document.querySelectorAll('.signal-modal-backdrop').length};
  });expect(r).toEqual({dialog:null,code:'42501',calls:0,modals:0});
});
test('partial quotation can be saved as a draft without being released or dispatched',async({page})=>{
  await fixture(page);const r=await page.evaluate(async()=>{
    window.confirm=()=>true;startNewProposal();fields.clientName.value='Rascunho incompleto';fields.eventDate.value='';state.selectedIds.clear();
    const saved=await saveCurrentProposal(null,null,{asDraft:true});return {ok:Boolean(saved),error:state.lastProposalSaveError,pub:saved?.publication_status,sent:saved?.sent_at,items:saved?.snapshot.selectedItems?.length};
  });expect(r.ok,r.error).toBe(true);expect(r.pub).toBe('draft');expect(r.sent).toBeNull();expect(r.items).toBe(0);
});
test('planning after a validated signal does not request the remaining payment',async({page})=>{
  await fixture(page,true);const r=await page.evaluate(async()=>{
    let dialogs=0;showRemainingPaymentDialog=async()=>{dialogs++;return null;};
    await updateProposalStatus(getActiveProposal().id,'planejamento');return {dialogs,status:getActiveProposal().status};
  });expect(r).toEqual({dialogs:0,status:'planejamento'});
});
