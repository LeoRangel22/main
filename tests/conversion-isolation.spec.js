const { test, expect } = require('@playwright/test');
const { collectBrowserErrors, expectNoBrowserErrors } = require('./support');
const { createHash } = require('node:crypto');

const opportunityId = '00000000-0000-4000-8000-000000000555';
const opportunityHash = createHash('sha256').update(`ec-events:v1:${opportunityId}`).digest('hex').slice(0,24);

for (const failure of ['throw', 'reject', 'pending', 'missing']) {
  test(`lead é gravado e confirmação aparece quando analytics está ${failure}`, async ({ page }) => {
    const errors = collectBrowserErrors(page);
    const calls = [];
    await page.route('**/analytics.js*', route => route.fulfill({ contentType:'text/javascript', body: failure === 'missing' ? '' : `window.EventAnalytics={bucketGuests:()=>"unknown",bucketCurrency:()=>"unknown",bucketDuration:()=>"unknown",bucketDaysToEvent:()=>"unknown",capture(){${failure==='throw' ? 'throw Error("Analytics failed")' : failure==='reject' ? 'return Promise.reject(Error("Analytics failed"))' : 'return new Promise(()=>{})'}}};` }));
    await page.route('**/rest/v1/rpc/upsert_public_quote_draft**', route => route.fulfill({ status:404, contentType:'application/json', body:'{}' }));
    await page.route('**/rest/v1/rpc/submit_public_quote_request**', route => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ contentType:'application/json', body:JSON.stringify([{opportunity_id:opportunityId}]) });
    });
    await page.goto('/formulario.html');
    await page.locator('#requestEventDate').fill('2026-12-20');
    await page.locator('#requestClientName').fill('Cliente de teste');
    await page.locator('#requestClientEmail').fill('fixture@example.test');
    await page.locator('#submitClientQuoteBtn').click();
    await expect(page.locator('#clientFormStatus')).toContainText('Solicitação enviada');
    expect(calls).toHaveLength(1);
    expect(calls[0].p_snapshot.cliente.nome).toBe('Cliente de teste');
    expect(calls[0].p_snapshot.cliente.email).toBe('fixture@example.test');
    expect(calls[0].p_snapshot.evento.data).toBe('2026-12-20');
    expect(calls[0].p_capture_token).toMatch(/^[a-f0-9-]{36}$/i);
    await expect(page.locator('#submitClientQuoteBtn')).toBeEnabled();
    await expectNoBrowserErrors(errors);
  });
}

test('lead usa oportunidade retornada pelo banco sem enviar referência ou contato ao analytics', async ({ page }) => {
  const events = [];
  await page.addInitScript(() => { window.__EVENT_ANALYTICS_FORCE__=true; });
  await page.route('https://us.i.posthog.com/**', route => { events.push(route.request().postDataJSON()); return route.fulfill({contentType:'application/json',body:'{"status":1}'}); });
  await page.route('**/rest/v1/rpc/upsert_public_quote_draft**', route => route.fulfill({status:404,contentType:'application/json',body:'{}'}));
  await page.route('**/rest/v1/rpc/submit_public_quote_request**', route => route.fulfill({contentType:'application/json',body:JSON.stringify([{opportunity_id:opportunityId}])}));
  await page.goto('/formulario.html');
  await page.locator('#requestEventDate').fill('2026-12-20');
  await page.locator('#requestClientName').fill('Cliente confidencial');
  await page.locator('#requestClientEmail').fill('private@example.test');
  await page.locator('#submitClientQuoteBtn').click();
  await expect(page.locator('#clientFormStatus')).toContainText('Solicitação enviada');
  await expect.poll(()=>events.find(e=>e.event==='lead_created')?.properties.entity_hash).toBe(opportunityHash);
  const lead=events.find(e=>e.event==='lead_created');
  expect(lead.properties.entity_key_kind).toBe('opportunity');
  expect(lead.properties.is_test).toBe(true);
  expect(JSON.stringify(events)).not.toMatch(/Cliente confidencial|private@example.test|00000000-0000-4000-8000-000000000555/);
});

for (const failure of ['throw', 'reject', 'pending']) {
  test(`resposta pública continua disponível com analytics ${failure}`, async ({ page }) => {
    const errors=collectBrowserErrors(page);
    const calls=[];
    await page.route('**/analytics.js*', route=>route.fulfill({contentType:'text/javascript',body:`window.EventAnalytics={bucketGuests:()=>"unknown",bucketCurrency:()=>"unknown",bucketDuration:()=>"unknown",bucketDaysToEvent:()=>"unknown",capture(){${failure==='throw'?'throw Error("Analytics failed")':failure==='reject'?'return Promise.reject(Error("Analytics failed"))':'return new Promise(()=>{})'}}};`}));
    await page.route('**/rest/v1/rpc/**', route=>{
      const name=route.request().url().split('/').pop();
      if(name==='get_public_proposal') return route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'00000000-0000-4000-8000-000000000222',status:'proposta_enviada',total:2240,convidados:30,snapshot:{publicRevision:1,analyticsEntityHash:opportunityHash,event:{type:'Coffee Break'},selectedItems:[]}}])});
      if(name==='respond_public_proposal_v2') { calls.push(route.request().postDataJSON()); return route.fulfill({contentType:'application/json',body:'[{"ok":true}]'}); }
      return route.fulfill({contentType:'application/json',body:'[]'});
    });
    await page.goto('/proposta.html?p=00000000-0000-4000-8000-000000000111');
    await page.getByRole('button',{name:'Pedir ajuste',exact:true}).click();
    await expect(page.locator('#publicProposalResponseForm')).toBeVisible();
    await page.locator('#publicResponseMessage').fill('Ajustar para quarenta convidados.');
    await page.locator('#publicSubmitResponse').click();
    await expect(page.locator('#publicProposalStatus')).toContainText('Resposta registrada');
    expect(calls).toHaveLength(1);
    expect(calls[0].action).toBe('alteracao');
    expect(calls[0].message).toBe('Ajustar para quarenta convidados.');
    expect(calls[0].expected_revision).toBe(1);
    await expectNoBrowserErrors(errors);
  });
}

test('proposta pública distingue ação disponível, alternativa apresentada e recusa da gravação', async ({ page }) => {
  const events=[];
  await page.addInitScript(()=>{window.__EVENT_ANALYTICS_FORCE__=true;});
  await page.route('https://us.i.posthog.com/**',route=>{events.push(route.request().postDataJSON());return route.fulfill({contentType:'application/json',body:'{"status":1}'});});
  await page.route('**/rest/v1/rpc/**',route=>{
    const name=route.request().url().split('/').pop();
    if(name==='get_public_proposal') return route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'00000000-0000-4000-8000-000000000222',status:'proposta_enviada',total:2240,snapshot:{publicRevision:1,analyticsEntityHash:opportunityHash,event:{type:'Coffee Break'},publicOfferOptions:[{base:true,name:'Atual',total:2240},{base:false,name:'Workshop',total:3000}],selectedItems:[]}}])});
    if(name==='respond_public_proposal_v2') return route.fulfill({status:409,contentType:'application/json',body:'{"code":"PT409","message":"Stale revision"}'});
    return route.fulfill({contentType:'application/json',body:'[]'});
  });
  await page.goto('/proposta.html?p=00000000-0000-4000-8000-000000000111');
  await expect.poll(()=>events.find(e=>e.event==='proposal_decision_presented')?.properties.response_available).toBe(true);
  await expect.poll(()=>events.filter(e=>e.event==='proposal_upsell_presented').length).toBe(1);
  await page.getByRole('button',{name:'Pedir ajuste',exact:true}).click();
  await page.locator('#publicResponseMessage').fill('Alterar horário.');
  await page.locator('#publicSubmitResponse').click();
  await expect.poll(()=>events.find(e=>e.event==='proposal_response_failed')?.properties.reason_code).toBe('stale_revision');
  expect(events.some(e=>e.event==='client_replied')).toBe(false);
  expect(events.find(e=>e.event==='proposal_viewed').properties.entity_hash).toBe(opportunityHash);
  await expect(page.locator('#publicSubmitResponse')).toBeEnabled();
});
