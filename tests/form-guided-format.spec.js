const {test,expect}=require('@playwright/test');
const {isolateJourney,clean}=require('./client-journey-fixtures.cjs');
for(const [lang,outside,weekend]of [['pt','fora dessa sugestão','fim de semana'],['en','outside this suggestion','weekend'],['es','fuera de esta sugerencia','fin de semana']]){
 test('initial formats guide date/time without silently changing them '+lang,async({page})=>{
  const audit=await isolateJourney(page);await page.goto('/formulario.html?lang='+lang);
  await expect(page.locator('#personalizeOptions')).not.toHaveAttribute('open','');
  await expect(page.locator('[data-quick-format]')).toHaveCount(3);
  await expect(page.locator('#endClientField')).toBeHidden();await expect(page.locator('#groupNameField')).toBeHidden();
  await page.locator('#requestEventDate').fill('2027-02-20');await page.locator('#requestTimeRange').selectOption('afternoon');await page.locator('#requestEventTime').selectOption('17:00');
  // Commit the native control before clicking elsewhere; WebKit keeps date pickers open after fill.
  await page.locator('#requestEventTime').press('Tab');
  const cocktail=page.locator('[data-quick-format="cocktail"]');await cocktail.click();await expect(cocktail).toBeFocused();await expect(cocktail).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#quickFormatAdvice')).toContainText(outside);await expect(page.locator('#requestEventTime')).toHaveValue('17:00');
  await expect(page.locator('#requestEventDate')).toHaveValue('2027-02-20');await expect(page.locator('#requestEventType')).toHaveValue('Coquetel');
  await page.locator('#requestEventTime').selectOption('18:00');await expect(page.locator('#quickFormatAdvice')).not.toContainText(outside);
  await page.locator('#requestEventDate').fill('2027-02-19');await page.locator('#requestEventDate').press('Tab');await page.locator('#requestEventTime').selectOption('17:00');await expect(page.locator('#quickFormatAdvice')).not.toContainText(outside);
  await page.locator('[data-quick-format="breakfast"]').click();await expect(page.locator('#requestEventTime')).toHaveValue('17:00');await expect(page.locator('#quickFormatAdvice')).toContainText(outside);
  await page.locator('#requestTimeRange').selectOption('morning');await page.locator('#requestEventTime').selectOption('09:00');await page.locator('#requestEventDate').fill('2027-02-21');await page.locator('#requestEventDate').press('Tab');
  await expect(page.locator('#quickFormatAdvice')).toContainText(weekend);await expect(page.locator('#requestEventTime')).toHaveValue('09:00');
  const w=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(w.scroll).toBeLessThanOrEqual(w.width+1);expect(audit.calls).toEqual([]);clean(audit);
 });
}
test('an outside-suggestion time can be submitted once without changing the payload',async({page})=>{
 const audit=await isolateJourney(page);await page.goto('/formulario.html');
 await page.locator('[data-quick-format="cocktail"]').click();await page.locator('#requestEventDate').fill('2027-02-20');await page.locator('#requestTimeRange').selectOption('afternoon');await page.locator('#requestEventTime').selectOption('17:00');
 await page.locator('#requestClientName').fill('Synthetic Visitor');await page.locator('#requestClientEmail').fill('visitor@example.invalid');await page.locator('#submitClientQuoteBtn').click();
 await expect.poll(()=>audit.calls.filter(c=>c.name==='submit_public_quote_request').length).toBe(1);
 const payload=audit.calls.find(c=>c.name==='submit_public_quote_request').payload;
 expect(payload.p_snapshot.evento.tipo).toBe('Coquetel');expect(payload.p_snapshot.evento.horario).toBe('17:00');expect(payload.p_snapshot.evento.data).toBe('2027-02-20');clean(audit);
});
test('profile and language changes preserve entered agency and group information',async({page})=>{
 const audit=await isolateJourney(page);await page.goto('/formulario.html');
 await page.locator('#formPersonalizeNav').click();await page.locator('[data-choice-value="agency-tourism"]').click();
 await page.locator('#requestEndClientName').fill('Synthetic Final Client');await page.locator('#requestGroupName').fill('Synthetic Group');
 await page.locator('[data-choice-value="person"]').click();await page.locator('[data-lang="es"]').click();
 await expect(page.locator('#requestEndClientName')).toHaveValue('Synthetic Final Client');await expect(page.locator('#requestGroupName')).toHaveValue('Synthetic Group');await expect(page.locator('#endClientField')).toBeVisible();await expect(page.locator('#groupNameField')).toBeVisible();clean(audit);
});
test('keyboard choices reflow at320px and200percent text',async({page})=>{
 const audit=await isolateJourney(page);await page.setViewportSize({width:320,height:600});await page.goto('/formulario.html');await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 const choice=page.locator('[data-quick-format="recommendation"]');await choice.focus();await choice.press('Enter');await expect(choice).toBeFocused();await expect(choice).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#requestTimeRange')).toHaveValue('');const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);expect(audit.calls).toEqual([]);clean(audit);
});


test('a failed optional guidance asset leaves the essential request usable',async({page})=>{const audit=await isolateJourney(page);await page.route('**/form-guidance.js*',route=>route.abort());await page.goto('/formulario.html');await expect(page.locator('.form-format-start')).toBeHidden();await page.locator('#requestEventDate').fill('2027-02-20');await page.locator('#requestEventDate').press('Tab');await page.locator('#requestClientName').fill('Synthetic Visitor');await page.locator('#requestClientEmail').fill('visitor@example.invalid');await page.locator('#submitClientQuoteBtn').click();await expect.poll(()=>audit.calls.filter(c=>c.name==='submit_public_quote_request').length).toBe(1);clean(audit);});
