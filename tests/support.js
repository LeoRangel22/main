const { expect } = require("@playwright/test");

function collectBrowserErrors(page) {
  const errors = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|cdn\.jsdelivr|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  return errors;
}

async function expectNoBrowserErrors(errors) {
  expect(errors, "A página não deve gerar erros JavaScript relevantes").toEqual([]);
}

async function expectScrolledNear(page, selector, minimumScroll = 250) {
  await expect(page.locator(selector)).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), {
      message: `A página deveria rolar para ${selector}`,
      timeout: 8_000,
    })
    .toBeGreaterThan(minimumScroll);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.documentWidth, `Sem scroll lateral inesperado: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(
    overflow.viewport + 4,
  );
}

module.exports = {
  collectBrowserErrors,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
  expectScrolledNear,
};
