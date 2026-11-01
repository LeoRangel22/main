const {test,expect}=require('@playwright/test');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve};}
const row=body=>[{request_id:'00000000-0000-4000-8000-000000000002',opportunity_id:'00000000-0000-4000-8000-000000000003',capture_token:body.p_capture_token}];
async function setup(page,options={}){
 const calls=[],external=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  const name=u.pathname.split('/').at(-1);
  if(['upsert_public_quote_draft','submit_public_quote_request'].includes(name)){
   const body=route.request().postDataJSON();calls.push({name,body});
   const handler=name==='upsert_public_quote_draft'?options.draft:options.submit;
   const result=handler?await handler(body,calls):{data:row(body)};
   if(result?.abort)return route.abort('internetdisconnected');
   return route.fulfill({status:result?.status||200,contentType:'application/json',body:JSON.stringify(result?.data??result?.error??row(body))});
  }
  external.push({method:route.request().method(),path:u.pathname});return route.abort();
 });
 await page.goto('/formulario.html?lang='+(options.language||'pt'));
 return{calls,external,errors};
}
async function fill(page,{email='person@example.test',phone='',name='Pessoa Sintetica'}={}){
 await page.locator('#requestClientName').fill(name);
 if(email)await page.locator('#requestClientEmail').fill(email);
 if(phone)await page.locator('#requestClientPhone').fill(phone);
}
async function editNotes(page,value){
 if(!await page.locator('#requestNotes').isVisible())await page.locator('#formPersonalizeNav').click();
 await page.locator('#requestNotes').fill(value);
}
async function beginSave(page){await page.evaluate(()=>{window.syntheticDraftSave=savePartialLead();});}
async function saved(page){await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','saved');}
function clean(c){expect(c.external).toEqual([]);expect(c.errors).toEqual([]);}

test('saved feedback belongs to the current revision and a later error clears old success',async({page})=>{
 let fail=false;const c=await setup(page,{draft:body=>fail?{status:503,error:{message:'Synthetic unavailable'}}:{data:row(body)}});
 await fill(page);await beginSave(page);await saved(page);
 fail=true;await editNotes(page,'Revisao sintetica mais nova');
 await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','unsaved');
 await beginSave(page);await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','error');
 await expect(page.locator('#partialCaptureStatus')).not.toContainText('salvo e confirmado');
 await expect(page.locator('#requestNotes')).toHaveValue('Revisao sintetica mais nova');
 const token=c.calls[0].body.p_capture_token;fail=false;await page.locator('#retryPartialCaptureBtn').click();await saved(page);
 expect(c.calls.every(r=>r.body.p_capture_token===token)).toBe(true);clean(c);
});

test('an old response never confirms a newer edit and draft requests are serialized',async({page})=>{
 const gates=[deferred(),deferred()];let index=0;
 const c=await setup(page,{draft:async body=>{const n=index++;await gates[n].promise;return{data:row(body)};}});
 await fill(page);await beginSave(page);await expect.poll(()=>c.calls.length).toBe(1);
 await editNotes(page,'Versao dois');
 await page.evaluate(()=>{window.observedSaveStates=[];const n=document.querySelector('#partialCaptureStatus');new MutationObserver(()=>observedSaveStates.push(n.dataset.state)).observe(n,{attributes:true,attributeFilter:['data-state']});savePartialLead();});
 expect(c.calls.length).toBe(1);gates[0].resolve();await expect.poll(()=>c.calls.length).toBe(2);
 await expect(page.locator('#partialCaptureStatus')).not.toHaveAttribute('data-state','saved');
 expect(await page.evaluate(()=>observedSaveStates.includes('saved'))).toBe(false);
 expect(c.calls[1].body.p_snapshot.evento.observacoes).toBe('Versao dois');gates[1].resolve();await saved(page);clean(c);
});

test('offline failure is recoverable on reconnect with the same capture identity',async({page})=>{
 let disconnected=true;const c=await setup(page,{draft:body=>disconnected?{abort:true}:{data:row(body)}});
 await fill(page);await beginSave(page);await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','error');
 const token=c.calls[0].body.p_capture_token;disconnected=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await saved(page);
 expect(c.calls.every(r=>r.body.p_capture_token===token)).toBe(true);await expect(page.locator('#requestClientName')).toHaveValue('Pessoa Sintetica');clean(c);
});

test('a response without acknowledgement is not saved and repeating a confirmed draft is a no-op',async({page})=>{
 let empty=true;const c=await setup(page,{draft:body=>({data:empty?[]:row(body)})});await fill(page);await beginSave(page);
 await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','error');empty=false;await page.locator('#retryPartialCaptureBtn').click();await saved(page);
 const count=c.calls.length;await page.evaluate(()=>Promise.all([savePartialLead(),savePartialLead()]));expect(c.calls.length).toBe(count);clean(c);
});

test('another tab invalidates this tabs success but does not copy or merge its fields',async({page,context})=>{
 const c=await setup(page);await fill(page);await beginSave(page);await saved(page);
 const other=await context.newPage();await other.goto('/formulario.html?lang=pt');await fill(other,{name:'Outra Pessoa Sintetica'});await beginSave(other);await saved(other);
 await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','external');
 await expect(page.locator('#requestClientName')).toHaveValue('Pessoa Sintetica');await expect(other.locator('#requestClientName')).toHaveValue('Outra Pessoa Sintetica');
 expect(new Set(c.calls.map(r=>r.body.p_capture_token)).size).toBe(1);await other.close();clean(c);
});

test('late draft response after final submit cannot revive autosave or create another request',async({page})=>{
 const gate=deferred();const c=await setup(page,{draft:async body=>{await gate.promise;return{data:row(body)};}});
 await fill(page);await page.locator('#requestEventDate').fill('2099-11-20');await beginSave(page);await expect.poll(()=>c.calls.length).toBe(1);
 await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submitted');
 gate.resolve();await page.evaluate(()=>syntheticDraftSave);await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submitted');
 expect(c.calls.filter(r=>r.name==='submit_public_quote_request')).toHaveLength(1);expect(new Set(c.calls.map(r=>r.body.p_capture_token)).size).toBe(1);clean(c);
});

test('submit response lost after commit preserves later edits and does not claim them saved or retry a changed body',async({page})=>{
 const c=await setup(page,{submit:()=>({abort:true})});await fill(page);await page.locator('#requestEventDate').fill('2099-11-20');
 await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submissionUncertain');
 const before=c.calls.length;await editNotes(page,'Alteracao apos envio incerto');await beginSave(page);
 await expect(page.locator('#partialCaptureStatus')).not.toHaveAttribute('data-state','saved');expect(c.calls.length).toBe(before);
 await page.locator('#submitClientQuoteBtn').click();expect(c.calls.length).toBe(before);await expect(page.locator('#requestNotes')).toHaveValue('Alteracao apos envio incerto');
 await page.reload();await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submissionUncertain');clean(c);
});

test('an unchanged final retry reuses the first request token and snapshot',async({page})=>{
 let fail=true;const c=await setup(page,{submit:body=>fail?{abort:true}:{data:row(body)}});await fill(page);await page.locator('#requestEventDate').fill('2099-11-20');
 await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submissionUncertain');
 fail=false;await page.locator('#submitClientQuoteBtn').click();await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submitted');
 const final=c.calls.filter(r=>r.name==='submit_public_quote_request');expect(final).toHaveLength(2);expect(final[1].body).toEqual(final[0].body);clean(c);
});

test('edits made while final submit is pending are not discarded on confirmation',async({page})=>{
 const gate=deferred();const c=await setup(page,{submit:async body=>{await gate.promise;return{data:row(body)};}});await fill(page);await page.locator('#requestEventDate').fill('2099-11-20');
 await page.locator('#submitClientQuoteBtn').click();await expect.poll(()=>c.calls.some(r=>r.name==='submit_public_quote_request')).toBe(true);
 await editNotes(page,'Mudanca feita durante envio');gate.resolve();await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submittedChanges');
 await expect(page.locator('#requestNotes')).toHaveValue('Mudanca feita durante envio');await expect(page.locator('#clientFormStatus')).toContainText('não foram enviadas');
 expect(await page.evaluate(()=>localStorage.getItem('embaixada_form_submit_pending_v1')===getCaptureToken())).toBe(true);
 const count=c.calls.length;await page.reload();await fill(page);await beginSave(page);
 await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submissionUncertain');expect(c.calls.length).toBe(count);clean(c);
});

test('autosave checks a persistent pending marker even when a cross-tab signal was missed',async({page})=>{
 const c=await setup(page);await fill(page);await beginSave(page);await saved(page);const count=c.calls.length;
 await page.evaluate(()=>localStorage.setItem('embaixada_form_submit_pending_v1',getCaptureToken()));await beginSave(page);
 await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submissionUncertain');expect(c.calls.length).toBe(count);clean(c);
});

for(const language of ['pt','en','es'])for(const [label,email,phone,accepted,target] of [
 ['email only','person@example.test','',true,null],['phone only','', '+55 21 99999-0000',true,null],['both','person@example.test','+55 21 99999-0000',true,null],
 ['neither','','',false,'#requestClientEmail'],['invalid email','bad','',false,'#requestClientEmail'],['invalid phone','','123',false,'#requestClientPhone'],
 ['invalid extra email','bad','+55 21 99999-0000',false,'#requestClientEmail'],['invalid extra phone','person@example.test','123',false,'#requestClientPhone'],
])test(`contact ${label}: ${language} keeps email OR phone and announces exact errors`,async({page})=>{
 const c=await setup(page,{language});await fill(page,{email,phone});await page.locator('#requestEventDate').fill('2099-11-20');
 for(const id of ['#requestClientEmail','#requestClientPhone']){await expect(page.locator(id)).not.toHaveAttribute('required');await expect(page.locator(id)).toHaveAttribute('aria-required','false');}
 await page.locator('#submitClientQuoteBtn').focus();await page.keyboard.press('Enter');
 if(accepted){await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','submitted');expect(c.calls.filter(r=>r.name==='submit_public_quote_request')).toHaveLength(1);}
 else{
  const field=page.locator(target);await expect(field).toBeFocused();await expect(field).toHaveAttribute('aria-invalid','true');
  const id=await field.getAttribute('aria-errormessage');expect(id).toBeTruthy();await expect(page.locator('#'+id)).toBeVisible();await expect(page.locator('#'+id)).not.toHaveText('');
  expect((await field.getAttribute('aria-describedby')).split(/\s+/)).toContain(id);await expect(page.locator('#clientFormStatus')).toHaveAttribute('aria-live','polite');expect(c.calls.filter(r=>r.name==='submit_public_quote_request')).toHaveLength(0);
 }
 clean(c);
});

test('existing inline errors translate on language change without validating untouched fields',async({page})=>{
 const c=await setup(page);await page.locator('#requestClientPhone').fill('123');await page.locator('#requestClientPhone').blur();
 const error=page.locator('#requestClientPhoneError');const pt=await error.textContent();
 await page.getByRole('button',{name:'EN',exact:true}).click();const en=await error.textContent();expect(en).not.toBe(pt);
 await page.getByRole('button',{name:'ES',exact:true}).click();const es=await error.textContent();expect(es).not.toBe(en);expect(es).not.toBe(pt);
 await expect(page.locator('#requestClientPhone')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#requestClientName')).not.toHaveAttribute('aria-invalid');clean(c);
});

for(const language of ['pt','en','es'])test(`mobile enlarged errors and autosave feedback remain usable in ${language}`,async({page})=>{
 await page.setViewportSize({width:320,height:900});const c=await setup(page,{language,draft:()=>({status:503,error:{message:'Synthetic unavailable'}})});
 await fill(page);await beginSave(page);await expect(page.locator('#retryPartialCaptureBtn')).toBeVisible();
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 await expect(page.locator('#retryPartialCaptureBtn')).toHaveAccessibleName(/\S/);
 if(process.env.EVENT_FORM_VISUAL_DIR){const path=require('node:path');await page.locator('#contactStep').screenshot({path:path.join(process.env.EVENT_FORM_VISUAL_DIR,`save-error-${language}-320-text200.png`)});}
 await page.locator('#requestClientPhone').fill('123');await page.locator('#requestClientPhone').blur();
 const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 await expect(page.locator('#requestClientPhone')).toHaveAccessibleName(/\S/);
 if(process.env.EVENT_FORM_VISUAL_DIR){const path=require('node:path');await page.locator('#contactStep').screenshot({path:path.join(process.env.EVENT_FORM_VISUAL_DIR,`contact-${language}-320-text200.png`)});}
 clean(c);
});
