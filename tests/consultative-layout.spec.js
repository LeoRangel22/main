const { test, expect } = require('@playwright/test');

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 320, height: 850 },
]) {
  test(`consultative intake remains reachable by pointer and keyboard at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Only synthetic QA data; no provider writes or customer communication.
    await page.route('**/functions/v1/**', route => route.abort());
    await page.goto('/index.html?qa=1');
    await expect(page.locator('body')).not.toHaveClass(/auth-locked/);
    await expect(page.locator('[data-sales-mode="manual"]')).toBeVisible();
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#topbarNewProposalBtn').click();
    await expect(page.locator('#consultativeOrigin')).toContainText('Cadastro manual');

    const panel = page.locator('#consultativePanel');
    const summary = panel.locator(':scope > summary');
    const guide = page.locator('.quote-section-nav.sales-step-guide');
    const reply = page.locator('#consultativeReply');
    const assertSeparateLayout = async () => {
      // This also catches a relatively positioned guide inheriting sticky top.
      await expect.poll(() => guide.evaluate(nav => {
        const intake = document.getElementById('consultativePanel');
        return intake.getBoundingClientRect().top - nav.getBoundingClientRect().bottom;
      })).toBeGreaterThanOrEqual(0);
    };

    await assertSeparateLayout();
    await summary.click();
    await expect(panel).toHaveJSProperty('open', true);
    await page.locator('[data-consultative-action="write"]').click();
    await expect(reply).toBeFocused();
    await reply.fill('Mensagem manual preservada ao alternar a forma de preencher.');

    // Exercise scrolling back from an expanded intake and guide rerenders.
    for (const mode of ['guided', 'manual']) {
      await page.locator(`[data-sales-mode="${mode}"]`).click();
      await assertSeparateLayout();
      await expect(reply).toHaveValue('Mensagem manual preservada ao alternar a forma de preencher.');
      await summary.click();
      await expect(panel).toHaveJSProperty('open', false);
      await summary.click();
      await expect(panel).toHaveJSProperty('open', true);
    }

    await summary.click();
    await expect(panel).toHaveJSProperty('open', false);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toHaveJSProperty('open', true);
    await page.keyboard.press('Space');
    await expect(panel).toHaveJSProperty('open', false);
    await expect(summary).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
