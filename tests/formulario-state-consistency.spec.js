const {test,expect}=require('@playwright/test');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
async function isolate(page,{draft}={}){
 const calls=[],outside=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.endsWith('/vendor/supabase.js'))return route.fulfill({contentType:'text/javascript',body:"window.supabase={createClient:()=>({rpc:(name,payload)=>window.__fixtureRpc(name,payload),auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};"});
  if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  outside.push(u.origin+u.pathname);return route.fulfill({contentType:'application/json',body:'{}'});
 });
 await page.exposeFunction('__fixtureRpc',async(name,payload)=>{
  if(!['upsert_public_quote_draft','submit_public_quote_request'].includes(name))throw Error('UNEXPECTED_FIXTURE_RPC');
  const c={name,payload};calls.push(c);if(name==='upsert_public_quote_draft'&&draft)await draft(c);
  return {data:[{request_id:'00000000-0000-4000-8000-000000000101',opportunity_id:'00000000-0000-4000-8000-000000000102',capture_token:payload.p_capture_token}],error:null};
 });
 return{calls,outside,errors};
}
async function contact(page){await page.locator('#requestClientName').fill('Synthetic Visitor');await page.locator('#requestClientEmail').fill('visitor@example.invalid');await page.locator('#requestEventDate').fill('2099-02-20');}
async function personalized(page){await page.locator('#formPersonalizeNav').click();await page.locator('[data-choice-value="weekday-morning"]').click();await page.locator('[data-choice-value="company"]').click();await page.locator('[data-choice-value="corporate"]').click();await page.locator('[data-format-id="breakfast"]').click();}
function clean(f){expect(f.outside).toEqual([]);expect(f.errors).toEqual([]);}
for(const [lang,selected,review]of[['pt','Selecionado','Revisar preferência'],['en','Selected','Review preference'],['es','Seleccionado','Revisar preferencia']]){
 test('keeps an explicit format outside recommendations and flags review '+lang,async({page})=>{
  const f=await isolate(page);await page.goto('/formulario.html?lang='+lang);await personalized(page);
  const breakfast=page.locator('[data-format-id="breakfast"]');await expect(breakfast).toHaveAttribute('aria-pressed','true');await expect(breakfast.locator('b')).toHaveText(selected);
  await page.locator('[data-choice-value="late-afternoon"]').click();await expect(breakfast).toBeVisible();await expect(breakfast).toHaveAttribute('aria-pressed','true');
  const summary=page.locator('[data-review-step="recommendation"]');await expect(summary).toHaveClass(/is-warning/);await expect(summary.locator('.final-review-status')).toHaveText(review);
  await expect(page.locator('#requestEventType')).toHaveValue('Café da Manhã / Brunch');await expect(page.locator('[data-choice-value="weekday-morning"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-choice-value="late-afternoon"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-choice-value="experience"]').click();await expect(page.locator('[data-choice-value="experience"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-choice-value="corporate"]').click();await expect(page.locator('[data-choice-value="corporate"]')).toHaveAttribute('aria-pressed','false');
  await contact(page);await page.locator('#submitClientQuoteBtn').click();await expect.poll(()=>f.calls.filter(c=>c.name==='submit_public_quote_request').length).toBe(1);
  const payload=f.calls.find(c=>c.name==='submit_public_quote_request').payload;expect(payload.p_snapshot.evento.tipo).toBe('Café da Manhã / Brunch');expect(payload.p_snapshot.evento.momento).toBe('Fim de tarde');
  expect(await page.locator('[data-choice-group][aria-pressed="true"]').count()).toBe(0);clean(f);
 });
}
for(const value of ['','0','1','-1','501','999','2.5'])test('invalid guests remain unchanged and never produce a draft or submit '+JSON.stringify(value),async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=en');await page.locator('#requestGuestCount').fill(value);await contact(page);
 await expect(page.locator('#requestGuestCount')).toHaveValue(value);await expect(page.locator('#requestGuestCount')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#requestGuestCountError')).toContainText('2 to 500');
 await page.evaluate(()=>savePartialLead());expect(f.calls).toEqual([]);await page.locator('#submitClientQuoteBtn').click();
 await expect(page.locator('#clientFormStatus')).toContainText('2 to 500');await expect(page.locator('#requestGuestCount')).toBeFocused();await expect(page.locator('#requestGuestCount')).toHaveValue(value);
 expect(await page.evaluate(()=>getSnapshot('synthetic').evento.convidados)).toBe(null);expect(f.calls).toEqual([]);clean(f);
});
for(const value of ['2','99','100','500'])test('valid guests retain their exact count in captured data '+value,async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=pt');await page.locator('#requestGuestCount').fill(value);await contact(page);await page.evaluate(()=>savePartialLead());
 expect(f.calls.filter(c=>c.name==='upsert_public_quote_draft').at(-1).payload.p_snapshot.evento.convidados).toBe(Number(value));await expect(page.locator('#requestGuestCount')).toHaveValue(value);await expect(page.locator('#requestGuestCount')).not.toHaveAttribute('aria-invalid','true');clean(f);
});
test('invalid count invalidates a saved revision; correction is confirmed separately',async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=pt');await contact(page);await page.evaluate(()=>savePartialLead());await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','saved');
 await page.locator('#requestGuestCount').fill('501');await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','unsaved');await expect(page.locator('#partialCaptureStatus')).toContainText('quantidade de convidados');await page.evaluate(()=>savePartialLead());expect(f.calls.length).toBe(1);
 await page.locator('#requestGuestCount').fill('500');await page.evaluate(()=>savePartialLead());await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','saved');expect(f.calls.length).toBe(2);clean(f);
});
test('late acknowledgement cannot confirm a revision containing invalid guests',async({page})=>{
 const gate=deferred(),f=await isolate(page,{draft:()=>gate.promise});await page.goto('/formulario.html?lang=en');await contact(page);
 await page.evaluate(()=>{window.syntheticSave=savePartialLead()});await expect.poll(()=>f.calls.length).toBe(1);await page.locator('#requestGuestCount').fill('501');gate.resolve();await page.evaluate(()=>window.syntheticSave);
 await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','unsaved');await expect(page.locator('#requestGuestCount')).toHaveValue('501');expect(f.calls.length).toBe(1);clean(f);
});
for(const [lang,badge]of[['pt','revisar'],['en','review'],['es','revisar']])test('localized headings and review badge '+lang,async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang='+lang);await page.locator('#submitClientQuoteBtn').click();
 const badgeText=await page.locator('#eventDetailsTitle').evaluate(el=>getComputedStyle(el,'::after').content);expect(badgeText).toBe('"'+badge+'"');
 if(lang==='es')await expect(page.locator('#momentTitle')).toHaveText('¿Cuándo imaginas tu evento?');clean(f);
});
test('invalid guest message follows language changes without altering input',async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=pt');await page.locator('#requestGuestCount').fill('501');await page.locator('#langEnBtn').click();await expect(page.locator('#requestGuestCountError')).toContainText('whole number');await page.locator('#langEsBtn').click();await expect(page.locator('#requestGuestCountError')).toContainText('número entero');await expect(page.locator('#requestGuestCount')).toHaveValue('501');clean(f);
});
for(const width of [320,1440])test('selection and review stay readable at '+width+'px',async({page})=>{
 const f=await isolate(page);await page.setViewportSize({width,height:900});await page.goto('/formulario.html?lang=es');await personalized(page);await page.locator('[data-choice-value="late-afternoon"]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:require('node:path').join(process.env.FORM_ARTIFACT_DIR||test.info().outputDir,'form-state-'+test.info().project.name+'-'+width+'.png'),fullPage:true});clean(f);
});
