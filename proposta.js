const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";

const card = document.querySelector("#publicProposalCard");
const title = document.querySelector("#proposalPublicTitle");
const subtitle = document.querySelector("#proposalPublicSubtitle");
const token = new URLSearchParams(window.location.search).get("p") || "";
const supabaseClient = window.supabase?.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const PAYMENT_INFO = {
  bank: "Itaú (341)",
  agency: "8383",
  account: "07555-6",
  cnpj: "11.399.715/0001-85",
  pix: "11.399.715/0001-85",
  pixCopy: "11399715000185",
};
const DEFAULT_SIGNAL_DEADLINE_HOURS = 48;
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const PROOF_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

let currentProposal = null;
let proposalViewRecorded = false;
let selectedProof = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "A definir";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "A definir";
}

function formatDuration(value) {
  const number = Number(value || 0);
  if (!number) return "A definir";
  return number % 1 === 0 ? `${number}h` : `${String(number).replace(".", "h")}`;
}

function formatMultiline(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br />");
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function formatDeadlineHours(hours) {
  const value = Number(hours || DEFAULT_SIGNAL_DEADLINE_HOURS);
  if (value < 24) return `${value} horas`;
  const days = value / 24;
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function getSignalDeadlineCopy(proposal = currentProposal) {
  const event = proposal?.snapshot?.event || {};
  const deadlineAt = formatDateTime(event.signalDeadlineAt);
  if (deadlineAt) {
    return `Para manter esta condição e priorizar a reserva, envie o sinal até ${deadlineAt}.`;
  }
  return `Prazo padrão para o sinal: ${formatDeadlineHours(event.signalDeadlineHours)}.`;
}

function getSignalDeadlineLabel(proposal = currentProposal) {
  const event = proposal?.snapshot?.event || {};
  const deadlineAt = formatDateTime(event.signalDeadlineAt);
  return deadlineAt ? `Sinal até ${deadlineAt}` : `Sinal em até ${formatDeadlineHours(event.signalDeadlineHours)}`;
}

function getSignalAmount(proposal = currentProposal) {
  const total = Number(proposal?.total || proposal?.snapshot?.totals?.total || 0);
  return total > 0 ? total * 0.5 : 0;
}

function renderDeadlineCard(proposal = currentProposal) {
  return `
    <div class="public-deadline-card">
      <span>Prazo do sinal</span>
      <strong>${escapeHtml(getSignalDeadlineLabel(proposal))}</strong>
      <p>${escapeHtml(getSignalDeadlineCopy(proposal))}</p>
    </div>
  `;
}

function isAllowedProofFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return PROOF_ALLOWED_TYPES.has(file?.type) || PROOF_ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function readProofFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Arquivo não encontrado."));
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      reject(new Error("O comprovante pode ter no máximo 5 MB."));
      return;
    }
    if (!isAllowedProofFile(file)) {
      reject(new Error("Use PDF, JPG, PNG, WebP, HEIC ou HEIF."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        nome: file.name || "comprovante",
        tipo: file.type || "application/octet-stream",
        tamanho: file.size,
        dataUrl: reader.result,
        anexadoEm: new Date().toISOString(),
      });
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function renderProofUploader() {
  return `
    <section class="public-proof-uploader" aria-label="Anexar comprovante do sinal">
      <div class="public-proof-heading">
        <span>Comprovante</span>
        <strong>Anexe o comprovante do sinal</strong>
        <p>Opcional agora, mas agiliza a validação da equipe. Aceitamos PDF, JPG, PNG, WebP, HEIC ou HEIF até 5 MB.</p>
      </div>
      <label class="public-proof-dropzone" for="publicProofInput">
        <input id="publicProofInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*" />
        <span>Arraste o comprovante aqui, clique para escolher ou cole uma imagem copiada.</span>
      </label>
      <p class="public-proof-status" id="publicProofStatus">Nenhum comprovante anexado.</p>
    </section>
  `;
}

function renderProofSummary(proof) {
  if (!proof) return "";
  const name = proof.nome || "comprovante anexado";
  const href = proof.dataUrl || "";
  return `
    <div class="public-proof-summary">
      <span>Comprovante anexado</span>
      ${
        href
          ? `<a href="${escapeHtml(href)}" download="${escapeHtml(name)}">${escapeHtml(name)}</a>`
          : `<strong>${escapeHtml(name)}</strong>`
      }
    </div>
  `;
}

function updateProofStatus() {
  const status = document.querySelector("#publicProofStatus");
  if (!status) return;
  if (!selectedProof) {
    status.textContent = "Nenhum comprovante anexado.";
    status.dataset.status = "empty";
    return;
  }
  const size = formatFileSize(selectedProof.tamanho);
  status.innerHTML = `
    <span>Comprovante anexado: <strong>${escapeHtml(selectedProof.nome)}</strong>${size ? ` · ${escapeHtml(size)}` : ""}</span>
    <button type="button" data-remove-proof>Remover</button>
  `;
  status.dataset.status = "ok";
}

async function selectProofFile(file) {
  try {
    selectedProof = await readProofFile(file);
    updateProofStatus();
    setMessage("Comprovante anexado. Agora é só enviar a resposta para a equipe.", "success");
  } catch (error) {
    selectedProof = null;
    updateProofStatus();
    setMessage(error.message || "Não foi possível anexar o comprovante.", "error");
  }
}

function getStatusLabel(value) {
  const labels = {
    proposta_enviada: "Proposta enviada",
    negociacao: "Em negociação",
    confirmado: "Sinal recebido",
    pagamento_final: "Aguardando pagamento restante",
    planejamento: "Planejamento",
    evento_proximo: "Evento hoje ou amanhã",
    pos_venda: "Pós-venda",
    cancelado: "Cancelado",
  };
  return labels[value] || value || "Proposta";
}

function getActionLabel(value) {
  const labels = {
    confirmar: "Proposta aprovada pelo cliente",
    cancelar: "Cancelamento solicitado pelo cliente",
    alteracao: "Alteração solicitada pelo cliente",
  };
  return labels[value] || "";
}

function getDecisionCopy(proposal) {
  const status = proposal.status || "";
  if (status === "confirmado") {
    return {
      title: "Sinal recebido e reserva confirmada",
      note: "A proposta já avançou de etapa. Se precisar rever algum detalhe, a equipe pode seguir com você por e-mail ou WhatsApp.",
    };
  }
  if (status === "pagamento_final") {
    return {
      title: "Pagamento restante em andamento",
      note: "A equipe acompanha o saldo final e os próximos combinados do evento.",
    };
  }
  if (status === "planejamento" || status === "evento_proximo") {
    return {
      title: "Evento em preparação",
      note: "Os detalhes operacionais já estão sendo conduzidos pela equipe da Embaixada Carioca.",
    };
  }
  if (status === "cancelado") {
    return {
      title: "Pedido encerrado",
      note: "Se quiser retomar a conversa em outro momento, a equipe pode montar uma nova proposta com você.",
    };
  }
  return {
    title: "Pronto para reservar sua data?",
    note: "Aprovar a proposta sinaliza que você quer seguir. A equipe confirma disponibilidade final e orienta o pagamento do sinal de 50% para reservar data e horário.",
  };
}

function setMessage(message, type = "neutral") {
  const node = document.querySelector("#publicProposalStatus");
  if (!node) return;
  node.textContent = message;
  node.dataset.status = type;
}

function renderError(message) {
  card.innerHTML = `
    <div class="public-proposal-empty">
      <h2>Não conseguimos abrir esta proposta.</h2>
      <p>${escapeHtml(message)}</p>
      <a href="mailto:eventos@embaixadacarioca.com.br">Falar com a equipe de eventos</a>
    </div>
  `;
}

function renderPaymentInfo({ proof = null } = {}) {
  const signalAmount = getSignalAmount();
  return `
    <section class="public-payment-info" aria-label="Dados bancários para sinal de reserva">
      <div class="public-payment-heading">
        <span>Sinal de reserva</span>
        <h3>Dados para pagamento do sinal</h3>
        <p>A data e o horário ficam reservados após confirmação de disponibilidade pela equipe e pagamento do sinal de 50%.</p>
      </div>
      ${renderDeadlineCard()}
      <div class="public-payment-grid">
        ${signalAmount ? `<div class="public-payment-highlight"><span>Valor do sinal</span><strong>${formatMoney(signalAmount)}</strong></div>` : ""}
        <div><span>Banco</span><strong>${escapeHtml(PAYMENT_INFO.bank)}</strong></div>
        <div><span>Agência</span><strong>${escapeHtml(PAYMENT_INFO.agency)}</strong></div>
        <div><span>Conta corrente</span><strong>${escapeHtml(PAYMENT_INFO.account)}</strong></div>
        <div><span>CNPJ</span><strong>${escapeHtml(PAYMENT_INFO.cnpj)}</strong></div>
      </div>
      <div class="public-payment-pix">
        <div>
          <span>Chave Pix</span>
          <strong>${escapeHtml(PAYMENT_INFO.pix)}</strong>
          <small>O botão copia apenas os números, para funcionar melhor no app do banco.</small>
        </div>
        <button class="public-copy-pix" type="button" data-copy-pix>Copiar chave Pix</button>
      </div>
      ${renderProofSummary(proof)}
    </section>
  `;
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyPixKey(button) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(PAYMENT_INFO.pixCopy);
    } else if (!copyTextFallback(PAYMENT_INFO.pixCopy)) {
      throw new Error("Clipboard indisponível");
    }
    if (button) {
      const original = button.textContent;
      button.textContent = "Chave Pix copiada";
      window.setTimeout(() => {
        button.textContent = original || "Copiar chave Pix";
      }, 2200);
    }
    setMessage("Chave Pix copiada só com números. Agora é só colar no app do banco.", "success");
  } catch (error) {
    console.warn("Falha ao copiar chave Pix.", error);
    setMessage(`Não foi possível copiar automaticamente. Chave Pix sem pontuação: ${PAYMENT_INFO.pixCopy}`, "error");
  }
}

function renderProposal(proposal) {
  currentProposal = proposal;
  const snapshot = proposal.snapshot || {};
  const event = snapshot.event || {};
  const totals = snapshot.totals || {};
  const selectedItems = Array.isArray(snapshot.selectedItems) ? snapshot.selectedItems : [];
  const response = proposal.cliente_resposta || snapshot.clienteResposta?.acao || "";
  const responseMessage = proposal.cliente_mensagem || snapshot.clienteResposta?.mensagem || "";
  const responseProof = proposal.cliente_solicitacao?.comprovante || snapshot.clienteResposta?.comprovante || null;
  const decision = getDecisionCopy(proposal);
  const eventTitle = event.type || proposal.tipo_evento || "Proposta de evento";
  const guests = proposal.convidados || event.guests || 0;
  const dateLabel = formatDate(proposal.data_evento);
  const timeLabel = formatTime(proposal.horario_evento);
  const durationLabel = formatDuration(proposal.duracao || event.duration);

  title.textContent = eventTitle;
  subtitle.textContent = `${proposal.cliente_nome || "Cliente"} · ${dateLabel} · ${guests} convidados`;

  card.innerHTML = `
    <div class="public-proposal-topline">
      <span class="public-proposal-chip is-status">${escapeHtml(getStatusLabel(proposal.status))}</span>
      <span class="public-proposal-chip">${escapeHtml(eventTitle)}</span>
      <span class="public-proposal-chip">${escapeHtml(String(guests))} convidados</span>
      <span class="public-proposal-chip public-proposal-chip-deadline">${escapeHtml(getSignalDeadlineLabel(proposal))}</span>
    </div>

    <div class="public-proposal-stage">
      <div class="public-proposal-stage-copy">
        <span>Experiência sugerida</span>
        <h2>${escapeHtml(eventTitle)}</h2>
        <p>Uma experiência no Morro da Urca para receber ${escapeHtml(String(guests))} convidados com vista, serviço e gastronomia carioca. Duração prevista: ${escapeHtml(durationLabel)}.</p>
      </div>
      <div class="public-proposal-decision-card">
        <span>Próximo passo</span>
        <strong>${escapeHtml(decision.title)}</strong>
        <p>${escapeHtml(decision.note)}</p>
        ${renderDeadlineCard(proposal)}
      </div>
    </div>

    <div class="public-proposal-next-steps" aria-label="Próximos passos da reserva">
      <article>
        <span>01</span>
        <strong>Aprovação</strong>
        <p>Você confirma que a proposta faz sentido para o seu evento.</p>
      </article>
      <article>
        <span>02</span>
        <strong>Sinal de 50%</strong>
        <p>Ao aprovar, os dados bancários e a chave Pix aparecem para facilitar o sinal.</p>
      </article>
      <article>
        <span>03</span>
        <strong>Data reservada</strong>
        <p>Após o sinal, seguimos com os combinados finais do evento.</p>
      </article>
    </div>

    <div class="public-proposal-summary">
      <div>
        <span>Cliente</span>
        <strong>${escapeHtml(proposal.cliente_nome || "Cliente")}</strong>
      </div>
      <div>
        <span>Data e horário</span>
        <strong>${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</strong>
      </div>
      <div>
        <span>Convidados</span>
        <strong>${escapeHtml(String(guests))}</strong>
      </div>
      <div>
        <span>Total estimado</span>
        <strong>${formatMoney(proposal.total || totals.total)}</strong>
      </div>
    </div>

    ${
      response
        ? `<div class="public-proposal-response"><strong>${escapeHtml(getActionLabel(response))}</strong>${responseMessage ? `<span>${escapeHtml(responseMessage)}</span>` : ""}</div>`
        : ""
    }
    ${response === "confirmar" ? renderPaymentInfo({ proof: responseProof }) : ""}

    <div class="public-proposal-actions">
      <div class="public-proposal-actions-copy">
        <h3>Escolha seu próximo passo</h3>
        <p>Para avançar, aprove a proposta. Se algum detalhe ainda não estiver perfeito, peça ajuste de data, horário, convidados ou observações.</p>
      </div>
      <div class="public-proposal-buttons">
        <button class="primary public-proposal-main-cta" type="button" data-public-action="confirmar">Aprovar e seguir para reserva</button>
        <button class="secondary" type="button" data-public-action="alteracao">Pedir ajuste</button>
        <button class="secondary danger-light" type="button" data-public-action="cancelar">Encerrar pedido</button>
      </div>

      <form class="public-proposal-change-form" id="publicProposalResponseForm" hidden>
        <input type="hidden" id="publicProposalAction" />
        <div class="public-proposal-form-grid">
          <label>
            Nova data
            <input id="publicRequestedDate" type="date" />
          </label>
          <label>
            Novo horário
            <input id="publicRequestedTime" type="time" step="900" />
          </label>
          <label>
            Convidados
            <input id="publicRequestedGuests" type="number" min="1" max="500" placeholder="${escapeHtml(String(guests || ""))}" />
          </label>
        </div>
        <label>
          Mensagem para a equipe
          <textarea id="publicResponseMessage" rows="4" placeholder="Conte o que precisa ajustar ou o motivo do cancelamento."></textarea>
        </label>
        <div id="publicPaymentInfoSlot" hidden>
          ${renderPaymentInfo()}
          ${renderProofUploader()}
        </div>
        <div class="public-proposal-form-actions">
          <button class="primary" id="publicSubmitResponse" type="submit">Enviar resposta</button>
          <button class="secondary" type="button" id="publicCancelResponse">Voltar</button>
        </div>
      </form>
      <p id="publicProposalStatus" class="public-proposal-status" role="status" aria-live="polite">Status atual: ${escapeHtml(getStatusLabel(proposal.status))}.</p>
    </div>

    <div class="public-proposal-layout">
      <div class="public-proposal-items">
        <h3>Itens incluídos</h3>
        ${
          selectedItems.length
            ? selectedItems
                .map(
                  (item) => `
                    <article>
                      <div>
                        <strong>${escapeHtml(item.nome)}</strong>
                        <p>${escapeHtml(item.descricao || "")}</p>
                        <small>${escapeHtml(item.calc?.detail || "")}</small>
                      </div>
                      <b>${formatMoney(item.calc?.total || 0)}</b>
                    </article>
                  `,
                )
                .join("")
            : "<p>Itens a confirmar com a equipe de eventos.</p>"
        }
      </div>

      <aside class="public-proposal-side-stack">
        <div class="public-proposal-totals">
          <div><span>Subtotal</span><strong>${formatMoney(proposal.subtotal || totals.subtotal)}</strong></div>
          <div><span>Taxa de serviço</span><strong>${formatMoney(proposal.taxa_servico || totals.serviceFee)}</strong></div>
          <div><span>Privatização</span><strong>${formatMoney(proposal.privatizacao || totals.privatizationAmount)}</strong></div>
          <div><span>Total estimado</span><strong>${formatMoney(proposal.total || totals.total)}</strong></div>
        </div>

        <div class="public-proposal-contact-card">
          <span>Contato da equipe</span>
          <strong>Eventos Embaixada Carioca</strong>
          <p>Se preferir falar antes de responder, escreva para eventos@embaixadacarioca.com.br ou chame no +55 21 97142-6007.</p>
        </div>

        ${
          snapshot.generalTerms
            ? `<details class="public-proposal-terms"><summary>Condições comerciais</summary><p>${formatMultiline(snapshot.generalTerms)}</p></details>`
            : ""
        }
      </aside>
    </div>
  `;
}

function openResponseForm(action) {
  const form = document.querySelector("#publicProposalResponseForm");
  const actionInput = document.querySelector("#publicProposalAction");
  const message = document.querySelector("#publicResponseMessage");
  const paymentSlot = document.querySelector("#publicPaymentInfoSlot");
  const submitButton = document.querySelector("#publicSubmitResponse");
  if (!form || !actionInput || !message) return;
  actionInput.value = action;
  form.hidden = false;
  if (paymentSlot) paymentSlot.hidden = action !== "confirmar";
  if (action !== "confirmar") {
    selectedProof = null;
    updateProofStatus();
  }
  if (action === "confirmar") {
    message.placeholder = "Se quiser, deixe uma observação para a equipe antes de seguir com o sinal.";
    if (submitButton) submitButton.textContent = "Enviar aprovação à equipe";
    updateProofStatus();
    setMessage("Confira os dados bancários nesta página, copie o Pix se preferir e anexe o comprovante quando tiver. A reserva é confirmada após validação da equipe e pagamento do sinal.", "neutral");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (action === "cancelar") {
    message.placeholder = "Conte brevemente o motivo do cancelamento.";
    if (submitButton) submitButton.textContent = "Enviar cancelamento";
    setMessage("Informe o motivo do cancelamento para a equipe encerrar corretamente.", "neutral");
  } else {
    message.placeholder = "Conte qual data, horário, número de convidados ou detalhe precisa mudar.";
    if (submitButton) submitButton.textContent = "Enviar pedido de ajuste";
    setMessage("Informe os ajustes desejados nos campos da resposta ou escreva no campo aberto.", "neutral");
  }
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function submitPublicResponse(event) {
  event.preventDefault();
  const action = document.querySelector("#publicProposalAction")?.value || "";
  const requestedDate = document.querySelector("#publicRequestedDate")?.value || null;
  const requestedTime = document.querySelector("#publicRequestedTime")?.value || null;
  const requestedGuestsRaw = document.querySelector("#publicRequestedGuests")?.value || "";
  const requestedGuests = requestedGuestsRaw ? Number(requestedGuestsRaw) : null;
  const message = document.querySelector("#publicResponseMessage")?.value.trim() || "";
  const needsMessage = action === "cancelar" || action === "alteracao";

  if (needsMessage && message.length < 3) {
    setMessage("Escreva uma mensagem curta para a equipe entender sua solicitação.", "error");
    return;
  }

  setMessage("Enviando resposta...", "neutral");
  const payload = {
    proposal_token: token,
    action,
    requested_date: requestedDate,
    requested_time: requestedTime,
    requested_guests: requestedGuests,
    message,
    payment_proof: action === "confirmar" ? selectedProof : null,
  };
  let { data, error } = await supabaseClient.rpc("respond_public_proposal", payload);

  if (error && payload.payment_proof) {
    console.warn("Falha ao responder proposta com comprovante. Tentando registrar sem anexo.", error);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.payment_proof;
    ({ data, error } = await supabaseClient.rpc("respond_public_proposal", fallbackPayload));
    if (!error && data?.[0]?.ok) {
      setMessage("Aprovação registrada, mas o anexo ainda precisa da atualização do schema no Supabase. Envie o comprovante por e-mail ou WhatsApp para a equipe.", "error");
      await loadProposal();
      return;
    }
  }

  if (error || !data?.[0]?.ok) {
    console.warn("Falha ao responder proposta.", error);
    setMessage("Não foi possível registrar sua resposta. Tente novamente ou fale com a equipe.", "error");
    return;
  }

  if (action === "confirmar") {
    setMessage(
      selectedProof
        ? "Aprovação e comprovante registrados. A equipe vai validar o sinal e confirmar a reserva."
        : "Aprovação registrada. Use os dados de pagamento do sinal e envie o comprovante para a equipe de eventos.",
      "success",
    );
    await loadProposal();
    return;
  }

  setMessage(
    action === "confirmar"
      ? "Aprovação registrada. Use os dados de pagamento do sinal e envie o comprovante para a equipe de eventos."
      : "Resposta registrada. Nossa equipe recebeu sua atualização.",
    "success",
  );
  await loadProposal();
}

async function loadProposal() {
  if (!token) {
    renderError("O link está sem código de proposta.");
    return;
  }

  if (!supabaseClient) {
    renderError("Não foi possível carregar a conexão. Tente novamente.");
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_public_proposal", { proposal_token: token });
  if (error || !data?.length) {
    console.warn("Falha ao carregar proposta pública.", error);
    renderError("O link pode ter expirado ou ainda falta ativar a consulta pública no Supabase.");
    return;
  }
  renderProposal(data[0]);
  recordProposalView();
}

async function recordProposalView() {
  if (proposalViewRecorded || !token || !supabaseClient) return;
  proposalViewRecorded = true;
  try {
    await supabaseClient.rpc("record_public_proposal_view", {
      proposal_token: token,
      user_agent: navigator.userAgent || "",
      referrer: document.referrer || "",
    });
  } catch (error) {
    console.warn("Falha ao registrar visualizacao da proposta.", error);
  }
}

card.addEventListener("click", (event) => {
  const copyPixButton = event.target.closest("[data-copy-pix]");
  if (copyPixButton) {
    copyPixKey(copyPixButton);
    return;
  }
  if (event.target.closest("[data-remove-proof]")) {
    selectedProof = null;
    const input = document.querySelector("#publicProofInput");
    if (input) input.value = "";
    updateProofStatus();
    setMessage("Comprovante removido. Você pode anexar outro arquivo antes de enviar.", "neutral");
    return;
  }
  const actionButton = event.target.closest("[data-public-action]");
  if (actionButton) openResponseForm(actionButton.dataset.publicAction);
  if (event.target.closest("#publicCancelResponse")) {
    const form = document.querySelector("#publicProposalResponseForm");
    if (form) form.hidden = true;
    setMessage(`Status atual: ${getStatusLabel(currentProposal?.status)}.`, "neutral");
  }
});

card.addEventListener("change", (event) => {
  if (event.target.matches("#publicProofInput")) {
    selectProofFile(event.target.files?.[0]);
  }
});

card.addEventListener("dragover", (event) => {
  const dropzone = event.target.closest(".public-proof-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.add("is-dragover");
});

card.addEventListener("dragleave", (event) => {
  const dropzone = event.target.closest(".public-proof-dropzone");
  if (dropzone) dropzone.classList.remove("is-dragover");
});

card.addEventListener("drop", (event) => {
  const dropzone = event.target.closest(".public-proof-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.remove("is-dragover");
  selectProofFile(event.dataTransfer?.files?.[0]);
});

card.addEventListener("paste", (event) => {
  const form = document.querySelector("#publicProposalResponseForm");
  const action = document.querySelector("#publicProposalAction")?.value || "";
  if (!form || form.hidden || action !== "confirmar") return;
  const file = Array.from(event.clipboardData?.files || [])[0];
  if (file) selectProofFile(file);
});

card.addEventListener("submit", submitPublicResponse);
loadProposal();
