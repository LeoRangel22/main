const { test, expect } = require('@playwright/test');
const { collectBrowserErrors, expectNoBrowserErrors, expectNoHorizontalOverflow } = require('./support');

async function setup(page) {
  await page.route('https://**', route => route.abort());
  await page.goto('/index.html?qa=1');
  await page.evaluate(() => {
    const template = structuredClone(state.proposals.find(p => p.id === 'qa-proposal-sem-resposta'));
    const make = (id, changes = {}) => ({
      ...structuredClone(template), id, oportunidade_id: id, solicitacao_id: null,
      cliente_nome: `Fixture ${id}`, data_evento: '2099-11-04', status: 'negociacao',
      is_current: true, publication_status: 'sent', versao: 1, sent_at: null,
      cliente_resposta: null, cliente_resposta_em: null, cliente_solicitacao: null,
      snapshot: { ...structuredClone(template.snapshot), clienteResposta: null, pagamentoSinal: null, pagamentoRestante: null },
      ...changes,
    });
    const paid = { valor: 500, validacaoPendente: false, validadoPor: 'Fixture Financeiro', validadoEm: '2026-01-01T12:00:00Z' };
    state.proposals = [
      make('approved', { cliente_resposta: 'confirmar' }),
      make('negotiation'),
      make('sent', { status: 'proposta_enviada', sent_at: '2026-01-01T12:00:00Z' }),
      make('changes', { cliente_resposta: 'alteracao' }),
      make('draft', { cliente_resposta: 'confirmar', publication_status: 'draft', is_current: false }),
      make('validation', { cliente_resposta: 'confirmar', snapshot: { pagamentoSinal: { valor: 500, validacaoPendente: true } } }),
      make('paid-inconsistent', { cliente_resposta: 'confirmar', snapshot: { pagamentoSinal: paid } }),
      make('legacy-booked', { status: 'confirmado', cliente_resposta: 'confirmar' }),
      make('won', { status: 'confirmado', cliente_resposta: 'confirmar', snapshot: { pagamentoSinal: paid } }),
      make('cancelled', { status: 'cancelado', cliente_resposta: 'confirmar' }),
      make('post-sale', { status: 'pos_venda', cliente_resposta: 'confirmar' }),
      make('old-approved-version', { oportunidade_id: 'current-revision', is_current: false, cliente_resposta: 'confirmar' }),
      make('current-revision', { versao: 2, cliente_resposta: 'alteracao' }),
    ];
    state.quoteRequests = []; state.opportunities = [];
    eventOps.messages = []; eventOps.loadedFor = state.session.user.id;
    eventOps.error = ''; eventOps.loading = null;
    state.activePipelineFilter = 'all'; renderPipeline();
  });
  await page.locator('[data-workspace-mode="full"]').click();
  await page.locator('.reports-panel > summary').click();
}

async function expectParity(page, expected) {
  await expect(page.locator('[data-sales-funnel="approved"] strong')).toHaveText(String(expected.length));
  const finance = page.locator('#financeCommandPanel article').filter({ hasText: 'Aprovadas · aguardam sinal' });
  await expect(finance).toBeVisible();
  await expect(finance.locator('strong')).toHaveText(String(expected.length));
  await page.locator('#pipelineQuickFilters [data-pipeline-filter="awaitingSignal"]:not(.pipeline-active-filter)').click();
  await expect(page.locator('#pipelineBoard .pipeline-card')).toHaveCount(expected.length);
  for (const id of expected) await expect(page.locator('#pipelineBoard')).toContainText(`Fixture ${id}`);
  await page.locator('[data-report-preset="approvedAwaitingSignal"]').click();
  await expect(page.locator('#reportOutput .report-summary dl > div').filter({ hasText: 'Total' }).locator('dd')).toHaveText(String(expected.length));
  await expect(page.locator('#reportOutput .report-item')).toHaveCount(expected.length);
  for (const id of expected) await expect(page.locator('#reportOutput .report-list')).toContainText(`Fixture ${id}`);
}

for (const width of [1440, 390]) test(`signal counts agree across funnel, finance, filter and report at ${width}px`, async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width, height: 1000 });
  await setup(page);
  const before = await page.evaluate(() => JSON.stringify(state.proposals));
  await expectParity(page, ['approved']);
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(() => JSON.stringify(state.proposals))).toBe(before);

  // Only the synthetic fixture changes; UI reads must not mutate it.
  await page.evaluate(() => {
    state.proposals.find(p => p.id === 'approved').snapshot.pagamentoSinal = { valor: 500, validacaoPendente: true };
    renderPipeline();
  });
  const pending = await page.evaluate(() => JSON.stringify(state.proposals));
  await expectParity(page, []);
  await expect(page.locator('[data-sales-funnel="validation"] strong')).toHaveText('2');
  expect(await page.evaluate(() => JSON.stringify(state.proposals))).toBe(pending);
  await page.evaluate(() => {
    const p = state.proposals.find(p => p.id === 'approved');
    p.status = 'confirmado';
    p.snapshot.pagamentoSinal = { valor: 500, validacaoPendente: false, validadoPor: 'Fixture Financeiro', validadoEm: '2026-01-01T12:00:00Z' };
    renderPipeline();
  });
  const paid = await page.evaluate(() => JSON.stringify(state.proposals));
  await expectParity(page, []);
  await expect(page.locator('[data-sales-funnel="won"] strong')).toHaveText('2');
  expect(await page.evaluate(() => JSON.stringify(state.proposals))).toBe(paid);
  await expectNoBrowserErrors(errors);
});
