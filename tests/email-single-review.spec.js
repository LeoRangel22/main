const {test,expect}=require('@playwright/test');
const {expectNoHorizontalOverflow}=require('./support');
async function prepare(page){
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const p=state.proposals.find(p=>p.id==='qa-proposal-sem-resposta');openSavedProposal(p.id);
  fields.clientEmail.value='fixture@example.test';state.sendReviewApprovedSignature='';state.sendReviewApproval=null;
  window.mailAttempts=[];
  state.supabase.functions.invoke=async(name,{body})=>{
   if(name!=='send-proposal-email')throw Error('Unexpected provider');
   window.mailAttempts.push(structuredClone(body));
   if(body.preview)return {data:{ok:true,mode:'preview',reviewedRevision:body.reviewedRevision,contentHash:'fixture-content-hash',html:'<p>Proposta fictícia completa</p>',text:'Proposta fictícia completa',subject:'Fixture',sender:'eventos@example.test',replyTo:'eventos+'+'a'.repeat(52)+'@embaixadacarioca.com.br'}};
   return {data:{ok:true,sendId:'00000000-0000-4000-8000-000000000001',deliveryStatus:'accepted',message:'Aceito; entrega não confirmada.'}};
  };
  window.emailAttempt=openEmail();
 });
}
for(const width of [320,1440])test('e-mail saves and reviews exact version once at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await prepare(page);
 const dialog=page.locator('.send-confirm-dialog');await expect(dialog).toBeVisible();
 await expect(page.locator('.send-readiness-dialog')).toHaveCount(0);
 await expect(dialog.locator('.send-confirm-details')).toContainText(/Proposta V/);
 expect(await page.evaluate(()=>window.mailAttempts.length)).toBe(1);
 await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();
 await expect(dialog).toBeVisible();expect(await page.evaluate(()=>window.mailAttempts.length)).toBe(1);
 await expectNoHorizontalOverflow(page);
 await dialog.locator('input[type=checkbox]').check();await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();
 const r=await page.evaluate(async()=>{await window.emailAttempt;return {calls:window.mailAttempts,approved:isSendReviewApproved(),lock:state.sendLocks.email};});
 expect(r.calls).toHaveLength(2);expect(r.calls[0].preview).toBe(true);expect(r.calls[1].approved).toBe(true);
 expect(r.calls[1].reviewedRevision).toBe(r.calls[0].reviewedRevision);expect(r.calls[1].reviewedContentHash).toBe('fixture-content-hash');expect(r.approved).toBe(true);expect(r.lock).toBe(false);
});
for(const change of ['session','proposal','revision','content'])test('single review rejects changed '+change,async({page})=>{
 await prepare(page);const dialog=page.locator('.send-confirm-dialog');await expect(dialog).toBeVisible();await dialog.locator('input[type=checkbox]').check();
 await page.evaluate(change=>{
  if(change==='session')state.session={user:{id:'other-fixture-user'}};
  if(change==='proposal')state.activeProposalId='other-fixture-proposal';
  if(change==='revision')state.editorProposalBase.revision++;
  if(change==='content')fields.notes.value+=' changed';
 },change);
 await dialog.getByRole('button',{name:'Confirmar envio',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('mudou');
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await page.evaluate(()=>window.emailAttempt);
 expect(await page.evaluate(()=>window.mailAttempts.length)).toBe(1);
});
test('cancel keeps saved version but creates no send',async({page})=>{await prepare(page);const dialog=page.locator('.send-confirm-dialog');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await page.evaluate(()=>window.emailAttempt);expect(await page.evaluate(()=>window.mailAttempts.length)).toBe(1);expect(await page.evaluate(()=>state.sendLocks.email)).toBe(false);});
