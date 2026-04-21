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
  moment: document.querySelector("#requestMoment"),
  profile: document.querySelector("#requestProfile"),
  eventType: document.querySelector("#requestEventType"),
  date: document.querySelector("#requestEventDate"),
  dateFlex: document.querySelector("#requestDateFlex"),
  timeRange: document.querySelector("#requestTimeRange"),
  time: document.querySelector("#requestEventTime"),
  guests: document.querySelector("#requestGuestCount"),
  guestOutput: document.querySelector("#requestGuestOutput"),
  duration: document.querySelector("#requestDuration"),
  reason: document.querySelector("#requestReason"),
  preferences: document.querySelector("#requestPreferences"),
  notes: document.querySelector("#requestNotes"),
};

const preferenceChips = [...document.querySelectorAll("[data-preference-chip]")];
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
  travel: "Agência / grupo turístico",
  suggestion: "Me ajudem a definir",
};

const timeRangeLabels = {
  morning: "Manhã",
  lunch: "Almoço",
  "late-afternoon": "Fim de tarde",
  night: "Noite",
  flexible: "Flexível",
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
  "weekday-lunch": "lunch",
  "late-afternoon": "late-afternoon",
  night: "night",
};

const timeOptionsByRange = {
  morning: ["08:30", "09:00", "09:30", "10:00", "10:30"],
  lunch: ["11:00", "11:30", "12:00", "12:30"],
  "late-afternoon": ["17:00", "17:30", "18:00", "18:30"],
  night: ["19:00", "19:30", "20:00"],
  flexible: [""],
};

function setStatus(message, type = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.status = type;
}

function updateProgress(stepName = "moment") {
  const index = Math.max(0, stepOrder.indexOf(stepName));
  const percent = ((index + 1) / stepOrder.length) * 100;
  if (progressText) progressText.textContent = `Etapa ${index + 1} de ${stepOrder.length}`;
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

function renderSuccessStatus(referenceCode) {
  statusNode.dataset.status = "success";
  statusNode.innerHTML = `
    <strong>Solicitação enviada. Obrigado!</strong>
    <span>Sua referência é <b>${referenceCode}</b>. O departamento de eventos da Embaixada Carioca vai analisar os detalhes e responder em até 24h úteis.</span>
    <span>Se quiser acrescentar algo, fale com <a href="mailto:eventos@embaixadacarioca.com.br">eventos@embaixadacarioca.com.br</a> ou <a href="https://wa.me/5521971426007" target="_blank" rel="noopener">21 97142-6007</a>.</span>
  `;
  window.requestAnimationFrame(() => {
    statusNode.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function fillGuestOptions() {
  fields.guests.value = "30";
  updateGuestOutput();
}

function updateGuestOutput() {
  const guests = Math.max(1, Math.floor(toNumber(fields.guests.value) || 1));
  fields.guestOutput.textContent = `${guests} ${guests === 1 ? "pessoa" : "pessoas"}`;
}

function fillTimeOptions(range = fields.timeRange.value) {
  const times = timeOptionsByRange[range] || [];
  if (range === "flexible") {
    fields.time.innerHTML = '<option value="">A definir</option>';
    return;
  }
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

function getRecommendedFormatIds() {
  const base = recommendationRules[fields.moment.value] || recommendationRules.evaluating;
  const profiles = fields.profile.value.split(",").filter(Boolean);
  if (fields.moment.value === "weekday-lunch") return base;
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
  const moment = momentLabels[fields.moment.value];
  recommendationIntro.textContent = `Baseado no que nos contou, estas experiências combinam melhor com ${moment.toLowerCase()}.`;
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
  const preferenceText = fields.preferences.value.trim();
  return {
    referencia: referenceCode,
    cliente: {
      nome: fields.name.value.trim(),
      email: fields.email.value.trim(),
      whatsapp: fields.phone.value.trim(),
      empresa: fields.company.value.trim(),
    },
    evento: {
      momento: momentLabels[fields.moment.value] || "",
      perfil: getSelectedProfileLabels().join(", "),
      tipo: fields.eventType.value,
      data: fields.date.value,
      dataFlexivel: fields.dateFlex.value.trim(),
      faixaHorario: timeRangeLabels[fields.timeRange.value] || "",
      horario: selectedTime,
      convidados: Math.max(1, Math.floor(toNumber(fields.guests.value) || 1)),
      duracao: toNumber(fields.duration.value),
      motivo: fields.reason.value.trim(),
      preferencias: [selectedPreferences.length ? `Preferências marcadas: ${selectedPreferences.join(", ")}` : "", preferenceText]
        .filter(Boolean)
        .join("\n"),
      observacoes: fields.notes.value.trim(),
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
    observacoes: snapshot.evento.observacoes || null,
    origem: "formulario",
    proposta_id: null,
    snapshot,
  };
}

function validateSnapshot(snapshot) {
  clearAllStepValidity();
  const required = [
    [fields.moment, Boolean(snapshot.evento.momento), "moment"],
    [fields.profile, Boolean(snapshot.evento.perfil), "profile"],
    [fields.eventType, Boolean(snapshot.evento.tipo), "recommendation"],
    [fields.timeRange, Boolean(snapshot.evento.faixaHorario), "eventDetails"],
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
    setStatus("Falta só escolher momento, perfil, experiência, período e contato para seguirmos.", "error");
    scrollToStep(firstInvalid[2], true);
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
fields.date.min = new Date().toISOString().slice(0, 10);
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
fields.email.addEventListener("blur", () => {
  setFieldValidity(fields.email, !fields.email.value || isValidEmail(fields.email.value));
  setStepValidity("contact", true);
});
preferenceChips.forEach((chip) => chip.addEventListener("change", () => setStepValidity("briefing", true)));
updateProgress();
form.addEventListener("submit", submitRequest);
