const { test, expect } = require("@playwright/test");
const {
  collectBrowserErrors,
  expectElementInViewport,
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

    await expect(page.locator("#loadedEditorBar")).toContainText(/editando/i);
    await expect(page.locator("#clientName")).toHaveValue(/Claudia/i);
    await expect(page.locator("#eventType")).toHaveValue(/Almo.o Carioca/i);
    await expectScrolledNear(page, "#clientDataSection", 300);
    await expectElementInViewport(page, "#loadedEditorBar", { bottom: 120 });
    await expectNoBrowserErrors(errors);
  });

  test("prioridade agora abre e posiciona a equipe no editor, nao apenas carrega embaixo", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    await expect(page.locator("#actionList")).toContainText(/Prioridade agora/i);

    await page.locator('#actionList button[data-use-request="qa-request-prioridade"]').first().click();

    await expect(page.locator("#loadedEditorBar")).toContainText(/Prioridade agora/i);
    await expect(page.locator("#clientName")).toHaveValue(/Claudia/i);
    await expectScrolledNear(page, "#clientDataSection", 300);
    await expectElementInViewport(page, "#loadedEditorBar", { bottom: 120 });
    await expectNoBrowserErrors(errors);
  });

  test("mostra pedido completo de alteracao do cliente e abre a proposta certa", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    const changeCard = page.locator('[data-pipeline-card-id="qa-proposal-alteracao"]');
    await expect(changeCard).toContainText(/Cliente pediu/i);

    await changeCard.locator("[data-client-change-id]").click();
    await expect(page.locator(".client-change-dialog")).toBeVisible();
    await expect(page.locator(".client-change-dialog")).toContainText(/O que o cliente pediu/i);
    await expect(page.locator(".client-change-dialog")).toContainText(/welcome|corporativo/i);

    await page.getByRole("button", { name: /Abrir e ajustar proposta/i }).click();
    await expect(page.locator("#loadedEditorBar")).toContainText(/Luciano/i);
    await expect(page.locator("#clientName")).toHaveValue(/Luciano/i);
    await expectScrolledNear(page, "#clientDataSection", 300);
    await expectElementInViewport(page, "#loadedEditorBar", { bottom: 120 });
    await expectNoBrowserErrors(errors);
  });

  test("mobile: card inteiro abre e nao cria scroll lateral", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html?qa=1");
    await expect(page.locator("#pipelineBoard")).toBeVisible();

    await page.locator('[data-pipeline-card-id="qa-request-prioridade"]').click();
    await expect(page.locator("#loadedEditorBar")).toContainText(/editando/i);
    await expect(page.locator("#clientName")).toHaveValue(/Claudia/i);
    await expectScrolledNear(page, "#clientDataSection", 450);
    await expectElementInViewport(page, "#loadedEditorBar", { bottom: 120 });
    await expectNoHorizontalOverflow(page);
    await expectNoBrowserErrors(errors);
  });

  test("sinal integral nao gera cobrança de saldo no funil", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    const fullPaymentCard = page.locator('[data-pipeline-card-id="qa-proposal-sinal-integral"]');
    await expect(fullPaymentCard).toBeVisible();
    await expect(fullPaymentCard).toContainText(/Planejar|Enviar para planejamento/i);
    await expect(fullPaymentCard).toContainText(/Pagamento completo|Próximo passo é operação/i);
    await expect(fullPaymentCard).not.toContainText(/Falta saldo|Cobrar saldo/i);
    await expectNoBrowserErrors(errors);
  });
  test("cards do funil mostram composicao de A&B e privatizacao", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    const proposalCard = page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"]');
    await expect(proposalCard).toBeVisible();
    await expect(proposalCard.locator(".pipeline-stage-chip")).toContainText("Agência de turismo receptivo / DMC");
    await expect(proposalCard.locator(".pipeline-value-breakdown")).toContainText("Café da Manhã / Brunch");
    await expect(proposalCard.locator(".pipeline-card-event-line")).toContainText(/· (dom|seg|ter|qua|qui|sex|sáb) ·/i);
    await expect(proposalCard.locator(".pipeline-value-breakdown")).toContainText("A&B");
    await expect(proposalCard.locator(".pipeline-value-breakdown")).toContainText("Priv.");
    await expect(proposalCard.locator(".pipeline-value-breakdown")).toContainText("R$ 3.057,60");
    await expect(proposalCard.locator(".pipeline-card-final-client")).toContainText("Cliente final: Grupo Andes");
    await expect(proposalCard.locator(".pipeline-card-next-action [data-mark-paid]")).toBeVisible();
    await expect(proposalCard.locator(".pipeline-card-kicker [data-mark-paid]")).toHaveCount(0);
    await expectNoBrowserErrors(errors);
  });

  test("card sem resposta mostra retorno pendente sem repetir follow-up", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    const proposalCard = page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"]');
    await expect(proposalCard).toBeVisible();
    await expect(proposalCard.locator(".follow-up-badge")).toContainText(/Sem retorno há/i);
    await expect(proposalCard.locator(".pipeline-card-next-action")).toContainText(/Retomar contato|Checar retorno/i);
    await expect(proposalCard.locator(".pipeline-card-next-action")).not.toContainText(/follow-up/i);
    await expect(proposalCard.locator(".pipeline-card-alerts")).not.toContainText(/follow-up/i);
    await expectNoBrowserErrors(errors);
  });
});
