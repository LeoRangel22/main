const {test,expect}=require('@playwright/test');
async function mount(page){
  await page.route('**/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};'}));
  await page.goto('/index.html');
  await page.evaluate(()=>{
    resetCommercialDashboard();loadQaFixtures();
    state.session={user:{id:'qa-user',email:'leorangel@gmail.com'}};
    state.supabase=createQaSupabaseClient();
    const p=state.proposals.find(x=>x.id==='qa-proposal-sem-resposta');
    openSavedProposal(p.id);window.approvalProductionCalls=[];
    state.supabase.functions.invoke=async(name,{body})=>{
      window.approvalProductionCalls.push({name,body});
      if(name!=='event-proposal-approval')throw Error('Unexpected customer delivery');
      return {data:{ok:true,approval:{id:'request-fixture',status:'pending',notifications:[]}}};
    };
    const original=state.supabase.rpc.bind(state.supabase);
    state.supabase.rpc=async(name,args)=>name==='event_approval_policy'?{data:{enabled:true}}:name==='event_proposal_can_share'?{data:false}:original(name,args);
  });
}
for(const channel of ['email','whatsapp'])test(`production mode ${channel} routes to manager approval, never direct delivery`,async({page})=>{
  await mount(page);
  const result=await page.evaluate(async channel=>{
    const p=getActiveProposal(),options={proposal:p,proposalUrl:getPublicProposalUrl(p),email:'fixture@example.test',message:'Exact fixture message'};
    const before=p.status;
    const ok=channel==='email'?await sendProposalEmailViaZepto(options):await sendProposalWhatsAppViaZapi(options);
    return {qa:QA_MODE,ok,before,after:p.status,calls:window.approvalProductionCalls};
  },channel);
  expect(result.qa).toBe(false);expect(result.ok).toBe(true);expect(result.after).toBe(result.before);
  expect(result.calls).toHaveLength(1);expect(result.calls[0].name).toBe('event-proposal-approval');
  expect(result.calls[0].body.action).toBe('request');expect(result.calls[0].body.channel).toBe(channel);
  await expect(page.locator('#remoteApprovalResult')).toContainText('Aguardando aprovação');
});
test('production mode refuses unapproved copy, print and public-link sharing',async({page})=>{
  await mount(page);
  const result=await page.evaluate(async()=>{
    window.copied=false;window.printed=false;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{window.copied=true;}}});
    window.print=()=>{window.printed=true;};
    await copyProposal();
    const share=await ensureProposalForSharing();
    document.querySelector('#printBtn').click();
    await new Promise(r=>setTimeout(r,50));
    return {share,copied:window.copied,printed:window.printed,calls:window.approvalProductionCalls};
  });
  expect(result.share).toBeNull();expect(result.copied).toBe(false);expect(result.printed).toBe(false);expect(result.calls).toEqual([]);
});
for(const channel of ['email','whatsapp'])test(`production disabled policy retains reviewed ${channel} flow without requesting approval`,async({page})=>{
 await mount(page);
 const result=await page.evaluate(async channel=>{
  const p=getActiveProposal();fields.clientPhone.value='5521000000001';let reviews=0;
  state.supabase.rpc=async name=>name==='event_approval_policy'?{data:{enabled:false}}:{data:false};
  confirmClientSend=async()=>{reviews++;return false;};
  state.supabase.functions.invoke=async(name,{body})=>{
   window.approvalProductionCalls.push({name,body});
   if(name==='send-proposal-email'&&body.preview)return {data:{ok:true,mode:'preview',html:'<p>Reviewed fixture</p>',text:'Reviewed fixture',contentHash:'hash',reviewedRevision:p.revision}};
   throw Error('Unexpected external operation');
  };
  const options={proposal:p,proposalUrl:getPublicProposalUrl(p),email:'fixture@example.test',message:'Exact fixture message'};
  const ok=channel==='email'?await sendProposalEmailViaZepto(options):await sendProposalWhatsAppViaZapi(options);
  return {ok,reviews,calls:window.approvalProductionCalls};
 },channel);
 expect(result.ok).toBe(false);expect(result.reviews).toBe(1);
 expect(result.calls.every(c=>c.name==='send-proposal-email'&&c.body.preview)).toBe(true);
});
test('production policy read failure blocks both sending paths',async({page})=>{
 await mount(page);
 const result=await page.evaluate(async()=>{
  const p=getActiveProposal();state.supabase.rpc=async()=>({error:{message:'offline'}});
  const options={proposal:p,proposalUrl:getPublicProposalUrl(p),email:'fixture@example.test',message:'Fixture body'};
  return {email:await sendProposalEmailViaZepto(options),whatsapp:await sendProposalWhatsAppViaZapi(options),calls:window.approvalProductionCalls};
 });expect(result.email).toBe(false);expect(result.whatsapp).toBe(false);expect(result.calls).toEqual([]);
});
test('production repeated clean approval request preserves saved revision and identity',async({page})=>{
 await mount(page);
 const result=await page.evaluate(async()=>{
  const p=getActiveProposal();Object.assign(p,{revision:3,is_current:true,publication_status:'ready',status:'proposta_pronta',public_token_expires_at:'2099-11-18T12:00:00Z'});openSavedProposal(p.id);
  ensureProposalReadyForSending=()=>true;
  const rpc=state.supabase.rpc.bind(state.supabase);let writes=0;
  state.supabase.rpc=async(name,args)=>{if(name==='save_event_proposal')writes++;return rpc(name,args);};
  const first=await ensureProposalForSharing({forApproval:true});
  await requestRemoteProposalApproval('whatsapp',{proposal:first.saved,proposalUrl:first.url,message:'Exact fixture message'});
  const second=await ensureProposalForSharing({forApproval:true});
  await requestRemoteProposalApproval('whatsapp',{proposal:second.saved,proposalUrl:second.url,message:'Exact fixture message'});
  return {writes,first:first.saved.revision,second:second.saved.revision,calls:window.approvalProductionCalls};
 });expect(result.writes).toBe(0);expect(result.first).toBe(3);expect(result.second).toBe(3);
 expect(result.calls).toHaveLength(2);expect(result.calls[0].body).toEqual(result.calls[1].body);
});
test('production approved sharing reconciles remote send metadata but not concurrent edits',async({page})=>{
 await mount(page);
 const result=await page.evaluate(async()=>{
  const p=getActiveProposal();Object.assign(p,{revision:3,status:'proposta_pronta',publication_status:'ready',sent_at:null});p.snapshot.event.signalDeadlineAt=null;openSavedProposal(p.id);
  const latest=structuredClone(state.editorProposalBase);Object.assign(latest,{revision:4,status:'proposta_enviada',publication_status:'sent',sent_at:'2026-10-13T09:00:00Z',updated_at:'2026-10-13T09:00:00Z'});latest.snapshot.event.signalDeadlineAt='2026-10-15T09:00:00Z';
  let expected;state.supabase.from=()=>({select:()=>({eq:()=>({single:async()=>({data:latest})})})});
  state.supabase.rpc=async(name,args)=>{if(name==='event_approval_policy')return {data:{enabled:true}};expected=args.expected_revision;return {data:true};};
  const allowed=await remoteProposalMayShare(),revision=state.editorProposalBase.revision;
  latest.revision=5;latest.snapshot.event.notes='Another editor';
  const conflict=await remoteProposalMayShare();
  return {allowed,revision,expected,conflict,finalRevision:state.editorProposalBase.revision};
 });expect(result.allowed).toBe(true);expect(result.revision).toBe(4);expect(result.expected).toBe(4);expect(result.conflict).toBe(false);expect(result.finalRevision).toBe(4);
});
