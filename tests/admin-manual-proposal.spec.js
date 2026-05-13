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
    await expect(page.locator("#formSourcePanel")).toContainText("Classificação comercial da proposta");

    await page.locator("#clientName").fill("Mariana Costa");
    await page.locator("#clientEmail").fill("mariana.costa@example.com");
    await page.locator("#clientPhone").fill("+55 21 99999-0000");
    await page.locator("#eventDateTime").fill("2026-06-18T09:00");
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

    await page.locator("#eventDateTime").fill("2026-06-18T09:00");
    const afterDate = await page.evaluate(() => window.getProposalReviewItems().find((item) => item.id === "date"));
    expect(afterDate.status).toBe("ok");

    await page.locator('[data-flow-event="almoco"]').click();
    const afterItems = await page.evaluate(() => ({
      format: window.getProposalReviewItems().find((item) => item.id === "format"),
      items: window.getProposalReviewItems().find((item) => item.id === "items"),
      value: window.getProposalReviewItems().find((item) => item.id === "value"),
    }));
    expect(afterItems.format.status).toBe("ok");
    expect(afterItems.items.status).toBe("ok");
    expect(afterItems.value.status).toBe("ok");

    const sourceGapsAfterFormat = await page.evaluate(() => window.getFormSourceMissingItems(window.getFormSourceData()));
    expect(sourceGapsAfterFormat).not.toContain("momento");
    expect(sourceGapsAfterFormat).not.toContain("ocasião");

    await expectScrolledNear(page, "#eventConfigSection", 250);
    await expectNoBrowserErrors(errors);
  });
});
