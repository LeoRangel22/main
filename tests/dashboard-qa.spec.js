const { test, expect } = require("@playwright/test");
const {
  collectBrowserErrors,
  expectElementInViewport,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
  expectScrolledNear,
} = require("./support");

test.describe("Dashboard interno em modo QA", () => {
  test("primeira resposta é editável e só vira contato após registro explícito", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.locator('[data-pipeline-card-id="qa-request-prioridade"] .pipeline-open-button').click();
    const panel = page.locator("#firstReplyPanel");
    await expect(panel).toBeVisible();
    await expect(panel.locator("textarea")).toHaveValue(/Almoço Carioca/);
    await panel.locator("textarea").fill("Olá, Claudia! Vou confirmar a disponibilidade e retorno com as opções.");
    const before = await page.evaluate(() => state.opportunities.find((row) => row.id === "qa-opp-qa-request-prioridade")?.metadata?.first_reply_sent_at);
    expect(before).toBeFalsy();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await panel.getByRole("button", { name: "Copiar mensagem" }).click();
    await panel.getByRole("button", { name: "Registrar contato feito" }).click();
    await expect(panel).toContainText("Primeiro contato registrado");
    await expect(page.locator('[data-pipeline-card-id="qa-request-prioridade"]')).toContainText("Montar proposta");
    await expectNoBrowserErrors(errors);
  });

  test("cancelamento de teste preserva a proposta e registra o motivo", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    const card = page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"]');
    await card.locator('[data-cancel-id="qa-proposal-sem-resposta"]').click();
    const dialog = page.locator(".cancel-reason-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Voltar" }).click();
    expect(await page.evaluate(() => state.proposals.find((item) => item.id === "qa-proposal-sem-resposta")?.status)).toBe("proposta_enviada");

    await card.locator('[data-cancel-id="qa-proposal-sem-resposta"]').click();
    await dialog.locator('[name="reason"]').selectOption("Teste / cadastro de teste");
    await dialog.getByRole("button", { name: "Registrar cancelamento" }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await page.evaluate(() => state.proposals.find((item) => item.id === "qa-proposal-sem-resposta"));
    expect(saved?.status).toBe("cancelado");
    expect(saved?.snapshot?.cancelamento?.motivo).toBe("Teste / cadastro de teste");
    expect(saved?.snapshot?.commercialHistory?.[0]?.type).toBeTruthy();
    await expectNoBrowserErrors(errors);
  });

  test("plano comercial salva responsável, prazo e contato e acompanha versão visualizada", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    expect(await page.evaluate(() => Boolean(document.querySelector(".action-center").compareDocumentPosition(document.querySelector(".owner-metrics")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

    const card = page.locator('[data-pipeline-card-id="qa-request-prioridade"]');
    await expect(card).toContainText("Sem responsável");
    await card.getByRole("button", { name: "Planejar" }).click();
    const dialog = page.locator(".action-plan-dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator('[name="owner"]').selectOption("eventos@embaixadacarioca.com.br");
    await dialog.locator('[name="action"]').fill("Ligar para alinhar o almoço");
    await dialog.locator('[name="contact"]').check();
    await dialog.getByRole("button", { name: "Salvar plano" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toContainText("Ligar para alinhar o almoço");
    expect(await page.evaluate(() => state.opportunities.find((row) => row.id === "qa-opp-qa-request-prioridade")?.ultimo_contato_em)).toBeTruthy();

    await page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"]').getByRole("button", { name: /Reenviar|Abrir/i }).click();
    await expect(page.locator(".proposal-journey")).toContainText("V1 publicada");
    await expect(page.locator(".proposal-journey")).toContainText("Envio registrado");
    await expect(page.locator(".proposal-journey")).toContainText("Ainda não registrado");
    await expect(page.locator(".proposal-journey")).toContainText("1 · última");
    await expect(page.locator(".proposal-version-list summary")).toHaveText("Ver 1 versão preservada");
    await page.evaluate(() => {
      const current = state.proposals.find((row) => row.id === "qa-proposal-sem-resposta");
      state.proposals.unshift({ ...current, id: "qa-proposal-v2-draft", versao: 2, is_current: false, publication_status: "draft", sent_at: null });
      renderCommercialTimeline(current);
    });
    await expect(page.locator(".proposal-journey")).toContainText("V1 publicada");
    await page.locator(".proposal-version-list summary").click();
    await expect(page.locator(".proposal-version-list")).toContainText("V2 · Rascunho");
    await expect(page.locator(".proposal-version-list")).toContainText("V1 · Publicada");
    await expectNoBrowserErrors(errors);
  });

  test("alçada bloqueia desconto alto e versões mostram comparação e duplicação", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"]').getByRole("button", { name: /Reenviar|Abrir/i }).click();

    await page.locator("#manualAdjustment").fill("-1500");
    await expect(page.locator("#commercialApprovalPanel")).toBeVisible();
    await expect(page.locator("#commercialApprovalPanel")).toContainText("Aprovação do gestor necessária");
    expect(await page.evaluate(() => getProposalReviewItems().find((item) => item.id === "commercial_approval")?.status)).toBe("error");
    await page.locator("#commercialApprovalBy").fill("gestor@embaixadacarioca.com.br");
    await page.locator("#commercialApprovalConfirmed").check();
    expect(await page.evaluate(() => getProposalReviewItems().find((item) => item.id === "commercial_approval")?.status)).toBe("ok");

    await page.evaluate(() => {
      const current = state.proposals.find((row) => row.id === "qa-proposal-sem-resposta");
      const changed = structuredClone(current);
      changed.id = "qa-proposal-v2-comparison";
      changed.versao = 2;
      changed.publication_status = "draft";
      changed.snapshot.event.guests = Number(changed.snapshot.event.guests || 1) + 10;
      changed.snapshot.totals.total = Number(changed.snapshot.totals.total || changed.total) + 500;
      changed.total += 500;
      state.proposals.unshift(changed);
      renderCommercialTimeline(changed);
    });
    await expect(page.locator(".proposal-version-comparison")).toContainText("O que mudou");
    await expect(page.locator(".proposal-version-comparison")).toContainText("Convidados");
    await page.locator('[data-duplicate-proposal-id="qa-proposal-sem-resposta"]').click();
    expect(await page.evaluate(() => state.forceNewVersionDraft)).toBe(true);
    await expectNoBrowserErrors(errors);
  });

  test("relatórios exibem aprendizado comercial acionável", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.getByRole("button", { name: /Visão completa/i }).click();
    await expect(page.locator(".commercial-learning")).toContainText("Aprendizado comercial");
    await expect(page.locator(".commercial-learning")).toContainText("Funil ponderado");
    await expect(page.locator(".commercial-learning")).toContainText("Produtos mais vendidos");
    await expect(page.locator(".commercial-learning")).toContainText("Motivos de perda");
    await expectNoBrowserErrors(errors);
  });

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
    await page.getByRole("button", { name: "Visão completa" }).click();
    const fullPaymentCard = page.locator('[data-pipeline-card-id="qa-proposal-sinal-integral"]');
    await expect(fullPaymentCard).toBeVisible();
    await expect(fullPaymentCard).toContainText(/Planejar|Enviar para planejamento/i);
    await expect(fullPaymentCard).toContainText(/Pagamento completo|Próximo passo é operação/i);
    await expect(fullPaymentCard).not.toContainText(/Falta saldo|Cobrar saldo/i);
    await expectNoBrowserErrors(errors);
  });
  test("evento com sinal gera ficha tecnica e checklist operacional", async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto("/index.html?qa=1");
    await page.getByRole("button", { name: "Visão completa" }).click();
    const signalCard = page.locator('[data-pipeline-card-id="qa-proposal-sinal"]');
    await expect(signalCard).toBeVisible();
    await signalCard.click();

    await expect(page.locator("#loadedEditorBar")).toContainText(/Julia Morena/i);
    await expect(page.locator("#operationalChecklist")).toBeVisible();
    await expect(page.locator("#operationalChecklist")).toContainText("Operação pós-sinal");
    await expect(page.locator("#operationalChecklist")).toContainText("Gere a ficha técnica");
    await expect(page.locator('button[data-operational-doc="technical-no-finance"]')).toBeVisible();
    await expect(page.locator('button[data-operational-doc="technical-finance"]')).toBeVisible();
    await expect(page.locator('button[data-operational-doc="checklist"]')).toBeVisible();

    const operationalHtml = await page.evaluate(() => buildTechnicalSheetHtml(getActiveProposal(), { showFinance: false }));
    expect(operationalHtml).toContain("Ficha operacional do evento");
    expect(operationalHtml).toContain("Itens contratados");
    expect(operationalHtml).toContain("Lista de insumos");
    expect(operationalHtml).toContain("Julia Morena");
    expect(operationalHtml).not.toContain("Financeiro");
    expect(operationalHtml).not.toContain("R$");

    const technicalHtml = await page.evaluate(() => buildTechnicalSheetHtml(getActiveProposal(), { showFinance: true }));
    expect(technicalHtml).toContain("Ficha técnica do evento");
    expect(technicalHtml).toContain("Financeiro");
    expect(technicalHtml).toContain("R$");

    const checklistHtml = await page.evaluate(() => buildOperationalChecklistHtml(getActiveProposal()));
    expect(checklistHtml).toContain("Lista de insumos");
    expect(checklistHtml).toContain("Lista de insumos conferida");
    expect(checklistHtml).toContain("Conferência financeira operacional");
    expect(checklistHtml).not.toContain("R$");

    await expectNoBrowserErrors(errors);
  });

  test("modo vendas simplifica o painel e preserva a visão completa", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");

    await expect(page.locator("body")).toHaveClass(/workspace-mode-sales/);
    await expect(page.locator(".pipeline-row-commercial")).toBeVisible();
    await expect(page.locator(".pipeline-row-operation")).toHaveCount(0);
    await expect(page.locator("#operationsAgenda")).toBeHidden();

    await page.getByRole("button", { name: "Visão completa" }).click();
    await expect(page.locator("body")).toHaveClass(/workspace-mode-full/);
    await expect(page.locator(".pipeline-row-operation")).toBeVisible();
    await expect(page.locator(".pipeline-stage-desfecho_pendente")).toContainText("Marina Histórico");
    await expectNoBrowserErrors(errors);
  });

  test("evento passado sai do funil ativo e volta quando é remarcado", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.getByRole("button", { name: "Visão completa" }).click();

    await page.locator(".pipeline-stage-desfecho_pendente summary").click();
    const pastCard = page.locator('[data-pipeline-card-id="qa-proposal-desfecho"]');
    await expect(pastCard).toBeVisible();
    await pastCard.getByRole("button", { name: "Classificar desfecho" }).click();
    const dialog = page.locator(".past-event-outcome-dialog");
    await dialog.locator('[name="outcome"]').selectOption("remarcado");
    const futureDate = await page.evaluate(() => createQaDate(22));
    await dialog.locator('[name="newDate"]').fill(futureDate);
    await dialog.locator('[name="detail"]').fill("Cliente confirmou a nova janela.");
    await dialog.getByRole("button", { name: "Salvar desfecho" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.pipeline-stage-negociacao [data-pipeline-card-id="qa-proposal-desfecho"]')).toBeVisible();
    const saved = await page.evaluate(() => state.proposals.find((item) => item.id === "qa-proposal-desfecho"));
    expect(saved.status).toBe("negociacao");
    expect(saved.data_evento).toBe(futureDate);
    expect(saved.snapshot.eventOutcome.outcome).toBe("remarcado");
    await expectNoBrowserErrors(errors);
  });

  test("rascunho inteligente explica e só aplica após aprovação humana", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.locator('[data-pipeline-card-id="qa-request-prioridade"] .pipeline-open-button').click();

    const panel = page.locator("#smartDraftPanel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Nada é enviado ou aplicado sem sua aprovação");
    await expect(panel).toContainText("Almoço Carioca");
    expect(await page.evaluate(() => state.selectedIds.size)).toBe(0);

    await panel.getByRole("button", { name: "Aplicar rascunho" }).click();
    await expect(panel).toContainText("Sugestão aprovada pelo vendedor");
    expect(await page.evaluate(() => state.selectedIds.size)).toBeGreaterThan(0);
    expect(await page.evaluate(() => state.smartDraftApproval?.approvedBy)).toBe("leorangel@gmail.com");
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
