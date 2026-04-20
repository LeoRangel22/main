const STORAGE_KEY = "embaixada_orcamentos_precos_v1";
const SELECTED_KEY = "embaixada_orcamentos_selecionados_v1";
const PRIVATIZATION_KEY = "embaixada_orcamentos_privatizacao_v1";
const TERMS_KEY = "embaixada_orcamentos_condicoes_v1";
const SUPABASE_CONFIG_KEY = "embaixada_orcamentos_supabase_v1";
const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";
const CANONICAL_APP_URL = "https://leorangel22.github.io/main/";
const CANONICAL_CLIENT_FORM_URL = "https://leorangel22.github.io/main/formulario.html";
const TEAM_EMAILS = ["eventos@embaixadacarioca.com.br", "leorangel@gmail.com"];
const SERVICE_RATE = 0.12;
const paymentTerms = [
  "50% do valor total na confirmação da reserva.",
  "50% restante até 72 horas antes do evento.",
];

const initialPrices = [
  {
    id: "coquetel-caipirinha",
    codigo: "1",
    tipoEvento: "Coquetel",
    nome: "Coquetel Caipirinha",
    descricao:
      "Caipirinhas de limão, refrigerantes normal e zero, água mineral com e sem gás.",
    preco1h: 55,
    preco2h: 95,
    precoMeiaHoraExtra: 20,
    precoFixo: "",
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "coquetel-carioca",
    codigo: "1",
    tipoEvento: "Coquetel",
    nome: "Coquetel Carioca",
    descricao:
      "Caipirinhas de limão, maracujá e abacaxi, chope Heineken, 3 tipos de suco, água mineral e refrigerantes.",
    preco1h: 75,
    preco2h: 125,
    precoMeiaHoraExtra: 25,
    precoFixo: "",
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "brasileiro-i",
    codigo: "C1",
    tipoEvento: "Comidas",
    nome: "Brasileiro I",
    descricao: "Pastéis de carne e queijo e aipim frito.",
    preco1h: 59,
    preco2h: 79,
    precoMeiaHoraExtra: 15,
    precoFixo: "",
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "brasileiro-ii",
    codigo: "C1",
    tipoEvento: "Comidas",
    nome: "Brasileiro II",
    descricao:
      "Caldinho de feijão, queijo coalho, pastéis, aipim frito, bolinha de bacalhau, barquete de bobó de camarão, pratinho escondidinho ou picadinho de filé mignon.",
    preco1h: 79,
    preco2h: 115,
    precoMeiaHoraExtra: 22,
    precoFixo: "",
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "workshop-caipirinha-pt",
    codigo: "2",
    tipoEvento: "Workshop de Caipirinha",
    nome: "Workshop de Caipirinha (PT)",
    descricao:
      "Preparação de 2 caipirinhas pelo método tradicional e com coqueteleira. Acompanhamento por especialistas.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 1000,
    valorAdicional: 115,
    minimo: 8,
    idioma: "PT",
    formula: "fixedCoversMinimum",
  },
  {
    id: "workshop-caipirinha-en",
    codigo: "2",
    tipoEvento: "Workshop de Caipirinha",
    nome: "Workshop de Caipirinha (EN)",
    descricao:
      "Preparação de 2 caipirinhas pelo método tradicional e com coqueteleira. Acompanhamento por especialista em inglês.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 1200,
    valorAdicional: 145,
    minimo: 8,
    idioma: "EN",
    formula: "fixedCoversMinimum",
  },
  {
    id: "cafe-classico",
    codigo: "3",
    tipoEvento: "Café da Manhã / Coffee Break",
    nome: "Café da Manhã Clássico",
    descricao:
      "Café, chá, leite, sucos de laranja e abacaxi com hortelã, água mineral, pães frios, frutas frescas, bolo de laranja e biscoitos amanteigados.",
    preco1h: 65,
    preco2h: 95,
    precoMeiaHoraExtra: 20,
    precoFixo: "",
    valorAdicional: "",
    minimo: 30,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "cafe-completo",
    codigo: "3",
    tipoEvento: "Café da Manhã / Coffee Break",
    nome: "Café da Manhã Completo",
    descricao:
      "Café, chá, leite, sucos de laranja e abacaxi com hortelã, pães, frios, frutas frescas, bolo de laranja, biscoitos amanteigados, ovo mexido com bacon, iogurte, granola e bolo adicional de cenoura com chocolate.",
    preco1h: 100,
    preco2h: 135,
    precoMeiaHoraExtra: 25,
    precoFixo: "",
    valorAdicional: "",
    minimo: 30,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "coffee-praia-vermelha",
    codigo: "3",
    tipoEvento: "Café da Manhã / Coffee Break",
    nome: "Coffee Break Praia Vermelha",
    descricao:
      "Café, chá, sucos de laranja e abacaxi com hortelã, 1 bolo de laranja ou cenoura com chocolate e biscoitos amanteigados.",
    preco1h: 55,
    preco2h: 80,
    precoMeiaHoraExtra: 15,
    precoFixo: "",
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "coffee-morro-urca",
    codigo: "3",
    tipoEvento: "Café da Manhã / Coffee Break",
    nome: "Coffee Break Morro da Urca",
    descricao:
      "Café, chá, sucos de laranja e abacaxi com hortelã, 1 bolo de laranja ou cenoura com chocolate, biscoitos amanteigados, mini sanduíches de 2 tipos e bolo extra.",
    preco1h: 70,
    preco2h: 114,
    precoMeiaHoraExtra: 24,
    precoFixo: "",
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "durationPerPerson",
  },
  {
    id: "welcome-caipirinha",
    codigo: "4",
    tipoEvento: "Welcome Drink",
    nome: "Welcome Drink Caipirinha",
    descricao: "Nossa especialidade: caipirinha autêntica brasileira de limão.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 36,
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "perPersonFixed",
  },
  {
    id: "welcome-espumante",
    codigo: "4",
    tipoEvento: "Welcome Drink",
    nome: "Welcome Drink Espumante Nacional",
    descricao: "Espumante nacional servido como welcome drink.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 44,
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "perPersonFixed",
  },
  {
    id: "welcome-champagne",
    codigo: "4",
    tipoEvento: "Welcome Drink",
    nome: "Welcome Drink Champagne",
    descricao: "Champagne francês servido como welcome drink.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 129,
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "perPersonFixed",
  },
  {
    id: "snacks-tradicional",
    codigo: "C4",
    tipoEvento: "Snacks",
    nome: "Snacks Tradicional",
    descricao: "Azeitonas, batata chips e amendoim.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 30,
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "perPersonFixed",
  },
  {
    id: "snacks-carioca",
    codigo: "C4",
    tipoEvento: "Snacks",
    nome: "Snacks Carioca",
    descricao: "Biscoito Globo e caldinho de feijão.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 35,
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "perPersonFixed",
  },
  {
    id: "snacks-pasteis",
    codigo: "C4",
    tipoEvento: "Snacks",
    nome: "Snacks Pastéis Tradicionais",
    descricao: "2 unidades por pessoa: queijo e carne.",
    preco1h: "",
    preco2h: "",
    precoMeiaHoraExtra: "",
    precoFixo: 25,
    valorAdicional: "",
    minimo: 20,
    idioma: "",
    formula: "perPersonFixed",
  },
];

const guidedEvents = {
  coquetel: {
    label: "Coquetel",
    category: "Coquetel",
    status: "Coquetel selecionado. Escolha uma bebida e, se quiser, um pacote de comidas.",
  },
  workshop: {
    label: "Workshop de Caipirinha",
    category: "Workshop de Caipirinha",
    status: "Workshop selecionado. Marque abaixo a versão PT ou EN e confirme participantes.",
  },
  cafe: {
    label: "Café da Manhã / Coffee Break",
    category: "Café da Manhã / Coffee Break",
    status: "Café da Manhã / Coffee Break selecionado. Marque abaixo o pacote desejado e confirme participantes.",
  },
  welcome: {
    label: "Welcome Drink",
    category: "Welcome Drink",
    status: "Welcome Drink selecionado. Marque abaixo a opção de recepção e confirme participantes.",
  },
};

const defaultPrivatizationRules = [
  {
    day: 1,
    label: "Segunda",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "17:00",
    closing: "20:00",
    partial: 6000,
    total: 12000,
    offPeak: 6000,
  },
  {
    day: 2,
    label: "Terça",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "16:30",
    closing: "20:00",
    partial: 6000,
    total: 9000,
    offPeak: 6000,
  },
  {
    day: 3,
    label: "Quarta",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "16:30",
    closing: "20:00",
    partial: 3000,
    total: 9000,
    offPeak: 6000,
  },
  {
    day: 4,
    label: "Quinta",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "16:30",
    closing: "20:00",
    partial: 6000,
    total: 9000,
    offPeak: 6000,
  },
  {
    day: 5,
    label: "Sexta",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "18:00",
    closing: "20:30",
    partial: 9000,
    total: 12000,
    offPeak: 9000,
  },
  {
    day: 6,
    label: "Sábado",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "18:00",
    closing: "20:30",
    partial: 12000,
    total: 18000,
    offPeak: 12000,
  },
  {
    day: 0,
    label: "Domingo",
    opening: "08:30",
    peakStart: "12:00",
    peakEnd: "18:00",
    closing: "20:30",
    partial: 12000,
    total: 18000,
    offPeak: 12000,
  },
];

const defaultGeneralTerms = `CONDIÇÕES GERAIS - INFORMAÇÕES IMPORTANTES
Este tarifário contempla valores individuais e aplica-se exclusivamente aos serviços de alimentos e bebidas.
Será acrescida taxa de serviço de 12%, conforme previsto na Lei nº 13.419/2017 (Gorjeta Legal) e acordo com o sindicato da categoria.
Para a realização dos serviços de Welcome Drinks e Coquetéis, exige-se quantidade mínima de 20 participantes.
Já para Café da Manhã, Coffee Break e Brunch, a quantidade mínima é de 30 participantes.

CONFIRMAÇÃO DA RESERVA E PAGAMENTO
RESERVA E CONFIRMAÇÃO
A data e o horário do evento somente serão considerados reservados e confirmados após o pagamento de 50% do valor total acordado.
VALOR RESIDUAL: saldo restante deverá ser quitado com no mínimo 72 horas de antecedência à realização do evento.
- ALTERAÇÃO NO HORÁRIO: qualquer alteração de horário deverá ser previamente consultada e está sujeita à disponibilidade da Embaixada Carioca.
- ACRÉSCIMO DE PESSOAS: a inclusão de participantes com menos de 24 horas de antecedência implicará em acréscimo de 20% sobre o valor individual previamente acordado para cada pessoa adicional.
- REDUÇÃO DE PESSOAS: reduções na quantidade de participantes ou cancelamentos parciais deverão ser comunicados com, no mínimo, 5 dias úteis de antecedência.

CANCELAMENTO, NO-SHOW E ATRASO
CANCELAMENTO: em caso de cancelamento, será aplicada a seguinte política de cobrança:
- Mais de 5 dias úteis antes do evento: 25% do valor total contratado.
- Entre 5 dias úteis e 48 horas antes: 50% do valor total contratado.
- Menos de 48 horas antes do evento: 100% do valor total contratado.
NO-SHOW: em caso de não comparecimento, será cobrado o valor integral do serviço contratado.
Apenas eventos cancelados por paralisação do teleférico poderão ser reagendados, mediante data acordada entre as partes.
ATRASO: em caso de atraso por parte do cliente, o horário de término do evento será mantido.
A extensão do evento poderá ser considerada mediante disponibilidade da Embaixada Carioca e será acrescida ao valor do serviço de alimentos e bebidas (A&B), por pessoa, a cada meia hora adicional ou fração.

OBSERVAÇÕES IMPORTANTES
INGRESSOS TELEFÉRICO: os valores não incluem os ingressos para o teleférico, que devem ser adquiridos separadamente.
VALIDADE: este tarifário é válido exclusivamente para eventos realizados até o dia 30/06/2025.
ATRAÇÃO MUSICAL, ENTRETENIMENTO E DIVULGAÇÃO: a realização de atrações musicais, atividades de entretenimento, instalação de faixas, banners, materiais promocionais ou qualquer ação de divulgação somente será permitida mediante autorização prévia, por escrito, do Setor de Eventos do Parque Bondinho Pão de Açúcar. Após autorizada, essa autorização deverá ser formalmente encaminhada à Embaixada Carioca. Em caso de ausência desse envio, a execução poderá ser impedida.
UTILIZAÇÃO DA MARCA DO BONDINHO: qualquer uso comercial ou promocional envolvendo o Bondinho do Pão de Açúcar e os perfis dos morros deverá ser previamente aprovado pelo Setor de Eventos do Caminho Aéreo Pão de Açúcar.
É expressamente proibida a distribuição de cartazes pela cidade, a fixação de materiais promocionais e a projeção de imagens nos morros sem autorização formal. O descumprimento poderá acarretar penalidades e multas legais, inclusive em momento posterior ao evento.`;

const state = {
  prices: loadPrices(),
  selectedIds: loadSelectedIds(),
  privatizationRules: loadPrivatizationRules(),
  supabase: null,
  session: null,
  proposals: [],
  quoteRequests: [],
  activeQuoteRequestId: "",
  guided: {
    event: "",
    beverageId: "",
    foodId: "",
  },
  privatizationChoice: "",
};

const fields = {
  clientName: document.querySelector("#clientName"),
  clientEmail: document.querySelector("#clientEmail"),
  clientPhone: document.querySelector("#clientPhone"),
  eventType: document.querySelector("#eventType"),
  eventDate: document.querySelector("#eventDate"),
  eventTime: document.querySelector("#eventTime"),
  guestCount: document.querySelector("#guestCount"),
  eventDuration: document.querySelector("#eventDuration"),
  validity: document.querySelector("#validity"),
  notes: document.querySelector("#notes"),
  eventReason: document.querySelector("#eventReason"),
  generalTerms: document.querySelector("#generalTerms"),
  searchPrice: document.querySelector("#searchPrice"),
  categoryFilter: document.querySelector("#categoryFilter"),
  newCodigo: document.querySelector("#newCodigo"),
  newTipo: document.querySelector("#newTipo"),
  newNome: document.querySelector("#newNome"),
  newFormula: document.querySelector("#newFormula"),
  newDescricao: document.querySelector("#newDescricao"),
  newPreco1h: document.querySelector("#newPreco1h"),
  newPreco2h: document.querySelector("#newPreco2h"),
  newPrecoExtra: document.querySelector("#newPrecoExtra"),
  newPrecoFixo: document.querySelector("#newPrecoFixo"),
  newValorAdicional: document.querySelector("#newValorAdicional"),
  newMinimo: document.querySelector("#newMinimo"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKey"),
  loginEmail: document.querySelector("#loginEmail"),
  magicLinkUrl: document.querySelector("#magicLinkUrl"),
};

const nodes = {
  priceList: document.querySelector("#priceList"),
  pricesTable: document.querySelector("#pricesTable"),
  categoryOptions: document.querySelector("#categoryOptions"),
  flowStatus: document.querySelector("#flowStatus"),
  coquetelChoices: document.querySelector("#coquetelChoices"),
  flowEventOptions: document.querySelector("#flowEventOptions"),
  flowBeverageOptions: document.querySelector("#flowBeverageOptions"),
  flowFoodOptions: document.querySelector("#flowFoodOptions"),
  calculationBreakdown: document.querySelector("#calculationBreakdown"),
  privatizationTitle: document.querySelector("#privatizationTitle"),
  privatizationDescription: document.querySelector("#privatizationDescription"),
  optionalPrivatizationControls: document.querySelector("#optionalPrivatizationControls"),
  privatizationRulesTable: document.querySelector("#privatizationRulesTable"),
  grandTotal: document.querySelector("#grandTotal"),
  totalMeta: document.querySelector("#totalMeta"),
  selectedItems: document.querySelector("#selectedItems"),
  proposalTotal: document.querySelector("#proposalTotal"),
  proposalContent: document.querySelector("#proposalContent"),
  supabaseStatus: document.querySelector("#supabaseStatus"),
  authStatus: document.querySelector("#authStatus"),
  historyList: document.querySelector("#historyList"),
  quoteRequestList: document.querySelector("#quoteRequestList"),
  clientFormLink: document.querySelector("#clientFormLink"),
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function loadPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return mergeCatalogLabels(saved);
  } catch (error) {
    console.warn("Nao foi possivel carregar precos salvos.", error);
  }
  return clonePrices(initialPrices);
}

function mergeCatalogLabels(prices) {
  const catalogById = new Map(initialPrices.map((item) => [item.id, item]));
  return prices.map((item) => {
    const catalogItem = catalogById.get(item.id);
    if (!catalogItem) return item;
    return {
      ...item,
      codigo: catalogItem.codigo,
      tipoEvento: catalogItem.tipoEvento,
      nome: catalogItem.nome,
      descricao: catalogItem.descricao,
      idioma: catalogItem.idioma,
    };
  });
}

function loadSelectedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]"));
  } catch (error) {
    console.warn("Nao foi possivel carregar selecao salva.", error);
    return new Set();
  }
}

function loadPrivatizationRules() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRIVATIZATION_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (error) {
    console.warn("Nao foi possivel carregar regras de privatizacao salvas.", error);
  }
  return clonePrices(defaultPrivatizationRules);
}

function loadGeneralTerms() {
  try {
    const saved = localStorage.getItem(TERMS_KEY);
    if (saved && saved.trim()) return saved;
  } catch (error) {
    console.warn("Nao foi possivel carregar condicoes gerais salvas.", error);
  }
  return defaultGeneralTerms;
}

function savePrices() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prices));
}

function saveSelectedIds() {
  localStorage.setItem(SELECTED_KEY, JSON.stringify([...state.selectedIds]));
}

function savePrivatizationRules() {
  localStorage.setItem(PRIVATIZATION_KEY, JSON.stringify(state.privatizationRules));
}

function saveGeneralTerms() {
  localStorage.setItem(TERMS_KEY, fields.generalTerms.value);
}

function loadSupabaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
    if (saved && saved.url && saved.anonKey) return saved;
  } catch (error) {
    console.warn("Nao foi possivel carregar configuracao do Supabase.", error);
  }
  return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
}

function saveSupabaseConfig(url, anonKey) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, anonKey }));
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function clonePrices(prices) {
  return JSON.parse(JSON.stringify(prices));
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value).trim();
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(text)
      ? text.replace(/\./g, "")
      : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMultilineHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function formatMoney(value) {
  return currency.format(value || 0);
}

function getGuestCount() {
  return Math.max(1, Math.floor(toNumber(fields.guestCount.value) || 1));
}

function getDuration() {
  return Math.max(1, toNumber(fields.eventDuration.value) || 1);
}

function getBillableGuests(item) {
  return Math.max(getGuestCount(), toNumber(item.minimo) || 0);
}

function getHalfHourBlocks(duration) {
  if (duration <= 2) return 0;
  return Math.ceil((duration - 2) / 0.5);
}

function calculateItem(item) {
  const guests = getGuestCount();
  const billableGuests = getBillableGuests(item);
  const duration = getDuration();
  let unitPrice = 0;
  let total = 0;
  let detail = "";

  if (item.formula === "durationPerPerson") {
    const base1h = toNumber(item.preco1h);
    const base2h = toNumber(item.preco2h);
    const extra = toNumber(item.precoMeiaHoraExtra);
    const halfBlocks = getHalfHourBlocks(duration);
    unitPrice = duration <= 1 ? base1h : base2h + halfBlocks * extra;
    total = unitPrice * billableGuests;
    detail = `${billableGuests} pessoas faturadas x ${formatMoney(unitPrice)} por pessoa (${duration}h)`;
  }

  if (item.formula === "perPersonFixed") {
    unitPrice = toNumber(item.precoFixo);
    total = unitPrice * billableGuests;
    detail = `${billableGuests} pessoas faturadas x ${formatMoney(unitPrice)} por pessoa`;
  }

  if (item.formula === "fixedPlusPerPerson") {
    const fixed = toNumber(item.precoFixo);
    unitPrice = toNumber(item.valorAdicional);
    total = fixed + unitPrice * billableGuests;
    detail = `${formatMoney(fixed)} fixo + ${billableGuests} pessoas x ${formatMoney(unitPrice)}`;
  }

  if (item.formula === "fixedCoversMinimum") {
    const fixed = toNumber(item.precoFixo);
    const minimum = toNumber(item.minimo) || 0;
    const extraGuests = Math.max(0, guests - minimum);
    unitPrice = toNumber(item.valorAdicional);
    total = fixed + extraGuests * unitPrice;
    detail = `${formatMoney(fixed)} até ${minimum} pessoas + ${extraGuests} adicional(is) x ${formatMoney(
      unitPrice,
    )}`;
  }

  if (item.formula === "fixedTotal") {
    total = toNumber(item.precoFixo);
    detail = `Valor fixo do item`;
  }

  if (billableGuests > guests) {
    detail += `; mínimo de ${billableGuests} pessoas aplicado`;
  }

  return { total, unitPrice, detail, billableGuests };
}

function getSelectedItems() {
  return state.prices
    .filter((item) => state.selectedIds.has(item.id))
    .map((item) => ({ ...item, calc: calculateItem(item) }));
}

function getSubtotal() {
  return getSelectedItems().reduce((sum, item) => sum + item.calc.total, 0);
}

function getServiceFee() {
  return getSubtotal() * SERVICE_RATE;
}

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getEventWindow() {
  const start = timeToMinutes(fields.eventTime.value);
  if (start === null) return null;
  return {
    start,
    end: start + getDuration() * 60,
  };
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function getRuleForEventDate() {
  if (!fields.eventDate.value) return null;
  const eventDate = new Date(`${fields.eventDate.value}T00:00:00`);
  return state.privatizationRules.find((rule) => Number(rule.day) === eventDate.getDay()) || null;
}

function getOutsideHoursNote(rule, eventWindow) {
  const opening = timeToMinutes(rule.opening);
  let closing = timeToMinutes(rule.closing);
  if (!eventWindow || opening === null || closing === null) return "";
  if (closing <= opening) closing += 24 * 60;
  const outside = eventWindow.start < opening || eventWindow.end > closing;
  return outside
    ? ` Atenção: o evento está fora da janela ${rule.opening}-${rule.closing}; confirme disponibilidade operacional.`
    : "";
}

function isPeakEvent() {
  if (!fields.eventDate.value || !fields.eventTime.value) {
    return { status: "missing" };
  }

  const rule = getRuleForEventDate();
  if (!rule) {
    return { status: "no-rule" };
  }

  const eventWindow = getEventWindow();
  const peakStart = timeToMinutes(rule.peakStart);
  let peakEnd = timeToMinutes(rule.peakEnd);
  if (!eventWindow || peakStart === null || peakEnd === null) {
    return { status: "missing" };
  }
  if (peakEnd <= peakStart) peakEnd += 24 * 60;

  return {
    status: rangesOverlap(eventWindow.start, eventWindow.end, peakStart, peakEnd)
      ? "peak"
      : "outside-peak",
    rule,
    outsideHoursNote: getOutsideHoursNote(rule, eventWindow),
  };
}

function getPrivatization() {
  const peak = isPeakEvent();
  const guests = getGuestCount();

  if (peak.status === "missing") {
    return {
      mode: "pending",
      amount: 0,
      title: "Informe data e horário",
      description: "A regra de privatização depende do dia, horário e duração do evento.",
      optional: false,
    };
  }

  if (peak.status === "no-rule") {
    return {
      mode: "none",
      amount: 0,
      title: "Sem pico obrigatório",
      description: "Não há regra automática de privatização para o dia selecionado.",
      optional: false,
    };
  }

  const rule = peak.rule;
  const partialValue = toNumber(rule.partial);
  const fullValue = toNumber(rule.total);
  const optionalValue = toNumber(rule.offPeak);
  const dayContext = `${rule.label}: abertura ${rule.opening}, pico ${rule.peakStart}-${rule.peakEnd}, fechamento ${rule.closing}.`;

  if (peak.status === "peak") {
    const isFull = guests > 40;
    const amount = isFull ? fullValue : partialValue;
    return {
      mode: isFull ? "required-full" : "required-partial",
      amount,
      title: isFull ? "Pico obrigatório: privatização total" : "Pico obrigatório: privatização parcial",
      description: amount
        ? `${dayContext} ${isFull ? "Acima de 40 pessoas" : "Até 40 pessoas"}: ${formatMoney(amount)} aplicado automaticamente.${peak.outsideHoursNote}`
        : "Configure o valor de privatização para aplicar automaticamente no total.",
      optional: false,
    };
  }

  if (optionalValue > 0) {
    const accepted = state.privatizationChoice === "yes";
    return {
      mode: "optional",
      amount: accepted ? optionalValue : 0,
      title: "Fora do pico: privatização opcional",
      description: accepted
        ? `${dayContext} Exclusividade incluída: ${formatMoney(optionalValue)}.${peak.outsideHoursNote}`
        : `${dayContext} Ofereça exclusividade do espaço por ${formatMoney(optionalValue)}.${peak.outsideHoursNote}`,
      optional: true,
    };
  }

  return {
    mode: "none",
    amount: 0,
    title: "Privatização não aplicada",
    description: `${dayContext} Evento fora do horário de pico e sem valor opcional configurado.${peak.outsideHoursNote}`,
    optional: false,
  };
}

function getQuoteTotals() {
  const subtotal = getSubtotal();
  const serviceFee = subtotal * SERVICE_RATE;
  const privatization = getPrivatization();
  return {
    subtotal,
    serviceFee,
    privatization,
    total: subtotal + serviceFee + privatization.amount,
  };
}

function getTotal() {
  return getQuoteTotals().total;
}

function getFormulaLabel(formula) {
  const labels = {
    durationPerPerson: "Por pessoa + duração",
    perPersonFixed: "Por pessoa fixo",
    fixedPlusPerPerson: "Fixo + por pessoa",
    fixedCoversMinimum: "Fixo inclui mínimo",
    fixedTotal: "Valor fixo total",
  };
  return labels[formula] || "Por pessoa";
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function setChoiceState(container, selectedValue, attributeName) {
  if (!container) return;
  container.querySelectorAll("button").forEach((button) => {
    const isActive = button.dataset[attributeName] === selectedValue;
    button.classList.toggle("is-active", isActive);
  });
}

function setExclusiveSelection(ids, selectedId) {
  ids.forEach((id) => state.selectedIds.delete(id));
  if (selectedId) state.selectedIds.add(selectedId);
}

function scrollToItems() {
  nodes.priceList?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCategoryFilter() {
  const categories = [...new Set(state.prices.map((item) => item.tipoEvento))].sort();
  fields.categoryFilter.innerHTML = `<option value="">Todas</option>${categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("")}`;
  if (nodes.categoryOptions) {
    nodes.categoryOptions.innerHTML = categories
      .map((category) => `<option value="${escapeHtml(category)}"></option>`)
      .join("");
  }
}

function applyGuidedEvent(eventKey) {
  const config = guidedEvents[eventKey];
  if (!config) return;

  state.guided.event = eventKey;
  state.guided.beverageId = "";
  state.guided.foodId = "";
  fields.eventType.value = config.label;
  fields.categoryFilter.value = config.category;
  fields.searchPrice.value = "";
  nodes.flowStatus.textContent = config.status;
  nodes.coquetelChoices.classList.toggle("is-hidden", eventKey !== "coquetel");

  setChoiceState(nodes.flowEventOptions, eventKey, "flowEvent");
  setChoiceState(nodes.flowBeverageOptions, "", "selectPackage");
  setChoiceState(nodes.flowFoodOptions, "", "selectPackage");

  if (eventKey !== "coquetel") {
    state.selectedIds.clear();
  }

  saveSelectedIds();
  renderAll();
  scrollToItems();
}

function applyGuidedPackage(packageId) {
  if (packageId === "none-food") {
    state.guided.foodId = "";
    setExclusiveSelection(["brasileiro-i", "brasileiro-ii"], "");
    setChoiceState(nodes.flowFoodOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Coquetel com bebidas selecionadas e sem pacote de comidas.";
  } else if (["coquetel-caipirinha", "coquetel-carioca"].includes(packageId)) {
    state.guided.beverageId = packageId;
    setExclusiveSelection(["coquetel-caipirinha", "coquetel-carioca"], packageId);
    setChoiceState(nodes.flowBeverageOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Bebidas selecionadas. Agora escolha o pacote de comidas ou marque Nenhum.";
  } else if (["brasileiro-i", "brasileiro-ii"].includes(packageId)) {
    state.guided.foodId = packageId;
    setExclusiveSelection(["brasileiro-i", "brasileiro-ii"], packageId);
    setChoiceState(nodes.flowFoodOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Coquetel configurado. Confira convidados, duração e total estimado.";
  }

  fields.eventType.value = "Coquetel";
  fields.categoryFilter.value = "";
  saveSelectedIds();
  renderAll();
}

function clearGuidedFlow() {
  state.guided = { event: "", beverageId: "", foodId: "" };
  ["coquetel-caipirinha", "coquetel-carioca", "brasileiro-i", "brasileiro-ii"].forEach((id) =>
    state.selectedIds.delete(id),
  );
  fields.eventType.value = "";
  fields.categoryFilter.value = "";
  fields.searchPrice.value = "";
  nodes.coquetelChoices.classList.add("is-hidden");
  nodes.flowStatus.textContent =
    "Comece escolhendo o tipo de evento. O app filtra os pacotes e seleciona automaticamente quando houver uma regra clara.";
  setChoiceState(nodes.flowEventOptions, "", "flowEvent");
  setChoiceState(nodes.flowBeverageOptions, "", "selectPackage");
  setChoiceState(nodes.flowFoodOptions, "", "selectPackage");
  saveSelectedIds();
  renderAll();
}

function getFilteredPrices() {
  const query = fields.searchPrice.value.trim().toLowerCase();
  const category = fields.categoryFilter.value;
  return state.prices.filter((item) => {
    const haystack = `${item.codigo} ${item.tipoEvento} ${item.nome} ${item.descricao}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!category || item.tipoEvento === category);
  });
}

function renderPriceList() {
  const items = getFilteredPrices();
  if (!items.length) {
    nodes.priceList.innerHTML = `<p>Nenhum item encontrado.</p>`;
    return;
  }

  nodes.priceList.innerHTML = items
    .map((item) => {
      const calc = calculateItem(item);
      const checked = state.selectedIds.has(item.id) ? "checked" : "";
      return `
        <label class="price-row">
          <input type="checkbox" data-select-id="${escapeHtml(item.id)}" ${checked} />
          <span>
            <span class="price-name">
              <strong>${escapeHtml(item.nome)}</strong>
              <span class="chip">${escapeHtml(item.tipoEvento)}</span>
              ${item.idioma ? `<span class="chip">${escapeHtml(item.idioma)}</span>` : ""}
            </span>
            <p>${escapeHtml(item.descricao)}</p>
            <p>${escapeHtml(calc.detail)}</p>
          </span>
          <span class="item-cost">${formatMoney(calc.total)}</span>
        </label>
      `;
    })
    .join("");
}

function renderPricesTable() {
  nodes.pricesTable.innerHTML = state.prices
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.codigo)}</td>
        <td>${escapeHtml(item.tipoEvento)}</td>
        <td>${escapeHtml(item.nome)}</td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="preco1h" inputmode="decimal" value="${escapeHtml(item.preco1h)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="preco2h" inputmode="decimal" value="${escapeHtml(item.preco2h)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="precoMeiaHoraExtra" inputmode="decimal" value="${escapeHtml(item.precoMeiaHoraExtra)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="precoFixo" inputmode="decimal" value="${escapeHtml(item.precoFixo)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="valorAdicional" inputmode="decimal" value="${escapeHtml(item.valorAdicional)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="minimo" inputmode="numeric" value="${escapeHtml(item.minimo)}" /></td>
        <td>
          <select data-price-id="${escapeHtml(item.id)}" data-field="formula">
            ${["durationPerPerson", "perPersonFixed", "fixedPlusPerPerson", "fixedCoversMinimum", "fixedTotal"]
              .map(
                (formula) =>
                  `<option value="${formula}" ${item.formula === formula ? "selected" : ""}>${getFormulaLabel(
                    formula,
                  )}</option>`,
              )
              .join("")}
          </select>
        </td>
      </tr>
    `,
    )
    .join("");
}

function renderSummary() {
  const selected = getSelectedItems();
  const totals = getQuoteTotals();
  nodes.grandTotal.textContent = formatMoney(totals.total);
  nodes.proposalTotal.textContent = formatMoney(totals.total);
  nodes.totalMeta.textContent = selected.length
    ? `${selected.length} item(ns), ${getGuestCount()} convidado(s), ${getDuration()}h, taxa de 12% incluída.`
    : "Selecione itens para montar o orçamento.";

  nodes.selectedItems.innerHTML = selected.length
    ? selected
        .map(
          (item) => `
          <div class="selected-line">
            <strong>
              <span>${escapeHtml(item.nome)}</span>
              <span>${formatMoney(item.calc.total)}</span>
            </strong>
            <small>${escapeHtml(item.calc.detail)}</small>
          </div>
        `,
        )
        .join("")
    : `<p>Os itens escolhidos aparecem aqui.</p>`;
}

function renderCalculation() {
  const totals = getQuoteTotals();
  const privatization = totals.privatization;

  nodes.calculationBreakdown.innerHTML = `
    <div>
      <span>Subtotal</span>
      <strong>${formatMoney(totals.subtotal)}</strong>
      <small>Itens selecionados antes da taxa.</small>
    </div>
    <div>
      <span>Taxa de serviço</span>
      <strong>${formatMoney(totals.serviceFee)}</strong>
      <small>12% sobre o subtotal.</small>
    </div>
    <div>
      <span>Privatização</span>
      <strong>${formatMoney(privatization.amount)}</strong>
      <small>${escapeHtml(privatization.title)}</small>
    </div>
    <div>
      <span>Total</span>
      <strong>${formatMoney(totals.total)}</strong>
      <small>Subtotal + taxa + privatização.</small>
    </div>
  `;

  nodes.privatizationTitle.textContent = privatization.title;
  nodes.privatizationDescription.textContent = privatization.description;
  nodes.optionalPrivatizationControls.classList.toggle("is-hidden", !privatization.optional);
  setChoiceState(nodes.optionalPrivatizationControls, state.privatizationChoice, "privatizationChoice");
}

function renderPrivatizationRulesTable() {
  nodes.privatizationRulesTable.innerHTML = state.privatizationRules
    .map(
      (rule, index) => `
        <tr>
          <td><strong>${escapeHtml(rule.label)}</strong></td>
          <td><input type="time" data-rule-index="${index}" data-rule-field="opening" value="${escapeHtml(rule.opening)}" /></td>
          <td><input type="time" data-rule-index="${index}" data-rule-field="peakStart" value="${escapeHtml(rule.peakStart)}" /></td>
          <td><input type="time" data-rule-index="${index}" data-rule-field="peakEnd" value="${escapeHtml(rule.peakEnd)}" /></td>
          <td><input type="time" data-rule-index="${index}" data-rule-field="closing" value="${escapeHtml(rule.closing)}" /></td>
          <td><input type="text" inputmode="decimal" data-rule-index="${index}" data-rule-field="partial" value="${escapeHtml(rule.partial)}" /></td>
          <td><input type="text" inputmode="decimal" data-rule-index="${index}" data-rule-field="total" value="${escapeHtml(rule.total)}" /></td>
          <td><input type="text" inputmode="decimal" data-rule-index="${index}" data-rule-field="offPeak" value="${escapeHtml(rule.offPeak)}" /></td>
        </tr>
      `,
    )
    .join("");
}

function getEventDateLabel() {
  if (!fields.eventDate.value) return "A definir";
  const [year, month, day] = fields.eventDate.value.split("-");
  return `${day}/${month}/${year}`;
}

function getEventTimeLabel() {
  return fields.eventTime.value || "A definir";
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function buildProposalText() {
  const selected = getSelectedItems();
  const clientName = fields.clientName.value.trim() || "Cliente";
  const eventType = fields.eventType.value.trim() || "Evento";
  const totals = getQuoteTotals();
  const reason = fields.eventReason.value.trim();
  const lines = [
    `Proposta de evento - Embaixada Carioca`,
    ``,
    `Cliente: ${clientName}`,
    `Evento: ${eventType}`,
    `Data: ${getEventDateLabel()}`,
    `Horário: ${getEventTimeLabel()}`,
    `Convidados: ${getGuestCount()}`,
    `Duração: ${getDuration()}h`,
    `Validade: ${fields.validity.value.trim() || "7 dias"}`,
  ];

  if (reason) lines.push(`Motivo: ${reason}`);

  const terms = fields.generalTerms.value.trim();
  if (terms) lines.push(``, terms);

  lines.push(``, `Pagamento:`, ...paymentTerms);

  lines.push(``, `Itens selecionados:`);

  if (selected.length) {
    selected.forEach((item) => {
      lines.push(`- ${item.nome}: ${formatMoney(item.calc.total)} (${item.calc.detail})`);
    });
  } else {
    lines.push("- Nenhum item selecionado");
  }

  lines.push(
    ``,
    `Subtotal: ${formatMoney(totals.subtotal)}`,
    `Taxa de serviço (12%): ${formatMoney(totals.serviceFee)}`,
    `Privatização: ${formatMoney(totals.privatization.amount)} - ${totals.privatization.title}`,
    `Total estimado: ${formatMoney(totals.total)}`,
  );

  const notes = fields.notes.value.trim();
  if (notes) lines.push(``, `Observações: ${notes}`);

  return lines.join("\n");
}

function getProposalSnapshot() {
  const totals = getQuoteTotals();
  const selected = getSelectedItems();
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    client: {
      name: fields.clientName.value.trim(),
      email: fields.clientEmail.value.trim(),
      phone: fields.clientPhone.value.trim(),
    },
    event: {
      type: fields.eventType.value.trim(),
      date: fields.eventDate.value,
      time: fields.eventTime.value,
      guests: getGuestCount(),
      duration: getDuration(),
      validity: fields.validity.value.trim(),
      reason: fields.eventReason.value.trim(),
      notes: fields.notes.value.trim(),
    },
    totals: {
      subtotal: roundCurrency(totals.subtotal),
      serviceFee: roundCurrency(totals.serviceFee),
      privatizationAmount: roundCurrency(totals.privatization.amount),
      total: roundCurrency(totals.total),
      privatization: totals.privatization,
    },
    selectedIds: [...state.selectedIds],
    selectedItems: selected.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      tipoEvento: item.tipoEvento,
      nome: item.nome,
      descricao: item.descricao,
      formula: item.formula,
      calc: item.calc,
    })),
    prices: state.prices,
    guided: state.guided,
    privatizationChoice: state.privatizationChoice,
    activeQuoteRequestId: state.activeQuoteRequestId,
    privatizationRules: state.privatizationRules,
    generalTerms: fields.generalTerms.value,
    paymentTerms,
    proposalText: buildProposalText(),
  };
}

function getProposalRow(snapshot) {
  const user = state.session?.user;
  return {
    responsavel_id: user?.id || null,
    responsavel_email: user?.email || null,
    cliente_nome: snapshot.client.name || "Cliente",
    cliente_email: snapshot.client.email || null,
    cliente_whatsapp: snapshot.client.phone || null,
    tipo_evento: snapshot.event.type || null,
    data_evento: snapshot.event.date || null,
    horario_evento: snapshot.event.time || null,
    convidados: snapshot.event.guests,
    duracao: snapshot.event.duration,
    subtotal: snapshot.totals.subtotal,
    taxa_servico: snapshot.totals.serviceFee,
    privatizacao: snapshot.totals.privatizationAmount,
    total: snapshot.totals.total,
    status: "rascunho",
    solicitacao_id: state.activeQuoteRequestId || null,
    snapshot,
  };
}

function renderSupabaseStatus(message, connected = false) {
  nodes.supabaseStatus.textContent = message;
  nodes.supabaseStatus.style.borderLeftColor = connected ? "var(--verde)" : "var(--verde-2)";
}

function getAuthRedirectUrl() {
  return CANONICAL_APP_URL;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isTeamEmail(email) {
  return TEAM_EMAILS.includes(normalizeEmail(email));
}

function updateAuthUI() {
  const loginButton = document.querySelector("#loginBtn");
  const logoutButton = document.querySelector("#logoutBtn");
  const recoverButton = document.querySelector("#recoverMagicLinkBtn");
  const isConnected = Boolean(state.supabase);
  const isLoggedIn = Boolean(state.session?.user);

  loginButton.disabled = !isConnected || isLoggedIn;
  recoverButton.disabled = !isConnected || isLoggedIn;
  logoutButton.classList.toggle("is-hidden", !isLoggedIn);
  fields.loginEmail.disabled = !isConnected || isLoggedIn;
  fields.magicLinkUrl.disabled = !isConnected || isLoggedIn;

  if (!isConnected) {
    nodes.authStatus.textContent = "A conexão da equipe ainda está carregando.";
    return;
  }

  nodes.authStatus.textContent = isLoggedIn
    ? `Conectado como ${state.session.user.email}.`
    : "Use eventos@embaixadacarioca.com.br ou leorangel@gmail.com para receber o link de acesso.";
}

function renderHistory() {
  if (!state.supabase) {
    nodes.historyList.innerHTML = `<p>A conexão da equipe ainda está carregando.</p>`;
    return;
  }

  if (!state.session) {
    nodes.historyList.innerHTML = `<p>Entre com o e-mail da equipe para carregar propostas salvas.</p>`;
    return;
  }

  if (!state.proposals.length) {
    nodes.historyList.innerHTML = `<p>Nenhuma proposta salva ainda.</p>`;
    return;
  }

  nodes.historyList.innerHTML = state.proposals
    .map((proposal) => {
      const dateLabel = proposal.data_evento ? formatDateFromIso(proposal.data_evento) : "Data a definir";
      const timeLabel = proposal.horario_evento ? String(proposal.horario_evento).slice(0, 5) : "Horário a definir";
      return `
        <button class="history-item" type="button" data-proposal-id="${escapeHtml(proposal.id)}">
          <strong>
            <span>${escapeHtml(proposal.cliente_nome || "Cliente")}</span>
            <span>${formatMoney(proposal.total)}</span>
          </strong>
          <small>${escapeHtml(proposal.tipo_evento || "Evento")} · ${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</small>
          <small>Salva em ${escapeHtml(formatSavedAt(proposal.created_at))}</small>
        </button>
      `;
    })
    .join("");
}

function getClientFormUrl() {
  return CANONICAL_CLIENT_FORM_URL;
}

function renderClientFormLink() {
  nodes.clientFormLink.textContent = getClientFormUrl();
}

function renderQuoteRequests() {
  if (!state.supabase) {
    nodes.quoteRequestList.innerHTML = `<p>A conexão da equipe ainda está carregando.</p>`;
    return;
  }

  if (!state.session) {
    nodes.quoteRequestList.innerHTML = `<p>Entre com o e-mail da equipe para carregar solicitações.</p>`;
    return;
  }

  if (!state.quoteRequests.length) {
    nodes.quoteRequestList.innerHTML = `<p>Nenhuma solicitação recebida ainda.</p>`;
    return;
  }

  nodes.quoteRequestList.innerHTML = state.quoteRequests
    .map((request) => {
      const dateLabel = request.data_evento ? formatDateFromIso(request.data_evento) : "Data a definir";
      const timeLabel = request.horario_evento ? String(request.horario_evento).slice(0, 5) : "Horário a definir";
      const statusLabel = getRequestStatusLabel(request.status);
      return `
        <div class="request-item">
          <strong>
            <span>${escapeHtml(request.cliente_nome || "Cliente")}</span>
            <span>${escapeHtml(statusLabel)}</span>
          </strong>
          <small>${escapeHtml(request.tipo_evento || "Evento")} · ${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)} · ${request.convidados || 1} pessoa(s)</small>
          <small>${escapeHtml(request.cliente_email || "")}${request.cliente_whatsapp ? ` · ${escapeHtml(request.cliente_whatsapp)}` : ""}</small>
          <div class="request-actions">
            <button class="primary" type="button" data-use-request="${escapeHtml(request.id)}">Usar na proposta</button>
            <button class="secondary" type="button" data-mark-request="${escapeHtml(request.id)}">Marcar analisada</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function getRequestStatusLabel(status) {
  const labels = {
    novo: "Novo",
    em_cotacao: "Em cotação",
    analisado: "Analisado",
    proposta_gerada: "Proposta gerada",
  };
  return labels[status] || status || "Novo";
}

async function loadQuoteRequests() {
  if (!state.supabase || !state.session) {
    renderQuoteRequests();
    return;
  }

  const { data, error } = await state.supabase
    .from("solicitacoes_cotacao")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.warn("Falha ao carregar solicitacoes.", error);
    nodes.quoteRequestList.innerHTML = `<p>Não foi possível carregar solicitações. Rode o schema atualizado no Supabase.</p>`;
    return;
  }

  state.quoteRequests = data || [];
  renderQuoteRequests();
}

function buildNotesFromRequest(request) {
  const lines = [];
  if (request.empresa) lines.push(`Empresa: ${request.empresa}`);
  if (request.preferencias) lines.push(`Preferências: ${request.preferencias}`);
  if (request.observacoes) lines.push(`Observações do cliente: ${request.observacoes}`);
  lines.push(`Solicitação recebida via formulário em ${formatSavedAt(request.created_at)}.`);
  return lines.join("\n");
}

async function applyQuoteRequest(requestId) {
  const request = state.quoteRequests.find((item) => item.id === requestId);
  if (!request) return;

  state.activeQuoteRequestId = request.id;
  fields.clientName.value = request.cliente_nome || "";
  fields.clientEmail.value = request.cliente_email || "";
  fields.clientPhone.value = request.cliente_whatsapp || "";
  fields.eventType.value = request.tipo_evento || "";
  fields.eventDate.value = request.data_evento || "";
  fields.eventTime.value = request.horario_evento ? String(request.horario_evento).slice(0, 5) : "18:00";
  fields.guestCount.value = request.convidados || 30;
  fields.eventDuration.value = String(request.duracao || 2);
  fields.eventReason.value = request.motivo_evento || "";
  fields.notes.value = buildNotesFromRequest(request);

  await updateQuoteRequest(request.id, { status: "em_cotacao" }, false);
  renderAll();
  showToast("Solicitação carregada para revisão.");
}

async function markQuoteRequestAnalyzed(requestId) {
  await updateQuoteRequest(requestId, { status: "analisado" });
}

async function updateQuoteRequest(requestId, changes, shouldToast = true) {
  if (!state.supabase || !state.session) return;
  const { data, error } = await state.supabase
    .from("solicitacoes_cotacao")
    .update(changes)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    console.warn("Falha ao atualizar solicitacao.", error);
    if (shouldToast) showToast("Não foi possível atualizar a solicitação.");
    return;
  }

  state.quoteRequests = state.quoteRequests.map((item) => (item.id === requestId ? data : item));
  renderQuoteRequests();
  if (shouldToast) showToast("Solicitação atualizada.");
}

async function initSupabase() {
  const config = loadSupabaseConfig();
  fields.supabaseUrl.value = config.url;
  fields.supabaseAnonKey.value = config.anonKey;

  if (!config.url || !config.anonKey) {
    renderSupabaseStatus("Supabase ainda nao configurado.");
    updateAuthUI();
    renderHistory();
    renderQuoteRequests();
    return;
  }

  if (!window.supabase?.createClient) {
    renderSupabaseStatus("Biblioteca do Supabase nao carregou. Verifique a internet deste navegador.");
    updateAuthUI();
    renderHistory();
    renderQuoteRequests();
    return;
  }

  try {
    state.supabase = window.supabase.createClient(config.url, config.anonKey);
    renderSupabaseStatus("Supabase conectado neste navegador.", true);

    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    state.session = data.session;

    state.supabase.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      if (session?.user?.email && !isTeamEmail(session.user.email)) {
        state.supabase.auth.signOut();
        showToast("E-mail sem acesso ao app da equipe.");
        return;
      }
      updateAuthUI();
      if (session) {
        loadProposalHistory();
        loadQuoteRequests();
      }
      else {
        state.proposals = [];
        state.quoteRequests = [];
        renderHistory();
        renderQuoteRequests();
      }
    });

    updateAuthUI();
    if (state.session) {
      if (!isTeamEmail(state.session.user.email)) {
        await state.supabase.auth.signOut();
        state.session = null;
        showToast("E-mail sem acesso ao app da equipe.");
        updateAuthUI();
        renderHistory();
        renderQuoteRequests();
      } else {
        await loadProposalHistory();
        await loadQuoteRequests();
      }
    } else {
      renderHistory();
      renderQuoteRequests();
    }
  } catch (error) {
    console.warn("Falha ao iniciar Supabase.", error);
    state.supabase = null;
    state.session = null;
    renderSupabaseStatus("Nao foi possivel conectar. Confira URL e anon key.");
    updateAuthUI();
    renderHistory();
    renderQuoteRequests();
  }
}

function configureSupabaseFromForm() {
  const url = fields.supabaseUrl.value.trim();
  const anonKey = fields.supabaseAnonKey.value.trim();
  if (!url || !anonKey) {
    showToast("Preencha URL e anon key do Supabase.");
    return;
  }
  saveSupabaseConfig(url, anonKey);
  initSupabase();
}

async function loginWithEmail() {
  if (!state.supabase) {
    showToast("A conexao da equipe ainda esta carregando. Tente novamente em instantes.");
    return;
  }

  const email = normalizeEmail(fields.loginEmail.value);
  if (!email) {
    showToast("Preencha o e-mail da equipe.");
    return;
  }

  if (!isTeamEmail(email)) {
    showToast("Use um e-mail autorizado da equipe.");
    return;
  }

  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });

  if (error) {
    console.warn("Falha no login.", error);
    showToast("Nao foi possivel enviar o link de acesso.");
    return;
  }

  nodes.authStatus.textContent = "Link de acesso enviado. Abra o e-mail neste navegador.";
  showToast("Link de acesso enviado.");
}

function extractSessionFromMagicLink(rawUrl) {
  const value = rawUrl.trim();
  if (!value) return null;

  const hashIndex = value.indexOf("#");
  const queryIndex = value.indexOf("?");
  const tokenSource =
    hashIndex >= 0 ? value.slice(hashIndex + 1) : queryIndex >= 0 ? value.slice(queryIndex + 1) : value;
  const params = new URLSearchParams(tokenSource);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

async function recoverMagicLinkSession() {
  if (!state.supabase) {
    showToast("Conecte o Supabase primeiro.");
    return;
  }

  const tokens = extractSessionFromMagicLink(fields.magicLinkUrl.value);
  if (!tokens) {
    showToast("Cole a URL completa do magic link, incluindo access_token e refresh_token.");
    return;
  }

  const { data, error } = await state.supabase.auth.setSession(tokens);
  if (error || !data?.session) {
    console.warn("Falha ao recuperar magic link.", error);
    showToast("Nao foi possivel entrar com essa URL. Peça um novo magic link.");
    return;
  }

  if (!isTeamEmail(data.session.user.email)) {
    await state.supabase.auth.signOut();
    showToast("E-mail sem acesso ao app da equipe.");
    return;
  }

  state.session = data.session;
  fields.magicLinkUrl.value = "";
  updateAuthUI();
  await loadProposalHistory();
  await loadQuoteRequests();
  showToast("Login concluido.");
}

async function logoutSupabase() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.session = null;
  state.proposals = [];
  state.quoteRequests = [];
  updateAuthUI();
  renderHistory();
  renderQuoteRequests();
}

async function saveCurrentProposal() {
  if (!state.supabase) {
    showToast("Conecte o Supabase para salvar no historico.");
    return;
  }

  if (!state.session) {
    showToast("Entre com o e-mail da equipe antes de salvar.");
    return;
  }

  const snapshot = getProposalSnapshot();
  const row = getProposalRow(snapshot);
  const { data, error } = await state.supabase
    .from("propostas")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.warn("Falha ao salvar proposta.", error);
    showToast("Nao foi possivel salvar. Confira o schema no Supabase.");
    return;
  }

  state.proposals = [data, ...state.proposals].slice(0, 20);
  if (state.activeQuoteRequestId) {
    await updateQuoteRequest(
      state.activeQuoteRequestId,
      { status: "proposta_gerada", proposta_id: data.id },
      false,
    );
  }
  renderHistory();
  showToast("Proposta salva no historico.");
}

async function loadProposalHistory() {
  if (!state.supabase || !state.session) {
    renderHistory();
    return;
  }

  const { data, error } = await state.supabase
    .from("propostas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("Falha ao carregar historico.", error);
    nodes.historyList.innerHTML = `<p>Nao foi possivel carregar o historico. Confira as politicas RLS.</p>`;
    return;
  }

  state.proposals = data || [];
  renderHistory();
}

function applyProposalSnapshot(snapshot) {
  if (!snapshot) {
    showToast("Proposta sem snapshot salvo.");
    return;
  }

  fields.clientName.value = snapshot.client?.name || "";
  fields.clientEmail.value = snapshot.client?.email || "";
  fields.clientPhone.value = snapshot.client?.phone || "";
  fields.eventType.value = snapshot.event?.type || "";
  fields.eventDate.value = snapshot.event?.date || "";
  fields.eventTime.value = snapshot.event?.time || "18:00";
  fields.guestCount.value = snapshot.event?.guests || 30;
  fields.eventDuration.value = String(snapshot.event?.duration || 2);
  fields.validity.value = snapshot.event?.validity || "7 dias";
  fields.eventReason.value = snapshot.event?.reason || "";
  fields.notes.value = snapshot.event?.notes || "";
  fields.generalTerms.value = snapshot.generalTerms || loadGeneralTerms();

  if (Array.isArray(snapshot.prices) && snapshot.prices.length) {
    state.prices = snapshot.prices;
    savePrices();
  }

  state.selectedIds = new Set(snapshot.selectedIds || snapshot.selectedItems?.map((item) => item.id) || []);
  state.guided = snapshot.guided || { event: "", beverageId: "", foodId: "" };
  state.privatizationChoice = snapshot.privatizationChoice || "";

  if (Array.isArray(snapshot.privatizationRules) && snapshot.privatizationRules.length) {
    state.privatizationRules = snapshot.privatizationRules;
    savePrivatizationRules();
    renderPrivatizationRulesTable();
  }

  saveSelectedIds();
  saveGeneralTerms();
  renderCategoryFilter();
  renderAll();
  showToast("Proposta reaberta.");
}

function openSavedProposal(proposalId) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return;
  applyProposalSnapshot(proposal.snapshot);
}

function formatDateFromIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatSavedAt(value) {
  if (!value) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderProposal() {
  const selected = getSelectedItems();
  const notes = fields.notes.value.trim();
  const reason = fields.eventReason.value.trim();
  const terms = fields.generalTerms.value.trim();
  const totals = getQuoteTotals();

  nodes.proposalContent.innerHTML = `
    <section class="proposal-page proposal-page-main">
      <div class="proposal-cover">
        <img src="./assets/venue.jpg" alt="" />
        <div>
          <span>Evento no Morro da Urca</span>
          <strong>${escapeHtml(fields.eventType.value.trim() || "Proposta de evento")}</strong>
        </div>
      </div>

      <div class="proposal-summary-strip">
        <div>
          <span>Cliente</span>
          <strong>${escapeHtml(fields.clientName.value.trim() || "Cliente")}</strong>
        </div>
        <div>
          <span>Data e horário</span>
          <strong>${escapeHtml(getEventDateLabel())} · ${escapeHtml(getEventTimeLabel())}</strong>
        </div>
        <div>
          <span>Convidados</span>
          <strong>${getGuestCount()} pessoas</strong>
        </div>
        <div>
          <span>Total estimado</span>
          <strong>${formatMoney(totals.total)}</strong>
        </div>
      </div>

      <div class="proposal-section-title">
        <span>01</span>
        <h3>Resumo do evento</h3>
      </div>
      <div class="proposal-grid">
        <div><span>Tipo</span>${escapeHtml(fields.eventType.value.trim() || "Evento")}</div>
        <div><span>Duração</span>${getDuration()}h</div>
        <div><span>Validade</span>${escapeHtml(fields.validity.value.trim() || "7 dias")}</div>
        <div><span>Emissão</span>${escapeHtml(getTodayLabel())}</div>
        <div class="proposal-grid-wide"><span>Motivo</span>${escapeHtml(reason || "A definir")}</div>
      </div>

      ${
      terms
          ? `<div class="proposal-terms-header"><img src="./assets/logo-reducao.svg" alt="Embaixada Carioca" /><div><span>Embaixada Carioca</span><strong>Condições comerciais</strong></div></div><div class="proposal-section-title terms-title"><span>02</span><h3>Condições gerais</h3></div><div class="proposal-note terms-note">${formatMultilineHtml(terms)}</div>`
          : ""
      }

    </section>

    <section class="proposal-page proposal-page-details">
      <div class="proposal-section-title">
        <span>03</span>
        <h3>Itens selecionados</h3>
      </div>
      <table class="proposal-table">
        <colgroup>
          <col class="proposal-col-item" />
          <col class="proposal-col-description" />
          <col class="proposal-col-value" />
        </colgroup>
        <thead>
          <tr>
            <th>Item</th>
            <th>Descrição e cálculo</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${
            selected.length
              ? selected
                  .map(
                    (item) => `
                  <tr>
                    <td><strong>${escapeHtml(item.nome)}</strong></td>
                    <td>${escapeHtml(item.descricao)}<br /><small>${escapeHtml(item.calc.detail)}</small></td>
                    <td class="proposal-value">${formatMoney(item.calc.total)}</td>
                  </tr>
                `,
                  )
                  .join("")
              : `<tr><td colspan="3">Selecione itens para completar a proposta.</td></tr>`
          }
        </tbody>
      </table>

      <div class="proposal-section-title">
        <span>04</span>
        <h3>Investimento</h3>
      </div>
      <div class="proposal-totals">
        <div><span>Subtotal</span><strong>${formatMoney(totals.subtotal)}</strong></div>
        <div><span>Taxa de serviço 12%</span><strong>${formatMoney(totals.serviceFee)}</strong></div>
        <div><span>Privatização</span><strong>${formatMoney(totals.privatization.amount)}</strong></div>
        <div><span>Total estimado</span><strong>${formatMoney(totals.total)}</strong></div>
      </div>

      <div class="proposal-note">
        <span>Privatização</span>${escapeHtml(totals.privatization.title)}. ${escapeHtml(totals.privatization.description)}
      </div>

      <div class="proposal-section-title">
        <span>05</span>
        <h3>Pagamento</h3>
      </div>
      <div class="proposal-payment">
        ${paymentTerms.map((term) => `<div><span></span><strong>${escapeHtml(term)}</strong></div>`).join("")}
      </div>

      ${
        notes
          ? `<div class="proposal-note"><span>Observações</span>${escapeHtml(notes)}</div>`
          : ""
      }
    </section>
  `;
}

function renderAll() {
  renderPriceList();
  renderPricesTable();
  renderSummary();
  renderCalculation();
  renderProposal();
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function openEmail() {
  const email = fields.clientEmail.value.trim();
  const subject = encodeURIComponent("Proposta de evento - Embaixada Carioca");
  const body = encodeURIComponent(buildProposalText());
  if (!email) {
    showToast("Preencha o e-mail do cliente para abrir a mensagem.");
    return;
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}

async function copyProposal() {
  const text = buildProposalText();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Proposta copiada.");
  } catch (error) {
    console.warn("Falha ao copiar via clipboard.", error);
    showToast("Não foi possível copiar automaticamente.");
  }
}

async function copyClientFormLink() {
  const url = getClientFormUrl();
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link do formulário copiado.");
  } catch (error) {
    console.warn("Falha ao copiar link do formulario.", error);
    showToast("Não foi possível copiar automaticamente.");
  }
}

function openWhatsApp() {
  const phone = fields.clientPhone.value.replace(/\D/g, "");
  const text = encodeURIComponent(buildProposalText());
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener");
}

function resetPrices() {
  const confirmed = window.confirm("Restaurar os precos originais da planilha enviada?");
  if (!confirmed) return;
  state.prices = clonePrices(initialPrices);
  savePrices();
  renderCategoryFilter();
  renderAll();
  showToast("Precos restaurados.");
}

function clearNewItemForm() {
  fields.newCodigo.value = "";
  fields.newTipo.value = "";
  fields.newNome.value = "";
  fields.newDescricao.value = "";
  fields.newPreco1h.value = "";
  fields.newPreco2h.value = "";
  fields.newPrecoExtra.value = "";
  fields.newPrecoFixo.value = "";
  fields.newValorAdicional.value = "";
  fields.newMinimo.value = "20";
  fields.newFormula.value = "durationPerPerson";
}

function createNewItem() {
  const tipo = fields.newTipo.value.trim();
  const nome = fields.newNome.value.trim();
  const descricao = fields.newDescricao.value.trim();

  if (!tipo || !nome || !descricao) {
    showToast("Preencha tipo, nome e descrição do novo item.");
    return;
  }

  const item = {
    id: `custom-${slugify(tipo)}-${slugify(nome)}-${Date.now()}`,
    codigo: fields.newCodigo.value.trim() || "NOVO",
    tipoEvento: tipo,
    nome,
    descricao,
    preco1h: fields.newPreco1h.value.trim(),
    preco2h: fields.newPreco2h.value.trim(),
    precoMeiaHoraExtra: fields.newPrecoExtra.value.trim(),
    precoFixo: fields.newPrecoFixo.value.trim(),
    valorAdicional: fields.newValorAdicional.value.trim(),
    minimo: fields.newMinimo.value || 0,
    idioma: "",
    formula: fields.newFormula.value,
    custom: true,
  };

  state.prices.push(item);
  state.selectedIds.add(item.id);
  savePrices();
  saveSelectedIds();
  renderCategoryFilter();
  fields.categoryFilter.value = tipo;
  clearNewItemForm();
  renderAll();
  showToast("Item criado e adicionado ao orçamento.");
}

function bindEvents() {
  Object.values(fields).forEach((field) => {
    const refreshFormOutputs = () => {
      renderPriceList();
      renderSummary();
      renderCalculation();
      renderProposal();
    };
    field.addEventListener("input", refreshFormOutputs);
    field.addEventListener("change", refreshFormOutputs);
  });

  fields.categoryFilter.addEventListener("change", renderPriceList);
  fields.eventDuration.addEventListener("change", renderAll);

  nodes.flowEventOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-flow-event]");
    if (!button) return;
    applyGuidedEvent(button.dataset.flowEvent);
  });

  nodes.flowBeverageOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-select-package]");
    if (!button) return;
    applyGuidedPackage(button.dataset.selectPackage);
  });

  nodes.flowFoodOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-select-package]");
    if (!button) return;
    applyGuidedPackage(button.dataset.selectPackage);
  });

  nodes.optionalPrivatizationControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-privatization-choice]");
    if (!button) return;
    state.privatizationChoice = button.dataset.privatizationChoice;
    renderSummary();
    renderCalculation();
    renderProposal();
  });

  nodes.privatizationRulesTable.addEventListener("input", (event) => {
    const { ruleIndex, ruleField } = event.target.dataset;
    if (ruleIndex === undefined || !ruleField) return;
    const rule = state.privatizationRules[Number(ruleIndex)];
    if (!rule) return;
    rule[ruleField] = event.target.value;
    savePrivatizationRules();
    renderSummary();
    renderCalculation();
    renderProposal();
  });

  fields.generalTerms.addEventListener("input", saveGeneralTerms);

  nodes.priceList.addEventListener("change", (event) => {
    const id = event.target.dataset.selectId;
    if (!id) return;
    if (event.target.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    saveSelectedIds();
    renderSummary();
    renderProposal();
  });

  nodes.pricesTable.addEventListener("input", (event) => {
    const { priceId, field } = event.target.dataset;
    if (!priceId || !field) return;
    const item = state.prices.find((price) => price.id === priceId);
    if (!item) return;
    item[field] = event.target.value;
    savePrices();
    renderPriceList();
    renderSummary();
    renderProposal();
  });

  nodes.pricesTable.addEventListener("change", (event) => {
    const { priceId, field } = event.target.dataset;
    if (!priceId || field !== "formula") return;
    const item = state.prices.find((price) => price.id === priceId);
    if (!item) return;
    item.formula = event.target.value;
    savePrices();
    renderAll();
  });

  document.querySelector("#printBtn").addEventListener("click", () => window.print());
  document.querySelector("#emailBtn").addEventListener("click", openEmail);
  document.querySelector("#saveProposalBtn").addEventListener("click", saveCurrentProposal);
  document.querySelector("#copyBtn").addEventListener("click", copyProposal);
  document.querySelector("#whatsappBtn").addEventListener("click", openWhatsApp);
  document.querySelector("#resetPricesBtn").addEventListener("click", resetPrices);
  document.querySelector("#clearFlowBtn").addEventListener("click", clearGuidedFlow);
  document.querySelector("#addItemBtn").addEventListener("click", createNewItem);
  document.querySelector("#saveSupabaseConfigBtn").addEventListener("click", configureSupabaseFromForm);
  document.querySelector("#loginBtn").addEventListener("click", loginWithEmail);
  document.querySelectorAll("[data-team-email]").forEach((button) => {
    button.addEventListener("click", () => {
      fields.loginEmail.value = button.dataset.teamEmail;
      fields.loginEmail.focus();
    });
  });
  document.querySelector("#recoverMagicLinkBtn").addEventListener("click", recoverMagicLinkSession);
  document.querySelector("#logoutBtn").addEventListener("click", logoutSupabase);
  document.querySelector("#refreshHistoryBtn").addEventListener("click", loadProposalHistory);
  document.querySelector("#refreshRequestsBtn").addEventListener("click", loadQuoteRequests);
  document.querySelector("#copyClientFormLinkBtn").addEventListener("click", copyClientFormLink);
  nodes.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-proposal-id]");
    if (!button) return;
    openSavedProposal(button.dataset.proposalId);
  });
  nodes.quoteRequestList.addEventListener("click", (event) => {
    const useButton = event.target.closest("button[data-use-request]");
    if (useButton) {
      applyQuoteRequest(useButton.dataset.useRequest);
      return;
    }
    const markButton = event.target.closest("button[data-mark-request]");
    if (markButton) markQuoteRequestAnalyzed(markButton.dataset.markRequest);
  });
}

renderCategoryFilter();
renderPrivatizationRulesTable();
renderClientFormLink();
fields.generalTerms.value = loadGeneralTerms();
bindEvents();
renderAll();
initSupabase();
