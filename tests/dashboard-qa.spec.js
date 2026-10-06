const { test, expect } = require("@playwright/test");
const {
  collectBrowserErrors,
  expectElementInViewport,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
  expectScrolledNear,
} = require("./support");

test.describe("Dashboard interno em modo QA", () => {
  test("retornos respeitam resposta, contato recente e comprovante sem confirmar reserva", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    const result = await page.evaluate(() => {
      const item = getPipelineItems().find((row) => row.id === "qa-proposal-sem-resposta");
      const original = getProposalFollowUpInfo(item);
      const adjustment = { ...item, clientResponse: "alteracao", clientMessage: "Trocar cardápio" };
      const adjusted = getActionTasks([adjustment]);
      const approved = { ...item, clientResponse: "confirmar", snapshot: { ...item.snapshot, event: { signalDeadlineAt: new Date(Date.now() - 3600000).toISOString() } } };
      const signal = getActionTasks([approved]);
      const proof = getActionTasks([{ ...approved, hasSignalProof: true }]);
      const opportunity = getOpportunityForItem(item);
      opportunity.proxima_acao_em = new Date(Date.now() + 864e5).toISOString();
      const scheduled = getActionTasks([item])[0].title;
      opportunity.proxima_acao_em = "";
      opportunity.ultimo_contato_em = new Date().toISOString();
      return {
        original: Boolean(original), scheduled, adjusted: adjusted.map((task) => task.title),
        responseBadge: getProposalFollowUpInfo(adjustment), sla: getSlaMeta(adjustment).label,
        signal: signal.map((task) => task.note), proof: proof.map((task) => task.title),
        recent: getProposalFollowUpInfo(item), recentTask: getActionTasks([item])[0].title,
      };
    });
    expect(result.original).toBe(true);
    expect(result.scheduled).toBe("Retorno agendado");
    expect(result.adjusted).toEqual(["Responder pedido de ajuste"]);
    expect(result.responseBadge).toBeNull();
    expect(result.sla).not.toContain("Sem retorno");
    expect(result.signal[0]).toContain("atrasado");
    expect(result.proof).toEqual(["Validar comprovante do sinal"]);
    expect(result.recent).toBeNull();
    expect(result.recentTask).toBe("Aguardar retorno do cliente");
  });
  test("retorno futuro mantém card, SLA e radar coerentes e não silencia conflitos de agenda", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    const result = await page.evaluate(() => {
      const item = getPipelineItems().find((row) => row.id === "qa-proposal-sem-resposta");
      getOpportunityForItem(item).proxima_acao_em = new Date(Date.now() + 864e5).toISOString();
      const scheduled = { badge: getProposalFollowUpInfo(item), sla: getSlaMeta(item), primary: getPipelinePrimaryAction(item), card: renderPipelineCard(item) };
      state.workspaceMode = "full";
      const conflict = { ...item, id: "qa-conflict", opportunityId: "", status: "confirmado" };
      const tasks = getActionTasks([item, conflict]);
      const answered = { ...item, clientResponse: "alteracao", clientMessage: "Ajustar convidados" };
      return { scheduled, conflict: tasks.find((task) => task.track === "Agenda")?.title, response: getActionTasks([answered])[0].title };
    });
    expect(result.scheduled.badge).toBeNull();
    expect(result.scheduled.sla.label).toContain("Próximo contato");
    expect(result.scheduled.primary.label).toBe("Retorno agendado");
    expect(result.scheduled.card).not.toContain("Sem retorno há");
    expect(result.conflict).toBe("Conflito de agenda");
    expect(result.response).toBe("Responder pedido de ajuste");
  });
  test("resposta na versão publicada tem prioridade sobre rascunho e preserva acesso à nova versão", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    const result = await page.evaluate(() => {
      const published = state.proposals.find((row) => row.id === "qa-proposal-sem-resposta");
      published.is_current = true;
      published.cliente_resposta = "alteracao";
      published.cliente_resposta_em = new Date().toISOString();
      const draft = { ...structuredClone(published), id: "qa-new-draft", versao: 2, is_current: false, publication_status: "draft", cliente_resposta: null, cliente_resposta_em: null, created_at: new Date(Date.now() - 3600000).toISOString() };
      state.proposals.unshift(draft);
      const item = getPipelineItems().find((row) => row.opportunityId === published.oportunidade_id);
      const pending = { id: item.id, draft: item.pendingDraftId, task: getActionTasks([item])[0].title, count: getPipelineItems().filter((row) => row.opportunityId === item.opportunityId).length, card: renderPipelineCard(item) };
      published.cliente_resposta_em = new Date(Date.now() - 7200000).toISOString();
      const started = getWorkingProposals().find((row) => row.oportunidade_id === published.oportunidade_id).id;
      published.cliente_resposta = "confirmar";
      const approved = getWorkingProposals().find((row) => row.oportunidade_id === published.oportunidade_id).id;
      published.cliente_resposta = "cancelar";
      const cancelled = getWorkingProposals().find((row) => row.oportunidade_id === published.oportunidade_id).id;
      return { pending, started, approved, cancelled };
    });
    expect(result.pending.id).toBe("qa-proposal-sem-resposta");
    expect(result.pending.draft).toBe("qa-new-draft");
    expect(result.pending.task).toBe("Responder pedido de ajuste");
    expect(result.pending.count).toBe(1);
    expect(result.pending.card).toContain('data-proposal-id="qa-new-draft"');
    expect(result.started).toBe("qa-new-draft");
    expect(result.approved).toBe("qa-proposal-sem-resposta");
    expect(result.cancelled).toBe("qa-proposal-sem-resposta");
  });
  test("versão atual prevalece sobre edição posterior de versão histórica", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    const selected = await page.evaluate(() => {
      const current = state.proposals.find((row) => row.id === "qa-proposal-sem-resposta");
      current.is_current = true;
      state.proposals.unshift({ ...current, id: "qa-historical-newer-update", is_current: false, updated_at: new Date().toISOString() });
      return getWorkingProposals().find((row) => row.oportunidade_id === current.oportunidade_id).id;
    });
    expect(selected).toBe("qa-proposal-sem-resposta");
  });
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
    expect(await page.evaluate(() => getProposalReviewItems().find((item) => item.id === "commercial_approval")?.status)).toBe("warning");
    await page.locator("#commercialApprovalBy").fill("gestor@embaixadacarioca.com.br");
    await page.locator("#commercialApprovalConfirmed").check();
    expect(await page.evaluate(() => getProposalReviewItems().find((item) => item.id === "commercial_approval")?.status)).toBe("warning");

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
    await page.locator(".proposal-version-list summary").click();
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

  test("aprendizado não infla previsão com histórico e mede primeira resposta desde a entrada do lead", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    const metrics = await page.evaluate(() => {
      const base = { kind: "proposal", isDraft: false, total: 1000, snapshot: {}, createdAt: "2026-10-01T12:00:00Z" };
      state.opportunities.push({ id: "qa-metrics-opp", created_at: "2026-10-01T08:00:00Z" });
      return getCommercialLearningMetrics([
        { ...base, status: "proposta_enviada", stage: "proposta_enviada", date: createQaDate(7), opportunityId: "qa-metrics-opp", firstReplySentAt: "2026-10-01T10:00:00Z" },
        { ...base, status: "negociacao", stage: "negociacao", date: "" },
        { ...base, status: "proposta_enviada", stage: "desfecho_pendente", date: createQaDate(-2) },
        { ...base, status: "confirmado", stage: "confirmado", date: createQaDate(7) },
        { ...base, status: "cancelado", stage: "cancelado", cancelReason: "Preço" },
        { ...base, status: "pos_venda", stage: "pos_venda", snapshot: { eventOutcome: { outcome: "realizado" } } },
        { ...base, total: 0, status: "negociacao", stage: "negociacao", snapshot: { eventOutcome: { outcome: "remarcado" } } },
      ]);
    });
    expect(metrics.weightedPipeline).toBe(1050);
    expect(metrics.lossReasons).toEqual([["Preço", 1]]);
    expect(metrics.averageResponseHours).toBe(2);
    expect(metrics.responseSamples).toBe(1);
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
    await expect(page.locator(".admin-quick-nav")).toBeVisible();
    await expect(page.locator("#topbarNewProposalBtn")).toBeVisible();
    await expect(page.locator(".pipeline-guidance-shell")).not.toHaveAttribute("open", "");
    await expect(page.locator(".action-backlog")).not.toHaveAttribute("open", "");

    const compactLayout = await page.evaluate(() => {
      const topbar = document.querySelector(".topbar").getBoundingClientRect();
      const command = document.querySelector("#salesCommand").getBoundingClientRect();
      const columnList = document.querySelector(".pipeline-column-list");
      const columnStyle = getComputedStyle(columnList);
      return {
        topbarHeight: Math.round(topbar.height),
        commandHeight: Math.round(command.height),
        columnOverflow: columnStyle.overflowY,
        columnMaxHeight: columnStyle.maxHeight,
      };
    });
    expect(compactLayout.topbarHeight).toBeLessThan(150);
    expect(compactLayout.commandHeight).toBeLessThan(440);
    expect(compactLayout.columnOverflow).toBe("auto");
    expect(compactLayout.columnMaxHeight).not.toBe("none");

    await page.getByRole("button", { name: "Visão completa" }).click();
    await expect(page.locator("body")).toHaveClass(/workspace-mode-full/);
    await expect(page.locator(".pipeline-row-operation")).toBeVisible();
    await expect(page.locator(".pipeline-stage-desfecho_pendente")).toContainText("Marina Histórico");
    await expectNoBrowserErrors(errors);
  });

  test("funil cheio preserva cliente data e hora sem comprimir cards", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await page.evaluate(() => {
        const card = document.querySelector('[data-pipeline-card-id="qa-proposal-sem-resposta"]');
        const list = card.parentElement;
        if (!list.dataset.crowdedTest) {
          card.querySelector('.pipeline-card-name').textContent = 'Cliente com nome completo extenso — Agência de Turismo e Eventos Internacionais';
          card.querySelector('.pipeline-card-event-line').textContent = '21/10/2026 · qua · 16:30 · 120 pax';
          for (let i = 0; i < 30; i++) list.append(card.cloneNode(true));
          list.dataset.crowdedTest = 'true';
        }
        const cards = [...list.querySelectorAll('.pipeline-card')];
        return {
          scrollable: list.scrollHeight > list.clientHeight,
          readable: cards.every((item) => {
            const box = item.getBoundingClientRect();
            return ['.pipeline-card-name', '.pipeline-card-event-line'].every((selector) => {
              const node = item.querySelector(selector);
              const rect = node.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(node);
              const text = range.getBoundingClientRect();
              if (selector === '.pipeline-card-name') {
                const style = getComputedStyle(node);
                return rect.height > 16 && rect.top >= box.top && rect.bottom <= box.bottom
                  && style.whiteSpace === 'nowrap' && style.textOverflow === 'ellipsis'
                  && Boolean(node.title);
              }
              return rect.height > 16 && rect.top >= box.top && rect.bottom <= box.bottom
                && text.top >= box.top && text.bottom <= box.bottom
                && text.left >= box.left && text.right <= box.right
                && getComputedStyle(node).overflow === 'visible'
                && node.scrollWidth <= node.clientWidth + 1;
            });
          }),
          minimumHeight: Math.min(...cards.map((item) => item.getBoundingClientRect().height)),
          measurements: cards.slice(0, 2).map((item) => ({
            cardHeight: item.getBoundingClientRect().height,
            fields: ['.pipeline-card-name', '.pipeline-card-event-line'].map((selector) => {
              const node = item.querySelector(selector);
              const rect = node.getBoundingClientRect();
              const box = item.getBoundingClientRect();
              return { selector, height: rect.height, top: rect.top - box.top, bottom: rect.bottom - box.bottom,
                scroll: [node.scrollWidth, node.scrollHeight], client: [node.clientWidth, node.clientHeight] };
            }),
          })),
        };
      });
      expect(result.scrollable).toBe(true);
      expect(result.readable, JSON.stringify({ width, ...result })).toBe(true);
      expect(result.minimumHeight).toBeGreaterThan(120);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("atalho de nova proposta leva direto ao editor sem rolagem manual", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.locator("#topbarNewProposalBtn").click();
    await expect(page.locator("#loadedEditorBar")).toContainText("Nova proposta manual");
    await expectScrolledNear(page, "#clientDataSection", 300);
    await expectElementInViewport(page, "#loadedEditorBar", { bottom: 160 });
    await expectNoBrowserErrors(errors);
  });

  test("evento passado sai do funil ativo e volta quando é remarcado", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/index.html?qa=1");
    await page.getByRole("button", { name: "Visão completa" }).click();

    await page.locator(".pipeline-stage-desfecho_pendente .pipeline-column-summary").click();
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
    await expect(proposalCard.locator(".pipeline-card-product")).toContainText("Café da Manhã / Brunch");
    await expect(proposalCard.locator(".pipeline-card-event-line")).toContainText(/· (dom|seg|ter|qua|qui|sex|sáb) ·/i);
    await expect(proposalCard.locator(".pipeline-value-breakdown")).toContainText("A&B");
    await expect(proposalCard.locator(".pipeline-value-breakdown")).not.toContainText("Priv.");
    const paidArea = await page.evaluate(() => renderPipelineValueBreakdown(
      { ...getPipelineItems().find((row) => row.id === 'qa-proposal-sem-resposta'), privatizationAmount: 100 },
      '', { includeProduct: false, includeZero: false },
    ));
    expect(paidArea).toContain('Priv.');
    expect(paidArea).toMatch(/100,00/);
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
    const plannedAction = await page.evaluate(() => getTaskPlan(getPipelineItems().find((row) => row.id === 'qa-proposal-sem-resposta')).action);
    await expect(proposalCard.locator(".pipeline-card-next-action strong")).toHaveText(plannedAction);
    await expect(proposalCard.locator(".pipeline-plan-line")).not.toContainText(plannedAction);
    await expect(proposalCard.locator(".pipeline-card-next-action")).not.toContainText(/follow-up/i);
    await expect(proposalCard.locator(".pipeline-card-alerts")).not.toContainText(/follow-up/i);
    await expectNoBrowserErrors(errors);
  });

  test("card compacto mantém essenciais visíveis e expande contexto secundário", async ({ page }) => {
    await page.goto("/index.html?qa=1");
    await page.evaluate(() => {
      const item = getPipelineItems().find((row) => row.id === 'qa-proposal-sem-resposta');
      Object.assign(item, { name: 'Anna Vieira', company: 'Abercrombie & Kent Brazil',
        finalClient: 'Abercrombie & Kent Brazil', groupName: 'Brazil Ultimate Carnival 2028',
        total: 1008, privatizationAmount: 0, type: 'Welcome Drink', date: '2028-10-24', time: '17:00', guests: 25 });
      document.querySelector('[data-pipeline-card-id="qa-proposal-sem-resposta"]').outerHTML = renderPipelineCard(item);
    });
    const card = page.locator('[data-pipeline-card-id="qa-proposal-sem-resposta"]');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(card.locator('.pipeline-card-name')).toContainText('Anna Vieira');
      await expect(card.locator('.pipeline-card-name')).toHaveAttribute('title', 'Anna Vieira - Abercrombie & Kent Brazil');
      await expect(card.locator('.pipeline-card-event-line')).toContainText('17:00');
      await expect(card.locator('.pipeline-card-event-line')).toContainText('25 pax');
      await expect(card.locator('.pipeline-card-value')).toBeVisible();
      await expect(card.locator('.pipeline-card-next-action')).toBeVisible();
      await expect(card.locator('.pipeline-card-details')).not.toHaveAttribute('open', '');
      await expect(card.locator('.pipeline-score-badge')).toBeHidden();
      const collapsed = await card.evaluate((node) => node.getBoundingClientRect().height);
      console.info(`Card compacto ${width}px: ${Math.round(collapsed)}px de altura`);
      expect(collapsed, `altura compacta em ${width}px`).toBeLessThan(360);
      const alignment = await card.evaluate((node) => {
        const name = node.querySelector('.pipeline-card-name').getBoundingClientRect();
        const badge = node.querySelector('.follow-up-badge').getBoundingClientRect();
        const details = node.querySelector('.pipeline-card-details > summary').getBoundingClientRect();
        const actions = node.querySelector('.pipeline-card-bottom-row').getBoundingClientRect();
        return { nameHeight: name.height, badgeGap: badge.top - name.bottom, badgeLeft: badge.left - name.left,
          footerCenterGap: Math.abs((details.top + details.bottom - actions.top - actions.bottom) / 2),
          footerOverlap: details.right > actions.left };
      });
      expect(alignment.nameHeight).toBeLessThan(25);
      expect(alignment.badgeGap).toBeGreaterThanOrEqual(0);
      expect(alignment.badgeGap).toBeLessThan(9);
      expect(Math.abs(alignment.badgeLeft)).toBeLessThan(2);
      expect(alignment.footerCenterGap).toBeLessThan(3);
      expect(alignment.footerOverlap).toBe(false);
      await card.locator('.pipeline-card-details > summary').click();
      await expect(card.locator('.pipeline-stage-chip')).toBeVisible();
      await expect(card.locator('.pipeline-card-full-name')).toHaveText('Cliente: Anna Vieira - Abercrombie & Kent Brazil');
      await expect(card.locator('.pipeline-value-breakdown')).not.toContainText('Priv.');
      await expect(card.locator('.pipeline-card-final-client')).not.toContainText('Cliente final:');
      await expect(card.locator('.pipeline-card-final-client')).toContainText('Brazil Ultimate Carnival 2028');
      const expanded = await card.evaluate((node) => node.getBoundingClientRect().height);
      expect(expanded - collapsed).toBeGreaterThan(60);
      await card.locator('.pipeline-card-details > summary').click();
      await expectNoHorizontalOverflow(page);
    }
  });
});
