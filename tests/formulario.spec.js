const { test, expect } = require("@playwright/test");
const { collectBrowserErrors, expectNoBrowserErrors, expectNoHorizontalOverflow } = require("./support");

test.describe("Formulário público do cliente", () => {
  test("mantém defaults, campos críticos e UX mobile sem envio real", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/formulario.html");

    await expect(page.locator("#clientQuoteForm")).toBeVisible();
    await expect(page.locator("#requestDateIsFlexible")).toHaveValue("no");
    await expect(page.locator("#requestDuration")).toHaveValue("1");
    await expect(page.locator("#requestGuestCount")).toHaveAttribute("inputmode", "numeric");
    await expect(page.locator("#phoneLabel")).toContainText("Celular/WhatsApp");
    await expect(page.locator("#leadSourceLabel")).toContainText(/Opcional/i);

    await page.locator('[data-choice-group="moment"][data-choice-value="weekday-morning"]').click();
    await page.locator('[data-choice-group="clientType"][data-choice-value="agency-tourism"]').click();
    await page.locator('[data-choice-group="profile"][data-choice-value="travel"]').click();
    await expect(page.locator("#formatRecommendations .format-card")).toHaveCount(4);
    await expect(page.locator("#requestTimeRange")).toHaveValue("morning");
    await expect(page.locator("#requestEventTime")).toHaveValue("09:00");

    await expect(page.locator("#endClientField")).not.toHaveClass(/is-hidden/);
    await expect(page.locator("#groupNameField")).not.toHaveClass(/is-hidden/);

    await page.locator("#requestClientName").fill("Marina Costa");
    await page.locator("#requestClientEmail").fill("marina.costa@empresa.com.br");
    await page.locator("#requestClientPhone").fill("+55 21 99999-8888");
    await page.locator("#requestCompany").fill("Agencia Horizonte Rio");
    await page.locator("#requestEndClientName").fill("Grupo Aurora");
    await page.locator("#requestGroupName").fill("Incentivo Mexico 2026");
    await page.locator("#requestGuestCount").fill("120");
    await page.locator("#requestGuestCount").dispatchEvent("input");

    await expect(page.locator("#requestGuestOutput")).toContainText(/99\+|120/);
    await expect(page.locator("#finalReviewCard")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoBrowserErrors(errors);
  });

  test("bloqueia envio incompleto com orientação clara", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.route("**/rest/v1/solicitacoes_cotacao**", async (route) => {
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });

    await page.goto("/formulario.html");
    await page.locator("#submitClientQuoteBtn").click();

    await expect(page.locator("#clientFormStatus")).toContainText(/Complete|corrigir|enviar/i);
    await expect(page.locator("#eventDetailsStep")).toHaveAttribute("data-invalid", "");
    await expectNoBrowserErrors(errors);
  });
  test("envia lead com essencial mesmo sem todos os cards consultivos", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    let payload;

    await page.route("**/rest/v1/solicitacoes_cotacao**", async (route) => {
      const body = route.request().postDataJSON();
      payload = Array.isArray(body) ? body[0] : body;
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });

    await page.goto("/formulario.html");
    await page.locator("#requestEventDate").fill("2026-08-20");
    await page.locator("#requestClientName").fill("Ana");
    await page.locator("#requestClientEmail").fill("ana@example.com");
    await page.locator("#requestClientPhone").fill("+55 21 99999-8888");
    await page.locator("#submitClientQuoteBtn").click();

    await expect(page.locator("#clientFormStatus")).toContainText(/Solicitação enviada|received/i);
    expect(payload?.cliente_nome).toBe("Ana");
    expect(payload?.cliente_email).toBe("ana@example.com");
    expect(payload?.horario_evento).toBe("A definir");
    expect(payload?.tipo_evento).toBe("Evento sob medida");
    expect(payload?.snapshot?.cliente?.tipoCliente).toBe("Cliente a classificar");
    await expectNoBrowserErrors(errors);
  });
});
