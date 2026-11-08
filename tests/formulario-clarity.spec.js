const {test,expect}=require('@playwright/test');
async function isolate(page){
 const calls=[],outside=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.pathname.endsWith('/vendor/supabase.js'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>({rpc:(name,payload)=>window.clarityRpc(name,payload),auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};'});
  if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  outside.push(u.origin+u.pathname);return route.abort();
 });
 await page.exposeFunction('clarityRpc',(name,payload)=>{if(!['upsert_public_quote_draft','submit_public_quote_request'].includes(name))throw Error('Unexpected RPC');calls.push({name,payload});return{data:[{request_id:'00000000-0000-4000-8000-000000000101',opportunity_id:'00000000-0000-4000-8000-000000000102',capture_token:payload.p_capture_token}],error:null};});
 return{calls,outside,errors};
}
async function contact(page){await page.locator('#requestClientName').fill('Synthetic Visitor');await page.locator('#requestClientEmail').fill('visitor@example.invalid');}
function clean(f){expect(f.outside).toEqual([]);expect(f.errors).toEqual([]);}
const labels={pt:{missing:'Não informado',select:'Selecionar',selected:'Selecionado',optional:'opcional'},en:{missing:'Not provided',select:'Select',selected:'Selected',optional:'optional'},es:{missing:'Sin informar',select:'Seleccionar',selected:'Seleccionado',optional:'opcional'}};
for(const lang of ['pt','en','es']){
 test('untouched defaults are unknown, yet contact-only draft capture works '+lang,async({page})=>{
  const f=await isolate(page);await page.goto('/formulario.html?lang='+lang);
  await expect(page.locator('#requestGuestCount')).toHaveValue('');await expect(page.locator('#requestDateIsFlexible')).toHaveValue('');
  await expect(page.locator('#requestGuestOutput')).toHaveText(labels[lang].missing);await expect(page.locator('#requestGuestCount')).not.toHaveAttribute('aria-invalid','true');
  expect(await page.evaluate(()=>getSnapshot('synthetic').evento)).toMatchObject({convidados:null,dataFlexivelStatus:'',tipo:''});
  await contact(page);await page.evaluate(()=>savePartialLead());await expect(page.locator('#partialCaptureStatus')).toHaveAttribute('data-state','saved');
  expect(f.calls.at(-1).payload.p_snapshot.evento).toMatchObject({convidados:null,dataFlexivelStatus:'',tipo:''});
  await page.locator('#requestDateFlex').fill('February 2099');await page.locator('#submitClientQuoteBtn').click();
  await expect(page.locator('#requestGuestCount')).toBeFocused();await expect(page.locator('#requestGuestCount')).toHaveAttribute('aria-invalid','true');
  expect(f.calls.filter(c=>c.name==='submit_public_quote_request')).toHaveLength(0);
  await page.locator('#requestGuestCount').fill('30');await page.locator('#submitClientQuoteBtn').click();
  await expect.poll(()=>f.calls.filter(c=>c.name==='submit_public_quote_request').length).toBe(1);
  expect(f.calls.find(c=>c.name==='submit_public_quote_request').payload.p_snapshot.evento).toMatchObject({convidados:30,dataFlexivelStatus:''});
  await expect(page.locator('#requestGuestCount')).toHaveValue('');await expect(page.locator('#requestDateIsFlexible')).toHaveValue('');clean(f);
 });
 test('suggestion is not a selected format; keyboard choice and optional review agree '+lang,async({page})=>{
  const f=await isolate(page);await page.goto('/formulario.html?lang='+lang);await page.locator('#formPersonalizeNav').click();await page.locator('[data-choice-value="weekday-morning"]').click();
  const card=page.locator('.format-card').first();await expect(card).toHaveAttribute('aria-pressed','false');await expect(card.locator('b')).toHaveText(labels[lang].select);
  await expect(page.locator('#requestEventType')).toHaveValue('');await expect(page.locator('[data-review-step="recommendation"]')).toHaveClass(/is-optional/);
  const hover=await card.evaluate(el=>getComputedStyle(el).backgroundColor);await card.hover();const hovered=await card.evaluate(el=>getComputedStyle(el).backgroundColor);
  await card.focus();await page.keyboard.press('Enter');await expect(card).toHaveAttribute('aria-pressed','true');await expect(card.locator('b')).toHaveText(labels[lang].selected);
  // Pointer hover alone must not be indistinguishable from a committed selection.
  await expect.poll(()=>card.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(hovered);
  expect(await page.locator('#requestEventType').inputValue()).not.toBe('');
  const chosen=await page.locator('#requestEventType').inputValue();await page.locator('[data-choice-value="late-afternoon"]').click();await expect(page.locator('#requestEventType')).toHaveValue(chosen);
  expect(await page.locator('.format-card[aria-pressed="true"]').count()).toBe(1);clean(f);
 });
 test('all optional details can stay blank without warning or blocking submission '+lang,async({page})=>{
  const f=await isolate(page);await page.goto('/formulario.html?lang='+lang);await page.locator('#formPersonalizeNav').click();await page.locator('[data-choice-value="agency-tourism"]').click();
  for(const id of ['companyLabel','endClientLabel','groupNameLabel','dateFlexibleLabel','timeRangeLabel','eventTimeLabel','durationLabel'])await expect(page.locator('#'+id)).toContainText(labels[lang].optional);
  await page.locator('#requestGuestCount').fill('80');await page.locator('#requestEventDate').fill('2099-02-20');await contact(page);
  await expect(page.locator('#finalReviewGrid .is-required')).toHaveCount(0);await expect(page.locator('#finalReviewGrid .is-warning')).toHaveCount(0);
  await expect(page.locator('[data-review-step="recommendation"]')).toHaveClass(/is-optional/);
  await page.locator('#submitClientQuoteBtn').click();await expect.poll(()=>f.calls.filter(c=>c.name==='submit_public_quote_request').length).toBe(1);
  const snapshot=f.calls.find(c=>c.name==='submit_public_quote_request').payload.p_snapshot;expect(snapshot.evento.convidados).toBe(80);expect(snapshot.cliente).toMatchObject({empresa:'',clienteFinal:'',nomeGrupo:''});clean(f);
 });
}
test('clearing a previously saved count captures unknown, not its previous value',async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=pt');await page.locator('#requestGuestCount').fill('120');await contact(page);await page.evaluate(()=>savePartialLead());
 expect(f.calls.at(-1).payload.p_snapshot.evento.convidados).toBe(120);await page.locator('#requestGuestCount').fill('');await page.evaluate(()=>savePartialLead());
 expect(f.calls.at(-1).payload.p_snapshot.evento.convidados).toBeNull();await expect(page.locator('#requestGuestCount')).toHaveValue('');clean(f);
});
test('slider keyboard and minimum pointer selection are explicit, not defaults',async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=en');const slider=page.locator('#requestGuestSlider');
 await slider.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#requestGuestCount')).toHaveValue('3');
 await page.locator('#requestGuestCount').fill('');await slider.evaluate(el=>{el.value='2';el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));});
 await expect(page.locator('#requestGuestCount')).toHaveValue('2');expect(await page.evaluate(()=>getSnapshot('synthetic').evento.convidados)).toBe(2);clean(f);
});
test('language changes and optional section navigation do not invent or reset answers',async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=pt');await page.locator('#langEnBtn').click();await expect(page.locator('#requestGuestCount')).toHaveValue('');await expect(page.locator('#requestDateIsFlexible')).toHaveValue('');
 await page.locator('#requestGuestCount').fill('35');await page.locator('#requestDateIsFlexible').selectOption('yes');await page.locator('#formPersonalizeNav').click();await page.locator('#personalizeOptions > summary').click();await page.locator('#langEsBtn').click();
 await expect(page.locator('#requestGuestCount')).toHaveValue('35');await expect(page.locator('#requestDateIsFlexible')).toHaveValue('yes');clean(f);
});
test('reusing history preserves known guests and never substitutes 30 for missing guests',async({page})=>{
 const f=await isolate(page);await page.goto('/formulario.html?lang=en');await page.evaluate(()=>applyReturningHistoryAsBase({snapshot:{event:{guests:70}}}));await expect(page.locator('#requestGuestCount')).toHaveValue('70');
 await page.locator('#requestDateIsFlexible').selectOption('no');await page.evaluate(()=>applyReturningHistoryAsBase({snapshot:{event:{}}}));await expect(page.locator('#requestGuestCount')).toHaveValue('');await expect(page.locator('#requestDateIsFlexible')).toHaveValue('');clean(f);
});
for(const width of [320,390,1440])test('clarity text fits width '+width+' with enlarged text',async({page},info)=>{
 const f=await isolate(page);await page.setViewportSize({width,height:900});await page.goto('/formulario.html?lang=es');await page.locator('#formPersonalizeNav').click();await page.locator('[data-choice-value="weekday-morning"]').click();await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.locator('#eventDetailsStep').screenshot({path:info.outputPath('clarity-details-'+width+'.png')});clean(f);
});
