const { test, expect } = require("@playwright/test");
const { collectBrowserErrors, expectNoBrowserErrors, expectNoHorizontalOverflow } = require("./support");

test.describe("Formulário público do cliente", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/rest/v1/rpc/upsert_public_quote_draft**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "42883", message: "function not found in test" }),
      });
    });
  });

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

    await page.locator('#formPersonalizeNav').click();
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

  test("caminho rápido no celular leva ao essencial sem exigir cards consultivos", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/formulario.html");
    await expect(page.locator("#quickPathLink")).toBeVisible();
    await expect(page.locator("#quickHumanLink")).toHaveAttribute("href", /wa\.me\/5521971426007/);
    await page.locator("#quickPathLink").click();
    await expect(page).toHaveURL(/#eventDetailsStep$/);
    await expect(page.locator("#eventDetailsStep")).toBeInViewport();
    await page.locator("#quickContactLink").click();
    await expect(page).toHaveURL(/#contactStep$/);
    await expect(page.locator("#contactStep")).toBeInViewport();
    await expectNoHorizontalOverflow(page);
    await expectNoBrowserErrors(errors);
  });

  test("pedido em inglês preserva idioma e aceita apenas dados essenciais", async ({ page }) => {
    let payload;
    await page.route("**/rest/v1/rpc/submit_public_quote_request**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: '{"code":"42883"}' }));
    await page.route("**/rest/v1/solicitacoes_cotacao**", (route) => {
      const body = route.request().postDataJSON();
      payload = Array.isArray(body) ? body[0] : body;
      return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });
    await page.goto("/formulario.html");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("#quickPathLink")).toHaveText("Go to essentials");
    await page.locator("#quickPathLink").click();
    await page.locator("#requestEventDate").fill("2026-11-20");
    await page.locator("#quickContactLink").click();
    await expect(page.locator("#contactStep")).toBeInViewport();
    await page.locator("#requestClientName").fill("Alex Smith");
    await page.locator("#requestClientEmail").fill("alex@example.com");
    await page.locator("#submitClientQuoteBtn").click();
    await expect(page.locator("#clientFormStatus")).toContainText(/received|sent/i);
    expect(payload?.snapshot?.cliente?.idioma).toBe("en");
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

    await page.route("**/rest/v1/rpc/submit_public_quote_request**", async (route) => {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "42883", message: "function not found" }) });
    });

    await page.route("**/rest/v1/solicitacoes_cotacao**", async (route) => {
      const body = route.request().postDataJSON();
      payload = Array.isArray(body) ? body[0] : body;
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });

    await page.goto("/formulario.html");
    await page.locator("#requestEventDate").fill("2026-08-20");
    await page.locator("#requestClientName").fill("Ana");
    await page.locator("#requestClientEmail").fill("ana@example.com");
    await page.locator("#submitClientQuoteBtn").click();

    await expect(page.locator("#clientFormStatus")).toContainText(/Solicitação enviada|received/i);
    expect(payload?.cliente_nome).toBe("Ana");
    expect(payload?.cliente_email).toBe("ana@example.com");
    expect(payload?.horario_evento).toBe("A definir");
    expect(payload?.tipo_evento).toBe("Evento sob medida");
    expect(payload?.snapshot?.cliente?.tipoCliente).toBe("Cliente a classificar");
    await expectNoBrowserErrors(errors);
  });


  test("captura lead identificável antes do fim do formulário", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    let captured = null;

    await page.unroute("**/rest/v1/rpc/upsert_public_quote_draft**");
    await page.route("**/rest/v1/rpc/upsert_public_quote_draft**", async (route) => {
      captured = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ request_id: "00000000-0000-4000-8000-000000000010", opportunity_id: "00000000-0000-4000-8000-000000000020" }]),
      });
    });

    await page.goto("/formulario.html");
    await expect(page.locator("#returningClientAccess")).toBeVisible();
    await page.locator("#requestClientName").fill("Marina Costa");
    await page.locator("#requestClientEmail").fill("marina@example.com");

    await expect.poll(() => captured, { timeout: 4000 }).not.toBeNull();
    expect(captured?.p_snapshot?.cliente?.nome).toBe("Marina Costa");
    expect(captured?.p_snapshot?.cliente?.email).toBe("marina@example.com");
    await expect(page.locator("#partialCaptureStatus")).toContainText(/salvo|saved/i);
    await expectNoBrowserErrors(errors);
  });

  test("área segura organiza histórico, progresso e repetição do evento", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/formulario.html");
    await page.evaluate(() => renderReturningClientHistory([
      {
        proposal_id: "00000000-0000-4000-8000-000000000010",
        oportunidade_id: "00000000-0000-4000-8000-000000000011",
        versao: 2,
        status: "proposta_enviada",
        tipo_evento: "Coquetel Carioca",
        data_evento: "2028-10-24",
        convidados: 60,
        total: 18000,
        snapshot: { event: { type: "Coquetel Carioca", guests: 60 } },
      },
      {
        proposal_id: "00000000-0000-4000-8000-000000000020",
        oportunidade_id: "00000000-0000-4000-8000-000000000021",
        versao: 1,
        status: "planejamento",
        tipo_evento: "Almoço Carioca",
        data_evento: "2028-11-20",
        convidados: 40,
        total: 15000,
        snapshot: { event: { type: "Almoço Carioca", guests: 40 } },
      },
    ], "cliente@example.com"));
    await expect(page.locator("#returningClientHistory")).toContainText("Área segura do cliente");
    await expect(page.locator(".client-portal-event-card")).toHaveCount(2);
    await expect(page.locator(".client-portal-event-card").first()).toContainText("Abrir e continuar");
    await expect(page.locator(".client-portal-event-card").nth(1)).toContainText("planejamento operacional");
    await expect(page.locator(".client-portal-progress .is-current")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Repetir este evento" })).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
    await expectNoBrowserErrors(errors);
  });

  test("essenciais primeiro e personalização opcional preservam dados em PT e EN", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/formulario.html');
      await expect(page.locator('#personalizeOptions')).not.toHaveAttribute('open', '');
      await expect(page.locator('#momentChoices')).toBeHidden();
      await expect(page.locator('#requestEventDate')).toBeInViewport();
      const layout = await page.evaluate(() => {
        const event = document.querySelector('#eventDetailsStep').getBoundingClientRect();
        const contact = document.querySelector('#contactStep').getBoundingClientRect();
        const optional = document.querySelector('#personalizeOptions').getBoundingClientRect();
        return { topGap: Math.abs(event.top - contact.top), optionalAfter: optional.top >= contact.bottom,
          hero: document.querySelector('.public-form-hero').getBoundingClientRect().height };
      });
      if (width === 1440) expect(layout.topGap).toBeLessThan(2);
      expect(layout.optionalAfter).toBe(true);
      expect(layout.hero).toBeLessThan(290);
      await page.locator('#requestClientName').fill('Ana Silva');
      await page.locator('#requestEventDate').fill('2026-11-20');
      await page.locator('#finalReviewGrid [data-review-step="recommendation"]').click();
      await expect(page.locator('#personalizeOptions')).toHaveAttribute('open', '');
      await expect(page.locator('#formatRecommendations')).toBeVisible();
      await page.locator('#personalizeOptions > summary').click();
      await page.getByRole('button', { name: 'EN', exact: true }).click();
      await expect(page.locator('#personalizeTitle')).toContainText('optional');
      await expect(page.locator('#formContactNav')).toHaveText('Contact');
      await expect(page.locator('#requestClientName')).toHaveValue('Ana Silva');
      await expect(page.locator('#requestEventDate')).toHaveValue('2026-11-20');
      await expect(page.locator('#finalReviewGrid [data-review-step="profile"]')).not.toHaveClass(/is-required/);
      await expectNoHorizontalOverflow(page);
    }
    await expectNoBrowserErrors(errors);
  });
});
