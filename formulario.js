const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";

const form = document.querySelector("#clientQuoteForm");
const statusNode = document.querySelector("#clientFormStatus");
const submitButton = document.querySelector("#submitClientQuoteBtn");
const recommendationIntro = document.querySelector("#recommendationIntro");
const recommendationList = document.querySelector("#formatRecommendations");
const finalReviewGrid = document.querySelector("#finalReviewGrid");
const progressText = document.querySelector("#formProgressText");
const progressBar = document.querySelector("#formProgressBar");
const progressSteps = [...document.querySelectorAll(".public-form-steps li")];
const mobileFormQuery = window.matchMedia("(max-width: 720px)");
const LANGUAGE_KEY = "embaixada_form_language_v1";
const CAPTURE_TOKEN_KEY = "embaixada_form_capture_token_v1";
const REFERENCE_CODE_KEY = "embaixada_form_reference_v1";
const CANONICAL_CLIENT_FORM_URL = "https://leorangel22.github.io/main/formulario.html";
let publicSupabaseClient = null;
let partialCaptureTimer = null;
let returningClientHistory = [];
const langButtons = [...document.querySelectorAll("[data-lang]")];

const canonicalMomentLabels = {
  "weekday-morning": "Manhã em dia de semana",
  "weekday-lunch": "Início do almoço",
  "late-afternoon": "Fim de tarde",
  night: "Noite (19h-21h)",
  evaluating: "Ainda estou avaliando",
};

const canonicalProfileLabels = {
  corporate: "Reunião / encontro corporativo",
  celebration: "Confraternização",
  birthday: "Aniversário / celebração",
  relationship: "Lançamento / relacionamento com clientes",
  experience: "Experiência gastronômica",
  travel: "Grupo turístico / receptivo",
  suggestion: "Me ajudem a definir",
};

const canonicalClientTypeLabels = {
  "agency-tourism": "Agência de turismo receptivo / DMC",
  "agency-marketing": "Agência de marketing / eventos",
  company: "Empresa",
  person: "Pessoa física",
};

const canonicalBudgetRangeLabels = {
  "up-to-15": "Até R$ 15 mil",
  "15-30": "R$ 15 mil a R$ 30 mil",
  "30-60": "R$ 30 mil a R$ 60 mil",
  "above-60": "Acima de R$ 60 mil",
  undefined: "Ainda não definido",
};

const canonicalLeadSourceLabels = {
  indication: "Indicação",
  "google-social": "Google / Instagram",
  "agency-partner": "Agência / parceiro",
  "already-know": "Já conheço o restaurante",
  bondinho: "Parque Bondinho",
  other: "Outro",
};

const canonicalFlexibilityLabels = {
  yes: "Sim",
  no: "Não",
  maybe: "Ainda avaliando",
};

const canonicalTimeRangeLabels = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
};

const fields = {
  name: document.querySelector("#requestClientName"),
  email: document.querySelector("#requestClientEmail"),
  phone: document.querySelector("#requestClientPhone"),
  company: document.querySelector("#requestCompany"),
  endClientName: document.querySelector("#requestEndClientName"),
  groupName: document.querySelector("#requestGroupName"),
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

const nameHelp = document.querySelector("#nameHelp");
const companyHelp = document.querySelector("#companyHelp");
const endClientField = document.querySelector("#endClientField");
const groupNameField = document.querySelector("#groupNameField");
const endClientHelp = document.querySelector("#endClientHelp");
const groupNameHelp = document.querySelector("#groupNameHelp");
const contactIntroTitle = document.querySelector("#contactIntroTitle");
const contactIntroBody = document.querySelector("#contactIntroBody");
const contactRequirementNote = document.querySelector("#contactRequirementNote");

const chipLabelSets = {
  pt: {
    preference: {
      "open-bar": "Open bar",
      "tasting-menu": "Menu degustação",
      "welcome-drink": "Welcome drink",
      "vegetarian-options": "Opções vegetarianas",
      "dietary-restrictions": "Restrições alimentares",
      "interactive-experience": "Experiência interativa",
    },
    extra: {
      dj: "DJ",
      "jazz-trio": "Trio de Jazz/Bossa Nova",
      photo: "Foto",
      video: "Filmagem",
      tv: "TV",
      "sound-mic": "Som com Microfone",
      "ambient-sound": "Som Ambiente",
      decor: "Decoração",
      banners: "Banners",
    },
  },
  en: {
    preference: {
      "open-bar": "Open bar",
      "tasting-menu": "Tasting menu",
      "welcome-drink": "Welcome drink",
      "vegetarian-options": "Vegetarian options",
      "dietary-restrictions": "Dietary restrictions",
      "interactive-experience": "Interactive experience",
    },
    extra: {
      dj: "DJ",
      "jazz-trio": "Jazz/Bossa Nova trio",
      photo: "Photo",
      video: "Video",
      tv: "TV",
      "sound-mic": "Sound with microphone",
      "ambient-sound": "Ambient sound",
      decor: "Decor",
      banners: "Banners",
    },
  },
};

// Fixed campaign taxonomy: attribution is not identity or authorization.
const EVENT_ATTRIBUTION_KEY = "embaixada_form_attribution_v1";
const formStorageMemory = Object.create(null);
const EVENT_CONTENTS = new Set(["index", "index_en", "index_es", "eventos", "eventos-corporativos", "en-eventos-corporativos", "es-eventos-corporativos", "contato", "en-contato", "es-contato", "formulario"]);
function readFormStorage(key) {
  if (Object.prototype.hasOwnProperty.call(formStorageMemory, key)) return formStorageMemory[key];
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function writeFormStorage(key, value) {
  formStorageMemory[key] = value;
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (_) { /* Retry remains stable within this tab. */ }
}
function normalizeEventAttribution(value) {
  if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).sort().join(",") !== "utm_campaign,utm_content,utm_medium,utm_source,version") return null;
  if (value.version !== 1 || value.utm_source !== "embaixadacarioca" || value.utm_medium !== "website" || value.utm_campaign !== "eventos" || !EVENT_CONTENTS.has(value.utm_content)) return null;
  return {version:1, utm_source:value.utm_source, utm_medium:value.utm_medium, utm_campaign:value.utm_campaign, utm_content:value.utm_content};
}
function readUrlAttribution(search = location.search) {
  const query = new URLSearchParams(search), names = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  if (names.some(name => query.getAll(name).length !== 1)) return null;
  return normalizeEventAttribution(Object.fromEntries([["version", 1], ...names.map(name => [name, query.get(name)])]));
}
function getEventAttribution() {
  const token = getCaptureToken();
  try {
    const saved = JSON.parse(readFormStorage(EVENT_ATTRIBUTION_KEY) || "null");
    const valid = normalizeEventAttribution(saved?.attribution);
    if (saved?.token === token && valid) {
      formStorageMemory[EVENT_ATTRIBUTION_KEY] = JSON.stringify({token, attribution:valid});
      return valid;
    }
  } catch (_) { /* Ignore corrupt or unrelated browser state. */ }
  const attribution = readUrlAttribution();
  if (attribution) {
    const serialized = JSON.stringify({token, attribution});
    formStorageMemory[EVENT_ATTRIBUTION_KEY] = serialized;
    try { if (localStorage.getItem(CAPTURE_TOKEN_KEY) === token) localStorage.setItem(EVENT_ATTRIBUTION_KEY, serialized); } catch (_) { /* Never overwrite a newer capture from an older tab. */ }
  }
  return attribution;
}

const preferenceChips = [...document.querySelectorAll("[data-preference-chip]")];
const extraChips = [...document.querySelectorAll("[data-extra-chip]")];
const selectedProfiles = new Set();
const uiState = { language: loadLanguage() };
const analyticsFormState = { started: false, submitted: false, lastStep: "eventDetails" };
const stepOrder = ["moment", "profile", "eventDetails", "contact", "recommendation", "briefing"];

const steps = {
  moment: document.querySelector("#momentStep"),
  profile: document.querySelector("#profileStep"),
  recommendation: document.querySelector("#recommendationStep"),
  eventDetails: document.querySelector("#eventDetailsStep"),
  briefing: document.querySelector("#briefingStep"),
  contact: document.querySelector("#contactStep"),
};

function getLeadAnalyticsProperties(snapshot = null) {
  const event = snapshot?.evento || {};
  const qualification = snapshot?.qualificacao || {};
  const analytics = window.EventAnalytics;
  return {
    surface: "public_form",
    language: snapshot?.cliente?.idioma || uiState.language,
    source: "formulario",
    client_type: qualification.tipoCliente || canonicalClientTypeLabels[fields.clientType.value] || "unknown",
    budget_range: qualification.faixaInvestimento || canonicalBudgetRangeLabels[fields.budgetRange.value] || "unknown",
    lead_source: qualification.origem || canonicalLeadSourceLabels[fields.leadSource.value] || "unknown",
    event_type: event.tipo || fields.eventType.value || "unknown",
    guests_bucket: analytics?.bucketGuests(event.convidados || fields.guests.value),
    duration_bucket: analytics?.bucketDuration(event.duracao || fields.duration.value),
    days_to_event_bucket: analytics?.bucketDaysToEvent(event.data || fields.date.value),
    date_flexibility: event.dataFlexivelStatus || canonicalFlexibilityLabels[fields.dateIsFlexible.value] || "unknown",
    event_timing: event.faixaHorario || canonicalTimeRangeLabels[fields.timeRange.value] || "unknown",
  };
}

function captureLeadAnalytics(eventName, properties = {}, options = {}, snapshot = null) {
  try {
    return Promise.resolve(window.EventAnalytics?.capture(eventName, { ...getLeadAnalyticsProperties(snapshot), ...properties }, options)).catch(() => false);
  } catch (_error) { return Promise.resolve(false); }
}

function applyConversionStepOrder() {
  const optional = document.querySelector("#personalizeOptions");
  const content = document.querySelector("#personalizeContent");
  if (!form || !optional || !content) return;
  ["eventDetails", "contact"].forEach((name, index) => {
    form.insertBefore(steps[name], optional);
    steps[name].querySelector(".section-heading > span").textContent = String(index + 1).padStart(2, "0");
  });
  ["moment", "profile", "recommendation", "briefing"].forEach((name) => content.append(steps[name]));
}

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

const copy = {
  pt: {
    progressLabel: (current, total) => `Pergunta ${current} de ${total} - Tempo estimado 2 minutos`,
    uxCues: ["Escolha por cards", "Sugerimos formatos", "Leva cerca de 2 minutos"],
    trustPoints: ["Morro da Urca", "Parque Bondinho Pão de Açúcar", "Empresas, agências e eventos privados", "Proposta em até 2 dias úteis"],
    heroEyebrow: "Embaixada Carioca",
    heroTitle: "Planeje seu evento na Embaixada Carioca",
    heroSubtitle: "Encontre o melhor formato para o seu evento no Morro da Urca.",
    introEyebrow: "Consultoria de eventos",
    introTitle: "Seu evento começa aqui",
    introBody: "Informe a data, o grupo e seu contato. O formato pode ser definido com a equipe.",
    stepLabels: ["Quando", "Ocasião", "Data e grupo", "Contato", "Formato", "Preferências"],
    commercialSummary: "Ver janelas mais indicadas",
    commercialWindows: [
      "Manhã de 2ª a 6ª: café da manhã, brunch e coffee break.",
      "Início do almoço de 2ª a 6ª: Almoço Carioca.",
      "Após 17h de domingo a 5ª: welcome drink e coquetéis.",
      "Das 19h às 21h: encontros elegantes, leves e objetivos.",
    ],
    momentOptions: [
      {
        value: "weekday-morning",
        title: "Manhã em dia de semana",
        description:
          "Café da manhã com vista para o Pão de Açúcar muda o clima de reuniões e ativações.",
      },
      {
        value: "weekday-lunch",
        title: "Início do almoço",
        description:
          "Uma pausa carioca com feijoada premiada, chegada leve e tempo de mesa bem aproveitado.",
      },
      {
        value: "late-afternoon",
        title: "Fim de tarde",
        description:
          "Imagine seu grupo chegando ao Morro da Urca com a luz dourada do fim de tarde.",
      },
      {
        value: "night",
        title: "Noite (19h-21h)",
        description:
          "Um encontro elegante e objetivo, com o Rio como cenário e serviço no ritmo certo.",
      },
      {
        value: "evaluating",
        title: "Quero ajuda para escolher",
        description:
          "Conte o contexto e sugerimos o melhor caminho.",
      },
    ],
    clientTypes: [
      {
        value: "agency-tourism",
        title: "Agência de turismo receptivo / DMC",
        description: "Grupos turísticos, roteiros, operadores e experiências no Rio.",
      },
      {
        value: "agency-marketing",
        title: "Agência de marketing / eventos",
        description: "Ativações, produção, relacionamento, lançamentos e brand experience.",
      },
      {
        value: "company",
        title: "Empresa",
        description: "RH, marketing, diretoria ou relacionamento.",
      },
      {
        value: "person",
        title: "Pessoa física",
        description: "Celebrações, aniversários e encontros privados.",
      },
    ],
    profiles: [
      { value: "corporate", label: "Reunião / encontro corporativo", icon: "01" },
      { value: "celebration", label: "Confraternização", icon: "02" },
      { value: "birthday", label: "Aniversário / celebração", icon: "03" },
      { value: "relationship", label: "Lançamento / relacionamento com clientes", icon: "04" },
      { value: "experience", label: "Experiência gastronômica", icon: "05" },
      { value: "travel", label: "Grupo turístico / receptivo", icon: "06" },
      { value: "suggestion", label: "Me ajudem a definir", icon: "07" },
    ],
    profileSupport: "Diga quem organiza e marque a ocasião. Pode escolher mais de uma opção.",
    occasionSupport: "Ocasião do evento · escolha pelo menos uma opção. Se não souber, use “Me ajudem a definir”.",
    recommendationTitle: "Experiências mais indicadas",
    recommendationEmpty: "Escolha o momento e o perfil para ver as sugestões. A equipe também pode ajustar depois.",
    recommendationReady: (moment) => `Selecionamos uma sugestão inicial para ${moment.toLowerCase()}. Se outra experiência fizer mais sentido, pode trocar sem problema.`,
    labels: {
      eventDate: "Data desejada",
      eventDateHelp: "Se ainda não houver data fechada, conte a janela aproximada abaixo.",
      dateFlex: "Se não tiver data fechada",
      dateFlexible: "A data pode mudar?",
      guests: "Quantidade de convidados",
      guestsHelp: "Use o slider até 99+. Para grupos maiores, digite o número exato até 500.",
      period: "Período desejado",
      time: "Horário de chegada",
      timeHelp: "O horário combinado orienta a reserva e a operação.",
      duration: "Duração estimada",
      briefingSupport: "Marque só o que for importante. Se não tiver certeza, deixe em branco; a equipe completa com você depois.",
      reason: "Motivo do evento",
      preferences: "Preferências de alimentos e bebidas",
      notes: "Há algo importante que devemos considerar para montar sua proposta?",
      budget: "Faixa de investimento (Opcional)",
      leadSource: "Como conheceu a Embaixada? (Opcional)",
      name: "Nome completo",
      nameHelp: "Use nome e sobrenome. Ex.: Marina Costa.",
      email: "E-mail",
      emailHelp: "Usaremos para enviar a proposta.",
      phone: "Celular/WhatsApp",
      phoneHelp: "Informe o DDD e o celular. Se for um número internacional, inclua o código do país.",
      company: "Empresa ou agência",
      companyHelpOptional: "Opcional para pessoa física.",
      companyHelpRequired: "Recomendado para empresa e agência. Ajuda a equipe a localizar e priorizar seu pedido.",
      endClient: "Cliente final",
      endClientHelp: "Recomendado para agências. Ex.: marca, empresa contratante ou família atendida.",
      groupName: "Nome do grupo",
      groupNameHelp: "Para turismo receptivo/DMC. Ajuda a localizar grupos e roteiros.",
      contactIntroTitle: "Como prefere que a equipe fale com você?",
      contactIntroBody:
        "Informe seu nome e pelo menos um canal de contato. O restante pode ser completado depois.",
      contactRequirementNote:
        "Nome + e-mail ou WhatsApp já são suficientes para salvar seu pedido. Empresa, cliente final e grupo ajudam a equipe a responder mais rápido.",
      contactPromise: "Nossa equipe responde em até 2 dias úteis com uma proposta sob medida.",
      contactAssurance: "Sem compromisso. Usamos seus dados só para a proposta do evento. Ao informar nome e e-mail ou telefone, o que já foi preenchido fica salvo, mesmo sem envio.",
      privacyPolicyLink: "Política de privacidade",
      defaultStatus: "Seu pedido será analisado pela equipe de eventos da Embaixada Carioca.",
      finalReviewEyebrow: "Revisão final",
      finalReviewTitle: "Veja o que a equipe vai receber",
      finalReviewBody: "Confira os pontos principais. Se algo precisar mudar, toque em “Ajustar” no card.",
      submit: "Enviar solicitação de proposta",
      preferenceLegend: "O que não pode faltar?",
      extrasLegend: "Extras de produção",
    },
    placeholders: {
      dateFlex: "Ex.: primeira quinzena de agosto…",
      reason: "Ex.: comemorar 10 anos da empresa, premiar a equipe de vendas, receber clientes especiais…",
      preferences: "Conte estilos, bebidas preferidas ou restrições que a equipe deve considerar…",
      notes: "Qualquer detalhe ajuda: acessibilidade, surpresa para convidados, necessidades técnicas, perfil do grupo…",
      name: "Ex.: Marina Costa…",
      email: "Ex.: marina@empresa.com.br…",
      phone: "Ex.: +55 21 99999-9999",
      company: "Ex.: Grupo Atlântico Eventos…",
      endClient: "Ex.: L'Oréal Brasil…",
      groupName: "Ex.: Incentivo México 2026…",
    },
    select: {
      dateFlexible: ["Selecione", "Sim", "Não", "Ainda avaliando"],
      period: ["Selecione", "Manhã", "Tarde", "Noite"],
      duration: ["A definir", "1h", "1h30", "2h", "2h30", "3h", "3h30", "4h"],
      budget: ["Selecione", "Até R$ 15 mil", "R$ 15 mil a R$ 30 mil", "R$ 30 mil a R$ 60 mil", "Acima de R$ 60 mil", "Ainda não definido"],
      leadSource: ["Selecione", "Indicação", "Google / Instagram", "Agência / parceiro", "Já conheço o restaurante", "Parque Bondinho", "Outro"],
      timePlaceholder: "Selecione o período",
    },
    guestOutput: (value) => (value >= 100 ? "99+ pessoas" : `${value} ${value === 1 ? "pessoa" : "pessoas"}`),
    messages: {
      submitting: "Enviando solicitação…",
      successTitle: "Solicitação enviada. Obrigado!",
      successBody: (referenceCode) => `Sua referência é ${referenceCode}. A equipe de eventos responde em até 2 dias úteis.`,
      successContact: "Se quiser acrescentar algo, fale com eventos@embaixadacarioca.com.br ou 21 97142-6007.",
      loadError: "Não foi possível carregar a conexão. Tente novamente em instantes.",
      submitError: "Não foi possível enviar. Confira os dados e tente novamente.",
      missingFields: (fieldsList) => `Falta completar: ${fieldsList}. Ajuste esses pontos e envie novamente.`,
      fixThisPointTitle: "Ajuste este ponto para continuar:",
      fixThisPointFooter: "Depois de corrigir, clique em Enviar solicitação de proposta.",
      missingRequired: "Faltam momento, ocasião, formato, período e contato para seguirmos.",
      missingDate: "Informe uma data ou janela aproximada para avaliarmos disponibilidade.",
      requiredName: "Para seguir, conte seu nome completo. Ex.: Marina Costa.",
      invalidEmail: "Revise o e-mail para a proposta chegar no endereço certo.",
      invalidPhone: "Revise o celular/WhatsApp com DDD. Se for internacional, inclua o país.",
      requiredPhone: "Para seguir, precisamos de um celular/WhatsApp para o retorno da equipe.",
      requiredCompany: "Para empresa ou agência, informe também o nome da organização.",
      requiredEndClient: "Para agência, informe também o cliente final.",
      invalidEndClient: "Use um nome claro para o cliente final. Ex.: L'Oréal Brasil ou Família Almeida.",
      invalidGroupName: "Se souber o grupo, escreva um nome fácil de localizar. Ex.: Incentivo México 2026.",
      invalidName: "Informe nome e sobrenome. Ex.: Marina Costa.",
      invalidCompany: "Vale informar o nome completo da empresa ou agência. Ex.: Grupo Atlântico Eventos.",
      submitTemporary: "Não foi possível enviar agora. Tente novamente em instantes ou fale com eventos@embaixadacarioca.com.br.",
    },
  },
  en: {
    progressLabel: (current, total) => `Question ${current} of ${total} - Estimated time 2 minutes`,
    uxCues: ["Choose with cards", "We suggest formats", "Takes about 2 minutes"],
    trustPoints: ["Morro da Urca", "Sugarloaf Cable Car Park", "Companies, agencies and private events", "Proposal within 2 business days"],
    heroEyebrow: "Embaixada Carioca",
    heroTitle: "Plan your event at Embaixada Carioca",
    heroSubtitle: "Find the best format for your event at Morro da Urca.",
    introEyebrow: "Event advisory",
    introTitle: "Your event starts here",
    introBody: "Share your date, group size and contact. Our team can help you choose the format.",
    stepLabels: ["When", "Occasion", "Date & group", "Contact", "Format", "Preferences"],
    commercialSummary: "See the most recommended windows",
    commercialWindows: [
      "Weekday mornings: breakfast, brunch and coffee break.",
      "Start of lunch on weekdays: Carioca Lunch.",
      "After 5pm from Sunday to Thursday: welcome drink and cocktails.",
      "From 7pm to 9pm: elegant, light and objective gatherings.",
    ],
    momentOptions: [
      {
        value: "weekday-morning",
        title: "Weekday morning",
        description:
          "Breakfast with a Sugarloaf view changes the tone of meetings and activations.",
      },
      {
        value: "weekday-lunch",
        title: "Lunch opening",
        description:
          "A relaxed Carioca lunch with award-winning feijoada, a smooth arrival and well-used table time.",
      },
      {
        value: "late-afternoon",
        title: "Late afternoon",
        description:
          "Imagine your group arriving at Morro da Urca in the golden late-afternoon light.",
      },
      {
        value: "night",
        title: "Evening (7pm-9pm)",
        description:
          "An elegant and objective gathering, with Rio as the backdrop and service at the right rhythm.",
      },
      {
        value: "evaluating",
        title: "I want help choosing",
        description:
          "Share the context and we will suggest the best path.",
      },
    ],
    clientTypes: [
      {
        value: "agency-tourism",
        title: "Inbound tourism agency / DMC",
        description: "Tour groups, itineraries, operators and Rio-based experiences.",
      },
      {
        value: "agency-marketing",
        title: "Marketing / events agency",
        description: "Activations, production, relationship events, launches and brand experience.",
      },
      {
        value: "company",
        title: "Company",
        description: "HR, marketing, leadership or client relations.",
      },
      {
        value: "person",
        title: "Private client",
        description: "Celebrations, birthdays and private gatherings.",
      },
    ],
    profiles: [
      { value: "corporate", label: "Corporate meeting / gathering", icon: "01" },
      { value: "celebration", label: "Celebration / team gathering", icon: "02" },
      { value: "birthday", label: "Birthday / celebration", icon: "03" },
      { value: "relationship", label: "Launch / client relationship event", icon: "04" },
      { value: "experience", label: "Gastronomic experience", icon: "05" },
      { value: "travel", label: "Tourism / receptive group", icon: "06" },
      { value: "suggestion", label: "Help me define it", icon: "07" },
    ],
    profileSupport: "Tell us who is organizing and choose the occasion. You may select more than one.",
    occasionSupport: "Event occasion · choose at least one option. If unsure, choose “Help me define it”.",
    recommendationTitle: "Best experiences for your event",
    recommendationEmpty: "Choose the moment and profile to see suggestions. Our team can still adjust it later.",
    recommendationReady: (moment) => `We selected an initial suggestion for ${moment.toLowerCase()}. If another experience feels better, you can change it anytime.`,
    labels: {
      eventDate: "Preferred date",
      eventDateHelp: "If the date is not set yet, share an approximate window below.",
      dateFlex: "If the date is not set",
      dateFlexible: "Can the date move?",
      guests: "Guest count",
      guestsHelp: "Use the slider up to 99+. For larger groups, type the exact number up to 500.",
      period: "Preferred period",
      time: "Arrival time",
      timeHelp: "The agreed time guides the reservation and operation.",
      duration: "Estimated duration",
      briefingSupport: "Select only what matters. If you are unsure, leave it blank; our team can complete it with you later.",
      reason: "Event goal",
      preferences: "Food and beverage preferences",
      notes: "Is there anything important we should consider when preparing your proposal?",
      budget: "Budget range (Optional)",
      leadSource: "How did you hear about Embaixada? (Optional)",
      name: "Full name",
      nameHelp: "Please include first and last name. Example: Marina Costa.",
      email: "E-mail",
      emailHelp: "We will use it to send your proposal.",
      phone: "Phone/WhatsApp",
      phoneHelp: "Enter the area code and phone number. For international numbers, include the country code.",
      company: "Company or agency",
      companyHelpOptional: "Optional for private celebrations.",
      companyHelpRequired: "Recommended for companies and agencies. It helps our team identify and prioritize the request.",
      endClient: "Final client",
      endClientHelp: "Recommended for agencies. Example: brand, contracting company or family served.",
      groupName: "Group name",
      groupNameHelp: "For receptive tourism/DMC. It helps us identify groups and itineraries.",
      contactIntroTitle: "How should our team reach you?",
      contactIntroBody:
        "Tell us your name and at least one contact channel. You can complete the rest later.",
      contactRequirementNote:
        "Name plus e-mail or WhatsApp is enough to send your request. Company, final client and group help our team reply faster.",
      contactPromise: "Our team replies within 2 business days with a tailored proposal.",
      contactAssurance: "No commitment. We use your details only for your event proposal. Once you enter your name and email or phone, what you have filled in is saved, even if you don't submit.",
      privacyPolicyLink: "Privacy policy (in Portuguese)",
      defaultStatus: "Your request will be reviewed by the Embaixada Carioca events team.",
      finalReviewEyebrow: "Final review",
      finalReviewTitle: "See what our team will receive",
      finalReviewBody: "Review the key points. If anything needs to change, tap “Adjust” on the card.",
      submit: "Send proposal request",
      preferenceLegend: "What cannot be missing?",
      extrasLegend: "Production extras",
    },
    placeholders: {
      dateFlex: "Ex.: first half of August…",
      reason: "Ex.: celebrate the company's 10th anniversary, reward the sales team, host special guests…",
      preferences: "Share styles, preferred drinks or dietary restrictions the team should consider…",
      notes: "Any detail helps: accessibility, guest surprise, technical needs, group profile…",
      name: "Ex.: Marina Costa…",
      email: "Ex.: name@company.com…",
      phone: "Ex.: +1 305 555 0100",
      company: "Ex.: Atlantic Events Group…",
      endClient: "Ex.: L'Oréal Brazil…",
      groupName: "Ex.: Mexico incentive 2026…",
    },
    select: {
      dateFlexible: ["Select", "Yes", "No", "Still evaluating"],
      period: ["Select", "Morning", "Afternoon", "Evening"],
      duration: ["To be defined", "1h", "1h30", "2h", "2h30", "3h", "3h30", "4h"],
      budget: ["Select", "Up to BRL 15k", "BRL 15k to 30k", "BRL 30k to 60k", "Above BRL 60k", "Not defined yet"],
      leadSource: ["Select", "Referral", "Google / Instagram", "Agency / partner", "I already know the restaurant", "Cable Car Park", "Other"],
      timePlaceholder: "Select the period",
    },
    guestOutput: (value) => (value >= 100 ? "99+ guests" : `${value} ${value === 1 ? "guest" : "guests"}`),
    messages: {
      submitting: "Sending request…",
      successTitle: "Request sent. Thank you!",
      successBody: (referenceCode) => `Your reference is ${referenceCode}. Our events team replies within 2 business days.`,
      successContact: "If you would like to add anything, contact eventos@embaixadacarioca.com.br or +55 21 97142-6007.",
      loadError: "We could not load the connection. Please try again in a moment.",
      submitError: "We could not send your request. Please review the information and try again.",
      missingFields: (fieldsList) => `Please complete: ${fieldsList}. Review these items and send again.`,
      fixThisPointTitle: "Please adjust this item to continue:",
      fixThisPointFooter: "After correcting it, click Send proposal request.",
      missingRequired: "We only need the moment, occasion, format, period and contact details to move forward.",
      missingDate: "Please provide a preferred date or approximate window.",
      requiredName: "Please share your full name so we can prepare the proposal properly. Example: Marina Costa.",
      invalidEmail: "Please review the e-mail address so the proposal reaches the right inbox.",
      invalidPhone: "Please review the phone/WhatsApp number. Include country code if international.",
      requiredPhone: "Please share a phone/WhatsApp number so our team can reply.",
      requiredCompany: "For company or agency requests, include the organization name.",
      requiredEndClient: "For agency requests, please also share the final client.",
      invalidEndClient: "Use a clear final client name. Example: L'Oréal Brazil or Almeida Family.",
      invalidGroupName: "If you know the group name, make it easy to find. Example: Mexico incentive 2026.",
      invalidName: "Please share first and last name. Example: Marina Costa.",
      invalidCompany: "Please share the full company or agency name. Example: Atlantic Events Group.",
      submitTemporary: "We could not send your request right now. Please try again in a moment or contact eventos@embaixadacarioca.com.br.",
    },
  },
};

copy.es = {
    progressLabel: (current, total) => `Pregunta ${current} de ${total} - Tiempo estimado: 2 minutos`,
    uxCues: ["Elige con tarjetas", "Te sugerimos formatos", "Toma unos 2 minutos"],
    trustPoints: ["Morro da Urca", "Parque Bondinho Pão de Açúcar", "Empresas, agencias y eventos privados", "Propuesta en un plazo de 2 días hábiles"],
    heroEyebrow: "Embaixada Carioca",
    heroTitle: "Organiza tu evento en Embaixada Carioca",
    heroSubtitle: "Encuentra el mejor formato para tu evento en Morro da Urca.",
    introEyebrow: "Asesoría para eventos",
    introTitle: "Tu evento empieza aquí",
    introBody: "Indica la fecha, el tamaño del grupo y tus datos de contacto. Nuestro equipo puede ayudarte a elegir el formato.",
    stepLabels: ["Cuándo", "Ocasión", "Fecha y grupo", "Contacto", "Formato", "Preferencias"],
    commercialSummary: "Ver los horarios más recomendados",
    commercialWindows: [
      "Mañanas de lunes a viernes: desayuno, brunch y pausa para café.",
      "Inicio del almuerzo de lunes a viernes: Almuerzo Carioca.",
      "Después de las 17:00, de domingo a jueves: bebida de bienvenida y cócteles.",
      "De 19:00 a 21:00: encuentros elegantes, ligeros y centrados en lo esencial.",
    ],
    momentOptions: [
      {
        value: "weekday-morning",
        title: "Mañana entre semana",
        description:
          "Un desayuno con vistas al Pan de Azúcar transforma el ambiente de reuniones y activaciones.",
      },
      {
        value: "weekday-lunch",
        title: "Inicio del almuerzo",
        description:
          "Un almuerzo carioca relajado con feijoada premiada, una llegada tranquila y tiempo de calidad en la mesa.",
      },
      {
        value: "late-afternoon",
        title: "Últimas horas de la tarde",
        description:
          "Imagina a tu grupo llegando a Morro da Urca con la luz dorada del atardecer.",
      },
      {
        value: "night",
        title: "Noche (19:00-21:00)",
        description:
          "Un encuentro elegante y centrado en lo esencial, con Río como escenario y un servicio al ritmo adecuado.",
      },
      {
        value: "evaluating",
        title: "Quiero ayuda para elegir",
        description:
          "Cuéntanos el contexto y te sugeriremos la mejor opción.",
      },
    ],
    clientTypes: [
      {
        value: "agency-tourism",
        title: "Agencia de turismo receptivo / DMC",
        description: "Grupos turísticos, itinerarios, operadores y experiencias en Río.",
      },
      {
        value: "agency-marketing",
        title: "Agencia de marketing / eventos",
        description: "Activaciones, producción, relaciones con clientes, lanzamientos y experiencias de marca.",
      },
      {
        value: "company",
        title: "Empresa",
        description: "Recursos humanos, marketing, dirección o relaciones con clientes.",
      },
      {
        value: "person",
        title: "Particular",
        description: "Celebraciones, cumpleaños y encuentros privados.",
      },
    ],
    profiles: [
      { value: "corporate", label: "Reunión / encuentro corporativo", icon: "01" },
      { value: "celebration", label: "Celebración / encuentro de equipo", icon: "02" },
      { value: "birthday", label: "Cumpleaños / celebración", icon: "03" },
      { value: "relationship", label: "Lanzamiento / encuentro con clientes", icon: "04" },
      { value: "experience", label: "Experiencia gastronómica", icon: "05" },
      { value: "travel", label: "Grupo turístico / receptivo", icon: "06" },
      { value: "suggestion", label: "Ayúdenme a definirlo", icon: "07" },
    ],
    profileSupport: "Indica quién organiza y elige la ocasión. Puedes seleccionar más de una opción.",
    occasionSupport: "Ocasión del evento · elige al menos una opción. Si tienes dudas, selecciona “Ayúdenme a definirlo”.",
    recommendationTitle: "Experiencias más recomendadas para tu evento",
    recommendationEmpty: "Elige el momento y el perfil para ver las sugerencias. Nuestro equipo también puede ajustarlo después.",
    recommendationReady: (moment) => `Seleccionamos una sugerencia inicial para ${moment.toLowerCase()}. Si otra experiencia te convence más, puedes cambiarla sin problema.`,
    labels: {
      eventDate: "Fecha deseada",
      eventDateHelp: "Si aún no tienes una fecha definida, indica un período aproximado a continuación.",
      dateFlex: "Si no tienes una fecha definida",
      dateFlexible: "¿La fecha puede cambiar?",
      guests: "Cantidad de invitados",
      guestsHelp: "Usa el control deslizante hasta 99+. Para grupos más grandes, escribe la cantidad exacta hasta 500.",
      period: "Franja horaria deseada",
      time: "Hora de llegada",
      timeHelp: "La hora acordada orienta la reserva y la organización.",
      duration: "Duración estimada",
      briefingSupport: "Marca solo lo que sea importante. Si tienes dudas, déjalo en blanco; nuestro equipo puede completarlo contigo después.",
      reason: "Motivo del evento",
      preferences: "Preferencias de comida y bebida",
      notes: "¿Hay algo importante que debamos tener en cuenta al preparar tu propuesta?",
      budget: "Presupuesto aproximado (opcional)",
      leadSource: "¿Cómo conociste Embaixada? (opcional)",
      name: "Nombre completo",
      nameHelp: "Indica tu nombre y apellido. Ejemplo: Marina Costa.",
      email: "Correo electrónico",
      emailHelp: "Lo usaremos para enviarte la propuesta.",
      phone: "Teléfono/WhatsApp",
      phoneHelp: "Indica el código de área y el teléfono. Para números internacionales, incluye el código del país.",
      company: "Empresa o agencia",
      companyHelpOptional: "Opcional para particulares.",
      companyHelpRequired: "Recomendado para empresas y agencias. Ayuda a nuestro equipo a identificar y priorizar la solicitud.",
      endClient: "Cliente final",
      endClientHelp: "Recomendado para agencias. Ejemplo: marca, empresa contratante o familia atendida.",
      groupName: "Nombre del grupo",
      groupNameHelp: "Para turismo receptivo/DMC. Nos ayuda a identificar grupos e itinerarios.",
      contactIntroTitle: "¿Cómo podemos contactarte?",
      contactIntroBody:
        "Indica tu nombre y al menos un medio de contacto. Puedes completar el resto después.",
      contactRequirementNote:
        "Tu nombre y un correo electrónico o WhatsApp bastan para enviar la solicitud. La empresa, el cliente final y el grupo ayudan a nuestro equipo a responder más rápido.",
      contactPromise: "Nuestro equipo responde en un plazo de 2 días hábiles con una propuesta personalizada.",
      contactAssurance: "Sin compromiso. Usamos tus datos solo para la propuesta de tu evento. Cuando introduces tu nombre y correo electrónico o teléfono, la información que has completado se guarda, aunque no envíes el formulario.",
      privacyPolicyLink: "Política de privacidad (en portugués)",
      defaultStatus: "El equipo de eventos de Embaixada Carioca revisará tu solicitud.",
      finalReviewEyebrow: "Revisión final",
      finalReviewTitle: "Revisa lo que recibirá nuestro equipo",
      finalReviewBody: "Revisa los puntos principales. Si necesitas cambiar algo, pulsa “Ajustar” en la tarjeta.",
      submit: "Enviar solicitud de propuesta",
      preferenceLegend: "¿Qué no puede faltar?",
      extrasLegend: "Extras de producción",
    },
    placeholders: {
      dateFlex: "Ej.: primera quincena de agosto…",
      reason: "Ej.: celebrar el décimo aniversario de la empresa, premiar al equipo de ventas, recibir invitados especiales…",
      preferences: "Indica estilos, bebidas preferidas o restricciones alimentarias que el equipo deba tener en cuenta…",
      notes: "Cualquier detalle ayuda: accesibilidad, una sorpresa para los invitados, necesidades técnicas, perfil del grupo…",
      name: "Ej.: Marina Costa…",
      email: "Ej.: nombre@empresa.com…",
      phone: "Ej.: +1 305 555 0100",
      company: "Ej.: Atlantic Events Group…",
      endClient: "Ej.: L'Oréal Brazil…",
      groupName: "Ej.: incentivo México 2026…",
    },
    select: {
      dateFlexible: ["Selecciona", "Sí", "No", "Aún lo estoy evaluando"],
      period: ["Selecciona", "Mañana", "Tarde", "Noche"],
      duration: ["Por definir", "1h", "1h30", "2h", "2h30", "3h", "3h30", "4h"],
      budget: ["Selecciona", "Hasta 15 mil BRL", "De 15 mil a 30 mil BRL", "De 30 mil a 60 mil BRL", "Más de 60 mil BRL", "Aún no definido"],
      leadSource: ["Selecciona", "Recomendación", "Google / Instagram", "Agencia / colaborador", "Ya conozco el restaurante", "Parque Bondinho", "Otro"],
      timePlaceholder: "Selecciona la franja horaria",
    },
    guestOutput: (value) => (value >= 100 ? "99+ invitados" : `${value} ${value === 1 ? "invitado" : "invitados"}`),
    messages: {
      submitting: "Enviando solicitud…",
      successTitle: "Solicitud enviada. ¡Gracias!",
      successBody: (referenceCode) => `Tu referencia es ${referenceCode}. Nuestro equipo de eventos responde en un plazo de 2 días hábiles.`,
      successContact: "Si quieres añadir algo, contacta a eventos@embaixadacarioca.com.br o al +55 21 97142-6007.",
      loadError: "No pudimos establecer la conexión. Inténtalo de nuevo en unos instantes.",
      submitError: "No pudimos enviar tu solicitud. Revisa los datos e inténtalo de nuevo.",
      missingFields: (fieldsList) => `Completa: ${fieldsList}. Revisa estos puntos y vuelve a enviar la solicitud.`,
      fixThisPointTitle: "Corrige este punto para continuar:",
      fixThisPointFooter: "Después de corregirlo, pulsa Enviar solicitud de propuesta.",
      missingRequired: "Solo necesitamos el momento, la ocasión, el formato, la franja horaria y los datos de contacto para continuar.",
      missingDate: "Indica una fecha deseada o un período aproximado.",
      requiredName: "Indica tu nombre completo para que podamos preparar bien la propuesta. Ejemplo: Marina Costa.",
      invalidEmail: "Revisa el correo electrónico para que la propuesta llegue al destinatario correcto.",
      invalidPhone: "Revisa el teléfono/WhatsApp. Incluye el código del país si es internacional.",
      requiredPhone: "Indica un teléfono/WhatsApp para que nuestro equipo pueda responder.",
      requiredCompany: "Para solicitudes de empresas o agencias, incluye el nombre de la organización.",
      requiredEndClient: "Para solicitudes de agencias, indica también el cliente final.",
      invalidEndClient: "Indica claramente el nombre del cliente final. Ejemplo: L'Oréal Brazil o familia Almeida.",
      invalidGroupName: "Si conoces el nombre del grupo, usa uno fácil de identificar. Ejemplo: incentivo México 2026.",
      invalidName: "Indica tu nombre y apellido. Ejemplo: Marina Costa.",
      invalidCompany: "Indica el nombre completo de la empresa o agencia. Ejemplo: Atlantic Events Group.",
      submitTemporary: "No pudimos enviar tu solicitud en este momento. Inténtalo de nuevo en unos instantes o contacta a eventos@embaixadacarioca.com.br.",
    },
  };

chipLabelSets.es = {
    preference: {
      "open-bar": "Barra libre",
      "tasting-menu": "Menú degustación",
      "welcome-drink": "Bebida de bienvenida",
      "vegetarian-options": "Opciones vegetarianas",
      "dietary-restrictions": "Restricciones alimentarias",
      "interactive-experience": "Experiencia interactiva",
    },
    extra: {
      dj: "DJ",
      "jazz-trio": "Trío de jazz/bossa nova",
      photo: "Fotografía",
      video: "Video",
      tv: "TV",
      "sound-mic": "Sonido con micrófono",
      "ambient-sound": "Sonido ambiental",
      decor: "Decoración",
      banners: "Banners",
    },
  };

const formatCopies = {};
formatCopies.es = {
  "recommendation": {
    "label": "Quiero la recomendación del equipo",
    "description": "Nuestro equipo sugerirá el mejor formato según el horario, el grupo y el objetivo.",
    "badge": "Asesoramiento",
    "visual": "A medida",
    "group": "Cualquier grupo"
  },
  "breakfast": {
    "label": "Desayuno / Brunch",
    "description": "Perfecto para reuniones matinales, activaciones y recepciones más ligeras.",
    "badge": "Ideal para la mañana",
    "visual": "Mañana",
    "group": "A partir de 30 personas"
  },
  "coffee": {
    "label": "Pausa para café",
    "description": "Ideal para pausas corporativas y eventos breves con un servicio práctico.",
    "badge": "Muy solicitado por empresas",
    "visual": "Pausa",
    "group": "A partir de 30 personas"
  },
  "lunch": {
    "label": "Almuerzo Carioca",
    "description": "Un formato para el inicio del almuerzo entre semana, con feijoada premiada y bebidas.",
    "badge": "Nuevo de lunes a viernes",
    "visual": "Carioca",
    "group": "A partir de 2 personas"
  },
  "welcome": {
    "label": "Bebida de bienvenida",
    "description": "Una recepción elegante para grupos que quieren empezar el evento con impacto.",
    "badge": "Ideal para el final de la tarde",
    "visual": "Bienvenida",
    "group": "A partir de 20 personas"
  },
  "cocktail": {
    "label": "Cóctel",
    "description": "Ideal para networking, lanzamientos, celebraciones y encuentros sociales.",
    "badge": "Excelente opción de 19:00 a 21:00",
    "visual": "Cóctel",
    "group": "A partir de 20 personas"
  },
  "workshop": {
    "label": "Taller de caipiriña",
    "description": "Una experiencia interactiva y memorable para grupos que buscan algo diferente.",
    "badge": "Experiencia interactiva",
    "visual": "Experiencia",
    "group": "A partir de 8 personas"
  },
  "custom": {
    "label": "Evento a medida",
    "description": "Para necesidades personalizadas, itinerarios de agencias y propuestas institucionales.",
    "badge": "Consultar",
    "visual": "A medida",
    "group": "Consultar"
  }
};

function getDisplayFormat(id) { return getFormatDefinition(id); }
function getDisplayFormatLabel(label) { const id=Object.keys(formats).find(key=>formats[key].label===label); return id ? getDisplayFormat(id).label : label; }

const spanishDynamicText = {
  "Recommended": "Recomendado",
  "Select": "Seleccionar",
  "Access history": "Acceder al historial",
  "Access sent. Open the link in your e-mail to see your history.": "Acceso enviado. Abre el enlace de tu correo electrónico para ver tu historial.",
  "Adjust": "Ajustar",
  "All set": "Todo listo",
  "Already know your date and group size?": "¿Ya sabes la fecha y el tamaño del grupo?",
  "Booking": "Reserva",
  "Budget and referral (optional)": "Presupuesto y cómo nos conociste (opcional)",
  "Check the remaining payment with the events team.": "Coordina el pago pendiente con el equipo de eventos.",
  "Come back without filling everything out again": "Vuelve sin tener que completarlo todo de nuevo",
  "Complete your name and at least e-mail or WhatsApp so our team can reply.": "Completa tu nombre y al menos un correo electrónico o WhatsApp para que nuestro equipo pueda responder.",
  "Contact": "Contacto",
  "Date and arrival": "Fecha y llegada",
  "Date to define": "Fecha por definir",
  "Deposit received. The team will confirm the remaining details.": "Anticipo recibido. El equipo confirmará los detalles pendientes.",
  "Enter a valid e-mail.": "Introduce un correo electrónico válido.",
  "Essentials first · About 2 minutes": "Lo esencial primero · Unos 2 minutos",
  "Event": "Evento",
  "Event approaching. Keep the day-of contact available.": "Tu evento se acerca. Mantén disponible el contacto para ese día.",
  "Event completed. You can reuse it as a starting point.": "Evento realizado. Puedes reutilizarlo como punto de partida.",
  "Event details": "Detalles del evento",
  "Event format": "Formato del evento",
  "Event preferences": "Preferencias del evento",
  "Event progress": "Progreso del evento",
  "Explore formats, occasions and preferences.": "Explora formatos, ocasiones y preferencias.",
  "Extras": "Extras",
  "Final client": "Cliente final",
  "Go to essentials": "Ir a lo esencial",
  "Group": "Grupo",
  "Guests and duration": "Invitados y duración",
  "Have you held an event or received a proposal from us?": "¿Ya celebraste un evento o recibiste una propuesta nuestra?",
  "History is temporarily unavailable. You can continue with the form.": "El historial no está disponible temporalmente. Puedes continuar con el formulario.",
  "I have the essentials. Go to contact": "Ya tengo lo esencial. Ir a contacto",
  "Loading your history...": "Cargando tu historial...",
  "Needs completion": "Falta completar",
  "New event": "Nuevo evento",
  "Next": "Próximo",
  "Next step": "Siguiente paso",
  "No must-have preference selected. That is fine if there is nothing essential.": "No has marcado ninguna preferencia imprescindible. No hay problema si no tienes ninguna.",
  "No previous events or proposals were found for this e-mail. You can continue with the form normally.": "No encontramos eventos ni propuestas anteriores para este correo electrónico. Puedes continuar con el formulario normalmente.",
  "Open and continue": "Abrir y continuar",
  "Opening your proposal...": "Abriendo tu propuesta...",
  "Operation": "Operación",
  "Optional": "Opcional",
  "Our team can suggest the best format if you prefer.": "Nuestro equipo puede sugerirte el mejor formato si lo prefieres.",
  "Personalize": "Personalizar",
  "Personalize your event (optional)": "Personaliza tu evento (opcional)",
  "Preferences": "Preferencias",
  "Previous event loaded. Confirm the new date and adjust only what changed.": "Evento anterior cargado. Confirma la nueva fecha y ajusta solo lo que haya cambiado.",
  "Proposal": "Propuesta",
  "Repeat this event": "Repetir este evento",
  "Reply contact": "Contacto para la respuesta",
  "Request": "Solicitud",
  "Request saved. You can continue without starting over.": "Solicitud guardada. Puedes continuar sin empezar de nuevo.",
  "Review the proposal and approve or request a change.": "Revisa la propuesta y apruébala o solicita un cambio.",
  "Secure access ended on this device.": "La sesión se ha cerrado de forma segura en este dispositivo.",
  "Secure client area": "Área segura del cliente",
  "Send access link": "Recibir enlace de acceso",
  "Send the essentials now. Our team can help choose the format later.": "Envía lo esencial ahora. Nuestro equipo puede ayudarte a elegir el formato después.",
  "Sending secure access...": "Enviando acceso seguro...",
  "Share an e-mail or WhatsApp so our team can reply.": "Indica un correo electrónico o WhatsApp para que nuestro equipo pueda responder.",
  "Sign out": "Cerrar sesión de forma segura",
  "Talk to our team": "Hablar con el equipo",
  "The events team will guide the next step.": "El equipo de eventos te orientará sobre el siguiente paso.",
  "The team is reviewing your requested changes.": "El equipo está revisando los cambios que solicitaste.",
  "This request is closed. Start a new event whenever you wish.": "Esta solicitud está cerrada. Inicia un nuevo evento cuando quieras.",
  "To be defined": "Por definir",
  "Use the same e-mail as before to resume a proposal or repeat an event in a few steps.": "Usa el mismo correo electrónico de antes para retomar una propuesta o repetir un evento en pocos pasos.",
  "We could not reopen this proposal. Continue below and we will prepare a new version.": "No pudimos volver a abrir esta propuesta. Continúa abajo y prepararemos una nueva versión.",
  "We could not send the access e-mail. Try again shortly.": "No pudimos enviar el correo de acceso. Inténtalo de nuevo en unos instantes.",
  "Who and occasion": "Quién organiza y ocasión",
  "Who is organizing and what is the occasion?": "¿Quién organiza y cuál es la ocasión?",
  "Who is organizing has not been selected yet": "Aún no se ha seleccionado quién organiza",
  "Worth completing": "Conviene completar",
  "Your e-mail": "Tu correo electrónico",
  "Your event is in operational planning.": "Tu evento está en planificación operativa.",
  "Your events in one place": "Tus eventos en un solo lugar",
  "active": "en curso",
  "arrival time not selected yet": "hora de llegada aún no seleccionada",
  "guests": "invitados",
  "occasion not selected yet": "ocasión aún no seleccionada"
};
function translateEnglish(text) { return uiState.language === "es" ? (spanishDynamicText[text] || text) : text; }
function localizedText(english, portuguese) { return uiState.language === "pt" ? portuguese : translateEnglish(english); }
const formAriaLabels = {
  "Idioma do formulário": {
    "en": "Form language",
    "es": "Idioma del formulario"
  },
  "Credenciais": {
    "en": "Credentials",
    "es": "Credenciales"
  },
  "Formulário de solicitação": {
    "en": "Request form",
    "es": "Formulario de solicitud"
  },
  "Etapas do pedido": {
    "en": "Request steps",
    "es": "Pasos de la solicitud"
  },
  "Progresso do formulário": {
    "en": "Form progress",
    "es": "Progreso del formulario"
  },
  "Como funciona": {
    "en": "How it works",
    "es": "Cómo funciona"
  },
  "Caminho rápido": {
    "en": "Quick path",
    "es": "Acceso rápido"
  },
  "Momento do evento": {
    "en": "Event timing",
    "es": "Momento del evento"
  },
  "Tipo de cliente": {
    "en": "Client type",
    "es": "Tipo de cliente"
  },
  "Ocasião do evento": {
    "en": "Event occasion",
    "es": "Ocasión del evento"
  },
  "Escolha rápida de convidados": {
    "en": "Quick guest selection",
    "es": "Selección rápida de invitados"
  }
};
function applyLocalizedAria() {
  document.querySelectorAll("[aria-label]").forEach(node=>{
    const original=node.dataset.formAriaKey || node.getAttribute("aria-label");
    if (!formAriaLabels[original]) return;
    node.dataset.formAriaKey=original;
    node.setAttribute("aria-label", formAriaLabels[original][uiState.language] || original);
  });
}

function loadLanguage() {
  const query = new URLSearchParams(location.search);
  if (query.has("lang")) return query.getAll("lang").length === 1 && ["pt","en","es"].includes(query.get("lang")) ? query.get("lang") : "pt";
  const saved = readFormStorage(LANGUAGE_KEY);
  return ["pt","en","es"].includes(saved) ? saved : "pt";
}

function getCopy() {
  return copy[uiState.language] || copy.pt;
}

function applyChipLabels() {
  const labels = chipLabelSets[uiState.language] || chipLabelSets.pt;

  preferenceChips.forEach((chip) => {
    const key = chip.dataset.chipKey;
    const textNode = chip.parentElement?.querySelector("span");
    if (!key || !textNode) return;
    textNode.textContent = labels.preference[key] || textNode.textContent;
  });

  extraChips.forEach((chip) => {
    const key = chip.dataset.chipKey;
    const textNode = chip.parentElement?.querySelector("span");
    if (!key || !textNode) return;
    textNode.textContent = labels.extra[key] || textNode.textContent;
  });
}

function getFormatDefinition(id, language = uiState.language) {
  const definitions = {
    recommendation: {
      pt: { label: "Quero recomendação da equipe", description: "A equipe indica o melhor formato considerando horário, grupo e objetivo.", badge: "Consultivo", visual: "Sob medida", group: "Qualquer grupo" },
      en: { label: "I want the team's recommendation", description: "Our team will suggest the best format considering timing, group and objective.", badge: "Consultative", visual: "Tailored", group: "Any group" },
    },
    breakfast: {
      pt: { label: "Café da Manhã / Brunch", description: "Perfeito para encontros matinais, reuniões, ativações e recepções mais leves.", badge: "Mais indicado para manhã", visual: "Manhã", group: "A partir de 30 pessoas" },
      en: { label: "Breakfast / Brunch", description: "Perfect for morning meetings, activations and lighter receptions.", badge: "Best for mornings", visual: "Morning", group: "From 30 guests" },
    },
    coffee: {
      pt: { label: "Coffee Break", description: "Ideal para pausas corporativas e eventos curtos com praticidade.", badge: "Muito pedido por grupos corporativos", visual: "Pausa", group: "A partir de 30 pessoas" },
      en: { label: "Coffee Break", description: "Ideal for corporate breaks and short events with practical service.", badge: "Very popular with companies", visual: "Break", group: "From 30 guests" },
    },
    lunch: {
      pt: { label: "Almoço Carioca", description: "Formato para início do almoço em dias úteis, com feijoada premiada e bebidas.", badge: "Novo para 2ª a 6ª", visual: "Carioca", group: "A partir de 2 pessoas" },
      en: { label: "Carioca Lunch", description: "A weekday lunch-start format with award-winning feijoada and beverages.", badge: "New for weekdays", visual: "Carioca", group: "From 2 guests" },
    },
    welcome: {
      pt: { label: "Welcome Drink", description: "Recepção elegante para grupos que querem começar o evento com impacto.", badge: "Ideal para fim de tarde", visual: "Recepção", group: "A partir de 20 pessoas" },
      en: { label: "Welcome Drink", description: "An elegant reception for groups that want to start the event with impact.", badge: "Ideal for late afternoon", visual: "Welcome", group: "From 20 guests" },
    },
    cocktail: {
      pt: { label: "Coquetel", description: "Ótimo para confraternizações, networking, lançamentos e celebrações.", badge: "Ótima opção para 19h-21h", visual: "Coquetel", group: "A partir de 20 pessoas" },
      en: { label: "Cocktail Reception", description: "Great for networking, launches, celebrations and social gatherings.", badge: "Great for 7pm-9pm", visual: "Cocktail", group: "From 20 guests" },
    },
    workshop: {
      pt: { label: "Workshop de Caipirinha", description: "Experiência interativa e memorável para grupos que buscam algo diferente.", badge: "Experiência interativa", visual: "Experiência", group: "A partir de 8 pessoas" },
      en: { label: "Caipirinha Workshop", description: "An interactive and memorable experience for groups looking for something different.", badge: "Interactive experience", visual: "Experience", group: "From 8 guests" },
    },
    custom: {
      pt: { label: "Evento sob medida", description: "Para demandas personalizadas, roteiros de agências e propostas institucionais.", badge: "Sob consulta", visual: "Especial", group: "Sob consulta" },
      en: { label: "Tailored Event", description: "For customized demands, agency itineraries and institutional proposals.", badge: "By consultation", visual: "Tailored", group: "On request" },
    },
  };
  return formatCopies[language]?.[id] || definitions[id]?.[language] || definitions[id]?.pt;
}

function renderChoiceButtons(container, items, groupName) {
  if (!container) return;
  container.innerHTML = items
    .map((item) => {
      const selected =
        groupName === "profile"
          ? selectedProfiles.has(item.value)
          : fields[groupName]?.value === item.value;
      return `
        <button type="button" data-choice-group="${groupName}" data-choice-value="${item.value}" class="${selected ? "is-selected" : ""}">
          ${item.icon ? `<span class="profile-icon">${item.icon}</span>` : ""}
          <strong>${item.title || item.label}</strong>
          ${item.description ? `<span>${item.description}</span>` : ""}
        </button>
      `;
    })
    .join("");
}

function applyStaticCopy() {
  const current = getCopy();
  document.documentElement.lang = uiState.language === "pt" ? "pt-BR" : uiState.language;
  document.title = `${current.heroTitle} | Embaixada Carioca`;
  document.querySelector("#heroEyebrow").textContent = current.heroEyebrow;
  document.querySelector("#heroTitle").textContent = current.heroTitle;
  document.querySelector("#heroSubtitle").textContent = current.heroSubtitle;
  current.trustPoints.forEach((text, index) => {
    const node = document.querySelector(`#trustPoint${index + 1}`);
    if (node) node.textContent = text;
  });
  document.querySelector("#introEyebrow").textContent = current.introEyebrow;
  document.querySelector("#introTitle").textContent = current.introTitle;
  document.querySelector("#introBody").textContent = current.introBody;
  current.stepLabels.forEach((text, index) => {
    const node = document.querySelector(`#stepLabel${index + 1}`);
    if (node) node.textContent = text;
  });
  current.uxCues.forEach((text, index) => {
    const node = document.querySelector(`#uxCue${index + 1}`);
    if (node) node.textContent = text;
  });
  document.querySelector("#commercialWindowsSummary").textContent = current.commercialSummary;
  current.commercialWindows.forEach((text, index) => {
    const node = document.querySelector(`#commercialWindow${index + 1}`);
    if (node) node.textContent = text;
  });
  document.querySelector("#profileSupport").textContent = current.profileSupport;
  document.querySelector("#occasionSupport").textContent = current.occasionSupport;
  document.querySelector("#recommendationTitle").textContent = current.recommendationTitle;
  document.querySelector("#eventDateLabel").textContent = current.labels.eventDate;
  document.querySelector("#eventDateHelp").textContent = current.labels.eventDateHelp;
  document.querySelector("#dateFlexLabel").textContent = current.labels.dateFlex;
  document.querySelector("#dateFlexibleLabel").textContent = current.labels.dateFlexible;
  document.querySelector("#guestCountLabel").textContent = current.labels.guests;
  document.querySelector("#guestCountHelp").textContent = current.labels.guestsHelp;
  document.querySelector("#timeRangeLabel").textContent = current.labels.period;
  document.querySelector("#eventTimeLabel").textContent = current.labels.time;
  document.querySelector("#eventTimeHelp").textContent = current.labels.timeHelp;
  document.querySelector("#durationLabel").textContent = current.labels.duration;
  document.querySelector("#briefingSupport").textContent = current.labels.briefingSupport;
  document.querySelector("#reasonLabel").textContent = current.labels.reason;
  document.querySelector("#preferencesLabel").textContent = current.labels.preferences;
  document.querySelector("#notesLabel").textContent = current.labels.notes;
  document.querySelector("#budgetLabel").textContent = current.labels.budget;
  document.querySelector("#leadSourceLabel").textContent = current.labels.leadSource;
  document.querySelector("#nameLabel").textContent = current.labels.name;
  if (nameHelp) nameHelp.textContent = current.labels.nameHelp;
  document.querySelector("#emailLabel").textContent = current.labels.email;
  document.querySelector("#emailHelp").textContent = current.labels.emailHelp;
  document.querySelector("#phoneLabel").textContent = current.labels.phone;
  document.querySelector("#phoneHelp").textContent = current.labels.phoneHelp;
  document.querySelector("#companyLabel").textContent = current.labels.company;
  document.querySelector("#endClientLabel").textContent = current.labels.endClient;
  document.querySelector("#groupNameLabel").textContent = current.labels.groupName;
  if (contactIntroTitle) contactIntroTitle.textContent = current.labels.contactIntroTitle;
  if (contactIntroBody) contactIntroBody.textContent = current.labels.contactIntroBody;
  if (contactRequirementNote) contactRequirementNote.textContent = current.labels.contactRequirementNote;
  document.querySelector("#contactPromise").textContent = current.labels.contactPromise;
  document.querySelector("#contactAssurance").textContent = current.labels.contactAssurance;
  const privacyPolicyLink = document.querySelector("#privacyPolicyLink");
  if (privacyPolicyLink && current.labels.privacyPolicyLink) privacyPolicyLink.textContent = current.labels.privacyPolicyLink;
  document.querySelector("#finalReviewEyebrow").textContent = current.labels.finalReviewEyebrow;
  document.querySelector("#finalReviewTitle").textContent = current.labels.finalReviewTitle;
  document.querySelector("#finalReviewBody").textContent = current.labels.finalReviewBody;
  submitButton.textContent = current.labels.submit;
  if (!statusNode.dataset.status || statusNode.dataset.status === "neutral") {
    statusNode.textContent = current.labels.defaultStatus;
  }
  document.querySelector("#requestReason").placeholder = current.placeholders.reason;
  fields.dateFlex.placeholder = current.placeholders.dateFlex;
  fields.preferences.placeholder = current.placeholders.preferences;
  fields.notes.placeholder = current.placeholders.notes;
  fields.name.placeholder = current.placeholders.name;
  fields.email.placeholder = current.placeholders.email;
  fields.phone.placeholder = current.placeholders.phone;
  fields.company.placeholder = current.placeholders.company;
  fields.endClientName.placeholder = current.placeholders.endClient;
  fields.groupName.placeholder = current.placeholders.groupName;
  updateContactRequirements();
  updateContactGuidance();
  document.querySelector("#briefingTitle").textContent = localizedText("Event preferences", "Preferências do evento");
  document.querySelector("#contactTitle").textContent = current.stepLabels[3];
  document.querySelector("#momentTitle").textContent = current.stepLabels[0] === "When" ? "When are you imagining your event?" : "Quando você imagina seu evento?";
  document.querySelector("#profileTitle").textContent = localizedText("Who is organizing and what is the occasion?", "Quem está organizando e qual é a ocasião?");
  document.querySelector("#eventDetailsTitle").textContent = localizedText("Event details", "Detalhes do evento");
  document.querySelector(".preference-chips legend").textContent = current.labels.preferenceLegend;
  document.querySelectorAll(".preference-chips legend")[1].textContent = current.labels.extrasLegend;
  applyChipLabels();
  current.select.dateFlexible.forEach((text, index) => {
    if (fields.dateIsFlexible.options[index]) fields.dateIsFlexible.options[index].text = text;
  });
  current.select.period.forEach((text, index) => {
    if (fields.timeRange.options[index]) fields.timeRange.options[index].text = text;
  });
  current.select.duration.forEach((text, index) => {
    if (fields.duration.options[index]) fields.duration.options[index].text = text;
  });
  current.select.budget.forEach((text, index) => {
    if (fields.budgetRange.options[index]) fields.budgetRange.options[index].text = text;
  });
  current.select.leadSource.forEach((text, index) => {
    if (fields.leadSource.options[index]) fields.leadSource.options[index].text = text;
  });
  updateProgress(stepOrder.find((step, index) => progressSteps[index]?.hasAttribute("data-active")) || "eventDetails");
}

function renderLocalizedChoices() {
  const current = getCopy();
  renderChoiceButtons(document.querySelector("#momentChoices"), current.momentOptions, "moment");
  renderChoiceButtons(document.querySelector("#clientTypeChoices"), current.clientTypes, "clientType");
  renderChoiceButtons(document.querySelector("#profileChoices"), current.profiles, "profile");
}

function setLanguage(language) {
  uiState.language = ["pt", "en", "es"].includes(language) ? language : "pt";
  writeFormStorage(LANGUAGE_KEY, uiState.language);
  const shortcutCopy = uiState.language !== "pt"
    ? ["Already know your date and group size?", "Send the essentials now. Our team can help choose the format later.", "Go to essentials", "Talk to our team"]
    : ["Já sabe a data e o tamanho do grupo?", "Envie o essencial agora. A equipe ajuda a definir o formato depois.", "Ir ao essencial", "Falar com a equipe"];
  ["quickPathTitle", "quickPathDescription", "quickPathLink", "quickHumanLink"].forEach((id, index) => {
    const node = document.querySelector(`#${id}`);
    if (node) node.textContent = translateEnglish(shortcutCopy[index]);
  });
  const quickContact = document.querySelector("#quickContactLink");
  if (quickContact) quickContact.textContent = localizedText("I have the essentials. Go to contact", "Já tenho o essencial. Ir para contato");
  langButtons.forEach((button) => {
    const active = button.dataset.lang === uiState.language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  renderLocalizedChoices();
  applyStaticCopy();
  applyLocalizedAria();
  const compactCopy = uiState.language !== "pt"
    ? { formContactNav: "Contact", formPersonalizeNav: "Personalize", personalizeTitle: "Personalize your event (optional)", personalizeDescription: "Explore formats, occasions and preferences.", contactOptionalSummary: "Budget and referral (optional)" }
    : { formContactNav: "Contato", formPersonalizeNav: "Personalizar", personalizeTitle: "Personalize seu evento (opcional)", personalizeDescription: "Explore formatos, ocasião e preferências.", contactOptionalSummary: "Investimento e origem (opcional)" };
  Object.entries(compactCopy).forEach(([id, text]) => { document.getElementById(id).textContent = translateEnglish(text); });
  fillTimeOptions();
  renderRecommendations();
  updateGuestOutput();
  renderFinalReview();
  renderReturningClientCopy();
  if (statusNode.dataset.status === "error" && statusNode.querySelector("ul")) {
    setStatus(getCopy().labels.defaultStatus, "neutral");
    validateSnapshot(getSnapshot(getOrCreateReferenceCode()));
  }
}

function setStatus(message, type = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.status = type;
}

function setStatusChecklist(title, items, footer = "") {
  const cleanItems = items.filter(Boolean);
  statusNode.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <ul>
      ${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
    ${footer ? `<span>${escapeHtml(footer)}</span>` : ""}
  `;
  statusNode.dataset.status = "error";
}

function resetStatusIfError() {
  if (statusNode.dataset.status === "error") {
    setStatus(getCopy().labels.defaultStatus, "neutral");
  }
}

function updateProgress(stepName = "eventDetails") {
  const current = getCopy();
  const index = Math.max(0, stepOrder.indexOf(stepName));
  const percent = ((index + 1) / stepOrder.length) * 100;
  if (progressText) progressText.textContent = localizedText("Essentials first · About 2 minutes", "O essencial primeiro · Cerca de 2 minutos");
  if (progressBar) progressBar.style.width = `${percent}%`;
  progressSteps.forEach((step, stepIndex) => {
    step.toggleAttribute("data-active", stepIndex === index);
    step.toggleAttribute("data-complete", stepIndex < index);
  });
}

function getPublicSupabaseClient() {
  if (!publicSupabaseClient && window.supabase?.createClient) {
    publicSupabaseClient = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
      auth: {
        storageKey: "embaixada_public_client_auth_v1",
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return publicSupabaseClient;
}

function getCaptureToken() {
  let token = readFormStorage(CAPTURE_TOKEN_KEY) || "";
  if (!token) {
    token = window.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)}`;
    writeFormStorage(CAPTURE_TOKEN_KEY, token);
  }
  formStorageMemory[CAPTURE_TOKEN_KEY] = token;
  return token;
}

function getOrCreateReferenceCode() {
  let reference = readFormStorage(REFERENCE_CODE_KEY) || "";
  if (!reference) {
    reference = createReferenceCode();
    writeFormStorage(REFERENCE_CODE_KEY, reference);
  }
  formStorageMemory[REFERENCE_CODE_KEY] = reference;
  return reference;
}

function initializeCaptureIdentity() {
  getCaptureToken();
  getOrCreateReferenceCode();
  getEventAttribution();
}

function resetCaptureIdentity() {
  const completedToken = formStorageMemory[CAPTURE_TOKEN_KEY];
  try {
    if (completedToken && localStorage.getItem(CAPTURE_TOKEN_KEY) === completedToken) {
      localStorage.removeItem(EVENT_ATTRIBUTION_KEY);
      localStorage.removeItem(REFERENCE_CODE_KEY);
      localStorage.removeItem(CAPTURE_TOKEN_KEY);
    }
  } catch (_) { /* Clear this tab even when shared storage is unavailable. */ }
  for (const key of [EVENT_ATTRIBUTION_KEY, CAPTURE_TOKEN_KEY, REFERENCE_CODE_KEY]) formStorageMemory[key] = null;
  if (partialCaptureTimer) window.clearTimeout(partialCaptureTimer);
  partialCaptureTimer = null;
}

function getPartialCaptureStatusNode() {
  let node = document.querySelector("#partialCaptureStatus");
  if (node) return node;
  node = document.createElement("p");
  node.id = "partialCaptureStatus";
  node.className = "partial-capture-status";
  const reassurance = document.querySelector(".contact-reassurance");
  reassurance?.prepend(node);
  return node;
}

function canCapturePartialLead() {
  const name = fields.name.value.trim();
  const email = fields.email.value.trim();
  const phone = fields.phone.value.trim();
  if (!hasUsableName(name)) return false;
  return (email && isValidEmail(email)) || (phone && isValidContactPhone(phone));
}

function getCurrentProgressStep() {
  const index = progressSteps.findIndex((step) => step.hasAttribute("data-active"));
  return stepOrder[Math.max(0, index)] || "contact";
}

async function savePartialLead() {
  if (!canCapturePartialLead()) return;
  const client = getPublicSupabaseClient();
  if (!client) return;
  const snapshot = getSnapshot(getOrCreateReferenceCode());
  const node = getPartialCaptureStatusNode();
  try {
    const { error } = await client.rpc("upsert_public_quote_draft", {
      p_capture_token: getCaptureToken(),
      p_snapshot: snapshot,
      p_last_step: getCurrentProgressStep(),
    });
    if (error) {
      if (!/function|42883|schema cache/i.test(String(error.message || error.code || ""))) {
        console.warn("Falha ao salvar lead parcial.", error);
      }
      return;
    }
    if (node) node.textContent = localizedText("Request saved. You can continue without starting over.", "Pedido salvo. Você pode continuar sem começar de novo.");
  } catch (error) {
    console.warn("Falha silenciosa na captura parcial.", error);
  }
}

function schedulePartialCapture() {
  if (!canCapturePartialLead()) return;
  if (partialCaptureTimer) window.clearTimeout(partialCaptureTimer);
  partialCaptureTimer = window.setTimeout(savePartialLead, 1000);
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
  const current = getCopy();
  statusNode.dataset.status = "success";
  statusNode.innerHTML = `
    <strong>${current.messages.successTitle}</strong>
    <span>${current.messages.successBody(`<b>${referenceCode}</b>`)}</span>
    <span>${current.messages.successContact.replace("eventos@embaixadacarioca.com.br", `<a href="mailto:eventos@embaixadacarioca.com.br">eventos@embaixadacarioca.com.br</a>`).replace("21 97142-6007", `<a href="https://wa.me/5521971426007" target="_blank" rel="noopener">21 97142-6007</a>`).replace("+55 21 97142-6007", `<a href="https://wa.me/5521971426007" target="_blank" rel="noopener">+55 21 97142-6007</a>`)}</span>
  `;
  window.requestAnimationFrame(() => {
    statusNode.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function fillGuestOptions() {
  fields.guests.value = "30";
  if (fields.guestSlider) fields.guestSlider.value = "30";
  if (fields.dateIsFlexible) fields.dateIsFlexible.value = "no";
  updateGuestOutput("number");
}

function resetFlexibleDateField() {
  if (!fields.dateIsFlexible) return;
  fields.dateIsFlexible.value = "no";
}

function updateGuestOutput(source = "number") {
  const current = getCopy();
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

  const outputLabel = current.guestOutput(guests);
  fields.guestOutput.textContent = outputLabel;
  renderFinalReview();
}

function getSelectedDurationLabel() {
  return fields.duration.selectedOptions?.[0]?.textContent?.trim() || getCopy().select.duration[1];
}

function formatReviewDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function renderFinalReview() {
  if (!finalReviewGrid) return;
  const current = getCopy();
  const pendingLabel = localizedText("To be defined", "A definir");
  const isEn = uiState.language === "en";
  const reviewCopy = {
    ok: localizedText("All set", "Tudo certo"),
    warning: localizedText("Worth completing", "Vale completar"),
    required: localizedText("Needs completion", "Precisa completar"),
    optional: localizedText("Optional", "Opcional"),
    edit: localizedText("Adjust", "Ajustar"),
    formatMissing: localizedText("Our team can suggest the best format if you prefer.", "A equipe pode sugerir o melhor formato, se você preferir."),
    clientMissing: localizedText("Who is organizing has not been selected yet", "Quem organiza ainda não foi selecionado"),
    occasionMissing: localizedText("occasion not selected yet", "ocasião ainda não escolhida"),
    timeMissing: localizedText("arrival time not selected yet", "horário ainda não escolhido"),
    preferenceEmpty: localizedText("No must-have preference selected. That is fine if there is nothing essential.", "Nenhuma preferência indispensável marcada. Tudo bem se não houver."),
    contactMissing: localizedText("Complete your name and at least e-mail or WhatsApp so our team can reply.", "Complete seu nome e pelo menos e-mail ou WhatsApp para a equipe retornar."),
    contactFallback: current.labels.defaultStatus,
  };
  const selectedPreferences = getSelectedChipDisplayLabels(preferenceChips, "preference");
  const selectedExtras = getSelectedChipDisplayLabels(extraChips, "extra");
  if (fields.preferences.value.trim()) selectedPreferences.push(fields.preferences.value.trim());
  const preferenceSummary = [
    selectedPreferences.length
      ? selectedPreferences.join(", ")
      : reviewCopy.preferenceEmpty,
    selectedExtras.length ? `${localizedText("Extras", "Extras")}: ${selectedExtras.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const contactParts = [
    fields.name.value.trim(),
    fields.company.value.trim(),
    fields.endClientName.value.trim() ? `${localizedText("Final client", "Cliente final")}: ${fields.endClientName.value.trim()}` : "",
    fields.groupName.value.trim() ? `${localizedText("Group", "Grupo")}: ${fields.groupName.value.trim()}` : "",
    fields.email.value.trim(),
    fields.phone.value.trim(),
  ].filter(Boolean);
  const contactReady = hasUsableName(fields.name.value.trim()) && Boolean((fields.email.value.trim() && isValidEmail(fields.email.value.trim())) || (fields.phone.value.trim() && isValidContactPhone(fields.phone.value.trim()))) && (!fields.email.value.trim() || isValidEmail(fields.email.value.trim())) && (!fields.phone.value.trim() || isValidContactPhone(fields.phone.value.trim()));
  const dateReady = fields.date.value || fields.dateFlex.value.trim();
  const timeReady = fields.time.value;
  const clientTypeLabel = getClientTypeDisplayLabel();
  const profileLabel = getSelectedProfileDisplayLabels().join(", ");
  const items = [
    {
      label: localizedText("Event format", "Formato do evento"),
      value: getDisplayFormatLabel(fields.eventType.value) || reviewCopy.formatMissing,
      step: "recommendation",
      status: fields.eventType.value ? reviewCopy.ok : reviewCopy.warning,
      state: fields.eventType.value ? "is-ok" : "is-warning",
    },
    {
      label: localizedText("Who and occasion", "Quem organiza e ocasião"),
      value: [
        clientTypeLabel || reviewCopy.clientMissing,
        profileLabel || reviewCopy.occasionMissing,
      ].join(" · "),
      step: "profile",
      status: clientTypeLabel && profileLabel ? reviewCopy.ok : reviewCopy.optional,
      state: clientTypeLabel && profileLabel ? "is-ok" : "is-optional",
    },
    {
      label: localizedText("Date and arrival", "Data e chegada"),
      value: [
        formatReviewDate(fields.date.value) || fields.dateFlex.value.trim() || pendingLabel,
        fields.time.value || reviewCopy.timeMissing,
      ].join(" · "),
      step: "eventDetails",
      status: dateReady && timeReady ? reviewCopy.ok : dateReady ? reviewCopy.warning : reviewCopy.required,
      state: dateReady && timeReady ? "is-ok" : dateReady ? "is-warning" : "is-required",
    },
    {
      label: localizedText("Guests and duration", "Convidados e duração"),
      value: `${fields.guests.value || 30} ${localizedText("guests", "pessoas")} · ${getSelectedDurationLabel()}`,
      step: "eventDetails",
      status: fields.duration.value ? reviewCopy.ok : reviewCopy.warning,
      state: fields.duration.value ? "is-ok" : "is-warning",
    },
    {
      label: localizedText("Preferences", "Preferências"),
      value: preferenceSummary,
      step: "briefing",
      status: selectedPreferences.length || selectedExtras.length ? reviewCopy.ok : reviewCopy.optional,
      state: selectedPreferences.length || selectedExtras.length ? "is-ok" : "is-optional",
    },
    {
      label: localizedText("Reply contact", "Contato para retorno"),
      value: contactReady ? contactParts.join(" · ") : [contactParts.join(" · "), reviewCopy.contactMissing].filter(Boolean).join(" · "),
      step: "contact",
      status: contactReady ? reviewCopy.ok : reviewCopy.required,
      state: contactReady ? "is-ok" : "is-required",
    },
  ];

  finalReviewGrid.innerHTML = items
    .map(
      (item) => `
        <button type="button" class="final-review-item ${item.state}" data-review-step="${item.step}" aria-label="${escapeHtml(`${item.label}: ${item.value}. ${reviewCopy.edit}`)}">
          <span class="final-review-status">${item.status}</span>
          <span class="final-review-label">${item.label}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${reviewCopy.edit}</small>
        </button>
      `,
    )
    .join("");
}

function fillTimeOptions(range = fields.timeRange.value) {
  const current = getCopy();
  const times = timeOptionsByRange[range] || [];
  const previousTime = fields.time.value;
  const options = [`<option value="">${current.select.timePlaceholder}</option>`];
  times.forEach((time) => options.push(`<option value="${time}">${time.replace(":", "h")}</option>`));
  fields.time.innerHTML = options.join("");
  if (previousTime && times.includes(previousTime)) fields.time.value = previousTime;
}

function toNumber(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function formatPhoneInput(value) {
  const raw = String(value || "").trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  if (!digits) return hasPlus ? "+" : "";
  if (!hasPlus && digits.length <= 11) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length <= 2) return `+${digits}`;
  if (digits.length <= 5) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 10)} ${digits.slice(10)}`.trim();
}

function isValidContactPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function startsWithCapitalLetter(value) {
  const firstLetter = String(value || "").trim().match(/[A-Za-zÀ-ÿ]/);
  if (!firstLetter) return false;
  return firstLetter[0] === firstLetter[0].toUpperCase();
}

function isLikelyFullName(value) {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  if (trimmed.length < 7 || !startsWithCapitalLetter(trimmed)) return false;
  const words = trimmed.split(" ").filter((word) => word.length >= 2);
  return words.length >= 2;
}

function hasUsableName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").length >= 2;
}

function isCompanyRequired() {
  return Boolean(fields.clientType.value) && fields.clientType.value !== "person";
}

function isAgencyClient() {
  return String(fields.clientType.value || "").startsWith("agency");
}

function isTourismAgencyClient() {
  return fields.clientType.value === "agency-tourism";
}

function isLikelyCompanyName(value) {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  return trimmed.length >= 7 && startsWithCapitalLetter(trimmed);
}

function isLikelyFinalClientName(value) {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  return trimmed.length >= 4 && startsWithCapitalLetter(trimmed);
}

function isLikelyGroupName(value) {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  return trimmed.length >= 4;
}

function setHelperState(node, message, tone = "neutral") {
  if (!node) return;
  node.textContent = message;
  if (tone === "neutral") delete node.dataset.tone;
  else node.dataset.tone = tone;
}

function updateContactRequirements() {
  const current = getCopy();
  const companyRequired = isCompanyRequired();
  const agencyClient = isAgencyClient();
  const tourismAgency = isTourismAgencyClient();
  fields.company.required = false;
  fields.company.setAttribute("aria-required", "false");
  fields.endClientName.required = false;
  fields.endClientName.setAttribute("aria-required", "false");
  fields.groupName.required = false;
  fields.groupName.setAttribute("aria-required", "false");
  endClientField?.classList.toggle("is-hidden", !agencyClient);
  groupNameField?.classList.toggle("is-hidden", !tourismAgency);
  if (!agencyClient) {
    fields.endClientName.value = "";
    fields.groupName.value = "";
    setFieldValidity(fields.endClientName, true);
    setFieldValidity(fields.groupName, true);
  } else if (!tourismAgency) {
    fields.groupName.value = "";
    setFieldValidity(fields.groupName, true);
  }
  if (companyHelp) {
    setHelperState(
      companyHelp,
      companyRequired ? current.labels.companyHelpRequired : current.labels.companyHelpOptional,
      companyRequired ? "neutral" : "neutral",
    );
  }
  setHelperState(endClientHelp, current.labels.endClientHelp, agencyClient ? "neutral" : "neutral");
  setHelperState(groupNameHelp, current.labels.groupNameHelp, "neutral");
}

function updateContactGuidance() {
  const current = getCopy();
  const nameValue = fields.name.value.trim();
  const companyValue = fields.company.value.trim();
  const endClientValue = fields.endClientName.value.trim();
  const groupNameValue = fields.groupName.value.trim();

  if (!nameValue) {
    setHelperState(nameHelp, current.labels.nameHelp);
  } else if (!isLikelyFullName(nameValue)) {
    setHelperState(nameHelp, current.messages.invalidName, "warning");
  } else {
    setHelperState(nameHelp, current.labels.nameHelp, "success");
  }

  if (!isCompanyRequired()) {
    setHelperState(companyHelp, current.labels.companyHelpOptional);
    if (companyValue && !isLikelyCompanyName(companyValue)) {
      setHelperState(companyHelp, current.messages.invalidCompany, "warning");
    }
    return;
  }

  if (!companyValue) {
    setHelperState(companyHelp, current.labels.companyHelpRequired, "neutral");
  } else if (!isLikelyCompanyName(companyValue)) {
    setHelperState(companyHelp, current.messages.invalidCompany, "warning");
  } else {
    setHelperState(companyHelp, current.labels.companyHelpRequired, "success");
  }

  if (!isAgencyClient()) return;

  if (!endClientValue) {
    setHelperState(endClientHelp, current.labels.endClientHelp, "neutral");
  } else if (!isLikelyFinalClientName(endClientValue)) {
    setHelperState(endClientHelp, current.messages.invalidEndClient, "warning");
  } else {
    setHelperState(endClientHelp, current.labels.endClientHelp, "success");
  }

  if (isTourismAgencyClient()) {
    if (groupNameValue && !isLikelyGroupName(groupNameValue)) {
      setHelperState(groupNameHelp, current.messages.invalidGroupName, "warning");
    } else if (groupNameValue) {
      setHelperState(groupNameHelp, current.labels.groupNameHelp, "success");
    } else {
      setHelperState(groupNameHelp, current.labels.groupNameHelp, "neutral");
    }
  }
}

function setFieldValidity(field, isValid) {
  if (!field) return;
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
  const optional = step?.closest("details");
  if (optional) optional.open = true;
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
  return [...selectedProfiles].map((profile) => canonicalProfileLabels[profile]).filter(Boolean);
}

function getSelectedProfileDisplayLabels() {
  const current = getCopy();
  return [...selectedProfiles]
    .map((profile) => current.profiles.find((item) => item.value === profile)?.label || canonicalProfileLabels[profile])
    .filter(Boolean);
}

function getClientTypeDisplayLabel() {
  const current = getCopy();
  const selected = fields.clientType.value;
  return current.clientTypes.find((item) => item.value === selected)?.title || canonicalClientTypeLabels[selected] || "";
}

function getSelectedChipDisplayLabels(chips, kind) {
  return chips.filter(chip=>chip.checked).map(chip=>chipLabelSets[uiState.language]?.[kind]?.[chip.dataset.chipKey] || chip.value);
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
  return Object.keys({
    recommendation: true,
    breakfast: true,
    coffee: true,
    lunch: true,
    welcome: true,
    cocktail: true,
    workshop: true,
    custom: true,
  }).find((id) => ["pt", "en", "es"].some(language=>getFormatDefinition(id, language)?.label === label)) || "";
}

function renderRecommendations() {
  const current = getCopy();
  if (!fields.moment.value) {
    recommendationIntro.textContent = current.recommendationEmpty;
    recommendationList.innerHTML = `<div class="recommendation-empty">${current.recommendationEmpty}</div>`;
    return;
  }

  const ids = getRecommendedFormatIds();
  const selectedFormatId = getFormatIdByLabel(fields.eventType.value);
  // Keep an explicit choice even when exploring a different recommendation.
  const moment = current.momentOptions.find(item=>item.value===fields.moment.value)?.title || canonicalMomentLabels[fields.moment.value];
  recommendationIntro.textContent = current.recommendationReady(moment);
  recommendationList.innerHTML = ids
    .map((id, index) => {
      const item = getFormatDefinition(id);
      const selected = fields.eventType.value === formats[id].label;
      return `
        <button class="format-card ${selected ? "is-selected" : ""}" type="button" data-format-id="${id}">
          <span>${item.badge}</span>
          <i>${item.visual}</i>
          <strong>${item.label}</strong>
          <em>${item.description}</em>
          <small>${item.group}</small>
          <b>${index === 0 ? localizedText("Recommended", "Mais indicado") : localizedText("Select", "Selecionar")}</b>
        </button>
      `;
    })
    .join("");
}

function selectFormat(formatId) {
  const item = getFormatDefinition(formatId);
  if (!item) return;
  fields.eventType.value = formats[formatId].label;
  setStepValidity("recommendation", true);
  renderRecommendations();
  renderFinalReview();
  schedulePartialCapture();
  scrollToStep("briefing");
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

  if (choiceGroup === "clientType") {
    updateContactRequirements();
    updateContactGuidance();
  }

  resetStatusIfError();


  renderRecommendations();
  renderFinalReview();
  schedulePartialCapture();
  if (choiceGroup === "moment") scrollToStep("profile");
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
  const durationLabel = getSelectedDurationLabel();
  return {
    ...(getEventAttribution() ? {attribution: getEventAttribution()} : {}),
    referencia: referenceCode,
    cliente: {
      idioma: uiState.language,
      nome: fields.name.value.trim(),
      email: fields.email.value.trim(),
      whatsapp: fields.phone.value.trim(),
      empresa: fields.company.value.trim(),
      clienteFinal: fields.endClientName.value.trim(),
      nomeGrupo: fields.groupName.value.trim(),
      tipoCliente: canonicalClientTypeLabels[fields.clientType.value] || "",
    },
    evento: {
      momento: canonicalMomentLabels[fields.moment.value] || "",
      ocasiao: selectedOccasions,
      perfil: selectedOccasions,
      tipo: fields.eventType.value,
      data: fields.date.value,
      dataFlexivel: fields.dateFlex.value.trim(),
      dataFlexivelStatus: canonicalFlexibilityLabels[fields.dateIsFlexible.value] || "",
      faixaHorario: canonicalTimeRangeLabels[fields.timeRange.value] || "",
      horario: selectedTime,
      convidados: Math.min(500, Math.max(2, Math.floor(toNumber(fields.guests.value) || 30))),
      duracao: fields.duration.value ? toNumber(fields.duration.value) : null,
      duracaoTexto: durationLabel,
      motivo: fields.reason.value.trim(),
      preferencias: [selectedPreferences.length ? `Preferências marcadas: ${selectedPreferences.join(", ")}` : "", preferenceText]
        .filter(Boolean)
        .join("\n"),
      extras: selectedExtras.join(", "),
      observacoes: fields.notes.value.trim(),
    },
    qualificacao: {
      tipoCliente: canonicalClientTypeLabels[fields.clientType.value] || "",
      clienteFinal: fields.endClientName.value.trim(),
      nomeGrupo: fields.groupName.value.trim(),
      origem: canonicalLeadSourceLabels[fields.leadSource.value] || "",
      faixaInvestimento: canonicalBudgetRangeLabels[fields.budgetRange.value] || "",
    },
    origem: "formulario",
    enviadoEm: new Date().toISOString(),
  };
}

function applyLeadFallbacks(snapshot) {
  const inferredMoment = snapshot.evento.momento || canonicalMomentLabels[fields.moment.value] || "A definir";
  const inferredProfile = snapshot.evento.perfil || "A definir";
  const inferredClientType = snapshot.cliente.tipoCliente || "Cliente a classificar";
  const inferredEventType = snapshot.evento.tipo || "Evento sob medida";
  const inferredTimeRange = snapshot.evento.faixaHorario || "A definir";
  const inferredTime = snapshot.evento.horario || "A definir";

  snapshot.evento.momento = inferredMoment;
  snapshot.evento.perfil = inferredProfile;
  snapshot.evento.ocasiao = inferredProfile;
  snapshot.evento.tipo = inferredEventType;
  snapshot.evento.faixaHorario = inferredTimeRange;
  snapshot.evento.horario = inferredTime;
  snapshot.cliente.tipoCliente = inferredClientType;
  snapshot.qualificacao.tipoCliente = inferredClientType;
  snapshot.qualificacao.origem = snapshot.qualificacao.origem || "Não informado";
  snapshot.qualificacao.faixaInvestimento = snapshot.qualificacao.faixaInvestimento || "Ainda não definido";
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

function failValidation(field, stepName, message) {
  const current = getCopy();
  setStatusChecklist(current.messages.fixThisPointTitle || current.messages.submitError, [message], current.messages.fixThisPointFooter || "");
  setStepValidity(stepName, false);
  setFieldValidity(field, false);
  field?.focus();
  scrollToStep(stepName, true);
  return false;
}

function getFriendlySubmitError(error, current) {
  const raw = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").trim();
  if (!raw) return current.messages.submitError;
  if (/row-level security|permission denied|42501/i.test(raw)) return current.messages.submitTemporary;
  if (/notify-new-lead|functions\/v1|zeptomail|webhook|500/i.test(raw)) return current.messages.submitTemporary;
  if (/cliente_nome|nome_completo|null value/i.test(raw)) return current.messages.requiredName;
  if (/cliente_email|email/i.test(raw)) return current.messages.invalidEmail;
  if (/cliente_whatsapp|whatsapp|phone/i.test(raw)) return current.messages.invalidPhone;
  return current.messages.submitError;
}

function validateSnapshot(snapshot) {
  const current = getCopy();
  clearAllStepValidity();
  applyLeadFallbacks(snapshot);
  const hasEventDateOrWindow = Boolean(snapshot.evento.data || snapshot.evento.dataFlexivel);

  if (!hasEventDateOrWindow) {
    setStatusChecklist(current.messages.fixThisPointTitle || current.messages.submitError, [current.messages.missingDate], current.messages.fixThisPointFooter || "");
    setStepValidity("eventDetails", false);
    setFieldValidity(fields.date, false);
    setFieldValidity(fields.dateFlex, false);
    scrollToStep("eventDetails", true);
    return false;
  }

  if (!snapshot.cliente.nome) {
    return failValidation(fields.name, "contact", current.messages.requiredName);
  }

  if (!hasUsableName(snapshot.cliente.nome)) {
    return failValidation(fields.name, "contact", current.messages.invalidName);
  }

  const hasEmail = Boolean(snapshot.cliente.email);
  const hasPhone = Boolean(snapshot.cliente.whatsapp);
  if (!hasEmail && !hasPhone) {
    return failValidation(fields.email, "contact", localizedText("Share an e-mail or WhatsApp so our team can reply.", "Informe um e-mail ou WhatsApp para a equipe retornar."));
  }

  if (hasEmail && !isValidEmail(snapshot.cliente.email)) {
    setStatusChecklist(current.messages.fixThisPointTitle || current.messages.submitError, [current.messages.invalidEmail], current.messages.fixThisPointFooter || "");
    setStepValidity("contact", false);
    setFieldValidity(fields.email, false);
    fields.email.focus();
    scrollToStep("contact", true);
    return false;
  }

  if (hasPhone && !isValidContactPhone(snapshot.cliente.whatsapp)) {
    setStatusChecklist(current.messages.fixThisPointTitle || current.messages.submitError, [current.messages.invalidPhone], current.messages.fixThisPointFooter || "");
    setStepValidity("contact", false);
    setFieldValidity(fields.phone, false);
    fields.phone.focus();
    scrollToStep("contact", true);
    return false;
  }

  return true;
}

function getCanonicalKeyByLabel(map, label) {
  const normalized = String(label || "").trim().toLowerCase();
  return Object.entries(map).find(([, value]) => String(value || "").trim().toLowerCase() === normalized)?.[0] || "";
}

function renderReturningClientCopy() {
  const isEn = uiState.language === "en";
  const copyMap = {
    returningClientSummary: localizedText("Have you held an event or received a proposal from us?", "Já fez evento ou recebeu proposta conosco?"),
    returningClientSummaryAction: localizedText("Access history", "Acessar histórico"),
    returningClientTitle: localizedText("Come back without filling everything out again", "Volte sem preencher tudo de novo"),
    returningClientBody: localizedText("Use the same e-mail as before to resume a proposal or repeat an event in a few steps.", "Use o mesmo e-mail de antes para retomar uma proposta ou repetir um evento em poucos passos."),
    returningClientEmailLabel: localizedText("Your e-mail", "Seu e-mail"),
  };
  Object.entries(copyMap).forEach(([id, value]) => {
    const node = document.querySelector("#" + id);
    if (node) node.textContent = value;
  });
  const button = document.querySelector("#returningClientSendOtp");
  if (button) button.textContent = localizedText("Send access link", "Receber acesso por e-mail");
}

function getReturningStatusLabel(status) {
  const labels = {
    proposta_enviada: "Proposta enviada",
    negociacao: "Em negociação",
    confirmado: "Confirmado",
    pagamento_final: "Pagamento final",
    planejamento: "Planejamento",
    evento_proximo: "Evento próximo",
    pos_venda: "Evento realizado",
    cancelado: "Encerrado",
  };
  const translated = {"proposta_enviada": "Propuesta enviada", "negociacao": "En negociación", "confirmado": "Confirmado", "pagamento_final": "Pago final", "planejamento": "Planificación", "evento_proximo": "Evento próximo", "pos_venda": "Evento realizado", "cancelado": "Cerrado"};
  return (uiState.language === "es" ? translated[status] : labels[status]) || status || localizedText("Proposal", "Proposta");
}

function getReturningClientProgress(status) {
  const stages = [
    { id: "pedido", label: localizedText("Request", "Pedido") },
    { id: "proposta", label: localizedText("Proposal", "Proposta") },
    { id: "reserva", label: localizedText("Booking", "Reserva") },
    { id: "operacao", label: localizedText("Operation", "Operação") },
  ];
  const index = ["confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"].includes(status)
    ? (["planejamento", "evento_proximo", "pos_venda"].includes(status) ? 3 : 2)
    : ["proposta_enviada", "negociacao"].includes(status) ? 1 : 0;
  return { stages, index };
}

function getReturningClientNextStep(item) {
  const isEn = uiState.language === "en";
  const copy = {
    proposta_enviada: localizedText("Review the proposal and approve or request a change.", "Revise a proposta e aprove ou peça um ajuste."),
    negociacao: localizedText("The team is reviewing your requested changes.", "A equipe está tratando os ajustes solicitados."),
    confirmado: localizedText("Deposit received. The team will confirm the remaining details.", "Sinal recebido. A equipe confirmará os detalhes restantes."),
    pagamento_final: localizedText("Check the remaining payment with the events team.", "Alinhe o pagamento restante com a equipe de eventos."),
    planejamento: localizedText("Your event is in operational planning.", "Seu evento está em planejamento operacional."),
    evento_proximo: localizedText("Event approaching. Keep the day-of contact available.", "Evento próximo. Mantenha disponível o contato do dia."),
    pos_venda: localizedText("Event completed. You can reuse it as a starting point.", "Evento realizado. Você pode reutilizá-lo como ponto de partida."),
    cancelado: localizedText("This request is closed. Start a new event whenever you wish.", "Este pedido está encerrado. Inicie um novo evento quando quiser."),
  };
  return copy[item.status] || (localizedText("The events team will guide the next step.", "A equipe de eventos orientará o próximo passo."));
}

function renderReturningClientHistory(rows = [], email = "") {
  const container = document.querySelector("#returningClientHistory");
  const status = document.querySelector("#returningClientStatus");
  if (!container) return;
  returningClientHistory = rows || [];
  container.hidden = false;
  if (!rows.length) {
    container.innerHTML = `<p>${localizedText("No previous events or proposals were found for this e-mail. You can continue with the form normally.", "Não encontramos eventos ou propostas anteriores para este e-mail. Você pode seguir pelo formulário normalmente.")}</p>`;
    if (status) status.textContent = email ? email : "";
    return;
  }
  const isEn = uiState.language === "en";
  const activeCount = rows.filter((item) => !["pos_venda", "cancelado"].includes(item.status)).length;
  const nextEvent = rows.filter((item) => item.data_evento && !["pos_venda", "cancelado"].includes(item.status)).sort((a, b) => String(a.data_evento).localeCompare(String(b.data_evento)))[0];
  container.innerHTML = `
    <div class="returning-history-heading client-portal-heading">
      <div>
        <span>${localizedText("Secure client area", "Área segura do cliente")}</span>
        <strong>${localizedText("Your events in one place", "Seus eventos em um só lugar")}</strong>
        <small>${activeCount} ${localizedText("active", "em andamento")}${nextEvent ? ` · ${localizedText("Next", "Próximo")}: ${escapeHtml(formatReviewDate(nextEvent.data_evento))}` : ""}</small>
      </div>
      <div class="client-portal-actions">
        <button class="secondary" type="button" data-returning-new>${localizedText("New event", "Novo evento")}</button>
        <button class="secondary" type="button" data-returning-signout>${localizedText("Sign out", "Sair com segurança")}</button>
      </div>
    </div>
    <div class="returning-history-list">
      ${rows.map((item, index) => {
        const date = item.data_evento ? formatReviewDate(item.data_evento) : (localizedText("Date to define", "Data a definir"));
        const open = ["proposta_enviada", "negociacao"].includes(item.status);
        const progress = getReturningClientProgress(item.status);
        return `
          <article class="returning-history-item client-portal-event-card">
            <div class="client-portal-event-copy">
              <span>${escapeHtml(getReturningStatusLabel(item.status))}${item.versao ? ` · V${escapeHtml(item.versao)}` : ""}</span>
              <strong>${escapeHtml(getDisplayFormatLabel(item.tipo_evento) || (localizedText("Event", "Evento")))}</strong>
              <small>${escapeHtml(date)} · ${escapeHtml(item.convidados || "")}${item.convidados ? " pax" : ""}${item.total ? ` · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.total))}` : ""}</small>
              <div class="client-portal-progress" aria-label="${localizedText("Event progress", "Progresso do evento")}">
                ${progress.stages.map((stage, stageIndex) => `<span class="${stageIndex <= progress.index ? "is-complete" : ""}${stageIndex === progress.index ? " is-current" : ""}"><i></i>${escapeHtml(stage.label)}</span>`).join("")}
              </div>
              <p class="client-portal-next-step"><b>${localizedText("Next step", "Próximo passo")}</b>${escapeHtml(getReturningClientNextStep(item))}</p>
            </div>
            <div class="returning-history-actions">
              ${open ? `<button class="primary" type="button" data-returning-resume="${index}">${localizedText("Open and continue", "Abrir e continuar")}</button>` : ""}
              <button class="secondary" type="button" data-returning-repeat="${index}">${localizedText("Repeat this event", "Repetir este evento")}</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
  if (status) status.textContent = uiState.language === "es" ? `Sesión iniciada como ${email}.` : (uiState.language === "en" ? `Signed in as ${email}.` : `Acesso confirmado para ${email}.`);
}

async function loadReturningClientHistory() {
  const client = getPublicSupabaseClient();
  if (!client) return;
  const status = document.querySelector("#returningClientStatus");
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;
  if (!session?.user?.email) return;
  if (status) status.textContent = localizedText("Loading your history...", "Carregando seu histórico...");
  const { data, error } = await client.rpc("get_my_event_history");
  if (error) {
    console.warn("Falha ao carregar histórico do cliente.", error);
    if (status) status.textContent = localizedText("History is temporarily unavailable. You can continue with the form.", "O histórico está temporariamente indisponível. Você pode seguir pelo formulário.");
    return;
  }
  const access = document.querySelector("#returningClientAccess");
  if (access) access.open = true;
  const input = document.querySelector("#returningClientEmail");
  if (input) input.value = session.user.email;
  renderReturningClientHistory(data || [], session.user.email);
  captureLeadAnalytics("client_portal_opened", {
    result: data?.length ? "history_found" : "empty_history",
  }, {
    entityId: session.user.id,
    dedupeKey: `client-portal-opened:${session.user.id}`,
  });
}

async function signOutReturningClient() {
  const client = getPublicSupabaseClient();
  if (!client) return;
  await client.auth.signOut({ scope: "local" });
  returningClientHistory = [];
  const container = document.querySelector("#returningClientHistory");
  const status = document.querySelector("#returningClientStatus");
  const input = document.querySelector("#returningClientEmail");
  const access = document.querySelector("#returningClientAccess");
  if (container) {
    container.hidden = true;
    container.innerHTML = "";
  }
  if (input) input.value = "";
  if (access) access.open = false;
  if (status) status.textContent = localizedText("Secure access ended on this device.", "Acesso encerrado com segurança neste dispositivo.");
}

async function sendReturningClientOtp() {
  const client = getPublicSupabaseClient();
  const input = document.querySelector("#returningClientEmail");
  const button = document.querySelector("#returningClientSendOtp");
  const status = document.querySelector("#returningClientStatus");
  const email = String(input?.value || "").trim().toLowerCase();
  if (!client || !isValidEmail(email)) {
    if (status) status.textContent = localizedText("Enter a valid e-mail.", "Informe um e-mail válido.");
    input?.focus();
    return;
  }
  if (button) button.disabled = true;
  if (status) status.textContent = localizedText("Sending secure access...", "Enviando acesso seguro...");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: CANONICAL_CLIENT_FORM_URL, shouldCreateUser: true },
  });
  if (button) button.disabled = false;
  if (error) {
    console.warn("Falha ao enviar OTP do cliente.", error);
    if (status) status.textContent = localizedText("We could not send the access e-mail. Try again shortly.", "Não conseguimos enviar o acesso agora. Tente novamente em instantes.");
    return;
  }
  if (status) status.textContent = localizedText("Access sent. Open the link in your e-mail to see your history.", "Acesso enviado. Abra o link no seu e-mail para ver seu histórico.");
}

function applyReturningHistoryAsBase(item) {
  if (!item) return;
  resetCaptureIdentity();
  const snapshot = item.snapshot || {};
  const source = snapshot.sourceRequestSnapshot || {};
  const clientData = snapshot.client || source.cliente || {};
  const eventData = snapshot.event || source.evento || {};
  const qualification = snapshot.qualificacao || source.qualificacao || {};

  fields.name.value = clientData.name || clientData.nome || item.cliente_nome || "";
  fields.email.value = clientData.email || "";
  fields.phone.value = clientData.phone || clientData.whatsapp || "";
  fields.company.value = clientData.company || clientData.empresa || "";
  fields.endClientName.value = clientData.finalClient || clientData.clienteFinal || qualification.clienteFinal || "";
  fields.groupName.value = clientData.groupName || clientData.nomeGrupo || qualification.nomeGrupo || "";
  fields.eventType.value = eventData.type || eventData.tipo || item.tipo_evento || "";
  fields.date.value = "";
  fields.dateFlex.value = "";
  fields.guests.value = String(eventData.guests || eventData.convidados || item.convidados || 30);
  fields.duration.value = String(eventData.duration || eventData.duracao || "");
  fields.reason.value = eventData.reason || eventData.motivo || "";
  fields.preferences.value = eventData.preferences || eventData.preferencias || "";
  fields.notes.value = eventData.notes || eventData.observacoes || "";

  fields.clientType.value = getCanonicalKeyByLabel(canonicalClientTypeLabels, qualification.tipoCliente || clientData.tipoCliente);
  fields.budgetRange.value = getCanonicalKeyByLabel(canonicalBudgetRangeLabels, qualification.faixaInvestimento);
  fields.leadSource.value = getCanonicalKeyByLabel(canonicalLeadSourceLabels, qualification.origem);
  fields.moment.value = getCanonicalKeyByLabel(canonicalMomentLabels, eventData.momento || qualification.momento);

  selectedProfiles.clear();
  const profileText = String(eventData.ocasiao || eventData.perfil || qualification.ocasiao || "").toLowerCase();
  Object.entries(canonicalProfileLabels).forEach(([key, label]) => {
    if (profileText.includes(String(label).toLowerCase())) selectedProfiles.add(key);
  });
  if (selectedProfiles.size) fields.profile.value = [...selectedProfiles].join(",");

  const savedTime = String(eventData.time || eventData.horario || item.horario_evento || "").slice(0, 5);
  if (savedTime) {
    const hour = Number(savedTime.slice(0, 2));
    fields.timeRange.value = hour < 11 ? "morning" : hour < 19 ? "afternoon" : "night";
    fillTimeOptions(fields.timeRange.value);
    if ([...fields.time.options].some((option) => option.value === savedTime)) fields.time.value = savedTime;
  }

  updateGuestOutput("number");
  renderLocalizedChoices();
  renderRecommendations();
  updateContactRequirements();
  updateContactGuidance();
  renderFinalReview();
  schedulePartialCapture();
  captureLeadAnalytics("returning_event_reused", {
    source: "returning_client_history",
    event_type: eventData.type || eventData.tipo || item.tipo_evento || "unknown",
  }, {
    entityId: item.opportunity_id || item.proposal_id || item.id,
    dedupeKey: `returning-event-reused:${item.opportunity_id || item.proposal_id || item.id || "unknown"}`,
  });
  const status = document.querySelector("#returningClientStatus");
  if (status) status.textContent = localizedText("Previous event loaded. Confirm the new date and adjust only what changed.", "Evento anterior carregado. Confirme a nova data e ajuste apenas o que mudou.");
  scrollToStep("eventDetails", true);
}

async function resumeReturningProposal(item) {
  const client = getPublicSupabaseClient();
  const status = document.querySelector("#returningClientStatus");
  if (!client || !item?.proposal_id) return;
  if (status) status.textContent = localizedText("Opening your proposal...", "Abrindo sua proposta...");
  const { data, error } = await client.rpc("refresh_my_proposal_link", { p_proposal_id: item.proposal_id });
  if (error || !data) {
    if (status) status.textContent = localizedText("We could not reopen this proposal. Continue below and we will prepare a new version.", "Não conseguimos reabrir esta proposta. Continue abaixo e prepararemos uma nova versão.");
    return;
  }
  window.location.href = `./proposta.html?p=${encodeURIComponent(data)}`;
}

function initReturningClientAccess() {
  renderReturningClientCopy();
  document.querySelector("#returningClientSendOtp")?.addEventListener("click", sendReturningClientOtp);
  document.querySelector("#returningClientEmail")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendReturningClientOtp();
    }
  });
  document.querySelector("#returningClientHistory")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-returning-signout]")) {
      signOutReturningClient();
      return;
    }
    if (event.target.closest("[data-returning-new]")) {
      const access = document.querySelector("#returningClientAccess");
      if (access) access.open = false;
      scrollToStep("eventDetails", true);
      return;
    }
    const repeat = event.target.closest("[data-returning-repeat]");
    if (repeat) {
      applyReturningHistoryAsBase(returningClientHistory[Number(repeat.dataset.returningRepeat)]);
      return;
    }
    const resume = event.target.closest("[data-returning-resume]");
    if (resume) resumeReturningProposal(returningClientHistory[Number(resume.dataset.returningResume)]);
  });
  const client = getPublicSupabaseClient();
  client?.auth?.onAuthStateChange((_event, session) => {
    if (session?.user?.email) window.setTimeout(loadReturningClientHistory, 0);
  });
  loadReturningClientHistory();
}

async function submitRequest(event) {
  event.preventDefault();
  if (submitButton.disabled) return;
  const current = getCopy();

  if (!window.supabase?.createClient) {
    setStatus(current.messages.loadError, "error");
    return;
  }

  const referenceCode = getOrCreateReferenceCode();
  const snapshot = getSnapshot(referenceCode);
  if (!validateSnapshot(snapshot)) return;

  submitButton.disabled = true;
  setStatus(current.messages.submitting, "neutral");
  let submittedOpportunityId = null;

  try {
    const client = getPublicSupabaseClient();
    const { data, error } = await client.rpc("submit_public_quote_request", {
      p_capture_token: getCaptureToken(),
      p_snapshot: snapshot,
    });


    if (error) {
      captureLeadAnalytics("lead_submit_failed", { reason_code: "request_rejected" });
      console.warn("Falha ao enviar solicitacao.", error);
      setStatus(getFriendlySubmitError(error, current), "error");
      scrollToStep("contact", true);
      return;
    }
    submittedOpportunityId = data?.[0]?.opportunity_id || null;
  } catch (error) {
    captureLeadAnalytics("lead_submit_failed", { reason_code: "request_unavailable" });
    console.warn("Falha inesperada ao enviar solicitacao.", error);
    setStatus(getFriendlySubmitError(error, current), "error");
    scrollToStep("contact", true);
    return;
  } finally {
    submitButton.disabled = false;
  }

  resetCaptureIdentity();
  analyticsFormState.submitted = true;
  captureLeadAnalytics("lead_created", {
    entity_key_kind: submittedOpportunityId ? "opportunity" : "legacy_reference",
  }, {
    entityId: submittedOpportunityId || referenceCode,
    dedupeKey: `lead-created:${referenceCode}`,
  }, snapshot);
  form.reset();
  fields.moment.value = "";
  fields.clientType.value = "";
  fields.profile.value = "";
  fields.eventType.value = "";
  fields.dateIsFlexible.value = "no";
  selectedProfiles.clear();
  document.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
  clearAllStepValidity();
  fillGuestOptions();
  fillTimeOptions("");
  renderRecommendations();
  updateContactRequirements();
  updateContactGuidance();
  renderFinalReview();
  renderSuccessStatus(referenceCode);
}

applyConversionStepOrder();
document.querySelector("#formPersonalizeNav").addEventListener("click", () => {
  document.querySelector("#personalizeOptions").open = true;
});
form.addEventListener("focusin", (event) => {
  const name = Object.keys(steps).find((key) => steps[key].contains(event.target));
  if (name) {
    analyticsFormState.lastStep = name;
    updateProgress(name);
  }
  if (!analyticsFormState.started) {
    analyticsFormState.started = true;
    captureLeadAnalytics("lead_form_started", { last_step: name || "unknown" }, { dedupeKey: "lead-form-started" });
  }
});
initReturningClientAccess();
fillGuestOptions();
resetFlexibleDateField();
fillTimeOptions("");
renderRecommendations();
fields.date.min = getTodayInputValue();
updateContactRequirements();
updateContactGuidance();
renderFinalReview();
// Preserve the client's flexibility choice when restoring the page.
form.addEventListener("click", handleChoiceClick);
recommendationList.addEventListener("click", handleFormatClick);
finalReviewGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-step]");
  if (!button) return;
  scrollToStep(button.dataset.reviewStep, true);
});
form.addEventListener("input", renderFinalReview);
form.addEventListener("change", renderFinalReview);
form.addEventListener("input", schedulePartialCapture);
form.addEventListener("change", schedulePartialCapture);
fields.timeRange.addEventListener("change", () => {
  fillTimeOptions();
  setFieldValidity(fields.timeRange, true);
  setStepValidity("eventDetails", true);
  resetStatusIfError();
});
fields.phone.addEventListener("input", () => {
  fields.phone.value = formatPhoneInput(fields.phone.value);
  setFieldValidity(fields.phone, !fields.phone.value || isValidContactPhone(fields.phone.value));
  setStepValidity("contact", true);
  updateContactGuidance();
  resetStatusIfError();
});
fields.name.addEventListener("input", () => {
  setFieldValidity(fields.name, !fields.name.value || hasUsableName(fields.name.value));
  setStepValidity("contact", true);
  updateContactGuidance();
  resetStatusIfError();
});
fields.name.addEventListener("blur", () => {
  setFieldValidity(fields.name, !fields.name.value || hasUsableName(fields.name.value));
  updateContactGuidance();
});
fields.guests.addEventListener("input", updateGuestOutput);
fields.guestSlider?.addEventListener("input", () => updateGuestOutput("slider"));
fields.email.addEventListener("blur", () => {
  setFieldValidity(fields.email, !fields.email.value || isValidEmail(fields.email.value));
  setStepValidity("contact", true);
  resetStatusIfError();
});
fields.date.addEventListener("input", () => {
  setFieldValidity(fields.date, true);
  setFieldValidity(fields.dateFlex, true);
  setStepValidity("eventDetails", true);
  resetStatusIfError();
});
fields.dateFlex.addEventListener("input", () => {
  setFieldValidity(fields.date, true);
  setFieldValidity(fields.dateFlex, true);
  setStepValidity("eventDetails", true);
  resetStatusIfError();
});
fields.company.addEventListener("input", () => {
  setFieldValidity(fields.company, true);
  setStepValidity("contact", true);
  updateContactGuidance();
  resetStatusIfError();
});
fields.company.addEventListener("blur", () => {
  setFieldValidity(fields.company, true);
  updateContactGuidance();
});
fields.endClientName.addEventListener("input", () => {
  setFieldValidity(fields.endClientName, true);
  setStepValidity("contact", true);
  updateContactGuidance();
  resetStatusIfError();
});
fields.endClientName.addEventListener("blur", () => {
  setFieldValidity(fields.endClientName, true);
  updateContactGuidance();
});
fields.groupName.addEventListener("input", () => {
  setFieldValidity(fields.groupName, true);
  setStepValidity("contact", true);
  updateContactGuidance();
  resetStatusIfError();
});
fields.groupName.addEventListener("blur", () => {
  setFieldValidity(fields.groupName, true);
  updateContactGuidance();
});
preferenceChips.forEach((chip) => chip.addEventListener("change", () => setStepValidity("briefing", true)));
extraChips.forEach((chip) => chip.addEventListener("change", () => setStepValidity("briefing", true)));
langButtons.forEach((button) =>
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
  }),
);
initializeCaptureIdentity();
setLanguage(uiState.language);
captureLeadAnalytics("lead_form_viewed", {}, { dedupeKey: `lead-form-viewed:${uiState.language}` });
window.addEventListener("pagehide", () => {
  if (analyticsFormState.started && !analyticsFormState.submitted) {
    captureLeadAnalytics("lead_form_abandoned", { last_step: analyticsFormState.lastStep }, { dedupeKey: "lead-form-abandoned" });
  }
});
form.addEventListener("submit", submitRequest);
