const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";

const form = document.querySelector("#clientQuoteForm");
const statusNode = document.querySelector("#clientFormStatus");
const submitButton = document.querySelector("#submitClientQuoteBtn");
const recommendationIntro = document.querySelector("#recommendationIntro");
const recommendationList = document.querySelector("#formatRecommendations");
const progressText = document.querySelector("#formProgressText");
const progressBar = document.querySelector("#formProgressBar");
const progressSteps = [...document.querySelectorAll(".public-form-steps li")];
const mobileFormQuery = window.matchMedia("(max-width: 720px)");

const fields = {
  name: document.querySelector("#requestClientName"),
  email: document.querySelector("#requestClientEmail"),
  phone: document.querySelector("#requestClientPhone"),
  company: document.querySelector("#requestCompany"),
  clientType: document.querySelector("#requestClientType"),
  budgetRange: document.querySelector("#requestBudgetRange"),
  leadSource: document.querySelector("#requestLeadSource"),
  moment: document.querySelector("#requestMoment"),
  profile: document.querySelector("#requestProfile"),
  eventType: document.querySelector("#requestEventType"),
  date: document.querySelector("#requestEventDate"),
  dateFlex: document.querySelector("#requestDateFlex"),
  dateIsFlexible: document.querySelector("#requestDateIsFlexible"),
  timeRange: document.querySelector("#requestTimeRange"),
  time: document.querySelector("#requestEventTime"),
  guestSlider: document.querySelector("#requestGuestSlider"),
  guests: document.querySelector("#requestGuestCount"),
  guestOutput: document.querySelector("#requestGuestOutput"),
  duration: document.querySelector("#requestDuration"),
  reason: document.querySelector("#requestReason"),
  preferences: document.querySelector("#requestPreferences"),
  notes: document.querySelector("#requestNotes"),
};

const preferenceChips = [...document.querySelectorAll("[data-preference-chip]")];
const extraChips = [...document.querySelectorAll("[data-extra-chip]")];
const selectedProfiles = new Set();
const stepOrder = ["moment", "profile", "recommendation", "eventDetails", "briefing", "contact"];

const steps = {
  moment: document.querySelector("#momentStep"),
  profile: document.querySelector("#profileStep"),
  recommendation: document.querySelector("#recommendationStep"),
  eventDetails: document.querySelector("#eventDetailsStep"),
  briefing: document.querySelector("#briefingStep"),
  contact: document.querySelector("#contactStep"),
};

const momentLabels = {
  "weekday-morning": "Manhã em dia de semana",
  "weekday-lunch": "Início do almoço",
  "late-afternoon": "Fim de tarde",
  night: "Noite (19h-21h)",
  evaluating: "Ainda estou avaliando",
};

const profileLabels = {
  corporate: "Reunião / encontro corporativo",
  celebration: "Confraternização",
  birthday: "Aniversário / celebração",
  relationship: "Lançamento / relacionamento com clientes",
  experience: "Experiência gastronômica",
  travel: "Grupo turístico / receptivo",
  suggestion: "Me ajudem a definir",
};

const clientTypeLabels = {
  "agency-tourism": "Agência de turismo receptivo / DMC",
  "agency-marketing": "Agência de marketing / eventos",
  company: "Empresa",
  person: "Pessoa física",
};

const budgetRangeLabels = {
  "up-to-15": "Até R$ 15 mil",
  "15-30": "R$ 15 mil a R$ 30 mil",
  "30-60": "R$ 30 mil a R$ 60 mil",
  "above-60": "Acima de R$ 60 mil",
  undefined: "Ainda não definido",
};

const leadSourceLabels = {
  indication: "Indicação",
  "google-social": "Google / Instagram",
  "agency-partner": "Agência / parceiro",
  "already-know": "Já conheço o restaurante",
  bondinho: "Parque Bondinho",
  other: "Outro",
};

const flexibilityLabels = {
  yes: "Sim",
  no: "Não",
  maybe: "Ainda avaliando",
};

const timeRangeLabels = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
};

const formats = {
  recommendation: {
    label: "Quero recomendação da equipe",
    description: "A equipe indica o melhor formato considerando horário, grupo e objetivo.",
    badge: "Consultivo",
    visual: "Sob medida",
    group: "Qualquer grupo",
  },
  breakfast: {
    label: "Café da Manhã / Brunch",
    description: "Perfeito para encontros matinais, reuniões, ativações e recepções mais leves.",
    badge: "Mais indicado para manhã",
    visual: "Manhã",
    group: "A partir de 30 pessoas",
  },
  coffee: {
    label: "Coffee Break",
    description: "Ideal para pausas corporativas e eventos curtos com praticidade.",
    badge: "Muito pedido por grupos corporativos",
    visual: "Pausa",
    group: "A partir de 30 pessoas",
  },
  lunch: {
    label: "Almoço Carioca",
    description: "Formato para início do almoço em dias úteis, com feijoada premiada e bebidas.",
    badge: "Novo para 2ª a 6ª",
    visual: "Carioca",
    group: "A partir de 2 pessoas",
  },
  welcome: {
    label: "Welcome Drink",
    description: "Recepção elegante para grupos que querem começar o evento com impacto.",
    badge: "Ideal para fim de tarde",
    visual: "Recepção",
    group: "A partir de 20 pessoas",
  },
  cocktail: {
    label: "Coquetel",
    description: "Ótimo para confraternizações, networking, lançamentos e celebrações.",
    badge: "Ótima opção para 19h-21h",
    visual: "Coquetel",
    group: "A partir de 20 pessoas",
  },
  workshop: {
    label: "Workshop de Caipirinha",
    description: "Experiência interativa e memorável para grupos que buscam algo diferente.",
    badge: "Experiência interativa",
    visual: "Experiência",
    group: "A partir de 8 pessoas",
  },
  custom: {
    label: "Evento sob medida",
    description: "Para demandas personalizadas, roteiros de agências e propostas institucionais.",
    badge: "Sob consulta",
    visual: "Especial",
    group: "Sob consulta",
  },
};

const recommendationRules = {
  "weekday-morning": ["breakfast", "coffee", "workshop", "custom"],
  "weekday-lunch": ["lunch", "custom", "workshop"],
  "late-afternoon": ["welcome", "cocktail", "workshop", "custom"],
  night: ["welcome", "cocktail", "workshop", "custom"],
  evaluating: ["recommendation", "breakfast", "coffee", "lunch", "welcome", "cocktail", "workshop", "custom"],
};

const preferredTimeRangeByMoment = {
  "weekday-morning": "morning",
  "weekday-lunch": "afternoon",
  "late-afternoon": "afternoon",
  night: "night",
};

const timeOptionsByRange = {
  morning: ["08:30", "09:00", "09:30", "10:00", "10:30"],
  afternoon: ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "17:00", "17:30", "18:00", "18:30"],
  night: ["19:00", "19:30", "20:00"],
};

function setStatus(message, type = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.status = type;
}

function updateProgress(stepName = "moment") {
  const index = Math.max(0, stepOrder.indexOf(stepName));
  const percent = ((index + 1) / stepOrder.length) * 100;
  if (progressText) progressText.textContent = `Pergunta ${index + 1} de ${stepOrder.length} - Tempo estimado 2 minutos`;
  if (progressBar) progressBar.style.width = `${percent}%`;
  progressSteps.forEach((step, stepIndex) => {
    step.toggleAttribute("data-active", stepIndex === index);
    step.toggleAttribute("data-complete", stepIndex < index);
  });
}

function createReferenceCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EC-${datePart}-${randomPart}`;
}

function getTodayInputValue() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function renderSuccessStatus(referenceCode) {
  statusNode.dataset.status = "success";
  statusNode.innerHTML = `
    <strong>Solicitação enviada. Obrigado!</strong>
    <span>Sua referência é <b>${referenceCode}</b>. O departamento de eventos da Embaixada Carioca vai analisar os detalhes e responder em até 2 dias úteis.</span>
    <span>Se quiser acrescentar algo, fale com <a href="mailto:eventos@embaixadacarioca.com.br">eventos@embaixadacarioca.com.br</a> ou <a href="https://wa.me/5521971426007" target="_blank" rel="noopener">21 97142-6007</a>.</span>
  `;
  window.requestAnimationFrame(() => {
    statusNode.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function fillGuestOptions() {
  fields.guests.value = "30";
  if (fields.guestSlider) fields.guestSlider.value = "30";
  updateGuestOutput("number");
}

function updateGuestOutput(source = "number") {
  const sliderMax = 100;
  if (source === "slider" && fields.guestSlider) {
    const sliderGuests = Math.floor(toNumber(fields.guestSlider.value) || 30);
    fields.guests.value = String(sliderGuests >= sliderMax ? sliderMax : sliderGuests);
  }

  let guests = Math.floor(toNumber(fields.guests.value) || 30);
  guests = Math.min(500, Math.max(2, guests));
  fields.guests.value = String(guests);

  if (fields.guestSlider) {
    fields.guestSlider.value = String(guests >= 100 ? 100 : guests);
  }

  const outputLabel = guests >= 100 ? "99+ pessoas" : `${guests} ${guests === 1 ? "pessoa" : "pessoas"}`;
  fields.guestOutput.textContent = outputLabel;
}

function fillTimeOptions(range = fields.timeRange.value) {
  const times = timeOptionsByRange[range] || [];
  const options = ['<option value="">Selecione</option>'];
  times.forEach((time) => options.push(`<option value="${time}">${time.replace(":", "h")}</option>`));
  fields.time.innerHTML = options.join("");
}

function toNumber(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatBrazilianPhone(value) {
  const digits = normalizePhone(value).replace(/^55(?=\d{11}$)/, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidBrazilianMobile(value) {
  const digits = normalizePhone(value);
  const local = digits.startsWith("55") && digits.length === 13 ? digits.slice(2) : digits;
  return local.length === 11 && /^[1-9]{2}9\d{8}$/.test(local);
}

function setFieldValidity(field, isValid) {
  field.toggleAttribute("aria-invalid", !isValid);
}

function setStepValidity(stepName, isValid) {
  const step = steps[stepName];
  if (!step) return;
  step.toggleAttribute("data-invalid", !isValid);
}

function clearAllStepValidity() {
  Object.keys(steps).forEach((stepName) => setStepValidity(stepName, true));
}

function scrollToStep(stepName, force = false) {
  const step = steps[stepName];
  updateProgress(stepName);
  if (!step || (!force && !mobileFormQuery.matches)) return;
  window.requestAnimationFrame(() => {
    step.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setActiveChoice(group, value) {
  document.querySelectorAll(`[data-choice-group="${group}"]`).forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.choiceValue === value);
  });
  setStepValidity(group, true);
}

function setProfileChoice(value) {
  if (value === "suggestion") {
    selectedProfiles.clear();
    selectedProfiles.add(value);
  } else {
    selectedProfiles.delete("suggestion");
    if (selectedProfiles.has(value)) selectedProfiles.delete(value);
    else selectedProfiles.add(value);
  }

  if (!selectedProfiles.size) selectedProfiles.add(value);
  fields.profile.value = [...selectedProfiles].join(",");
  document.querySelectorAll(`[data-choice-group="profile"]`).forEach((button) => {
    button.classList.toggle("is-selected", selectedProfiles.has(button.dataset.choiceValue));
  });
  setStepValidity("profile", true);
}

function getSelectedProfileLabels() {
  return [...selectedProfiles].map((profile) => profileLabels[profile]).filter(Boolean);
}

function getSelectedPreferenceLabels() {
  return preferenceChips.filter((chip) => chip.checked).map((chip) => chip.value);
}

function getSelectedExtraLabels() {
  return extraChips.filter((chip) => chip.checked).map((chip) => chip.value);
}

function getRecommendedFormatIds() {
  const base = recommendationRules[fields.moment.value] || recommendationRules.evaluating;
  const profiles = fields.profile.value.split(",").filter(Boolean);
  if (fields.moment.value === "weekday-lunch") return base;
  if (fields.clientType.value === "agency-tourism") return prioritize(base, ["lunch", "welcome", "breakfast", "cocktail", "custom"]);
  if (fields.clientType.value === "agency-marketing") return prioritize(base, ["welcome", "cocktail", "workshop", "custom"]);
  if (profiles.includes("travel")) return prioritize(base, ["lunch", "welcome", "breakfast", "cocktail", "custom"]);
  if (profiles.includes("corporate")) return prioritize(base, ["coffee", "breakfast", "workshop"]);
  if (profiles.includes("relationship")) return prioritize(base, ["welcome", "cocktail", "workshop"]);
  if (profiles.includes("experience")) return prioritize(base, ["workshop", "cocktail", "welcome"]);
  if (profiles.includes("birthday") || profiles.includes("celebration")) return prioritize(base, ["cocktail", "welcome", "custom"]);
  return base;
}

function prioritize(ids, priority) {
  const set = new Set(ids);
  return [...priority.filter((id) => set.has(id)), ...ids.filter((id) => !priority.includes(id))];
}

function getFormatIdByLabel(label) {
  return Object.entries(formats).find(([, item]) => item.label === label)?.[0] || "";
}

function renderRecommendations() {
  if (!fields.moment.value) {
    recommendationIntro.textContent = "Escolha o momento e o perfil para ver as experiências mais indicadas.";
    recommendationList.innerHTML =
      '<div class="recommendation-empty">As sugestões aparecem aqui depois da primeira escolha.</div>';
    return;
  }

  const ids = getRecommendedFormatIds();
  const selectedFormatId = getFormatIdByLabel(fields.eventType.value);
  if (fields.eventType.value && !ids.includes(selectedFormatId)) fields.eventType.value = "";
  if (!fields.eventType.value && fields.profile.value && ids.length) {
    fields.eventType.value = formats[ids[0]].label;
  }
  const moment = momentLabels[fields.moment.value];
  recommendationIntro.textContent = `Baseado no que nos contou, já deixamos a opção mais indicada selecionada para ${moment.toLowerCase()}. Você pode trocar se preferir.`;
  recommendationList.innerHTML = ids
    .map((id, index) => {
      const item = formats[id];
      const selected = fields.eventType.value === item.label;
      return `
        <button class="format-card ${selected ? "is-selected" : ""}" type="button" data-format-id="${id}">
          <span>${item.badge}</span>
          <i>${item.visual}</i>
          <strong>${item.label}</strong>
          <em>${item.description}</em>
          <small>${item.group}</small>
          <b>${index === 0 ? "Mais indicado" : "Selecionar"}</b>
        </button>
      `;
    })
    .join("");
}

function selectFormat(formatId) {
  const item = formats[formatId];
  if (!item) return;
  fields.eventType.value = item.label;
  setStepValidity("recommendation", true);
  renderRecommendations();
  scrollToStep("eventDetails");
}

function handleChoiceClick(event) {
  const button = event.target.closest("[data-choice-group]");
  if (!button) return;
  const { choiceGroup, choiceValue } = button.dataset;
  if (choiceGroup === "profile") {
    setProfileChoice(choiceValue);
  } else {
    fields[choiceGroup].value = choiceValue;
    setActiveChoice(choiceGroup, choiceValue);
  }

  if (choiceGroup === "moment") {
    const preferredRange = preferredTimeRangeByMoment[choiceValue];
    if (preferredRange) {
      fields.timeRange.value = preferredRange;
      fillTimeOptions(preferredRange);
    }
    if (choiceValue === "weekday-lunch") {
      fields.time.value = "11:30";
      fields.duration.value = "1.5";
    } else if (choiceValue === "weekday-morning") {
      fields.time.value = "09:00";
    } else if (choiceValue === "late-afternoon") {
      fields.time.value = "17:00";
    } else if (choiceValue === "night") {
      fields.time.value = "19:00";
    }
  }

  renderRecommendations();
  if (choiceGroup === "moment") scrollToStep("profile");
  if (choiceGroup === "profile") scrollToStep("recommendation");
}

function handleFormatClick(event) {
  const button = event.target.closest("[data-format-id]");
  if (!button) return;
  selectFormat(button.dataset.formatId);
}

function getSnapshot(referenceCode) {
  const selectedTime = fields.time.value || "";
  const selectedPreferences = getSelectedPreferenceLabels();
  const selectedExtras = getSelectedExtraLabels();
  const preferenceText = fields.preferences.value.trim();
  const selectedOccasions = getSelectedProfileLabels().join(", ");
  return {
    referencia: referenceCode,
    cliente: {
      nome: fields.name.value.trim(),
      email: fields.email.value.trim(),
      whatsapp: fields.phone.value.trim(),
      empresa: fields.company.value.trim(),
      tipoCliente: clientTypeLabels[fields.clientType.value] || "",
    },
    evento: {
      momento: momentLabels[fields.moment.value] || "",
      ocasiao: selectedOccasions,
      perfil: selectedOccasions,
      tipo: fields.eventType.value,
      data: fields.date.value,
      dataFlexivel: fields.dateFlex.value.trim(),
      dataFlexivelStatus: flexibilityLabels[fields.dateIsFlexible.value] || "",
      faixaHorario: timeRangeLabels[fields.timeRange.value] || "",
      horario: selectedTime,
      convidados: Math.min(500, Math.max(2, Math.floor(toNumber(fields.guests.value) || 30))),
      duracao: toNumber(fields.duration.value),
      motivo: fields.reason.value.trim(),
      preferencias: [selectedPreferences.length ? `Preferências marcadas: ${selectedPreferences.join(", ")}` : "", preferenceText]
        .filter(Boolean)
        .join("\n"),
      extras: selectedExtras.join(", "),
      observacoes: fields.notes.value.trim(),
    },
    qualificacao: {
      tipoCliente: clientTypeLabels[fields.clientType.value] || "",
      origem: leadSourceLabels[fields.leadSource.value] || "",
      faixaInvestimento: budgetRangeLabels[fields.budgetRange.value] || "",
    },
    origem: "formulario",
    enviadoEm: new Date().toISOString(),
  };
}

function getPayload(snapshot) {
  return {
    status: "novo",
    cliente_nome: snapshot.cliente.nome,
    cliente_email: snapshot.cliente.email,
    cliente_whatsapp: snapshot.cliente.whatsapp || null,
    empresa: snapshot.cliente.empresa || null,
    tipo_evento: snapshot.evento.tipo || null,
    data_evento: snapshot.evento.data || null,
    horario_evento: snapshot.evento.horario || null,
    convidados: snapshot.evento.convidados,
    duracao: snapshot.evento.duracao,
    motivo_evento: snapshot.evento.motivo || null,
    preferencias: snapshot.evento.preferencias || null,
    observacoes:
      [
        snapshot.evento.extras ? `Extras: ${snapshot.evento.extras}` : "",
        snapshot.qualificacao?.tipoCliente ? `Tipo de cliente: ${snapshot.qualificacao.tipoCliente}` : "",
        snapshot.qualificacao?.origem ? `Origem: ${snapshot.qualificacao.origem}` : "",
        snapshot.qualificacao?.faixaInvestimento
          ? `Faixa de investimento: ${snapshot.qualificacao.faixaInvestimento}`
          : "",
        snapshot.evento.dataFlexivelStatus ? `Data flexível: ${snapshot.evento.dataFlexivelStatus}` : "",
        snapshot.evento.observacoes || "",
      ]
        .filter(Boolean)
        .join("\n") || null,
    origem: "formulario",
    proposta_id: null,
    snapshot,
  };
}

function validateSnapshot(snapshot) {
  clearAllStepValidity();
  const hasEventDateOrWindow = Boolean(snapshot.evento.data || snapshot.evento.dataFlexivel);
  const required = [
    [fields.moment, Boolean(snapshot.evento.momento), "moment"],
    [fields.clientType, Boolean(snapshot.cliente.tipoCliente), "profile"],
    [fields.profile, Boolean(snapshot.evento.perfil), "profile"],
    [fields.eventType, Boolean(snapshot.evento.tipo), "recommendation"],
    [fields.timeRange, Boolean(snapshot.evento.faixaHorario), "eventDetails"],
    [fields.time, Boolean(snapshot.evento.horario), "eventDetails"],
    [fields.budgetRange, Boolean(snapshot.qualificacao.faixaInvestimento), "contact"],
    [fields.leadSource, Boolean(snapshot.qualificacao.origem), "contact"],
    [fields.name, Boolean(snapshot.cliente.nome), "contact"],
    [fields.email, Boolean(snapshot.cliente.email), "contact"],
    [fields.phone, Boolean(snapshot.cliente.whatsapp), "contact"],
  ];
  required.forEach(([field, valid, stepName]) => {
    setFieldValidity(field, valid);
    if (!valid) setStepValidity(stepName, false);
  });

  const firstInvalid = required.find(([, valid]) => !valid);
  if (firstInvalid) {
    setStatus("Falta só escolher momento, qualificação, formato, período e contato para seguirmos.", "error");
    scrollToStep(firstInvalid[2], true);
    return false;
  }

  if (!hasEventDateOrWindow) {
    setStatus("Informe uma data desejada ou uma janela aproximada para a equipe avaliar disponibilidade.", "error");
    setStepValidity("eventDetails", false);
    setFieldValidity(fields.date, false);
    setFieldValidity(fields.dateFlex, false);
    scrollToStep("eventDetails", true);
    return false;
  }

  if (!isValidEmail(snapshot.cliente.email)) {
    setStatus("Revise o e-mail para a proposta chegar no endereço certo.", "error");
    setStepValidity("contact", false);
    setFieldValidity(fields.email, false);
    fields.email.focus();
    scrollToStep("contact", true);
    return false;
  }

  if (!isValidBrazilianMobile(snapshot.cliente.whatsapp)) {
    setStatus("Revise o WhatsApp com DDD. Ex.: 21 99999-9999.", "error");
    setStepValidity("contact", false);
    setFieldValidity(fields.phone, false);
    fields.phone.focus();
    scrollToStep("contact", true);
    return false;
  }

  return true;
}

async function submitRequest(event) {
  event.preventDefault();

  if (!window.supabase?.createClient) {
    setStatus("Não foi possível carregar a conexão. Tente novamente em instantes.", "error");
    return;
  }

  const referenceCode = createReferenceCode();
  const snapshot = getSnapshot(referenceCode);
  if (!validateSnapshot(snapshot)) return;

  submitButton.disabled = true;
  setStatus("Enviando solicitação…", "neutral");

  const client = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  const { error } = await client.from("solicitacoes_cotacao").insert(getPayload(snapshot));

  submitButton.disabled = false;

  if (error) {
    console.warn("Falha ao enviar solicitacao.", error);
    setStatus("Não foi possível enviar. Confira os dados e tente novamente.", "error");
    return;
  }

  form.reset();
  fields.moment.value = "";
  fields.clientType.value = "";
  fields.profile.value = "";
  fields.eventType.value = "";
  selectedProfiles.clear();
  document.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
  clearAllStepValidity();
  fillGuestOptions();
  fillTimeOptions("");
  renderRecommendations();
  renderSuccessStatus(referenceCode);
}

fillGuestOptions();
fillTimeOptions("");
renderRecommendations();
fields.date.min = getTodayInputValue();
form.addEventListener("click", handleChoiceClick);
recommendationList.addEventListener("click", handleFormatClick);
fields.timeRange.addEventListener("change", () => {
  fillTimeOptions();
  setFieldValidity(fields.timeRange, true);
  setStepValidity("eventDetails", true);
});
fields.phone.addEventListener("input", () => {
  fields.phone.value = formatBrazilianPhone(fields.phone.value);
  setFieldValidity(fields.phone, !fields.phone.value || isValidBrazilianMobile(fields.phone.value));
  setStepValidity("contact", true);
});
fields.guests.addEventListener("input", updateGuestOutput);
fields.guestSlider?.addEventListener("input", () => updateGuestOutput("slider"));
fields.email.addEventListener("blur", () => {
  setFieldValidity(fields.email, !fields.email.value || isValidEmail(fields.email.value));
  setStepValidity("contact", true);
});
fields.date.addEventListener("input", () => {
  setFieldValidity(fields.date, true);
  setFieldValidity(fields.dateFlex, true);
  setStepValidity("eventDetails", true);
});
fields.dateFlex.addEventListener("input", () => {
  setFieldValidity(fields.date, true);
  setFieldValidity(fields.dateFlex, true);
  setStepValidity("eventDetails", true);
});
preferenceChips.forEach((chip) => chip.addEventListener("change", () => setStepValidity("briefing", true)));
extraChips.forEach((chip) => chip.addEventListener("change", () => setStepValidity("briefing", true)));
updateProgress();
form.addEventListener("submit", submitRequest);
