const { test, expect } = require("@playwright/test");
const {
  collectBrowserErrors,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
  expectScrolledNear,
} = require("./support");

test.describe("Dashboard interno em modo QA", () => {
  test("abre um lead pelo funil e leva a equipe direto para o editor", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    await expect(page.locator("body")).toContainText("Sistema de eventos");
    await expect(page.locator("#authStatus")).toContainText(/leorangel@gmail\.com/i);

    await page.locator('[data-pipeline-stage-jump="lead_recebido"]').click();
    await expect(page.locator('.pipeline-stage-lead_recebido [data-pipeline-card-id="qa-request-prioridade"]')).toBeVisible();

    await page
      .locator('[data-pipeline-card-id="qa-request-prioridade"]')
      .getByRole("button", { name: /Responder|Abrir/i })
      .click();

    await expect(page.locator("#loadedEditorBar")).toContainText(/Você está editando/i);
    await expect(page.locator("#clientName")).toHaveValue(/Claudia/i);
    await expect(page.locator("#eventType")).toHaveValue(/Almoço Carioca/i);
    await expectScrolledNear(page, "#clientDataSection", 300);
    await expectNoBrowserErrors(errors);
  });

  test("mostra pedido completo de alteração do cliente e abre a proposta certa", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    const changeCard = page.locator('[data-pipeline-card-id="qa-proposal-alteracao"]');
    await expect(changeCard).toContainText(/Cliente pediu alteração/i);

    await changeCard.locator("[data-client-change-id]").click();
    await expect(page.locator(".client-change-dialog")).toBeVisible();
    await expect(page.locator(".client-change-dialog")).toContainText(/O que o cliente pediu/i);
    await expect(page.locator(".client-change-dialog")).toContainText(/almoço|welcome|corporativo/i);

    await page.getByRole("button", { name: /Abrir e ajustar proposta/i }).click();
    await expect(page.locator("#loadedEditorBar")).toContainText(/Luciano/i);
    await expect(page.locator("#clientName")).toHaveValue(/Luciano/i);
    await expectScrolledNear(page, "#clientDataSection", 300);
    await expectNoBrowserErrors(errors);
  });

  test("mobile: card inteiro abre e não cria scroll lateral", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html?qa=1");
    await expect(page.locator("#pipelineBoard")).toBeVisible();

    await page.locator('[data-pipeline-card-id="qa-request-prioridade"]').click();
    await expect(page.locator("#loadedEditorBar")).toContainText(/Você está editando/i);
    await expect(page.locator("#clientName")).toHaveValue(/Claudia/i);
    await expectScrolledNear(page, "#clientDataSection", 450);
    await expectNoHorizontalOverflow(page);
    await expectNoBrowserErrors(errors);
  });
});
