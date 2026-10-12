const {test,expect}=require('@playwright/test');

async function prepare(page,channel,{concurrent=false,readFailure=false}={}) {
  await page.goto('/index.html?qa=1');
  await page.evaluate(async ({channel,concurrent,readFailure})=>{
    const proposal=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');
    proposal.id='00000000-0000-4000-8000-000000000651';
    Object.assign(proposal,{revision:1,status:'negociacao',publication_status:'draft',is_current:false,sent_at:null});
    proposal.snapshot.event.signalDeadlineAt=null;
    openSavedProposal(proposal.id);
    fields.notes.value='Antes do envio';
    const saved=await saveCurrentProposal('negociacao',null,{forSharing:true});
    if(!saved)throw Error(state.lastProposalSaveError);
    if(saved.publication_status!=='ready'||saved.status!=='proposta_pronta')throw Error('Expected reviewed publication lifecycle');
    window.beforeSend=structuredClone(saved);
    window.realSave=state.supabase.rpc.bind(state.supabase);
    state.supabase.rpc=async(name,args)=>{
      if(name==='save_event_proposal')window.postSendWrite=structuredClone(args);
      return window.realSave(name,args);
    };
    const from=state.supabase.from.bind(state.supabase);
    state.supabase.from=(table)=>{
      const query=from(table);
      if(table==='propostas'&&readFailure)query.single=async()=>({data:null,error:{message:'offline'}});
      return query;
    };
    state.supabase.functions.invoke=async(name,{body})=>{
      if(body.preview)return {data:{ok:true,mode:'preview',reviewedRevision:saved.revision,contentHash:'reviewed',html:'<p>Proposta de teste</p>',text:'Proposta de teste',subject:'Teste',sender:'eventos@example.test'}};
      window.sentBody=structuredClone(body);
      await new Promise(resolve=>window.finishProvider=resolve);
      const row=structuredClone(saved);
      row.revision=Number(saved.revision)+1;
      row.status='proposta_enviada';
      row.publication_status='sent';row.sent_at='2026-10-12T20:00:00Z';row.updated_at=row.sent_at;
      row.snapshot.event.signalDeadlineAt='2026-10-14T20:00:00Z';
      if(concurrent){row.revision++;row.snapshot.event.notes='Alteração de outra pessoa';}
      upsertProposalState(row);
      return {data:{ok:true,message:'Aceito; entrega não confirmada.'}};
    };
    const options={proposal:saved,proposalUrl:'https://example.test/proposta',email:'test@example.test',message:'Proposta de teste'};
    window.attempt=channel==='email'?sendProposalEmailViaZepto(options):sendProposalWhatsAppViaZapi(options);
  },{channel,concurrent,readFailure});
  const dialog=page.locator('.send-confirm-dialog');
  await dialog.locator('input[type=checkbox]').check();
  await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.finishProvider))).toBe(true);
}

for(const channel of ['whatsapp','email'])test(`${channel}: salvar, enviar, continuar digitando e salvar preserva revisão e texto`,async({page})=>{
  await prepare(page,channel);
  await page.locator('#notes').fill('Digitado durante o envio');
  const accepted=await page.evaluate(async()=>{
    window.finishProvider();await window.attempt;
    return {revision:state.editorProposalBase.revision,before:window.beforeSend.revision,
      dirty:hasUnsavedEditorChanges(),text:fields.notes.value};
  });
  expect(accepted.revision).toBe(accepted.before+1);expect(accepted.dirty).toBe(true);expect(accepted.text).toBe('Digitado durante o envio');
  await expect(page.locator('#loadedEditorBar')).toContainText('Não salvo');
  const saved=await page.evaluate(async()=>{
    const result=await saveCurrentProposal('negociacao');
    const published=state.proposals.find(p=>p.id===window.beforeSend.id);
    return {ok:Boolean(result),error:state.lastProposalSaveError,text:result?.snapshot.event.notes,
      expected:window.postSendWrite?.p_expected_revision,dirty:hasUnsavedEditorChanges(),
      newDraft:result?.id!==window.beforeSend.id&&result?.publication_status==='draft',publishedText:published?.snapshot.event.notes};
  });
  expect(saved.ok,saved.error).toBe(true);expect(saved.expected).toBe(accepted.revision);
  expect(saved.text).toBe('Digitado durante o envio');expect(saved.dirty).toBe(false);
  expect(saved.newDraft).toBe(true);expect(saved.publishedText).toBe('Antes do envio');
});

test('alteração concorrente continua bloqueada e não apaga a digitação local',async({page})=>{
  await prepare(page,'whatsapp',{concurrent:true});await page.locator('#notes').fill('Minha edição local');
  const result=await page.evaluate(async()=>{
    window.finishProvider();await window.attempt;
    const revision=state.editorProposalBase.revision;
    const saved=await saveCurrentProposal('negociacao');
    return {saved,revision,before:window.beforeSend.revision,text:fields.notes.value,dirty:hasUnsavedEditorChanges(),error:state.lastProposalSaveError};
  });
  expect(result.revision).toBe(result.before);expect(result.saved).toBeNull();
  expect(result.text).toBe('Minha edição local');expect(result.dirty).toBe(true);expect(result.error).toBeTruthy();
});

test('troca de evento durante envio não altera a base do outro editor',async({page})=>{
  await prepare(page,'whatsapp');
  const result=await page.evaluate(async()=>{
    const other=state.proposals.find(p=>p.id!==window.beforeSend.id);
    openSavedProposal(other.id);const base=state.editorProposalBase;
    window.finishProvider();await window.attempt;
    return {same:state.editorProposalBase===base,active:state.activeProposalId,expected:other.id};
  });
  expect(result.same).toBe(true);expect(result.active).toBe(result.expected);
});

test('leitura indisponível após aceitação não inventa revisão nem descarta texto',async({page})=>{
  await prepare(page,'whatsapp',{readFailure:true});await page.locator('#notes').fill('Preservar sem leitura');
  const result=await page.evaluate(async()=>{
    window.finishProvider();await window.attempt;
    return {revision:state.editorProposalBase.revision,before:window.beforeSend.revision,text:fields.notes.value,dirty:hasUnsavedEditorChanges()};
  });
  expect(result.revision).toBe(result.before);expect(result.text).toBe('Preservar sem leitura');expect(result.dirty).toBe(true);
});
