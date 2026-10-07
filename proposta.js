const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";

const card = document.querySelector("#publicProposalCard");
const title = document.querySelector("#proposalPublicTitle");
const subtitle = document.querySelector("#proposalPublicSubtitle");
const token = new URLSearchParams(window.location.search).get("p") || "";
const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
let language = requestedLanguage === "en" || (!requestedLanguage && localStorage.getItem("embaixada_form_language_v1") === "en") ? "en" : "pt";
const supabaseClient = window.supabase?.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
const tr = (pt, en) => language === "en" ? en : pt;

function syncLanguage() {
  document.documentElement.lang = language === "en" ? "en" : "pt-BR";
  document.title = tr("Proposta de Evento | Embaixada Carioca", "Event Proposal | Embaixada Carioca");
  document.querySelectorAll("[data-proposal-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.proposalLang === language));
  });
  document.querySelector(".public-proposal-hero-copy > p").textContent = tr("Proposta comercial", "Event proposal");
  if (currentProposal) renderProposal(currentProposal);
}

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
let pendingUpsellOffer = null;

function getProposalAnalyticsProperties(proposal = currentProposal) {
  const analytics = window.EventAnalytics;
  const snapshot = proposal?.snapshot || {};
  const event = snapshot.event || {};
  const totals = snapshot.totals || {};
  const options = Array.isArray(snapshot.publicOfferOptions) ? snapshot.publicOfferOptions : [];
  return {
    surface: "public_proposal",
    language,
    status: proposal?.status || "unknown",
    event_type: event.type || proposal?.tipo_evento || "unknown",
    guests_bucket: analytics?.bucketGuests(proposal?.convidados || event.guests),
    duration_bucket: analytics?.bucketDuration(proposal?.duracao || event.duration),
    days_to_event_bucket: analytics?.bucketDaysToEvent(proposal?.data_evento || event.date),
    value_bucket: analytics?.bucketCurrency(proposal?.total || totals.total),
    proposal_version: Number(proposal?.versao || 1),
    has_upsell_options: options.some((option) => !option.base),
  };
}

function captureProposalAnalytics(eventName, properties = {}, options = {}) {
  const entityId = options.entityId || currentProposal?.oportunidade_id || currentProposal?.id;
  return window.EventAnalytics?.capture(
    eventName,
    { ...getProposalAnalyticsProperties(), ...properties },
    { ...options, entityId },
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return tr("A definir", "To be confirmed");
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return language === "en" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : tr("A definir", "To be confirmed");
}

function formatDuration(value) {
  const number = Number(value || 0);
  if (!number) return tr("A definir", "To be confirmed");
  return number % 1 === 0 ? `${number}h` : `${String(number).replace(".", "h")}`;
}

function formatMultiline(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br />");
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "pt-BR", {
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
  if (value < 24) return `${value} ${tr("horas", "hours")}`;
  const days = value / 24;
  return `${days} ${days === 1 ? tr("dia", "day") : tr("dias", "days")}`;
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
    return tr(`Para manter esta condição e priorizar a reserva, envie o sinal até ${deadlineAt}.`, `To keep these terms and prioritize the booking, send the deposit by ${deadlineAt}.`);
  }
  return tr(`Prazo padrão para o sinal: ${formatDeadlineHours(event.signalDeadlineHours)}.`, `Deposit due within ${formatDeadlineHours(event.signalDeadlineHours)} after the proposal is sent.`);
}

function getSignalDeadlineLabel(proposal = currentProposal) {
  const event = proposal?.snapshot?.event || {};
  const deadlineAt = formatDateTime(event.signalDeadlineAt);
  return deadlineAt ? tr(`Sinal até ${deadlineAt}`, `Deposit by ${deadlineAt}`) : tr(`Sinal em até ${formatDeadlineHours(event.signalDeadlineHours)}`, `Deposit within ${formatDeadlineHours(event.signalDeadlineHours)}`);
}

function getSignalAmount(proposal = currentProposal) {
  const total = Number(proposal?.total || proposal?.snapshot?.totals?.total || 0);
  return total > 0 ? total * 0.5 : 0;
}

function renderDeadlineCard(proposal = currentProposal) {
  return `
    <div class="public-deadline-card">
      <span>${tr("Prazo do sinal", "Deposit deadline")}</span>
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
      reject(new Error(tr("Arquivo não encontrado.", "File not found.")));
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      reject(new Error(tr("O comprovante pode ter no máximo 5 MB.", "The receipt must be no larger than 5 MB.")));
      return;
    }
    if (!isAllowedProofFile(file)) {
      reject(new Error(tr("Use PDF, JPG, PNG, WebP, HEIC ou HEIF.", "Use PDF, JPG, PNG, WebP, HEIC or HEIF.")));
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
    reader.onerror = () => reject(new Error(tr("Não foi possível ler o arquivo.", "We could not read the file.")));
    reader.readAsDataURL(file);
  });
}

function renderProofUploader() {
  return `
    <section class="public-proof-uploader" aria-label="${tr("Anexar comprovante do sinal", "Upload deposit receipt")}">
      <div class="public-proof-heading">
        <span>${tr("Comprovante", "Receipt")}</span>
        <strong>${tr("Anexe o comprovante do sinal", "Upload your deposit receipt")}</strong>
        <p>${tr("Opcional agora, mas agiliza a validação da equipe. Aceitamos PDF, JPG, PNG, WebP, HEIC ou HEIF até 5 MB.", "You may send this later. PDF, JPG, PNG, WebP, HEIC or HEIF, up to 5 MB.")}</p>
      </div>
      <label class="public-proof-dropzone" for="publicProofInput">
        <input id="publicProofInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*" />
        <span>${tr("Clique para escolher o comprovante ou cole uma imagem copiada.", "Choose a receipt or paste an image.")}</span>
      </label>
      <p class="public-proof-status" id="publicProofStatus">${tr("Nenhum comprovante anexado.", "No receipt selected.")}</p>
    </section>
  `;
}

function renderProofSummary(proof) {
  if (!proof) return "";
  const name = proof.nome || "comprovante anexado";
  const href = proof.dataUrl || "";
  return `
    <div class="public-proof-summary">
      <span>${tr("Comprovante anexado", "Receipt received")}</span>
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
    status.textContent = tr("Nenhum comprovante anexado.", "No receipt selected.");
    status.dataset.status = "empty";
    return;
  }
  const size = formatFileSize(selectedProof.tamanho);
  status.innerHTML = `
    <span>${tr("Comprovante anexado", "Receipt selected")}: <strong>${escapeHtml(selectedProof.nome)}</strong>${size ? ` · ${escapeHtml(size)}` : ""}</span>
    <button type="button" data-remove-proof>${tr("Remover", "Remove")}</button>
  `;
  status.dataset.status = "ok";
}

async function selectProofFile(file) {
  try {
    selectedProof = await readProofFile(file);
    updateProofStatus();
    setMessage(tr("Comprovante selecionado. Envie para a equipe quando estiver pronto.", "Receipt selected. Send it to our team when ready."), "success");
  } catch (error) {
    selectedProof = null;
    updateProofStatus();
    setMessage(error.message || tr("Não foi possível anexar o comprovante.", "We could not attach the receipt."), "error");
  }
}

function getStatusLabel(value) {
  const labels = {
    proposta_pronta: "Proposta disponível",
    proposta_enviada: "Proposta enviada",
    negociacao: "Em negociação",
    confirmado: "Sinal recebido",
    pagamento_final: "Aguardando pagamento restante",
    planejamento: "Planejamento",
    evento_proximo: "Evento hoje ou amanhã",
    pos_venda: "Pós-venda",
    cancelado: "Cancelado",
  };
  const english = {
    proposta_pronta: "Proposal available", proposta_enviada: "Proposal sent", negociacao: "In discussion",
    confirmado: "Deposit confirmed", pagamento_final: "Final payment pending", planejamento: "Planning",
    evento_proximo: "Event approaching", pos_venda: "After the event", cancelado: "Closed",
  };
  return (language === "en" ? english : labels)[value] || value || tr("Proposta", "Proposal");
}

function getActionLabel(value) {
  const labels = {
    confirmar: "Proposta aprovada pelo cliente",
    cancelar: "Cancelamento solicitado pelo cliente",
    alteracao: "Alteração solicitada pelo cliente",
  };
  const english = { confirmar: "Proposal approved", cancelar: "Cancellation requested", alteracao: "Changes requested" };
  return (language === "en" ? english : labels)[value] || "";
}

function getDecisionCopy(proposal, response) {
  const status = proposal.status || "";
  if (status === "confirmado") {
    return {
      title: tr("Sinal recebido e reserva confirmada", "Deposit confirmed and date reserved"),
      note: tr("A equipe seguirá com os detalhes do evento.", "Our team will follow up on the event details."),
    };
  }
  if (status === "pagamento_final") {
    return {
      title: tr("Pagamento restante em andamento", "Final payment in progress"),
      note: tr("A equipe acompanha o saldo final e os próximos combinados do evento.", "Our team is coordinating the remaining balance and event details."),
    };
  }
  if (status === "planejamento" || status === "evento_proximo") {
    return {
      title: tr("Evento em preparação", "Your event is being prepared"),
      note: tr("Os detalhes operacionais já estão sendo conduzidos pela equipe da Embaixada Carioca.", "Our team is coordinating the event details."),
    };
  }
  if (status === "cancelado") {
    return {
      title: tr("Pedido encerrado", "Request closed"),
      note: tr("Se quiser retomar a conversa em outro momento, a equipe pode montar uma nova proposta com você.", "If you wish to resume later, our team can prepare a new proposal."),
    };
  }
  if (response === "confirmar") {
    const hasProof = Boolean(proposal.cliente_solicitacao?.comprovante || proposal.snapshot?.clienteResposta?.comprovante);
    return {
      title: tr("Aprovação recebida", "Approval received"),
      note: hasProof
        ? tr("Comprovante recebido. A equipe valida o pagamento antes de confirmar a reserva.", "Proof received. Our team will verify the payment before confirming the booking.")
        : tr("Envie o comprovante quando pagar o sinal. A equipe validará o pagamento e confirmará a reserva.", "Send the receipt after paying the deposit. Our team will verify it and confirm the booking."),
    };
  }
  if (response === "alteracao") return {
    title: tr("Ajuste solicitado", "Changes requested"),
    note: tr("A equipe recebeu seu pedido e retornará com uma proposta atualizada.", "Our team received your request and will follow up with an updated proposal."),
  };
  if (status === "proposta_pronta") return {
    title: tr("Proposta em preparação para envio", "Proposal being prepared for delivery"),
    note: tr("A equipe enviará o link para sua revisão.", "Our team will send the link for your review."),
  };
  return {
    title: tr("Pronto para reservar sua data?", "Ready to reserve your date?"),
    note: tr("Confira valores e condições antes de aprovar. A equipe valida a disponibilidade; o sinal confirma a reserva.", "Review the price and terms before approving. Our team checks availability; the deposit secures the booking."),
  };
}

function setMessage(message, type = "neutral") {
  const node = document.querySelector("#publicProposalStatus");
  if (!node) return;
  node.textContent = message;
  node.dataset.status = type;
}

function getPublicResponseErrorMessage(error) {
  const raw = String(error?.message || error?.details || "").trim();
  if (/link expirado|nao encontrada|não encontrada/i.test(raw)) return tr("Este link expirou ou não está mais disponível. Fale com a equipe para receber uma proposta atualizada.", "This link has expired. Please ask our team for an updated proposal.");
  if (/nao aceita|não aceita|status|já enviado/i.test(raw)) return tr("Esta proposta não aceita mais respostas pelo link. Fale com a equipe.", "This proposal no longer accepts responses. Please contact our team.");
  if (/comprovante|payload|too large|limite|tipo|formato/i.test(raw)) return tr("Não foi possível registrar o comprovante. Revise o arquivo ou envie por e-mail/WhatsApp.", "We could not save the receipt. Check the file or send it by email or WhatsApp.");
  return tr("Não conseguimos registrar sua resposta agora. Tente novamente ou fale com a equipe.", "We could not save your response. Try again or contact our team.");
}

function renderError(message) {
  card.innerHTML = `
    <div class="public-proposal-empty">
      <h2>${tr("Não conseguimos abrir esta proposta.", "We could not open this proposal.")}</h2>
      <p>${escapeHtml(message)}</p>
      <a href="mailto:eventos@embaixadacarioca.com.br">${tr("Falar com a equipe de eventos", "Contact our events team")}</a>
    </div>
  `;
}

function renderPaymentInfo({ proof = null } = {}) {
  const signalAmount = getSignalAmount();
  return `
    <section class="public-payment-info" aria-label="${tr("Dados bancários para sinal de reserva", "Bank details for deposit")}">
      <div class="public-payment-heading">
        <span>${tr("Sinal de reserva", "Booking deposit")}</span>
        <h3>${tr("Dados para pagamento do sinal", "Deposit payment details")}</h3>
        <p>${tr("A reserva fica confirmada após validação da equipe e pagamento do sinal.", "The booking is confirmed after our team verifies the deposit.")}</p>
      </div>
      ${renderDeadlineCard()}
      <div class="public-payment-grid">
        ${signalAmount ? `<div class="public-payment-highlight"><span>${tr("Valor do sinal", "Deposit amount")}</span><strong>${formatMoney(signalAmount)}</strong></div>` : ""}
        <div><span>${tr("Banco", "Bank")}</span><strong>${escapeHtml(PAYMENT_INFO.bank)}</strong></div>
        <div><span>${tr("Agência", "Branch")}</span><strong>${escapeHtml(PAYMENT_INFO.agency)}</strong></div>
        <div><span>${tr("Conta corrente", "Account")}</span><strong>${escapeHtml(PAYMENT_INFO.account)}</strong></div>
        <div><span>CNPJ</span><strong>${escapeHtml(PAYMENT_INFO.cnpj)}</strong></div>
      </div>
      <div class="public-payment-pix">
        <div>
          <span>${tr("Chave Pix", "Pix key")}</span>
          <strong>${escapeHtml(PAYMENT_INFO.pix)}</strong>
          <small>${tr("O botão copia apenas os números, para funcionar melhor no app do banco.", "The button copies only the digits for your banking app.")}</small>
        </div>
        <button class="public-copy-pix" type="button" data-copy-pix>${tr("Copiar chave Pix", "Copy Pix key")}</button>
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

function renderCommercialSummary(snapshot) {
  const event = snapshot.event || {};
  const payment = Array.isArray(snapshot.paymentTerms) ? snapshot.paymentTerms : [];
  const defaultPayment = payment.length === 2 && /^50%/.test(payment[0]) && /^50%/.test(payment[1]);
  const terms = String(snapshot.generalTerms || "");
  const ticketExclusion = /INGRESSOS TELEFÉRICO[^\n]*não incluem/i.test(terms);
  const standardCancellation = /Mais de 5 dias úteis[^\n]*25%/.test(terms)
    && /Entre 5 dias úteis e 48 horas[^\n]*50%/.test(terms)
    && /Menos de 48 horas[^\n]*100%/.test(terms);
  return `<section class="public-commercial-summary" aria-label="${tr("Condições essenciais", "Key terms")}">
    <h3>${tr("Antes de decidir", "Before you decide")}</h3>
    <ul>
      <li>${tr("O total abaixo inclui a taxa de serviço indicada no detalhamento.", "The total below includes the service charge shown in the breakdown.")}</li>
      ${event.validity ? `<li>${tr("Validade comercial", "Proposal validity")}: <strong>${escapeHtml(event.validity)}</strong> ${tr("a partir do envio.", "from delivery.")}</li>` : ""}
      ${defaultPayment ? `<li>${tr("Sinal de 50% para reservar; saldo de 50% até 72 horas antes do evento.", "50% deposit to book; remaining 50% due 72 hours before the event.")}</li>` : payment.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}
      ${ticketExclusion ? `<li>${tr("Ingressos do teleférico não incluídos; compra separada.", "Cable car tickets are not included and must be purchased separately.")}</li>` : ""}
      ${standardCancellation ? `<li>${tr("Cancelamento: 25% com mais de 5 dias úteis; 50% até 48h; 100% com menos de 48h do evento.", "Cancellation: 25% more than 5 business days before; 50% between 5 business days and 48 hours; 100% within 48 hours of the event.")}</li>` : ""}
      ${terms ? `<li>${tr("Leia as regras de alteração e cancelamento em Condições comerciais abaixo.", "Read the change and cancellation terms in Commercial terms below.")}</li>` : ""}
    </ul>
    ${language === "en" && terms ? `<p>${tr("", "The detailed commercial terms provided by the team below remain in their original language. Ask us for an English copy before approving if needed.")}</p>` : ""}
  </section>`;
}

function renderVersionChanges(snapshot) {
  const changes = Array.isArray(snapshot.versionChanges) ? snapshot.versionChanges : [];
  if (!changes.length) return "";
  return `<section class="public-version-changes" aria-label="${tr("Mudanças desta versão", "Changes in this version")}">
    <span>${tr("Nova versão", "New version")}</span>
    <h3>${tr("O que mudou nesta proposta", "What changed in this proposal")}</h3>
    <ul>${changes.map((change) => `<li><strong>${escapeHtml(change.label || "")}</strong><span>${escapeHtml(change.from || tr("Não informado", "Not specified"))} → ${escapeHtml(change.to || tr("Não informado", "Not specified"))}</span></li>`).join("")}</ul>
  </section>`;
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
      button.textContent = tr("Chave Pix copiada", "Pix key copied");
      window.setTimeout(() => {
        button.textContent = original || tr("Copiar chave Pix", "Copy Pix key");
      }, 2200);
    }
    captureProposalAnalytics("payment_instructions_used", { action: "copy_pix" });
    setMessage(tr("Chave Pix copiada só com números. Agora é só colar no app do banco.", "Pix key copied as digits. Paste it into your banking app."), "success");
  } catch (error) {
    console.warn("Falha ao copiar chave Pix.", error);
    setMessage(tr(`Não foi possível copiar automaticamente. Chave Pix sem pontuação: ${PAYMENT_INFO.pixCopy}`, `Could not copy automatically. Pix key: ${PAYMENT_INFO.pixCopy}`), "error");
  }
}

function renderOfferComparison(snapshot) {
  const options = Array.isArray(snapshot.publicOfferOptions) ? snapshot.publicOfferOptions.slice(0, 3) : [];
  if (options.length < 2) return "";
  const baseTotal = Number(options.find((option) => option.base)?.total || 0);
  return `<section class="public-offer-comparison"><span class="public-offer-eyebrow">${tr("Experiências desenhadas para o seu evento", "Experiences designed for your event")}</span><h3>${tr("Escolha o nível que combina com o grupo", "Choose the level that fits your group")}</h3><p>${tr("A opção Recomendada equilibra experiência e investimento. Ao escolher outra opção, a equipe revisa disponibilidade e envia a versão final — nenhum valor é aprovado automaticamente.", "The Recommended option balances experience and investment. When you choose another option, our team reviews availability and sends the final version — no price is approved automatically.")}</p><div>${options.map((o, i) => {const name=o.name||(o.base?tr("Essencial","Essential"):tr("Experiência","Experience"));const delta=Math.max(0,Number(o.delta??Number(o.total||0)-baseTotal));return `<article class="public-offer-card is-${escapeHtml(o.tier||o.id||"option")}${o.recommended?" is-recommended":""}">${o.recommended?`<span class="public-offer-badge">${tr("Recomendada", "Recommended")}</span>`:""}<strong>${escapeHtml(name)}</strong><p>${escapeHtml(o.description||(o.base?tr("Itens e condições desta versão.", "Items and terms in this version."):""))}</p><b>${formatMoney(o.total)}</b>${delta>0?`<small>+ ${formatMoney(delta)} ${tr("sobre a proposta atual", "over the current proposal")}</small>`:"<small>"+tr("Proposta atual", "Current proposal")+"</small>"}${o.reason?`<em>${escapeHtml(o.reason)}</em>`:""}${!o.base?`<button class="${o.recommended?"primary":"secondary"}" type="button" data-request-offer="${i}">${tr("Quero esta experiência", "Choose this experience")}</button>`:`<span class="public-offer-current">${tr("Itens desta proposta", "Items in this proposal")}</span>`}</article>`;}).join("")}</div></section>`;
}

function renderProposal(proposal) {
  currentProposal = proposal;
  const snapshot = proposal.snapshot || {};
  const event = snapshot.event || {};
  const totals = snapshot.totals || {};
  const experienceAmount = Number(proposal.privatizacao ?? totals.privatizationAmount ?? totals.privatization?.amount ?? 0);
  const experienceMode = totals.privatization?.mode;
  const experienceLabel = experienceMode === "required-partial"
    ? tr("Área Dedicada & Serviço Prioritário", "Dedicated Area & Priority Service")
    : ["required-full", "optional"].includes(experienceMode)
      ? tr("Experiência Exclusiva", "Exclusive Experience")
      : tr("Experiência do evento", "Event experience");
  const selectedItems = Array.isArray(snapshot.selectedItems) ? snapshot.selectedItems : [];
  const response = proposal.cliente_resposta || snapshot.clienteResposta?.acao || "";
  const responseMessage = proposal.cliente_mensagem || snapshot.clienteResposta?.mensagem || "";
  const responseProof = proposal.cliente_solicitacao?.comprovante || snapshot.clienteResposta?.comprovante || null;
  const decision = getDecisionCopy(proposal, response);
  const canDecide = !response && ["proposta_enviada", "negociacao"].includes(proposal.status);
  const canSendProof = response === "confirmar" && !responseProof && proposal.status === "negociacao";
  const eventTitle = event.type || proposal.tipo_evento || tr("Proposta de evento", "Event proposal");
  const guests = proposal.convidados || event.guests || 0;
  const dateLabel = formatDate(proposal.data_evento);
  const timeLabel = formatTime(proposal.horario_evento);
  const durationLabel = formatDuration(proposal.duracao || event.duration);

  title.textContent = eventTitle;
  subtitle.textContent = `${proposal.cliente_nome || tr("Cliente", "Guest")} · ${dateLabel} · ${guests} ${tr("convidados", "guests")}`;

  card.innerHTML = `
    <div class="public-proposal-topline">
      <span class="public-proposal-chip is-status">${escapeHtml(getStatusLabel(proposal.status))}</span>
      <span class="public-proposal-chip">${escapeHtml(eventTitle)}</span>
      <span class="public-proposal-chip">${escapeHtml(String(guests))} ${tr("convidados", "guests")}</span>
      <span class="public-proposal-chip public-proposal-chip-deadline">${escapeHtml(getSignalDeadlineLabel(proposal))}</span>
    </div>

    <div class="public-proposal-stage">
      <div class="public-proposal-stage-copy">
        <span>${tr("Experiência sugerida", "Suggested experience")}</span>
        <h2>${escapeHtml(eventTitle)}</h2>
        <p>${tr(`Uma experiência no Morro da Urca para ${escapeHtml(String(guests))} convidados. Duração prevista: ${escapeHtml(durationLabel)}.`, `An experience at Morro da Urca for ${escapeHtml(String(guests))} guests. Expected duration: ${escapeHtml(durationLabel)}.`)}</p>
      </div>
      <div class="public-proposal-decision-card">
        <span>${tr("Próximo passo", "Next step")}</span>
        <strong>${escapeHtml(decision.title)}</strong>
        <p>${escapeHtml(decision.note)}</p>
        ${renderDeadlineCard(proposal)}
      </div>
    </div>

    <div class="public-proposal-next-steps" aria-label="${tr("Próximos passos da reserva", "Booking steps")}">
      <article>
        <span>01</span>
        <strong>${tr("Aprovação", "Approval")}</strong>
        <p>${tr("Você confirma que o formato, a data e o investimento fazem sentido.", "Confirm that the format, date and price work for you.")}</p>
      </article>
      <article>
        <span>02</span>
        <strong>${tr("Sinal de reserva", "Deposit")}</strong>
        <p>${tr("Depois de aprovar, você recebe os dados para o pagamento.", "After approval, you will see the payment details.")}</p>
      </article>
      <article>
        <span>03</span>
        <strong>${tr("Data reservada", "Date reserved")}</strong>
        <p>${tr("Após validar o sinal, a equipe confirma a reserva.", "Our team confirms the booking after verifying the deposit.")}</p>
      </article>
    </div>

    <div class="public-proposal-summary">
      <div>
        <span>${tr("Cliente", "Client")}</span>
        <strong>${escapeHtml(proposal.cliente_nome || tr("Cliente", "Client"))}</strong>
      </div>
      <div>
        <span>${tr("Data e horário", "Date and time")}</span>
        <strong>${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</strong>
      </div>
      <div>
        <span>${tr("Convidados", "Guests")}</span>
        <strong>${escapeHtml(String(guests))}</strong>
      </div>
      <div>
        <span>${tr("Total estimado", "Estimated total")}</span>
        <strong>${formatMoney(proposal.total || totals.total)}</strong>
      </div>
    </div>

    <a class="public-proposal-jump" href="#decisionActions">${tr("Ver condições e responder", "Review terms and respond")}</a>
    ${renderVersionChanges(snapshot)}
    ${renderOfferComparison(snapshot)}
    ${renderCommercialSummary(snapshot)}

    ${
      response
        ? `<div class="public-proposal-response"><strong>${escapeHtml(getActionLabel(response))}</strong>${responseMessage ? `<span>${escapeHtml(responseMessage)}</span>` : ""}</div>`
        : ""
    }
    ${response === "confirmar" ? renderPaymentInfo({ proof: responseProof }) : ""}

    <div class="public-proposal-actions" id="decisionActions">
      <div class="public-proposal-actions-copy">
        <h3>${tr("Seu próximo passo", "Your next step")}</h3>
        <p>${canDecide ? tr("Confira os itens e condições. Depois, aprove ou peça um ajuste.", "Review the items and terms. Then approve or request a change.") : escapeHtml(decision.note)}</p>
      </div>
      <div class="public-proposal-buttons">
        ${canDecide ? `<button class="primary public-proposal-main-cta" type="button" data-public-action="confirmar">${tr("Aprovar e seguir para reserva", "Approve and proceed to booking")}</button>
        <button class="secondary" type="button" data-public-action="alteracao">${tr("Pedir ajuste", "Request a change")}</button>
        <button class="secondary danger-light" type="button" data-public-action="cancelar">${tr("Não seguir com esta proposta", "Decline this proposal")}</button>` : ""}
        ${canSendProof ? `<button class="primary public-proposal-main-cta" type="button" data-upload-proof>${tr("Enviar comprovante do sinal", "Send deposit receipt")}</button>` : ""}
        <a class="secondary" href="https://wa.me/5521971426007?text=${encodeURIComponent(tr(`Olá! Tenho uma dúvida sobre a proposta de ${eventTitle} em ${dateLabel}.`, `Hello! I have a question about the ${eventTitle} proposal for ${dateLabel}.`))}" target="_blank" rel="noopener noreferrer">${tr("Tirar dúvida no WhatsApp", "Ask us on WhatsApp")}</a>
      </div>
      ${canSendProof ? `<form id="publicLaterProofForm" class="public-proposal-change-form" hidden>${renderProofUploader()}<button class="primary" type="submit">${tr("Enviar comprovante", "Send receipt")}</button></form>` : ""}

      <form class="public-proposal-change-form" id="publicProposalResponseForm" hidden>
        <input type="hidden" id="publicProposalAction" />
        <div class="public-proposal-form-grid">
          <label>
            ${tr("Nova data", "New date")}
            <input id="publicRequestedDate" type="date" />
          </label>
          <label>
            ${tr("Novo horário", "New time")}
            <input id="publicRequestedTime" type="time" step="900" />
          </label>
          <label>
            ${tr("Convidados", "Guests")}
            <input id="publicRequestedGuests" type="number" min="1" max="500" placeholder="${escapeHtml(String(guests || ""))}" />
          </label>
        </div>
        <label>
          ${tr("Mensagem para a equipe", "Message to our team")}
          <textarea id="publicResponseMessage" rows="4" placeholder="${tr("Conte o que precisa ajustar ou o motivo do cancelamento.", "Tell us what to change or why you are declining.")}"></textarea>
        </label>
        <div id="publicPaymentInfoSlot" hidden>
          ${canDecide ? `${renderPaymentInfo()}${renderProofUploader()}` : ""}
        </div>
        <div class="public-proposal-form-actions">
          <button class="primary" id="publicSubmitResponse" type="submit">${tr("Enviar resposta", "Send response")}</button>
          <button class="secondary" type="button" id="publicCancelResponse">${tr("Voltar", "Back")}</button>
        </div>
      </form>
      <p id="publicProposalStatus" class="public-proposal-status" role="status" aria-live="polite">${tr("Status atual", "Current status")}: ${escapeHtml(getStatusLabel(proposal.status))}.</p>
    </div>

    <div class="public-proposal-layout">
      <div class="public-proposal-items">
        <h3>${tr("Itens incluídos", "Included items")}</h3>
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
            : `<p>${tr("Itens a confirmar com a equipe de eventos.", "Items to be confirmed with our events team.")}</p>`
        }
      </div>

      <aside class="public-proposal-side-stack">
        <div class="public-proposal-totals">
          <div><span>${tr("Subtotal", "Subtotal")}</span><strong>${formatMoney(proposal.subtotal || totals.subtotal)}</strong></div>
          <div><span>${tr("Taxa de serviço", "Service charge")}</span><strong>${formatMoney(proposal.taxa_servico || totals.serviceFee)}</strong></div>
          ${experienceAmount > 0 ? `<div><span>${experienceLabel}</span><strong>${formatMoney(experienceAmount)}</strong></div>` : ""}
          <div><span>${tr("Total estimado", "Estimated total")}</span><strong>${formatMoney(proposal.total || totals.total)}</strong></div>
        </div>

        <div class="public-proposal-contact-card">
          <span>${tr("Contato da equipe", "Contact our team")}</span>
          <strong>Eventos Embaixada Carioca</strong>
          <p>${tr("Prefere conversar antes de responder?", "Want to talk before responding?")} <a href="mailto:eventos@embaixadacarioca.com.br?subject=${encodeURIComponent(tr("Dúvida sobre proposta de evento", "Question about event proposal"))}">eventos@embaixadacarioca.com.br</a> · <a href="https://wa.me/5521971426007" target="_blank" rel="noopener noreferrer">+55 21 97142-6007</a></p>
        </div>

        ${
          snapshot.generalTerms
            ? `<details class="public-proposal-terms" id="commercialTerms"><summary>${tr("Condições comerciais completas", "Full commercial terms")}</summary><p>${formatMultiline(snapshot.generalTerms)}</p></details>`
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
  captureProposalAnalytics("proposal_response_started", { response_type: action });
  form.hidden = false;
  if (paymentSlot) paymentSlot.hidden = action !== "confirmar";
  if (action !== "confirmar") {
    selectedProof = null;
    updateProofStatus();
  }
  if (action === "confirmar") {
    message.placeholder = tr("Se quiser, deixe uma observação para a equipe antes de seguir com o sinal.", "Optional note for our team before sending your approval.");
    if (submitButton) submitButton.textContent = tr("Enviar aprovação à equipe", "Send approval to our team");
    updateProofStatus();
    setMessage(tr("Confira os dados bancários. Você pode anexar o comprovante agora ou depois de aprovar.", "Review the bank details. You may upload your receipt now or after approving."), "neutral");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (action === "cancelar") {
    message.placeholder = tr("Conte brevemente o motivo do cancelamento.", "Briefly explain why you are declining.");
    if (submitButton) submitButton.textContent = tr("Enviar cancelamento", "Send cancellation");
    setMessage(tr("Conte brevemente o motivo para a equipe registrar corretamente.", "Tell us briefly why you are declining."), "neutral");
  } else {
    message.placeholder = tr("Conte qual data, horário, número de convidados ou detalhe precisa mudar.", "Tell us what date, time, guest count or detail you would like to change.");
    if (submitButton) submitButton.textContent = tr("Enviar pedido de ajuste", "Request changes");
    setMessage(tr("Conte o que gostaria de ajustar: data, horário, convidados ou outro detalhe.", "Tell us what to change: date, time, guest count or anything else."), "neutral");
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
    setMessage(tr("Escreva uma mensagem breve para a equipe entender sua solicitação.", "Please include a short message so our team understands your request."), "error");
    return;
  }

  const submitButton = document.querySelector("#publicSubmitResponse");
  if (submitButton?.disabled) return;
  if (submitButton) submitButton.disabled = true;
  setMessage(tr("Enviando sua resposta...", "Sending your response..."), "neutral");
  const payload = {
    proposal_token: token,
    action,
    requested_date: requestedDate,
    requested_time: requestedTime,
    requested_guests: requestedGuests,
    message,
    payment_proof: action === "confirmar" ? selectedProof : null,
  };
  let data, error;
  try {
    ({ data, error } = await supabaseClient.rpc("respond_public_proposal", payload));
  } catch (requestError) {
    error = requestError;
  }
  if (submitButton) submitButton.disabled = false;

  if (error || !data?.[0]?.ok) {
    console.warn("Falha ao responder proposta.", error);
    setMessage(getPublicResponseErrorMessage(error), "error");
    return;
  }

  captureProposalAnalytics("client_replied", { response_type: action }, {
    dedupeKey: `client-replied:${currentProposal?.id || "proposal"}:${action}`,
  });
  if (action === "alteracao" && pendingUpsellOffer) {
    captureProposalAnalytics("proposal_upsell_requested", {
      offer_type: pendingUpsellOffer.id || "suggested_option",
      upsell_value_bucket: window.EventAnalytics?.bucketCurrency(
        Number(pendingUpsellOffer.total || 0) - Number(currentProposal?.total || currentProposal?.snapshot?.totals?.total || 0),
      ),
    }, {
      dedupeKey: `upsell-requested:${currentProposal?.id || "proposal"}:${pendingUpsellOffer.id || "option"}`,
    });
  }
  pendingUpsellOffer = null;

  if (action === "confirmar") {
    await loadProposal();
    setMessage(tr("Aprovação recebida. A equipe validará o sinal antes de confirmar a reserva.", "Approval received. Our team will verify the deposit before confirming the booking."), "success");
    return;
  }

  await loadProposal();
  setMessage(tr("Resposta registrada. Nossa equipe recebeu sua atualização.", "Response received. Our team has your request."), "success");
}

async function submitPublicProof(event) {
  event.preventDefault();
  if (!selectedProof || currentProposal?.cliente_resposta !== "confirmar") {
    setMessage(tr("Escolha um comprovante antes de enviar.", "Choose a receipt before sending."), "error");
    return;
  }
  const button = event.target.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  setMessage(tr("Enviando comprovante...", "Sending receipt..."), "neutral");
  let result, error;
  try {
    ({ data: result, error } = await supabaseClient.rpc("submit_public_signal_proof", { proposal_token: token, payment_proof: selectedProof }));
  } catch (requestError) { error = requestError; }
  button.disabled = false;
  if (error || !result?.[0]?.ok) {
    setMessage(getPublicResponseErrorMessage(error), "error");
    return;
  }
  captureProposalAnalytics("signal_proof_submitted", { result: "received" }, {
    dedupeKey: `signal-proof:${currentProposal?.id || "proposal"}`,
  });
  selectedProof = null;
  await loadProposal();
  setMessage(tr("Comprovante recebido. A equipe validará o pagamento.", "Receipt received. Our team will verify the payment."), "success");
}

async function loadProposal() {
  if (!token) {
    renderError(tr("O link está sem código de proposta.", "The link is missing a proposal code."));
    return;
  }

  if (!supabaseClient) {
    renderError(tr("Não foi possível carregar a conexão. Tente novamente.", "Connection unavailable. Please try again."));
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_public_proposal", { proposal_token: token });
  if (error || !data?.length) {
    console.warn("Falha ao carregar proposta pública.", error);
    renderError(tr("O link pode ter expirado ou ainda falta ativar a consulta pública.", "The link may have expired or the proposal may be temporarily unavailable."));
    return;
  }
  renderProposal(data[0]);
  captureProposalAnalytics("proposal_viewed", {}, {
    entityId: data[0].oportunidade_id || data[0].id,
    dedupeKey: `proposal-viewed:${data[0].id}:${data[0].versao || 1}`,
  });
  recordProposalView();
}

async function recordProposalView() {
  if (proposalViewRecorded || !token || !supabaseClient || document.visibilityState !== "visible" || /bot|crawler|spider|preview|facebookexternalhit|WhatsApp/i.test(navigator.userAgent || "")) return;
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
  const option = event.target.closest("[data-request-offer]");
  if (option) {
    const offer = currentProposal?.snapshot?.publicOfferOptions?.[Number(option.dataset.requestOffer)];
    if (!offer || offer.base) return;
    pendingUpsellOffer = offer;
    captureProposalAnalytics("proposal_upsell_selected", {
      offer_type: offer.id || "suggested_option",
      upsell_value_bucket: window.EventAnalytics?.bucketCurrency(
        Number(offer.total || 0) - Number(currentProposal?.total || currentProposal?.snapshot?.totals?.total || 0),
      ),
    });
    openResponseForm("alteracao");
    const message = document.querySelector("#publicResponseMessage");
    if (message) {
      const offerDetail = offer.description ? `${offer.name} — ${offer.description}` : offer.name;
      message.value = tr(`Gostaria de receber uma nova versão com ${offerDetail}, conforme a opção apresentada (${formatMoney(offer.total)}).`, `Please send a new version with the ${offerDetail} option, as presented (${formatMoney(offer.total)}).`);
    }
    return;
  }
  const laterProofButton = event.target.closest("[data-upload-proof]");
  if (laterProofButton) {
    const form = document.querySelector("#publicLaterProofForm");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
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
    setMessage(tr("Comprovante removido. Você pode anexar outro arquivo antes de enviar.", "Receipt removed. You can choose another file before sending."), "neutral");
    return;
  }
  const actionButton = event.target.closest("[data-public-action]");
  if (actionButton) {
    pendingUpsellOffer = null;
    openResponseForm(actionButton.dataset.publicAction);
  }
  const helpLink = event.target.closest('a[href*="wa.me"]');
  if (helpLink) captureProposalAnalytics("client_help_requested", { channel: "whatsapp", action: "proposal_help" });
  if (event.target.closest("#publicCancelResponse")) {
    const form = document.querySelector("#publicProposalResponseForm");
    if (form) form.hidden = true;
    setMessage(`${tr("Status atual", "Current status")}: ${getStatusLabel(currentProposal?.status)}.`, "neutral");
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

card.addEventListener("submit", (event) => {
  if (event.target.id === "publicLaterProofForm") submitPublicProof(event);
  else if (event.target.id === "publicProposalResponseForm") submitPublicResponse(event);
});
document.querySelectorAll("[data-proposal-lang]").forEach((button) => button.addEventListener("click", () => {
  language = button.dataset.proposalLang;
  localStorage.setItem("embaixada_form_language_v1", language);
  const url = new URL(window.location.href);
  url.searchParams.set("lang", language);
  window.history.replaceState(null, "", url);
  syncLanguage();
  if (!currentProposal) loadProposal();
}));
syncLanguage();
loadProposal();

document.addEventListener("visibilitychange", () => { if (currentProposal) recordProposalView(); });
