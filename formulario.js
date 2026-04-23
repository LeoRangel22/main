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
const LANGUAGE_KEY = "embaixada_form_language_v1";
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
const uiState = { language: loadLanguage() };
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

const copy = {
  pt: {
    progressLabel: (current, total) => `Pergunta ${current} de ${total} - Tempo estimado 2 minutos`,
    uxCues: ["Escolha por cards", "Recomendamos formatos", "Você só informa o essencial"],
    trustPoints: ["Morro da Urca", "Parque Bondinho Pão de Açúcar", "Empresas, agências e eventos privados", "Proposta em até 2 dias úteis"],
    heroEyebrow: "Embaixada Carioca",
    heroTitle: "Planeje seu evento na Embaixada Carioca",
    heroSubtitle: "Escolha o momento ideal e descubra o formato mais indicado para o seu grupo no Morro da Urca.",
    introEyebrow: "Consultoria de eventos",
    introTitle: "Conte-nos o essencial. A equipe desenha a experiência certa para o seu grupo.",
    introBody: "Um fluxo breve para orientar empresas, agências e celebrações privadas com a atenção que o Morro da Urca merece.",
    stepLabels: ["Momento", "Qualificação", "Formato", "Viabilidade", "Extras", "Contato"],
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
          "Começar o dia com o nosso café da manhã e uma vista privilegiada para o Pão de Açúcar dá outro tom para reuniões, ativações e encontros corporativos.",
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
          "Conte o contexto e ajudamos a encontrar o momento mais favorável para a sua proposta.",
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
    profileSupport: "Essas respostas ajudam a equipe a priorizar o atendimento e montar uma proposta mais certeira.",
    occasionSupport: "Ocasião do evento",
    recommendationTitle: "Experiências mais indicadas",
    recommendationEmpty: "Escolha o momento e o perfil para ver as experiências mais indicadas.",
    recommendationReady: (moment) => `Baseado no que nos contou, já deixamos a opção mais indicada selecionada para ${moment.toLowerCase()}. Você pode trocar se preferir.`,
    labels: {
      eventDate: "Data desejada",
      eventDateHelp: "Se ainda não houver data fechada, conte a janela aproximada abaixo.",
      dateFlex: "Data flexível",
      dateFlexible: "A data é flexível?",
      guests: "Quantidade de convidados",
      guestsHelp: "Use o slider até 99+. Para grupos maiores, digite o número exato até 500.",
      period: "Período desejado",
      time: "Horário de chegada",
      timeHelp: "O horário acordado orienta a operação. Atrasos podem gerar hora extra ou manter o término original.",
      duration: "Duração estimada",
      briefingSupport: "Selecione o que ajuda a equipe a montar uma proposta mais precisa. Se não souber, deixe em branco.",
      reason: "Motivo do evento",
      preferences: "Preferências de alimentos e bebidas",
      notes: "Há algo importante que devemos considerar para montar sua proposta?",
      budget: "Faixa de investimento (Opcional)",
      leadSource: "Como conheceu a Embaixada?",
      name: "Nome completo",
      email: "E-mail",
      emailHelp: "Usaremos para enviar a proposta.",
      phone: "Celular/Whatsapp",
      phoneHelp: "Informe o DDD e o celular. Se for um número internacional, inclua o código do país.",
      company: "Empresa",
      companyHelp: "Se aplicável",
      contactPromise: "Nossa equipe responde em até 2 dias úteis com uma proposta sob medida.",
      contactAssurance: "Solicitação sem compromisso. Usamos as informações apenas para preparar o atendimento e a proposta do seu evento.",
      defaultStatus: "Seu pedido será analisado pela equipe de eventos da Embaixada Carioca.",
      submit: "Solicitar minha proposta",
      preferenceLegend: "O que não pode faltar?",
      extrasLegend: "Extras de produção",
    },
    placeholders: {
      dateFlex: "Ex.: primeira quinzena de agosto…",
      reason: "Ex.: comemorar 10 anos da empresa, premiar a equipe de vendas, receber clientes especiais…",
      preferences: "Conte estilos, bebidas preferidas ou restrições que a equipe deve considerar…",
      notes: "Qualquer detalhe ajuda: acessibilidade, surpresa para convidados, necessidades técnicas, perfil do grupo…",
      name: "Ex.: Leonardo Rangel…",
      email: "Ex.: nome@empresa.com.br…",
      phone: "Ex.: +55 21 99999-9999",
      company: "Ex.: Empresa ou agência…",
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
      successBody: (referenceCode) => `Sua referência é ${referenceCode}. O departamento de eventos da Embaixada Carioca vai analisar os detalhes e responder em até 2 dias úteis.`,
      successContact: "Se quiser acrescentar algo, fale com eventos@embaixadacarioca.com.br ou 21 97142-6007.",
      loadError: "Não foi possível carregar a conexão. Tente novamente em instantes.",
      submitError: "Não foi possível enviar. Confira os dados e tente novamente.",
      missingRequired: "Falta só escolher o momento, a ocasião, o formato, o período e os dados de contato para seguirmos.",
      missingDate: "Informe uma data desejada ou uma janela aproximada para a equipe avaliar disponibilidade.",
      invalidEmail: "Revise o e-mail para a proposta chegar no endereço certo.",
      invalidPhone: "Revise o celular/Whatsapp com DDD. Se for internacional, inclua também o código do país.",
    },
  },
  en: {
    progressLabel: (current, total) => `Question ${current} of ${total} - Estimated time 2 minutes`,
    uxCues: ["Choose with cards", "We recommend formats", "You only share the essentials"],
    trustPoints: ["Morro da Urca", "Sugarloaf Cable Car Park", "Companies, agencies and private events", "Proposal within 2 business days"],
    heroEyebrow: "Embaixada Carioca",
    heroTitle: "Plan your event at Embaixada Carioca",
    heroSubtitle: "Choose the ideal moment and discover the best format for your group at Morro da Urca.",
    introEyebrow: "Event advisory",
    introTitle: "Tell us the essentials. Our team will shape the right experience for your group.",
    introBody: "A short flow to guide companies, agencies and private celebrations with the attention that Morro da Urca deserves.",
    stepLabels: ["Moment", "Qualification", "Format", "Feasibility", "Extras", "Contact"],
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
          "Starting the day with our breakfast service and a privileged Sugarloaf view sets a different tone for meetings, activations and corporate gatherings.",
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
          "Share the context and we will help you find the most suitable moment for your proposal.",
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
    profileSupport: "These answers help our team prioritize the lead and build a sharper proposal.",
    occasionSupport: "Event occasion",
    recommendationTitle: "Best experiences for your event",
    recommendationEmpty: "Choose the moment and profile to see the most suitable experiences.",
    recommendationReady: (moment) => `Based on what you shared, we have already selected the best fit for ${moment.toLowerCase()}. You can still change it if you prefer.`,
    labels: {
      eventDate: "Preferred date",
      eventDateHelp: "If the date is not set yet, share an approximate window below.",
      dateFlex: "Flexible date window",
      dateFlexible: "Is the date flexible?",
      guests: "Guest count",
      guestsHelp: "Use the slider up to 99+. For larger groups, type the exact number up to 500.",
      period: "Preferred period",
      time: "Arrival time",
      timeHelp: "The agreed arrival time guides the operation. Delays may trigger extra time charges or keep the original end time.",
      duration: "Estimated duration",
      briefingSupport: "Select what helps our team build a more accurate proposal. If you are unsure, you can leave it blank.",
      reason: "Event goal",
      preferences: "Food and beverage preferences",
      notes: "Is there anything important we should consider when preparing your proposal?",
      budget: "Budget range (Optional)",
      leadSource: "How did you hear about Embaixada?",
      name: "Full name",
      email: "E-mail",
      emailHelp: "We will use it to send your proposal.",
      phone: "Phone/WhatsApp",
      phoneHelp: "Enter the area code and phone number. For international numbers, include the country code.",
      company: "Company",
      companyHelp: "If applicable",
      contactPromise: "Our team replies within 2 business days with a tailored proposal.",
      contactAssurance: "No commitment required. We use this information only to prepare the service and proposal for your event.",
      defaultStatus: "Your request will be reviewed by the Embaixada Carioca events team.",
      submit: "Request my proposal",
      preferenceLegend: "What cannot be missing?",
      extrasLegend: "Production extras",
    },
    placeholders: {
      dateFlex: "Ex.: first half of August…",
      reason: "Ex.: celebrate the company's 10th anniversary, reward the sales team, host special guests…",
      preferences: "Share styles, preferred drinks or dietary restrictions the team should consider…",
      notes: "Any detail helps: accessibility, guest surprise, technical needs, group profile…",
      name: "Ex.: Leonardo Rangel…",
      email: "Ex.: name@company.com…",
      phone: "Ex.: +1 305 555 0100",
      company: "Ex.: Company or agency…",
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
      successBody: (referenceCode) => `Your reference is ${referenceCode}. The Embaixada Carioca events department will review the details and reply within 2 business days.`,
      successContact: "If you would like to add anything, contact eventos@embaixadacarioca.com.br or +55 21 97142-6007.",
      loadError: "We could not load the connection. Please try again in a moment.",
      submitError: "We could not send your request. Please review the information and try again.",
      missingRequired: "We only need the moment, occasion, format, period and contact details to move forward.",
      missingDate: "Please provide either a preferred date or an approximate date window so the team can assess availability.",
      invalidEmail: "Please review the e-mail address so the proposal reaches the right inbox.",
      invalidPhone: "Please review the phone/WhatsApp number. For international contacts, include the country code.",
    },
  },
};

function loadLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === "en" ? "en" : "pt";
}

function getCopy() {
  return copy[uiState.language] || copy.pt;
}

function getFormatDefinition(id) {
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
  return definitions[id]?.[uiState.language] || definitions[id]?.pt;
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
  document.documentElement.lang = uiState.language === "en" ? "en" : "pt-BR";
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
  document.querySelector("#emailLabel").textContent = current.labels.email;
  document.querySelector("#emailHelp").textContent = current.labels.emailHelp;
  document.querySelector("#phoneLabel").textContent = current.labels.phone;
  document.querySelector("#phoneHelp").textContent = current.labels.phoneHelp;
  document.querySelector("#companyLabel").textContent = current.labels.company;
  document.querySelector("#companyHelp").textContent = current.labels.companyHelp;
  document.querySelector("#contactPromise").textContent = current.labels.contactPromise;
  document.querySelector("#contactAssurance").textContent = current.labels.contactAssurance;
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
  document.querySelector("#briefingTitle").textContent = uiState.language === "en" ? "Final touches" : "O toque final";
  document.querySelector("#contactTitle").textContent = current.stepLabels[5];
  document.querySelector("#momentTitle").textContent = current.stepLabels[0] === "Moment" ? "When are you imagining your event?" : "Quando você imagina seu evento?";
  document.querySelector("#profileTitle").textContent = uiState.language === "en" ? "Who is organizing and what is the occasion?" : "Quem está organizando e qual é a ocasião?";
  document.querySelector("#eventDetailsTitle").textContent = uiState.language === "en" ? "Event details" : "Detalhes do evento";
  document.querySelector(".preference-chips legend").textContent = current.labels.preferenceLegend;
  document.querySelectorAll(".preference-chips legend")[1].textContent = current.labels.extrasLegend;
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
  updateProgress(stepOrder.find((step, index) => progressSteps[index]?.hasAttribute("data-active")) || "moment");
}

function renderLocalizedChoices() {
  const current = getCopy();
  renderChoiceButtons(document.querySelector("#momentChoices"), current.momentOptions, "moment");
  renderChoiceButtons(document.querySelector("#clientTypeChoices"), current.clientTypes, "clientType");
  renderChoiceButtons(document.querySelector("#profileChoices"), current.profiles, "profile");
}

function setLanguage(language) {
  uiState.language = language === "en" ? "en" : "pt";
  localStorage.setItem(LANGUAGE_KEY, uiState.language);
  langButtons.forEach((button) => {
    const active = button.dataset.lang === uiState.language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  renderLocalizedChoices();
  applyStaticCopy();
  fillTimeOptions();
  renderRecommendations();
  updateGuestOutput();
}

function setStatus(message, type = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.status = type;
}

function updateProgress(stepName = "moment") {
  const current = getCopy();
  const index = Math.max(0, stepOrder.indexOf(stepName));
  const percent = ((index + 1) / stepOrder.length) * 100;
  if (progressText) progressText.textContent = current.progressLabel(index + 1, stepOrder.length);
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
  updateGuestOutput("number");
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
}

function fillTimeOptions(range = fields.timeRange.value) {
  const current = getCopy();
  const times = timeOptionsByRange[range] || [];
  const options = [`<option value="">${current.select.timePlaceholder}</option>`];
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
  return [...selectedProfiles].map((profile) => canonicalProfileLabels[profile]).filter(Boolean);
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
  }).find((id) => getFormatDefinition(id)?.label === label) || "";
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
  if (fields.eventType.value && !ids.includes(selectedFormatId)) fields.eventType.value = "";
  if (!fields.eventType.value && fields.profile.value && ids.length) {
    fields.eventType.value = getFormatDefinition(ids[0]).label;
  }
  const moment = canonicalMomentLabels[fields.moment.value];
  recommendationIntro.textContent = current.recommendationReady(moment);
  recommendationList.innerHTML = ids
    .map((id, index) => {
      const item = getFormatDefinition(id);
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
  const item = getFormatDefinition(formatId);
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
      duracao: toNumber(fields.duration.value),
      motivo: fields.reason.value.trim(),
      preferencias: [selectedPreferences.length ? `Preferências marcadas: ${selectedPreferences.join(", ")}` : "", preferenceText]
        .filter(Boolean)
        .join("\n"),
      extras: selectedExtras.join(", "),
      observacoes: fields.notes.value.trim(),
    },
    qualificacao: {
      tipoCliente: canonicalClientTypeLabels[fields.clientType.value] || "",
      origem: canonicalLeadSourceLabels[fields.leadSource.value] || "",
      faixaInvestimento: canonicalBudgetRangeLabels[fields.budgetRange.value] || "",
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
  const current = getCopy();
  clearAllStepValidity();
  const hasEventDateOrWindow = Boolean(snapshot.evento.data || snapshot.evento.dataFlexivel);
  const required = [
    [fields.moment, Boolean(snapshot.evento.momento), "moment"],
    [fields.clientType, Boolean(snapshot.cliente.tipoCliente), "profile"],
    [fields.profile, Boolean(snapshot.evento.perfil), "profile"],
    [fields.eventType, Boolean(snapshot.evento.tipo), "recommendation"],
    [fields.timeRange, Boolean(snapshot.evento.faixaHorario), "eventDetails"],
    [fields.time, Boolean(snapshot.evento.horario), "eventDetails"],
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
    setStatus(current.messages.missingRequired, "error");
    scrollToStep(firstInvalid[2], true);
    return false;
  }

  if (!hasEventDateOrWindow) {
    setStatus(current.messages.missingDate, "error");
    setStepValidity("eventDetails", false);
    setFieldValidity(fields.date, false);
    setFieldValidity(fields.dateFlex, false);
    scrollToStep("eventDetails", true);
    return false;
  }

  if (!isValidEmail(snapshot.cliente.email)) {
    setStatus(current.messages.invalidEmail, "error");
    setStepValidity("contact", false);
    setFieldValidity(fields.email, false);
    fields.email.focus();
    scrollToStep("contact", true);
    return false;
  }

  if (!isValidContactPhone(snapshot.cliente.whatsapp)) {
    setStatus(current.messages.invalidPhone, "error");
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
  const current = getCopy();

  if (!window.supabase?.createClient) {
    setStatus(current.messages.loadError, "error");
    return;
  }

  const referenceCode = createReferenceCode();
  const snapshot = getSnapshot(referenceCode);
  if (!validateSnapshot(snapshot)) return;

  submitButton.disabled = true;
  setStatus(current.messages.submitting, "neutral");

  const client = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  const { error } = await client.from("solicitacoes_cotacao").insert(getPayload(snapshot));

  submitButton.disabled = false;

  if (error) {
    console.warn("Falha ao enviar solicitacao.", error);
    setStatus(current.messages.submitError, "error");
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
  fields.phone.value = formatPhoneInput(fields.phone.value);
  setFieldValidity(fields.phone, !fields.phone.value || isValidContactPhone(fields.phone.value));
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
langButtons.forEach((button) =>
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
  }),
);
setLanguage(uiState.language);
form.addEventListener("submit", submitRequest);
