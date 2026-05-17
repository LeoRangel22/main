const { test, expect } = require("@playwright/test");
const { collectBrowserErrors, expectNoBrowserErrors } = require("./support");

const clientTypes = {
  dmc: "Agência de turismo receptivo / DMC",
  marketing: "Agência de marketing / eventos",
  company: "Empresa",
  person: "Pessoa física",
};

async function fillCommercialContext(page, scenario) {
  const fillField = async (locator, value) => {
    await locator.click();
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  };
  const source = (field) => page.locator(`[data-source-field="${field}"]`);

  await page.locator("#clientName").fill(scenario.name);
  await page.locator("#clientEmail").fill(scenario.email || "leorangel@gmail.com");
  await page.locator("#clientPhone").fill(scenario.phone || "+55 21 99606-0692");
  await page.locator("#eventDate").fill(scenario.date);
  await page.locator("#eventTime").selectOption(scenario.time);
  await page.locator("#guestCount").fill(String(scenario.guests));
  await page.locator("#eventDuration").selectOption(scenario.duration);
  await page.locator("#manualAdjustment").fill("0");

  await source("clientType").selectOption(scenario.clientType);
  if (scenario.company) await fillField(source("company"), scenario.company);
  if (scenario.finalClient) await fillField(source("finalClient"), scenario.finalClient);
  if (scenario.groupName) await fillField(source("groupName"), scenario.groupName);
  await source("budgetRange").selectOption(scenario.budgetRange || "R$ 30 mil a R$ 60 mil");
  await source("origin").selectOption(scenario.origin || "Indicação");
  await source("moment").selectOption(scenario.moment);
  await fillField(source("occasion"), scenario.occasion || "Relacionamento com clientes");
  await fillField(source("reason"), scenario.reason || "Teste pesado de produto, cliente e regra comercial.");
  await page.locator("#eventReason").fill(scenario.reason || "Teste pesado de produto, cliente e regra comercial.");

  const understood = await page.evaluate(() => window.getFormSourceData());
  expect(understood.clientType, JSON.stringify(understood, null, 2)).toBe(scenario.clientType);
  if (scenario.company) expect(understood.company, JSON.stringify(understood, null, 2)).toBe(scenario.company);
  if (scenario.finalClient) expect(understood.finalClient, JSON.stringify(understood, null, 2)).toBe(scenario.finalClient);
  if (scenario.groupName) expect(understood.groupName, JSON.stringify(understood, null, 2)).toBe(scenario.groupName);
  expect(understood.moment, JSON.stringify(understood, null, 2)).toBe(scenario.moment);
  expect(understood.occasion, JSON.stringify(understood, null, 2)).toBe(scenario.occasion || "Relacionamento com clientes");
}

async function keepEventOperationalData(page, scenario) {
  await page.locator("#eventDate").fill(scenario.date);
  await page.locator("#eventTime").selectOption(scenario.time);
  await page.locator("#guestCount").fill(String(scenario.guests));
  await page.locator("#eventDuration").selectOption(scenario.duration);
}

async function collectProposalState(page) {
  return page.evaluate(() => {
    const review = window.getProposalReviewItems();
    const sourceData = window.getFormSourceData();
    return {
      errors: review.filter((item) => item.status === "error").map((item) => ({ id: item.id, detail: item.detail })),
      sourceGaps: window.getFormSourceMissingItems(sourceData),
      recommendedGaps: window.getFormSourceRecommendedItems(sourceData),
      summary: window.getProposalReviewSummary(review),
      snapshot: window.getProposalSnapshot(),
      totals: window.getQuoteTotals(),
      selected: window.getSelectedItems().map((item) => ({
        id: item.id,
        name: item.nome,
        category: item.tipoEvento,
      })),
    };
  });
}

test.describe("Matriz pesada de produtos, clientes e privatizacao", () => {
  const scenarios = [
    {
      title: "cafe da manha para empresa em manha util sem privatizacao aplicada",
      name: "Ana Paula Martins",
      company: "Empresa Cafe Matinal",
      clientType: clientTypes.company,
      date: "2026-06-22",
      time: "09:00",
      guests: 30,
      duration: "1",
      moment: "Manhã em dia de semana",
      eventButton: "cafe",
      expectedEventType: "Café da Manhã / Coffee Break",
      expectedItemIds: ["cafe-classico"],
      expectedPrivatizationAmount: 0,
    },
    {
      title: "almoco carioca para agencia de marketing em pico com privatizacao total automatica",
      name: "Claudia Oliveira",
      company: "Agencia Alto Impacto",
      finalClient: "TV Globo",
      groupName: "Grupo Executivos",
      clientType: clientTypes.marketing,
      date: "2026-06-22",
      time: "12:30",
      guests: 85,
      duration: "2",
      moment: "Início do almoço",
      eventButton: "almoco",
      expectedEventType: "Almoço Carioca",
      expectedItemIds: ["almoco-carioca-bebida-livre"],
      expectedPrivatizationAmount: 12000,
      expectedPrivatizationMode: "required-full",
    },
    {
      title: "coquetel para pessoa fisica em pico com privatizacao parcial automatica",
      name: "Mariana Costa",
      clientType: clientTypes.person,
      date: "2026-06-24",
      time: "14:00",
      guests: 30,
      duration: "2",
      moment: "Fim de tarde",
      eventButton: "coquetel",
      expectedEventType: "Coquetel",
      expectedItemIds: ["coquetel-carioca", "brasileiro-ii"],
      expectedPrivatizationAmount: 3000,
      expectedPrivatizationMode: "required-partial",
    },
    {
      title: "welcome drink para dmc fora de pico com privatizacao opcional aceita",
      name: "Rafael Casimiro",
      company: "Rio Incoming DMC",
      finalClient: "Grupo Europa",
      groupName: "Incentivo Europeu",
      clientType: clientTypes.dmc,
      date: "2026-06-28",
      time: "19:00",
      guests: 24,
      duration: "1",
      moment: "Noite (19h-21h)",
      eventButton: "welcome",
      expectedEventType: "Welcome Drink",
      expectedItemIds: ["welcome-caipirinha"],
      expectedPrivatizationAmount: 12000,
      expectedPrivatizationMode: "optional",
      acceptOptionalPrivatization: true,
    },
    {
      title: "coquetel para dmc aceita welcome drink e workshop como complementos",
      name: "Laura Cunha",
      company: "Hunter Douglas LTD",
      finalClient: "Hunter Douglas",
      groupName: "Grupo Internacional",
      clientType: clientTypes.dmc,
      date: "2026-06-26",
      time: "17:30",
      guests: 50,
      duration: "2",
      moment: "Fim de tarde",
      eventButton: "coquetel",
      extraPackages: ["welcome-caipirinha", "workshop-caipirinha-pt"],
      expectedEventType: "Coquetel",
      expectedItemIds: ["coquetel-carioca", "brasileiro-ii", "welcome-caipirinha", "workshop-caipirinha-pt"],
      expectedCategories: ["Coquetel", "Comidas", "Welcome Drink", "Workshop de Caipirinha"],
      expectedPrivatizationAmount: 12000,
      expectedPrivatizationMode: "required-full",
    },
  ];

  for (const scenario of scenarios) {
    test(scenario.title, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      page.on("dialog", (dialog) => dialog.accept());

      await page.goto("/index.html?qa=1");
      await page.locator("#startManualProposalBtn").click();
      await fillCommercialContext(page, scenario);

      await page.locator(`[data-flow-event="${scenario.eventButton}"]`).click();
      await keepEventOperationalData(page, scenario);

      for (const packageId of scenario.extraPackages || []) {
        await page.locator(`[data-select-package="${packageId}"]`).click();
      }

      if (scenario.acceptOptionalPrivatization) {
        await expect(page.locator("#optionalPrivatizationControls")).toBeVisible();
        await page.locator('[data-privatization-choice="yes"]').click();
      }

      const state = await collectProposalState(page);
      expect(state.sourceGaps, JSON.stringify(state, null, 2)).toEqual([]);
      expect(state.recommendedGaps, JSON.stringify(state, null, 2)).toEqual([]);
      expect(state.errors, JSON.stringify(state, null, 2)).toEqual([]);
      expect(state.summary.ready, JSON.stringify(state, null, 2)).toBe(true);
      expect(state.snapshot.event.type).toBe(scenario.expectedEventType);
      expect(state.totals.total).toBeGreaterThan(0);
      expect(state.totals.privatization.amount).toBe(scenario.expectedPrivatizationAmount);
      if (scenario.expectedPrivatizationMode) {
        expect(state.totals.privatization.mode).toBe(scenario.expectedPrivatizationMode);
      }

      const selectedIds = state.selected.map((item) => item.id);
      expect(selectedIds).toEqual(expect.arrayContaining(scenario.expectedItemIds));
      if (scenario.expectedCategories) {
        expect(state.selected.map((item) => item.category)).toEqual(expect.arrayContaining(scenario.expectedCategories));
      }

      await page.locator('#sendReviewPanel button[data-send-review-action="approve"]').first().click();
      await expect(page.locator("#sendReviewPanel")).toHaveClass(/is-approved/);
      await expectNoBrowserErrors(errors);
    });
  }
});
