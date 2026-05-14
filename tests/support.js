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
  expect(errors, "A pagina nao deve gerar erros JavaScript relevantes").toEqual([]);
}

async function expectScrolledNear(page, selector, minimumScroll = 250) {
  await expect(page.locator(selector)).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), {
      message: `A pagina deveria rolar para ${selector}`,
      timeout: 8_000,
    })
    .toBeGreaterThan(minimumScroll);
}

async function expectElementInViewport(page, selector, { top = 0, bottom = 160 } = {}) {
  const locator = page.locator(selector);
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => locator.evaluate((node) => Math.round(node.getBoundingClientRect().top)), {
      message: `${selector} deveria aparecer dentro da tela apos a acao`,
      timeout: 8_000,
    })
    .toBeGreaterThanOrEqual(top - 8);
  await expect
    .poll(async () => locator.evaluate((node) => Math.round(node.getBoundingClientRect().top)), {
      message: `${selector} deveria ficar perto do topo visivel`,
      timeout: 8_000,
    })
    .toBeLessThan(bottom);
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
  expectElementInViewport,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
  expectScrolledNear,
};
