const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";

const card = document.querySelector("#publicProposalCard");
const title = document.querySelector("#proposalPublicTitle");
const subtitle = document.querySelector("#proposalPublicSubtitle");
const token = new URLSearchParams(window.location.search).get("p") || "";
const supabaseClient = window.supabase?.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

let currentProposal = null;

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
    confirmar: "Proposta confirmada pelo cliente",
    cancelar: "Cancelamento solicitado pelo cliente",
    alteracao: "Alteração solicitada pelo cliente",
  };
  return labels[value] || "";
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

function renderProposal(proposal) {
  currentProposal = proposal;
  const snapshot = proposal.snapshot || {};
  const event = snapshot.event || {};
  const totals = snapshot.totals || {};
  const selectedItems = Array.isArray(snapshot.selectedItems) ? snapshot.selectedItems : [];
  const response = proposal.cliente_resposta || snapshot.clienteResposta?.acao || "";
  const responseMessage = proposal.cliente_mensagem || snapshot.clienteResposta?.mensagem || "";

  title.textContent = event.type || proposal.tipo_evento || "Proposta de evento";
  subtitle.textContent = `${proposal.cliente_nome || "Cliente"} · ${formatDate(proposal.data_evento)} · ${proposal.convidados || event.guests || 0} convidados`;

  card.innerHTML = `
    <div class="public-proposal-summary">
      <div>
        <span>Cliente</span>
        <strong>${escapeHtml(proposal.cliente_nome || "Cliente")}</strong>
      </div>
      <div>
        <span>Data e horário</span>
        <strong>${escapeHtml(formatDate(proposal.data_evento))} · ${escapeHtml(formatTime(proposal.horario_evento))}</strong>
      </div>
      <div>
        <span>Convidados</span>
        <strong>${escapeHtml(String(proposal.convidados || event.guests || 0))}</strong>
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

    <div class="public-proposal-section">
      <span>Resumo</span>
      <h2>${escapeHtml(event.type || proposal.tipo_evento || "Evento")}</h2>
      <p>Experiência para ${escapeHtml(String(proposal.convidados || event.guests || 0))} convidados, com duração de ${escapeHtml(formatDuration(proposal.duracao || event.duration))}, no Morro da Urca.</p>
    </div>

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

    <div class="public-proposal-totals">
      <div><span>Subtotal</span><strong>${formatMoney(proposal.subtotal || totals.subtotal)}</strong></div>
      <div><span>Taxa de serviço</span><strong>${formatMoney(proposal.taxa_servico || totals.serviceFee)}</strong></div>
      <div><span>Privatização</span><strong>${formatMoney(proposal.privatizacao || totals.privatizationAmount)}</strong></div>
      <div><span>Total estimado</span><strong>${formatMoney(proposal.total || totals.total)}</strong></div>
    </div>

    ${
      snapshot.generalTerms
        ? `<details class="public-proposal-terms"><summary>Condições comerciais</summary><p>${formatMultiline(snapshot.generalTerms)}</p></details>`
        : ""
    }

    <div class="public-proposal-actions">
      <h3>Como deseja seguir?</h3>
      <p>Você pode confirmar a proposta, solicitar um ajuste ou cancelar este pedido. A equipe de eventos recebe sua resposta automaticamente.</p>
      <div class="public-proposal-buttons">
        <button class="primary" type="button" data-public-action="confirmar">Confirmar proposta</button>
        <button class="secondary" type="button" data-public-action="alteracao">Solicitar alteração</button>
        <button class="secondary danger-light" type="button" data-public-action="cancelar">Cancelar</button>
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
            <input id="publicRequestedGuests" type="number" min="1" max="500" placeholder="${escapeHtml(String(proposal.convidados || event.guests || ""))}" />
          </label>
        </div>
        <label>
          Mensagem para a equipe
          <textarea id="publicResponseMessage" rows="4" placeholder="Conte o que precisa ajustar ou o motivo do cancelamento."></textarea>
        </label>
        <div class="public-proposal-form-actions">
          <button class="primary" type="submit">Enviar resposta</button>
          <button class="secondary" type="button" id="publicCancelResponse">Voltar</button>
        </div>
      </form>
      <p id="publicProposalStatus" class="public-proposal-status" role="status" aria-live="polite">Status atual: ${escapeHtml(getStatusLabel(proposal.status))}.</p>
    </div>
  `;
}

function openResponseForm(action) {
  const form = document.querySelector("#publicProposalResponseForm");
  const actionInput = document.querySelector("#publicProposalAction");
  const message = document.querySelector("#publicResponseMessage");
  if (!form || !actionInput || !message) return;
  actionInput.value = action;
  form.hidden = false;
  if (action === "confirmar") {
    message.placeholder = "Se quiser, deixe uma observação para a equipe.";
    setMessage("Confirme abaixo para avisar a equipe que deseja seguir com a proposta.", "neutral");
  } else if (action === "cancelar") {
    message.placeholder = "Conte brevemente o motivo do cancelamento.";
    setMessage("Informe o motivo do cancelamento para a equipe encerrar corretamente.", "neutral");
  } else {
    message.placeholder = "Conte qual data, horário, número de convidados ou detalhe precisa mudar.";
    setMessage("Informe os ajustes desejados. Use os campos acima ou escreva no campo aberto.", "neutral");
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
  const { data, error } = await supabaseClient.rpc("respond_public_proposal", {
    proposal_token: token,
    action,
    requested_date: requestedDate,
    requested_time: requestedTime,
    requested_guests: requestedGuests,
    message,
  });

  if (error || !data?.[0]?.ok) {
    console.warn("Falha ao responder proposta.", error);
    setMessage("Não foi possível registrar sua resposta. Tente novamente ou fale com a equipe.", "error");
    return;
  }

  setMessage("Resposta registrada. Nossa equipe recebeu sua atualização.", "success");
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
    console.warn("Falha ao carregar proposta publica.", error);
    renderError("O link pode ter expirado ou ainda falta ativar a consulta pública no Supabase.");
    return;
  }
  renderProposal(data[0]);
}

card.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-public-action]");
  if (actionButton) openResponseForm(actionButton.dataset.publicAction);
  if (event.target.closest("#publicCancelResponse")) {
    const form = document.querySelector("#publicProposalResponseForm");
    if (form) form.hidden = true;
    setMessage(`Status atual: ${getStatusLabel(currentProposal?.status)}.`, "neutral");
  }
});

card.addEventListener("submit", submitPublicResponse);
loadProposal();
