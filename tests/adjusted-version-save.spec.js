const {test,expect}=require('@playwright/test');
async function prepare(page){
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');p.id='00000000-0000-4000-8000-000000000677';
  Object.assign(p,{versao:1,revision:4,status:'negociacao',publication_status:'sent',is_current:true,journey_commercial_locked:true,journey_booked_locked:false,cliente_resposta:'alteracao',cliente_resposta_em:new Date().toISOString(),sent_at:new Date().toISOString()});
  p.snapshot.clienteResposta={acao:'alteracao',mensagem:'Ajustar para 32 convidados'};
  openSavedProposal(p.id);window.originalPublished=structuredClone(p);
  const rpc=state.supabase.rpc.bind(state.supabase);window.saveCalls=[];
  state.supabase.rpc=async(name,args)=>{
   if(name==='save_event_proposal')window.saveCalls.push(structuredClone(args));
   const result=await rpc(name,args);
   // QA's generic insert omits database-generated version numbers. Supply the
   // real RPC contract here; SQL separately tests the actual increment/readback.
   if(name==='save_event_proposal'&&args.p_source_proposal_id&&result.data){
    const rows=Array.isArray(result.data)?result.data:[result.data];for(const row of rows)row.versao=Number(window.originalPublished.versao)+1;
   }
   return result;
  };
 });
 await page.locator('#guestCount').fill('32');
 expect(await page.evaluate(()=>approveSendReview())).toBe(true);
}
test('requested adjustment saves a ready V2 once and preserves sent V1',async({page})=>{
 await prepare(page);await page.locator('#saveProposalBtn').click();
 await expect.poll(()=>page.evaluate(()=>state.activeProposalId)).not.toBe('00000000-0000-4000-8000-000000000677');
 const r=await page.evaluate(()=>{const saved=getActiveProposal(),original=state.proposals.find(p=>p.id===window.originalPublished.id),before=window.originalPublished;return {version:saved.versao,guests:saved.convidados,status:saved.publication_status,oldUnchanged:JSON.stringify(original.snapshot)===JSON.stringify(before.snapshot)&&original.convidados===before.convidados&&original.total===before.total&&original.cliente_resposta===before.cliente_resposta,calls:window.saveCalls,dirty:hasUnsavedEditorChanges()};});
 expect(r.version).toBe(2);expect(r.guests).toBe(32);expect(r.status).toBe('ready');expect(r.oldUnchanged).toBe(true);expect(r.calls).toHaveLength(1);expect(r.calls[0].p_expected_revision).toBe(4);expect(r.calls[0].p_source_proposal_id).toBe('00000000-0000-4000-8000-000000000677');expect(r.dirty).toBe(false);
});
test('stale adjustment keeps draft and persistent feedback without duplicating V2',async({page})=>{
 await prepare(page);await page.evaluate(()=>{const rpc=state.supabase.rpc.bind(state.supabase);state.supabase.rpc=async(n,a)=>n==='save_event_proposal'?{data:null,error:{code:'PT409',message:'A proposta mudou. Reabra e confira a versão atual.'}}:rpc(n,a);});
 await page.locator('#saveProposalBtn').click();await expect(page.locator('.proposal-save-feedback')).toBeVisible();
 const r=await page.evaluate(()=>({id:state.activeProposalId,guests:getGuestCount(),dirty:hasUnsavedEditorChanges(),versions:state.proposals.filter(p=>p.oportunidade_id===window.originalPublished.oportunidade_id).length}));
 expect(r.id).toBe('00000000-0000-4000-8000-000000000677');expect(r.guests).toBe(32);expect(r.dirty).toBe(true);
 await expect(page.locator('.proposal-save-feedback')).toContainText(/mudou|conflito|atual/i);
});
