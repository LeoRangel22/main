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
    state.supabase.rpc=async(name,args)=>name==='event_proposal_can_share'?{data:false}:original(name,args);
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
