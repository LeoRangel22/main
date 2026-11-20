const { test, expect } = require('@playwright/test');
const { isolate } = require('./quality-fixtures.cjs');

async function prepare(page, width, height, textScale = 1) {
  const audit = await isolate(page);
  await page.setViewportSize({ width, height });
  await page.goto('/index.html?qa=1');
  await expect(page.locator('body')).toHaveClass(/auth-connected/);
  await page.evaluate(() => openSavedProposal('quality-a1'));
  if (textScale === 2) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const before = await page.evaluate(() => JSON.stringify(state.proposals));
  return { audit, before };
}

async function expectUsableControl(page, selector) {
  const field = page.locator(selector);
  await field.scrollIntoViewIfNeeded();
  await field.focus();
  await expect.poll(() => field.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    return [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2].every(y => {
      const top = document.elementFromPoint(x, y);
      return y >= 0 && y < innerHeight && (top === node || node.contains(top));
    });
  }), { message: `${selector} must remain fully reachable beneath navigation and notices` }).toBe(true);
  await field.click();
  await expect(field).toBeFocused();
}

async function expectUnchanged(page, { audit, before }) {
  expect(await page.evaluate(() => JSON.stringify(state.proposals))).toBe(before);
  expect(audit.errors).toEqual([]);
  expect(audit.external).toEqual([]);
}

for (const [width, height] of [[320, 480], [568, 320], [844, 390], [390, 360], [1024, 600]]) {
  for (const textScale of [1, 2]) {
    test(`short viewport navigation ${width}x${height}, text ${textScale * 100}%`, async ({ page }) => {
      const context = await prepare(page, width, height, textScale);
      const nav = page.locator('.admin-quick-nav');
      await nav.getByRole('link', { name: 'Funil', exact: true }).click();
      await expectUsableControl(page, '#pipelineSearchInput');
      await nav.getByRole('link', { name: 'Proposta', exact: true }).click();
      await expectUsableControl(page, '#clientName');
      await page.locator('#quoteCalcSection').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await expectUnchanged(page, context);
    });
  }
}

test('status notice is announced, wraps long text, and allows immediate keyboard and mouse input', async ({ page }) => {
  const context = await prepare(page, 390, 360);
  await page.locator('.admin-quick-nav').getByRole('link', { name: 'Funil', exact: true }).click();
  await page.locator('#pipelineSearchInput').scrollIntoViewIfNeeded();
  await page.evaluate(() => showToast('Conferência concluída. '.repeat(30) + 'identificador'.repeat(30)));
  const notice = page.locator('.toast');
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toHaveAttribute('aria-live', 'polite');
  await expect(notice).toHaveAttribute('aria-atomic', 'true');
  const box = await notice.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  // Click while the notice is still present, rather than waiting for its timer.
  await page.locator('#pipelineSearchInput').click({ timeout: 1500 });
  await expect(notice).toHaveCount(1);
  await page.keyboard.type('Pessoa');
  await expect(page.locator('#pipelineSearchInput')).toHaveValue('Pessoa');
  await expectUnchanged(page, context);
});

test('shrinking and restoring the viewport preserves the unsaved quote and reachable fields', async ({ page }) => {
  const context = await prepare(page, 1024, 900, 2);
  await page.locator('#clientName').fill('Pessoa sintética com alteração local');
  for (const height of [390, 600, 900]) {
    await page.setViewportSize({ width: 1024, height });
    await page.locator('.admin-quick-nav').getByRole('link', { name: 'Proposta', exact: true }).click();
    await expectUsableControl(page, '#clientName');
    await expect(page.locator('#clientName')).toHaveValue('Pessoa sintética com alteração local');
  }
  await expectUnchanged(page, context);
});

test('desktop keeps its quote controls after a landscape round trip without saving', async ({ page }) => {
  const context = await prepare(page, 1440, 1000);
  await page.locator('#clientName').fill('Rascunho sintético preservado');
  for (const height of [1000, 390, 1000]) {
    await page.setViewportSize({ width: 1440, height });
    await page.locator('.admin-quick-nav').getByRole('link', { name: 'Proposta', exact: true }).click();
    await expect(page.locator('.topbar')).toHaveCSS('position', height === 390 ? 'static' : 'sticky');
    await expectUsableControl(page, '#clientName');
    await expect(page.locator('#clientName')).toHaveValue('Rascunho sintético preservado');
  }
  await expectUnchanged(page, context);
});

for (const width of [844, 1024]) test(`enlarged catalogue text remains inside its card at ${width}px`, async ({ page }) => {
  const context = await prepare(page, width, 600, 2);
  await page.locator('#quoteItemsSection').scrollIntoViewIfNeeded();
  const clipped = await page.locator('.price-row').evaluateAll(cards => cards.flatMap(card => {
    const content = card.querySelector('.price-row-body');
    const box = card.getBoundingClientRect();
    const text = content.getBoundingClientRect();
    return text.right > box.right + 1 || content.scrollWidth > content.clientWidth + 1
      ? [content.querySelector('.price-name').textContent.trim()] : [];
  }));
  expect(clipped, 'Catalogue names, prices and selection labels must remain readable').toEqual([]);
  await expectUnchanged(page, context);
});
