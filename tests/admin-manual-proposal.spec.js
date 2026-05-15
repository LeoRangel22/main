const { test, expect } = require("@playwright/test");
const {
  collectBrowserErrors,
  expectNoBrowserErrors,
  expectScrolledNear,
} = require("./support");

test.describe("Proposta manual no admin", () => {
  test("preenche uma proposta do zero sem depender do campo de ajuste comercial", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/index.html?qa=1");
    await expect(page.locator("#startManualProposalBtn")).toBeVisible();

    await page.locator("#startManualProposalBtn").click();
    await expect(page.locator("#clientDataSection")).toBeVisible();
    await expect(page.locator("#manualAdjustment")).toHaveValue("0");
    await expect(page.locator("#formSourcePanel")).toContainText("Contexto comercial da proposta");

    await page.locator("#clientName").fill("Mariana Costa");
    await page.locator("#clientEmail").fill("mariana.costa@example.com");
    await page.locator("#clientPhone").fill("+55 21 99999-0000");
    await page.locator("#eventDate").fill("2026-06-18");
    await page.locator("#eventTime").selectOption("09:00");
    await page.locator("#guestCount").fill("30");
    await page.locator("#eventDuration").selectOption("1");
    await page.locator('[data-source-field="clientType"]').selectOption("Empresa");
    await page.locator('[data-source-field="company"]').fill("Costa Experiências");
    await page.locator('[data-source-field="budgetRange"]').selectOption("R$ 15 mil a R$ 30 mil");
    await page.locator('[data-source-field="origin"]').selectOption("Indicação");
    await page.locator('[data-source-field="moment"]').selectOption("Manhã em dia de semana");
    await page.locator('[data-source-field="occasion"]').fill("Reunião corporativa");

    await page.locator('[data-flow-event="cafe"]').click();
    await expect(page.locator("#eventType")).toHaveValue(/Caf/i);
    await expect(page.locator("#selectedItems")).toContainText(/Caf/i);

    const review = await page.evaluate(() =>
      window.getProposalReviewItems().map((item) => ({
        id: item.id,
        status: item.status,
        detail: item.detail,
      })),
    );

    const requiredErrors = review.filter((item) =>
      ["contact", "format", "date", "guests", "items", "value", "conditions"].includes(item.id) && item.status === "error",
    );
    expect(requiredErrors, `Pendências obrigatórias inesperadas: ${JSON.stringify(requiredErrors, null, 2)}`).toEqual([]);

    const summary = await page.evaluate(() => window.getProposalReviewSummary());
    expect(summary.ready).toBe(true);

    await page.locator("#manualAdjustment").fill("");
    const summaryWithBlankAdjustment = await page.evaluate(() => window.getProposalReviewSummary());
    expect(summaryWithBlankAdjustment.ready).toBe(true);

    await page.locator('#sendReviewPanel button[data-send-review-action="approve"]').first().click();
    await expect(page.locator("#sendReviewPanel")).toHaveClass(/is-approved/);

    await page.locator('[data-source-field="origin"]').selectOption("Google / Instagram");
    await expect(page.locator("#sendReviewPanel")).not.toHaveClass(/is-approved/);

    await expectNoBrowserErrors(errors);
  });

  test("proposta manual guia a equipe para corrigir somente o que realmente falta", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/index.html?qa=1");
    await page.locator("#startManualProposalBtn").click();

    const initialReview = await page.evaluate(() =>
      window.getProposalReviewItems().filter((item) => item.status === "error").map((item) => item.id),
    );
    expect(initialReview).toEqual(expect.arrayContaining(["contact", "format", "date", "items", "value"]));

    await page.locator("#clientName").fill("Mariana Costa");
    await page.locator("#clientEmail").fill("mariana.costa@example.com");
    await page.locator("#clientPhone").fill("+55 21 99999-0000");

    const afterContact = await page.evaluate(() => window.getProposalReviewItems().find((item) => item.id === "contact"));
    expect(afterContact.status).not.toBe("error");

    await page.locator("#eventDate").fill("2026-06-18");
    await page.locator("#eventTime").selectOption("09:00");
    const afterDate = await page.evaluate(() => window.getProposalReviewItems().find((item) => item.id === "date"));
    expect(afterDate.status).toBe("ok");

    await page.locator('[data-flow-event="almoco"]').click();
    await page.locator("#eventType").fill("");
    const afterItems = await page.evaluate(() => ({
      format: window.getProposalReviewItems().find((item) => item.id === "format"),
      items: window.getProposalReviewItems().find((item) => item.id === "items"),
      value: window.getProposalReviewItems().find((item) => item.id === "value"),
      inferredType: window.getProposalSnapshot().event.type,
    }));
    expect(afterItems.format.status).toBe("ok");
    expect(afterItems.items.status).toBe("ok");
    expect(afterItems.value.status).toBe("ok");
    expect(afterItems.inferredType).toBe("Almoço Carioca");

    const sourceGapsAfterFormat = await page.evaluate(() => window.getFormSourceMissingItems(window.getFormSourceData()));
    expect(sourceGapsAfterFormat).not.toContain("momento");
    expect(sourceGapsAfterFormat).not.toContain("ocasião");

    await expectScrolledNear(page, "#eventConfigSection", 250);
    await expectNoBrowserErrors(errors);
  });

  test("contexto comercial recomendado nao polui a coluna direita de envio", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/index.html?qa=1");
    await page.locator("#startManualProposalBtn").click();

    await page.locator("#clientName").fill("Mariana Costa");
    await page.locator("#clientEmail").fill("mariana.costa@example.com");
    await page.locator("#clientPhone").fill("+55 21 99999-0000");
    await page.locator("#eventDate").fill("2026-06-18");
    await page.locator("#eventTime").selectOption("09:00");
    await page.locator("#guestCount").fill("30");
    await page.locator("#eventDuration").selectOption("1");
    await page.locator('[data-source-field="clientType"]').selectOption("Empresa");
    await page.locator('[data-source-field="company"]').fill("Costa Experiencias");
    await page.locator('[data-source-field="moment"]').selectOption("Manhã em dia de semana");
    await page.locator('[data-source-field="occasion"]').fill("Reuniao corporativa");
    await page.locator('[data-flow-event="cafe"]').click();

    const reviewState = await page.evaluate(() => ({
      summary: window.getProposalReviewSummary(),
      workflow: window.getReviewWorkflowSteps().map((item) => ({
        label: item.label,
        status: item.status,
        statusLabel: item.statusLabel,
      })),
      profile: window.getLeadReadinessItems().find((item) => item.id === "profile"),
    }));

    expect(reviewState.summary.ready).toBe(true);
    expect(reviewState.summary.errors).toBe(0);
    expect(reviewState.summary.optionalWarnings).toBeGreaterThan(0);
    expect(reviewState.profile.label).toBe("Contexto comercial");
    expect(reviewState.profile.optional).toBe(true);
    expect(reviewState.workflow.find((item) => item.label === "Contexto comercial").statusLabel).toBe("Sugestão");
    await expect(page.locator("#sendReviewPanel")).not.toContainText("Contexto comercial");
    await expect(page.locator("#sendReviewPanel")).not.toContainText("Sugestão comercial");
    await expect(page.locator("#sendReviewPanel")).toContainText("Pronto para revisar");
    await expectNoBrowserErrors(errors);
  });

  test("coquetel aceita welcome drink e workshop como complementos", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/index.html?qa=1");
    await page.locator("#startManualProposalBtn").click();

    await page.locator("#clientName").fill("Mariana Costa");
    await page.locator("#clientEmail").fill("mariana.costa@example.com");
    await page.locator("#clientPhone").fill("+55 21 99999-0000");
    await page.locator("#eventDate").fill("2026-06-18");
    await page.locator("#eventTime").selectOption("18:00");
    await page.locator("#guestCount").fill("40");
    await page.locator("#eventDuration").selectOption("2");
    await page.locator('[data-source-field="clientType"]').selectOption("Agência de turismo receptivo / DMC");
    await page.locator('[data-source-field="company"]').fill("Costa Experiencias");
    await page.locator('[data-source-field="finalClient"]').fill("Grupo Internacional");
    await page.locator('[data-source-field="budgetRange"]').selectOption("R$ 30 mil a R$ 60 mil");
    await page.locator('[data-source-field="origin"]').selectOption("Indicação");
    await page.locator('[data-source-field="moment"]').selectOption("Fim de tarde");
    await page.locator('[data-source-field="occasion"]').fill("Recepção corporativa");

    await page.locator('[data-flow-event="coquetel"]').click();
    await expect(page.locator("#flowWelcomeOptions")).toBeVisible();
    await page.locator('[data-select-package="welcome-caipirinha"]').click();
    await page.locator('[data-select-package="workshop-caipirinha-pt"]').click();

    const reviewState = await page.evaluate(() => ({
      selectedCategories: window.getSelectedItems().map((item) => item.tipoEvento),
      selectedNames: window.getSelectedItems().map((item) => item.nome),
      summary: window.getProposalReviewSummary(),
      itemReview: window.getProposalReviewItems().find((item) => item.id === "items"),
      eventType: window.getProposalSnapshot().event.type,
    }));

    expect(reviewState.eventType).toBe("Coquetel");
    expect(reviewState.selectedCategories).toEqual(expect.arrayContaining(["Coquetel", "Comidas", "Welcome Drink", "Workshop de Caipirinha"]));
    expect(reviewState.selectedNames).toEqual(expect.arrayContaining(["Welcome Drink Caipirinha", "Workshop de Caipirinha (PT)"]));
    expect(reviewState.itemReview.status).not.toBe("error");
    expect(reviewState.summary.ready).toBe(true);

    await expectNoBrowserErrors(errors);
  });

  test("proposta manual completa salva, aprova checklist e envia WhatsApp em QA", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/index.html?qa=1");
    await page.locator("#startManualProposalBtn").click();

    await page.locator("#clientName").fill("Leonardo Rangel");
    await page.locator("#clientEmail").fill("leorangel@gmail.com");
    await page.locator("#clientPhone").fill("+55 21 99606-0692");
    await page.locator("#eventDate").fill("2026-06-18");
    await page.locator("#eventTime").selectOption("09:00");
    await page.locator("#guestCount").fill("30");
    await page.locator("#eventDuration").selectOption("1");
    await page.locator("#manualAdjustment").fill("0");
    await page.locator("#eventReason").fill("Teste completo de envio da proposta pelo fluxo QA.");
    await page.locator('[data-source-field="clientType"]').selectOption("Empresa");
    await page.locator('[data-source-field="company"]').fill("Embaixada Carioca");
    await page.locator('[data-source-field="finalClient"]').fill("Leonardo Rangel");
    await page.locator('[data-source-field="budgetRange"]').selectOption("R$ 15 mil a R$ 30 mil");
    await page.locator('[data-source-field="origin"]').selectOption("Indicação");
    await page.locator('[data-source-field="moment"]').selectOption("Manhã em dia de semana");
    await page.locator('[data-source-field="occasion"]').fill("Teste interno de lançamento");

    await page.locator('[data-flow-event="cafe"]').click();
    await expect(page.locator("#selectedItems")).toContainText(/Caf/i);

    const beforeApproval = await page.evaluate(() => ({
      summary: window.getProposalReviewSummary(),
      errors: window.getProposalReviewItems().filter((item) => item.status === "error"),
      sourceGaps: window.getFormSourceMissingItems(window.getFormSourceData()),
    }));
    expect(beforeApproval.summary.ready, JSON.stringify(beforeApproval, null, 2)).toBe(true);
    expect(beforeApproval.errors, JSON.stringify(beforeApproval.errors, null, 2)).toEqual([]);
    expect(beforeApproval.sourceGaps, JSON.stringify(beforeApproval.sourceGaps, null, 2)).toEqual([]);

    await page.locator('#sendReviewPanel button[data-send-review-action="approve"]').first().click();
    await expect(page.locator("#sendReviewPanel")).toHaveClass(/is-approved/);

    await page.locator("#whatsappBtn").click();
    await expect(page.locator("#integrationLogList")).toContainText(/WhatsApp/i);
    await expect(page.locator("#integrationLogList")).toContainText(/enviada|Simulado|Proposta/i);

    const activeProposal = await page.evaluate(() => window.getDebugProposalState());
    expect(activeProposal.activeProposalId).toBeTruthy();
    expect(activeProposal.activeProposal?.public_token).toBeTruthy();
    expect(activeProposal.activeProposal?.cliente_email).toBe("leorangel@gmail.com");
    expect(activeProposal.activeProposal?.cliente_whatsapp.replace(/\D/g, "")).toContain("99606");
    expect(activeProposal.activeProposal?.status).toBe("proposta_enviada");

    await expectNoBrowserErrors(errors);
  });

  test("horario da proposta usa selecao clara de 30 em 30 minutos", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    await page.locator("#startManualProposalBtn").click();

    await expect(page.locator("#eventDate")).toBeVisible();
    await expect(page.locator("#eventTime")).toBeVisible();
    await expect(page.locator("#eventDateTime")).toHaveAttribute("type", "hidden");

    const invalidTimes = await page.locator("#eventTime option").evaluateAll((options) =>
      options
        .map((option) => option.value)
        .filter(Boolean)
        .filter((value) => !/^\d{2}:(00|30)$/.test(value)),
    );
    expect(invalidTimes).toEqual([]);
    await expectNoBrowserErrors(errors);
  });
});
