const { test, expect } = require('@playwright/test');
async function setup(page, width = 1440) {
  const remote = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(u.hostname)) return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    remote.push({ method: route.request().method(), path: u.pathname }); return route.abort();
  });
  await page.goto('/clientes.html?qa=1');
  await page.evaluate(() => {
    const sample = structuredClone(state.proposals[0]);
    const make = (id, name, email, phone, changes = {}) => ({
      ...structuredClone(sample), id, oportunidade_id: id, solicitacao_id: null,
      cliente_nome: name, cliente_email: email, cliente_whatsapp: phone,
      empresa: 'Empresa sintética', cliente_empresa: 'Empresa sintética', tipo_evento: 'Coquetel',
      data_evento: '2099-11-04', horario_evento: '19:00', duracao: 3, convidados: 25, total: 1200,
      status: 'negociacao', publication_status: 'sent', is_current: true, versao: 2,
      cliente_resposta: null, cliente_mensagem: null, cliente_solicitacao: null, sent_at: null,
      snapshot: { ...sample.snapshot, referencia: id,
        client: { name, email, phone, company: 'Empresa sintética', guests: 25 },
        event: { type: 'Coquetel', date: '2099-11-04', time: '19:00', duration: 3 },
        pagamentoSinal: null, pagamentoRestante: null, clienteResposta: null,
      }, ...changes,
    });
    const first = make('synth-a1', 'Marina Duarte', 'one@example.test', '21987654321', { cliente_resposta: 'alteracao' });
    const second = make('synth-a2', 'Marina Alves Duarte', 'one@example.test', '21987654321', {
      data_evento: '2099-11-05', duracao: null, convidados: null, total: 2400, versao: 1,
    });
    second.snapshot.event.duration = null; second.snapshot.client.guests = null;
    state.proposals = [first, second,
      make('synth-b1', 'Marina Alves Duarte Costa', 'two@example.test', '(21) 98765-4321', { total: 9876, cliente_resposta: 'confirmar' }),
      make('synth-c1', 'Bruno Tavares', 'three@example.test', '21911112222'),
      make('synth-d1', 'Marina Duarte Costa', '', ''),
    ];
    state.quoteRequests = []; state.opportunities = [];
    fields.globalSearchInput.value = '';
    renderClientRegistry(getPipelineItems());
  });
  await expect(page.locator('.client-registry-card')).toHaveCount(4);
  return { remote, errors };
}
function firstClient(page) { return page.locator('.client-registry-card').filter({ hasText: 'one@example.test' }); }
test('P1 client next step distinguishes adjustment and acceptance without collecting signal', async ({ page }) => {
  const { remote, errors } = await setup(page);
  await expect(firstClient(page).locator('.client-registry-next')).toContainText('pedido de alteração');
  await expect(firstClient(page).locator('.client-registry-profile')).toContainText('Mais de uma cotação aberta');
  const accepted = page.locator('.client-registry-card').filter({ hasText: 'two@example.test' });
  await expect(accepted.locator('.client-registry-next')).toContainText('Aceite não confirma reserva');
  await expect(page.locator('#clientDirectory')).not.toContainText('Resolver ajustes e avançar para sinal');
  expect(remote).toEqual([]); expect(errors).toEqual([]);
});
test('P1 pending proof routes to review, not another collection', async ({ page }) => {
  const { remote, errors } = await setup(page);
  await page.evaluate(() => {
    state.proposals[0].snapshot.pagamentoSinal = { valor: 100, validacaoPendente: true };
    renderClientRegistry(getPipelineItems());
  });
  await expect(firstClient(page).locator('.client-registry-next')).toContainText('Financeiro');
  expect(remote).toEqual([]); expect(errors).toEqual([]);
});
for (const width of [320, 390, 1440]) test(`P2 contact hints and quote comparison remain readable at ${width}px`, async ({ page }) => {
  const { remote, errors } = await setup(page, width);
  const client = firstClient(page);
  const review = client.locator('.client-contact-review');
  const before = await page.evaluate(() => JSON.stringify(state.proposals));
  await review.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(review).toHaveAttribute('open', '');
  await expect(review).toContainText('e-mails diferentes');
  await expect(review).toContainText('Apenas nome semelhante');
  await expect(review).not.toContainText('9876');
  await expect(review).not.toContainText('synth-b1');
  await expect(review).toContainText('Nenhum cadastro ou histórico foi unido');
  const comparison = client.locator('.client-quote-comparison');
  await comparison.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(comparison).toHaveAttribute('open', '');
  await expect(comparison.locator('tbody tr')).toHaveCount(2);
  await expect(comparison).toContainText('Duração a definir');
  await expect(comparison).toContainText('Quantidade a definir');
  await expect(comparison).toContainText('3 h');
  await expect(comparison).toContainText('25 pessoas');
  const region = comparison.getByRole('region', { name: 'Comparação das cotações atuais' });
  await region.focus(); await expect(region).toBeFocused();
  const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(e => { const r=e.getBoundingClientRect(); return r.width > innerWidth && getComputedStyle(e).overflowX !== 'auto'; }).slice(0, 20).map(e => ({tag:e.tagName, className:e.className, width:e.getBoundingClientRect().width, minWidth:getComputedStyle(e).minWidth, grid:getComputedStyle(e).gridTemplateColumns})) }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1);
  expect(await page.evaluate(() => JSON.stringify(state.proposals))).toBe(before);
  expect(remote).toEqual([]); expect(errors).toEqual([]);
  await client.screenshot({ path: `../client-review-${width}.png` });
});
test('P2 pipeline comparison keeps absent total distinct from an explicit zero', async ({ page }) => {
  const { remote, errors } = await setup(page);
  await page.evaluate(() => {
    state.proposals[0].total = null;
    state.proposals[0].snapshot.totals = { total: 999 };
    state.proposals[1].total = 0;
    renderClientRegistry(getPipelineItems());
  });
  const comparison = firstClient(page).locator('.client-quote-comparison');
  await comparison.locator('summary').click();
  await expect(comparison.locator('tbody tr').filter({ hasText: /synth-a1/i }).locator('td').nth(2)).toHaveText('A definir');
  await expect(comparison.locator('tbody tr').filter({ hasText: /synth-a2/i }).locator('td').nth(2)).toHaveText(/R\$\s*0,00/);
  expect(remote).toEqual([]); expect(errors).toEqual([]);
});
test('P2 search and empty state do not invent identity associations', async ({ page }) => {
  const { remote, errors } = await setup(page);
  await page.locator('#globalSearchInput').fill('nobody-matches-this');
  await expect(page.locator('#clientDirectory')).toContainText('Nenhum cliente encontrado');
  await page.locator('#globalSearchInput').fill('');
  await expect(page.locator('.client-registry-card')).toHaveCount(4);
  await page.evaluate(() => renderClientRegistry([]));
  await expect(page.locator('#clientDirectory')).toContainText('Nenhum cliente carregado ainda');
  await expect(page.locator('.client-contact-review')).toHaveCount(0);
  expect(remote).toEqual([]); expect(errors).toEqual([]);
});
