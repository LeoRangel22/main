const { test, expect } = require("@playwright/test");
const { collectBrowserErrors, expectNoBrowserErrors, expectNoHorizontalOverflow } = require("./support");

async function mount(page) {
  await page.route("https://**", route => route.abort());
  await page.goto("/index.html?qa=1");
  await page.evaluate(() => {
    const template = structuredClone(state.proposals.find(p => p.id === "qa-proposal-sem-resposta"));
    const make = (id, name, day, received, extra = {}) => ({
      ...structuredClone(template), id, oportunidade_id: id, solicitacao_id: null,
      cliente_nome: name, cliente_email: id + "@example.test", cliente_whatsapp: "+55 (21) 98765-4321",
      empresa: id === "ana" ? "Órbita Café" : "", data_evento: "2099-11-" + day,
      created_at: "2026-11-06T12:00:00Z", updated_at: "2026-11-07T12:00:00Z",
      status: "proposta_pronta", is_current: true, publication_status: "ready", versao: 2,
      sent_at: null, cliente_resposta: null, cliente_resposta_em: null, cliente_solicitacao: null,
      snapshot: { ...structuredClone(template.snapshot), clienteResposta: null, pagamentoSinal: null, pagamentoRestante: null },
      ...extra,
    });
    state.proposals = [
      make("zulu", "Zulu", "20"),
      make("ana", "Ána Cláudia", "18"),
      make("bruna", "Bruna", "19"),
      make("waiting", "Cliente aguardando", "21", null, { status: "proposta_enviada", publication_status: "sent", sent_at: "2026-11-07T10:00:00Z" }),
    ];
    state.opportunities = ["zulu", "bruna", "ana", "waiting"].map((id, index) => ({ id, created_at: "2026-11-0" + (4 - index) + "T12:00:00Z" }));
    state.quoteRequests = [];
    eventOps.messages = []; eventOps.loadedFor = state.session.user.id; eventOps.error = ""; eventOps.loading = null;
    state.activePipelineFilter = "all"; state.pipelineSorts = {}; state.workspaceMode = "sales";
    commercialStageLimits = {}; renderPipeline();
  });
}
const cards = page => page.locator("#pipelineBoard .pipeline-card");
const ready = page => page.locator(".pipeline-stage-sales_ready");
const ids = column => column.locator(".pipeline-card").evaluateAll(nodes => nodes.map(node => node.dataset.pipelineCardId));

test("each column sorts independently, keeps keyboard focus and preserves business data", async ({ page }) => {
  const errors = collectBrowserErrors(page); await mount(page);
  const before = await page.evaluate(() => JSON.stringify([state.proposals, state.opportunities, state.quoteRequests]));
  expect(await ids(ready(page))).toEqual(["zulu", "bruna", "ana"]);
  const order = ready(page).getByRole("combobox");
  await order.selectOption("name");
  expect(await ids(ready(page))).toEqual(["ana", "bruna", "zulu"]);
  await expect(order).toBeFocused();
  await expect(page.locator('[data-pipeline-sort="sales_waiting"]')).toHaveValue("received");
  await order.selectOption("event");
  expect(await ids(ready(page))).toEqual(["ana", "bruna", "zulu"]);
  await page.evaluate(() => renderPipeline());
  await expect(order).toHaveValue("event");
  expect(await page.evaluate(() => loadPipelineSorts().sales_ready)).toBe("event");
  expect(await page.evaluate(() => JSON.stringify([state.proposals, state.opportunities, state.quoteRequests]))).toBe(before);
  await expectNoBrowserErrors(errors);
});
test("search supports accents, company, e-mail, mobile and event/receipt dates without losing input focus", async ({ page }) => {
  const errors = collectBrowserErrors(page); await mount(page);
  const search = page.getByRole("searchbox", { name: "Buscar no funil" });
  for (const query of ["ana orbita", "ana@example.test", "18/11/2099", "2099-11-18", "02/11/2026"]) {
    await search.fill(query); await expect(cards(page)).toHaveCount(1); await expect(cards(page)).toContainText("Ána Cláudia");
    await expect(search).toBeFocused();
  }
  for (const query of ["(21) 98765-4321", "21987654321"]) { await search.fill(query); await expect(cards(page)).toHaveCount(4); }
  await search.fill("cliente inexistente"); await expect(cards(page)).toHaveCount(0);
  await expect(page.locator("#pipelineSearchStatus")).toContainText("0 registros");
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(search).toHaveValue(""); await expect(search).toBeFocused(); await expect(cards(page)).toHaveCount(4);
  await expectNoBrowserErrors(errors);
});
test("search composes with the existing sales filter and clears sensitive text on logout", async ({ page }) => {
  await mount(page);
  const search = page.locator("#pipelineSearchInput");
  await search.fill("cliente");
  await page.locator('[data-sales-funnel="ready"]').click(); await expect(cards(page)).toHaveCount(0);
  await search.fill("ana"); await expect(cards(page)).toHaveCount(1);
  await expect(page.locator("#pipelineSearchStatus")).toContainText("1 registro");
  expect(await page.evaluate(() => localStorage.getItem("embaixada_orcamentos_busca_funil_v1"))).toBeNull();
  await page.evaluate(() => { state.session = null; renderPipeline(); });
  await expect(search).toHaveValue(""); await expect(search).toBeDisabled();
  await expect(cards(page)).toHaveCount(0);
});
test("sort and search include records beyond the first page", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => {
    const template = state.proposals[0];
    state.proposals = Array.from({ length: 26 }, (_, i) => ({
      ...structuredClone(template), id: "page-" + i, oportunidade_id: "page-" + i,
      cliente_nome: i === 25 ? "Alvo fora da primeira página" : "Zulu " + String(i).padStart(2, "0"),
      created_at: "2026-11-06T12:" + String(59 - i).padStart(2, "0") + ":00Z",
    }));
    state.opportunities = []; renderPipeline();
  });
  await expect(ready(page).locator(".pipeline-card")).toHaveCount(20);
  await expect(ready(page)).not.toContainText("Alvo fora");
  await ready(page).getByRole("combobox").selectOption("name");
  await expect(ready(page).locator(".pipeline-card").first()).toContainText("Alvo fora");
  await ready(page).getByRole("combobox").selectOption("received");
  await page.locator("#pipelineSearchInput").fill("alvo");
  await expect(cards(page)).toHaveCount(1); await expect(cards(page)).toContainText("Alvo fora");
});
test("search and sorting fit mobile, full view includes operation/archive, and invalid stored settings are ignored", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page);
  await page.evaluate(() => { state.workspaceMode = "full"; renderPipeline(); });
  await expectNoHorizontalOverflow(page);
  expect(await page.locator("#pipelineBoard .pipeline-column").count()).toBeGreaterThan(5);
  expect(await page.locator("#pipelineBoard [data-pipeline-sort]").count()).toBe(await page.locator("#pipelineBoard .pipeline-column").count());
  await ready(page).getByRole("combobox").selectOption("name");
  await page.locator("#pipelineSearchInput").fill("ana");
  await expect(cards(page)).toHaveCount(1); await expectNoHorizontalOverflow(page);
  await page.evaluate(() => {
    state.proposals.push({ ...structuredClone(state.proposals[0]), id: "archived", oportunidade_id: "archived", cliente_nome: "Zélia Arquivada", status: "cancelado" });
    renderPipeline();
  });
  await page.locator("#pipelineSearchInput").fill("arquivada");
  const archived = page.locator(".pipeline-stage-cancelado");
  await expect(archived.locator("details")).toHaveAttribute("open", "");
  await expect(archived.locator(".pipeline-card")).toBeVisible();
  await archived.getByRole("combobox").selectOption("name");
  await expect(archived.locator("details")).toHaveAttribute("open", "");
  await expect(archived.getByRole("combobox")).toBeFocused();
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(archived.locator("details")).toHaveAttribute("open", "");
  const saved = await page.evaluate(() => {
    localStorage.setItem(PIPELINE_SORT_KEY, JSON.stringify({ sales_ready: "invalid", sales_waiting: "name", bad1: "event" }));
    return loadPipelineSorts();
  });
  expect(saved).toEqual({ sales_waiting: "name" });
});
