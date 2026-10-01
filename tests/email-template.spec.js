const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const vm = require("node:vm");

function renderEmail() {
  const source = readFileSync("supabase/functions/send-proposal-email/index.ts", "utf8");
  const helpers = source.slice(source.indexOf("function safeText"), source.indexOf("Deno.serve("));
  const proposal = {
    cliente_nome: "Teste Interno E2E Outubro",
    tipo_evento: "Coffee Break",
    data_evento: "2026-11-17",
    horario_evento: "09:00",
    convidados: 30,
    duracao: 1,
    total: 2184,
    snapshot: {
      items: [{ name: "Café da Manhã Clássico", description: "Café, chá, sucos, pães, frutas e bolo.", calc: { total: 1950 } }],
    },
  };
  const url = "https://example.com/proposta-de-teste";
  return vm.runInNewContext(
    `${stripTypeScriptTypes(helpers)}\n({ html: buildProposalEmailHtml(proposal, url, "Mensagem de teste"), text: buildProposalEmailText(proposal, url, "Mensagem de teste") })`,
    { proposal, url, Intl, Date },
  );
}

test("e-mail mostra valor e ação antes dos detalhes na primeira tela", async ({ page }) => {
  const { html, text } = renderEmail();
  expect(text).toContain("https://example.com/proposta-de-teste");
  expect(text).toContain("Mensagem de teste");

  for (const width of [1240, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await page.setContent(html);
    const summary = page.getByText("R$ 2.184,00", { exact: true }).first();
    const action = page.getByRole("link", { name: "Ver e responder proposta" });
    await expect(summary).toBeVisible();
    await expect(action).toHaveAttribute("href", "https://example.com/proposta-de-teste");
    const actionBottom = await action.evaluate((node) => node.getBoundingClientRect().bottom);
    expect(actionBottom, `Botão deve caber na primeira tela de ${width}px`).toBeLessThan(430);
    const detailsTop = await page.getByText("Itens da proposta").evaluate((node) => node.getBoundingClientRect().top);
    expect(actionBottom).toBeLessThan(detailsTop);
  }
});
