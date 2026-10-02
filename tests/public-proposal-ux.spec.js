const { test, expect } = require("@playwright/test");
const { collectBrowserErrors, expectNoBrowserErrors, expectNoHorizontalOverflow } = require("./support");

const token = "00000000-0000-4000-8000-000000000111";
const proposal = {
  id: "00000000-0000-4000-8000-000000000222",
  cliente_nome: "Ana Costa", tipo_evento: "Coffee Break", data_evento: "2026-11-17",
  horario_evento: "09:00", convidados: 30, duracao: 2, subtotal: 2000,
  taxa_servico: 240, privatizacao: 0, total: 2240,
  status: "proposta_enviada", cliente_resposta: null, cliente_solicitacao: null,
  snapshot: {
    event: { type: "Coffee Break", validity: "14 dias", signalDeadlineHours: 48, clientLanguage: "pt" },
    totals: { total: 2240, serviceFee: 240 },
    selectedItems: [{ nome: "Coffee Break Carioca", descricao: "Café e quitutes.", calc: { total: 2000, detail: "30 convidados" } }],
    paymentTerms: ["50% do valor total na confirmação da reserva.", "50% restante até 72 horas antes do evento."],
    generalTerms: "CANCELAMENTO: Mais de 5 dias úteis antes do evento: 25% do valor total contratado.\nEntre 5 dias úteis e 48 horas antes: 50%.\nMenos de 48 horas antes do evento: 100%.\nINGRESSOS TELEFÉRICO: os valores não incluem os ingressos para o teleférico, que devem ser adquiridos separadamente.",
  },
};

async function openProposal(page, initial = proposal, query = "") {
  await page.addInitScript((fixture) => {
    window.__proposalFixture = fixture;
    window.__rpcCalls = [];
    window.supabase = { createClient: () => ({ rpc: async (name, payload) => {
      window.__rpcCalls.push({ name, payload });
      if (name === "get_public_proposal") return { data: [structuredClone(window.__proposalFixture)], error: null };
      if (name === "record_public_proposal_view") return { data: [], error: null };
      if (name === "respond_public_proposal") {
        const p = window.__proposalFixture;
        p.status = payload.action === "cancelar" ? "cancelado" : "negociacao";
        p.cliente_resposta = payload.action;
        p.cliente_mensagem = payload.message;
        p.cliente_solicitacao = { comprovante: payload.payment_proof || null };
        return { data: [{ ok: true }], error: null };
      }
      if (name === "submit_public_signal_proof") {
        window.__proposalFixture.cliente_solicitacao.comprovante = payload.payment_proof;
        return { data: [{ ok: true }], error: null };
      }
      return { data: null, error: { message: `Unexpected RPC ${name}` } };
    } }) };
  }, structuredClone(initial));
  await page.route("**/*supabase-js@2*", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.goto(`/proposta.html?p=${token}${query}`);
  await expect(page.locator(".public-proposal-summary")).toBeVisible();
}

test.describe("Decisão do cliente na proposta", () => {
  test("investimento exibe a experiência contratada e oculta a linha quando não há valor", async ({ page }) => {
    await openProposal(page);
    await expect(page.locator(".public-proposal-totals")).not.toContainText(/Privatizaç|Área Dedicada|Experiência Exclusiva/);

    const dedicated = structuredClone(proposal);
    dedicated.privatizacao = 6000;
    dedicated.total = 8240;
    dedicated.snapshot.totals = {
      ...dedicated.snapshot.totals,
      privatizationAmount: 6000,
      privatization: { mode: "required-partial", amount: 6000, title: "Pico obrigatório: privatização parcial" },
    };
    await page.evaluate((fixture) => renderProposal(fixture), dedicated);
    await expect(page.locator(".public-proposal-totals")).toContainText("Área Dedicada & Serviço Prioritário");
    await expect(page.locator(".public-proposal-totals")).toContainText("R$ 6.000,00");
    await expect(page.locator(".public-proposal-totals")).not.toContainText(/Privatizaç|Pico obrigatório/);

    dedicated.snapshot.totals.privatization.mode = "required-full";
    await page.evaluate((fixture) => renderProposal(fixture), dedicated);
    await expect(page.locator(".public-proposal-totals")).toContainText("Experiência Exclusiva");
  });

  test("mobile mostra investimento e próximo passo na primeira tela, com condições antes da aprovação", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openProposal(page);
    const summary = page.locator(".public-proposal-summary");
    const jump = page.locator(".public-proposal-jump");
    await expect(summary).toContainText("R$ 2.240,00");
    await expect(jump).toBeVisible();
    expect(await jump.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(844);
    await expect(page.locator(".public-commercial-summary")).toContainText("Ingressos do teleférico não incluídos");
    await expect(page.locator(".public-commercial-summary")).toContainText("Cancelamento: 25%");
    await expect(page.locator(".public-commercial-summary")).toContainText("14 dias");
    await expect(page.locator("#publicProposalResponseForm")).toBeHidden();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expectNoHorizontalOverflow(page);
    }
    await expectNoBrowserErrors(errors);
  });

  test("aprovação não confirma reserva e comprovante pode ser enviado depois sem nova aprovação", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await openProposal(page);
    await page.getByRole("button", { name: "Aprovar e seguir para reserva" }).click();
    await expect(page.locator("#publicProposalResponseForm")).toBeVisible();
    await expect(page.locator("#publicPaymentInfoSlot")).toBeVisible();
    await page.getByRole("button", { name: "Enviar aprovação à equipe" }).click();
    await expect(page.getByText("Aprovação recebida", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprovar e seguir para reserva" })).toHaveCount(0);
    await expect(page.getByText("Sinal recebido e reserva confirmada")).toHaveCount(0);
    await page.getByRole("button", { name: "Enviar comprovante do sinal" }).click();
    await expect(page.locator("#publicLaterProofForm")).toBeVisible();
    await page.locator("#publicLaterProofForm").getByRole("button", { name: "Enviar comprovante" }).click();
    await expect(page.locator("#publicProposalStatus")).toContainText("Escolha um comprovante");
    await page.locator("#publicLaterProofForm input[type=file]").setInputFiles({
      name: "comprovante.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
    await expect(page.locator("#publicProofStatus")).toContainText("comprovante.pdf");
    await page.locator("#publicLaterProofForm").getByRole("button", { name: "Enviar comprovante" }).click();
    await expect(page.locator(".public-proof-summary")).toContainText("comprovante.pdf");
    const calls = await page.evaluate(() => window.__rpcCalls.map(({ name }) => name));
    expect(calls.filter((name) => name === "respond_public_proposal")).toHaveLength(1);
    expect(calls.filter((name) => name === "submit_public_signal_proof")).toHaveLength(1);
    await expectNoBrowserErrors(errors);
  });

  test("pedido de ajuste traz status útil e não mostra segunda aprovação", async ({ page }) => {
    await openProposal(page);
    await page.getByRole("button", { name: "Pedir ajuste" }).click();
    await page.locator("#publicResponseMessage").fill("Trocar horário para 10h.");
    await page.getByRole("button", { name: "Enviar pedido de ajuste" }).click();
    await expect(page.getByText("Ajuste solicitado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprovar e seguir para reserva" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tirar dúvida no WhatsApp" })).toHaveAttribute("href", /wa\.me\/5521971426007/);
  });

  test("proposta em inglês mantém valor, condições e ações traduzidos", async ({ page }) => {
    await openProposal(page, proposal, "&lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator(".public-proposal-summary")).toContainText("Estimated total");
    await expect(page.locator(".public-commercial-summary")).toContainText("Cable car tickets are not included");
    await expect(page.getByRole("button", { name: "Approve and proceed to booking" })).toBeVisible();
    await page.getByRole("button", { name: "PT" }).click();
    await expect(page.getByRole("button", { name: "Aprovar e seguir para reserva" })).toBeVisible();
  });
});
