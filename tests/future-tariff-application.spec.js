const {test,expect}=require('@playwright/test');
async function setup(page){
 // All provider/backend mutations are intercepted; QA writes stay in memory.
 await page.route('**/rest/v1/rpc/**',route=>route.abort());
 await page.route('**/functions/v1/**',route=>route.abort());
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');p.id='00000000-0000-4000-8000-000000000654';p.revision=1;p.publication_status='draft';p.status='negociacao';p.is_current=false;
  openSavedProposal(p.id);fields.eventDate.value='2027-02-01';fields.generalTerms.value='VALIDADE: até 31/12/2026.';clearTariffApplication();renderAll();
 });
}
for(const width of [390,1440])test(`future date offers explicit confirmation and cancel preserves values at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await setup(page);
 const before=await page.evaluate(()=>({prices:structuredClone(state.prices),terms:fields.generalTerms.value,total:getQuoteTotals().total}));
 await expect(page.locator('[data-tariff-confirm]')).toBeVisible();
 page.once('dialog',dialog=>{expect(dialog.message()).toContain('Cancelar');return dialog.dismiss();});
 await page.locator('[data-tariff-confirm]').click();
 expect(await page.evaluate(()=>getTariffApplication())).toBeNull();
 expect(await page.evaluate(()=>({prices:structuredClone(state.prices),terms:fields.generalTerms.value,total:getQuoteTotals().total}))).toEqual(before);
});
test('accept changes only applicability, not totals, terms or commercial approval',async({page})=>{
 await setup(page);const before=await page.evaluate(()=>({prices:structuredClone(state.prices),terms:fields.generalTerms.value,total:getQuoteTotals().total}));
 page.once('dialog',dialog=>dialog.accept());await page.locator('[data-tariff-confirm]').click();
 const a=await page.evaluate(()=>getProposalSnapshot().event.tariffApplication);expect(a.kind).toBe('request');expect(a.eventDate).toBe('2027-02-01');expect(a.confirmedBy).toBeUndefined();
 expect(await page.evaluate(()=>({prices:structuredClone(state.prices),terms:fields.generalTerms.value,total:getQuoteTotals().total}))).toEqual(before);
 expect(await page.evaluate(()=>state.sendReviewApproval)).toBeNull();
 await expect(page.locator('#proposalContent')).toContainText('Aplicação específica deste orçamento');
});

test('a saved 2025 table can be explicitly applied to a 2026 event and appears with quote-specific validity in the PDF preview',async({page})=>{
 await setup(page);await page.evaluate(()=>{fields.eventDate.value='2026-11-12';fields.generalTerms.value='VALIDADE: este tarifário é válido exclusivamente para eventos realizados até o dia 31/12/2025.';clearTariffApplication();renderAll();});
 const total=await page.evaluate(()=>getQuoteTotals().total);page.once('dialog',d=>d.accept());await page.locator('[data-tariff-confirm]').click();
 await expect(page.locator('#proposalContent')).toContainText('Aplicação específica deste orçamento');
 await expect(page.locator('#proposalContent')).toContainText('aplicam-se ao evento de 12/11/2026');
 expect(await page.evaluate(()=>getQuoteTotals().total)).toBe(total);
 expect(await page.evaluate(()=>getTariffApplication().validUntil)).toBe('2025-12-31');
});
test('date away and back invalidates a choice, while a genuine future-valid table needs none',async({page})=>{
 await setup(page);page.once('dialog',d=>d.accept());await page.locator('[data-tariff-confirm]').click();
 await page.locator('#eventDate').fill('2027-02-02');await page.locator('#eventDate').fill('2027-02-01');
 expect(await page.evaluate(()=>getTariffApplication())).toBeNull();
 await page.locator('#generalTerms').fill('VALIDADE: até 31/12/2027.');
 await expect(page.locator('[data-tariff-confirm]')).toHaveCount(0);
 expect(await page.evaluate(()=>tariffApplicationNeeded())).toBe(false);
});
test('save readback, reopen and changed shared catalog retain the selected historic prices',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{
  state.privatizationRules=[];renderAll();
  const original=state.supabase.rpc.bind(state.supabase);
  state.supabase.rpc=async(name,args)=>{
   if(name!=='save_event_proposal')return original(name,args);
   const result=await original(name,args);const rows=Array.isArray(result.data)?result.data:[result.data];
   for(const row of rows){const a=row?.snapshot?.event?.tariffApplication;if(a?.kind==='request'){row.snapshot.event.tariffApplication={schema:1,kind:'confirmed',mode:a.mode,requestId:a.requestId,eventDate:a.eventDate,validUntil:a.validUntil,catalog:{source:'proposal_snapshot',version:null,reference:'a'.repeat(64)},basisHash:'b'.repeat(64),confirmedBy:'00000000-0000-4000-8000-000000000001',confirmedAt:'2026-10-22T17:00:00Z',proposalId:row.id};}}
   return result;
  };
 });
 page.once('dialog',d=>d.accept());await page.locator('[data-tariff-confirm]').click();
 const result=await page.evaluate(async()=>{
  const before=structuredClone(state.prices),a=getTariffApplication();
  const row=await saveCurrentProposal('negociacao',null,{asDraft:true});if(!row)return {error:state.lastProposalSaveError};
  const dirty=hasUnsavedEditorChanges();state.sharedSettings.catalog={version:99,value:[{id:'unrelated-current',precoFixo:9999}]};
  state.privatizationRules=[{day:1,partial:500,total:1000}];
  openSavedProposal(row.id);const receipt=getTariffApplication();
  return {before,prices:state.prices,rules:state.privatizationRules,dirty,kind:receipt?.kind,requestId:receipt?.requestId,expectedId:a.requestId,date:fields.eventDate.value};
 });
 expect(result.error).toBeUndefined();expect(result.rules).toEqual([]);expect(result.dirty).toBe(false);expect(result.prices).toEqual(result.before);expect(result.kind).toBe('confirmed');expect(result.requestId).toBe(result.expectedId);expect(result.date).toBe('2027-02-01');
});
test('duplicate requires a fresh applicability choice and does not send anything',async({page})=>{
 await setup(page);page.once('dialog',d=>d.accept());await page.locator('[data-tariff-confirm]').click();
 await page.evaluate(async()=>{markEditorClean();await duplicateProposalForAdjustment(state.activeProposalId);fields.eventDate.value='2027-02-01';fields.generalTerms.value='VALIDADE: até 31/12/2026.';renderAll();});
 expect(await page.evaluate(()=>getTariffApplication())).toBeNull();expect(await page.evaluate(()=>state.forceNewVersionDraft)).toBe(true);
});

test('canceling duplicate opening leaves current event and confirmation untouched',async({page})=>{
 await setup(page);page.once('dialog',d=>d.accept());await page.locator('[data-tariff-confirm]').click();
 const before=await page.evaluate(()=>({id:state.activeProposalId,receipt:getTariffApplication(),version:state.forceNewVersionDraft}));
 page.on('dialog',d=>d.dismiss());
 await page.evaluate(()=>duplicateProposalForAdjustment(state.activeProposalId));
 expect(await page.evaluate(()=>({id:state.activeProposalId,receipt:getTariffApplication(),version:state.forceNewVersionDraft}))).toEqual(before);
});

test('internal save on an unchanged contracted legacy agreement does not ask to reapply the expired table or create an amendment',async({page})=>{
 await setup(page);
 const result=await page.evaluate(async()=>{
  const p=getActiveProposal();p.status='confirmado';p.publication_status='ready';p.is_current=true;
  p.data_evento='2027-02-01';p.snapshot.event.date=p.data_evento;p.snapshot.generalTerms='VALIDADE: até 31/12/2026.';
  p.snapshot.pagamentoSinal={valor:p.total/2,validacaoPendente:false,validadoPor:state.session.user.id,validadoEmail:'leorangel@gmail.com',validadoEm:new Date().toISOString()};
  upsertProposalState(p);openSavedProposal(p.id);fields.notes.value='Nota interna sintética';
  let questions=0;window.confirm=()=>{questions++;return false;};
  const saved=await saveCurrentProposal('confirmado',null,{markReady:true});
  return {ok:Boolean(saved),error:state.lastProposalSaveError,questions,id:saved?.id,expected:p.id,amendment:saved?.snapshot.amendmentOf,proof:saved?.snapshot.event.tariffApplication,notes:saved?.snapshot.event.notes};
 });
 expect(result.ok,result.error).toBe(true);expect(result.questions).toBe(0);expect(result.id).toBe(result.expected);expect(result.amendment).toBeUndefined();expect(result.proof).toBeUndefined();expect(result.notes).toBe('Nota interna sintética');
});
