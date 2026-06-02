const STORAGE_KEY = "embaixada_orcamentos_precos_v1";
const PRODUCT_TYPES_KEY = "embaixada_orcamentos_tipos_produto_v1";
const SELECTED_KEY = "embaixada_orcamentos_selecionados_v1";
const PRIVATIZATION_KEY = "embaixada_orcamentos_privatizacao_v1";
const TERMS_KEY = "embaixada_orcamentos_condicoes_v1";
const SUPABASE_CONFIG_KEY = "embaixada_orcamentos_supabase_v1";
const INTEGRATION_LOG_KEY = "embaixada_orcamentos_envios_v1";
const COMMUNICATION_TEMPLATES_KEY = "embaixada_orcamentos_comunicacao_v1";
const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";
const CANONICAL_APP_URL = "https://leorangel22.github.io/main/";
const CANONICAL_CLIENT_FORM_URL = "https://leorangel22.github.io/main/formulario.html";
const CANONICAL_PUBLIC_PROPOSAL_URL = "https://leorangel22.github.io/main/proposta.html";
const TEAM_EMAILS = ["eventos@embaixadacarioca.com.br", "financeiro@embaixadacarioca.com.br", "leorangel@gmail.com"];
const SUPER_ADMIN_EMAILS = ["leorangel@gmail.com"];
const URL_PARAMS = new URLSearchParams(window.location.search);
const QA_MODE = URL_PARAMS.get("qa") === "1";
const QA_USER_EMAIL = "leorangel@gmail.com";
const TEAM_PROFILES = {
  "leorangel@gmail.com": {
    label: "Super admin",
    area: "Gestão",
    canManageFinance: true,
    canManageOperations: true,
    canManageCommercial: true,
  },
  "eventos@embaixadacarioca.com.br": {
    label: "Eventos",
    area: "Comercial e operação",
    canManageFinance: false,
    canManageOperations: true,
    canManageCommercial: true,
  },
  "financeiro@embaixadacarioca.com.br": {
    label: "Financeiro",
    area: "Pagamentos",
    canManageFinance: true,
    canManageOperations: false,
    canManageCommercial: false,
  },
};
const HUMAN_EVENTS_EMAIL = "eventos@embaixadacarioca.com.br";
const HUMAN_EVENTS_WHATSAPP = "+55 21 97142-6007";
const SERVICE_RATE = 0.12;
const paymentTerms = [
  "50% do valor total na confirmação da reserva.",
  "50% restante até 72 horas antes do evento.",
];
const DEFAULT_SIGNAL_DEADLINE_HOURS = 48;
const MIN_SIGNAL_DEADLINE_HOURS = 12;
const MAX_SIGNAL_DEADLINE_HOURS = 360;
const signalPaymentBanks = ["Itaú", "Santander", "Nubank", "Stone"];
const sourceClientTypeOptions = [
  "Agência de turismo receptivo / DMC",
  "Agência de marketing / eventos",
  "Empresa",
  "Pessoa física",
];
const sourceBudgetRangeOptions = [
  "Até R$ 15 mil",
  "R$ 15 mil a R$ 30 mil",
  "R$ 30 mil a R$ 60 mil",
  "Acima de R$ 60 mil",
  "Ainda não definido",
];
const sourceOriginOptions = [
  "Indicação",
  "Google / Instagram",
  "Agência / parceiro",
  "Negociado fora do sistema",
  "Já conheço o restaurante",
  "Parque Bondinho",
  "Outro",
];
const sourceMomentOptions = [
  "Manhã em dia de semana",
  "Início do almoço",
  "Fim de tarde",
  "Noite (19h-21h)",
  "Ainda estou avaliando",
];

const operationalChecklistItems = [
  { id: "saldo_agendado", label: "Pagamento restante alinhado" },
  { id: "cardapio_confirmado", label: "Cardápio e bebidas confirmados" },
  { id: "insumos_conferidos", label: "Lista de insumos conferida" },
  { id: "extras_confirmados", label: "Extras de produção confirmados" },
  { id: "responsavel_dia", label: "Contato responsável no dia definido" },
  { id: "operacao_avisada", label: "Operação avisada" },
  { id: "observacoes_revisadas", label: "Observações críticas revisadas" },
];

const funnelStages = [
  {
    id: "lead_recebido",
    row: "commercial",
    title: "LEAD",
    description: "Novo pedido. Identifique se é cliente direto, agência receptiva/DMC ou agência de marketing/eventos.",
    statuses: ["lead_recebido"],
  },
  {
    id: "proposta_enviada",
    row: "commercial",
    title: "SEM RESPOSTA",
    description: "Proposta enviada ao cliente, ainda sem retorno.",
    statuses: ["proposta_enviada"],
  },
  {
    id: "negociacao",
    row: "commercial",
    title: "NEGOCIAÇÃO",
    description: "Ajustes comerciais em andamento.",
    statuses: ["negociacao"],
  },
  {
    id: "confirmado",
    row: "commercial",
    title: "SINAL RECEBIDO",
    description: "Linha de chegada comercial: venda concluída e reserva confirmada.",
    statuses: ["confirmado"],
  },
  {
    id: "pagamento_final",
    row: "operation",
    title: "AGUARDANDO PAGAMENTO RESTANTE",
    description: "Cobrança do saldo final até 5 dias antes.",
    statuses: ["pagamento_final"],
  },
  {
    id: "planejamento",
    row: "operation",
    title: "PLANEJAMENTO",
    description: "Pagamento restante registrado. Preparação operacional do evento.",
    statuses: ["planejamento"],
  },
  {
    id: "evento_proximo",
    row: "operation",
    title: "EVENTOS HOJE E AMANHÃ",
    description: "Operação em atenção máxima para execução.",
    statuses: ["evento_proximo"],
  },
  {
    id: "pos_venda",
    row: "operation",
    title: "PÓS-VENDA",
    description: "Finalizado. Retorno e relacionamento.",
    statuses: ["pos_venda"],
  },
  {
    id: "cancelado",
    row: "archive",
    title: "Cancelados",
    description: "Leads e propostas encerrados.",
    statuses: ["cancelado"],
  },
];

const proposalStatusOptions = [
  "proposta_enviada",
  "negociacao",
  "confirmado",
  "pagamento_final",
  "planejamento",
  "evento_proximo",
  "pos_venda",
  "cancelado",
];

const requestStatusOptions = ["lead_recebido", "cancelado"];

const operationStatuses = new Set(["confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"]);

const cancelReasons = [
  "Cliente sem retorno",
  "Orçamento acima da expectativa",
  "Data ou horário indisponível",
  "Evento cancelado pelo cliente",
  "Fechou com outro local",
  "Teste / cadastro de teste",
  "Outro motivo",
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
  {
    id: "almoco-carioca-bebida-livre",
    codigo: "5",
    tipoEvento: "Almoço Carioca",
    nome: "Almoço Carioca - Bebida Livre",
    descricao:
      "Dias úteis, principalmente início do almoço. Entrada com pasteizinhos e caldinho de feijão, feijoada premiada, caipirinhas de 3 tipos, chope Heineken, 3 sucos naturais, refrigerantes, água e café espresso. Valor de 1h30 com taxa de serviço inclusa; finais de semana e feriados sob acréscimo de 30%.",
    preco1h: "",
    preco2h: 300,
    precoMeiaHoraExtra: 75,
    precoFixo: "",
    valorAdicional: "",
    minimo: 2,
    idioma: "",
    formula: "serviceIncluded90PerPerson",
  },
  {
    id: "almoco-carioca-duas-bebidas",
    codigo: "5",
    tipoEvento: "Almoço Carioca",
    nome: "Almoço Carioca - 2 Bebidas por Pessoa",
    descricao:
      "Dias úteis, principalmente início do almoço. Entrada com pasteizinhos e caldinho de feijão, feijoada premiada, bebidas limitadas a 2 por pessoa, sucos naturais, refrigerantes, água e café espresso. Valor de 1h30 com taxa de serviço inclusa; finais de semana e feriados sob acréscimo de 30%.",
    preco1h: "",
    preco2h: 250,
    precoMeiaHoraExtra: 50,
    precoFixo: "",
    valorAdicional: "",
    minimo: 2,
    idioma: "",
    formula: "serviceIncluded90PerPerson",
  },
];

const guidedEvents = {
  coquetel: {
    label: "Coquetel",
    category: "Coquetel",
    status: "Coquetel selecionado. Escolha bebidas, comidas e, se fizer sentido, adicione Welcome Drink e Workshop como complementos.",
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
  almoco: {
    label: "Almoço Carioca",
    category: "Almoço Carioca",
    status: "Almoço Carioca selecionado. Ideal para início do almoço em dias úteis; escolha bebida livre ou 2 bebidas por pessoa.",
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
  productTypes: loadProductTypes(),
  selectedIds: loadSelectedIds(),
  privatizationRules: loadPrivatizationRules(),
  supabase: null,
  session: null,
  proposals: [],
  quoteRequests: [],
  activeProposalId: "",
  activeQuoteRequestId: "",
  activeEditorContext: null,
  loadedEditorSignature: "",
  pendingOpenSourceLabel: "",
  pendingDashboardLeadId: "",
  pendingDashboardProposalId: "",
  lastAppliedDashboardTarget: "",
  activeReportPreset: "currentMonth",
  activePipelineFilter: "all",
  quoteGuideDismissed: false,
  sourceOverrides: {},
  manualSourceKey: "",
  guided: {
    event: "",
    beverageId: "",
    foodId: "",
    welcomeId: "",
    workshopId: "",
  },
  privatizationChoice: "",
  sendLocks: {
    email: false,
    whatsapp: false,
    auth: false,
  },
  sendReviewApprovedSignature: "",
  sendReviewApproval: null,
  lastSendReviewPointerApprovalAt: 0,
  integrationLogs: loadIntegrationLogs(),
  systemHealthChecks: [],
};

const fields = {
  clientName: document.querySelector("#clientName"),
  clientEmail: document.querySelector("#clientEmail"),
  clientPhone: document.querySelector("#clientPhone"),
  eventType: document.querySelector("#eventType"),
  eventDateTime: document.querySelector("#eventDateTime"),
  eventDate: document.querySelector("#eventDate"),
  eventTime: document.querySelector("#eventTime"),
  guestCount: document.querySelector("#guestCount"),
  eventDuration: document.querySelector("#eventDuration"),
  validity: document.querySelector("#validity"),
  signalDeadlineHours: document.querySelector("#signalDeadlineHours"),
  manualAdjustment: document.querySelector("#manualAdjustment"),
  manualAdjustmentLabel: document.querySelector("#manualAdjustmentLabel"),
  notes: document.querySelector("#notes"),
  eventReason: document.querySelector("#eventReason"),
  generalTerms: document.querySelector("#generalTerms"),
  searchPrice: document.querySelector("#searchPrice"),
  categoryFilter: document.querySelector("#categoryFilter"),
  newCodigo: document.querySelector("#newCodigo"),
  newTipo: document.querySelector("#newTipo"),
  newNome: document.querySelector("#newNome"),
  newFormula: document.querySelector("#newFormula"),
  formulaHelp: document.querySelector("#formulaHelp"),
  newDescricao: document.querySelector("#newDescricao"),
  newResumoComercial: document.querySelector("#newResumoComercial"),
  newPrioridadeComercial: document.querySelector("#newPrioridadeComercial"),
  newHorariosRecomendados: document.querySelector("#newHorariosRecomendados"),
  newProdutoAtivo: document.querySelector("#newProdutoAtivo"),
  newPreco1h: document.querySelector("#newPreco1h"),
  newPreco2h: document.querySelector("#newPreco2h"),
  newPrecoExtra: document.querySelector("#newPrecoExtra"),
  newPrecoFixo: document.querySelector("#newPrecoFixo"),
  newValorAdicional: document.querySelector("#newValorAdicional"),
  newMinimo: document.querySelector("#newMinimo"),
  newProductTypeName: document.querySelector("#newProductTypeName"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKey"),
  loginEmail: document.querySelector("#loginEmail"),
  magicLinkUrl: document.querySelector("#magicLinkUrl"),
  reportStartDate: document.querySelector("#reportStartDate"),
  reportEndDate: document.querySelector("#reportEndDate"),
  reportStatusFilter: document.querySelector("#reportStatusFilter"),
  reportKindFilter: document.querySelector("#reportKindFilter"),
  globalSearchInput: document.querySelector("#globalSearchInput"),
};

const nodes = {
  priceList: document.querySelector("#priceList"),
  pricesTable: document.querySelector("#pricesTable"),
  commercialLibrarySummary: document.querySelector("#commercialLibrarySummary"),
  productTypeList: document.querySelector("#productTypeList"),
  categoryOptions: document.querySelector("#categoryOptions"),
  flowStatus: document.querySelector("#flowStatus"),
  coquetelChoices: document.querySelector("#coquetelChoices"),
  flowEventOptions: document.querySelector("#flowEventOptions"),
  flowBeverageOptions: document.querySelector("#flowBeverageOptions"),
  flowFoodOptions: document.querySelector("#flowFoodOptions"),
  flowWelcomeOptions: document.querySelector("#flowWelcomeOptions"),
  flowWorkshopOptions: document.querySelector("#flowWorkshopOptions"),
  calculationBreakdown: document.querySelector("#calculationBreakdown"),
  privatizationTitle: document.querySelector("#privatizationTitle"),
  privatizationDescription: document.querySelector("#privatizationDescription"),
  optionalPrivatizationControls: document.querySelector("#optionalPrivatizationControls"),
  privatizationRulesTable: document.querySelector("#privatizationRulesTable"),
  grandTotal: document.querySelector("#grandTotal"),
  totalMeta: document.querySelector("#totalMeta"),
  selectedItems: document.querySelector("#selectedItems"),
  sendReviewPanel: document.querySelector("#sendReviewPanel"),
  proposalTotal: document.querySelector("#proposalTotal"),
  proposalContent: document.querySelector("#proposalContent"),
  supabaseStatus: document.querySelector("#supabaseStatus"),
  authStatus: document.querySelector("#authStatus"),
  historyList: document.querySelector("#historyList"),
  pipelineBoard: document.querySelector("#pipelineBoard"),
  ownerMetrics: document.querySelector(".owner-metrics"),
  metricStageLead: document.querySelector("#metricStageLead"),
  metricStageSemResposta: document.querySelector("#metricStageSemResposta"),
  metricStageNegociacao: document.querySelector("#metricStageNegociacao"),
  metricStageSinal: document.querySelector("#metricStageSinal"),
  metricStagePgRestante: document.querySelector("#metricStagePgRestante"),
  metricStagePlanejamento: document.querySelector("#metricStagePlanejamento"),
  metricStage48h: document.querySelector("#metricStage48h"),
  metricStagePosVenda: document.querySelector("#metricStagePosVenda"),
  periodMetrics: document.querySelector("#periodMetrics"),
  actionList: document.querySelector("#actionList"),
  actionCenterMeta: document.querySelector("#actionCenterMeta"),
  operationsAgenda: document.querySelector("#operationsAgenda"),
  operationsAgendaMeta: document.querySelector("#operationsAgendaMeta"),
  pipelineQuickFilters: document.querySelector("#pipelineQuickFilters"),
  loadedEditorBar: document.querySelector("#loadedEditorBar"),
  quoteEmptyState: document.querySelector("#quoteEmptyState"),
  reportOutput: document.querySelector("#reportOutput"),
  reportPresets: document.querySelector(".report-presets"),
  clientFormLink: document.querySelector("#clientFormLink"),
  availabilityAlert: document.querySelector("#availabilityAlert"),
  formSourcePanel: document.querySelector("#formSourcePanel"),
  serviceCockpit: document.querySelector("#serviceCockpit"),
  leadReviewPanel: document.querySelector("#leadReviewPanel"),
  proposalNextStep: document.querySelector("#proposalNextStep"),
  signalPaymentInfo: document.querySelector("#signalPaymentInfo"),
  operationalChecklist: document.querySelector("#operationalChecklist"),
  commercialTimeline: document.querySelector("#commercialTimeline"),
  internalNotesPanel: document.querySelector("#internalNotesPanel"),
  eventAttachmentsPanel: document.querySelector("#eventAttachmentsPanel"),
  financeCommandPanel: document.querySelector("#financeCommandPanel"),
  quickReplies: document.querySelector("#quickReplies"),
  startManualProposalBtn: document.querySelector("#startManualProposalBtn"),
  startRealizedEventBtn: document.querySelector("#startRealizedEventBtn"),
  jumpToPipelineBtn: document.querySelector("#jumpToPipelineBtn"),
  openNextPriorityBtn: document.querySelector("#openNextPriorityBtn"),
  globalSearchResults: document.querySelector("#globalSearchResults"),
  clientDirectory: document.querySelector("#clientDirectory"),
  clientRegistryMeta: document.querySelector("#clientRegistryMeta"),
  systemHealthSummary: document.querySelector("#systemHealthSummary"),
  systemHealthGrid: document.querySelector("#systemHealthGrid"),
  integrationLogList: document.querySelector("#integrationLogList"),
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function loadIntegrationLogs() {
  try {
    const saved = JSON.parse(localStorage.getItem(INTEGRATION_LOG_KEY) || "[]");
    return Array.isArray(saved) ? saved.slice(0, 30) : [];
  } catch (error) {
    console.warn("Não foi possível carregar diário de envios.", error);
    return [];
  }
}

function saveIntegrationLogs() {
  try {
    localStorage.setItem(INTEGRATION_LOG_KEY, JSON.stringify(state.integrationLogs.slice(0, 30)));
  } catch (error) {
    console.warn("Não foi possível salvar diário de envios.", error);
  }
}

function formatIntegrationLogTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createIntegrationLog({ channel, status = "pending", title, detail = "", target = "", meta = {} }) {
  const entry = {
    id: `envio-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    channel,
    status,
    title,
    detail,
    target,
    actor: state.session?.user?.email || "",
    meta,
  };
  state.integrationLogs = [entry, ...state.integrationLogs].slice(0, 30);
  saveIntegrationLogs();
  renderIntegrationLogs();
  return entry.id;
}

function updateIntegrationLog(id, patch = {}) {
  if (!id) return;
  state.integrationLogs = state.integrationLogs.map((entry) =>
    entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry,
  );
  saveIntegrationLogs();
  renderIntegrationLogs();
}

function getIntegrationLogLabel(entry = {}) {
  const statusLabels = {
    pending: "Aguardando",
    success: "Enviado",
    error: "Falhou",
    config: "Configuração",
    opened: "Aberto",
    canceled: "Cancelado",
  };
  const channelLabels = {
    whatsapp: "WhatsApp",
    email: "E-mail",
    health: "Saúde",
  };
  return `${channelLabels[entry.channel] || entry.channel || "Sistema"} · ${statusLabels[entry.status] || entry.status || "Registro"}`;
}

function renderIntegrationLogs() {
  if (!nodes.integrationLogList) return;
  if (!state.integrationLogs.length) {
    nodes.integrationLogList.innerHTML = `<p>Nenhum envio registrado neste navegador.</p>`;
    return;
  }

  nodes.integrationLogList.innerHTML = state.integrationLogs
    .slice(0, 12)
    .map(
      (entry) => `
        <article class="integration-log-entry is-${escapeHtml(entry.status || "pending")}">
          <div>
            <span>${escapeHtml(getIntegrationLogLabel(entry))}</span>
            <strong>${escapeHtml(entry.title || "Registro de envio")}</strong>
            <p>${escapeHtml(entry.detail || "Sem detalhes adicionais.")}</p>
          </div>
          <small>${escapeHtml([formatIntegrationLogTime(entry.updatedAt || entry.at), entry.target, entry.actor].filter(Boolean).join(" · "))}</small>
        </article>
      `,
    )
    .join("");
}

function loadPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return mergeCatalogLabels(saved).map(normalizeCatalogItem);
  } catch (error) {
    console.warn("Não foi possível carregar preços salvos.", error);
  }
  return clonePrices(initialPrices).map(normalizeCatalogItem);
}

function loadProductTypes() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRODUCT_TYPES_KEY) || "[]");
    return Array.isArray(saved) ? saved.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch (error) {
    console.warn("Não foi possível carregar tipos de produto.", error);
    return [];
  }
}

function saveProductTypes() {
  const types = [...new Set((state.productTypes || []).map((item) => String(item || "").trim()).filter(Boolean))].sort();
  state.productTypes = types;
  localStorage.setItem(PRODUCT_TYPES_KEY, JSON.stringify(types));
}

function mergeCatalogLabels(prices) {
  const catalogById = new Map(initialPrices.map((item) => [item.id, item]));
  const merged = prices.map((item) => {
    const catalogItem = catalogById.get(item.id);
    if (!catalogItem) return item;
    return {
      ...item,
      codigo: catalogItem.codigo,
      tipoEvento: catalogItem.tipoEvento,
      nome: catalogItem.nome,
      descricao: catalogItem.descricao,
      idioma: catalogItem.idioma,
      commercialSummary: item.commercialSummary || catalogItem.commercialSummary || catalogItem.descricao,
      priority: item.priority || getDefaultCommercialPriority(catalogItem),
      recommendedWindows: item.recommendedWindows || getDefaultRecommendedWindows(catalogItem),
      active: item.active !== false,
    };
  });
  const existingIds = new Set(merged.map((item) => item.id));
  initialPrices.forEach((item) => {
    if (!existingIds.has(item.id)) merged.push(clonePrices([item])[0]);
  });
  return merged;
}

function getDefaultCommercialPriority(item) {
  const type = normalizarTextoSeguro(item.tipoEvento);
  if (type.includes("coquetel") || type.includes("welcome") || type.includes("cafe") || type.includes("coffee")) return "alta";
  if (type.includes("snacks")) return "baixa";
  return "media";
}

function getDefaultRecommendedWindows(item) {
  const type = normalizarTextoSeguro(item.tipoEvento);
  if (type.includes("cafe") || type.includes("coffee")) return "Manhã de 2ª a 6ª";
  if (type.includes("almoco")) return "Início do almoço em dias úteis";
  if (type.includes("welcome") || type.includes("coquetel")) return "Após 17h e 19h-21h";
  if (type.includes("workshop")) return "Manhã, fim de tarde ou noite";
  return "Sob consulta";
}

function getCommercialCategoryMeta(item) {
  const rawType = String(item?.tipoEvento || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (rawType.includes("coquetel")) {
    return { key: "coquetel", caption: "Drinks e recepção com clima de celebração" };
  }
  if (rawType.includes("cafe") || rawType.includes("coffee")) {
    return { key: "cafe", caption: "Encontros matinais e pausas corporativas" };
  }
  if (rawType.includes("welcome")) {
    return { key: "welcome", caption: "Recepção elegante para começar o evento" };
  }
  if (rawType.includes("workshop")) {
    return { key: "workshop", caption: "Experiência interativa para grupos" };
  }
  if (rawType.includes("almoco")) {
    return { key: "almoco", caption: "Mesa farta no melhor horário do almoço" };
  }
  if (rawType.includes("comidas")) {
    return { key: "comidas", caption: "Complementos gastronômicos para compor a proposta" };
  }
  if (rawType.includes("snack")) {
    return { key: "snacks", caption: "Apoios rápidos e acolhimento leve" };
  }
  return { key: "generic", caption: "Formato sob medida para a proposta" };
}

function normalizeCatalogItem(item) {
  return {
    ...item,
    commercialSummary: item.commercialSummary || item.descricao || "",
    priority: item.priority || getDefaultCommercialPriority(item),
    recommendedWindows: item.recommendedWindows || getDefaultRecommendedWindows(item),
    active: item.active !== false,
  };
}

function loadSelectedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]"));
  } catch (error) {
    console.warn("Não foi possível carregar seleção salva.", error);
    return new Set();
  }
}

function loadPrivatizationRules() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRIVATIZATION_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (error) {
    console.warn("Não foi possível carregar regras de privatização salvas.", error);
  }
  return clonePrices(defaultPrivatizationRules);
}

function loadGeneralTerms() {
  try {
    const saved = localStorage.getItem(TERMS_KEY);
    if (saved && saved.trim()) return saved;
  } catch (error) {
    console.warn("Não foi possível carregar condições gerais salvas.", error);
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
    console.warn("Não foi possível carregar configuração do Supabase.", error);
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

function normalizarTextoSeguro(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function formatSignalPaymentDate(value) {
  return value ? formatDateFromIso(value) : "Data não informada";
}

function renderPaymentSummaryLine(title, payment) {
  if (!payment) return "";
  const banks = Array.isArray(payment.bancos) ? payment.bancos.join(", ") : payment.banco || "Banco não informado";
  const proofName = payment.comprovante?.nome || "";
  const proof = proofName
    ? `Comprovante anexado: ${
        payment.comprovante?.dataUrl
          ? `<a href="${escapeHtml(payment.comprovante.dataUrl)}" download="${escapeHtml(proofName)}">${escapeHtml(proofName)}</a>`
          : escapeHtml(proofName)
      }`
    : "Sem comprovante anexado";
  const differenceNote = payment.justificativaDiferenca
    ? `<small>Diferença justificada: ${escapeHtml(payment.justificativaDiferenca)}</small>`
    : "";
  const settlementNote = payment.pagamentoIntegral
    ? "<small>Pagamento integral registrado. Não há saldo restante para cobrar.</small>"
    : payment.saldoEstimado === 0
      ? "<small>Pagamento cobre o total do evento.</small>"
      : "";
  return `
    <span>${escapeHtml(title)}</span>
    <strong>${formatMoney(payment.valor)} · ${escapeHtml(formatSignalPaymentDate(payment.data))} · ${escapeHtml(banks)}</strong>
    <small>${proof}</small>
    ${settlementNote}
    ${differenceNote}
  `;
}

function renderSignalPaymentInfo(signal, remainingPayment = null) {
  if (!nodes.signalPaymentInfo) return;
  if (!signal && !remainingPayment) {
    nodes.signalPaymentInfo.classList.add("is-hidden");
    nodes.signalPaymentInfo.innerHTML = "";
    return;
  }

  nodes.signalPaymentInfo.classList.remove("is-hidden");
  nodes.signalPaymentInfo.innerHTML = `
    ${renderPaymentSummaryLine("Sinal registrado", signal)}
    ${renderPaymentSummaryLine("Pagamento restante registrado", remainingPayment)}
  `;
}

function getCommercialHistory(snapshot = {}) {
  return Array.isArray(snapshot.commercialHistory) ? snapshot.commercialHistory : [];
}

function getCommercialActor() {
  return state.session?.user?.email || "Equipe";
}

function getTeamProfile(email = state.session?.user?.email) {
  const normalized = normalizeEmail(email);
  return (
    TEAM_PROFILES[normalized] || {
      label: "Equipe",
      area: "Atendimento",
      canManageFinance: false,
      canManageOperations: true,
      canManageCommercial: true,
    }
  );
}

function getActorLabel(email = getCommercialActor()) {
  const profile = getTeamProfile(email);
  return `${email || "Equipe"} · ${profile.label}`;
}

function createCommercialHistoryEntry(type, title, detail, extra = {}) {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title,
    detail,
    at: new Date().toISOString(),
    actor: getCommercialActor(),
    actorRole: getTeamProfile().label,
    ...extra,
  };
}

function withCommercialHistoryEntries(snapshot = {}, entries = []) {
  const validEntries = entries.filter(Boolean);
  if (!validEntries.length) return snapshot;
  return {
    ...snapshot,
    commercialHistory: [...validEntries, ...getCommercialHistory(snapshot)].slice(0, 50),
  };
}

function getInternalComments(snapshot = {}) {
  return Array.isArray(snapshot.internalComments) ? snapshot.internalComments : [];
}

function getEventAttachments(snapshot = {}) {
  return Array.isArray(snapshot.eventAttachments) ? snapshot.eventAttachments : [];
}

function formatAuditChanges(changes = []) {
  if (!Array.isArray(changes) || !changes.length) return "";
  return changes
    .map((change) => `${change.label}: ${change.from || "vazio"} → ${change.to || "vazio"}`)
    .join(" · ");
}

function getProposalChangeList(previousSnapshot = {}, nextSnapshot = {}) {
  if (!previousSnapshot || !nextSnapshot) return [];
  const previousNames = (previousSnapshot.selectedItems || []).map((item) => item.nome).filter(Boolean).join(", ");
  const nextNames = (nextSnapshot.selectedItems || []).map((item) => item.nome).filter(Boolean).join(", ");
  const checks = [
    ["Cliente", previousSnapshot.client?.name, nextSnapshot.client?.name],
    ["E-mail", previousSnapshot.client?.email, nextSnapshot.client?.email],
    ["Celular", previousSnapshot.client?.phone, nextSnapshot.client?.phone],
    ["Tipo", previousSnapshot.event?.type, nextSnapshot.event?.type],
    ["Data", previousSnapshot.event?.date, nextSnapshot.event?.date],
    ["Horário", previousSnapshot.event?.time, nextSnapshot.event?.time],
    ["Convidados", previousSnapshot.event?.guests, nextSnapshot.event?.guests],
    ["Duração", previousSnapshot.event?.duration, nextSnapshot.event?.duration],
    ["Itens", previousNames, nextNames],
    ["Total", previousSnapshot.totals?.total ? formatMoney(previousSnapshot.totals.total) : "", nextSnapshot.totals?.total ? formatMoney(nextSnapshot.totals.total) : ""],
  ];
  return checks
    .filter(([, from, to]) => String(from || "") !== String(to || ""))
    .map(([label, from, to]) => ({ label, from: String(from || ""), to: String(to || "") }));
}

function formatCommercialHistoryDate(value) {
  if (!value) return "agora";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return "agora";
  }
}

function getDisplayCommercialHistory(proposal) {
  if (!proposal) return [];
  const snapshot = proposal.snapshot || {};
  const history = [...getCommercialHistory(snapshot)];
  const hasType = (type) => history.some((entry) => entry.type === type);

  if (proposal.cliente_resposta && !hasType("cliente_resposta")) {
    history.push({
      id: `client-${proposal.id}`,
      type: "cliente_resposta",
      title: getClientResponseLabel(proposal.cliente_resposta),
      detail: proposal.cliente_mensagem || "Resposta registrada pelo link público.",
      at: proposal.cliente_resposta_em || proposal.updated_at,
      actor: "Cliente",
    });
  }

  if (snapshot.pagamentoSinal && !hasType("sinal")) {
    history.push({
      id: `signal-${proposal.id}`,
      type: "sinal",
      title: "Sinal registrado",
      detail: `${formatMoney(snapshot.pagamentoSinal.valor)} · ${formatSignalPaymentDate(snapshot.pagamentoSinal.data)} · ${(snapshot.pagamentoSinal.bancos || []).join(", ")}`,
      at: snapshot.pagamentoSinal.registradoEm || proposal.updated_at,
      actor: snapshot.pagamentoSinal.registradoPor || "Equipe",
    });
  }

  if (snapshot.pagamentoRestante && !hasType("pagamento_restante")) {
    history.push({
      id: `remaining-${proposal.id}`,
      type: "pagamento_restante",
      title: "Pagamento restante registrado",
      detail: `${formatMoney(snapshot.pagamentoRestante.valor)} · ${formatSignalPaymentDate(snapshot.pagamentoRestante.data)} · ${(snapshot.pagamentoRestante.bancos || []).join(", ")}`,
      at: snapshot.pagamentoRestante.registradoEm || proposal.updated_at,
      actor: snapshot.pagamentoRestante.registradoPor || "Equipe",
    });
  }

  if (snapshot.cancelamento && !hasType("cancelamento")) {
    history.push({
      id: `cancel-${proposal.id}`,
      type: "cancelamento",
      title: "Cancelamento registrado",
      detail: snapshot.cancelamento.motivo || "Sem motivo informado.",
      at: snapshot.cancelamento.canceladoEm || proposal.updated_at,
      actor: snapshot.cancelamento.canceladoPor || "Equipe",
    });
  }

  return history.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 30);
}

function getLifecycleStages() {
  return funnelStages.filter((stage) => ["commercial", "operation"].includes(stage.row));
}

function getLifecycleStageIndex(stageId) {
  return getLifecycleStages().findIndex((stage) => stage.id === stageId);
}

function getLifecycleStepCopy(stageId) {
  const copy = {
    lead_recebido: "Lead recebido e contexto inicial capturado.",
    proposta_enviada: "Proposta pronta para envio e acompanhamento.",
    negociacao: "Ajustes comerciais e retorno do cliente em andamento.",
    confirmado: "Sinal registrado e reserva confirmada.",
    pagamento_final: "Saldo final alinhado ou aguardando confirmação.",
    planejamento: "Operação revisando cardápio, extras e responsáveis.",
    evento_proximo: "Evento na janela de execução de hoje ou amanhã.",
    pos_venda: "Evento concluído e relacionamento em pós-venda.",
  };
  return copy[stageId] || "Etapa em andamento.";
}

function getHistoryEntryForStage(proposal, stageId) {
  const history = getDisplayCommercialHistory(proposal);
  const labels = {
    proposta_enviada: "Proposta enviada",
    negociacao: "Negociação",
    confirmado: "Sinal registrado",
    pagamento_final: "Pagamento restante registrado",
    planejamento: "Etapa alterada",
    evento_proximo: "Etapa alterada",
    pos_venda: "Etapa alterada",
  };
  const label = labels[stageId];
  if (!label) return null;
  return history.find((entry) => {
    const title = String(entry.title || "").toLowerCase();
    const detail = String(entry.detail || "").toLowerCase();
    if (stageId === "planejamento") return title.includes("etapa alterada") && detail.includes("planejamento");
    if (stageId === "evento_proximo") return title.includes("etapa alterada") && detail.includes("eventos hoje e amanhã");
    if (stageId === "pos_venda") return title.includes("etapa alterada") && detail.includes("pós-venda");
    return title.includes(label.toLowerCase()) || detail.includes(label.toLowerCase());
  });
}

function getLifecycleStepTimestamp(proposal, stageId, stateLabel) {
  const snapshot = proposal.snapshot || {};
  if (stageId === "lead_recebido") return proposal.created_at;
  if (stageId === "confirmado") {
    return snapshot.pagamentoSinal?.registradoEm || snapshot.pagamentoSinal?.data || getHistoryEntryForStage(proposal, stageId)?.at || "";
  }
  if (stageId === "pagamento_final") {
    return (
      snapshot.pagamentoRestante?.registradoEm ||
      snapshot.pagamentoRestante?.data ||
      getHistoryEntryForStage(proposal, stageId)?.at ||
      (stateLabel !== "upcoming" ? proposal.updated_at : "")
    );
  }
  return getHistoryEntryForStage(proposal, stageId)?.at || (stateLabel !== "upcoming" ? proposal.updated_at : "");
}

function getProposalLifecycle(proposal) {
  if (!proposal) return [];
  const currentStage = getPipelineStage(proposal.status);
  const currentIndex = getLifecycleStageIndex(currentStage);
  return getLifecycleStages().map((stage, index) => {
    const stateLabel = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
    const timestamp = getLifecycleStepTimestamp(proposal, stage.id, stateLabel);
    return {
      id: stage.id,
      title: getProposalStatusLabel(stage.statuses[0]),
      detail: getLifecycleStepCopy(stage.id),
      state: stateLabel,
      timestamp,
    };
  });
}

function isRoutineProposalUpdate(entry = {}) {
  return entry.type === "proposta" && String(entry.title || "").toLowerCase().includes("atualizada");
}

function isTechnicalHistoryEntry(entry = {}) {
  if (isRoutineProposalUpdate(entry)) return true;
  const text = `${entry.title || ""} ${entry.detail || ""}`.toLowerCase();
  if (entry.type !== "auditoria") return false;
  return !text.includes("cancel") && !text.includes("etapa") && !text.includes("sinal") && !text.includes("pagamento");
}

function getHistoryTone(entry = {}) {
  const text = `${entry.type || ""} ${entry.title || ""}`.toLowerCase();
  if (entry.type === "proposta_agrupada") return "muted";
  if (entry.type === "tecnico_agrupado") return "muted";
  if (entry.type === "auditoria") return "audit";
  if (entry.type === "comentario") return "client";
  if (entry.type === "anexo") return "operation";
  if (text.includes("cancel")) return "danger";
  if (text.includes("sinal") || text.includes("pagamento")) return "money";
  if (text.includes("whatsapp") || text.includes("enviada")) return "sent";
  if (text.includes("cliente")) return "client";
  if (text.includes("etapa")) return "stage";
  if (text.includes("checklist")) return "operation";
  if (isRoutineProposalUpdate(entry)) return "muted";
  return "proposal";
}

function getHistoryBadge(entry = {}) {
  const tone = getHistoryTone(entry);
  const labels = {
    danger: "ALERTA",
    money: "PAG",
    sent: "ENVIO",
    client: "CLIENTE",
    stage: "ETAPA",
    operation: "OP",
    audit: "EQUIPE",
    muted: "AJUSTE",
    proposal: "PROP",
  };
  return labels[tone] || "LOG";
}

function getCompactCommercialHistory(history = []) {
  const routineUpdates = history.filter(isRoutineProposalUpdate);
  const technicalEntries = history.filter((entry) => isTechnicalHistoryEntry(entry) && !isRoutineProposalUpdate(entry));
  const keyEntries = history.filter((entry) => !isRoutineProposalUpdate(entry) && !isTechnicalHistoryEntry(entry));
  const visible = keyEntries.slice(0, 7);

  if (routineUpdates.length) {
    const latestUpdate = routineUpdates[0];
    const groupedEntry = {
      id: "proposal-updates-group",
      type: "proposta_agrupada",
      title: `${routineUpdates.length} ajuste(s) de proposta agrupado(s)`,
      detail: latestUpdate.detail
        ? `Último ajuste: ${latestUpdate.detail}`
        : "Alterações de valor, itens ou dados comerciais ficaram agrupadas para manter a leitura limpa.",
      at: latestUpdate.at,
      actor: latestUpdate.actor || "Equipe",
      groupedCount: routineUpdates.length,
    };
    const insertionIndex = Math.min(visible.length, 3);
    visible.splice(insertionIndex, 0, groupedEntry);
  }

  if (technicalEntries.length) {
    const latestTechnical = technicalEntries[0];
    const groupedTechnicalEntry = {
      id: "technical-updates-group",
      type: "tecnico_agrupado",
      title: `${technicalEntries.length} ajuste(s) interno(s) agrupado(s)`,
      detail: "Edições repetidas ficam compactadas para priorizar decisões comerciais.",
      at: latestTechnical.at,
      actor: latestTechnical.actor || "Equipe",
      groupedCount: technicalEntries.length,
    };
    const insertionIndex = Math.min(visible.length, routineUpdates.length ? 4 : 3);
    visible.splice(insertionIndex, 0, groupedTechnicalEntry);
  }

  return {
    visible: visible.slice(0, 8),
    routineCount: routineUpdates.length,
    technicalCount: technicalEntries.length,
    keyCount: keyEntries.length,
  };
}

function hasIncompleteChecklist(snapshot = {}) {
  const progress = getChecklistProgress(snapshot);
  return progress.done < progress.total;
}

function getActiveQuoteRequest() {
  return state.quoteRequests.find((item) => item.id === state.activeQuoteRequestId) || null;
}

function getProposalNextStepConfig() {
  const proposal = getActiveProposal();
  const request = getActiveQuoteRequest();
  if (proposal) {
    const status = normalizeProposalStatus(proposal.status);
    const progress = getChecklistProgress(proposal.snapshot || {});
    const hasSignal = Boolean(proposal.snapshot?.pagamentoSinal);
    const paymentCoverage = getPaymentCoverage(proposal.total || proposal.snapshot?.totals?.total || 0, proposal.snapshot?.pagamentoSinal, proposal.snapshot?.pagamentoRestante);

    if (status === "proposta_enviada" && proposal.clientResponse === "confirmar") {
      return {
        tone: "success",
        title: "Registrar sinal e travar a reserva",
        note: "O cliente já aprovou a proposta. O próximo movimento é registrar o sinal para tirar o evento da zona comercial e confirmar a data.",
        action: "mark_signal",
        actionLabel: "Registrar sinal",
      };
    }

    if (status === "proposta_enviada") {
      return {
        tone: "commercial",
        title: "Enviar o link público e acompanhar retorno",
      note: "Gere o link, envie ao cliente e acompanhe o retorno nas próximas horas.",
        action: "copy_link",
        actionLabel: "Copiar link público",
      };
    }

    if (status === "negociacao") {
      return {
        tone: "warning",
        title: "Refinar a proposta e reenviar",
        note: proposal.clientResponse === "alteracao"
          ? "Cliente pediu ajuste. Revise e reenvie com agilidade."
          : "Negociação ativa. Defina o próximo passo.",
        action: "focus_items",
        actionLabel: "Ir para itens",
      };
    }

    if (status === "confirmado" && !paymentCoverage.isFullyPaid) {
      return {
        tone: "success",
        title: "Cobrar e registrar o pagamento restante",
        note: "Sinal registrado. Alinhe o saldo para liberar planejamento.",
        action: "mark_remaining",
        actionLabel: "Registrar saldo",
      };
    }

    if (status === "confirmado" && paymentCoverage.isFullyPaid) {
      return {
        tone: "success",
        title: "Pagamento completo. Enviar para planejamento",
        note: "Pagamento completo. Libere operação, extras e responsáveis.",
        action: "focus_checklist",
        actionLabel: "Planejar evento",
      };
    }

    if (["pagamento_final", "planejamento"].includes(status) && hasIncompleteChecklist(proposal.snapshot || {})) {
      return {
        tone: "operation",
        title: "Fechar o checklist operacional",
        note: `${progress.done}/${progress.total} itens concluídos. Revise responsáveis, extras e observações.`,
        action: "focus_checklist",
        actionLabel: "Ver checklist",
      };
    }

    if (status === "evento_proximo") {
      return {
        tone: "operation",
        title: "Revisar detalhes finais da execução",
        note: "Evento hoje ou amanhã. Faça a leitura final de operação.",
        action: "focus_checklist",
        actionLabel: "Revisar operação",
      };
    }

    if (status === "pos_venda") {
      return {
        tone: "neutral",
        title: "Registrar retorno e próximos passos",
        note: "Evento entregue. Vale registrar aprendizados, retorno do cliente e oportunidade de relacionamento.",
        action: "focus_notes",
        actionLabel: "Ir para observações",
      };
    }

    if (!hasSignal) {
      return {
        tone: "commercial",
        title: "Salvar proposta e avançar no funil",
        note: "Deixe a proposta salva com o status correto para o time não perder histórico nem contexto comercial.",
        action: "save_proposal",
        actionLabel: "Salvar proposta",
      };
    }
  }

  const hasDraft = fields.clientName.value.trim() || fields.eventType.value.trim() || state.selectedIds.size;
  if (state.manualSourceKey === "manual:realized") {
    return {
      tone: "operation",
      title: "Registrar evento realizado",
      note: "Preencha cliente, data, pax, itens e valor. Ao salvar, o sistema pergunta o pagamento recebido e manda direto para Pós-venda.",
      action: "save_realized_event",
      actionLabel: "Salvar e registrar pagamento",
    };
  }

  if (request || hasDraft) {
    return {
      tone: "commercial",
      title: "Salvar proposta enviada e começar o acompanhamento",
      note: "Salve a proposta para entrar no funil e seguir com envio e retorno.",
      action: "save_proposal",
      actionLabel: "Salvar proposta",
    };
  }

  return null;
}

function renderProposalNextStep() {
  if (!nodes.proposalNextStep) return;
  const config = getProposalNextStepConfig();
  if (!config) {
    nodes.proposalNextStep.className = "proposal-next-step is-hidden";
    nodes.proposalNextStep.innerHTML = "";
    return;
  }
  nodes.proposalNextStep.className = `proposal-next-step proposal-next-step-${config.tone}`;
  nodes.proposalNextStep.innerHTML = `
    <div class="proposal-next-step-heading">
      <span>Próximo passo sugerido</span>
      <strong>${escapeHtml(config.title)}</strong>
    </div>
    <div class="proposal-next-step-body">
      <p>${escapeHtml(config.note)}</p>
      <button class="secondary" type="button" data-next-step-action="${escapeHtml(config.action)}">${escapeHtml(config.actionLabel)}</button>
    </div>
  `;
}

function getActiveServiceContext() {
  const proposal = getActiveProposal();
  const request = getActiveQuoteRequest();
  const context = getActiveCommercialContext();
  const snapshot = proposal?.snapshot || request?.snapshot || {};
  const client = snapshot.client || snapshot.cliente || {};
  const contact = getCurrentContactValues();
  const qualification = snapshot.qualificacao || snapshot.qualification || {};
  return {
    proposal,
    request,
    snapshot,
    clientName: contact.name || "Cliente",
    company:
      proposal?.snapshot?.client?.company ||
      request?.empresa ||
      request?.cliente_empresa ||
      client.company ||
      "",
    email: contact.email,
    phone: contact.phone,
    eventType: getCurrentEventType() || proposal?.tipo_evento || request?.tipo_evento || "Evento",
    eventDate: fields.eventDate.value || proposal?.data_evento || request?.data_evento || "",
    eventTime: fields.eventTime.value || proposal?.horario_evento || request?.horario_evento || "",
    guests: getGuestCount() || Number(proposal?.convidados || request?.convidados || 0) || 0,
    duration: getDuration() || Number(proposal?.duracao || request?.duracao || 1) || 1,
    clientType: context.clientType || qualification.tipoCliente || "Cliente a classificar",
    budgetRange: context.budgetRange || qualification.faixaInvestimento || "Sem faixa informada",
    origin: context.origin || qualification.origem || "Origem não informada",
    occasion: context.occasion || "",
    extras: context.extras || "",
    status: proposal?.status || request?.status || "lead_recebido",
  };
}

function getServiceClientMatch(context = getActiveServiceContext()) {
  const clients = getClientRegistry(getPipelineItems());
  const email = normalizeSearchValue(context.email);
  const phone = String(context.phone || "").replace(/\D/g, "");
  const company = normalizeSearchValue(context.company);
  const name = normalizeSearchValue(context.clientName);
  return (
    clients.find((client) => email && normalizeSearchValue(client.email) === email) ||
    clients.find((client) => phone && String(client.phone || "").replace(/\D/g, "") === phone) ||
    clients.find((client) => company && normalizeSearchValue(client.company) === company) ||
    clients.find((client) => name && normalizeSearchValue(client.name) === name) ||
    null
  );
}

function getServiceTemplateRecommendation(context = getActiveServiceContext()) {
  const eventKey = getGuidedEventKeyFromType(context.eventType) || state.guided.event || "";
  const template = smartEventTemplates[eventKey] || null;
  const category = getEventCategoryFromRequest(context.eventType) || template?.label || "Formato a definir";
  const selected = getSelectedItems();
  const templateIds = template?.ids?.filter(itemExists) || [];
  const missingIds = templateIds.filter((id) => !state.selectedIds.has(id));
  const isApplied = Boolean(templateIds.length) && missingIds.length === 0;
  return {
    eventKey,
    template,
    category,
    selected,
    templateIds,
    isApplied,
    title: template?.label || category,
    detail: template
      ? `${templateIds.length} ${templateIds.length === 1 ? "item sugerido" : "itens sugeridos"} para começar rápido.`
      : "Escolha o formato para o app sugerir os itens base.",
  };
}

function getServiceApproachTip(context = getActiveServiceContext(), recommendation = getServiceTemplateRecommendation(context), readiness = getLeadReadinessItems()) {
  const firstError = readiness.find((item) => item.status === "error");
  if (firstError) {
    return `Comece por ${firstError.label.toLowerCase()}: ${firstError.detail}`;
  }
  if (!recommendation.selected.length) {
    return "Escolha o formato antes de falar em valor. Fica mais claro para o cliente.";
  }
  const type = normalizarTextoSeguro(context.eventType || recommendation.category || "");
  if (type.includes("cafe") || type.includes("break") || type.includes("brunch")) {
    return "Destaque Morro da Urca, vista e pontualidade. Depois confirme se precisa reforço.";
  }
  if (type.includes("almoco")) {
    return "Confirme chegada e perfil. Venda o Almoço Carioca como pausa completa.";
  }
  if (type.includes("coquetel")) {
    return "Confirme se será só bebidas ou experiência com comidas e, se fizer sentido, workshop.";
  }
  if (type.includes("welcome")) {
    return "Venda como recepção elegante e rápida. Pergunte se snack ajuda o grupo.";
  }
  if (type.includes("workshop")) {
    return "Destaque experiência interativa, memória do Rio e integração do grupo.";
  }
  return "Confirme objetivo, horário e perfil. A proposta deve parecer feita para o cliente.";
}

function getUpsellOfferLine(item) {
  const text = normalizarTextoSeguro(`${item.title || ""} ${item.detail || ""}`);
  if (text.includes("brasileiro") || text.includes("snack")) {
    return "Pergunte se o grupo vai precisar de algo para acompanhar as bebidas.";
  }
  if (text.includes("workshop") || text.includes("experiencia")) {
    return "Ofereça como experiência memorável, principalmente para agência, DMC e relacionamento.";
  }
  if (text.includes("cafe completo")) {
    return "Sugira quando a reunião for longa ou o público for mais premium.";
  }
  if (text.includes("bebida livre")) {
    return "Apresente como conforto e previsibilidade para o cliente e para a operação.";
  }
  if (text.includes("espumante")) {
    return "Use para chegada mais elegante, lançamento ou convidados especiais.";
  }
  return "Ofereça como opção, sem pressionar: ajuda a deixar a experiência mais completa.";
}

function getServiceCockpitStatus(readiness, recommendation) {
  const errors = readiness.filter((item) => item.status === "error");
  const warnings = readiness.filter((item) => item.status === "warning");
  if (errors.length) {
    return {
      tone: "danger",
      label: "Antes de enviar",
      title: "Corrija para enviar",
      detail: `${errors.length} pendência(s) travam a proposta. Comece por ${errors[0].label.toLowerCase()}.`,
    };
  }
  if (!recommendation.selected.length) {
    return {
      tone: "warning",
      label: "Atendimento guiado",
      title: "Aplique uma proposta base",
      detail: "Os dados do lead estão encaminhados. Falta escolher o pacote principal.",
    };
  }
  if (warnings.length) {
    return {
      tone: "attention",
      label: "Pode avançar",
      title: "Revise os alertas comerciais",
      detail: `${warnings.length} ${warnings.length === 1 ? "ponto melhora" : "pontos melhoram"} a conversão.`,
    };
  }
  return {
    tone: "ready",
    label: "Pronto",
    title: "Proposta pronta para enviar",
    detail: "Dados, itens, valor e próximos passos estão alinhados.",
  };
}

function renderServiceCockpit() {
  if (!nodes.serviceCockpit) return;
  if (isQuoteWorkspaceEffectivelyEmpty()) {
    nodes.serviceCockpit.className = "service-cockpit is-hidden";
    nodes.serviceCockpit.innerHTML = "";
    return;
  }

  const context = getActiveServiceContext();
  const readiness = getLeadReadinessItems();
  const recommendation = getServiceTemplateRecommendation(context);
  const cockpitStatus = getServiceCockpitStatus(readiness, recommendation);
  const nextStep = getProposalNextStepConfig();
  const firstBlockingItem = readiness.find((item) => item.status === "error");
  const reviewGuide = getReviewGuide(readiness, false);
  const reviewTargetAction =
    reviewGuide.target === "items"
      ? "focus_items"
      : reviewGuide.target === "review"
        ? "focus_review"
        : reviewGuide.target === "notes"
          ? "focus_notes"
          : "focus_client";
  const fallbackAction = {
    tone: cockpitStatus.tone,
    title: cockpitStatus.title,
    note: cockpitStatus.detail,
    action: recommendation.eventKey ? "apply_recommended_template" : "focus_items",
    actionLabel: recommendation.eventKey ? "Aplicar base" : "Ir para itens",
  };
  const primaryAction = firstBlockingItem
    ? {
        tone: "danger",
        title: reviewGuide.title,
        note: reviewGuide.detail,
        action: reviewTargetAction,
        actionLabel: reviewGuide.actionLabel,
      }
    : nextStep || fallbackAction;
  const clientMatch = getServiceClientMatch(context);
  const soldCount = clientMatch?.items?.filter((item) => item.kind === "proposal" && operationStatuses.has(normalizeProposalStatus(item.status))).length || 0;
  const quotesCount = clientMatch?.items?.length || 0;
  const totalValue = clientMatch?.totalValue || 0;
  const criticalItems = readiness.filter((item) => item.status !== "ok").slice(0, 4);
  const okItems = readiness.filter((item) => item.status === "ok").length;
  const eventDateLabel = context.eventDate ? formatDateFromIso(context.eventDate) : "Data a definir";
  const eventTimeLabel = context.eventTime ? String(context.eventTime).slice(0, 5) : "Horário a definir";
  const selectedSummary = recommendation.selected.length
    ? recommendation.selected.map((item) => item.nome).slice(0, 2).join(" + ") + (recommendation.selected.length > 2 ? "..." : "")
    : "Nenhum item selecionado";
  const approachTip = firstBlockingItem
    ? `${reviewGuide.title}. Toque em "${reviewGuide.actionLabel}" ou na pendência abaixo; o sistema leva ao campo certo.`
    : getServiceApproachTip(context, recommendation, readiness);

  nodes.serviceCockpit.className = `service-cockpit is-${cockpitStatus.tone}`;
  nodes.serviceCockpit.innerHTML = `
    <div class="service-cockpit-head">
      <div>
        <span>${escapeHtml(cockpitStatus.label)}</span>
        <strong>${escapeHtml(cockpitStatus.title)}</strong>
        <small>${escapeHtml(cockpitStatus.detail)}</small>
      </div>
      <div class="service-cockpit-progress" aria-label="Checklist inteligente">
        <b>${escapeHtml(String(okItems))}/${escapeHtml(String(readiness.length))}</b>
        <small>pontos OK</small>
      </div>
    </div>
    <div class="service-mobile-path" aria-label="Rota rápida para atendimento no celular">
      <button type="button" data-service-next-action="focus_client">
        <span>1</span>
        <strong>Lead</strong>
        <small>contato, data e pax</small>
      </button>
      <button type="button" data-service-next-action="focus_items">
        <span>2</span>
        <strong>Itens</strong>
        <small>cardápio e valor</small>
      </button>
      <button type="button" data-service-next-action="focus_review">
        <span>3</span>
        <strong>Checklist</strong>
        <small>revisar e enviar</small>
      </button>
    </div>
    <div class="service-coach-note">
      <span>Como conduzir</span>
      <strong>${escapeHtml(approachTip)}</strong>
    </div>
    <div class="service-cockpit-grid">
      <article class="service-cockpit-card service-lead-summary">
        <span>Resumo para abordagem</span>
        <strong>${escapeHtml(context.clientName)}${context.company ? ` · ${escapeHtml(context.company)}` : ""}</strong>
        <p>${escapeHtml(eventDateLabel)} · ${escapeHtml(eventTimeLabel)} · ${escapeHtml(String(context.guests || 0))} pax · ${escapeHtml(context.eventType)}</p>
        <small>${escapeHtml(context.clientType)} · ${escapeHtml(context.budgetRange)} · ${escapeHtml(context.origin)}</small>
      </article>
      <article class="service-cockpit-card service-template-card">
        <span>Proposta recomendada</span>
        <strong>${escapeHtml(recommendation.title)}</strong>
        <p>${escapeHtml(recommendation.isApplied ? `Aplicada: ${selectedSummary}` : recommendation.detail)}</p>
        <button class="secondary" type="button" data-service-action="apply_recommended_template">
          ${escapeHtml(recommendation.isApplied ? "Reaplicar base" : recommendation.eventKey ? "Aplicar em 1 clique" : "Escolher formato")}
        </button>
      </article>
      <article class="service-cockpit-card service-client-context">
        <span>Histórico do cliente</span>
        <strong>${escapeHtml(clientMatch ? `${quotesCount} registro(s) · ${soldCount} venda(s)` : "Novo relacionamento")}</strong>
        <p>${
          clientMatch
            ? `Total registrado: ${escapeHtml(formatMoney(totalValue))}. Use o histórico para ajustar abordagem e acompanhamento.`
            : "Ainda sem histórico encontrado. Capriche no primeiro contato e registre os próximos passos."
        }</p>
        ${
          clientMatch?.items?.[0]
            ? `<button class="ghost-button" type="button" data-service-action="open_client_last" data-service-target="${escapeHtml(clientMatch.items[0].id)}" data-service-kind="${escapeHtml(clientMatch.items[0].kind)}">Abrir último</button>`
            : ""
        }
      </article>
      <article class="service-cockpit-card service-next-card is-${escapeHtml(primaryAction.tone || cockpitStatus.tone)}">
        <span>O que fazer agora</span>
        <strong>${escapeHtml(primaryAction.title)}</strong>
        <p>${escapeHtml(primaryAction.note)}</p>
        <button class="primary" type="button" data-service-next-action="${escapeHtml(primaryAction.action)}">${escapeHtml(primaryAction.actionLabel)}</button>
      </article>
    </div>
    <div class="service-cockpit-bottom">
      <div class="service-checklist-mini">
        ${
          criticalItems.length
            ? criticalItems
                .map(
                  (item) => `
                    <button class="service-check-mini is-${escapeHtml(item.status)}" type="button" data-service-review-target="${escapeHtml(item.target)}">
                      <b>${item.status === "error" ? "!" : "?"}</b>
                      <span>${escapeHtml(item.label)}</span>
                    </button>
                  `,
                )
                .join("")
            : `<span class="service-check-mini is-ok"><b>OK</b><span>Checklist pronto</span></span>`
        }
      </div>
      <small class="service-cockpit-hint">No celular, siga a rota rápida ou toque em uma pendência para ir direto ao campo certo.</small>
    </div>
  `;
}

function renderCommercialTimeline(proposal = getActiveProposal()) {
  if (!nodes.commercialTimeline) return;
  if (!proposal) {
    nodes.commercialTimeline.classList.add("is-hidden");
    nodes.commercialTimeline.innerHTML = "";
    return;
  }

  const history = getDisplayCommercialHistory(proposal);
  const compactHistory = getCompactCommercialHistory(history);
  const lastRelevantEntry = compactHistory.visible.find((entry) => entry.id !== "proposal-updates-group") || history[0] || null;
  const lifecycle = getProposalLifecycle(proposal);
  const timelineSummaryCards = getTimelineSummaryCards(proposal, compactHistory, lastRelevantEntry);
  nodes.commercialTimeline.classList.remove("is-hidden");
  nodes.commercialTimeline.innerHTML = `
    <div class="timeline-heading">
      <div>
        <span>Histórico comercial</span>
        <strong>${compactHistory.keyCount || history.length || 0} ações relevantes</strong>
      </div>
      ${
        lastRelevantEntry
          ? `<p>Último movimento: <b>${escapeHtml(lastRelevantEntry.title || "Atualização")}</b> · ${escapeHtml(formatCommercialHistoryDate(lastRelevantEntry.at))}</p>`
          : `<p>Salve, envie ou registre pagamentos para criar o histórico deste evento.</p>`
      }
    </div>
    <div class="timeline-executive-summary">
      ${timelineSummaryCards
        .map(
          (card) => `
            <article class="timeline-summary-card is-${escapeHtml(card.tone)}">
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(card.value)}</strong>
              <small>${escapeHtml(card.detail)}</small>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="timeline-progress">
      ${lifecycle
        .map(
          (step) => `
            <article class="timeline-step is-${escapeHtml(step.state)}">
              <span>${escapeHtml(step.title)}</span>
              <strong>${
                step.state === "done" ? "Concluído" : step.state === "current" ? "Etapa atual" : "Próxima etapa"
              }</strong>
              <small>${escapeHtml(step.timestamp ? formatCommercialHistoryDate(step.timestamp) : step.detail)}</small>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="timeline-list">
      ${
        compactHistory.visible.length
          ? compactHistory.visible
              .map(
                (entry) => `
                  <article class="timeline-entry is-${escapeHtml(getHistoryTone(entry))}">
                    <span class="timeline-entry-badge">${escapeHtml(getHistoryBadge(entry))}</span>
                    <div class="timeline-entry-main">
                      <strong>${escapeHtml(entry.title || "Atualização")}</strong>
                      <small>${escapeHtml(entry.detail || "")}</small>
                      ${
                        Array.isArray(entry.changes) && entry.changes.length
                          ? `<ul class="timeline-change-list">${entry.changes
                              .map(
                                (change) =>
                                  `<li><b>${escapeHtml(change.label)}</b><span>${escapeHtml(change.from || "vazio")} → ${escapeHtml(change.to || "vazio")}</span></li>`,
                              )
                              .join("")}</ul>`
                          : ""
                      }
                    </div>
                    <div class="timeline-entry-meta">
                      <span>${escapeHtml(formatCommercialHistoryDate(entry.at))}</span>
                      <em>${escapeHtml(entry.actorRole ? `${entry.actor || "Equipe"} · ${entry.actorRole}` : entry.actor || "Equipe")}</em>
                    </div>
                  </article>
                `,
              )
              .join("")
          : `<p>Ainda sem registros. Ao salvar, enviar, negociar ou registrar pagamentos, o histórico aparece aqui.</p>`
      }
    </div>
  `;
}

function getTimelineSummaryCards(proposal, compactHistory, lastRelevantEntry) {
  const status = normalizeProposalStatus(proposal.status);
  const snapshot = proposal.snapshot || {};
  const clientResponse = proposal.cliente_resposta || snapshot.clienteResposta?.acao || snapshot.clientResponse?.action || "";
  const signal = snapshot.pagamentoSinal;
  const remaining = snapshot.pagamentoRestante;
  const responseLabels = {
    confirmar: "Aprovou",
    alteracao: "Pediu ajuste",
    cancelar: "Cancelou",
  };
  return [
    {
      tone: "stage",
      label: "Etapa atual",
      value: getProposalStatusLabel(status),
      detail: lastRelevantEntry ? `Último movimento: ${formatCommercialHistoryDate(lastRelevantEntry.at)}` : "Ainda sem movimento relevante.",
    },
    {
      tone: clientResponse ? "client" : "muted",
      label: "Resposta do cliente",
      value: responseLabels[clientResponse] || "Sem resposta",
      detail: clientResponse ? "Priorize o próximo passo comercial." : "Acompanhe o retorno dentro do prazo combinado.",
    },
    {
      tone: remaining ? "money" : signal ? "warning" : "muted",
      label: "Financeiro",
      value: remaining ? "Saldo registrado" : signal ? "Sinal registrado" : "Sem sinal",
      detail: remaining
        ? `${formatMoney(Number(remaining.valor) || 0)} · ${formatSignalPaymentDate(remaining.data)}`
        : signal
          ? `${formatMoney(Number(signal.valor) || 0)} · falta saldo`
          : "Aguardando avanço comercial.",
    },
    {
      tone: compactHistory.technicalCount || compactHistory.routineCount ? "muted" : "stage",
      label: "Leitura limpa",
      value: `${compactHistory.keyCount || 0} ação(ões)`,
      detail:
        compactHistory.technicalCount || compactHistory.routineCount
          ? `${(compactHistory.technicalCount || 0) + (compactHistory.routineCount || 0)} ajuste(s) interno(s) agrupado(s).`
          : "Sem ajustes internos agrupados.",
    },
  ];
}

function renderInternalNotesPanel(proposal = getActiveProposal()) {
  if (!nodes.internalNotesPanel) return;
  if (!proposal) {
    nodes.internalNotesPanel.classList.add("is-hidden");
    nodes.internalNotesPanel.innerHTML = "";
    return;
  }
  const comments = getInternalComments(proposal.snapshot || {});
  nodes.internalNotesPanel.classList.remove("is-hidden");
  nodes.internalNotesPanel.innerHTML = `
    <details ${comments.length ? "open" : ""}>
      <summary class="internal-panel-heading">
        <div>
          <span>Comentários internos</span>
          <strong>Memória do atendimento</strong>
        </div>
        <small>${comments.length} registro(s)</small>
      </summary>
      <div class="internal-note-form">
        <textarea id="internalCommentText" rows="2" placeholder="Ex.: cliente pediu retorno amanhã, agência precisa de comissão, validar cardápio com operação..."></textarea>
        <button class="secondary" type="button" data-add-internal-comment="${escapeHtml(proposal.id)}">Registrar</button>
      </div>
      <div class="internal-note-list">
        ${
          comments.length
            ? comments
                .slice(0, 5)
                .map(
                  (comment) => `
                    <article>
                      <p>${escapeHtml(comment.text)}</p>
                      <small>${escapeHtml(formatCommercialHistoryDate(comment.at))} · ${escapeHtml(getActorLabel(comment.actor))}</small>
                    </article>
                  `,
                )
                .join("")
            : `<p>Use este espaço para decisões, combinados e contexto que não deve ir para o cliente.</p>`
        }
      </div>
    </details>
  `;
}

function renderEventAttachmentsPanel(proposal = getActiveProposal()) {
  if (!nodes.eventAttachmentsPanel) return;
  if (!proposal) {
    nodes.eventAttachmentsPanel.classList.add("is-hidden");
    nodes.eventAttachmentsPanel.innerHTML = "";
    return;
  }
  const attachments = getEventAttachments(proposal.snapshot || {});
  nodes.eventAttachmentsPanel.classList.remove("is-hidden");
  nodes.eventAttachmentsPanel.innerHTML = `
    <details ${attachments.length ? "open" : ""}>
      <summary class="internal-panel-heading">
        <div>
          <span>Anexos do evento</span>
          <strong>Comprovantes, briefings e produção</strong>
        </div>
        <small>${attachments.length} arquivo(s)</small>
      </summary>
      <div class="attachment-form">
        <select id="eventAttachmentType">
          <option value="Briefing">Briefing</option>
          <option value="Comprovante">Comprovante</option>
          <option value="Contrato ou autorização">Contrato ou autorização</option>
          <option value="Produção">Produção</option>
          <option value="Outro">Outro</option>
        </select>
        <input id="eventAttachmentFile" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
        <button class="secondary" type="button" data-add-event-attachment="${escapeHtml(proposal.id)}">Anexar</button>
      </div>
      <div class="attachment-list">
        ${
          attachments.length
            ? attachments
                .slice(0, 8)
                .map(
                  (attachment) => `
                    <article>
                      <span>${escapeHtml(attachment.type || "Arquivo")}</span>
                      ${
                        attachment.dataUrl
                          ? `<a href="${escapeHtml(attachment.dataUrl)}" download="${escapeHtml(attachment.nome || "arquivo")}">${escapeHtml(attachment.nome || "arquivo")}</a>`
                          : `<strong>${escapeHtml(attachment.nome || "Arquivo")}</strong>`
                      }
                      <small>${escapeHtml(formatCommercialHistoryDate(attachment.at))} · ${escapeHtml(getActorLabel(attachment.actor))}</small>
                    </article>
                  `,
                )
                .join("")
            : `<p>Nenhum anexo interno ainda.</p>`
        }
      </div>
    </details>
  `;
}

async function updateProposalSnapshot(proposalId, snapshot, successMessage = "Registro atualizado.") {
  if (!state.supabase || !state.session || !proposalId) return null;
  const { data, error } = await state.supabase
    .from("propostas")
    .update({ snapshot })
    .eq("id", proposalId)
    .select("*")
    .single();
  if (error) {
    console.warn("Falha ao atualizar snapshot da proposta.", error);
    showToast("Não foi possível salvar este registro.");
    return null;
  }
  upsertProposalState(data);
  renderCommercialTimeline(data);
  renderInternalNotesPanel(data);
  renderEventAttachmentsPanel(data);
  renderPipeline();
  showToast(successMessage);
  return data;
}

async function addInternalComment(proposalId) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  const text = document.querySelector("#internalCommentText")?.value?.trim() || "";
  if (!proposal || !text) {
    showToast("Escreva um comentário curto antes de registrar.");
    return;
  }
  const comment = {
    id: `comment-${Date.now()}`,
    text,
    at: new Date().toISOString(),
    actor: getCommercialActor(),
    actorRole: getTeamProfile().label,
  };
  const history = createCommercialHistoryEntry("comentario", "Comentário interno", text);
  const snapshot = withCommercialHistoryEntries(
    {
      ...(proposal.snapshot || {}),
      internalComments: [comment, ...getInternalComments(proposal.snapshot || {})].slice(0, 30),
    },
    [history],
  );
  await updateProposalSnapshot(proposalId, snapshot, "Comentário interno registrado.");
}

async function addEventAttachment(proposalId) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  const type = document.querySelector("#eventAttachmentType")?.value || "Outro";
  const file = document.querySelector("#eventAttachmentFile")?.files?.[0] || null;
  if (!proposal || !file) {
    showToast("Escolha um arquivo para anexar.");
    return;
  }
  try {
    const attachmentFile = await readSignalProofFile(file);
    const attachment = {
      ...attachmentFile,
      id: `attach-${Date.now()}`,
      type,
      at: new Date().toISOString(),
      actor: getCommercialActor(),
      actorRole: getTeamProfile().label,
    };
    const snapshot = withCommercialHistoryEntries(
      {
        ...(proposal.snapshot || {}),
        eventAttachments: [attachment, ...getEventAttachments(proposal.snapshot || {})].slice(0, 20),
      },
      [createCommercialHistoryEntry("anexo", `${type} anexado`, attachment.nome)],
    );
    await updateProposalSnapshot(proposalId, snapshot, "Anexo registrado no evento.");
  } catch (error) {
    showToast(error.message || "Não foi possível anexar o arquivo.");
  }
}

function getActiveProposal() {
  return state.proposals.find((item) => item.id === state.activeProposalId) || null;
}

function getQuickReplyRecommendation(status) {
  const normalized = normalizeProposalStatus(status);
  if (normalized === "proposta_enviada") return "followup";
  if (normalized === "negociacao") return "sinal";
  if (normalized === "confirmado") return "saldo";
  if (["pagamento_final", "planejamento", "evento_proximo"].includes(normalized)) return "pre_evento";
  return "proposta";
}

function getQuickReplyContext() {
  const proposal = getActiveProposal();
  const request = getActiveQuoteRequest();
  const qualification = request?.snapshot?.qualificacao || proposal?.snapshot?.qualificacao || {};
  return {
    proposal,
    request,
    clientName: fields.clientName.value.trim() || proposal?.cliente_nome || request?.cliente_nome || "cliente",
    company:
      request?.empresa ||
      request?.cliente_empresa ||
      proposal?.snapshot?.client?.company ||
      request?.snapshot?.cliente?.empresa ||
      "",
    email: fields.clientEmail.value.trim() || proposal?.cliente_email || request?.cliente_email || "",
    phone: fields.clientPhone.value.trim() || proposal?.cliente_whatsapp || request?.cliente_whatsapp || "",
    eventType: getCurrentEventType() || proposal?.tipo_evento || request?.tipo_evento || "evento",
    eventDate: getEventDateLabel(),
    eventTime: getEventTimeLabel(),
    guests: getGuestCount(),
    duration: getDuration(),
    total: formatMoney(getQuoteTotals().total),
    investmentRange: qualification.faixaInvestimento || "",
    status: proposal?.status || request?.status || "lead_recebido",
  };
}

const communicationTemplateDefaults = [
  {
    id: "proposta",
    title: "Proposta enviada",
    stage: "Primeiro envio",
    note: "Apresenta a proposta com contexto e CTA de ajuste.",
    needsLink: true,
    subject: "Proposta de evento - Embaixada Carioca",
    whatsappBody: [
      "Olá, {{primeiro_nome}}!",
      "",
      "Sua proposta da Embaixada Carioca está pronta para revisão.",
      "",
      "Formato: {{tipo_evento}}",
      "Data e horário: {{data}} às {{hora}}",
      "Grupo: {{pax}} pessoa(s)",
      "Total estimado: {{total}}",
      "",
      "Acesse sua proposta aqui:",
      "{{link}}",
      "",
      "Pelo link você pode aprovar, pedir ajustes ou anexar o comprovante do sinal. Prazo do sinal: {{prazo_sinal}}.",
      "A data e o horário ficam reservados após validação da equipe e confirmação do sinal.",
      "",
      "Para manter tudo organizado, prefira responder pelo link da proposta.",
      "Se quiser falar com uma pessoa da equipe, use {{email_eventos}} ou {{whatsapp_eventos}}.",
    ].join("\n"),
    emailBody: [
      "Olá, {{primeiro_nome}}.",
      "",
      "Preparamos sua proposta da Embaixada Carioca para {{tipo_evento}}, no dia {{data}} às {{hora}}, para {{pax}} pessoa(s).",
      "",
      "Você pode revisar a proposta, pedir ajustes ou anexar o comprovante do sinal pelo link abaixo:",
      "{{link}}",
      "",
      "Total estimado: {{total}}.",
      "Prazo do sinal: {{prazo_sinal}}.",
      "",
      "A data e o horário ficam reservados após validação da equipe e confirmação do sinal.",
      "",
      "Equipe de Eventos | Embaixada Carioca",
    ].join("\n"),
  },
  {
    id: "followup",
    title: "Retorno sem resposta",
    stage: "Retomada comercial",
    note: "Retoma o contato sem soar insistente.",
    needsLink: true,
    subject: "Retorno sobre a proposta - Embaixada Carioca",
    whatsappBody: [
      "Olá, {{primeiro_nome}}! Tudo bem?",
      "",
      "Passando para deixar sua proposta da Embaixada Carioca à mão:",
      "{{link}}",
      "",
      "Se algum ponto ainda não estiver ideal, ajustamos data, horário, convidados ou formato.",
      "",
      "Para manter tudo organizado, prefira responder pelo link da proposta.",
      "Se quiser falar com uma pessoa da equipe, use {{email_eventos}} ou {{whatsapp_eventos}}.",
    ].join("\n"),
    emailBody: [
      "Olá, {{primeiro_nome}}.",
      "",
      "Passando para retomar sua proposta para {{tipo_evento}} na Embaixada Carioca.",
      "",
      "Link para revisão:",
      "{{link}}",
      "",
      "Se quiser ajustar data, horário, número de convidados ou formato, é só responder pela própria proposta.",
      "",
      "Equipe de Eventos | Embaixada Carioca",
    ].join("\n"),
  },
  {
    id: "sinal",
    title: "Cobrança de sinal",
    stage: "Reserva da data",
    note: "Explica o próximo passo comercial de forma clara.",
    needsLink: true,
    subject: "Reserva e sinal do evento - Embaixada Carioca",
    whatsappBody: [
      "Olá, {{primeiro_nome}}!",
      "",
      "Para reservar a data do seu {{tipo_evento}}, o próximo passo é o sinal indicado na proposta.",
      "",
      "A proposta continua aqui:",
      "{{link}}",
      "",
      "No link você vê os dados bancários, copia a chave Pix e pode anexar o comprovante.",
      "A reserva fica confirmada após validação da equipe.",
      "",
      "Se preferir conversar com a equipe, use {{email_eventos}} ou {{whatsapp_eventos}}.",
    ].join("\n"),
    emailBody: [
      "Olá, {{primeiro_nome}}.",
      "",
      "Para reservar a data do seu {{tipo_evento}}, o próximo passo é realizar o sinal indicado na proposta.",
      "",
      "Link da proposta:",
      "{{link}}",
      "",
      "Pelo link você encontra os dados bancários, copia a chave Pix e pode anexar o comprovante.",
      "A reserva fica confirmada após validação da equipe.",
      "",
      "Equipe de Eventos | Embaixada Carioca",
    ].join("\n"),
  },
  {
    id: "saldo",
    title: "Cobrança do saldo",
    stage: "Financeiro",
    note: "Alinha o restante com tom profissional e sereno.",
    needsLink: true,
    subject: "Pagamento restante do evento - Embaixada Carioca",
    whatsappBody: [
      "Olá, {{primeiro_nome}}!",
      "",
      "Estamos alinhando a etapa final do seu {{tipo_evento}} na Embaixada Carioca.",
      "",
      "Segue o link da proposta para referência e pagamento restante:",
      "{{link}}",
      "",
      "Com o saldo confirmado, seguimos com os detalhes finais da operação.",
      "",
      "Se precisar, fale com a equipe por {{email_eventos}} ou {{whatsapp_eventos}}.",
    ].join("\n"),
    emailBody: [
      "Olá, {{primeiro_nome}}.",
      "",
      "Estamos alinhando a etapa final do seu {{tipo_evento}} na Embaixada Carioca.",
      "",
      "Link da proposta para referência e pagamento restante:",
      "{{link}}",
      "",
      "Com o saldo confirmado, seguimos com os detalhes finais da operação.",
      "",
      "Equipe de Eventos | Embaixada Carioca",
    ].join("\n"),
  },
  {
    id: "pre_evento",
    title: "Confirmação pré-evento",
    stage: "Reta final",
    note: "Fecha a operação com segurança e elegância.",
    needsLink: true,
    subject: "Confirmação final do evento - Embaixada Carioca",
    whatsappBody: [
      "Olá, {{primeiro_nome}}!",
      "",
      "Estamos chegando na reta final do seu {{tipo_evento}} na Embaixada Carioca.",
      "Combinado atual: {{data}} às {{hora}}, {{pax}} pessoa(s), duração de {{duracao}}h.",
      "",
      "Link da proposta para referência final:",
      "{{link}}",
      "",
      "Se houver qualquer ajuste de última hora, fale com {{email_eventos}} ou {{whatsapp_eventos}}.",
      "",
      "Nos vemos em breve.",
    ].join("\n"),
    emailBody: [
      "Olá, {{primeiro_nome}}.",
      "",
      "Estamos chegando na reta final do seu {{tipo_evento}} na Embaixada Carioca.",
      "",
      "Combinado atual:",
      "Data e horário: {{data}} às {{hora}}",
      "Grupo: {{pax}} pessoa(s)",
      "Duração: {{duracao}}h",
      "",
      "Link da proposta para referência final:",
      "{{link}}",
      "",
      "Se houver qualquer ajuste de última hora, fale com a equipe de eventos.",
      "",
      "Equipe de Eventos | Embaixada Carioca",
    ].join("\n"),
  },
];

function cloneCommunicationDefaults() {
  return communicationTemplateDefaults.map((item) => ({ ...item }));
}

function loadCommunicationTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMMUNICATION_TEMPLATES_KEY) || "[]");
    if (!Array.isArray(saved)) return cloneCommunicationDefaults();
    return communicationTemplateDefaults.map((base) => {
      const override = saved.find((item) => item?.id === base.id) || {};
      return {
        ...base,
        subject: String(override.subject || base.subject),
        whatsappBody: String(override.whatsappBody || base.whatsappBody),
        emailBody: String(override.emailBody || base.emailBody),
      };
    });
  } catch (error) {
    console.warn("Falha ao carregar textos de comunicação.", error);
    return cloneCommunicationDefaults();
  }
}

function saveCommunicationTemplates(templates) {
  localStorage.setItem(
    COMMUNICATION_TEMPLATES_KEY,
    JSON.stringify(
      templates.map((item) => ({
        id: item.id,
        subject: item.subject,
        whatsappBody: item.whatsappBody,
        emailBody: item.emailBody,
      })),
    ),
  );
}

function getCommunicationTemplate(id) {
  return loadCommunicationTemplates().find((item) => item.id === id) || loadCommunicationTemplates()[0];
}

function getCommunicationPlaceholderValues(context = getQuickReplyContext(), proposalUrl = "") {
  const clientName = context.clientName || "cliente";
  const firstName = clientName.split(/\s+/)[0] || clientName || "cliente";
  return {
    cliente: clientName,
    primeiro_nome: firstName,
    empresa: context.company || "A definir",
    tipo_evento: context.eventType || "evento",
    data: context.eventDate || "A definir",
    hora: context.eventTime || "A definir",
    pax: String(context.guests || "A definir"),
    convidados: String(context.guests || "A definir"),
    duracao: String(context.duration || "A definir"),
    total: context.total || formatMoney(getQuoteTotals().total),
    link: proposalUrl || "{{link}}",
    prazo_sinal: formatSignalDeadlineHours(),
    email_eventos: HUMAN_EVENTS_EMAIL,
    whatsapp_eventos: HUMAN_EVENTS_WHATSAPP,
  };
}

function renderCommunicationTemplateText(text, context, proposalUrl) {
  const values = getCommunicationPlaceholderValues(context, proposalUrl);
  return String(text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    return match;
  });
}

function getQuickReplyPresets(status) {
  const recommended = getQuickReplyRecommendation(status);
  return loadCommunicationTemplates().map((template) => ({
    id: template.id,
    title: template.title,
    eyebrow: template.stage,
    note: template.note,
    subject: template.subject,
    needsLink: template.needsLink,
    recommended: recommended === template.id,
    buildText: (context, proposalUrl, channel = "whatsapp") =>
      renderCommunicationTemplateText(channel === "email" ? template.emailBody : template.whatsappBody, context, proposalUrl),
  }));
}

function getQuickReplyPayload(replyId, context, proposalUrl, channel = "whatsapp") {
  const preset = getQuickReplyPresets(context.status).find((item) => item.id === replyId);
  if (!preset) return null;
  return {
    ...preset,
    message: preset.buildText(context, proposalUrl, channel),
  };
}

function appendBotWhatsAppNotice(message) {
  const text = String(message || "").trim();
  if (text.includes("número automático da Embaixada Carioca")) return text;
  const noticeLines = [
    "Observação: este envio saiu pelo número automático da Embaixada Carioca.",
    "Para manter sua resposta registrada, use o link da proposta para aprovar, pedir ajuste ou anexar comprovante.",
  ];
  if (!text.includes(HUMAN_EVENTS_EMAIL) && !text.includes(HUMAN_EVENTS_WHATSAPP)) {
    noticeLines.push(`Se quiser falar com uma pessoa da equipe, use ${HUMAN_EVENTS_EMAIL} ou ${HUMAN_EVENTS_WHATSAPP}.`);
  }
  const notice = noticeLines.join("\n");
  return [text, "", notice].filter(Boolean).join("\n");
}

async function runQuickReply(replyId, channel) {
  const context = getQuickReplyContext();
  const preset = getQuickReplyPresets(context.status).find((item) => item.id === replyId);
  const needsLink = preset?.needsLink;
  if (!preset) return;
  let share = null;
  let proposalUrl = "";

  if (channel === "copy") {
    if (needsLink) {
      share = await ensureProposalForSharing();
      proposalUrl = share?.url || "";
      if (!proposalUrl) return;
    }
    const payload = getQuickReplyPayload(replyId, context, proposalUrl, "whatsapp");
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.message);
      showToast(`Mensagem "${payload.title}" copiada.`);
    } catch (error) {
      console.warn("Falha ao copiar resposta rapida.", error);
      showToast("Não foi possível copiar automaticamente.");
    }
    return;
  }

  if (channel === "email") {
    const email = context.email;
    if (!email) {
      showToast("Preencha o e-mail do cliente para abrir a mensagem.");
      return;
    }
    if (state.sendLocks.email) {
      showToast("E-mail já está sendo preparado.");
      return;
    }
    const confirmed = confirmClientSend({
      channel: "E-mail",
      destination: email,
      title: preset.title,
      action: "abrir o e-mail pronto para envio",
    });
    if (!confirmed) {
      showToast("Abertura do e-mail cancelada.");
      createIntegrationLog({
        channel: "email",
        status: "canceled",
        title: preset.title,
        detail: "A equipe cancelou a abertura do e-mail antes do envio.",
        target: email,
      });
      return;
    }
    if (needsLink) {
      share = await ensureProposalForSharing();
      proposalUrl = share?.url || "";
      if (!proposalUrl) return;
    }
    const payload = getQuickReplyPayload(replyId, context, proposalUrl, "email");
    if (!payload) return;
    state.sendLocks.email = true;
    const subject = encodeURIComponent(payload.subject);
    const body = encodeURIComponent(payload.message);
    createIntegrationLog({
      channel: "email",
      status: "opened",
      title: payload.title,
      detail: "E-mail pronto aberto no aplicativo do navegador. Confirme o envio no cliente de e-mail.",
      target: email,
    });
    showToast(`Abrindo e-mail com "${payload.title}".`);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    window.setTimeout(() => {
      state.sendLocks.email = false;
    }, 1500);
    return;
  }

  if (channel === "whatsapp") {
    const phone = fields.clientPhone.value.trim() || context.phone || "";
    const confirmed = confirmClientSend({
      channel: "WhatsApp",
      destination: phone,
      title: preset.title,
      action: "enviar agora pela Z-API e registrar no histórico",
    });
    if (!confirmed) {
      showToast("Envio por WhatsApp cancelado.");
      return;
    }
    if (needsLink) {
      share = await ensureProposalForSharing();
      if (!share?.saved || !share?.url) return;
    }
    proposalUrl = share?.url || "";
    const payload = getQuickReplyPayload(replyId, context, proposalUrl, "whatsapp");
    if (!payload) return;
    await sendProposalWhatsAppViaZapi({
      proposal: share.saved,
      proposalUrl: share.url,
      message: payload.message,
      title: payload.title,
      skipConfirm: true,
    });
  }
}

function renderQuickReplies() {
  if (!nodes.quickReplies) return;
  const context = getQuickReplyContext();
  const hasContext =
    context.clientName && context.clientName !== "cliente" && (context.eventType !== "evento" || context.email || context.phone);

  if (!hasContext) {
    nodes.quickReplies.innerHTML = `<p>Abra um lead ou comece uma proposta para liberar mensagens prontas de envio, retorno e cobrança.</p>`;
    return;
  }

  nodes.quickReplies.innerHTML = getQuickReplyPresets(context.status)
    .map(
      (preset) => `
        <article class="quick-reply-card${preset.recommended ? " is-recommended" : ""}">
          <div class="quick-reply-copy">
            <div class="quick-reply-topline">
              <span>${escapeHtml(preset.eyebrow)}</span>
              ${preset.recommended ? `<strong>Recomendado agora</strong>` : ""}
            </div>
            <h3>${escapeHtml(preset.title)}</h3>
            <p>${escapeHtml(preset.note)}</p>
          </div>
          <div class="quick-reply-actions">
            <button class="secondary" type="button" data-quick-reply="${escapeHtml(preset.id)}" data-quick-reply-channel="copy">Copiar</button>
            <button class="secondary" type="button" data-quick-reply="${escapeHtml(preset.id)}" data-quick-reply-channel="email">E-mail</button>
            <button class="primary" type="button" data-quick-reply="${escapeHtml(preset.id)}" data-quick-reply-channel="whatsapp">WhatsApp</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function shouldShowOperationalChecklist(proposal) {
  if (!proposal) return false;
  const status = normalizeProposalStatus(proposal.status);
  return Boolean(proposal.snapshot?.pagamentoSinal) || operationStatuses.has(status);
}

function renderOperationalChecklist(proposal = getActiveProposal()) {
  if (!nodes.operationalChecklist) return;
  if (!shouldShowOperationalChecklist(proposal)) {
    nodes.operationalChecklist.classList.add("is-hidden");
    nodes.operationalChecklist.innerHTML = "";
    return;
  }
  const checklist = proposal.snapshot?.operationalChecklist || {};
  const progress = getChecklistProgress(proposal.snapshot || {});
  nodes.operationalChecklist.classList.remove("is-hidden");
  nodes.operationalChecklist.innerHTML = `
    <div class="checklist-heading">
      <div>
        <span>Operação pós-sinal</span>
        <p>Gere a ficha técnica e confira o checklist antes de acionar operação e compras.</p>
      </div>
      <strong>${progress.done}/${progress.total} concluídos</strong>
    </div>
    <div class="operational-doc-actions" aria-label="Documentos operacionais">
      <button class="primary" type="button" data-operational-doc="technical-no-finance">Ficha operacional</button>
      <button class="secondary" type="button" data-operational-doc="technical-finance">Ficha com financeiro</button>
      <button class="secondary" type="button" data-operational-doc="checklist">Checklist do evento</button>
      <button class="secondary" type="button" data-operational-doc="summary">Copiar resumo</button>
    </div>
    <div class="checklist-items">
      ${operationalChecklistItems
        .map(
          (item) => `
            <label>
              <input type="checkbox" data-checklist-id="${escapeHtml(item.id)}" ${checklist[item.id] ? "checked" : ""} />
              ${escapeHtml(item.label)}
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

async function updateOperationalChecklist(checklistId, checked) {
  const proposal = getActiveProposal();
  if (!proposal || !state.supabase || !state.session) return;
  const checklistItem = operationalChecklistItems.find((item) => item.id === checklistId);
  const snapshot = {
    ...(proposal.snapshot || {}),
    operationalChecklist: {
      ...(proposal.snapshot?.operationalChecklist || {}),
      [checklistId]: checked,
    },
  };
  const snapshotWithHistory = withCommercialHistoryEntries(snapshot, [
    createCommercialHistoryEntry(
      "checklist",
      "Checklist operacional atualizado",
      `${checklistItem?.label || "Item"}: ${checked ? "concluído" : "reaberto"}.`,
    ),
  ]);
  const { data, error } = await state.supabase
    .from("propostas")
    .update({ snapshot: snapshotWithHistory })
    .eq("id", proposal.id)
    .select("*")
    .single();
  if (error) {
    console.warn("Falha ao atualizar checklist operacional.", error);
    showToast("Não foi possível salvar o checklist.");
    renderOperationalChecklist(proposal);
    return;
  }
  upsertProposalState(data);
  renderOperationalChecklist(data);
  renderCommercialTimeline(data);
  renderInternalNotesPanel(data);
  renderEventAttachmentsPanel(data);
  renderProposalNextStep();
  renderPipeline();
  showToast("Checklist atualizado.");
}

function getOperationalReference(proposal, snapshot) {
  return snapshot?.referencia || proposal?.referencia || proposal?.reference || proposal?.id || "Sem referência";
}

function formatOperationalDate(value) {
  return value ? formatDateFromIso(value) : "A definir";
}

function formatOperationalDateTime(event = {}) {
  const date = formatOperationalDate(event.date);
  const weekday = formatWeekdayShortFromIso(event.date);
  const time = event.time || "A definir";
  return `${date}${weekday ? ` (${weekday})` : ""} · ${time}`;
}

function getOperationalDocContext(proposal = getActiveProposal()) {
  const snapshot = proposal?.snapshot || {};
  const event = snapshot.event || {};
  const client = snapshot.client || {};
  const totals = snapshot.totals || {};
  const qualification = snapshot.qualificacao || {};
  const selectedItems = Array.isArray(snapshot.selectedItems) ? snapshot.selectedItems : [];
  const checklist = snapshot.operationalChecklist || {};
  const progress = getChecklistProgress(snapshot);
  const attachments = getEventAttachments(snapshot);
  const signal = snapshot.pagamentoSinal || null;
  const remaining = snapshot.pagamentoRestante || null;
  return {
    proposal,
    snapshot,
    reference: getOperationalReference(proposal, snapshot),
    generatedAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    client,
    event,
    totals,
    qualification,
    selectedItems,
    checklist,
    progress,
    attachments,
    signal,
    remaining,
    statusLabel: getProposalStatusLabel(proposal?.status || ""),
  };
}

function buildOperationalRows(rows) {
  return rows
    .filter((row) => row && row.value !== undefined && row.value !== null && String(row.value).trim())
    .map(
      (row) => `
        <div class="op-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>${formatMultilineHtml(row.value)}</strong>
        </div>
      `,
    )
    .join("");
}

function buildOperationalItemsList(items, options = {}) {
  const showFinance = options.showFinance !== false;
  if (!items.length) return `<p class="op-empty">Nenhum item selecionado.</p>`;
  return `
    <table class="op-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Categoria</th>
          <th>Descrição para operação/compras</th>
          ${showFinance ? "<th>Valor</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${items
          .map((item) => {
            const operationDescription = item.descricao || item.commercialSummary || "-";
            const financeDetail = item.calc?.detail ? `<br><small>${escapeHtml(item.calc.detail)}</small>` : "";
            return `
              <tr>
                <td><strong>${escapeHtml(item.nome || "-")}</strong><br><small>${escapeHtml(item.codigo || "")}</small></td>
                <td>${escapeHtml(item.tipoEvento || item.tipo || "-")}</td>
                <td>${escapeHtml(operationDescription)}${showFinance ? financeDetail : ""}</td>
                ${showFinance ? `<td>${formatMoney(item.calc?.total || 0)}</td>` : ""}
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function buildOperationalSuppliesList(context) {
  const itemRows = context.selectedItems
    .map((item) => {
      const description = item.descricao || item.commercialSummary || "Conferir composição com cardápio/produção.";
      return `
        <tr>
          <td><strong>${escapeHtml(item.nome || "Item")}</strong><br><small>${escapeHtml(item.tipoEvento || item.tipo || "Categoria não informada")}</small></td>
          <td>${escapeHtml(description)}</td>
        </tr>
      `;
    })
    .join("");
  const supportRows = [
    { label: "Extras de produção", value: context.event.extras || context.qualification.extras },
    { label: "Preferências e restrições", value: context.event.preferences || context.qualification.preferencias },
    { label: "Observações críticas", value: context.event.notes || context.event.sourceNotes || context.qualification.observacoes },
  ].filter((row) => row.value && String(row.value).trim());

  if (!itemRows && !supportRows.length) return `<p class="op-empty">Sem insumos mapeados. Revise itens, extras e observações antes de acionar compras.</p>`;

  return `
    <table class="op-table">
      <thead>
        <tr>
          <th>Base de compra/produção</th>
          <th>O que conferir</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${supportRows
          .map(
            (row) => `
              <tr>
                <td><strong>${escapeHtml(row.label)}</strong></td>
                <td>${formatMultilineHtml(row.value)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function formatOperationalBanks(payment) {
  if (!payment) return "Banco não informado";
  if (Array.isArray(payment.bancos) && payment.bancos.length) return payment.bancos.join(", ");
  return payment.banco || "Banco não informado";
}

function buildOperationalPaymentBlock(context) {
  const signal = context.signal;
  const remaining = context.remaining;
  const signalDetail = signal
    ? `${formatMoney(signal.valor)} · ${formatSignalPaymentDate(signal.data)} · ${formatOperationalBanks(signal)}`
    : "Sinal ainda não registrado.";
  const remainingDetail = remaining
    ? `${formatMoney(remaining.valor)} · ${formatSignalPaymentDate(remaining.data)} · ${formatOperationalBanks(remaining)}`
    : "Pagamento restante ainda não registrado.";
  return buildOperationalRows([
    { label: "Valor total", value: formatMoney(context.totals.total || 0) },
    { label: "Alimentos e bebidas", value: formatMoney(context.totals.subtotal || 0) },
    { label: "Taxa de serviço", value: formatMoney(context.totals.serviceFee || 0) },
    { label: "Privatização", value: `${formatMoney(context.totals.privatizationAmount || 0)} · ${context.totals.privatization?.title || "Não aplicada"}` },
    { label: "Sinal recebido", value: signalDetail },
    { label: "Pagamento restante", value: remainingDetail },
  ]);
}

function buildOperationalAttachments(context, options = {}) {
  const includeFinancialProofs = options.includeFinancialProofs !== false;
  const files = [];
  if (includeFinancialProofs && context.signal?.comprovante?.nome) files.push({ label: "Comprovante do sinal", ...context.signal.comprovante });
  if (includeFinancialProofs && context.remaining?.comprovante?.nome) files.push({ label: "Comprovante do saldo", ...context.remaining.comprovante });
  context.attachments.forEach((attachment) => files.push({ label: attachment.tipo || "Anexo", ...attachment }));
  if (!files.length) return `<p class="op-empty">Sem anexos cadastrados.</p>`;
  return `
    <ul class="op-attachments">
      ${files
        .map((file) => {
          const name = file.nome || "Arquivo";
          const href = file.dataUrl || file.url || "";
          return `<li><strong>${escapeHtml(file.label)}:</strong> ${
            href ? `<a href="${escapeHtml(href)}" download="${escapeHtml(name)}">${escapeHtml(name)}</a>` : escapeHtml(name)
          }</li>`;
        })
        .join("")}
    </ul>
  `;
}

function buildOperationalChecklistRows(context, printable = false) {
  return operationalChecklistItems
    .map((item) => {
      const checked = Boolean(context.checklist[item.id]);
      return `
        <div class="op-check-row${checked ? " is-done" : ""}">
          <span>${printable ? (checked ? "☑" : "☐") : checked ? "OK" : "Pendente"}</span>
          <strong>${escapeHtml(item.label)}</strong>
        </div>
      `;
    })
    .join("");
}

function buildOperationalPrintShell(title, subtitle, contentHtml) {
  const logoUrl = new URL("assets/logo-reducao.svg", window.location.href).href;
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)} - Embaixada Carioca</title>
        <style>
          @page { margin: 12mm; size: A4; }
          * { box-sizing: border-box; }
          body { color: #153d2d; font-family: Arial, sans-serif; margin: 0; }
          .op-page { padding: 0; }
          .op-header { align-items: center; border-bottom: 2px solid #153d2d; display: flex; gap: 14px; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; }
          .op-brand { align-items: center; display: flex; gap: 12px; }
          .op-brand img { height: 54px; width: 54px; }
          .op-kicker { color: #f39200; font-size: 10px; font-weight: 900; letter-spacing: .05em; margin: 0 0 3px; text-transform: uppercase; }
          h1 { font-size: 24px; line-height: 1.05; margin: 0; }
          .op-meta { color: #66736e; font-size: 10px; font-weight: 700; text-align: right; }
          .op-summary { background: #edf5ef; border-left: 5px solid #153d2d; border-radius: 8px; margin-bottom: 12px; padding: 10px 12px; }
          .op-summary strong { display: block; font-size: 15px; margin-bottom: 3px; }
          .op-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .op-section { break-inside: avoid; border: 1px solid #d7e1dc; border-radius: 8px; margin-bottom: 10px; padding: 10px; }
          .op-section h2 { color: #153d2d; font-size: 12px; letter-spacing: .04em; margin: 0 0 8px; text-transform: uppercase; }
          .op-section h3 { color: #f39200; font-size: 10px; letter-spacing: .04em; margin: 0 0 8px; text-transform: uppercase; }
          .op-row { border-bottom: 1px solid #edf1ef; display: grid; gap: 8px; grid-template-columns: 36% 1fr; padding: 6px 0; }
          .op-row:last-child { border-bottom: 0; }
          .op-row span, .op-table small, .op-empty, .op-attachments { color: #66736e; font-size: 10px; font-weight: 700; }
          .op-row strong { font-size: 11px; line-height: 1.35; }
          .op-table { border-collapse: collapse; font-size: 10px; width: 100%; }
          .op-table th { background: #153d2d; color: #fff; padding: 7px 6px; text-align: left; }
          .op-table td { border-bottom: 1px solid #dfe7e3; padding: 7px 6px; vertical-align: top; }
          .op-checks { display: grid; gap: 7px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .op-check-row { align-items: center; border: 1px solid #dfe7e3; border-radius: 8px; display: flex; gap: 8px; min-height: 34px; padding: 7px 8px; }
          .op-check-row span { background: #f2ead3; border-radius: 6px; color: #153d2d; font-size: 10px; font-weight: 900; min-width: 34px; padding: 3px 5px; text-align: center; }
          .op-check-row.is-done span { background: #dfeee5; }
          .op-attachments { margin: 0; padding-left: 16px; }
          .op-note { background: #fff7e8; border: 1px solid #f2c46f; border-radius: 8px; color: #153d2d; font-size: 11px; font-weight: 700; margin-top: 10px; padding: 9px 10px; }
          @media print { .op-page { page-break-after: auto; } }
        </style>
      </head>
      <body>
        <main class="op-page">
          <header class="op-header">
            <div class="op-brand">
              <img src="${escapeHtml(logoUrl)}" alt="Embaixada Carioca">
              <div>
                <p class="op-kicker">Embaixada Carioca</p>
                <h1>${escapeHtml(title)}</h1>
              </div>
            </div>
            <div class="op-meta">${escapeHtml(subtitle)}</div>
          </header>
          ${contentHtml}
        </main>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`;
}

function buildTechnicalSheetHtml(proposal = getActiveProposal(), options = {}) {
  const showFinance = options.showFinance !== false;
  const context = getOperationalDocContext(proposal);
  const eventTitle = `${context.event.type || "Evento"} · ${formatOperationalDateTime(context.event)} · ${context.event.guests || 0} pax`;
  return buildOperationalPrintShell(
    showFinance ? "Ficha técnica do evento" : "Ficha operacional do evento",
    `Ref. ${context.reference}<br>Gerado em ${context.generatedAt}`,
    `
      <div class="op-summary">
        <strong>${escapeHtml(eventTitle)}</strong>
        Cliente: ${escapeHtml(context.client.name || "A definir")} · Status: ${escapeHtml(context.statusLabel || "-")}
        ${showFinance ? "" : "<br><small>Versão sem valores para operação, compras e equipe de salão.</small>"}
      </div>
      <div class="op-grid">
        <section class="op-section">
          <h2>Dados do evento</h2>
          ${buildOperationalRows([
            { label: "Formato", value: context.event.type || "A definir" },
            { label: "Data e chegada", value: formatOperationalDateTime(context.event) },
            { label: "Convidados", value: `${context.event.guests || 0} pax` },
            { label: "Duração", value: `${context.event.duration || 1}h` },
            { label: "Motivo", value: context.event.reason || context.qualification.ocasiao || "Não informado" },
          ])}
        </section>
        <section class="op-section">
          <h2>Cliente e responsáveis</h2>
          ${buildOperationalRows([
            { label: "Cliente", value: context.client.name || "A definir" },
            { label: "Empresa/agência", value: context.client.company || context.qualification.tipoCliente || "Não informado" },
            { label: "Cliente final/grupo", value: [context.client.finalClient, context.client.groupName].filter(Boolean).join(" · ") || "Não informado" },
            { label: "E-mail", value: context.client.email || "Não informado" },
            { label: "Celular/WhatsApp", value: context.client.phone || "Não informado" },
          ])}
        </section>
      </div>
      <section class="op-section">
        <h2>Itens contratados</h2>
        ${buildOperationalItemsList(context.selectedItems, { showFinance })}
      </section>
      <section class="op-section">
        <h2>Lista de insumos</h2>
        ${buildOperationalSuppliesList(context)}
      </section>
      ${
        showFinance
          ? `
            <div class="op-grid">
              <section class="op-section">
                <h2>Financeiro</h2>
                ${buildOperationalPaymentBlock(context)}
              </section>
              <section class="op-section">
                <h2>Anexos e comprovantes</h2>
                ${buildOperationalAttachments(context)}
              </section>
            </div>
          `
          : `
            <section class="op-section">
              <h2>Anexos operacionais</h2>
              ${buildOperationalAttachments(context, { includeFinancialProofs: false })}
            </section>
          `
      }
      <section class="op-section">
        <h2>Observações para operação e compras</h2>
        ${buildOperationalRows([
          { label: "Preferências de A&B", value: context.event.preferences || context.qualification.preferencias || "Não informado" },
          { label: "Extras solicitados", value: context.event.extras || context.qualification.extras || "Não informado" },
          { label: "Observações", value: context.event.notes || context.event.sourceNotes || context.qualification.observacoes || "Sem observações adicionais" },
        ])}
      </section>
      <div class="op-note">Antes da execução, confirme operação avisada, responsável do dia, cardápio, extras, restrições e pagamento restante.</div>
    `,
  );
}

function buildOperationalChecklistHtml(proposal = getActiveProposal()) {
  const context = getOperationalDocContext(proposal);
  return buildOperationalPrintShell(
    "Checklist do evento",
    `Ref. ${context.reference}<br>${context.progress.done}/${context.progress.total} concluídos`,
    `
      <div class="op-summary">
        <strong>${escapeHtml(context.client.name || "Cliente")} · ${escapeHtml(context.event.type || "Evento")}</strong>
        ${escapeHtml(formatOperationalDateTime(context.event))} · ${escapeHtml(String(context.event.guests || 0))} pax · Total ${escapeHtml(formatMoney(context.totals.total || 0))}
      </div>
      <section class="op-section">
        <h2>Checklist operacional</h2>
        <div class="op-checks">${buildOperationalChecklistRows(context, true)}</div>
      </section>
      <section class="op-section">
        <h2>Compras e produção</h2>
        <h3>Lista de insumos</h3>
        ${buildOperationalSuppliesList(context)}
        ${buildOperationalRows([
          { label: "Cardápio/itens", value: context.selectedItems.map((item) => item.nome).join(", ") || "Não informado" },
          { label: "Extras", value: context.event.extras || context.qualification.extras || "Sem extras informados" },
          { label: "Restrições/observações", value: context.event.preferences || context.event.notes || context.event.sourceNotes || "Sem restrições informadas" },
        ])}
      </section>
      <section class="op-section">
        <h2>Financeiro para conferência</h2>
        ${buildOperationalPaymentBlock(context)}
      </section>
    `,
  );
}

function buildOperationalSummaryText(proposal = getActiveProposal()) {
  const context = getOperationalDocContext(proposal);
  const checklist = operationalChecklistItems
    .map((item) => `${context.checklist[item.id] ? "OK" : "PENDENTE"} - ${item.label}`)
    .join("\n");
  const items = context.selectedItems.map((item) => `- ${item.nome} (${item.tipoEvento || "item"})`).join("\n") || "- Sem itens selecionados";
  const supplies =
    context.selectedItems
      .map((item) => `- ${item.nome}: ${item.descricao || item.commercialSummary || "conferir composição com produção"}`)
      .join("\n") || "- Sem insumos mapeados";
  return [
    `FICHA OPERACIONAL SEM VALORES - ${context.reference}`,
    `${context.client.name || "Cliente"} | ${context.event.type || "Evento"}`,
    `${formatOperationalDateTime(context.event)} | ${context.event.guests || 0} pax | ${context.event.duration || 1}h`,
    "",
    "Itens:",
    items,
    "",
    "Lista de insumos:",
    supplies,
    "",
    `Cliente final/grupo: ${[context.client.finalClient, context.client.groupName].filter(Boolean).join(" · ") || "Não informado"}`,
    `Contato: ${context.client.email || "-"} | ${context.client.phone || "-"}`,
    `Observações: ${context.event.notes || context.event.sourceNotes || context.event.preferences || "Sem observações adicionais"}`,
    "",
    "Checklist:",
    checklist,
  ].join("\n");
}

function openOperationalPrintDocument(kind) {
  const proposal = getActiveProposal();
  if (!proposal) {
    showToast("Abra uma proposta confirmada para gerar a ficha.");
    return;
  }
  const html =
    kind === "checklist"
      ? buildOperationalChecklistHtml(proposal)
      : buildTechnicalSheetHtml(proposal, { showFinance: kind === "technical-finance" });
  const win = window.open("", "_blank");
  if (!win) {
    showToast("Permita pop-ups para abrir a ficha técnica.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

async function handleOperationalDocAction(action) {
  const proposal = getActiveProposal();
  if (!proposal) {
    showToast("Abra uma proposta com sinal para gerar documentos.");
    return;
  }
  if (action === "summary") {
    try {
      await navigator.clipboard.writeText(buildOperationalSummaryText(proposal));
      showToast("Resumo operacional copiado.");
    } catch (error) {
      console.warn("Falha ao copiar resumo operacional.", error);
      showToast("Não foi possível copiar. Gere a ficha técnica.");
    }
    return;
  }
  openOperationalPrintDocument(action === "checklist" ? "checklist" : action === "technical-finance" ? "technical-finance" : "technical-no-finance");
}

function getTodayInputValue() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatPhoneForField(value) {
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

function normalizeHalfHourTime(value, fallback = "18:00") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  let hours = Math.min(23, Math.max(0, Number(match[1]) || 0));
  const minutes = Math.min(59, Math.max(0, Number(match[2]) || 0));

  let normalizedMinutes = 0;
  if (minutes >= 15 && minutes < 45) {
    normalizedMinutes = 30;
  } else if (minutes >= 45) {
    if (hours < 23) {
      hours += 1;
      normalizedMinutes = 0;
    } else {
      normalizedMinutes = 30;
    }
  }

  return `${String(hours).padStart(2, "0")}:${String(normalizedMinutes).padStart(2, "0")}`;
}

function syncDateTimeFromFields() {
  if (!fields.eventDateTime) return;
  if (!fields.eventDate.value || !fields.eventTime.value) {
    fields.eventDateTime.value = "";
    return;
  }
  const normalizedTime = normalizeHalfHourTime(fields.eventTime.value);
  fields.eventTime.value = normalizedTime;
  fields.eventDateTime.value = `${fields.eventDate.value}T${normalizedTime}`;
}

function syncFieldsFromDateTime() {
  if (!fields.eventDateTime) return;
  const value = fields.eventDateTime.value;
  if (!value) {
    fields.eventDate.value = "";
    fields.eventTime.value = "18:00";
    return;
  }
  const [datePart, timePart] = value.split("T");
  fields.eventDate.value = datePart || "";
  const normalizedTime = normalizeHalfHourTime((timePart || "18:00").slice(0, 5));
  fields.eventTime.value = normalizedTime;
  const normalizedDateTime = fields.eventDate.value ? `${fields.eventDate.value}T${normalizedTime}` : "";
  if (normalizedDateTime && fields.eventDateTime.value !== normalizedDateTime) {
    fields.eventDateTime.value = normalizedDateTime;
  }
}

function getSignalDefaultAmount(total) {
  return roundCurrency((Number(total) || 0) * 0.5);
}

function getRemainingDefaultAmount(total, signalInfo) {
  return Math.max(0, roundCurrency((Number(total) || 0) - toNumber(signalInfo?.valor)));
}

function getPaymentCoverage(total, signalInfo = null, remainingInfo = null) {
  const totalValue = roundCurrency(Number(total) || 0);
  const signalValue = toNumber(signalInfo?.valor);
  const remainingValue = toNumber(remainingInfo?.valor);
  const paidTotal = roundCurrency(signalValue + remainingValue);
  const remainingDue = Math.max(0, roundCurrency(totalValue - paidTotal));
  const isFullyPaid = totalValue > 0 && paidTotal >= totalValue - 0.01;
  const isSignalIntegral = totalValue > 0 && signalValue >= totalValue - 0.01;
  return { totalValue, signalValue, remainingValue, paidTotal, remainingDue, isFullyPaid, isSignalIntegral };
}

function createSignalPaymentInfo(amount, date, banks, meta = {}) {
  return {
    valor: roundCurrency(amount),
    data: date,
    bancos: banks,
    ...meta,
    registradoEm: new Date().toISOString(),
    registradoPor: state.session?.user?.email || "",
  };
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function readSignalProofFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const maxSize = 6 * 1024 * 1024;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (file.size > maxSize) {
      reject(new Error("O comprovante pode ter no máximo 6 MB."));
      return;
    }
    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Anexe PDF ou imagem nos formatos JPG, PNG ou WEBP."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o comprovante."));
    reader.readAsDataURL(file);
  });
}

function showSignalPaymentDialog(total = 0, options = {}) {
  return new Promise((resolve) => {
    const totalValue = roundCurrency(Number(total) || 0);
    const thirtyPercentAmount = roundCurrency(totalValue * 0.3);
    const presetAmounts = {
      50: getSignalDefaultAmount(totalValue),
      30: thirtyPercentAmount,
      100: totalValue,
    };
    const defaultPreset = ["50", "30", "100", "custom"].includes(String(options.defaultPreset))
      ? String(options.defaultPreset)
      : "50";
    const defaultAmount = presetAmounts[defaultPreset] ?? getSignalDefaultAmount(totalValue);
    const isRealizedPayment = options.mode === "realized";
    const backdrop = document.createElement("div");
    backdrop.className = "signal-modal-backdrop";
    backdrop.innerHTML = `
      <form class="signal-modal" novalidate>
        <div>
          <span class="eyebrow">${escapeHtml(isRealizedPayment ? "Pagamento do evento" : "Sinal recebido")}</span>
          <h3>${escapeHtml(isRealizedPayment ? "Registrar pagamento recebido" : "Registrar pagamento do sinal")}</h3>
          <p>${escapeHtml(
            isRealizedPayment
              ? "Para evento já realizado, o padrão é pagamento integral. Se houve sinal parcial, escolha 50%, 30% ou outro valor e o sistema organiza o saldo."
              : "Use 50% como padrão. Se o cliente pagou tudo ou combinou outro valor, registre aqui sem criar saldo indevido.",
          )}</p>
        </div>
        <fieldset>
          <legend>Tipo de pagamento</legend>
          <div class="signal-payment-presets">
            <label>
              <input type="radio" name="paymentPreset" value="50" ${defaultPreset === "50" ? "checked" : ""} />
              <span>50% padrão</span>
              <small>${escapeHtml(formatMoney(presetAmounts["50"]))}</small>
            </label>
            <label>
              <input type="radio" name="paymentPreset" value="30" ${defaultPreset === "30" ? "checked" : ""} />
              <span>30%</span>
              <small>${escapeHtml(formatMoney(thirtyPercentAmount))}</small>
            </label>
            <label>
              <input type="radio" name="paymentPreset" value="100" ${defaultPreset === "100" ? "checked" : ""} />
              <span>Pagamento integral</span>
              <small>${escapeHtml(formatMoney(totalValue))}</small>
            </label>
            <label>
              <input type="radio" name="paymentPreset" value="custom" ${defaultPreset === "custom" ? "checked" : ""} />
              <span>Outro valor</span>
              <small>combinado</small>
            </label>
          </div>
        </fieldset>
        <label>
          Valor recebido
          <input name="amount" type="text" inputmode="decimal" value="${escapeHtml(defaultAmount.toFixed(2).replace(".", ","))}" />
        </label>
        <label>
          Data do pagamento
          <input name="date" type="date" value="${escapeHtml(getTodayInputValue())}" />
        </label>
        <label>
          Comprovante bancário <span class="optional-label">opcional</span>
          <input name="proof" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
        </label>
        <fieldset>
          <legend>Banco de recebimento</legend>
          <div class="signal-bank-options">
            ${signalPaymentBanks
              .map(
                (bank) => `
                  <label>
                    <input type="checkbox" name="bank" value="${escapeHtml(bank)}" />
                    <span>${escapeHtml(bank)}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </fieldset>
        <small class="signal-error" aria-live="polite"></small>
        <div class="signal-modal-actions">
          <button class="secondary" type="button" data-signal-cancel>Cancelar</button>
          <button class="primary" type="submit">${escapeHtml(isRealizedPayment ? "Confirmar pagamento" : "Confirmar sinal")}</button>
        </div>
      </form>
    `;

    const form = backdrop.querySelector("form");
    const amountInput = form.querySelector('input[name="amount"]');
    const dateInput = form.querySelector('input[name="date"]');
    const proofInput = form.querySelector('input[name="proof"]');
    const presetInputs = [...form.querySelectorAll('input[name="paymentPreset"]')];
    const errorNode = form.querySelector(".signal-error");
    let amountChecked = false;
    let dateChecked = false;
    const close = (value) => {
      backdrop.remove();
      resolve(value);
    };
    const setAmountFromPreset = (preset) => {
      const presetAmount = presetAmounts[preset];
      if (typeof presetAmount !== "number") return;
      amountInput.value = presetAmount.toFixed(2).replace(".", ",");
      amountChecked = true;
      errorNode.textContent = "";
    };

    presetInputs.forEach((input) => {
      input.addEventListener("change", () => setAmountFromPreset(input.value));
    });
    amountInput.addEventListener("click", () => {
      amountChecked = true;
    });
    amountInput.addEventListener("input", () => {
      amountChecked = true;
      const custom = presetInputs.find((input) => input.value === "custom");
      if (custom) custom.checked = true;
    });
    dateInput.addEventListener("click", () => {
      dateChecked = true;
    });
    dateInput.addEventListener("change", () => {
      dateChecked = true;
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(null);
    });
    backdrop.querySelector("[data-signal-cancel]").addEventListener("click", () => close(null));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const amount = toNumber(amountInput.value);
      const date = dateInput.value;
      const banks = [...form.querySelectorAll('input[name="bank"]:checked')].map((input) => input.value);
      const preset = form.querySelector('input[name="paymentPreset"]:checked')?.value || "custom";

      if (!amountChecked || !dateChecked) {
        errorNode.textContent = "Clique no valor e na data para conferir antes de confirmar.";
        return;
      }
      if (!amount || amount <= 0) {
        errorNode.textContent = "Informe o valor recebido.";
        amountInput.focus();
        return;
      }
      if (!date) {
        errorNode.textContent = "Informe a data do pagamento.";
        dateInput.focus();
        return;
      }
      if (!banks.length) {
        errorNode.textContent = "Marque pelo menos um banco para confirmar.";
        return;
      }

      try {
        const proof = await readSignalProofFile(proofInput.files?.[0] || null);
        const coverage = getPaymentCoverage(totalValue, { valor: amount });
        const manualPercentual = totalValue ? roundCurrency((amount / totalValue) * 100) : null;
        const info = createSignalPaymentInfo(amount, date, banks, {
          percentualSinal: preset === "custom" ? manualPercentual : totalValue ? Number(preset) : null,
          tipoPagamento: coverage.isSignalIntegral ? "integral" : preset === "custom" ? "manual" : `percentual_${preset}`,
          pagamentoIntegral: coverage.isSignalIntegral,
          valorTotalEvento: totalValue,
          saldoEstimado: coverage.remainingDue,
        });
        if (proof) info.comprovante = proof;
        close(info);
      } catch (error) {
        errorNode.textContent = error.message;
      }
    });

    document.body.appendChild(backdrop);
    amountInput.focus();
    amountInput.select();
  });
}

function showRemainingPaymentDialog(defaultAmount = 0, total = 0, signalInfo = null, previousRemainingInfo = null) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    const signalValue = toNumber(signalInfo?.valor);
    const previousRemainingValue = toNumber(previousRemainingInfo?.valor);
    const signalBanks = Array.isArray(signalInfo?.bancos) ? signalInfo.bancos.join(", ") : signalInfo?.banco || "Banco não informado";
    backdrop.className = "signal-modal-backdrop";
    backdrop.innerHTML = `
      <form class="signal-modal" novalidate>
        <div>
          <span class="eyebrow">Pagamento restante</span>
          <h3>Registrar pagamento restante</h3>
          <p>Confirme valor, data e banco. O sistema compara sinal + pagamentos registrados com o total do evento.</p>
        </div>
        <label>
          Valor recebido
          <input name="amount" type="text" inputmode="decimal" value="${escapeHtml(defaultAmount.toFixed(2).replace(".", ","))}" />
        </label>
        <label>
          Data do pagamento
          <input name="date" type="date" value="${escapeHtml(getTodayInputValue())}" />
        </label>
        <label>
          Comprovante bancário <span class="optional-label">opcional</span>
          <input name="proof" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
        </label>
        <fieldset>
          <legend>Banco de recebimento</legend>
          <div class="signal-bank-options">
            ${signalPaymentBanks
              .map(
                (bank) => `
                  <label>
                    <input type="checkbox" name="bank" value="${escapeHtml(bank)}" />
                    <span>${escapeHtml(bank)}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </fieldset>
        <div class="payment-mismatch is-hidden">
          <strong>Atenção: soma diferente do total do evento.</strong>
          <p></p>
          <label>
            Justificativa da diferença
            <textarea name="differenceReason" rows="3" placeholder="Explique o motivo da diferença em pelo menos 10 palavras."></textarea>
          </label>
        </div>
        <small class="signal-error" aria-live="polite"></small>
        <div class="signal-modal-actions">
          <button class="secondary" type="button" data-signal-cancel>Cancelar</button>
          <button class="primary" type="submit">Confirmar restante</button>
        </div>
      </form>
    `;

    const form = backdrop.querySelector("form");
    const amountInput = form.querySelector('input[name="amount"]');
    const dateInput = form.querySelector('input[name="date"]');
    const proofInput = form.querySelector('input[name="proof"]');
    const reasonInput = form.querySelector('textarea[name="differenceReason"]');
    const mismatchBox = form.querySelector(".payment-mismatch");
    const mismatchText = mismatchBox.querySelector("p");
    const errorNode = form.querySelector(".signal-error");
    let amountChecked = false;
    let dateChecked = false;
    const close = (value) => {
      backdrop.remove();
      resolve(value);
    };

    amountInput.addEventListener("click", () => {
      amountChecked = true;
    });
    amountInput.addEventListener("input", () => {
      amountChecked = true;
      mismatchBox.classList.add("is-hidden");
      errorNode.textContent = "";
    });
    dateInput.addEventListener("click", () => {
      dateChecked = true;
    });
    dateInput.addEventListener("change", () => {
      dateChecked = true;
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(null);
    });
    backdrop.querySelector("[data-signal-cancel]").addEventListener("click", () => close(null));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const amount = toNumber(amountInput.value);
      const date = dateInput.value;
      const banks = [...form.querySelectorAll('input[name="bank"]:checked')].map((input) => input.value);

      if (!amountChecked || !dateChecked) {
        errorNode.textContent = "Clique no valor e na data para conferir antes de confirmar.";
        return;
      }
      if (!amount || amount <= 0) {
        errorNode.textContent = "Informe o valor recebido.";
        amountInput.focus();
        return;
      }
      if (!date) {
        errorNode.textContent = "Informe a data do pagamento.";
        dateInput.focus();
        return;
      }
      if (!banks.length) {
        errorNode.textContent = "Marque pelo menos um banco para confirmar.";
        return;
      }

      const paidTotal = roundCurrency(signalValue + previousRemainingValue + amount);
      const expectedTotal = roundCurrency(total);
      const difference = roundCurrency(paidTotal - expectedTotal);
      const hasDifference = Math.abs(difference) >= 0.01;
      let differenceReason = "";

      if (hasDifference) {
        const previousText = previousRemainingValue ? `, mais pagamento já registrado de ${formatMoney(previousRemainingValue)}` : "";
        const message = `O sinal de ${formatMoney(signalValue)} em ${formatSignalPaymentDate(signalInfo?.data)} (${signalBanks}) somado ao pagamento restante de ${formatMoney(
          amount,
        )} em ${formatSignalPaymentDate(date)} (${banks.join(", ")})${previousText} dá ${formatMoney(
          paidTotal,
        )}, diferente do valor total do evento ${formatMoney(expectedTotal)}. Ajuste o valor ou confirme a diferença com justificativa.`;
        mismatchBox.classList.remove("is-hidden");
        mismatchText.textContent = message;
        differenceReason = reasonInput.value.trim();
        if (countWords(differenceReason) < 10) {
          errorNode.textContent = "Para confirmar a diferença, escreva uma justificativa com pelo menos 10 palavras.";
          reasonInput.focus();
          return;
        }
      }

      try {
        const proof = await readSignalProofFile(proofInput.files?.[0] || null);
        const consolidatedAmount = previousRemainingValue ? roundCurrency(previousRemainingValue + amount) : amount;
        const info = createSignalPaymentInfo(consolidatedAmount, date, banks, {
          valorRecebidoAgora: roundCurrency(amount),
          valorAnterior: previousRemainingValue || null,
        });
        if (proof) info.comprovante = proof;
        if (previousRemainingInfo) {
          info.pagamentoAnterior = {
            valor: previousRemainingValue,
            data: previousRemainingInfo.data || "",
            bancos: previousRemainingInfo.bancos || previousRemainingInfo.banco || "",
            comprovante: previousRemainingInfo.comprovante || null,
          };
        }
        if (hasDifference) {
          info.justificativaDiferenca = differenceReason;
          info.somaPagamentos = paidTotal;
          info.diferencaTotal = difference;
          info.valorTotalEvento = expectedTotal;
        }
        close(info);
      } catch (error) {
        errorNode.textContent = error.message;
      }
    });

    document.body.appendChild(backdrop);
    amountInput.focus();
    amountInput.select();
  });
}

function getGuestCount() {
  return Math.max(1, Math.floor(toNumber(fields.guestCount.value) || 1));
}

function getDuration() {
  return Math.max(1, toNumber(fields.eventDuration.value) || 1);
}

function getValidityDays() {
  const raw = fields.validity?.value || "";
  const match = String(raw).match(/\d+/);
  return match ? Math.max(1, Number(match[0]) || 0) : 0;
}

function getBillableGuests(item) {
  return Math.max(getGuestCount(), toNumber(item.minimo) || 0);
}

function getHalfHourBlocks(duration) {
  if (duration <= 2) return 0;
  return Math.ceil((duration - 2) / 0.5);
}

function getHalfHourBlocksAfter(duration, includedDuration) {
  if (duration <= includedDuration) return 0;
  return Math.ceil((duration - includedDuration) / 0.5);
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

  if (item.formula === "serviceIncluded90PerPerson") {
    const baseGross = toNumber(item.preco2h);
    const extraGross = toNumber(item.precoMeiaHoraExtra);
    const halfBlocks = getHalfHourBlocksAfter(duration, 1.5);
    const grossUnitPrice = baseGross + halfBlocks * extraGross;
    unitPrice = grossUnitPrice / (1 + SERVICE_RATE);
    total = unitPrice * billableGuests;
    detail = `${billableGuests} pessoas faturadas x ${formatMoney(
      grossUnitPrice,
    )} por pessoa com taxa inclusa (${duration}h)`;
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

function getMainEventTypeFromItemCategory(category = "") {
  const normalized = normalizarTextoSeguro(category);
  if (!normalized) return "";
  if (normalized.includes("almoco")) return "Almoço Carioca";
  if (normalized.includes("cafe") || normalized.includes("coffee") || normalized.includes("brunch")) {
    return "Café da Manhã / Coffee Break";
  }
  if (normalized.includes("coquetel") || normalized.includes("comidas")) return "Coquetel";
  if (normalized.includes("welcome") || normalized.includes("snacks")) return "Welcome Drink";
  if (normalized.includes("workshop")) return "Workshop de Caipirinha";
  return "";
}

function inferEventTypeFromSelectedItems(selected = getSelectedItems()) {
  if (!selected.length) return "";
  const inferred = selected.map((item) => getMainEventTypeFromItemCategory(item.tipoEvento));
  const primaryPriority = [
    "Almoço Carioca",
    "Café da Manhã / Coffee Break",
    "Coquetel",
    "Welcome Drink",
    "Workshop de Caipirinha",
  ];
  return primaryPriority.find((type) => inferred.includes(type)) || inferred.find(Boolean) || "";
}

function getCurrentEventType({ infer = true } = {}) {
  const explicit = fields.eventType?.value?.trim() || "";
  if (explicit) return explicit;
  return infer ? inferEventTypeFromSelectedItems() : "";
}

function syncEventTypeFromSelection({ force = false } = {}) {
  if (!fields.eventType) return "";
  if (!force && fields.eventType.value.trim()) return fields.eventType.value.trim();
  const inferred = inferEventTypeFromSelectedItems();
  if (inferred) fields.eventType.value = inferred;
  return fields.eventType.value.trim();
}

function getCurrentContactValues() {
  const proposal = getActiveProposal();
  const request = getActiveQuoteRequest();
  const snapshot = proposal?.snapshot || request?.snapshot || {};
  const sourceSnapshot = proposal?.snapshot?.sourceRequestSnapshot || request?.snapshot || {};
  const client = snapshot.client || snapshot.cliente || {};
  const sourceClient = sourceSnapshot.client || sourceSnapshot.cliente || {};
  const readField = (field, selector) => String(field?.value || document.querySelector(selector)?.value || "").trim();
  return {
    name:
      readField(fields.clientName, "#clientName") ||
      proposal?.cliente_nome ||
      request?.cliente_nome ||
      client.name ||
      client.nome ||
      sourceClient.name ||
      sourceClient.nome ||
      "",
    email:
      readField(fields.clientEmail, "#clientEmail") ||
      proposal?.cliente_email ||
      request?.cliente_email ||
      client.email ||
      sourceClient.email ||
      "",
    phone:
      readField(fields.clientPhone, "#clientPhone") ||
      proposal?.cliente_whatsapp ||
      request?.cliente_whatsapp ||
      client.phone ||
      client.whatsapp ||
      sourceClient.phone ||
      sourceClient.whatsapp ||
      "",
  };
}

function isLikelyEmailAddress(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
}

function isLikelyPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return false;
  return digits.length >= 10 && digits.length <= 15;
}

function getContactReviewState(contact) {
  const missing = [];
  if (!contact.name) missing.push("nome do cliente");
  if (!contact.email && !contact.phone) missing.push("e-mail ou celular/WhatsApp de retorno");
  if (missing.length) {
    return {
      status: "error",
      detail: `Falta ${missing.join(" e ")} em Dados do cliente.`,
    };
  }

  const emailOk = contact.email ? isLikelyEmailAddress(contact.email) : false;
  const phoneOk = contact.phone ? isLikelyPhoneNumber(contact.phone) : false;
  const invalid = [];
  if (contact.email && !emailOk) invalid.push("e-mail");
  if (contact.phone && !phoneOk) invalid.push("celular/WhatsApp");

  if (!emailOk && !phoneOk) {
    return {
      status: "error",
      detail: `Revise ${invalid.join(" e ")}. É preciso ao menos um canal válido.`,
    };
  }

  if (invalid.length) {
    const validChannel = phoneOk ? "celular/WhatsApp" : "e-mail";
    return {
      status: "warning",
      detail: `${validChannel} válido. Revise também ${invalid.join(" e ")}.`,
    };
  }

  const channels = [phoneOk ? "celular/WhatsApp" : "", emailOk ? "e-mail" : ""].filter(Boolean).join(" e ");
  return {
    status: "ok",
    detail: `Contato pronto: ${contact.name} com ${channels} para retorno.`,
  };
}

function getContactReviewDetail(contact) {
  return getContactReviewState(contact).detail;
}

function getAllowedCategoriesForEvent(eventType = "") {
  const mainCategory = getEventCategoryFromRequest(eventType);
  if (mainCategory === "Coquetel") return ["Coquetel", "Comidas", "Welcome Drink", "Workshop de Caipirinha", "Snacks"];
  if (mainCategory === "Welcome Drink") return ["Welcome Drink", "Snacks"];
  if (mainCategory) return [mainCategory];
  return [];
}

function getProposalReviewItems() {
  const selected = getSelectedItems();
  const totals = getQuoteTotals();
  const context = getActiveCommercialContext();
  const sourceData = getFormSourceData();
  const commercialContext = {
    clientType: context.clientType || sourceData.clientType,
    budgetRange: context.budgetRange || sourceData.budgetRange,
    origin: context.origin || sourceData.origin,
    finalClient: context.finalClient || sourceData.finalClient,
    groupName: context.groupName || sourceData.groupName,
    occasion: context.occasion || sourceData.occasion,
    moment: context.moment || sourceData.moment,
    extras: context.extras || sourceData.extras,
  };
  const contact = getCurrentContactValues();
  const eventDate = fields.eventDate.value;
  const eventTime = fields.eventTime.value;
  const eventType = getCurrentEventType();
  const guests = getGuestCount();
  const validityDays = getValidityDays();
  const signalDeadlineHours = getSignalDeadlineHours();
  const allowedCategories = getAllowedCategoriesForEvent(eventType);
  const requiredCategory = getEventCategoryFromRequest(eventType);
  const availability = getAvailabilityReviewStatus();
  const isAgency = ["Agência de turismo receptivo / DMC", "Agência de marketing / eventos"].includes(commercialContext.clientType);
  const finalClient =
    commercialContext.finalClient ||
    context.snapshot?.client?.finalClient ||
    context.snapshot?.clienteFinal ||
    getFinalClientFromSnapshot(context.snapshot);
  const groupName =
    commercialContext.groupName ||
    context.snapshot?.client?.groupName ||
    context.snapshot?.nomeGrupo ||
    getGroupNameFromSnapshot(context.snapshot);
  const hasCategoryMismatch =
    allowedCategories.length > 0 &&
    selected.length > 0 &&
    !selected.some((item) => allowedCategories.includes(item.tipoEvento));
  const missingBaseCategory = requiredCategory && selected.length > 0 && !selected.some((item) => item.tipoEvento === requiredCategory);
  const minimumWarnings = selected.filter((item) => guests < (toNumber(item.minimo) || 0));
  const hasNotes =
    fields.notes.value.trim() ||
    fields.eventReason.value.trim() ||
    sourceData.reason ||
    sourceData.preferences ||
    sourceData.extras ||
    sourceData.observations;
  const contactReview = getContactReviewState(contact);

  return [
    {
      id: "contact",
      label: "Contato do cliente",
      status: contactReview.status,
      detail: contactReview.detail,
      target: "client",
    },
    {
      id: "client_context",
      label: "Cliente final",
      status: !isAgency || finalClient || groupName ? "ok" : "warning",
      detail: isAgency
        ? finalClient || groupName
          ? [finalClient ? `Cliente final: ${finalClient}` : "", groupName ? `Grupo: ${groupName}` : ""].filter(Boolean).join(" · ")
          : "Para agência, registre cliente final ou nome do grupo antes de usar como base de resposta."
        : "Cliente direto ou empresa sem intermediário identificado.",
      target: "source",
    },
    {
      id: "commercial_profile",
      label: "Perfil comercial",
      status: commercialContext.clientType && commercialContext.budgetRange && commercialContext.origin ? "ok" : "warning",
      optional: true,
      detail:
        commercialContext.clientType && commercialContext.budgetRange && commercialContext.origin
          ? [commercialContext.clientType, commercialContext.budgetRange, commercialContext.origin].filter(Boolean).join(" · ")
          : `Sugestão: complete ${[
              !commercialContext.clientType ? "tipo de cliente" : "",
              !commercialContext.budgetRange ? "faixa de investimento" : "",
              !commercialContext.origin ? "origem do lead" : "",
            ]
              .filter(Boolean)
              .join(", ")} para priorizar o atendimento.`,
      target: "source",
    },
    {
      id: "format",
      label: "Formato",
      status: eventType ? "ok" : "error",
      detail: eventType ? `Formato principal: ${eventType}.` : "Informe o formato do evento antes de enviar.",
      target: "items",
    },
    {
      id: "date",
      label: "Data e horário",
      status: eventDate && eventTime ? "ok" : "error",
      detail: eventDate && eventTime ? `${formatDateFromIso(eventDate)} · ${eventTime}` : "Defina data e horário de chegada.",
      target: "client",
    },
    {
      id: "availability",
      label: "Agenda",
      status: availability.status,
      detail: availability.detail,
      target: "client",
    },
    {
      id: "guests",
      label: "Pax e duração",
      status: guests > 0 && minimumWarnings.length === 0 ? "ok" : guests > 0 ? "warning" : "error",
      detail:
        guests > 0
          ? minimumWarnings.length
            ? `${guests} pax. Atenção aos mínimos: ${minimumWarnings.map((item) => item.nome).join(", ")}.`
            : `${guests} pax · ${getDuration()}h.`
          : "Informe a quantidade de convidados.",
      target: "client",
    },
    {
      id: "items",
      label: "Cardápio",
      status: selected.length ? (hasCategoryMismatch ? "error" : missingBaseCategory ? "warning" : "ok") : "error",
      detail: selected.length
        ? hasCategoryMismatch
          ? `Pedido: ${eventType || "evento"}. Troque itens ou formato: a categoria escolhida não combina.`
          : missingBaseCategory
            ? `Confira o produto base de ${requiredCategory}. Há complementos, mas falta o item principal.`
          : `${selected.length} ${selected.length === 1 ? "item" : "itens"}: ${selected.map((item) => item.nome).slice(0, 3).join(", ")}${selected.length > 3 ? "..." : ""}.`
        : "Escolha os itens da proposta antes de enviar.",
      target: "items",
    },
    {
      id: "briefing",
      label: "Observações",
      status: hasNotes ? "ok" : "warning",
      detail: hasNotes ? "Briefing e observações revisados." : "Sem observações. Se houver restrições, montagem ou pedido especial, registre.",
      target: "notes",
    },
    {
      id: "value",
      label: "Valor final",
      status: selected.length && totals.total > 0 ? "ok" : "error",
      detail:
        selected.length && totals.total > 0
          ? `${formatMoney(totals.total)} · sinal em ${formatSignalDeadlineHours()} · validade ${fields.validity.value || "a definir"}.`
          : "Monte os itens para calcular o total.",
      target: "items",
    },
    {
      id: "conditions",
      label: "Validade e sinal",
      status: validityDays > 0 && signalDeadlineHours >= 12 && signalDeadlineHours <= 360 ? "ok" : "error",
      detail:
        validityDays > 0 && signalDeadlineHours >= 12 && signalDeadlineHours <= 360
          ? `Validade ${validityDays} dia(s) · prazo do sinal ${formatSignalDeadlineHours()}.`
          : "Defina validade e prazo do sinal entre 12h e 15 dias.",
      target: "review",
    },
  ];
}

function isOptionalReviewItem(item) {
  return Boolean(item?.optional || ["commercial_profile", "profile"].includes(item?.id));
}

function getProposalSendReviewItems(items = getProposalReviewItems()) {
  return items.filter((item) => !isOptionalReviewItem(item));
}

function getProposalReviewSummary(items = getProposalReviewItems()) {
  const errors = items.filter((item) => item.status === "error").length;
  const warningItems = items.filter((item) => item.status === "warning");
  const warnings = warningItems.length;
  const optionalWarnings = warningItems.filter(isOptionalReviewItem).length;
  const attentionWarnings = warnings - optionalWarnings;
  return {
    errors,
    warnings,
    optionalWarnings,
    attentionWarnings,
    ready: errors === 0,
  };
}

function getSmartProposalAlerts(items = getProposalReviewItems()) {
  const alerts = [];
  const selected = getSelectedItems();
  const selectedCategories = new Set(selected.map((item) => item.tipoEvento));
  const context = getActiveServiceContext();
  const category = getEventCategoryFromRequest(getCurrentEventType() || context.eventType);
  const guests = getGuestCount();
  const totals = getQuoteTotals();
  const eventDate = fields.eventDate.value;
  const hasError = (id) => items.some((item) => item.id === id && item.status === "error");
  const push = (level, title, detail, target = "review", kind = "risco") => alerts.push({ level, title, detail, target, kind });

  if (hasError("contact") || hasError("format") || hasError("date") || hasError("items") || hasError("value") || hasError("conditions")) {
    push("danger", "Envio bloqueado", "Revise contato, formato, agenda, itens, valor e condições.", "review", "bloqueio");
  }

  if (category === "Coquetel" && selected.length && !selectedCategories.has("Comidas")) {
    push("warning", "Coquetel sem comida", "Confirme se o cliente quer apenas bebidas. Muitas propostas convertem melhor com Brasileiro I ou II.", "items", "upsell");
  }

  if (category === "Coquetel" && selected.length && !selectedCategories.has("Welcome Drink")) {
    push("opportunity", "Welcome Drink possível", "Boa recepção antes do coquetel, especialmente com chegadas espaçadas.", "items", "upsell");
  }

  if (category === "Coquetel" && selected.length && !selectedCategories.has("Workshop de Caipirinha")) {
    push("opportunity", "Experiência adicional possível", "Workshop pode aumentar valor percebido para agência, DMC, relacionamento e grupos internacionais.", "items", "upsell");
  }

  if (["Agência de turismo receptivo / DMC", "Agência de marketing / eventos"].includes(context.clientType)) {
    const hasFinalClient = Boolean(context.finalClient || context.snapshot?.client?.finalClient || context.snapshot?.clienteFinal || getFinalClientFromSnapshot(context.snapshot));
    const hasGroupName = Boolean(context.groupName || context.snapshot?.client?.groupName || context.snapshot?.nomeGrupo || getGroupNameFromSnapshot(context.snapshot));
    if (!hasFinalClient && !hasGroupName) {
      push("warning", "Agência sem cliente final ou grupo", "Registre cliente final ou grupo para localizar rápido depois.", "source", "qualificação");
    }
  }

  if (guests >= 40) {
    push("warning", "Grupo grande", "Confira chegada, equipe, cardápio e tempo de serviço.", "client", "operação");
  }

  if (totals.privatization?.amount > 0) {
    push("warning", "Privatização no valor", "Explique exclusividade e necessidade operacional.", "items", "preço");
  }

  if (eventDate) {
    const start = new Date(`${eventDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    if (days >= 0 && days <= 7) {
      push("warning", "Data próxima", "Priorize resposta e sinal. Quanto mais perto, maior o risco de agenda e operação.", "client", "tempo");
    }
  }

  if (!alerts.length) {
    push("success", "Sem alerta crítico", "A proposta está coerente para revisão humana e envio com segurança.", "review", "ok");
  }

  return alerts.slice(0, 5);
}

function getProposalConfidence(items = getProposalReviewItems(), alerts = getSmartProposalAlerts(items)) {
  const errors = items.filter((item) => item.status === "error").length;
  const warnings = items.filter((item) => item.status === "warning" && !isOptionalReviewItem(item)).length;
  const optionalWarnings = items.filter((item) => item.status === "warning" && isOptionalReviewItem(item)).length;
  const dangerAlerts = alerts.filter((item) => item.level === "danger").length;
  const warningAlerts = alerts.filter((item) => item.level === "warning").length;
  const opportunityAlerts = alerts.filter((item) => item.level === "opportunity").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 24 - warnings * 7 - optionalWarnings * 3 - dangerAlerts * 18 - warningAlerts * 6 - opportunityAlerts * 2));
  const status = errors || dangerAlerts ? "blocked" : score >= 90 ? "ready" : "attention";
  const label = status === "blocked" ? "Bloqueado" : score >= 95 ? "Pronto para envio automático futuro" : score >= 90 ? "Alta confiança" : "Revisão humana recomendada";
  const note =
    status === "blocked"
      ? "Ainda há risco de erro. Corrija os obrigatórios."
      : score >= 95
        ? "Checklist, valor, agenda e contexto estão fortes para envio com mínima intervenção."
        : score >= 90
          ? "Pode avançar. Confira os alertas antes do envio."
          : "Use a revisão em 60 segundos para reduzir atrito e aumentar conversão.";
  return { score, status, label, note };
}

function getProposalAutomationReadiness(items = getProposalReviewItems(), alerts = getSmartProposalAlerts(items), confidence = getProposalConfidence(items, alerts)) {
  const blockers = items.filter((item) => item.status === "error");
  const attention = items.filter((item) => item.status === "warning");
  const commercialAlerts = alerts.filter((item) => ["warning", "opportunity"].includes(item.level));
  const status = blockers.length
    ? "humano_obrigatorio"
    : confidence.score >= 95 && !attention.length
      ? "candidato_automatico"
      : "humano_rapido";
  const label =
    status === "humano_obrigatorio"
      ? "Revisão obrigatória"
      : status === "candidato_automatico"
        ? "Pronto para padronizar no futuro"
        : "Revisão humana rápida";
  const note =
    status === "humano_obrigatorio"
      ? "Há bloqueio. Não envie automaticamente."
      : status === "candidato_automatico"
        ? "Fatores críticos consistentes. Bom modelo para padronizar."
        : "Pode ser enviado por humano. Alertas ainda ajudam a vender.";
  return {
    status,
    label,
    note,
    blockers: blockers.map((item) => item.id),
    attention: attention.map((item) => item.id),
    commercialAlerts: commercialAlerts.map((item) => item.kind),
  };
}

function getCustomerDecisionLoop(proposal = getActiveProposal()) {
  const snapshot = proposal?.snapshot || {};
  const response = proposal?.cliente_resposta || snapshot.clienteResposta?.acao || "";
  const proof = proposal?.cliente_solicitacao?.comprovante || snapshot.clienteResposta?.comprovante || snapshot.pagamentoSinal?.comprovante || null;
  const hasPublicLink = Boolean(proposal?.public_token);
  const sent = ["proposta_enviada", "negociacao", "confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"].includes(normalizeProposalStatus(proposal?.status));
  const steps = [
    {
      id: "proposal",
      label: "Proposta",
      title: sent ? "Link enviado/salvo" : "Gerar link público",
      status: hasPublicLink && sent ? "done" : hasPublicLink ? "current" : "pending",
      detail: hasPublicLink ? "Cliente recebe um link único para decidir." : "Salve a proposta para criar o link seguro.",
    },
    {
      id: "client",
      label: "Cliente",
      title: response ? getClientResponseLabel(response) : "Aguardar decisão",
      status: response ? "done" : sent ? "current" : "pending",
      detail: response ? "Resposta voltou para o funil." : "Cliente pode aprovar, pedir ajuste ou encerrar pedido.",
    },
    {
      id: "signal",
      label: "Sinal",
      title: proof ? "Comprovante anexado" : "Capturar sinal",
      status: proof ? "done" : response === "confirmar" ? "current" : "pending",
      detail: proof ? "Equipe valida o pagamento e confirma a reserva." : "Ao aprovar, o cliente vê Pix/dados bancários e pode anexar comprovante.",
    },
  ];
  const current = steps.find((step) => step.status === "current") || steps.find((step) => step.status === "pending") || steps[steps.length - 1];
  return { steps, current, response, hasPublicLink, proof };
}

function renderCustomerDecisionLoop(loop = getCustomerDecisionLoop()) {
  return `
    <div class="customer-decision-loop">
      <div class="customer-decision-heading">
        <span>Ciclo proposta → cliente → decisão</span>
        <strong>${escapeHtml(loop.current?.title || "Próximo passo do cliente")}</strong>
        <small>${escapeHtml(loop.current?.detail || "O link público registra aprovação, ajuste, cancelamento e comprovante.")}</small>
      </div>
      <div class="customer-decision-steps">
        ${loop.steps
          .map(
            (step) => `
              <article class="customer-decision-step is-${escapeHtml(step.status)}">
                <span>${escapeHtml(step.label)}</span>
                <strong>${escapeHtml(step.title)}</strong>
                <small>${escapeHtml(step.detail)}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function getSendReviewSignature(items = getProposalReviewItems()) {
  const totals = getQuoteTotals();
  const sourceData = getFormSourceData();
  return JSON.stringify({
    client: fields.clientName.value.trim(),
    email: fields.clientEmail.value.trim(),
    phone: fields.clientPhone.value.trim(),
    company: sourceData.company,
    clientType: sourceData.clientType,
    budgetRange: sourceData.budgetRange,
    origin: sourceData.origin,
    finalClient: sourceData.finalClient,
    groupName: sourceData.groupName,
    moment: sourceData.moment,
    occasion: sourceData.occasion,
    sourceReason: sourceData.reason,
    sourcePreferences: sourceData.preferences,
    sourceExtras: sourceData.extras,
    sourceObservations: sourceData.observations,
    eventType: getCurrentEventType(),
    date: fields.eventDate.value,
    time: fields.eventTime.value,
    guests: getGuestCount(),
    duration: getDuration(),
    validity: fields.validity.value.trim(),
    signalDeadline: fields.signalDeadlineHours.value,
    selectedIds: [...state.selectedIds].sort(),
    total: roundCurrency(totals.total),
    adjustment: roundCurrency(getManualAdjustment()),
    notes: fields.notes.value.trim(),
    reason: fields.eventReason.value.trim(),
    review: items.map((item) => [item.id, item.status]),
  });
}

function isSendReviewApproved(items = getProposalReviewItems()) {
  return Boolean(state.sendReviewApprovedSignature && state.sendReviewApprovedSignature === getSendReviewSignature(items));
}

function approveSendReview() {
  const items = getProposalReviewItems();
  const summary = getProposalReviewSummary(items);
  const alerts = getSmartProposalAlerts(items);
  const confidence = getProposalConfidence(items, alerts);
  const automation = getProposalAutomationReadiness(items, alerts, confidence);
  if (!summary.ready) {
    const firstError = items.find((item) => item.status === "error");
    showToast(firstError?.detail || "Corrija os pontos obrigatórios antes de aprovar.");
    scrollToReviewTarget(firstError?.target || "client");
    return false;
  }
  state.sendReviewApprovedSignature = getSendReviewSignature(items);
  state.sendReviewApproval = {
    signature: state.sendReviewApprovedSignature,
    approvedAt: new Date().toISOString(),
    approvedBy: getCommercialActor(),
    actorRole: getTeamProfile().label,
    confidence: confidence.score,
    status: confidence.status,
    automation,
    checklist: items.map((item) => ({ id: item.id, label: item.label, status: item.status, detail: item.detail })),
    alerts: alerts.map((item) => ({ level: item.level, title: item.title, detail: item.detail, kind: item.kind })),
  };
  renderSendReview();
  showToast("Revisão aprovada. Agora pode enviar a proposta com segurança.");
  return true;
}

function getSendReviewPrimaryCommand(summary, items = getProposalReviewItems(), approvalItems = items) {
  if (!summary.ready) {
    const firstIssue = items.find((item) => item.status === "error") || items.find((item) => item.status === "warning");
    return {
      action: "fix",
      label: "Corrigir antes de enviar",
      detail: firstIssue ? `${firstIssue.label}: ${firstIssue.detail}` : "Revise os dados destacados abaixo.",
      target: firstIssue?.target || "client",
    };
  }
  if (!isSendReviewApproved(approvalItems)) {
    return {
      action: "approve",
      label: "Revisado, pode enviar",
      detail: "Confirme que data, horário, pax, cardápio, valor, sinal, contato e observações foram conferidos.",
      target: "review",
    };
  }
  const hasPhone = Boolean(fields.clientPhone.value.trim().replace(/\D/g, ""));
  const hasEmail = isLikelyEmailAddress(fields.clientEmail.value.trim());
  if (hasPhone) {
    return {
      action: "whatsapp",
      label: "Enviar por WhatsApp",
      detail: "Canal mais rápido para aprovação, ajustes e comprovante.",
      target: "client",
    };
  }
  if (hasEmail) {
    return {
      action: "email",
      label: "Enviar por e-mail",
      detail: "Envia o link seguro pelo ZeptoMail e registra no histórico.",
      target: "client",
    };
  }
  return {
    action: "fix",
    label: "Informar canal de envio",
    detail: "Inclua celular ou e-mail do cliente.",
    target: "client",
  };
}

function getActiveCommercialContext() {
  const request = state.quoteRequests.find((item) => item.id === state.activeQuoteRequestId);
  const proposal = state.proposals.find((item) => item.id === state.activeProposalId);
  const proposalSnapshot = proposal?.snapshot || {};
  const snapshot = proposal?.snapshot?.sourceRequestSnapshot || proposal?.snapshot || request?.snapshot || {};
  const overrides = getCurrentSourceOverrides();
  const qualification = {
    ...(snapshot.qualificacao || snapshot.qualification || {}),
    ...(proposalSnapshot.qualificacao || proposalSnapshot.qualification || {}),
    ...(proposalSnapshot.sourceOverrides || {}),
    ...overrides,
  };
  const event = snapshot.evento || snapshot.event || {};
  return {
    request,
    proposal,
    snapshot,
    clientType: qualification.clientType || qualification.tipoCliente || proposalSnapshot.clientType || request?.tipo_cliente || "",
    budgetRange: qualification.budgetRange || qualification.faixaInvestimento || request?.faixa_investimento || "",
    origin: qualification.origin || qualification.origem || request?.origem || "",
    finalClient: qualification.finalClient || qualification.clienteFinal || getFinalClientFromSnapshot(proposalSnapshot) || getFinalClientFromSnapshot(snapshot),
    groupName: qualification.groupName || qualification.nomeGrupo || getGroupNameFromSnapshot(proposalSnapshot) || getGroupNameFromSnapshot(snapshot),
    occasion: qualification.occasion || qualification.ocasiao || event.ocasiao || event.perfil || event.occasion || "",
    moment: qualification.moment || qualification.momento || event.momento || event.moment || "",
    extras: event.extras || "",
  };
}

const structuredObservationPrefixes = [
  "referência do formulário:",
  "referencia do formulario:",
  "empresa:",
  "extras:",
  "tipo de cliente:",
  "cliente final:",
  "grupo:",
  "nome do grupo:",
  "origem:",
  "como conheceu:",
  "faixa de investimento:",
  "data flexível:",
  "data é flexível:",
  "momento informado:",
  "momento desejado:",
  "ocasião:",
  "ocasiao:",
  "formato escolhido:",
  "formato solicitado:",
  "janela de data flexível:",
  "período do dia:",
  "periodo do dia:",
  "horário de chegada:",
  "horario de chegada:",
  "pax e duração:",
  "pax e duracao:",
  "motivo do evento:",
  "preferências de alimentos e bebidas:",
  "preferencias de alimentos e bebidas:",
  "observação livre do cliente:",
  "observacao livre do cliente:",
];

function cleanClientObservationText(request = null, snapshot = {}) {
  const eventSnapshot = snapshot?.evento || snapshot?.event || {};
  const directObservation = eventSnapshot.observacoes || eventSnapshot.observations || "";
  if (String(directObservation || "").trim()) return String(directObservation).trim();
  return String(request?.observacoes || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !structuredObservationPrefixes.some((prefix) => line.toLowerCase().startsWith(prefix)))
    .join("\n")
    .trim();
}

function getSourceOverrideKey() {
  if (state.activeProposalId) return `proposal:${state.activeProposalId}`;
  if (state.activeQuoteRequestId) return `request:${state.activeQuoteRequestId}`;
  if (state.manualSourceKey) return state.manualSourceKey;
  return "";
}

function getCurrentSourceOverrides() {
  const key = getSourceOverrideKey();
  return key ? state.sourceOverrides[key] || {} : {};
}

function collectLiveSourcePanelValues({ includeEmpty = false } = {}) {
  const key = getSourceOverrideKey();
  if (!key || !nodes.formSourcePanel || nodes.formSourcePanel.dataset.sourceKey !== key) return {};
  const values = {};
  nodes.formSourcePanel.querySelectorAll("[data-source-field]").forEach((field) => {
    const sourceField = field.dataset.sourceField;
    if (!sourceField || typeof field.value === "undefined") return;
    const value = String(field.value || "").trim();
    if (value || includeEmpty) values[sourceField] = value;
  });
  return values;
}

function getLiveSourcePanelValues() {
  return collectLiveSourcePanelValues();
}

function persistLiveSourcePanelValues() {
  const key = getSourceOverrideKey();
  if (!key) return;
  const liveValues = collectLiveSourcePanelValues();
  if (!Object.keys(liveValues).length) return;
  state.sourceOverrides[key] = {
    ...(state.sourceOverrides[key] || {}),
    ...liveValues,
  };
}

function setCurrentSourceOverride(field, value) {
  const key = getSourceOverrideKey();
  if (!key || !field) return;
  state.sourceOverrides[key] = {
    ...(state.sourceOverrides[key] || {}),
    [field]: String(value || "").trim(),
  };
  state.sendReviewApprovedSignature = "";
  state.sendReviewApproval = null;
}

function normalizeSourceValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value || "").trim();
}

function inferMomentFromTime(timeValue = "") {
  const minutes = timeToMinutes(timeValue);
  if (minutes === null) return "";
  if (minutes < 11 * 60) return "Manhã em dia de semana";
  if (minutes < 15 * 60) return "Início do almoço";
  if (minutes < 19 * 60) return "Fim de tarde";
  return "Noite (19h-21h)";
}

function inferOccasionFromProposal() {
  const reason = fields.eventReason?.value?.trim();
  if (reason) return reason;
  const type = fields.eventType?.value?.trim();
  return type ? `Proposta de ${type}` : "";
}

function getStructuredObservationKey(label = "") {
  const normalized = normalizarTextoSeguro(label);
  if (!normalized) return "";
  if (normalized.includes("referencia") && normalized.includes("formulario")) return "reference";
  if (normalized === "empresa" || normalized.includes("empresa ou agencia")) return "company";
  if (normalized.includes("tipo") && normalized.includes("cliente")) return "clientType";
  if (normalized.includes("cliente final")) return "finalClient";
  if (normalized.includes("nome do grupo") || normalized === "grupo") return "groupName";
  if (normalized.includes("faixa") && normalized.includes("investimento")) return "budgetRange";
  if (normalized.includes("origem") || normalized.includes("como conheceu")) return "origin";
  if (normalized.includes("momento")) return "moment";
  if (normalized.includes("ocasiao") || normalized.includes("objetivo")) return "occasion";
  if (normalized.includes("formato")) return "eventType";
  if (normalized.includes("janela") && normalized.includes("data")) return "flexibleDate";
  if (normalized.includes("data") && normalized.includes("flexivel")) return "flexibleDateStatus";
  if (normalized.includes("periodo")) return "timeRange";
  if (normalized.includes("horario") && normalized.includes("chegada")) return "arrivalTime";
  if (normalized.includes("pax") || normalized.includes("convidados")) return "guestsDuration";
  if (normalized.includes("duracao")) return "duration";
  if (normalized.includes("motivo")) return "reason";
  if (normalized.includes("preferencias") || normalized.includes("alimentos") || normalized.includes("bebidas")) return "preferences";
  if (normalized.includes("extras")) return "extras";
  if (normalized.includes("observacao")) return "observations";
  return "";
}

function parseStructuredObservationText(...sources) {
  const parsed = {};
  const lines = sources
    .filter(Boolean)
    .flatMap((source) => String(source).split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const separator = line.indexOf(":");
    if (separator <= 0) return;
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!value) return;
    const key = getStructuredObservationKey(label);
    if (!key) return;

    if (key === "guestsDuration") {
      const guestsMatch = value.match(/(\d{1,3})\s*(?:pax|pessoa|convidado)?/i);
      const durationMatch = value.match(/(\d+(?:[,.]\d+)?)\s*h/i);
      if (guestsMatch && !parsed.guests) parsed.guests = guestsMatch[1];
      if (durationMatch && !parsed.duration) parsed.duration = `${durationMatch[1].replace(",", ".")}h`;
      return;
    }

    if (!parsed[key]) parsed[key] = value;
  });

  return parsed;
}

function getFormSourceData() {
  const request = getActiveQuoteRequest();
  const proposal = getActiveProposal();
  const proposalSnapshot = proposal?.snapshot || {};
  const snapshot = request?.snapshot || proposalSnapshot.sourceRequestSnapshot || proposalSnapshot || {};
  const client = snapshot.cliente || snapshot.client || {};
  const event = snapshot.evento || snapshot.event || {};
  const parsed = parseStructuredObservationText(
    request?.observacoes,
    event.observacoes,
    event.observations,
    proposalSnapshot.event?.notes,
    proposalSnapshot.event?.sourceNotes,
  );
  const overrides = {
    ...getCurrentSourceOverrides(),
    ...getLiveSourcePanelValues(),
  };
  const isManualDraft = Boolean(state.manualSourceKey && !state.activeProposalId && !state.activeQuoteRequestId);
  const qualification = {
    ...(snapshot.qualificacao || snapshot.qualification || {}),
    ...(proposalSnapshot.qualificacao || proposalSnapshot.qualification || {}),
    ...(proposalSnapshot.sourceOverrides || {}),
    ...overrides,
  };
  const reference = snapshot.referencia || proposalSnapshot.referencia || parsed.reference || "";
  const clientType = normalizeSourceValue(qualification.clientType || qualification.tipoCliente || client.tipoCliente || request?.tipo_cliente || parsed.clientType);
  const finalClient = normalizeSourceValue(
    qualification.finalClient ||
      qualification.clienteFinal ||
      request?.cliente_final ||
      client.clienteFinal ||
      client.finalClient ||
      getFinalClientFromSnapshot(snapshot) ||
      getFinalClientFromSnapshot(proposalSnapshot) ||
      parsed.finalClient,
  );
  const groupName = normalizeSourceValue(
    qualification.groupName ||
      qualification.nomeGrupo ||
      request?.nome_grupo ||
      client.nomeGrupo ||
      client.groupName ||
      getGroupNameFromSnapshot(snapshot) ||
      getGroupNameFromSnapshot(proposalSnapshot) ||
      parsed.groupName,
  );

  return {
    hasSource: Boolean(isManualDraft || request || snapshot.origem === "formulario" || reference || clientType || qualification.faixaInvestimento),
    isManualDraft,
    reference,
    company: normalizeSourceValue(overrides.company || client.empresa || client.company || proposalSnapshot.client?.company || request?.empresa || request?.cliente_empresa || parsed.company),
    clientType,
    finalClient,
    groupName,
    budgetRange: normalizeSourceValue(qualification.budgetRange || qualification.faixaInvestimento || request?.faixa_investimento || parsed.budgetRange),
    origin: normalizeSourceValue(qualification.origin || qualification.origem || request?.origem || parsed.origin),
    moment: normalizeSourceValue(qualification.moment || qualification.momento || event.momento || event.moment || parsed.moment || inferMomentFromTime(fields.eventTime?.value)),
    occasion: normalizeSourceValue(qualification.occasion || qualification.ocasiao || event.ocasiao || event.perfil || event.occasion || parsed.occasion || inferOccasionFromProposal()),
    eventType: normalizeSourceValue(request?.tipo_evento || event.tipo || event.type || fields.eventType?.value || parsed.eventType),
    flexibleDate: normalizeSourceValue(event.dataFlexivel || event.flexibleDate || parsed.flexibleDate),
    flexibleDateStatus: normalizeSourceValue(event.dataFlexivelStatus || event.flexibleDateStatus || parsed.flexibleDateStatus),
    timeRange: normalizeSourceValue(event.faixaHorario || event.timeRange || parsed.timeRange),
    arrivalTime: normalizeSourceValue(event.horario || event.time || parsed.arrivalTime),
    guests: normalizeSourceValue(event.convidados || event.guests || request?.convidados || parsed.guests),
    duration: normalizeSourceValue(event.duracaoTexto || event.durationLabel || (event.duracao ? `${event.duracao}h` : "") || parsed.duration),
    extras: normalizeSourceValue(overrides.extras || event.extras || parsed.extras),
    preferences: normalizeSourceValue(overrides.preferences || request?.preferencias || event.preferencias || event.preferences || parsed.preferences),
    observations: normalizeSourceValue(overrides.observations || cleanClientObservationText(request, snapshot)),
    reason: normalizeSourceValue(overrides.reason || request?.motivo_evento || event.motivo || event.reason || fields.eventReason?.value || parsed.reason),
  };
}

function getFormSourceMissingItems(data = getFormSourceData()) {
  const missing = [];
  const isAgency = ["Agência de turismo receptivo / DMC", "Agência de marketing / eventos"].includes(data.clientType);
  if (!data.clientType) missing.push("tipo de cliente");
  if (isAgency && !data.finalClient && !data.groupName) missing.push("cliente final ou nome do grupo");
  if (!data.moment) missing.push("momento");
  if (!data.occasion) missing.push("ocasião");
  return missing;
}

function getFormSourceRecommendedItems(data = getFormSourceData()) {
  const recommended = [];
  if (!data.budgetRange) recommended.push("faixa de investimento");
  if (!data.origin) recommended.push("origem");
  return recommended;
}

function renderSourceValue(value, fallback = "Não veio no formulário") {
  const text = normalizeSourceValue(value);
  return text ? escapeHtml(text) : `<em>${escapeHtml(fallback)}</em>`;
}

function renderSourceCard(label, value, { important = false, fallback } = {}) {
  const missing = !normalizeSourceValue(value);
  return `
    <article class="form-source-card ${missing && important ? "is-missing" : missing ? "is-empty" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${renderSourceValue(value, fallback)}</strong>
    </article>
  `;
}

function renderSourceSelect(field, label, value, options, placeholder = "Selecionar") {
  const current = normalizeSourceValue(value);
  const fullOptions = current && !options.includes(current) ? [current, ...options] : options;
  return `
    <label class="form-source-edit-field">
      <span>${escapeHtml(label)}</span>
      <select data-source-field="${escapeHtml(field)}">
        <option value="">${escapeHtml(placeholder)}</option>
        ${fullOptions
          .map((option) => `<option value="${escapeHtml(option)}" ${option === current ? "selected" : ""}>${escapeHtml(option)}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderSourceInput(field, label, value, placeholder, { wide = false } = {}) {
  return `
    <label class="form-source-edit-field ${wide ? "is-wide" : ""}">
      <span>${escapeHtml(label)}</span>
      <input data-source-field="${escapeHtml(field)}" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}

function renderSourceTextarea(field, label, value, placeholder) {
  return `
    <label class="form-source-edit-field is-wide">
      <span>${escapeHtml(label)}</span>
      <textarea data-source-field="${escapeHtml(field)}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || "")}</textarea>
    </label>
  `;
}

function renderFormSourcePanel() {
  if (!nodes.formSourcePanel) return;
  persistLiveSourcePanelValues();
  const data = getFormSourceData();
  if (!data.hasSource) {
    nodes.formSourcePanel.className = "form-source-panel is-hidden";
    nodes.formSourcePanel.innerHTML = "";
    delete nodes.formSourcePanel.dataset.sourceKey;
    return;
  }

  const missing = getFormSourceMissingItems(data);
  const recommended = getFormSourceRecommendedItems(data);
  const clientContext = [data.finalClient ? `Cliente final: ${data.finalClient}` : "", data.groupName ? `Grupo: ${data.groupName}` : ""]
    .filter(Boolean)
    .join(" · ");
  const flexibility = [data.flexibleDateStatus, data.flexibleDate ? `Janela: ${data.flexibleDate}` : ""].filter(Boolean).join(" · ");
  const timeContext = [data.timeRange, data.arrivalTime ? `Chegada: ${data.arrivalTime}` : ""].filter(Boolean).join(" · ");
  const briefingBlocks = [
    ["Motivo do evento", data.reason],
    ["Preferências de alimentos e bebidas", data.preferences],
    ["Extras solicitados", data.extras],
    ["Observação livre do cliente", data.observations],
  ].filter(([, value]) => normalizeSourceValue(value));
  const isRealizedManual = state.manualSourceKey === "manual:realized" && !state.activeProposalId && !state.activeQuoteRequestId;
  const sourceTitle = isRealizedManual
    ? "Registro de evento realizado"
    : data.isManualDraft
      ? "Dados comerciais da proposta"
      : "Dados recebidos do formulário";
  const sourceSubtitle = isRealizedManual
    ? "Preencha o essencial para histórico, relatório e recompra"
    : data.isManualDraft
      ? "Complete o perfil para priorizar melhor"
      : "Base para proposta segura";
  const sourceHelp = isRealizedManual
    ? "Use para eventos vendidos por WhatsApp, e-mail ou atendimento externo. Registre cliente, data, itens vendidos, valor, pagamento e aprendizados para relatório e recompra."
    : data.isManualDraft
      ? "Quando a cotação nasce direto no admin, estes campos substituem o formulário do cliente: perfil, origem, cliente final/grupo, momento e ocasião."
      : "Complete uma vez. O checklist usa estes dados para reduzir ajustes e risco.";

  nodes.formSourcePanel.className = `form-source-panel ${missing.length ? "has-missing" : "is-complete"}`;
  nodes.formSourcePanel.dataset.sourceKey = getSourceOverrideKey();
  nodes.formSourcePanel.innerHTML = `
    <div class="form-source-head">
      <div>
        <span>${escapeHtml(sourceTitle)}</span>
        <strong>${escapeHtml(sourceSubtitle)}</strong>
        <p>${escapeHtml(sourceHelp)}</p>
      </div>
      <small>${
        missing.length
          ? `Complete antes do envio: ${escapeHtml(missing.join(", "))}`
          : recommended.length
            ? `Boa prática comercial: ${escapeHtml(recommended.join(", "))}`
            : "Formulário bem preenchido"
      }</small>
    </div>
    <div class="form-source-edit">
      <div>
        <span>Contexto para atendimento</span>
        <strong>${escapeHtml(isRealizedManual ? "Registro rápido do que já aconteceu" : data.isManualDraft ? "Complete o perfil antes de enviar" : "Confira e complete só o que faltar")}</strong>
        <p>${escapeHtml(
          isRealizedManual
            ? "Preencha o básico: cliente, data, pax, itens vendidos, pagamento recebido e observações úteis para uma próxima venda."
            : "Esses dados alimentam revisão, histórico e respostas futuras.",
        )}</p>
      </div>
      <div class="form-source-edit-grid">
        ${renderSourceSelect("clientType", "Tipo de cliente", data.clientType, sourceClientTypeOptions)}
        ${renderSourceInput("company", "Empresa ou agência", data.company, "Ex.: Joana e Maria Eventos, Castelo Viagens")}
        ${renderSourceInput("finalClient", "Cliente final", data.finalClient, "Ex.: TV Globo, Booking Brasil, Família Almeida")}
        ${renderSourceInput("groupName", "Nome do grupo", data.groupName, "Ex.: Incentivo México 2026, Grupo Rio 40 pax")}
        ${renderSourceSelect("budgetRange", "Faixa de investimento", data.budgetRange, sourceBudgetRangeOptions)}
        ${renderSourceSelect("origin", "Como chegou até nós", data.origin, sourceOriginOptions)}
        ${renderSourceSelect("moment", "Momento desejado", data.moment, sourceMomentOptions)}
        ${renderSourceInput("occasion", "Ocasião / objetivo", data.occasion, "Ex.: reunião corporativa, incentivo, lançamento")}
        ${renderSourceInput("reason", "Motivo do evento", data.reason, "Ex.: receber clientes, comemoração, incentivo, lançamento", { wide: true })}
        ${renderSourceInput("preferences", "Preferências de alimentos e bebidas", data.preferences, "Ex.: open bar, restrições, menu degustação", { wide: true })}
        ${renderSourceInput("extras", "Extras de produção", data.extras, "Ex.: DJ, foto, som com microfone, decoração", { wide: true })}
        ${renderSourceTextarea("observations", "Observação livre do cliente", data.observations, "Detalhes importantes, acessibilidade, pedido especial, montagem...")}
      </div>
    </div>
    <details class="form-source-full-summary">
      <summary>
        <span>Ver resumo completo recebido</span>
        <small>Use só se precisar conferir o pedido original.</small>
      </summary>
      <div class="form-source-grid">
        ${renderSourceCard("Referência", data.reference, { fallback: "Sem referência" })}
        ${renderSourceCard("Tipo de cliente", data.clientType, { important: true, fallback: "Classifique para priorizar" })}
        ${renderSourceCard("Empresa ou agência", data.company, { fallback: "Não informado" })}
        ${renderSourceCard("Cliente final / grupo", clientContext, { important: ["Agência de turismo receptivo / DMC", "Agência de marketing / eventos"].includes(data.clientType), fallback: "Peça cliente final ou grupo" })}
        ${renderSourceCard("Faixa de investimento", data.budgetRange, { important: true, fallback: "Não definida" })}
        ${renderSourceCard("Origem do lead", data.origin, { fallback: "Não informada" })}
        ${renderSourceCard("Momento desejado", data.moment, { important: true })}
        ${renderSourceCard("Ocasião", data.occasion, { important: true })}
        ${renderSourceCard("Flexibilidade de data", flexibility, { fallback: "Não informada" })}
        ${renderSourceCard("Período e chegada", timeContext, { fallback: "Use data e horário acima" })}
        ${renderSourceCard("Pax e duração do formulário", [data.guests ? `${data.guests} pax` : "", data.duration].filter(Boolean).join(" · "), { fallback: "Usar campos acima" })}
        ${renderSourceCard("Formato solicitado", data.eventType, { fallback: "Definir na configuração" })}
      </div>
    </details>
    <div class="form-source-briefing ${briefingBlocks.length ? "" : "is-empty"}">
      ${
        briefingBlocks.length
          ? briefingBlocks
              .map(
                ([label, value]) => `
                  <article>
                    <span>${escapeHtml(label)}</span>
                    <p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>
                  </article>
                `,
              )
              .join("")
          : `<article><span>Briefing adicional</span><p>O cliente não deixou observações livres. Se descobrir algo importante no atendimento, registre no campo Observações.</p></article>`
      }
    </div>
  `;
}

function refreshReviewSurfaces({ includeSourcePanel = false } = {}) {
  renderServiceCockpit();
  renderLeadReviewPanel();
  renderProposalNextStep();
  renderQuickReplies();
  renderSummary();
  renderSendReview();
  renderCalculation();
  renderProposal();
  renderLoadedEditorBar();
  if (includeSourcePanel) renderFormSourcePanel();
}

function handleFormSourceFieldInput(event, { includeSourcePanel = false } = {}) {
  const field = event.target.closest("[data-source-field]");
  if (!field) return;
  setCurrentSourceOverride(field.dataset.sourceField, field.value);
  refreshReviewSurfaces({ includeSourcePanel });
}

function captureFormSourceFieldValue(event) {
  const field = event.target.closest?.("[data-source-field]");
  if (!field || !nodes.formSourcePanel?.contains(field)) return;
  setCurrentSourceOverride(field.dataset.sourceField, field.value);
}

function handleFormSourceFieldChange(event) {
  const field = event.target.closest("[data-source-field]");
  handleFormSourceFieldInput(event, { includeSourcePanel: field?.tagName === "SELECT" });
}

function getLeadReadinessItems() {
  const review = getProposalReviewItems();
  const context = getActiveCommercialContext();
  const sourceData = getFormSourceData();
  const selected = getSelectedItems();
  const hasBriefing = Boolean(
    fields.eventReason.value.trim() ||
      fields.notes.value.trim() ||
      sourceData.reason ||
      sourceData.preferences ||
      sourceData.observations ||
      context.occasion ||
      sourceData.occasion ||
      context.extras ||
      sourceData.extras,
  );
  const contact = review.find((item) => item.id === "contact");
  const clientContext = review.find((item) => item.id === "client_context");
  const commercialProfile = review.find((item) => item.id === "commercial_profile");
  const format = review.find((item) => item.id === "format");
  const date = review.find((item) => item.id === "date");
  const agenda = review.find((item) => item.id === "availability");
  const guests = review.find((item) => item.id === "guests");
  const items = review.find((item) => item.id === "items");
  const value = review.find((item) => item.id === "value");
  const conditions = review.find((item) => item.id === "conditions");
  const dateStatus =
    date?.status === "error" || guests?.status === "error"
      ? "error"
      : agenda?.status === "error"
        ? "error"
        : agenda?.status === "warning" || guests?.status === "warning"
          ? "warning"
          : "ok";
  const dateDetail = [date?.detail, guests?.detail, agenda?.status !== "ok" ? agenda?.detail : ""].filter(Boolean).join(" · ");

  return [
    {
      id: "contact",
      label: "Contato para retorno",
      status: contact?.status || "error",
      detail: contact?.detail || "Confira nome do cliente e pelo menos um canal válido: e-mail ou celular/WhatsApp.",
      target: "client",
    },
    {
      id: "profile",
      label: "Perfil comercial",
      status: commercialProfile?.status || "warning",
      optional: true,
      detail: commercialProfile?.detail || "Sugestão: tipo, investimento e origem ajudam a priorizar.",
      target: "source",
    },
    {
      id: "client_context",
      label: "Cliente final/grupo",
      status: clientContext?.status || "ok",
      detail: clientContext?.detail || "Cliente final e grupo revisados.",
      target: "source",
    },
    {
      id: "format",
      label: "Formato do evento",
      status: format?.status || "error",
      detail: format?.detail || "Defina o formato antes de montar a proposta.",
      target: "items",
    },
    {
      id: "agenda",
      label: "Data e horário",
      status: dateStatus,
      detail: dateDetail || "Cheque data, horário, pax e conflito de agenda.",
      target: "client",
    },
    {
      id: "menu",
      label: "Formato e itens",
      status: items?.status || "error",
      detail: selected.length
        ? `${selected.length} ${selected.length === 1 ? "item selecionado" : "itens selecionados"}. Confira se combinam com o pedido.`
        : "Escolha o pacote principal.",
      target: "items",
    },
    {
      id: "brief",
      label: "Briefing",
      status: hasBriefing ? "ok" : "warning",
      detail: hasBriefing ? "Contexto suficiente para abordagem comercial." : "Inclua motivo, restrições ou observação útil.",
      target: "notes",
    },
    {
      id: "value",
      label: "Investimento",
      status: value?.status || "error",
      detail: value?.status === "ok" ? value.detail : "Monte o valor antes de enviar.",
      target: "items",
    },
    {
      id: "conditions",
      label: "Condições",
      status: conditions?.status || "error",
      detail: conditions?.detail || "Confirme validade e prazo do sinal.",
      target: "review",
    },
  ];
}

function getProposalApprovalMessage(items = getLeadReadinessItems()) {
  const errors = items.filter((item) => item.status === "error");
  const warnings = items.filter((item) => item.status === "warning");
  if (errors.length) {
    return {
      tone: "blocker",
      eyebrow: "Checklist de aprovação",
      title: "Ainda não envie para o cliente",
      note: "Corrija os obrigatórios para evitar proposta incompleta ou valor errado.",
      label: `${errors.length} ${errors.length === 1 ? "pendência" : "pendências"}`,
    };
  }
  if (warnings.length) {
    const optionalWarnings = warnings.filter(isOptionalReviewItem).length;
    const attentionWarnings = warnings.length - optionalWarnings;
    return {
      tone: "warning",
      eyebrow: "Checklist de aprovação",
      title: attentionWarnings ? "Pode enviar, mas vale revisar" : "Pode enviar. Sugestão comercial",
      note: attentionWarnings
        ? "Proposta montada. Alertas aumentam chance de resposta."
        : "Essenciais prontos. Completar o perfil ajuda, mas não trava envio.",
      label: attentionWarnings ? `${attentionWarnings} atenção` : `${optionalWarnings} sugestão`,
    };
  }
  return {
    tone: "ready",
    eyebrow: "Checklist de aprovação",
    title: "Pronto para enviar com segurança",
    note: "Cliente, agenda, itens e investimento estão coerentes. Salve como enviada e faça o acompanhamento pelo funil.",
    label: "Aprovado",
  };
}

function getReviewStatusLabel(status, item = null) {
  if (status === "ok") return "OK";
  if (status === "warning") return isOptionalReviewItem(item) ? "Sugestão" : "Atenção";
  return "Obrigatório";
}

function getReviewActionLabel(item) {
  if (!item) return "Conferir proposta";
  if (item.status === "warning" && isOptionalReviewItem(item)) return "Completar se souber";
  if (item.status === "warning") return "Conferir";
  return "Corrigir agora";
}

function getReviewGuideActionLabel(item) {
  if (!item) return "Conferir proposta";
  const actionByTarget = {
    client: item.id === "contact" ? "Conferir contato" : "Conferir data, hora e pax",
    source:
      item.id === "client_context"
        ? "Informar cliente final/grupo"
        : item.id === "profile"
          ? "Completar classificação"
          : "Abrir dados do formulário",
    items: "Escolher formato e itens",
    notes: "Completar briefing",
    review: "Conferir condições",
  };
  if (item.status === "warning") return actionByTarget[item.target] || "Conferir agora";
  return actionByTarget[item.target] || "Ir para correção";
}

function getReviewGuide(items = getLeadReadinessItems(), approved = false) {
  const errors = items.filter((item) => item.status === "error");
  const warnings = items.filter((item) => item.status === "warning" && !isOptionalReviewItem(item));
  const optionalWarnings = items.filter((item) => item.status === "warning" && isOptionalReviewItem(item));
  const firstIssue = errors[0] || warnings[0] || null;
  if (errors.length) {
    return {
      tone: "blocker",
      eyebrow: "Comece aqui",
      title: `Corrigir: ${firstIssue.label}`,
      detail: `${firstIssue.detail} O sistema só libera envio quando este ponto estiver claro.`,
      actionLabel: getReviewGuideActionLabel(firstIssue),
      target: firstIssue.target || "client",
      statusLabel: `${errors.length} ${errors.length === 1 ? "pendência" : "pendências"}`,
    };
  }
  if (approved) {
    return {
      tone: "approved",
      eyebrow: "Pronto para cliente",
      title: "Enviar proposta pelo canal escolhido",
      detail: warnings.length
        ? "Checklist aprovado. Sugestões comerciais seguem visíveis, sem travar envio."
        : "Checklist aprovado. Envie e acompanhe pelo funil.",
      actionLabel: "Enviar proposta",
      target: "client",
      statusLabel: "Aprovado",
    };
  }
  if (warnings.length) {
    return {
      tone: "warning",
      eyebrow: "Atenção antes de enviar",
      title: `Conferir: ${firstIssue.label}`,
      detail: `${firstIssue.detail} Esta conferência melhora a resposta do cliente sem bloquear o envio.`,
      actionLabel: getReviewGuideActionLabel(firstIssue),
      target: firstIssue.target || "review",
      statusLabel: `${warnings.length} atenção`,
    };
  }
  if (!approved) {
    return {
      tone: "ready",
      eyebrow: "Último passo",
      title: "Aprovar revisão e salvar envio",
      detail: optionalWarnings.length
        ? "Essenciais conferidos. Há sugestões comerciais opcionais, mas elas não travam o envio."
        : "Cliente, agenda, cardápio, valor e condições conferidos. Aprove antes de enviar.",
      actionLabel: "Revisado, pode enviar",
      target: "review",
      statusLabel: optionalWarnings.length ? "Pronto com sugestão" : "Pronto",
    };
  }
  return {
    tone: "approved",
    eyebrow: "Pronto para cliente",
    title: "Enviar proposta pelo canal escolhido",
    detail: "Checklist aprovado. Envie e acompanhe pelo funil.",
    actionLabel: "Enviar proposta",
    target: "client",
    statusLabel: "Aprovado",
  };
}

function getReviewWorkflowSteps(items = getLeadReadinessItems()) {
  const groups = [
    { label: "Contato", ids: ["contact"], target: "client" },
    { label: "Cliente final", ids: ["client_context", "profile", "commercial_profile"], target: "source" },
    { label: "Data, hora e pax", ids: ["date", "agenda", "availability", "guests"], target: "client" },
    { label: "Cardápio e valor", ids: ["format", "menu", "items", "value"], target: "items" },
    { label: "Condições e envio", ids: ["brief", "briefing", "conditions"], target: "review" },
  ];
  return groups.map((group, index) => {
    const groupItems = items.filter((item) => group.ids.includes(item.id));
    const blockingGroupItems = groupItems.filter((item) => !isOptionalReviewItem(item));
    const optionalGroupWarnings = groupItems.filter((item) => item.status === "warning" && isOptionalReviewItem(item));
    const status = groupItems.some((item) => item.status === "error")
      ? "error"
      : blockingGroupItems.some((item) => item.status === "warning")
        ? "warning"
        : "ok";
    const firstIssue = blockingGroupItems.find((item) => item.status !== "ok") || optionalGroupWarnings[0];
    return {
      ...group,
      number: index + 1,
      status,
      statusLabel: status === "ok" && optionalGroupWarnings.length ? "Sugestão" : getReviewStatusLabel(status, firstIssue),
      detail: firstIssue?.detail || "Conferido",
      target: firstIssue?.target || group.target,
    };
  });
}

function getSendReviewWorkflowSteps(items = getProposalSendReviewItems()) {
  const groups = [
    { label: "Contato", ids: ["contact", "client_context"], target: "client" },
    { label: "Data, hora e pax", ids: ["date", "availability", "guests"], target: "client" },
    { label: "Cardápio e valor", ids: ["format", "items", "value"], target: "items" },
    { label: "Condições e envio", ids: ["briefing", "conditions"], target: "review" },
  ];
  return groups.map((group, index) => {
    const groupItems = items.filter((item) => group.ids.includes(item.id));
    const status = groupItems.some((item) => item.status === "error")
      ? "error"
      : groupItems.some((item) => item.status === "warning")
        ? "warning"
        : "ok";
    const firstIssue = groupItems.find((item) => item.status !== "ok");
    return {
      ...group,
      number: index + 1,
      status,
      statusLabel: getReviewStatusLabel(status, firstIssue),
      detail: firstIssue?.detail || "Conferido",
      target: firstIssue?.target || group.target,
    };
  });
}

function renderReviewWorkflow(items = getLeadReadinessItems()) {
  return `
    <div class="review-workflow" aria-label="Roteiro de revisão da proposta">
      ${getReviewWorkflowSteps(items)
        .map(
          (step) => `
            <button class="review-workflow-step is-${escapeHtml(step.status)}" type="button" data-review-target="${escapeHtml(step.target)}">
              <span>${escapeHtml(String(step.number))}</span>
              <strong>${escapeHtml(step.label)}</strong>
              <small>${escapeHtml(step.statusLabel)}</small>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSendReviewWorkflow(items = getProposalSendReviewItems()) {
  return `
    <div class="review-workflow" aria-label="Roteiro essencial de envio da proposta">
      ${getSendReviewWorkflowSteps(items)
        .map(
          (step) => `
            <button class="review-workflow-step is-${escapeHtml(step.status)}" type="button" data-review-target="${escapeHtml(step.target)}">
              <span>${escapeHtml(String(step.number))}</span>
              <strong>${escapeHtml(step.label)}</strong>
              <small>${escapeHtml(step.statusLabel)}</small>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function pushUpsellRecommendation(recommendations, itemId, title, detail, reason) {
  if (!itemExists(itemId) || state.selectedIds.has(itemId) || recommendations.some((item) => item.itemId === itemId)) return;
  recommendations.push({ itemId, title, detail, reason });
}

function getUpsellRecommendations() {
  const recommendations = [];
  const category = getEventCategoryFromRequest(fields.eventType.value);
  const has = (id) => state.selectedIds.has(id);
  const selected = getSelectedItems();
  const selectedCategories = new Set(selected.map((item) => item.tipoEvento));

  if (category === "Coquetel") {
    if (has("coquetel-caipirinha")) {
      pushUpsellRecommendation(
        recommendations,
        "coquetel-carioca",
        "Elevar para Coquetel Carioca",
        "Inclui caipirinhas variadas, chope, sucos, refrigerantes e água.",
        "Upgrade natural para grupos corporativos e confraternizações.",
      );
    }
    if (!selectedCategories.has("Comidas")) {
      pushUpsellRecommendation(
        recommendations,
        "brasileiro-ii",
        "Adicionar Brasileiro II",
        "Caldinho, pastéis, aipim, bolinho, barquete e prato quente.",
        "Deixa o coquetel mais completo e aumenta ticket sem complicar operação.",
      );
    }
    if (!selectedCategories.has("Welcome Drink")) {
      pushUpsellRecommendation(
        recommendations,
        "welcome-caipirinha",
        "Adicionar Welcome Drink",
        "Recepção com caipirinha para organizar a chegada do grupo.",
        "Complemento simples que aumenta percepção de cuidado logo no início do evento.",
      );
    }
    if (!selectedCategories.has("Workshop de Caipirinha")) {
      pushUpsellRecommendation(
        recommendations,
        "workshop-caipirinha-pt",
        "Incluir experiência de caipirinha",
        "Formato interativo para criar memória e engajamento do grupo.",
        "Ótimo para agências, DMCs e eventos de relacionamento.",
      );
    }
  }

  if (category === "Café da Manhã / Coffee Break" && has("cafe-classico")) {
    pushUpsellRecommendation(
      recommendations,
      "cafe-completo",
      "Trocar para Café Completo",
      "Inclui ovos mexidos, iogurte, granola e bolo adicional.",
      "Mais adequado para reuniões longas e grupos premium.",
    );
  }

  if (category === "Welcome Drink") {
    if (has("welcome-caipirinha")) {
      pushUpsellRecommendation(
        recommendations,
        "welcome-espumante",
        "Oferecer espumante nacional",
        "Recepção mais elegante para chegada do grupo.",
        "Bom upgrade para lançamentos, clientes especiais e turismo premium.",
      );
    }
    if (!selectedCategories.has("Snacks")) {
      pushUpsellRecommendation(
        recommendations,
        "snacks-carioca",
        "Adicionar snack carioca",
        "Biscoito Globo e caldinho de feijão.",
        "Complemento simples para uma recepção mais gostosa.",
      );
    }
  }

  if (category === "Almoço Carioca" && has("almoco-carioca-duas-bebidas")) {
    pushUpsellRecommendation(
      recommendations,
      "almoco-carioca-bebida-livre",
      "Trocar para bebida livre",
      "Experiência mais fluida para grupos que querem conforto e previsibilidade.",
      "Reduz atrito no evento e melhora percepção de valor.",
    );
  }

  return recommendations.slice(0, 4);
}

function applyUpsellSuggestion(itemId) {
  if (!itemExists(itemId)) return;
  if (coquetelBeverageIds.includes(itemId)) {
    setExclusiveSelection(coquetelBeverageIds, itemId);
    state.guided.beverageId = itemId;
  } else if (coquetelFoodIds.includes(itemId)) {
    setExclusiveSelection(coquetelFoodIds, itemId);
    state.guided.foodId = itemId;
  } else if (workshopIds.includes(itemId)) {
    setExclusiveSelection(workshopIds, itemId);
    state.guided.workshopId = itemId;
  } else if (["cafe-classico", "cafe-completo", "coffee-praia-vermelha", "coffee-morro-urca"].includes(itemId)) {
    setExclusiveSelection(["cafe-classico", "cafe-completo", "coffee-praia-vermelha", "coffee-morro-urca"], itemId);
  } else if (welcomeDrinkIds.includes(itemId)) {
    setExclusiveSelection(welcomeDrinkIds, itemId);
    state.guided.welcomeId = itemId;
  } else if (["almoco-carioca-bebida-livre", "almoco-carioca-duas-bebidas"].includes(itemId)) {
    setExclusiveSelection(["almoco-carioca-bebida-livre", "almoco-carioca-duas-bebidas"], itemId);
  } else {
    state.selectedIds.add(itemId);
  }
  saveSelectedIds();
  setChoiceState(nodes.flowBeverageOptions, state.guided.beverageId, "selectPackage");
  setChoiceState(nodes.flowFoodOptions, state.guided.foodId, "selectPackage");
  setChoiceState(nodes.flowWelcomeOptions, state.guided.welcomeId, "selectPackage");
  setChoiceState(nodes.flowWorkshopOptions, state.guided.workshopId, "selectPackage");
  renderAll();
  showToast("Sugestão adicionada à proposta.");
}

function renderLeadReviewPanel() {
  if (!nodes.leadReviewPanel) return;
  if (isQuoteWorkspaceEffectivelyEmpty()) {
    nodes.leadReviewPanel.className = "lead-review-panel is-hidden";
    nodes.leadReviewPanel.innerHTML = "";
    return;
  }

  const items = getLeadReadinessItems();
  const errors = items.filter((item) => item.status === "error").length;
  const warnings = items.filter((item) => item.status === "warning").length;
  const upsells = getUpsellRecommendations();
  const criticalItems = items.filter((item) => item.status !== "ok").slice(0, 3);
  const approval = getProposalApprovalMessage(items);
  const smartAlerts = getSmartProposalAlerts(items);
  const confidence = getProposalConfidence(items, smartAlerts);
  const automation = getProposalAutomationReadiness(items, smartAlerts, confidence);
  const guide = getReviewGuide(items, false);
  const visibleSmartAlerts = smartAlerts.filter((alert) => alert.level !== "success").slice(0, errors ? 1 : 2);
  const focusNote = errors
    ? "Corrija o primeiro bloqueio. Depois salve a proposta."
    : warnings
      ? "Pode avançar. Estes pontos ajudam a fechar."
      : "Tudo essencial está no lugar. Faça a aprovação humana antes do envio ao cliente.";
  nodes.leadReviewPanel.className = `lead-review-panel ${errors ? "has-blocker" : warnings ? "has-warning" : "is-ready"}`;
  nodes.leadReviewPanel.innerHTML = `
    <div class="lead-review-heading">
      <div>
        <span>${escapeHtml(approval.eyebrow)}</span>
        <strong>${escapeHtml(approval.title)}</strong>
      </div>
      <small>${escapeHtml(approval.label)}</small>
    </div>
    <div class="review-command-center is-${escapeHtml(guide.tone)}">
      <div class="review-command-copy">
        <span>${escapeHtml(guide.eyebrow)}</span>
        <strong>${escapeHtml(guide.title)}</strong>
        <p>${escapeHtml(guide.detail)}</p>
      </div>
      <div class="review-command-side">
        <b>${escapeHtml(guide.statusLabel)}</b>
        <button class="primary" type="button" data-review-target="${escapeHtml(guide.target)}">${escapeHtml(guide.actionLabel)}</button>
      </div>
    </div>
    ${renderReviewWorkflow(items)}
    <div class="review-focus-note is-${escapeHtml(confidence.status)}">
      <div>
        <span>Estado da revisão</span>
        <strong>${escapeHtml(String(confidence.score))}% · ${escapeHtml(confidence.label)}</strong>
      </div>
      <p>${escapeHtml(focusNote)} ${escapeHtml(automation.label)}: ${escapeHtml(automation.note)}</p>
    </div>
    ${
      visibleSmartAlerts.length
        ? `<div class="review-compact-alerts" aria-label="Riscos principais da proposta">
            ${visibleSmartAlerts
              .map(
                (alert) => `
                  <button class="smart-alert is-${escapeHtml(alert.level)}" type="button" data-review-target="${escapeHtml(alert.target)}">
                    <span>${escapeHtml(alert.kind)}</span>
                    <strong>${escapeHtml(alert.title)}</strong>
                    <small>${escapeHtml(alert.detail)}</small>
                  </button>
                `,
              )
              .join("")}
          </div>`
        : ""
    }
    ${
      criticalItems.length
        ? `<div class="lead-review-priority">
            <span>Itens pendentes</span>
            <strong>${escapeHtml(criticalItems.map((item) => item.label).join(" · "))}</strong>
            <small>Clique nos cartões abaixo. Cada cartão leva direto ao campo certo.</small>
          </div>`
        : `<div class="lead-review-priority is-clear">
            <span>Envio liberado</span>
            <strong>Proposta revisada, valor montado e canais preenchidos.</strong>
          </div>`
    }
    <div class="lead-review-grid">
      ${items
        .map(
          (item) => `
            <button class="lead-review-item is-${escapeHtml(item.status)}" type="button" data-review-target="${escapeHtml(item.target)}">
              <span>${item.status === "ok" ? "OK" : item.status === "warning" ? "!" : "!"}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.detail)}</small>
              <em>${escapeHtml(item.status === "ok" ? "Conferido" : getReviewActionLabel(item))}</em>
            </button>
          `,
        )
        .join("")}
    </div>
    <details class="smart-alerts is-detail">
      <summary class="smart-alerts-heading">
        <span>Leitura completa</span>
        <small>Use quando quiser revisar riscos e oportunidades com mais calma.</small>
      </summary>
      <div class="smart-alerts-grid">
        ${smartAlerts
          .map(
            (alert) => `
              <button class="smart-alert is-${escapeHtml(alert.level)}" type="button" data-review-target="${escapeHtml(alert.target)}">
                <span>${escapeHtml(alert.kind)}</span>
                <strong>${escapeHtml(alert.title)}</strong>
                <small>${escapeHtml(alert.detail)}</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </details>
    ${
      upsells.length
        ? `<div class="upsell-strip">
            <div class="upsell-strip-heading">
              <span>Oportunidades de upsell</span>
              <small>Ofereça só se fizer sentido para o objetivo do cliente.</small>
            </div>
            <div class="upsell-grid">
              ${upsells
                .map(
                  (item) => `
                    <button class="upsell-card" type="button" data-upsell-add="${escapeHtml(item.itemId)}">
                      <span>${escapeHtml(item.title)}</span>
                      <strong>${escapeHtml(item.detail)}</strong>
                      <small>${escapeHtml(item.reason)}</small>
                      <em>${escapeHtml(getUpsellOfferLine(item))}</em>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </div>`
        : ""
    }
  `;
}

function getReadinessBlockingItems() {
  return getLeadReadinessItems().filter((item) => item.status === "error");
}

function getSubtotal() {
  return getSelectedItems().reduce((sum, item) => sum + item.calc.total, 0);
}

function getServiceFee() {
  return getSubtotal() * SERVICE_RATE;
}

function getManualAdjustment() {
  return toNumber(fields.manualAdjustment?.value) || 0;
}

function getManualAdjustmentInputValue(...values) {
  const explicitValue = values.find((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (explicitValue === null || explicitValue === undefined) return "0";
  return String(explicitValue);
}

function hasMeaningfulManualAdjustment() {
  return getManualAdjustment() !== 0 || Boolean(fields.manualAdjustmentLabel?.value.trim());
}

function getManualAdjustmentLabel() {
  return fields.manualAdjustmentLabel?.value.trim() || (getManualAdjustment() < 0 ? "Desconto comercial" : "Ajuste comercial");
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

function getDraftAvailabilityWindow() {
  if (!fields.eventDate?.value || !fields.eventTime?.value) return null;
  const start = timeToMinutes(fields.eventTime.value);
  if (start === null) return null;
  return {
    date: fields.eventDate.value,
    start,
    end: start + getDuration() * 60,
  };
}

function isAvailabilityRelevantStatus(status) {
  return !["cancelado", "pos_venda"].includes(normalizeProposalStatus(status));
}

function isSameDraftItem(item) {
  if (item.kind === "proposal" && state.activeProposalId && item.id === state.activeProposalId) return true;
  if (item.kind === "request" && state.activeQuoteRequestId && item.id === state.activeQuoteRequestId) return true;
  return false;
}

function getAvailabilityConflicts() {
  const draft = getDraftAvailabilityWindow();
  if (!draft) return [];
  return getPipelineItems()
    .filter((item) => {
      if (isSameDraftItem(item) || !isAvailabilityRelevantStatus(item.status)) return false;
      if (!item.date || item.date !== draft.date || !item.time) return false;
      const start = timeToMinutes(String(item.time).slice(0, 5));
      if (start === null) return false;
      const end = start + (Number(item.duration) || 2) * 60;
      return rangesOverlap(draft.start, draft.end, start, end);
    })
    .map((item) => ({
      ...item,
      severity: operationStatuses.has(normalizeProposalStatus(item.status)) ? "danger" : "warning",
    }))
    .sort((a, b) => (a.severity === "danger" ? -1 : 1) - (b.severity === "danger" ? -1 : 1));
}

function getAvailabilityReviewStatus() {
  const draft = getDraftAvailabilityWindow();
  if (!draft) {
    return {
      status: "error",
      detail: "Informe data e horário para checar a agenda interna.",
    };
  }
  const conflicts = getAvailabilityConflicts();
  if (!conflicts.length) {
    return {
      status: "ok",
      detail: "Sem conflito cadastrado no funil.",
    };
  }
  const hasSoldConflict = conflicts.some((item) => item.severity === "danger");
  return {
    status: hasSoldConflict ? "error" : "warning",
    detail: hasSoldConflict
      ? "Há evento vendido sobreposto. Ajuste ou confirme internamente antes de enviar."
      : `${conflicts.length} lead/proposta no mesmo horário. Confirme disponibilidade antes de avançar.`,
  };
}

function renderAvailabilityAlert() {
  if (!nodes.availabilityAlert) return;
  const draft = getDraftAvailabilityWindow();
  if (!draft) {
    nodes.availabilityAlert.className = "availability-alert is-hidden";
    nodes.availabilityAlert.innerHTML = "";
    return;
  }

  const conflicts = getAvailabilityConflicts();
  if (!conflicts.length) {
    nodes.availabilityAlert.className = "availability-alert availability-ok";
    nodes.availabilityAlert.innerHTML = `
      <strong>Agenda sem conflito aparente</strong>
      <span>Não há lead, proposta ou evento no mesmo horário cadastrado no funil.</span>
    `;
    return;
  }

  const hasSoldConflict = conflicts.some((item) => item.severity === "danger");
  nodes.availabilityAlert.className = `availability-alert ${hasSoldConflict ? "availability-danger" : "availability-warning"}`;
  nodes.availabilityAlert.innerHTML = `
    <strong>${hasSoldConflict ? "Conflito com evento vendido" : "Atenção: possível disputa de agenda"}</strong>
    <span>${conflicts.length} ${conflicts.length === 1 ? "registro" : "registros"} no mesmo dia e horário. Confirme disponibilidade antes de avançar.</span>
    <div>
      ${conflicts
        .slice(0, 3)
        .map(
          (item) => `
            <small>
              ${escapeHtml(getProposalStatusLabel(item.status))} · ${escapeHtml(item.name || "Cliente")} · ${escapeHtml(String(item.time).slice(0, 5))} · ${escapeHtml(String(item.guests || 0))} pax
            </small>
          `,
        )
        .join("")}
    </div>
  `;
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
  const adjustment = getManualAdjustment();
  return {
    subtotal,
    serviceFee,
    privatization,
    adjustment,
    adjustmentLabel: getManualAdjustmentLabel(),
    total: Math.max(0, subtotal + serviceFee + privatization.amount + adjustment),
  };
}

function getTotal() {
  return getQuoteTotals().total;
}

function getFormulaLabel(formula) {
  const labels = {
    durationPerPerson: "Por pessoa + duração",
    serviceIncluded90PerPerson: "1h30 por pessoa, taxa inclusa",
    perPersonFixed: "Por pessoa fixo",
    fixedPlusPerPerson: "Fixo + por pessoa",
    fixedCoversMinimum: "Fixo inclui mínimo",
    fixedTotal: "Valor fixo total",
  };
  return labels[formula] || "Por pessoa";
}

function getFormulaHelp(formula) {
  const help = {
    durationPerPerson: "Para coquetel, café ou pacote por convidado com 1h, 2h e extra. Preencha: 1h, 2h, 1/2h extra e mínimo.",
    serviceIncluded90PerPerson: "Para Almoço Carioca ou produto com taxa já incluída no valor por pessoa. Preencha: preço 1h30 no campo 1h, extra e mínimo.",
    perPersonFixed: "Para item por convidado que não muda com a duração. Preencha: preço 1h e mínimo.",
    fixedPlusPerPerson: "Para workshop ou experiência com valor base + adicional por pessoa acima do mínimo. Preencha: preço fixo, adicional e mínimo.",
    fixedCoversMinimum: "Para valor fechado que cobre até o mínimo e cobra adicional acima disso. Preencha: preço fixo, adicional e mínimo.",
    fixedTotal: "Para DJ, decoração, audiovisual, taxa ou extra cobrado uma única vez. Preencha: preço fixo.",
  };
  return help[formula] || help.durationPerPerson;
}

function updateFormulaHelp() {
  if (!fields.formulaHelp || !fields.newFormula) return;
  const activeFormula = fields.newFormula.value;
  fields.formulaHelp.textContent = getFormulaHelp(activeFormula);
  document.querySelectorAll("[data-formula-option]").forEach((button) => {
    const isActive = button.dataset.formulaOption === activeFormula;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
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

const coquetelBeverageIds = ["coquetel-caipirinha", "coquetel-carioca"];
const coquetelFoodIds = ["brasileiro-i", "brasileiro-ii"];
const welcomeDrinkIds = ["welcome-caipirinha", "welcome-espumante", "welcome-champagne"];
const workshopIds = ["workshop-caipirinha-pt", "workshop-caipirinha-en"];
const coquetelComplementIds = [...coquetelBeverageIds, ...coquetelFoodIds, ...welcomeDrinkIds, ...workshopIds];

const smartEventTemplates = {
  coquetel: {
    label: "Coquetel completo",
    ids: ["coquetel-carioca", "brasileiro-ii"],
    status:
      "Template sugerido: Coquetel Carioca + Brasileiro II. Se fizer sentido para a chegada ou experiência, adicione Welcome Drink e Workshop de Caipirinha.",
  },
  workshop: {
    label: "Workshop PT",
    ids: ["workshop-caipirinha-pt"],
    status: "Template sugerido: Workshop de Caipirinha em português. Troque para EN se o grupo for internacional.",
  },
  cafe: {
    label: "Café da Manhã Clássico",
    ids: ["cafe-classico"],
    status: "Template sugerido: Café da Manhã Clássico. Para grupos premium ou reuniões mais longas, avalie o Completo.",
  },
  almoco: {
    label: "Almoço Carioca com bebida livre",
    ids: ["almoco-carioca-bebida-livre"],
    status: "Template sugerido: Almoço Carioca com bebida livre. Para proposta mais enxuta, troque para 2 bebidas por pessoa.",
  },
  welcome: {
    label: "Welcome Drink Caipirinha",
    ids: ["welcome-caipirinha"],
    status: "Template sugerido: Welcome Drink Caipirinha. Espumante e champagne ficam disponíveis como upgrade.",
  },
};

function itemExists(itemId) {
  return state.prices.some((item) => item.id === itemId && item.active !== false);
}

function applySmartTemplateForEvent(eventKey) {
  const template = smartEventTemplates[eventKey];
  if (!template) return "";

  state.selectedIds.clear();

  const appliedIds = template.ids.filter(itemExists);
  appliedIds.forEach((id) => state.selectedIds.add(id));

  state.guided.beverageId = appliedIds.find((id) => coquetelBeverageIds.includes(id)) || "";
  state.guided.foodId = appliedIds.find((id) => coquetelFoodIds.includes(id)) || "";
  state.guided.welcomeId = appliedIds.find((id) => welcomeDrinkIds.includes(id)) || "";
  state.guided.workshopId = appliedIds.find((id) => workshopIds.includes(id)) || "";

  setChoiceState(nodes.flowBeverageOptions, state.guided.beverageId, "selectPackage");
  setChoiceState(nodes.flowFoodOptions, state.guided.foodId || (eventKey === "coquetel" ? "" : ""), "selectPackage");
  setChoiceState(nodes.flowWelcomeOptions, state.guided.welcomeId, "selectPackage");
  setChoiceState(nodes.flowWorkshopOptions, state.guided.workshopId, "selectPackage");

  return appliedIds.length ? template.status : "";
}

function scrollToItems() {
  nodes.priceList?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToClientData() {
  scrollToNodeReliably(document.querySelector("#clientDataSection"), { behavior: "smooth", offset: 14 });
}

function getScrollableAncestors(node) {
  const ancestors = [];
  let parent = node?.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = `${style.overflowY} ${style.overflow}`;
    if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight + 8) {
      ancestors.push(parent);
    }
    parent = parent.parentElement;
  }
  return ancestors;
}

function scrollToNodeReliably(target, { offset = 12, behavior = "smooth" } = {}) {
  if (!target) return;
  const scroll = (scrollBehavior = behavior) => {
    try {
      target.scrollIntoView({ behavior: scrollBehavior, block: "start", inline: "nearest" });
    } catch (_) {}
    const rect = target.getBoundingClientRect();
    const top = Math.max(0, rect.top + window.scrollY - offset);
    const root = document.scrollingElement || document.documentElement;
    try {
      window.scrollTo({ top, behavior: scrollBehavior });
    } catch (_) {
      window.scrollTo(0, top);
    }
    if (scrollBehavior === "auto") {
      if (root) root.scrollTop = top;
      document.documentElement.scrollTop = top;
      document.body.scrollTop = top;
    }
    getScrollableAncestors(target).forEach((ancestor) => {
      const ancestorRect = ancestor.getBoundingClientRect();
      const delta = target.getBoundingClientRect().top - ancestorRect.top - offset;
      ancestor.scrollTop += delta;
    });
  };

  scroll();
  window.requestAnimationFrame(() => scroll());
  window.setTimeout(() => scroll("auto"), 140);
  window.setTimeout(() => scroll("auto"), 340);
  window.setTimeout(() => scroll("auto"), 760);
}

function getLoadedEditorTarget(targetMode = "client") {
  if (targetMode === "review") {
    return nodes.sendReviewPanel || document.querySelector("#sendReviewPanel");
  }
  return (
    (nodes.loadedEditorBar && !nodes.loadedEditorBar.classList.contains("is-hidden") ? nodes.loadedEditorBar : null) ||
    document.querySelector("#clientDataSection") ||
    document.querySelector(".quote-layout")
  );
}

function jumpToLoadedEditor(targetMode = "client", behavior = "auto") {
  const target = getLoadedEditorTarget(targetMode);
  if (!target) return false;
  if (target.id) {
    const nextHash = `#${target.id}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    try {
      window.history.replaceState(null, "", nextUrl);
    } catch (_) {
      try {
        window.location.hash = nextHash;
      } catch (_) {}
    }
  }
  scrollToNodeReliably(target, { behavior, offset: 14 });
  return true;
}

function scheduleLoadedEditorJump(targetMode = "client", behavior = "auto") {
  const jumps = [0, 90, 240, 520, 980, 1500];
  jumps.forEach((delay) => {
    window.setTimeout(() => {
      jumpToLoadedEditor(targetMode, delay >= 520 ? "auto" : behavior);
    }, delay);
  });
}

function focusLoadedProposalEditor(message = "Proposta carregada. Revise os dados, itens e checklist antes de enviar.", targetMode = "auto") {
  const section = document.querySelector("#clientDataSection");
  const layout = document.querySelector(".quote-layout");
  const proposalPaper = document.querySelector("#proposalPaper");
  const reviewPanel = nodes.sendReviewPanel;

  renderSummary();
  renderSendReview();
  renderCalculation();
  renderProposal();
  renderLoadedEditorBar();

  const editorAnchor =
    nodes.loadedEditorBar && !nodes.loadedEditorBar.classList.contains("is-hidden") ? nodes.loadedEditorBar : section || layout;
  const target = getLoadedEditorTarget(targetMode) || section || editorAnchor || layout;
  if (!target) return;

  if (target.id) {
    const nextHash = `#${target.id}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    try {
      window.history.replaceState(null, "", nextUrl);
    } catch (_) {
      window.location.hash = nextHash;
    }
    if (window.location.hash !== nextHash) {
      window.setTimeout(() => {
        try {
          window.location.hash = nextHash;
        } catch (_) {}
      }, 20);
    }
  }
  const jumpMode = targetMode === "review" ? "review" : "client";
  jumpToLoadedEditor(jumpMode, "auto");
  target.setAttribute("tabindex", "-1");
  target.focus?.({ preventScroll: true });
  [section, layout, proposalPaper, reviewPanel, nodes.loadedEditorBar].filter(Boolean).forEach((node) => {
    node.classList.remove("is-loaded-focus");
    void node.offsetWidth;
    node.classList.add("is-loaded-focus");
    window.setTimeout(() => node.classList.remove("is-loaded-focus"), 1700);
  });
  scheduleLoadedEditorJump(jumpMode, "auto");
  window.setTimeout(() => fields.clientName?.focus?.({ preventScroll: true }), 350);
  showToast(message);
}

function getPipelineStageTitle(stageId) {
  return funnelStages.find((stage) => stage.id === stageId)?.title || "Funil";
}

function jumpToPipelineStage(stageId) {
  if (!stageId) return;
  state.activePipelineFilter = stageId;
  renderPipeline();
  window.requestAnimationFrame(() => {
    const safeStageId = String(stageId).replace(/[^a-z0-9_-]/gi, "");
    const stage = document.querySelector(`.pipeline-stage-${safeStageId}`);
    if (!stage) {
      showToast("Etapa ainda não encontrada no funil.");
      return;
    }
    stage.querySelector("details")?.setAttribute("open", "");
    stage.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    stage.classList.remove("is-stage-focus");
    void stage.offsetWidth;
    stage.classList.add("is-stage-focus");
    window.setTimeout(() => stage.classList.remove("is-stage-focus"), 1600);
    showToast(`Atalho aberto: ${getPipelineStageTitle(stageId)}.`);
  });
}

function extractDashboardDeepLink() {
  try {
    const url = new URL(window.location.href);
    const queryLeadId = url.searchParams.get("lead") || "";
    const queryProposalId = url.searchParams.get("proposal") || "";
    const rawHash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;

    if (!rawHash || rawHash.includes("access_token=") || rawHash.includes("refresh_token=")) {
      return { leadId: queryLeadId, proposalId: queryProposalId };
    }

    const hashParams = new URLSearchParams(rawHash);
    return {
      leadId: queryLeadId || hashParams.get("lead") || "",
      proposalId: queryProposalId || hashParams.get("proposal") || "",
    };
  } catch (error) {
    console.warn("Falha ao ler deep link do dashboard.", error);
    return { leadId: "", proposalId: "" };
  }
}

function syncDashboardDeepLinkState() {
  const { leadId, proposalId } = extractDashboardDeepLink();
  state.pendingDashboardLeadId = leadId;
  state.pendingDashboardProposalId = proposalId;
  if (!leadId && !proposalId) state.lastAppliedDashboardTarget = "";
}

async function applyPendingDashboardTarget() {
  if (!state.session) return false;

  const targetKey = state.pendingDashboardProposalId
    ? `proposal:${state.pendingDashboardProposalId}`
    : state.pendingDashboardLeadId
      ? `lead:${state.pendingDashboardLeadId}`
      : "";

  if (!targetKey || state.lastAppliedDashboardTarget === targetKey) return false;

  if (state.pendingDashboardProposalId) {
    const proposal = state.proposals.find((item) => item.id === state.pendingDashboardProposalId);
    if (!proposal) return false;
    openSavedProposal(proposal.id, "Link direto");
    state.lastAppliedDashboardTarget = targetKey;
    return true;
  }

  const linkedProposal = state.proposals.find(
    (item) =>
      item.solicitacao_id === state.pendingDashboardLeadId ||
      item.snapshot?.activeQuoteRequestId === state.pendingDashboardLeadId,
  );
  if (linkedProposal) {
    openSavedProposal(linkedProposal.id, "Link direto");
    state.lastAppliedDashboardTarget = targetKey;
    return true;
  }

  const request = state.quoteRequests.find((item) => item.id === state.pendingDashboardLeadId);
  if (!request) return false;
  await applyQuoteRequest(request.id, "Link direto");
  state.lastAppliedDashboardTarget = targetKey;
  return true;
}

function renderCategoryFilter() {
  const categories = getProductTypes();
  if (fields.categoryFilter) {
    fields.categoryFilter.innerHTML = `<option value="">Todas</option>${categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("")}`;
  }
  if (nodes.categoryOptions) {
    nodes.categoryOptions.innerHTML = categories
      .map((category) => `<option value="${escapeHtml(category)}"></option>`)
      .join("");
  }
}

function getProductTypes() {
  return [
    ...new Set([
      ...state.prices.map((item) => item.tipoEvento),
      ...(state.productTypes || []),
    ].map((item) => String(item || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function renderProductTypeManager() {
  if (!nodes.productTypeList) return;
  const types = getProductTypes();
  if (!types.length) {
    nodes.productTypeList.innerHTML = `<p>Nenhum tipo cadastrado ainda.</p>`;
    return;
  }
  const counts = state.prices.reduce((acc, item) => {
    const type = item.tipoEvento || "Sem tipo";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  nodes.productTypeList.innerHTML = types
    .map((type) => {
      const count = counts[type] || 0;
      return `
        <button class="product-type-chip" type="button" data-product-type="${escapeHtml(type)}">
          <strong>${escapeHtml(type)}</strong>
          <span>${count ? `${count} item(ns)` : "Pronto para novo item"}</span>
        </button>
      `;
    })
    .join("");
}

function applyGuidedEvent(eventKey) {
  const config = guidedEvents[eventKey];
  if (!config) return;

  state.guided.event = eventKey;
  state.guided.beverageId = "";
  state.guided.foodId = "";
  state.guided.welcomeId = "";
  state.guided.workshopId = "";
  fields.eventType.value = config.label;
  fields.categoryFilter.value = config.category;
  fields.searchPrice.value = "";
  nodes.flowStatus.textContent = config.status;
  nodes.coquetelChoices.classList.toggle("is-hidden", eventKey !== "coquetel");

  if (eventKey === "almoco") {
    fields.eventTime.value = "11:30";
    fields.eventDuration.value = "1.5";
    if (getGuestCount() < 2) fields.guestCount.value = "2";
  }

  setChoiceState(nodes.flowEventOptions, eventKey, "flowEvent");
  setChoiceState(nodes.flowBeverageOptions, "", "selectPackage");
  setChoiceState(nodes.flowFoodOptions, "", "selectPackage");
  setChoiceState(nodes.flowWelcomeOptions, "", "selectPackage");
  setChoiceState(nodes.flowWorkshopOptions, "", "selectPackage");

  const templateStatus = applySmartTemplateForEvent(eventKey);
  if (templateStatus && nodes.flowStatus) nodes.flowStatus.textContent = templateStatus;

  saveSelectedIds();
  renderAll();
  scrollToItems();
}

function applyGuidedPackage(packageId) {
  if (packageId === "none-food") {
    state.guided.foodId = "";
    setExclusiveSelection(coquetelFoodIds, "");
    setChoiceState(nodes.flowFoodOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Coquetel com bebidas selecionadas e sem pacote de comidas. Se quiser, adicione Welcome Drink e Workshop como complementos.";
  } else if (packageId === "none-welcome") {
    state.guided.welcomeId = "";
    setExclusiveSelection(welcomeDrinkIds, "");
    setChoiceState(nodes.flowWelcomeOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Coquetel sem Welcome Drink adicional. Você ainda pode adicionar workshop como experiência opcional.";
  } else if (packageId === "none-workshop") {
    state.guided.workshopId = "";
    setExclusiveSelection(workshopIds, "");
    setChoiceState(nodes.flowWorkshopOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Coquetel sem workshop adicional. Confira convidados, duração e total estimado.";
  } else if (coquetelBeverageIds.includes(packageId)) {
    state.guided.beverageId = packageId;
    setExclusiveSelection(coquetelBeverageIds, packageId);
    setChoiceState(nodes.flowBeverageOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Bebidas selecionadas. Agora escolha o pacote de comidas ou marque Nenhum.";
  } else if (coquetelFoodIds.includes(packageId)) {
    state.guided.foodId = packageId;
    setExclusiveSelection(coquetelFoodIds, packageId);
    setChoiceState(nodes.flowFoodOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Comidas selecionadas. Você ainda pode adicionar Welcome Drink e Workshop como complementos.";
  } else if (welcomeDrinkIds.includes(packageId)) {
    state.guided.welcomeId = packageId;
    setExclusiveSelection(welcomeDrinkIds, packageId);
    setChoiceState(nodes.flowWelcomeOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Welcome Drink adicionado ao coquetel. Se fizer sentido, inclua também workshop como experiência.";
  } else if (workshopIds.includes(packageId)) {
    state.guided.workshopId = packageId;
    setExclusiveSelection(workshopIds, packageId);
    setChoiceState(nodes.flowWorkshopOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Workshop adicionado ao coquetel. Confira convidados, duração e total estimado.";
  }

  fields.eventType.value = "Coquetel";
  fields.categoryFilter.value = "";
  saveSelectedIds();
  renderAll();
}

function clearGuidedFlow() {
  state.guided = { event: "", beverageId: "", foodId: "", welcomeId: "", workshopId: "" };
  Object.values(smartEventTemplates)
    .flatMap((item) => item.ids)
    .forEach((id) => state.selectedIds.delete(id));
  coquetelComplementIds.forEach((id) => state.selectedIds.delete(id));
  fields.eventType.value = "";
  fields.categoryFilter.value = "";
  fields.searchPrice.value = "";
  nodes.coquetelChoices.classList.add("is-hidden");
  nodes.flowStatus.textContent =
    "Comece escolhendo o tipo de evento. O app filtra os pacotes e seleciona automaticamente quando houver uma regra clara.";
  setChoiceState(nodes.flowEventOptions, "", "flowEvent");
  setChoiceState(nodes.flowBeverageOptions, "", "selectPackage");
  setChoiceState(nodes.flowFoodOptions, "", "selectPackage");
  setChoiceState(nodes.flowWelcomeOptions, "", "selectPackage");
  setChoiceState(nodes.flowWorkshopOptions, "", "selectPackage");
  saveSelectedIds();
  renderAll();
}

function getFilteredPrices() {
  const query = fields.searchPrice?.value.trim().toLowerCase() || "";
  const category = fields.categoryFilter?.value || "";
  const categoryMatches = (item) => {
    if (!category) return true;
    if (item.tipoEvento === category) return true;
    return category === "Coquetel" && getAllowedCategoriesForEvent("Coquetel").includes(item.tipoEvento);
  };
  return state.prices.filter((item) => {
    const haystack = `${item.codigo} ${item.tipoEvento} ${item.nome} ${item.descricao} ${item.commercialSummary} ${item.recommendedWindows}`.toLowerCase();
    const visible = item.active !== false || state.selectedIds.has(item.id);
    return visible && (!query || haystack.includes(query)) && categoryMatches(item);
  });
}

function renderPriceList() {
  if (!nodes.priceList) return;
  const items = getFilteredPrices();
  if (!items.length) {
    nodes.priceList.innerHTML = `<p>Nenhum item encontrado.</p>`;
    return;
  }

  nodes.priceList.innerHTML = items
    .map((item) => {
      const calc = calculateItem(item);
      const checked = state.selectedIds.has(item.id) ? "checked" : "";
      const categoryMeta = getCommercialCategoryMeta(item);
      const priorityLabel =
        item.priority === "alta"
          ? "Prioridade alta"
          : item.priority === "baixa"
            ? "Prioridade baixa"
            : "Prioridade média";
      const priorityClass =
        item.priority === "alta"
          ? "chip-priority-high"
          : item.priority === "baixa"
            ? "chip-priority-low"
            : "chip-priority-medium";
      return `
        <label class="price-row" data-price-category="${escapeHtml(categoryMeta.key)}">
          <input type="checkbox" data-select-id="${escapeHtml(item.id)}" ${checked} />
          <span class="price-row-body">
            <span class="price-card-topline">
              <span class="price-category-group">
                <span class="price-category-badge">${escapeHtml(item.tipoEvento)}</span>
                <span class="price-category-support">${escapeHtml(categoryMeta.caption)}</span>
              </span>
              <span class="price-select-indicator">${checked ? "Selecionado" : "Selecionar"}</span>
            </span>
            <span class="price-card-main">
              <span class="price-name">
                <strong>${escapeHtml(item.nome)}</strong>
              </span>
              <span class="item-cost">
                <span class="item-cost-label">${checked ? "Incluído na proposta" : "Valor estimado"}</span>
                <strong>${formatMoney(calc.total)}</strong>
              </span>
            </span>
            <span class="price-meta">
              ${item.idioma ? `<span class="chip">${escapeHtml(item.idioma)}</span>` : ""}
              <span class="chip ${priorityClass}">${escapeHtml(priorityLabel)}</span>
              <span class="chip chip-soft">${escapeHtml(item.formula === "fixo" ? "Preço fixo" : "Por pessoa")}</span>
            </span>
            <p class="price-summary">${escapeHtml(item.commercialSummary || item.descricao)}</p>
            <span class="price-card-footer">
              <span class="price-window">
                <span class="price-window-label">Melhor janela</span>
                <strong>${escapeHtml(item.recommendedWindows || "Sob consulta")}</strong>
              </span>
            </span>
            <p class="price-detail">${escapeHtml(calc.detail)}</p>
          </span>
        </label>
      `;
    })
    .join("");
}

function renderPricesTable() {
  if (!nodes.pricesTable) return;
  nodes.pricesTable.innerHTML = state.prices
    .map(
      (item) => `
      <tr>
        <td><input type="checkbox" data-price-id="${escapeHtml(item.id)}" data-field="active" ${item.active !== false ? "checked" : ""} /></td>
        <td>${escapeHtml(item.codigo)}</td>
        <td>${escapeHtml(item.tipoEvento)}</td>
        <td>${escapeHtml(item.nome)}</td>
        <td>
          <select data-price-id="${escapeHtml(item.id)}" data-field="priority">
            <option value="alta" ${item.priority === "alta" ? "selected" : ""}>Alta</option>
            <option value="media" ${item.priority === "media" ? "selected" : ""}>Média</option>
            <option value="baixa" ${item.priority === "baixa" ? "selected" : ""}>Baixa</option>
          </select>
        </td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="recommendedWindows" value="${escapeHtml(item.recommendedWindows || "")}" /></td>
        <td><textarea data-price-id="${escapeHtml(item.id)}" data-field="commercialSummary" rows="2">${escapeHtml(item.commercialSummary || item.descricao)}</textarea></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="preco1h" inputmode="decimal" value="${escapeHtml(item.preco1h)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="preco2h" inputmode="decimal" value="${escapeHtml(item.preco2h)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="precoMeiaHoraExtra" inputmode="decimal" value="${escapeHtml(item.precoMeiaHoraExtra)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="precoFixo" inputmode="decimal" value="${escapeHtml(item.precoFixo)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="valorAdicional" inputmode="decimal" value="${escapeHtml(item.valorAdicional)}" /></td>
        <td><input data-price-id="${escapeHtml(item.id)}" data-field="minimo" inputmode="numeric" value="${escapeHtml(item.minimo)}" /></td>
        <td>
          <select data-price-id="${escapeHtml(item.id)}" data-field="formula">
            ${[
              "durationPerPerson",
              "serviceIncluded90PerPerson",
              "perPersonFixed",
              "fixedPlusPerPerson",
              "fixedCoversMinimum",
              "fixedTotal",
            ]
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

function renderCommercialLibrarySummary() {
  if (!nodes.commercialLibrarySummary) return;
  const activeItems = state.prices.filter((item) => item.active !== false);
  const customItems = state.prices.filter((item) => item.custom);
  const highPriorityItems = activeItems.filter((item) => item.priority === "alta");
  const categories = new Set(activeItems.map((item) => item.tipoEvento).filter(Boolean));
  nodes.commercialLibrarySummary.innerHTML = `
    <div><span>Produtos ativos</span><strong>${activeItems.length}</strong></div>
    <div><span>Prioridade alta</span><strong>${highPriorityItems.length}</strong></div>
    <div><span>Categorias</span><strong>${categories.size}</strong></div>
    <div><span>Itens criados</span><strong>${customItems.length}</strong></div>
  `;
}

function renderSummary() {
  if (!nodes.grandTotal || !nodes.proposalTotal || !nodes.totalMeta || !nodes.selectedItems) return;
  const selected = getSelectedItems();
  const totals = getQuoteTotals();
  nodes.grandTotal.textContent = formatMoney(totals.total);
  nodes.proposalTotal.textContent = formatMoney(totals.total);
  nodes.totalMeta.textContent = selected.length
    ? `${selected.length} ${selected.length === 1 ? "item" : "itens"}, ${getGuestCount()} convidado(s), ${getDuration()}h, taxa de 12% incluída.`
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
            <small>${escapeHtml(item.commercialSummary || item.descricao)}</small>
            <small>${escapeHtml(item.calc.detail)}</small>
          </div>
        `,
        )
        .join("")
    : `<p>Os itens escolhidos aparecem aqui.</p>`;
}

function renderSendReview() {
  if (!nodes.sendReviewPanel) return;
  const allItems = getProposalReviewItems();
  const items = getProposalSendReviewItems(allItems);
  const summary = getProposalReviewSummary(items);
  const approved = isSendReviewApproved(allItems);
  const command = getSendReviewPrimaryCommand(summary, items, allItems);
  const smartAlerts = getSmartProposalAlerts(items);
  const confidence = getProposalConfidence(items, smartAlerts);
  const automation = getProposalAutomationReadiness(items, smartAlerts, confidence);
  const decisionLoop = getCustomerDecisionLoop();
  const guide = getReviewGuide(items, approved);
  const totals = getQuoteTotals();
  const destination = fields.clientEmail.value.trim() || fields.clientPhone.value.trim() || "Sem canal";
  const eventLine = [
    fields.eventDate.value ? formatDateFromIso(fields.eventDate.value) : "Data a definir",
    fields.eventTime.value || "Horário a definir",
    `${getGuestCount()} pax`,
  ].join(" · ");
  const hasReviewPhone = Boolean(fields.clientPhone.value.trim().replace(/\D/g, ""));
  const hasReviewEmail = isLikelyEmailAddress(fields.clientEmail.value.trim());
  const channelActionButtons =
    summary.ready && approved
      ? `
    <div class="send-review-channel-actions" aria-label="Canais de envio da proposta">
      ${
        hasReviewPhone
          ? `<button class="primary" type="button" data-send-review-action="whatsapp">Enviar por WhatsApp</button>`
          : ""
      }
      ${
        hasReviewEmail
          ? `<button class="secondary" type="button" data-send-review-action="email">Enviar por e-mail</button>`
          : ""
      }
    </div>`
      : "";
  const title = summary.ready ? (approved ? "Revisão aprovada" : "Pronto para revisar") : "Revise antes de enviar";
  const note = summary.ready
    ? approved
      ? "Checklist confirmado. Use WhatsApp ou e-mail para enviar com segurança."
      : summary.attentionWarnings
      ? `${summary.attentionWarnings} ${summary.attentionWarnings === 1 ? "ponto de atenção" : "pontos de atenção"}. Pode enviar, mas confira.`
      : summary.optionalWarnings
      ? `${summary.optionalWarnings} sugestão(ões) comercial(is). Pode enviar ou completar para melhorar acompanhamento.`
      : "Dados essenciais, cardápio e valor estão coerentes."
    : `${summary.errors} pendência(s) impedem envio seguro.`;
  const nextAction = summary.ready
    ? "Enviar link por WhatsApp"
    : summary.errors
      ? "Corrigir pendências obrigatórias"
      : "Conferir pontos de atenção";
  const nextActionNote = summary.ready
    ? "WhatsApp tende a acelerar a resposta; o link registra aprovação, ajuste ou comprovante."
    : "Clique em um item para ir ao campo certo.";

  nodes.sendReviewPanel.className = `send-review-panel is-${summary.ready ? "ready" : "blocked"}${approved ? " is-approved" : ""}`;
  nodes.sendReviewPanel.innerHTML = `
    <div class="send-review-heading">
      <div>
        <span>Revisão antes do envio</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <small>${escapeHtml(note)}</small>
    </div>
    ${channelActionButtons}
    <div class="review-command-center is-${escapeHtml(guide.tone)}">
      <div class="review-command-copy">
        <span>${escapeHtml(guide.eyebrow)}</span>
        <strong>${escapeHtml(guide.title)}</strong>
        <p>${escapeHtml(guide.detail)}</p>
      </div>
      <div class="review-command-side">
        <b>${escapeHtml(guide.statusLabel)}</b>
        <button class="primary" type="button" data-send-review-action="${escapeHtml(command.action)}" data-review-target="${escapeHtml(command.target || guide.target || "client")}">
          ${escapeHtml(summary.ready ? command.label : guide.actionLabel)}
        </button>
      </div>
    </div>
    ${renderSendReviewWorkflow(items)}
    <div class="send-review-route" aria-label="Rota rápida de conferência e envio">
      <button type="button" data-review-target="client">
        <span>1</span>
        <strong>Dados</strong>
        <small>cliente e contato</small>
      </button>
      <button type="button" data-review-target="items">
        <span>2</span>
        <strong>Itens</strong>
        <small>cardápio e valor</small>
      </button>
      <button type="button" data-review-target="review">
        <span>3</span>
        <strong>Checklist</strong>
        <small>segurança do envio</small>
      </button>
      <button class="is-primary" type="button" data-send-review-action="${escapeHtml(command.action)}" data-review-target="${escapeHtml(command.target || "client")}">
        <span>4</span>
        <strong>${escapeHtml(command.action === "whatsapp" ? "Enviar" : command.action === "approve" ? "Aprovar" : "Resolver")}</strong>
        <small>${escapeHtml(command.label || nextAction)}</small>
      </button>
    </div>
    <p class="send-review-safe-note">Fluxo seguro: nada é enviado sem checklist aprovado e confirmação final do canal.</p>
    <div class="send-review-confidence is-${escapeHtml(confidence.status)}">
      <div>
        <span>Confiança para envio</span>
        <strong>${escapeHtml(String(confidence.score))}%</strong>
      </div>
      <p>${escapeHtml(confidence.label)} · ${escapeHtml(confidence.note)} ${escapeHtml(automation.label)}: ${escapeHtml(automation.note)}</p>
    </div>
    <div class="review-sixty">
      <div>
        <span>Revisão em 60 segundos</span>
        <strong>Confira nesta ordem: lead, agenda, itens, valor e canal.</strong>
      </div>
      <ol>
        <li>Cliente, empresa/agência, cliente final ou grupo e WhatsApp/e-mail corretos.</li>
        <li>Formato, data, horário, pax, duração e disponibilidade coerentes.</li>
        <li>Cardápio, upsell útil, valor final, validade, prazo do sinal e observações revisados.</li>
      </ol>
    </div>
    ${renderCustomerDecisionLoop(decisionLoop)}
    <div class="send-smart-alerts">
      ${smartAlerts
        .map(
          (alert) => `
            <button class="smart-alert is-${escapeHtml(alert.level)}" type="button" data-review-target="${escapeHtml(alert.target)}">
              <span>${escapeHtml(alert.kind)}</span>
              <strong>${escapeHtml(alert.title)}</strong>
              <small>${escapeHtml(alert.detail)}</small>
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="send-review-command">
      <article class="send-review-next-action">
        <span>${approved ? "Pronto para enviar" : "Próxima melhor ação"}</span>
        <strong>${escapeHtml(command.label || nextAction)}</strong>
        <small>${escapeHtml(command.detail || nextActionNote)}</small>
        <button class="send-review-primary-button" type="button" data-send-review-action="${escapeHtml(command.action)}" data-review-target="${escapeHtml(command.target || "client")}">
          ${escapeHtml(command.label || nextAction)}
        </button>
      </article>
      <article>
        <span>Cliente</span>
        <strong>${escapeHtml(fields.clientName.value.trim() || "Cliente não informado")}</strong>
        <small>${escapeHtml(destination)}</small>
      </article>
      <article>
        <span>Evento</span>
        <strong>${escapeHtml(getCurrentEventType() || "Formato a definir")}</strong>
        <small>${escapeHtml(eventLine)}</small>
      </article>
      <article>
        <span>Revisão</span>
        <strong>${escapeHtml(approved ? "Confirmada" : summary.ready ? "Falta aprovar" : "Pendente")}</strong>
        <small>${escapeHtml(approved ? "Checklist travado para esta versão." : "Aprove antes de enviar.")}</small>
      </article>
      <article>
        <span>Total</span>
        <strong>${escapeHtml(formatMoney(totals.total))}</strong>
        <small>${escapeHtml(`${getSelectedItems().length} ${getSelectedItems().length === 1 ? "item" : "itens"} · sinal em ${formatSignalDeadlineHours()}`)}</small>
      </article>
    </div>
    <div class="send-review-grid">
      ${items
        .map(
          (item) => `
            <button class="send-review-item is-${escapeHtml(item.status)}" type="button" data-review-target="${escapeHtml(item.target)}">
              <span>${item.status === "ok" ? "OK" : item.status === "warning" ? "!" : "!"}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.detail)}</small>
              <em>${escapeHtml(item.status === "ok" ? "Conferido" : getReviewActionLabel(item))}</em>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCalculation() {
  if (!nodes.calculationBreakdown) return;
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
      <span>Ajuste</span>
      <strong>${formatMoney(totals.adjustment)}</strong>
      <small>${escapeHtml(totals.adjustmentLabel)}.</small>
    </div>
    <div>
      <span>Total</span>
      <strong>${formatMoney(totals.total)}</strong>
      <small>Subtotal + taxa + privatização + ajuste.</small>
    </div>
  `;

  if (nodes.privatizationTitle) nodes.privatizationTitle.textContent = privatization.title;
  if (nodes.privatizationDescription) nodes.privatizationDescription.textContent = privatization.description;
  if (nodes.optionalPrivatizationControls) {
    nodes.optionalPrivatizationControls.classList.toggle("is-hidden", !privatization.optional);
    setChoiceState(nodes.optionalPrivatizationControls, state.privatizationChoice, "privatizationChoice");
  }
}

function renderPrivatizationRulesTable() {
  if (!nodes.privatizationRulesTable) return;
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

function getSignalDeadlineHours() {
  const raw = Number(fields.signalDeadlineHours?.value || DEFAULT_SIGNAL_DEADLINE_HOURS);
  if (!Number.isFinite(raw)) return DEFAULT_SIGNAL_DEADLINE_HOURS;
  return Math.min(MAX_SIGNAL_DEADLINE_HOURS, Math.max(MIN_SIGNAL_DEADLINE_HOURS, raw));
}

function calculateSignalDeadlineAt(hours = getSignalDeadlineHours()) {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + Number(hours || DEFAULT_SIGNAL_DEADLINE_HOURS));
  return deadline.toISOString();
}

function formatSignalDeadlineHours(hours = getSignalDeadlineHours()) {
  const value = Number(hours || DEFAULT_SIGNAL_DEADLINE_HOURS);
  if (value < 24) return `${value} horas`;
  const days = value / 24;
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function buildProposalText() {
  const selected = getSelectedItems();
  const clientName = fields.clientName.value.trim() || "Cliente";
  const eventType = getCurrentEventType() || "Evento";
  const totals = getQuoteTotals();
  const sourceData = getFormSourceData();
  const reason = fields.eventReason.value.trim() || sourceData.reason;
  const lines = [
    `Proposta de evento - Embaixada Carioca`,
    ``,
    `Cliente: ${clientName}`,
    `Evento: ${eventType}`,
    `Data: ${getEventDateLabel()}`,
    `Horário: ${getEventTimeLabel()}`,
    `Convidados: ${getGuestCount()}`,
    `Duração: ${getDuration()}h`,
    `Validade: ${fields.validity.value.trim() || "14 dias"}`,
    `Prazo para sinal: ${formatSignalDeadlineHours()}`,
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
  if (totals.adjustment) lines.splice(lines.length - 1, 0, `${totals.adjustmentLabel}: ${formatMoney(totals.adjustment)}`);

  const notes = fields.notes.value.trim();
  if (notes) lines.push(``, `Observações: ${notes}`);

  return lines.join("\n");
}

function getProposalSnapshot() {
  syncEventTypeFromSelection();
  const totals = getQuoteTotals();
  const selected = getSelectedItems();
  const activeRequest = state.quoteRequests.find((item) => item.id === state.activeQuoteRequestId);
  const activeProposal = getActiveProposal();
  const signalDeadlineHours = getSignalDeadlineHours();
  const signalDeadlineAt = calculateSignalDeadlineAt(signalDeadlineHours);
  const reviewItems = getProposalReviewItems();
  const reviewAlerts = getSmartProposalAlerts(reviewItems);
  const reviewConfidence = getProposalConfidence(reviewItems, reviewAlerts);
  const automationReadiness = getProposalAutomationReadiness(reviewItems, reviewAlerts, reviewConfidence);
  const customerDecisionLoop = getCustomerDecisionLoop(activeProposal);
  const sourceData = getFormSourceData();
  const sourceQualification = {
    ...(activeRequest?.snapshot?.qualificacao || {}),
    ...(activeProposal?.snapshot?.qualificacao || {}),
    ...(sourceData.clientType ? { tipoCliente: sourceData.clientType } : {}),
    ...(sourceData.finalClient ? { clienteFinal: sourceData.finalClient } : {}),
    ...(sourceData.groupName ? { nomeGrupo: sourceData.groupName } : {}),
    ...(sourceData.origin ? { origem: sourceData.origin } : {}),
    ...(sourceData.budgetRange ? { faixaInvestimento: sourceData.budgetRange } : {}),
    ...(sourceData.moment ? { momento: sourceData.moment } : {}),
    ...(sourceData.occasion ? { ocasiao: sourceData.occasion } : {}),
    ...(sourceData.reason ? { motivo: sourceData.reason } : {}),
    ...(sourceData.preferences ? { preferencias: sourceData.preferences } : {}),
    ...(sourceData.extras ? { extras: sourceData.extras } : {}),
    ...(sourceData.observations ? { observacoes: sourceData.observations } : {}),
  };
  const reviewApproval =
    isSendReviewApproved(reviewItems) && state.sendReviewApproval?.signature === state.sendReviewApprovedSignature
      ? {
          ...state.sendReviewApproval,
          confidence: reviewConfidence.score,
          status: reviewConfidence.status,
          automation: automationReadiness,
        }
      : null;
  return {
    version: 1,
    referencia: activeRequest?.snapshot?.referencia || "",
    savedAt: new Date().toISOString(),
    client: {
      name: fields.clientName.value.trim(),
      email: fields.clientEmail.value.trim(),
      phone: fields.clientPhone.value.trim(),
      company: sourceData.company || activeRequest?.empresa || activeRequest?.cliente_empresa || activeRequest?.snapshot?.cliente?.empresa || "",
      finalClient: sourceData.finalClient || getFinalClientFromSnapshot(activeRequest?.snapshot || activeProposal?.snapshot || {}),
      groupName: sourceData.groupName || getGroupNameFromSnapshot(activeRequest?.snapshot || activeProposal?.snapshot || {}),
    },
    event: {
      type: getCurrentEventType(),
      date: fields.eventDate.value,
      time: fields.eventTime.value,
      guests: getGuestCount(),
      duration: getDuration(),
      validity: fields.validity.value.trim(),
      signalDeadlineHours,
      signalDeadlineAt,
      manualAdjustment: getManualAdjustment(),
      manualAdjustmentLabel: fields.manualAdjustmentLabel.value.trim(),
      reason: fields.eventReason.value.trim() || sourceData.reason,
      notes: fields.notes.value.trim(),
      preferences: sourceData.preferences,
      extras: sourceData.extras,
      sourceNotes: sourceData.observations,
    },
    totals: {
      subtotal: roundCurrency(totals.subtotal),
      serviceFee: roundCurrency(totals.serviceFee),
      privatizationAmount: roundCurrency(totals.privatization.amount),
      adjustment: roundCurrency(totals.adjustment),
      adjustmentLabel: totals.adjustmentLabel,
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
      commercialSummary: item.commercialSummary || item.descricao,
      priority: item.priority || "media",
      recommendedWindows: item.recommendedWindows || "",
      formula: item.formula,
      calc: item.calc,
    })),
    prices: state.prices,
    guided: state.guided,
    privatizationChoice: state.privatizationChoice,
    activeQuoteRequestId: state.activeQuoteRequestId,
    qualificacao: sourceQualification,
    sourceOverrides: getCurrentSourceOverrides(),
    sourceRequestSnapshot: activeRequest?.snapshot || activeProposal?.snapshot?.sourceRequestSnapshot || null,
    privatizationRules: state.privatizationRules,
    generalTerms: fields.generalTerms.value,
    paymentTerms,
    operationalChecklist: activeProposal?.snapshot?.operationalChecklist || {},
    commercialHistory: getCommercialHistory(activeProposal?.snapshot || {}),
    sendReviewApproval: reviewApproval,
    reviewConfidence,
    automationReadiness,
    smartAlerts: reviewAlerts,
    customerDecisionLoop,
    internalComments: getInternalComments(activeProposal?.snapshot || {}),
    eventAttachments: getEventAttachments(activeProposal?.snapshot || {}),
    proposalText: buildProposalText(),
  };
}

function getDebugProposalState() {
  if (!QA_MODE) return null;
  return {
    activeProposalId: state.activeProposalId,
    activeProposal: state.proposals.find((item) => item.id === state.activeProposalId) || null,
    proposalsCount: state.proposals.length,
    quoteRequestsCount: state.quoteRequests.length,
    integrationLogs: JSON.parse(JSON.stringify(state.integrationLogs || [])),
  };
}

function getProposalRow(snapshot, status = "proposta_enviada") {
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
    status,
    solicitacao_id: state.activeQuoteRequestId || null,
    snapshot,
  };
}

function renderSupabaseStatus(message, connected = false) {
  if (!nodes.supabaseStatus) return;
  nodes.supabaseStatus.textContent = message;
  nodes.supabaseStatus.style.borderLeftColor = connected ? "var(--verde)" : "var(--verde-2)";
}

function createQaTimestamp(daysOffset = 0, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function createQaDate(daysOffset = 0) {
  return createQaTimestamp(daysOffset, 12, 0).slice(0, 10);
}

function createQaSourceSnapshot({
  reference,
  company = "",
  clientType = "Cliente direto",
  finalClient = "",
  groupName = "",
  budgetRange = "R$ 15 mil a R$ 30 mil",
  origin = "Indicação",
  moment = "Manhã em dia de semana",
  occasion = "Reunião / encontro corporativo",
  preferences = "",
  observations = "",
  eventType = "Café da Manhã / Brunch",
  date = "",
  time = "",
  guests = 30,
  duration = 1,
} = {}) {
  return {
    origem: "formulario",
    referencia: reference,
    cliente: {
      empresa: company,
      tipoCliente: clientType,
      clienteFinal: finalClient,
      nomeGrupo: groupName,
    },
    qualificacao: {
      tipoCliente: clientType,
      clienteFinal: finalClient,
      nomeGrupo: groupName,
      faixaInvestimento: budgetRange,
      origem: origin,
      momento: moment,
      ocasiao: occasion,
    },
    evento: {
      tipo: eventType,
      data: date,
      horario: time,
      convidados: guests,
      duracao: duration,
      momento: moment,
      ocasiao: occasion,
      preferencias: preferences,
      observacoes: observations,
    },
  };
}

function createQaProposalSnapshot({
  reference,
  clientName,
  email,
  phone,
  company = "",
  type,
  date,
  time,
  guests,
  duration,
  selectedIds = [],
  total,
  clientType,
  finalClient,
  groupName,
  budgetRange,
  origin,
  moment,
  occasion,
  notes = "",
  signalPayment = null,
  remainingPayment = null,
  clientResponse = null,
} = {}) {
  const sourceSnapshot = createQaSourceSnapshot({
    reference,
    company,
    clientType,
    finalClient,
    groupName,
    budgetRange,
    origin,
    moment,
    occasion,
    eventType: type,
    date,
    time,
    guests,
    duration,
    observations: notes,
  });
  const selectedItems = selectedIds
    .map((id) => state.prices.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      codigo: item.codigo,
      tipoEvento: item.tipoEvento,
      nome: item.nome,
      descricao: item.descricao,
      commercialSummary: item.commercialSummary || item.descricao,
      formula: item.formula,
      calc: { total: 0, detail: "Simulado no modo QA" },
    }));
  return {
    version: 1,
    referencia: reference,
    savedAt: createQaTimestamp(-1, 15, 15),
    client: {
      name: clientName,
      email,
      phone,
      company,
      finalClient,
      groupName,
    },
    event: {
      type,
      date,
      time,
      guests,
      duration,
      validity: "14 dias",
      signalDeadlineHours: DEFAULT_SIGNAL_DEADLINE_HOURS,
      signalDeadlineAt: createQaTimestamp(2, 15, 0),
      manualAdjustment: 0,
      manualAdjustmentLabel: "",
      reason: occasion || "",
      notes,
    },
    totals: {
      subtotal: Math.round((total || 0) / (1 + SERVICE_RATE)),
      serviceFee: Math.round((total || 0) - (total || 0) / (1 + SERVICE_RATE)),
      privatizationAmount: 0,
      adjustment: 0,
      adjustmentLabel: "Ajuste comercial",
      total: total || 0,
      privatization: { amount: 0, title: "Privatização não aplicada", description: "Simulado no modo QA." },
    },
    selectedIds,
    selectedItems,
    prices: state.prices,
    guided: { event: getGuidedEventKeyFromType(type), beverageId: "", foodId: "", welcomeId: "", workshopId: "" },
    privatizationChoice: "",
    activeQuoteRequestId: "",
    qualificacao: sourceSnapshot.qualificacao,
    sourceRequestSnapshot: sourceSnapshot,
    privatizationRules: state.privatizationRules,
    generalTerms: loadGeneralTerms(),
    paymentTerms,
    operationalChecklist: {},
    commercialHistory: [
      {
        id: `qa-hist-${reference}`,
        type: "proposta",
        title: "Registro QA criado",
        detail: "Dado fictício para validar fluxo, UX e segurança sem tocar na operação real.",
        at: createQaTimestamp(-1, 15, 15),
        actor: QA_USER_EMAIL,
        actorRole: "Super admin",
      },
    ],
    ...(signalPayment ? { pagamentoSinal: signalPayment } : {}),
    ...(remainingPayment ? { pagamentoRestante: remainingPayment } : {}),
    ...(clientResponse ? { clienteResposta: clientResponse } : {}),
  };
}

function createQaProposal(input) {
  const now = createQaTimestamp(input.updatedOffsetDays || -1, input.updatedHour || 15, input.updatedMinute || 0);
  const snapshot = createQaProposalSnapshot(input);
  return {
    id: input.id,
    responsavel_id: "qa-user",
    responsavel_email: QA_USER_EMAIL,
    cliente_nome: input.clientName,
    cliente_email: input.email,
    cliente_whatsapp: input.phone,
    cliente_empresa: input.company || "",
    tipo_evento: input.type,
    data_evento: input.date,
    horario_evento: input.time,
    convidados: input.guests,
    duracao: input.duration,
    subtotal: snapshot.totals.subtotal,
    taxa_servico: snapshot.totals.serviceFee,
    privatizacao: snapshot.totals.privatizationAmount,
    total: snapshot.totals.total,
    status: input.status || "proposta_enviada",
    solicitacao_id: input.solicitacaoId || null,
    cliente_resposta: input.clientResponse?.acao || "",
    cliente_mensagem: input.clientResponse?.mensagem || "",
    cliente_solicitacao: input.clientResponse || null,
    cliente_resposta_em: input.clientResponse?.registradoEm || null,
    created_at: createQaTimestamp(input.createdOffsetDays || -4, input.createdHour || 10, 0),
    updated_at: now,
    snapshot,
  };
}

function createQaRequest(input) {
  const snapshot = createQaSourceSnapshot(input);
  return {
    id: input.id,
    cliente_nome: input.clientName,
    cliente_email: input.email,
    cliente_whatsapp: input.phone,
    cliente_empresa: input.company || "",
    empresa: input.company || "",
    tipo_evento: input.eventType,
    data_evento: input.date,
    horario_evento: input.time,
    convidados: input.guests,
    duracao: input.duration,
    motivo_evento: input.occasion || "",
    preferencias: input.preferences || "",
    observacoes: input.observations || "",
    status: input.status || "lead_recebido",
    proposta_id: null,
    snapshot,
    created_at: createQaTimestamp(input.createdOffsetDays || -2, input.createdHour || 9, input.createdMinute || 0),
    updated_at: createQaTimestamp(input.updatedOffsetDays || -2, input.updatedHour || 9, input.updatedMinute || 0),
  };
}

function createQaSupabaseClient() {
  const tableMap = {
    propostas: () => state.proposals,
    solicitacoes_cotacao: () => state.quoteRequests,
  };
  const setTable = (table, rows) => {
    if (table === "propostas") state.proposals = rows;
    if (table === "solicitacoes_cotacao") state.quoteRequests = rows;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function runQuery(table, query) {
    const rows = tableMap[table]?.() || [];
    let data = rows.filter((row) => query.filters.every((filter) => row[filter.column] === filter.value));
    if (query.action === "insert") {
      const payload = Array.isArray(query.payload) ? query.payload : [query.payload];
      data = payload.map((row) => ({
        id: row.id || `qa-${table}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...(table === "propostas" ? { public_token: row.public_token || `qa-token-${Date.now()}-${Math.random().toString(16).slice(2)}` } : {}),
        created_at: row.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...clone(row),
      }));
      setTable(table, [...data, ...rows]);
    } else if (query.action === "update") {
      data = [];
      const nextRows = rows.map((row) => {
        if (!query.filters.every((filter) => row[filter.column] === filter.value)) return row;
        const updated = { ...row, ...clone(query.payload), updated_at: new Date().toISOString() };
        data.push(updated);
        return updated;
      });
      setTable(table, nextRows);
    } else if (query.action === "delete") {
      const nextRows = rows.filter((row) => !query.filters.every((filter) => row[filter.column] === filter.value));
      setTable(table, nextRows);
      data = [];
    }

    if (query.action === "select") {
      if (query.orderColumn) {
        data = [...data].sort((a, b) => {
          const av = a[query.orderColumn] || "";
          const bv = b[query.orderColumn] || "";
          return query.ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
      }
      if (Number.isFinite(query.limitValue)) data = data.slice(0, query.limitValue);
    }

    if (query.head) return { data: null, error: null, count: rows.length };
    return { data: clone(data), error: null, count: data.length };
  }

  function from(table) {
    const query = {
      action: "select",
      payload: null,
      filters: [],
      orderColumn: "",
      ascending: true,
      limitValue: Infinity,
      head: false,
    };
    const chain = {
      select(_columns = "*", options = {}) {
        query.head = Boolean(options.head);
        return chain;
      },
      order(column, options = {}) {
        query.orderColumn = column;
        query.ascending = Boolean(options.ascending);
        return chain;
      },
      limit(value) {
        query.limitValue = Number(value);
        return chain;
      },
      insert(payload) {
        query.action = "insert";
        query.payload = payload;
        return chain;
      },
      update(payload) {
        query.action = "update";
        query.payload = payload;
        return chain;
      },
      delete() {
        query.action = "delete";
        return chain;
      },
      eq(column, value) {
        query.filters.push({ column, value });
        return chain;
      },
      single() {
        const result = runQuery(table, query);
        return Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error });
      },
      then(resolve, reject) {
        return Promise.resolve(runQuery(table, query)).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    __qa: true,
    from,
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      signInWithOtp: async () => ({ error: null }),
      setSession: async () => ({ data: { session: state.session }, error: null }),
    },
    functions: {
      invoke: async (name, options = {}) => ({
        data: { ok: true, qa: true, name, body: options.body || null, message: "Simulado no modo QA." },
        error: null,
      }),
    },
  };
}

function loadQaFixtures() {
  const request = createQaRequest({
    id: "qa-request-prioridade",
    reference: "QA-20260511-LEAD",
    clientName: "Claudia da Silva Oliveira",
    email: "financeiro@joanaemaria.com.br",
    phone: "+55 21 96728 514",
    company: "Joana e Maria Eventos Ltda",
    clientType: "Agência de marketing / eventos",
    finalClient: "TV Globo",
    groupName: "Delegação Rio+Criativo",
    budgetRange: "R$ 30 mil a R$ 60 mil",
    origin: "Indicação",
    moment: "Início do almoço",
    occasion: "Reunião / encontro corporativo",
    eventType: "Almoço Carioca",
    date: createQaDate(18),
    time: "12:00",
    guests: 85,
    duration: 2,
    preferences: "Foto, filmagem, som ambiente e restrições alimentares.",
    observations: "Grupo estrangeiro com agenda apertada. Precisa de proposta clara e rápida.",
    createdOffsetDays: -2,
    createdHour: 8,
    createdMinute: 30,
    updatedOffsetDays: -2,
    updatedHour: 8,
    updatedMinute: 30,
  });

  const proposalWaiting = createQaProposal({
    id: "qa-proposal-sem-resposta",
    reference: "QA-20260511-SR",
    clientName: "Bruna Marcelle",
    email: "bruna.qa@example.com",
    phone: "+55 21 99999 0001",
    company: "Rena Travel",
    clientType: "Agência de turismo receptivo / DMC",
    finalClient: "Grupo Andes",
    groupName: "Grupo Andes Incentivo",
    budgetRange: "R$ 15 mil a R$ 30 mil",
    origin: "Google / Instagram",
    moment: "Manhã em dia de semana",
    occasion: "Grupo turístico / receptivo",
    type: "Café da Manhã / Brunch",
    date: createQaDate(7),
    time: "09:30",
    guests: 42,
    duration: 1,
    selectedIds: ["cafe-classico"],
    total: 3057.6,
    status: "proposta_enviada",
    createdOffsetDays: -5,
    updatedOffsetDays: -3,
    updatedHour: 11,
  });

  const proposalChange = createQaProposal({
    id: "qa-proposal-alteracao",
    reference: "QA-20260511-ALT",
    clientName: "Luciano Ferrari Bissolati",
    email: "luciano.qa@example.com",
    phone: "+55 21 99999 0002",
    company: "Farol Eventos",
    clientType: "Agência de marketing / eventos",
    finalClient: "Booking Brasil",
    groupName: "Booking Corporate RJ",
    budgetRange: "Acima de R$ 60 mil",
    origin: "Agência / parceiro",
    moment: "Fim de tarde",
    occasion: "Lançamento / relacionamento com clientes",
    type: "Coquetel",
    date: createQaDate(31),
    time: "18:30",
    guests: 60,
    duration: 2,
    selectedIds: ["coquetel-carioca", "brasileiro-ii"],
    total: 16128,
    status: "negociacao",
    notes: "Cliente pediu alteração: incluir almoço antes do welcome coffee e checar disponibilidade de espaço para apresentação.",
    clientResponse: {
      acao: "alteracao",
      mensagem:
        "Pessoal, precisamos atualizar: é necessário incluir também um almoço além do welcome coffee. Estamos realizando uma cotação de espaço para evento corporativo da Booking Brasil no Rio de Janeiro e gostaríamos de verificar disponibilidade e orçamento com vocês.",
      data: createQaDate(31),
      horario: "17:30",
      convidados: 60,
      registradoEm: createQaTimestamp(-1, 16, 35),
    },
    createdOffsetDays: -2,
    updatedOffsetDays: -1,
    updatedHour: 16,
    updatedMinute: 35,
  });

  const signalProof = {
    valor: 2576,
    data: createQaDate(-1),
    bancos: ["Itaú"],
    comprovante: { nome: "qa-comprovante-sinal.pdf", dataUrl: "" },
  };

  const confirmed = createQaProposal({
    id: "qa-proposal-sinal",
    reference: "QA-20260511-SINAL",
    clientName: "Julia Morena",
    email: "julia.qa@example.com",
    phone: "+55 21 99999 0003",
    company: "Hotel Vista Rio",
    clientType: "Empresa",
    finalClient: "Hotel Vista Rio",
    budgetRange: "R$ 15 mil a R$ 30 mil",
    origin: "Já conheço o restaurante",
    moment: "Manhã em dia de semana",
    occasion: "Reunião / encontro corporativo",
    type: "Café da Manhã / Brunch",
    date: createQaDate(2),
    time: "08:30",
    guests: 40,
    duration: 2.5,
    selectedIds: ["cafe-completo"],
    total: 5152,
    status: "confirmado",
    signalPayment: signalProof,
    createdOffsetDays: -4,
    updatedOffsetDays: -1,
    updatedHour: 9,
  });

  const confirmedFullPayment = createQaProposal({
    id: "qa-proposal-sinal-integral",
    reference: "QA-20260511-INTEGRAL",
    clientName: "Fabiana Simplicio",
    email: "fabiana.qa@example.com",
    phone: "+55 21 99999 0005",
    company: "Grupo Praia Sul",
    clientType: "Cliente direto",
    finalClient: "Grupo Praia Sul",
    budgetRange: "R$ 15 mil a R$ 30 mil",
    origin: "Indicação",
    moment: "Manhã em dia de semana",
    occasion: "Reunião / encontro corporativo",
    type: "Café da Manhã / Brunch",
    date: createQaDate(4),
    time: "10:00",
    guests: 19,
    duration: 1,
    selectedIds: ["cafe-classico"],
    total: 2184,
    status: "confirmado",
    signalPayment: {
      ...signalProof,
      valor: 2184,
      pagamentoIntegral: true,
      percentualSinal: 100,
      tipoPagamento: "integral",
      valorTotalEvento: 2184,
      saldoEstimado: 0,
    },
    createdOffsetDays: -5,
    updatedOffsetDays: -1,
    updatedHour: 10,
  });

  const remaining = createQaProposal({
    id: "qa-proposal-pagamento",
    reference: "QA-20260511-SALDO",
    clientName: "Cristiane Santos",
    email: "cristiane.qa@example.com",
    phone: "+55 21 99999 0004",
    company: "Blue Coast DMC",
    clientType: "Agência de turismo receptivo / DMC",
    finalClient: "Grupo Horizonte",
    groupName: "Horizonte 2026",
    budgetRange: "R$ 30 mil a R$ 60 mil",
    origin: "Agência / parceiro",
    moment: "Noite (19h-21h)",
    occasion: "Confraternização",
    type: "Coquetel",
    date: createQaDate(1),
    time: "19:00",
    guests: 55,
    duration: 2,
    selectedIds: ["coquetel-carioca", "brasileiro-ii", "workshop-caipirinha-pt"],
    total: 22870,
    status: "pagamento_final",
    signalPayment: { ...signalProof, valor: 11435 },
    createdOffsetDays: -10,
    updatedOffsetDays: -1,
    updatedHour: 13,
  });

  state.quoteRequests = [request];
  state.proposals = [proposalWaiting, proposalChange, confirmed, confirmedFullPayment, remaining];
}

async function initQaMode() {
  state.session = {
    user: {
      id: "qa-user",
      email: QA_USER_EMAIL,
    },
  };
  state.supabase = createQaSupabaseClient();
  if (fields.supabaseUrl) fields.supabaseUrl.value = DEFAULT_SUPABASE_URL;
  if (fields.supabaseAnonKey) fields.supabaseAnonKey.value = DEFAULT_SUPABASE_ANON_KEY;
  loadQaFixtures();
  renderSupabaseStatus("Modo QA seguro ativo: dados fictícios, envios e gravações simulados.", true);
  updateAuthUI();
  renderHistory();
  renderConfirmedEvents();
  renderQuoteRequests();
  renderAll();
  showToast("Modo QA ativo. Pode testar sem mexer nos dados reais.");
  await applyPendingDashboardTarget();
}

function getHealthTone(status) {
  if (status === "ok") return "ok";
  if (status === "warning") return "warning";
  return "error";
}

function renderSystemHealth() {
  if (!nodes.systemHealthGrid || !nodes.systemHealthSummary) return;
  const checks = state.systemHealthChecks || [];
  if (!checks.length) {
    nodes.systemHealthSummary.textContent = "Nenhuma verificação rodada nesta sessão.";
    nodes.systemHealthSummary.className = "system-health-summary";
    nodes.systemHealthGrid.innerHTML = `<p>Use Verificar agora para conferir as integrações antes de começar o atendimento.</p>`;
    return;
  }

  const errors = checks.filter((item) => item.status === "error").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  const ok = checks.filter((item) => item.status === "ok").length;
  const summaryText = errors
    ? `${errors} ajuste(s) pendente(s) antes de operar.`
    : warnings
      ? `${ok} ${ok === 1 ? "item ok" : "itens ok"} e ${warnings} atenção.`
      : "Tudo pronto para operar.";
  nodes.systemHealthSummary.textContent = summaryText;
  nodes.systemHealthSummary.className = `system-health-summary is-${errors ? "error" : warnings ? "warning" : "ok"}`;
  nodes.systemHealthGrid.innerHTML = checks
    .map(
      (item) => `
        <article class="system-health-card is-${escapeHtml(getHealthTone(item.status))}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </article>
      `,
    )
    .join("");
}

function getHealthErrorMessage(error) {
  if (!error) return "";
  return error.message || String(error);
}

async function checkPublicPage(path, label) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (response.ok) {
      return { status: "ok", label, title: "Página disponível", detail: `${path} carregou normalmente.` };
    }
    return { status: "error", label, title: "Página indisponível", detail: `${path} retornou HTTP ${response.status}.` };
  } catch (error) {
    return { status: "error", label, title: "Não foi possível carregar", detail: getHealthErrorMessage(error) };
  }
}

async function runSystemHealthCheck() {
  if (!nodes.systemHealthGrid || !nodes.systemHealthSummary) return;
  nodes.systemHealthSummary.textContent = "Verificando integrações...";
  nodes.systemHealthSummary.className = "system-health-summary is-warning";
  nodes.systemHealthGrid.innerHTML = `<p>Rodando checagem rápida. Nenhuma mensagem será enviada ao cliente.</p>`;

  const checks = [];

  if (state.supabase && state.session) {
    try {
      const { error } = await state.supabase.from("propostas").select("id", { count: "exact", head: true });
      checks.push(
        error
          ? { status: "error", label: "Supabase", title: "Histórico com problema", detail: error.message || "Confira RLS e schema." }
          : { status: "ok", label: "Supabase", title: "Histórico conectado", detail: "Login e tabela de propostas responderam corretamente." },
      );
    } catch (error) {
      checks.push({ status: "error", label: "Supabase", title: "Falha na conexão", detail: getHealthErrorMessage(error) });
    }
  } else {
    checks.push({ status: "warning", label: "Supabase", title: "Equipe não conectada", detail: "Entre com e-mail autorizado para salvar e enviar propostas." });
  }

  checks.push(await checkPublicPage("formulario.html", "Formulário"));
  checks.push(await checkPublicPage("proposta.html", "Proposta pública"));
  checks.push(await checkPublicPage("clientes.html", "Clientes"));
  checks.push(await checkPublicPage("valores.html", "Valores"));

  if (state.supabase && state.session) {
    try {
      const { data, error } = await state.supabase.functions.invoke("send-proposal-whatsapp", { body: { dryRun: true } });
      checks.push(
        error || data?.ok === false
          ? { status: "error", label: "WhatsApp", title: "Z-API precisa de atenção", detail: data?.message || (await getFunctionErrorMessage(error)) || "Confira secrets da Z-API." }
          : { status: "ok", label: "WhatsApp", title: "Z-API configurada", detail: "Função respondeu em modo teste, sem enviar mensagem." },
      );
    } catch (error) {
      checks.push({ status: "error", label: "WhatsApp", title: "Falha ao testar Z-API", detail: getHealthErrorMessage(error) });
    }

    try {
      const { data, error } = await state.supabase.functions.invoke("notify-new-lead", { body: { dryRun: true } });
      checks.push(
        error || data?.ok === false
          ? { status: "warning", label: "E-mail de lead", title: "Não foi possível testar", detail: data?.message || (await getFunctionErrorMessage(error)) || "Confira deploy da função notify-new-lead." }
          : { status: "ok", label: "E-mail de lead", title: "ZeptoMail configurado", detail: "Função respondeu em modo teste, sem enviar e-mail." },
      );
    } catch (error) {
      checks.push({ status: "warning", label: "E-mail de lead", title: "Teste indisponível", detail: getHealthErrorMessage(error) });
    }
  } else {
    checks.push({ status: "warning", label: "WhatsApp", title: "Login necessário", detail: "Conecte a equipe para testar o envio direto." });
    checks.push({ status: "warning", label: "E-mail de lead", title: "Login necessário", detail: "Conecte a equipe para testar a função de aviso." });
  }

  state.systemHealthChecks = checks;
  renderSystemHealth();
  createIntegrationLog({
    channel: "health",
    status: checks.some((item) => item.status === "error") ? "error" : checks.some((item) => item.status === "warning") ? "config" : "success",
    title: "Saúde do sistema verificada",
    detail: `${checks.filter((item) => item.status === "ok").length} ok · ${checks.filter((item) => item.status === "warning").length} atenção · ${checks.filter((item) => item.status === "error").length} falha.`,
    target: "Dashboard",
  });
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

function isSuperAdminEmail(email) {
  return SUPER_ADMIN_EMAILS.includes(normalizeEmail(email));
}

function isSuperAdminSession() {
  return Boolean(state.session?.user?.email && isSuperAdminEmail(state.session.user.email));
}

function isFinanceSession() {
  return Boolean(state.session?.user?.email && getTeamProfile(state.session.user.email).canManageFinance);
}

function updateAuthUI() {
  const loginButton = document.querySelector("#loginBtn");
  const logoutButton = document.querySelector("#logoutBtn");
  const recoverButton = document.querySelector("#recoverMagicLinkBtn");
  if (!loginButton || !logoutButton || !recoverButton || !nodes.authStatus || !fields.loginEmail || !fields.magicLinkUrl) return;
  const isConnected = Boolean(state.supabase);
  const isLoggedIn = Boolean(state.session?.user && isTeamEmail(state.session.user.email));

  document.body.classList.toggle("auth-locked", !isLoggedIn);
  document.body.classList.toggle("auth-connected", isLoggedIn);

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
    ? `Conectado como ${state.session.user.email} · ${getTeamProfile(state.session.user.email).label}.`
    : "Use eventos@embaixadacarioca.com.br, financeiro@embaixadacarioca.com.br ou leorangel@gmail.com para receber o link de acesso.";
}

function renderHistory() {
  if (!nodes.historyList) return;
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
      const statusLabel = getProposalStatusLabel(proposal.status);
      const statusClass = operationStatuses.has(normalizeProposalStatus(proposal.status)) ? " confirmed" : "";
      return `
        <button class="history-item" type="button" data-proposal-id="${escapeHtml(proposal.id)}">
          <strong>
            <span>${escapeHtml(proposal.cliente_nome || "Cliente")}</span>
            <span>${formatMoney(proposal.total)}</span>
          </strong>
          <small>${escapeHtml(proposal.tipo_evento || "Evento")} · ${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</small>
          <small><span class="status-chip${statusClass}">${escapeHtml(statusLabel)}</span>Salva em ${escapeHtml(formatSavedAt(proposal.created_at))}</small>
        </button>
      `;
    })
    .join("");
}

function normalizeRequestStatus(status) {
  const legacy = {
    novo: "lead_recebido",
    em_cotacao: "lead_recebido",
    analisado: "lead_recebido",
    qualificado: "lead_recebido",
    proposta_gerada: "proposta_enviada",
  };
  return legacy[status] || status || "lead_recebido";
}

function normalizeProposalStatus(status) {
  const legacy = {
    rascunho: "proposta_enviada",
    qualificado: "proposta_enviada",
    aguardando_sinal: "negociacao",
    pronto: "planejamento",
    pre_evento: "evento_proximo",
    evento_hoje_amanha: "evento_proximo",
    realizado: "pos_venda",
  };
  return legacy[status] || status || "proposta_enviada";
}

function getProposalStatusLabel(status) {
  const labels = {
    lead_recebido: "Lead",
    proposta_enviada: "Proposta sem resposta",
    negociacao: "Em negociação",
    confirmado: "Sinal recebido",
    pagamento_final: "Aguardando pagamento restante",
    planejamento: "Planejamento",
    evento_proximo: "Eventos hoje e amanhã",
    pos_venda: "Pós-venda",
    cancelado: "Cancelado",
  };
  return labels[normalizeProposalStatus(status)] || status || "Proposta enviada";
}

function renderConfirmedEvents() {
  renderPipeline();
}

function getClientFormUrl() {
  return CANONICAL_CLIENT_FORM_URL;
}

function renderClientFormLink() {
  if (!nodes.clientFormLink) return;
  nodes.clientFormLink.textContent = getClientFormUrl();
}

function getRequestStatusLabel(status) {
  return getProposalStatusLabel(normalizeRequestStatus(status));
}

function getPipelineStage(status) {
  const normalized = normalizeProposalStatus(status);
  return funnelStages.find((stage) => stage.statuses.includes(normalized))?.id || "lead_recebido";
}

function getLeadSegment(request) {
  const qualification = request.snapshot?.qualificacao || {};
  const eventSnapshot = request.snapshot?.evento || {};
  if (qualification.tipoCliente === "Agência de turismo receptivo / DMC") return qualification.tipoCliente;
  if (qualification.tipoCliente === "Agência de marketing / eventos") return qualification.tipoCliente;

  const text = [
    qualification.tipoCliente,
    qualification.origem,
    qualification.faixaInvestimento,
    request.cliente_nome,
    request.cliente_empresa,
    request.tipo_evento,
    eventSnapshot.ocasiao,
    eventSnapshot.formato,
    eventSnapshot.observacoes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const agencySignals = /\b(agencia|agency|dmc|receptiv|turismo|operadora|travel|tour|incoming|marketing|producao|ativacao)\b/;

  if (!agencySignals.test(text)) {
    return qualification.tipoCliente || "Cliente direto";
  }

  if (/\b(dmc|receptiv|turismo|operadora|travel|tour|incoming)\b/.test(text)) {
    return "Agência turismo/receptivo/DMC";
  }
  if (/\b(marketing|eventos|producao|ativacao|activation)\b/.test(text)) {
    return "Agência marketing/eventos";
  }
  if (text.includes("agencia") || text.includes("agency")) return "Agência a classificar";
  return qualification.tipoCliente || "Cliente direto";
}

function getFinalClientFromSnapshot(snapshot = {}) {
  return (
    snapshot?.cliente?.clienteFinal ||
    snapshot?.client?.finalClient ||
    snapshot?.qualificacao?.clienteFinal ||
    snapshot?.qualification?.finalClient ||
    ""
  );
}

function getGroupNameFromSnapshot(snapshot = {}) {
  return (
    snapshot?.cliente?.nomeGrupo ||
    snapshot?.client?.groupName ||
    snapshot?.qualificacao?.nomeGrupo ||
    snapshot?.qualification?.groupName ||
    ""
  );
}

function getPipelineItems() {
  const linkedRequests = new Set(state.proposals.map((proposal) => proposal.solicitacao_id).filter(Boolean));
  const requestItems = state.quoteRequests
    .filter((request) => !request.proposta_id && !linkedRequests.has(request.id))
    .map((request) => {
      const eventSnapshot = request.snapshot?.evento || {};
      const qualification = request.snapshot?.qualificacao || {};
      const status = normalizeRequestStatus(request.status);
      return {
        kind: "request",
        id: request.id,
        status,
        stage: getPipelineStage(status),
        name: request.cliente_nome || "Cliente",
        email: request.cliente_email || request.snapshot?.cliente?.email || "",
        phone: request.cliente_whatsapp || request.snapshot?.cliente?.whatsapp || "",
        company: request.empresa || request.cliente_empresa || request.snapshot?.cliente?.empresa || "",
        type: request.tipo_evento || eventSnapshot.tipo || "Evento",
        date: request.data_evento || eventSnapshot.data || "",
        time: request.horario_evento || eventSnapshot.horario || "",
        guests: request.convidados || eventSnapshot.convidados || 1,
        duration: Number(request.duracao || eventSnapshot.duracao || 1),
        total: null,
        createdAt: request.created_at,
        updatedAt: request.updated_at || request.created_at,
        reference: request.snapshot?.referencia || "",
        snapshot: request.snapshot || {},
        finalClient: getFinalClientFromSnapshot(request.snapshot || {}),
        groupName: getGroupNameFromSnapshot(request.snapshot || {}),
        clientType: getLeadSegment(request),
        meta: [getLeadSegment(request), qualification.faixaInvestimento, qualification.origem].filter(Boolean),
        cancelReason: request.snapshot?.cancelamento?.motivo || "",
        eventDate: parseLocalIsoDate(request.data_evento || eventSnapshot.data || ""),
      };
    });

  const proposalItems = state.proposals.map((proposal) => {
    const status = normalizeProposalStatus(proposal.status);
    const snapshot = proposal.snapshot || {};
    const paymentCoverage = getPaymentCoverage(proposal.total || snapshot.totals?.total || 0, snapshot.pagamentoSinal, snapshot.pagamentoRestante);
    return {
      kind: "proposal",
      id: proposal.id,
      status,
      stage: getPipelineStage(status),
      name: proposal.cliente_nome || "Cliente",
      email: proposal.cliente_email || snapshot.client?.email || snapshot.cliente?.email || "",
      phone: proposal.cliente_whatsapp || snapshot.client?.phone || snapshot.cliente?.whatsapp || "",
      company:
        proposal.empresa ||
        proposal.cliente_empresa ||
        snapshot.client?.company ||
        snapshot.cliente?.empresa ||
        "",
      type: proposal.tipo_evento || "Evento",
      date: proposal.data_evento || "",
      time: proposal.horario_evento || "",
      guests: proposal.convidados || 1,
      duration: Number(proposal.duracao || snapshot.event?.duration || 1),
      total: proposal.total || 0,
      privatizationAmount: proposal.privatizacao ?? snapshot.totals?.privatizationAmount ?? snapshot.totals?.privatization?.amount ?? 0,
      createdAt: proposal.created_at,
      updatedAt: proposal.updated_at || proposal.created_at,
      reference: snapshot.referencia || "",
      snapshot,
      finalClient: getFinalClientFromSnapshot(snapshot),
      groupName: getGroupNameFromSnapshot(snapshot),
      clientType: snapshot.qualificacao?.tipoCliente || "Cliente direto",
      hasSignalProof: Boolean(snapshot.pagamentoSinal?.comprovante?.nome),
      signalProof: snapshot.pagamentoSinal?.comprovante || null,
      hasRemainingPayment: Boolean(snapshot.pagamentoRestante),
      hasRemainingProof: Boolean(snapshot.pagamentoRestante?.comprovante?.nome),
      remainingProof: snapshot.pagamentoRestante?.comprovante || null,
      hasPaymentComplete: paymentCoverage.isFullyPaid,
      isSignalIntegral: paymentCoverage.isSignalIntegral,
      paymentPaidTotal: paymentCoverage.paidTotal,
      paymentRemainingDue: paymentCoverage.remainingDue,
      clientResponse: proposal.cliente_resposta || snapshot.clienteResposta?.acao || "",
      clientMessage: proposal.cliente_mensagem || snapshot.clienteResposta?.mensagem || "",
      clientRequest: proposal.cliente_solicitacao || snapshot.clienteResposta || null,
      clientResponseAt: proposal.cliente_resposta_em || snapshot.clienteResposta?.registradoEm || "",
      meta: [snapshot.qualificacao?.tipoCliente, snapshot.qualificacao?.faixaInvestimento].filter(Boolean),
      cancelReason: snapshot.cancelamento?.motivo || "",
      eventDate: parseLocalIsoDate(proposal.data_evento || ""),
    };
  });

  return [...requestItems, ...proposalItems].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function parseLocalIsoDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(start, offset);
}

function formatMonthYear(date) {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  return `${month} ${date.getFullYear()}`.toUpperCase();
}

function formatShortDayMonth(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatPeriodRange(start, endExclusive) {
  return `${formatShortDayMonth(start)} a ${formatShortDayMonth(addDays(endExclusive, -1))}`;
}

function formatMonthToYesterday(start, referenceDate) {
  const yesterday = addDays(startOfDay(referenceDate), -1);
  if (yesterday < start) return "1 até ontem";
  return `1 a ${yesterday.getDate()}`;
}

function getPeriodRanges(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const currentWeekStart = startOfWeek(today);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const lastWeekStart = addDays(currentWeekStart, -7);
  const nextWeekStart = addDays(currentWeekStart, 7);
  const nextWeekEnd = addDays(currentWeekStart, 14);
  return [
    {
      label: "Semana passada",
      detail: formatPeriodRange(lastWeekStart, currentWeekStart),
      start: lastWeekStart,
      end: currentWeekStart,
      source: "sold",
    },
    {
      label: "Semana atual",
      detail: formatPeriodRange(currentWeekStart, nextWeekStart),
      start: currentWeekStart,
      end: nextWeekStart,
      source: "sold",
    },
    {
      label: "Próxima semana",
      detail: formatPeriodRange(nextWeekStart, nextWeekEnd),
      start: nextWeekStart,
      end: nextWeekEnd,
      source: "sold",
    },
    {
      label: formatMonthYear(previousMonthStart),
      detail: formatPeriodRange(previousMonthStart, currentMonthStart),
      start: previousMonthStart,
      end: currentMonthStart,
      source: "sold",
    },
    {
      label: "No mês",
      detail: formatMonthToYesterday(currentMonthStart, today),
      start: currentMonthStart,
      end: today,
      source: "realized",
    },
    {
      label: formatMonthYear(currentMonthStart),
      detail: formatPeriodRange(currentMonthStart, nextMonthStart),
      start: currentMonthStart,
      end: nextMonthStart,
      source: "sold",
    },
    {
      label: formatMonthYear(nextMonthStart),
      detail: formatPeriodRange(nextMonthStart, nextMonthEnd),
      start: nextMonthStart,
      end: nextMonthEnd,
      source: "sold",
    },
  ];
}

function renderPeriodMetrics(items) {
  if (!nodes.periodMetrics) return;
  const soldEvents = items
    .filter((item) => item.kind === "proposal" && operationStatuses.has(normalizeProposalStatus(item.status)))
    .map((item) => ({ ...item, eventDate: parseLocalIsoDate(item.date) }))
    .filter((item) => item.eventDate);
  const realizedEvents = soldEvents.filter((item) => normalizeProposalStatus(item.status) === "pos_venda");

  nodes.periodMetrics.innerHTML = getPeriodRanges()
    .map((period) => {
      const sourceItems = period.source === "realized" ? realizedEvents : soldEvents;
      const periodItems = sourceItems.filter((item) => item.eventDate >= period.start && item.eventDate < period.end);
      const total = periodItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const average = periodItems.length ? total / periodItems.length : 0;
      return `
        <div class="period-metric-card">
          <span>${escapeHtml(period.label)} - ${escapeHtml(period.detail)}</span>
          <dl>
            <div><dt>Eventos</dt><dd>${periodItems.length}</dd></div>
            <div><dt>Valor</dt><dd>${formatMoney(total)}</dd></div>
            <div><dt>TKT médio</dt><dd>${formatMoney(average)}</dd></div>
          </dl>
        </div>
      `;
    })
    .join("");
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getReportStatus(item) {
  return item.kind === "request" ? normalizeRequestStatus(item.status) : normalizeProposalStatus(item.status);
}

function isSoldReportItem(item) {
  return item.kind === "proposal" && operationStatuses.has(normalizeProposalStatus(item.status));
}

function getReportDefinitions(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const currentWeekStart = startOfWeek(today);
  const nextWeekStart = addDays(currentWeekStart, 7);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const next48h = addDays(today, 2);
  return {
    lastMonth: {
      title: "Mês passado",
      detail: formatPeriodRange(previousMonthStart, currentMonthStart),
      filter: (item) => isSoldReportItem(item) && item.eventDate >= previousMonthStart && item.eventDate < currentMonthStart,
    },
    currentMonth: {
      title: "Mês atual",
      detail: formatPeriodRange(currentMonthStart, nextMonthStart),
      filter: (item) => isSoldReportItem(item) && item.eventDate >= currentMonthStart && item.eventDate < nextMonthStart,
    },
    awaitingResponse: {
      title: "Propostas a responder",
      detail: "Sem resposta do cliente",
      filter: (item) => item.kind === "proposal" && getReportStatus(item) === "proposta_enviada",
    },
    negotiation: {
      title: "Propostas em negociação",
      detail: "Ajustes comerciais em andamento",
      filter: (item) => item.kind === "proposal" && getReportStatus(item) === "negociacao",
    },
    approvedAwaitingSignal: {
      title: "Aprovadas aguardando sinal",
      detail: "Cliente quer seguir; falta registrar sinal",
      filter: (item) =>
        item.kind === "proposal" &&
        item.clientResponse === "confirmar" &&
        ["proposta_enviada", "negociacao"].includes(getReportStatus(item)),
    },
    signalAwaitingFinal: {
      title: "Sinal pago aguardando saldo",
      detail: "Venda concluída; saldo ainda pendente",
      filter: (item) => item.kind === "proposal" && getReportStatus(item) === "confirmado" && !item.hasPaymentComplete,
    },
    awaitingPlanning: {
      title: "Eventos aguardando planejamento",
      detail: "Pagamento restante registrado; operação deve preparar",
      filter: (item) => item.kind === "proposal" && getReportStatus(item) === "planejamento",
    },
    next48h: {
      title: "Eventos próximas 48h",
      detail: `${formatShortDayMonth(today)} a ${formatShortDayMonth(next48h)}`,
      filter: (item) =>
        isSoldReportItem(item) &&
        item.eventDate &&
        item.eventDate >= today &&
        item.eventDate <= next48h,
    },
    currentWeek: {
      title: "Eventos da semana",
      detail: formatPeriodRange(currentWeekStart, nextWeekStart),
      filter: (item) => isSoldReportItem(item) && item.eventDate >= currentWeekStart && item.eventDate < nextWeekStart,
    },
  };
}

function getReportItems(items) {
  return items.map((item) => ({ ...item, eventDate: parseLocalIsoDate(item.date) }));
}

function getCustomReportConfig() {
  const start = fields.reportStartDate?.value ? parseLocalIsoDate(fields.reportStartDate.value) : null;
  const end = fields.reportEndDate?.value ? addDays(parseLocalIsoDate(fields.reportEndDate.value), 1) : null;
  const status = fields.reportStatusFilter?.value || "";
  const kind = fields.reportKindFilter?.value || "";
  const detailParts = [
    start ? `desde ${formatDateFromIso(fields.reportStartDate.value)}` : "",
    end ? `até ${formatDateFromIso(fields.reportEndDate.value)}` : "",
    status ? getProposalStatusLabel(status) : "Todas as etapas",
    kind ? (kind === "request" ? "Leads" : "Propostas/eventos") : "Leads e propostas",
  ].filter(Boolean);
  return {
    title: "Relatório customizado",
    detail: detailParts.join(" · "),
    filter: (item) => {
      if (kind && item.kind !== kind) return false;
      if (status && getReportStatus(item) !== status) return false;
      if (start || end) {
        if (!item.eventDate) return false;
        if (start && item.eventDate < start) return false;
        if (end && item.eventDate >= end) return false;
      }
      return true;
    },
  };
}

function getActiveReportConfig() {
  if (state.activeReportPreset === "custom") return getCustomReportConfig();
  return getReportDefinitions()[state.activeReportPreset] || getReportDefinitions().currentMonth;
}

function renderReportItem(item) {
  const openButton =
    item.kind === "proposal"
      ? `<button class="primary report-open-button" type="button" data-proposal-id="${escapeHtml(item.id)}">Abrir</button>`
      : `<button class="primary report-open-button" type="button" data-use-request="${escapeHtml(item.id)}">Abrir</button>`;
  return `
    <article class="report-item">
      <div>
        <strong>${escapeHtml(item.name || "Cliente")}</strong>
        <span>${escapeHtml(item.type || "Evento")} · ${escapeHtml(item.date ? formatDateFromIso(item.date) : "Data a definir")} · ${escapeHtml(item.time ? String(item.time).slice(0, 5) : "Horário a definir")} · ${escapeHtml(String(item.guests || 0))} pax</span>
        <small>${escapeHtml(getProposalStatusLabel(getReportStatus(item)))}${item.clientType ? ` · ${escapeHtml(item.clientType)}` : ""}</small>
      </div>
      <div>
        <b>${item.total ? formatMoney(item.total) : "Sem valor"}</b>
        ${renderPipelineValueBreakdown(item, "report-value-breakdown")}
        ${openButton}
      </div>
    </article>
  `;
}

function getTopReportLabel(items, getter, fallback = "Sem dado suficiente") {
  const counts = new Map();
  items.forEach((item) => {
    const label = getter(item);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  if (!counts.size) return fallback;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0].join(" · ");
}

function getReportActionInsight({ config, reportItems, proposalItems, soldItems }) {
  const statusCounts = reportItems.reduce((acc, item) => {
    const status = getReportStatus(item);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const canceled = statusCounts.cancelado || 0;
  const awaiting = statusCounts.proposta_enviada || 0;
  const negotiation = statusCounts.negociacao || 0;
  const confirmed = statusCounts.confirmado || 0;
  const conversion = proposalItems.length ? Math.round((soldItems.length / proposalItems.length) * 100) : 0;
  let nextAction = "Use este relatório para abrir os itens mais recentes e registrar o próximo passo.";

  if (config.title.toLowerCase().includes("responder") || awaiting) {
    nextAction = "Priorize retorno: propostas sem resposta perdem força depois de 24h.";
  } else if (config.title.toLowerCase().includes("negociação") || negotiation) {
    nextAction = "Feche a próxima ação da negociação: ajuste, aprovação ou sinal.";
  } else if (config.title.toLowerCase().includes("sinal") || confirmed) {
    nextAction = "Confira saldo, comprovantes e planejamento para não deixar venda parada.";
  } else if (config.title.toLowerCase().includes("48h")) {
    nextAction = "Revise operação, cardápio, responsáveis e horário final do evento.";
  } else if (canceled) {
    nextAction = "Leia os motivos de cancelamento para ajustar preço, produto ou abordagem.";
  }

  return {
    conversion,
    topType: getTopReportLabel(reportItems, (item) => item.type),
    topClientType: getTopReportLabel(reportItems, (item) => item.clientType || "Cliente direto"),
    nextAction,
  };
}

function renderDashboardReports(items = getPipelineItems()) {
  if (!nodes.reportOutput) return;
  const prepared = getReportItems(items);
  const config = getActiveReportConfig();
  const reportItems = prepared
    .filter(config.filter)
    .sort((a, b) => {
      const dateA = a.eventDate?.getTime() || new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = b.eventDate?.getTime() || new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  const proposalItems = reportItems.filter((item) => item.kind === "proposal");
  const soldItems = reportItems.filter(isSoldReportItem);
  const total = proposalItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const average = proposalItems.length ? total / proposalItems.length : 0;
  const insight = getReportActionInsight({ config, reportItems, proposalItems, soldItems });

  nodes.reportPresets?.querySelectorAll("[data-report-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.reportPreset === state.activeReportPreset);
  });

  nodes.reportOutput.innerHTML = `
    <div class="report-summary">
      <div>
        <span>${escapeHtml(config.title)}</span>
        <strong>${escapeHtml(config.detail || "Visão rápida")}</strong>
      </div>
      <dl>
        <div><dt>Total</dt><dd>${reportItems.length}</dd></div>
        <div><dt>Eventos</dt><dd>${soldItems.length}</dd></div>
        <div><dt>Valor</dt><dd>${formatMoney(total)}</dd></div>
        <div><dt>TKT médio</dt><dd>${formatMoney(average)}</dd></div>
      </dl>
    </div>
    <div class="report-insights">
      <article>
        <span>Próxima ação</span>
        <strong>${escapeHtml(insight.nextAction)}</strong>
      </article>
      <article>
        <span>Conversão da visão</span>
        <strong>${escapeHtml(String(insight.conversion))}%</strong>
      </article>
      <article>
        <span>Formato mais presente</span>
        <strong>${escapeHtml(insight.topType)}</strong>
      </article>
      <article>
        <span>Perfil mais comum</span>
        <strong>${escapeHtml(insight.topClientType)}</strong>
      </article>
    </div>
    <div class="report-list">
      ${reportItems.length ? reportItems.slice(0, 14).map(renderReportItem).join("") : `<p>Nenhum item neste relatório.</p>`}
    </div>
  `;
}

function selectReportPreset(preset) {
  state.activeReportPreset = preset;
  renderDashboardReports(getPipelineItems());
}

function applyCustomReport() {
  state.activeReportPreset = "custom";
  renderDashboardReports(getPipelineItems());
}

function initializeReportDefaults() {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today);
  if (fields.reportStartDate && !fields.reportStartDate.value) fields.reportStartDate.value = toDateInputValue(weekStart);
  if (fields.reportEndDate && !fields.reportEndDate.value) fields.reportEndDate.value = toDateInputValue(addDays(weekStart, 6));
}

function renderPipelineMetrics(items = getPipelineItems()) {
  renderGlobalSearch(items);
  renderClientRegistry(items);
  if (!nodes.metricStageLead) return;
  const counts = {
    lead: 0,
    semResposta: 0,
    negociacao: 0,
    sinal: 0,
    pgRestante: 0,
    planejamento: 0,
    quarentaOito: 0,
    posVenda: 0,
  };

  items.forEach((item) => {
    const status = item.kind === "request" ? normalizeRequestStatus(item.status) : normalizeProposalStatus(item.status);
    if (item.kind === "request" && status === "lead_recebido") counts.lead += 1;
    if (item.kind !== "proposal") return;
    if (status === "proposta_enviada") counts.semResposta += 1;
    if (status === "negociacao") counts.negociacao += 1;
    if (status === "confirmado") counts.sinal += 1;
    if (status === "pagamento_final") counts.pgRestante += 1;
    if (status === "planejamento") counts.planejamento += 1;
    if (status === "evento_proximo") counts.quarentaOito += 1;
    if (status === "pos_venda") counts.posVenda += 1;
  });

  nodes.metricStageLead.textContent = String(counts.lead);
  nodes.metricStageSemResposta.textContent = String(counts.semResposta);
  nodes.metricStageNegociacao.textContent = String(counts.negociacao);
  nodes.metricStageSinal.textContent = String(counts.sinal);
  nodes.metricStagePgRestante.textContent = String(counts.pgRestante);
  nodes.metricStagePlanejamento.textContent = String(counts.planejamento);
  nodes.metricStage48h.textContent = String(counts.quarentaOito);
  nodes.metricStagePosVenda.textContent = String(counts.posVenda);
  renderPeriodMetrics(items);
  renderActionTasks(items);
  renderDashboardReports(items);
}

function getProposalTransitionOptions(currentStatus) {
  const status = normalizeProposalStatus(currentStatus);
  if (status === "cancelado") return ["cancelado", "negociacao"];
  return ["proposta_enviada", "negociacao", "confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"];
}

function renderStatusSelect(item) {
  const options = item.kind === "request" ? requestStatusOptions : getProposalTransitionOptions(item.status);
  return `
    <details class="pipeline-status-control">
      <summary title="Mudar etapa deste registro">Mudar etapa</summary>
      <label>
        Etapa
        <select data-pipeline-status-kind="${escapeHtml(item.kind)}" data-pipeline-status-id="${escapeHtml(item.id)}">
          ${options
            .map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${escapeHtml(getProposalStatusLabel(status))}</option>`)
            .join("")}
        </select>
      </label>
    </details>
  `;
}

function getLeadAgeInfo(item) {
  if (item.kind !== "request" || item.status !== "lead_recebido" || !item.createdAt) return null;
  const created = new Date(item.createdAt);
  const elapsed = Date.now() - created.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const hours = Math.floor(elapsed / 36e5);
  const label = hours < 1 ? "Recebido há menos de 1h" : `Recebido há ${hours}h`;
  const level = hours >= 48 ? "critical" : hours >= 24 ? "danger" : hours >= 12 ? "warning" : "fresh";
  return { label, level };
}

function getProposalFollowUpInfo(item) {
  if (item.kind !== "proposal" || normalizeProposalStatus(item.status) !== "proposta_enviada") return null;
  const hours = getHoursSince(item.updatedAt || item.createdAt);
  if (hours < 24) return null;
  const level = hours >= 72 ? "critical" : hours >= 48 ? "danger" : "warning";
  const label = `Sem retorno há ${hours}h`;
  const actionLabel = hours >= 72 ? "Retomar contato agora" : hours >= 48 ? "Retomar contato hoje" : "Checar retorno hoje";
  const note =
    hours >= 72
      ? "Reenvie o link ou ligue para destravar a decisão."
      : hours >= 48
        ? "A proposta esfriou. Vale uma abordagem curta e objetiva."
        : "Cliente ainda não respondeu. Faça um toque leve.";
  return { label, level, actionLabel, note };
}

function getPipelinePrimaryAction(item) {
  const status = getReportStatus(item);
  const age = getLeadAgeInfo(item);
  const followUp = getProposalFollowUpInfo(item);
  if (item.kind === "request" && status === "lead_recebido") {
    return {
      tone: age && ["danger", "critical"].includes(age.level) ? "danger" : age?.level === "warning" ? "warning" : "fresh",
      eyebrow: "Próxima ação",
      label: age && age.level !== "fresh" ? "Responder agora" : "Criar proposta",
      note: age && age.level !== "fresh" ? "Lead esfriando. Abra, revise e envie proposta." : "Qualifique e monte a primeira proposta.",
    };
  }
  if (status === "proposta_enviada") {
    if (item.clientResponse === "confirmar") {
      return { tone: "success", eyebrow: "Cliente aprovou", label: "Registrar sinal", note: "Enviar dados bancários e registrar pagamento." };
    }
    return {
      tone: followUp?.level || "fresh",
      eyebrow: followUp ? "Retorno pendente" : "Próxima ação",
      label: followUp?.actionLabel || "Aguardar retorno",
      note: "Monitorar retorno cliente",
    };
  }
  if (status === "negociacao") {
    return { tone: item.clientResponse === "alteracao" ? "warning" : "warm", eyebrow: "Negociação", label: "Ajustar e reenviar", note: "Registrar combinado e deixar próximo passo claro." };
  }
  if (status === "confirmado") {
    return {
      tone: item.hasPaymentComplete ? "success" : "warning",
      eyebrow: "Financeiro",
      label: item.hasPaymentComplete ? "Enviar para planejamento" : "Cobrar saldo",
      note: item.hasPaymentComplete ? "Pagamento completo. Próximo passo é operação." : "Venda fechada, mas ainda falta saldo final.",
    };
  }
  if (status === "pagamento_final") {
    return { tone: item.hasRemainingProof ? "success" : "warning", eyebrow: "Financeiro", label: item.hasRemainingProof ? "Planejar evento" : "Anexar comprovante", note: "Fechar pagamento antes de avançar operação." };
  }
  if (status === "planejamento") {
    return { tone: "operation", eyebrow: "Operação", label: "Fechar checklist", note: "Cardápio, extras, responsáveis e observações." };
  }
  if (status === "evento_proximo") {
    return { tone: "operation", eyebrow: "48h", label: "Revisão final", note: "Conferir execução, horário e responsável do dia." };
  }
  if (status === "pos_venda") {
    return { tone: "client", eyebrow: "Relacionamento", label: "Registrar retorno", note: "Pedir feedback e mapear próxima oportunidade." };
  }
  if (status === "cancelado") {
    return { tone: "muted", eyebrow: "Encerrado", label: item.cancelReason || "Cancelado", note: "Motivo registrado para aprendizado comercial." };
  }
  return { tone: "fresh", eyebrow: "Próxima ação", label: "Abrir registro", note: "Revisar dados e definir caminho." };
}

function getPipelineRiskAlerts(item) {
  const alerts = [];
  const status = getReportStatus(item);
  const daysUntil = getDaysUntilEvent(item);
  const age = getLeadAgeInfo(item);
  const score = getCommercialScore(item);

  if (age && age.level !== "fresh") {
    alerts.push({ level: age.level, label: age.level === "critical" ? "Lead 48h+" : age.level === "danger" ? "Lead 24h+" : "Lead 12h+" });
  }
  if (item.clientResponse === "confirmar") {
    alerts.push({ level: "success", label: "Cliente aprovou" });
  }
  if (daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && !operationStatuses.has(status)) {
    alerts.push({ level: "danger", label: `Evento em ${daysUntil || "hoje"}` });
  } else if (daysUntil !== null && daysUntil >= 0 && daysUntil <= 14) {
    alerts.push({ level: "warning", label: `Janela ${daysUntil}d` });
  }
  if (status === "confirmado" && !item.hasPaymentComplete) {
    alerts.push({ level: "warning", label: "Falta saldo" });
  }
  if (status === "planejamento" && hasIncompleteChecklist(item.snapshot || {})) {
    alerts.push({ level: "warning", label: "Checklist aberto" });
  }
  if (score.level === "high") {
    alerts.push({ level: "success", label: "Oportunidade alta" });
  }

  const priority = { critical: 5, danger: 4, warning: 3, success: 2, fresh: 1 };
  const seen = new Set();
  return alerts
    .filter((alert) => {
      const key = normalizeSearchValue(alert.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (priority[b.level] || 0) - (priority[a.level] || 0))
    .slice(0, 2);
}

function getSlaMeta(item) {
  const status = getReportStatus(item);
  if (item.kind === "request" && status === "lead_recebido") {
    const hours = getHoursSince(item.createdAt);
    const nextLimit = hours < 12 ? "12h" : hours < 24 ? "24h" : hours < 48 ? "48h" : "estourado";
    const level = hours >= 48 ? "critical" : hours >= 24 ? "danger" : hours >= 12 ? "warning" : "fresh";
    return {
      label: `Tempo sem resposta: ${hours || "<1"}h · limite ${nextLimit}`,
      level,
    };
  }
  if (item.kind === "proposal" && status === "proposta_enviada") {
    const hours = getHoursSince(item.updatedAt || item.createdAt);
    const nextLimit = hours < 24 ? "24h" : hours < 48 ? "48h" : hours < 72 ? "72h" : "estourado";
    const level = hours >= 72 ? "critical" : hours >= 48 ? "danger" : hours >= 24 ? "warning" : "fresh";
    return {
      label: `Sem retorno há ${hours || "<1"}h · limite ${nextLimit}`,
      level,
    };
  }
  if (item.kind === "proposal" && status === "confirmado") {
    return item.hasPaymentComplete
      ? { label: "Pagamento completo: enviar para planejamento", level: "success" }
      : { label: "Atenção financeira: cobrar saldo restante", level: "warning" };
  }
  return null;
}

function getDaysUntilEvent(item) {
  const date = item.eventDate || parseLocalIsoDate(item.date || "");
  if (!date) return null;
  return Math.ceil((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 864e5);
}

function getInvestmentWeight(item) {
  const text = [item.meta?.join(" "), item.snapshot?.qualificacao?.faixaInvestimento, item.snapshot?.qualification?.budgetRange]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/acima|above|60/.test(text)) return { points: 22, label: "Investimento alto" };
  if (/30/.test(text)) return { points: 16, label: "Investimento forte" };
  if (/15/.test(text)) return { points: 10, label: "Investimento mapeado" };
  return { points: 0, label: "" };
}

function getCommercialScore(item) {
  const reasons = [];
  let score = 28;
  const guests = Number(item.guests) || 0;
  const daysUntil = getDaysUntilEvent(item);
  const investment = getInvestmentWeight(item);
  const clientType = String(item.clientType || item.meta?.[0] || "").toLowerCase();
  const status = getReportStatus(item);

  if (investment.points) {
    score += investment.points;
    reasons.push(investment.label);
  }
  if (guests >= 80) {
    score += 18;
    reasons.push(`${guests} pax`);
  } else if (guests >= 40) {
    score += 12;
    reasons.push(`${guests} pax`);
  } else if (guests >= 20) {
    score += 7;
  }
  if (/ag[êe]ncia|dmc|marketing|empresa/.test(clientType)) {
    score += 12;
    reasons.push(/ag[êe]ncia|dmc|marketing/.test(clientType) ? "Agência" : "Empresa");
  }
  if (daysUntil !== null) {
    if (daysUntil >= 0 && daysUntil <= 14) {
      score += 18;
      reasons.push("Data próxima");
    } else if (daysUntil <= 45) {
      score += 10;
      reasons.push("Janela ativa");
    }
  }
  if (item.kind === "request") {
    const ageHours = getHoursSince(item.createdAt);
    if (ageHours >= 24) {
      score += 10;
      reasons.push("Resposta urgente");
    } else if (ageHours >= 12) {
      score += 6;
    }
  }
  if (["negociacao", "confirmado", "pagamento_final"].includes(status)) score += 10;
  if (item.clientResponse === "confirmar") {
    score += 18;
    reasons.push("Cliente aprovou");
  }

  const value = Math.max(0, Math.min(99, Math.round(score)));
  const level = value >= 80 ? "high" : value >= 60 ? "good" : value >= 45 ? "warm" : "base";
  const label = value >= 80 ? "Prioridade alta" : value >= 60 ? "Boa oportunidade" : value >= 45 ? "Acompanhar" : "Mapear";
  return { value, level, label, reasons: reasons.slice(0, 3) };
}

function getHoursSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.floor(elapsed / 36e5);
}

function getChecklistProgress(snapshot = {}) {
  const checklist = snapshot.operationalChecklist || {};
  const done = operationalChecklistItems.filter((item) => checklist[item.id]).length;
  return { done, total: operationalChecklistItems.length };
}

function getActionPriorityClass(priority) {
  if (priority >= 90) return "critical";
  if (priority >= 70) return "danger";
  if (priority >= 45) return "warning";
  return "normal";
}

function getActionTrack(task) {
  if (task.track) return task.track;
  if (task.priority >= 90) return "Agora";
  if (task.priority >= 70) return "Comercial";
  if (task.priority >= 45) return "Operação";
  return "Acompanhar";
}

function getActionUrgencyLabel(priority) {
  if (priority >= 90) return "Agora";
  if (priority >= 70) return "Hoje";
  if (priority >= 45) return "Em seguida";
  return "Acompanhar";
}

function getPipelineQuickFilterDefinitions() {
  const today = startOfDay(new Date());
  const next7Days = addDays(today, 7);
  return [
    {
      id: "all",
      label: "Tudo",
      matches: () => true,
    },
    {
      id: "lead_recebido",
      label: "Leads",
      matches: (item) => getReportStatus(item) === "lead_recebido",
    },
    {
      id: "proposta_enviada",
      label: "Sem resposta",
      matches: (item) => getReportStatus(item) === "proposta_enviada",
    },
    {
      id: "negociacao",
      label: "Negociação",
      matches: (item) => getReportStatus(item) === "negociacao",
    },
    {
      id: "urgent",
      label: "Alta urgência",
      matches: (item) => {
        const status = getReportStatus(item);
        if (item.kind === "request") {
          const age = getLeadAgeInfo(item);
          return age && ["warning", "danger", "critical"].includes(age.level);
        }
        if (getProposalFollowUpInfo(item)) return true;
        if (item.clientResponse === "confirmar" && ["proposta_enviada", "negociacao"].includes(status)) return true;
        return isSoldReportItem(item) && item.eventDate && item.eventDate >= today && item.eventDate <= addDays(today, 2);
      },
    },
    {
      id: "highScore",
      label: "Score alto",
      matches: (item) => getCommercialScore(item).value >= 80,
    },
    {
      id: "noProposal",
      label: "Sem proposta",
      matches: (item) => item.kind === "request" && getReportStatus(item) === "lead_recebido",
    },
    {
      id: "approved",
      label: "Aprovou",
      matches: (item) =>
        item.kind === "proposal" &&
        item.clientResponse === "confirmar" &&
        ["proposta_enviada", "negociacao"].includes(getReportStatus(item)),
    },
    {
      id: "awaitingSignal",
      label: "Falta sinal",
      matches: (item) =>
        item.kind === "proposal" &&
        ["proposta_enviada", "negociacao"].includes(getReportStatus(item)) &&
        !item.snapshot?.pagamentoSinal,
    },
    {
      id: "awaitingRemaining",
      label: "Falta saldo",
      matches: (item) => item.kind === "proposal" && getReportStatus(item) === "confirmado" && !item.hasPaymentComplete,
    },
    {
      id: "missingProof",
      label: "Sem comprovante",
      matches: (item) =>
        item.kind === "proposal" &&
        ((item.snapshot?.pagamentoSinal && !item.hasSignalProof) || (item.hasRemainingPayment && !item.hasRemainingProof)),
    },
    {
      id: "next7days",
      label: "Próximos 7 dias",
      matches: (item) => item.eventDate && item.eventDate >= today && item.eventDate <= next7Days,
    },
    {
      id: "agency",
      label: "Agências",
      matches: (item) => /ag[êe]ncia/i.test(item.clientType || ""),
    },
    {
      id: "company",
      label: "Empresas",
      matches: (item) => /empresa/i.test(item.clientType || ""),
    },
  ];
}

function getFilteredPipelineItems(items = getPipelineItems()) {
  const activeFilter = state.activePipelineFilter || "all";
  const definition = getPipelineQuickFilterDefinitions().find((filter) => filter.id === activeFilter);
  if (activeFilter === "all") return items;
  if (!definition) {
    const stage = funnelStages.find((item) => item.id === activeFilter);
    return stage ? items.filter((item) => item.stage === stage.id) : items;
  }
  return items.filter((item) => definition.matches(item));
}

function getActivePipelineFilterLabel() {
  const activeFilter = state.activePipelineFilter || "all";
  if (activeFilter === "all") return "";
  const definition = getPipelineQuickFilterDefinitions().find((filter) => filter.id === activeFilter);
  if (definition) return definition.label;
  const stage = funnelStages.find((item) => item.id === activeFilter);
  return stage?.title || "";
}

function renderPipelineQuickFilters(items = getPipelineItems()) {
  if (!nodes.pipelineQuickFilters) return;
  const definitions = getPipelineQuickFilterDefinitions();
  const activeLabel = getActivePipelineFilterLabel();
  const activeNotice =
    activeLabel && state.activePipelineFilter !== "all"
      ? `<button class="pipeline-active-filter" type="button" data-pipeline-filter="all"><span>Mostrando: ${escapeHtml(activeLabel)}</span><b>limpar</b></button>`
      : "";
  nodes.pipelineQuickFilters.innerHTML =
    activeNotice +
    definitions
    .map((filter) => {
      const total = items.filter((item) => filter.matches(item)).length;
      return `
        <button
          class="${state.activePipelineFilter === filter.id ? "is-active" : ""}"
          type="button"
          data-pipeline-filter="${escapeHtml(filter.id)}"
        >
          <span>${escapeHtml(filter.label)}</span>
          <b>${total}</b>
        </button>
      `;
    })
    .join("");
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchDateVariants(value) {
  if (!value) return [];
  const iso = String(value).slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return [iso];
  const [, year, month, day] = match;
  return [iso, `${day}/${month}/${year}`, `${day}/${month}`, `${day}${month}${year}`, `${day}${month}`];
}

function getItemSearchText(item) {
  const phoneDigits = String(item.phone || "").replace(/\D/g, "");
  const dateVariants = getSearchDateVariants(item.date);
  return normalizeSearchValue(
    [
      item.name,
      item.company,
      item.finalClient,
      item.groupName,
      item.email,
      item.phone,
      phoneDigits,
      item.type,
      item.clientType,
      item.reference,
      item.date,
      ...dateVariants,
      item.date ? formatDateFromIso(item.date) : "",
      item.time,
      item.guests ? `${item.guests} pax` : "",
      item.meta?.join(" "),
      item.status ? getProposalStatusLabel(item.status) : "",
      item.snapshot?.qualificacao?.origem,
      item.snapshot?.qualificacao?.faixaInvestimento,
      item.snapshot?.qualificacao?.clienteFinal,
      item.snapshot?.qualificacao?.nomeGrupo,
      item.snapshot?.cliente?.clienteFinal,
      item.snapshot?.cliente?.nomeGrupo,
      item.snapshot?.evento?.ocasiao,
      item.snapshot?.evento?.observacoes,
    ].filter(Boolean).join(" "),
  );
}

function getClientRegistry(items = getPipelineItems()) {
  const registry = new Map();
  items.forEach((item) => {
    const emailKey = normalizeSearchValue(item.email);
    const phoneKey = String(item.phone || "").replace(/\D/g, "");
    const companyKey = normalizeSearchValue(item.company);
    const nameKey = normalizeSearchValue(item.name);
    const key = emailKey || phoneKey || companyKey || nameKey || item.id;
    const current = registry.get(key) || {
      key,
      name: item.name || "Cliente",
      company: item.company || "",
      email: item.email || "",
      phone: item.phone || "",
      clientType: item.clientType || "",
      items: [],
      totalValue: 0,
      soldCount: 0,
      lastUpdated: item.updatedAt || item.createdAt || "",
      searchText: "",
    };
    current.name = current.name || item.name || "Cliente";
    current.company = current.company || item.company || "";
    current.email = current.email || item.email || "";
    current.phone = current.phone || item.phone || "";
    current.clientType = current.clientType || item.clientType || "";
    current.items.push(item);
    if (item.kind === "proposal" && Number(item.total)) current.totalValue += Number(item.total);
    if (item.kind === "proposal" && operationStatuses.has(normalizeProposalStatus(item.status))) current.soldCount += 1;
    if (new Date(item.updatedAt || item.createdAt || 0) > new Date(current.lastUpdated || 0)) {
      current.lastUpdated = item.updatedAt || item.createdAt || "";
    }
    registry.set(key, current);
  });
  return [...registry.values()]
    .map((client) => ({
      ...client,
      searchText: normalizeSearchValue(
        [
          client.name,
          client.company,
          client.email,
          client.phone,
          String(client.phone || "").replace(/\D/g, ""),
          client.clientType,
          client.items.map((item) => getItemSearchText(item)).join(" "),
        ].join(" "),
      ),
    }))
    .sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
}

function renderClientRegistry(items = getPipelineItems()) {
  if (!nodes.clientDirectory) return;
  const clients = getClientRegistry(items);
  const term = normalizeSearchValue(fields.globalSearchInput?.value || "");
  const filtered = term ? clients.filter((client) => client.searchText.includes(term)) : clients;
  const maxClients = document.body?.dataset?.page === "clientes" ? 24 : 6;
  if (nodes.clientRegistryMeta) {
    const recurring = clients.filter((client) => client.items.length > 1).length;
    nodes.clientRegistryMeta.textContent = `${clients.length} cliente(s) · ${recurring} com histórico`;
  }
  if (!clients.length) {
    nodes.clientDirectory.innerHTML = `<p>Nenhum cliente carregado ainda.</p>`;
    return;
  }
  nodes.clientDirectory.innerHTML = filtered.slice(0, maxClients).map(renderClientRegistryCard).join("") || `<p>Nenhum cliente encontrado.</p>`;
}

function getClientCommercialProfile({ latest, openQuoteItems, confirmedItems, realizedItems, canceledItems }) {
  if (realizedItems.length) {
    return {
      tone: "realized",
      label: "Cliente com evento realizado",
      detail: "Histórico forte. Vale nutrir para nova data, agência ou indicação.",
    };
  }
  if (confirmedItems.length) {
    return {
      tone: "confirmed",
      label: "Venda em andamento",
      detail: "Acompanhe pagamento, planejamento e execução para proteger a experiência.",
    };
  }
  if (openQuoteItems.length >= 2) {
    return {
      tone: "hot",
      label: "Cliente recorrente em cotação",
      detail: "Mais de uma oportunidade aberta. Priorize acompanhamento consultivo.",
    };
  }
  if (latest?.kind === "proposal" && normalizeProposalStatus(latest.status) === "negociacao") {
    return {
      tone: "hot",
      label: "Negociação ativa",
      detail: "Ajuste pendências e conduza para sinal com próximo passo claro.",
    };
  }
  if (canceledItems.length && !openQuoteItems.length) {
    return {
      tone: "canceled",
      label: "Histórico sem venda",
      detail: "Mantenha motivo do cancelamento para reativar com proposta melhor no futuro.",
    };
  }
  return {
    tone: "quote",
    label: "Novo relacionamento",
    detail: "Use o histórico para qualificar rápido e enviar uma proposta certeira.",
  };
}

function renderClientRegistryCard(client) {
  const latest = client.items[0];
  const latestButton =
    latest.kind === "proposal"
      ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(latest.id)}">Abrir último</button>`
      : `<button class="secondary" type="button" data-use-request="${escapeHtml(latest.id)}">Abrir último</button>`;
  const realizedItems = client.items.filter((item) => item.kind === "proposal" && normalizeProposalStatus(item.status) === "pos_venda");
  const confirmedItems = client.items.filter((item) => item.kind === "proposal" && operationStatuses.has(normalizeProposalStatus(item.status)) && normalizeProposalStatus(item.status) !== "pos_venda");
  const quoteItems = client.items.filter((item) => item.kind !== "proposal" || !operationStatuses.has(normalizeProposalStatus(item.status)));
  const canceledItems = client.items.filter((item) => getReportStatus(item) === "cancelado");
  const openQuoteItems = quoteItems.filter((item) => getReportStatus(item) !== "cancelado");
  const realizedValue = realizedItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const confirmedValue = confirmedItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const quoteValue = openQuoteItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalRelationshipValue = realizedValue + confirmedValue;
  const profile = getClientCommercialProfile({ latest, openQuoteItems, confirmedItems, realizedItems, canceledItems });
  const lastInteraction = latest.updatedAt || latest.createdAt || client.lastUpdated;
  const footerLabel = realizedValue
    ? `Realizado: ${formatMoney(realizedValue)}`
    : confirmedValue
      ? `Confirmado: ${formatMoney(confirmedValue)}`
      : "Sem evento realizado";
  const summaryLabel = formatClientRegistrySummary(quoteItems.length, confirmedItems.length, realizedItems.length);
  const nextAction = getClientNextAction(latest);
  const history = client.items
    .slice(0, 3)
    .map((item) => {
      const eventKind = getClientHistoryKind(item);
      return `
        <li>
          <span class="client-history-chip client-history-${escapeHtml(eventKind.tone)}">${escapeHtml(eventKind.label)}</span>
          <small>${escapeHtml(
            [
              item.date ? formatDateFromIso(item.date) : "Data a definir",
              item.type || "Evento",
              item.finalClient ? `Cliente final: ${item.finalClient}` : "",
              item.groupName ? `Grupo: ${item.groupName}` : "",
              getProposalStatusLabel(item.status),
            ]
              .filter(Boolean)
              .join(" · "),
          )}</small>
        </li>
      `;
    })
    .join("");
  return `
    <article class="client-registry-card">
      <div class="client-registry-topline">
        <span>${escapeHtml(client.clientType || "Cliente")}</span>
        <strong>${escapeHtml(client.items.length)} registro(s)</strong>
      </div>
      <div class="client-registry-main">
        <strong>${escapeHtml(client.name)}</strong>
        <small>${escapeHtml([client.company, client.email, client.phone].filter(Boolean).join(" · ") || "Sem contato completo")}</small>
      </div>
      <div class="client-registry-metrics" aria-label="Resumo do cliente">
        <span><b>${openQuoteItems.length}</b><small>Cotações abertas</small></span>
        <span><b>${confirmedItems.length}</b><small>Confirmados</small></span>
        <span><b>${realizedItems.length}</b><small>Realizados</small></span>
        <span><b>${canceledItems.length}</b><small>Cancelados</small></span>
      </div>
      <div class="client-registry-summary">${escapeHtml(summaryLabel)}</div>
      <div class="client-registry-profile client-profile-${escapeHtml(profile.tone)}">
        <span>${escapeHtml(profile.label)}</span>
        <strong>${escapeHtml(profile.detail)}</strong>
      </div>
      <div class="client-registry-commerce">
        <span>Cotado: ${formatMoney(quoteValue)}</span>
        <span>Vendido: ${formatMoney(totalRelationshipValue)}</span>
        <span>Último contato: ${escapeHtml(formatSavedAt(lastInteraction))}</span>
      </div>
      <div class="client-registry-next">
        <span>Próximo passo</span>
        <strong>${escapeHtml(nextAction)}</strong>
      </div>
      <ul>${history}</ul>
      <div class="client-registry-footer">
        <b>${escapeHtml(footerLabel)}</b>
        ${latestButton}
      </div>
    </article>
  `;
}

function getClientNextAction(item) {
  if (!item) return "Cadastrar primeiro contato.";
  const status = normalizeProposalStatus(item.status);
  if (item.kind === "request" || status === "lead_recebido") return "Abrir lead e montar proposta.";
  if (status === "proposta_enviada") return "Retomar contato e buscar resposta.";
  if (status === "negociacao") return "Resolver ajustes e avançar para sinal.";
  if (status === "confirmado") return "Registrar pagamento restante.";
  if (status === "pagamento_final") return "Avançar para planejamento.";
  if (status === "planejamento") return "Concluir checklist operacional.";
  if (status === "evento_proximo") return "Confirmar detalhes finais.";
  if (status === "pos_venda") return "Registrar pós-venda e oportunidade futura.";
  if (status === "cancelado") return "Arquivado; manter histórico para nova oportunidade.";
  return "Atualizar etapa comercial.";
}

function formatClientRegistrySummary(quoteCount, confirmedCount, realizedCount) {
  const quoteLabel = quoteCount === 1 ? "cotação" : "cotações";
  const confirmedLabel = confirmedCount === 1 ? "confirmado" : "confirmados";
  const realizedLabel = realizedCount === 1 ? "realizado" : "realizados";
  return `${quoteCount} ${quoteLabel} · ${confirmedCount} ${confirmedLabel} · ${realizedCount} ${realizedLabel}`;
}

function getClientHistoryKind(item) {
  if (item.kind !== "proposal") {
    return { label: "Cotação", tone: "quote" };
  }
  const status = normalizeProposalStatus(item.status);
  if (status === "pos_venda") {
    return { label: "Evento realizado", tone: "realized" };
  }
  if (operationStatuses.has(status)) {
    return { label: "Evento confirmado", tone: "confirmed" };
  }
  if (status === "cancelado") {
    return { label: "Cotação cancelada", tone: "canceled" };
  }
  return { label: "Cotação", tone: "quote" };
}

function renderGlobalSearch(items = getPipelineItems()) {
  if (!nodes.globalSearchResults) return;
  const term = normalizeSearchValue(fields.globalSearchInput?.value || "");
  if (!term) {
    nodes.globalSearchResults.innerHTML = `
      <div class="search-empty-guide">
        <strong>Busque qualquer pista do atendimento.</strong>
        <span>Nome, empresa, celular sem máscara, data, referência EC, origem, tipo de evento ou faixa de investimento.</span>
      </div>
    `;
    return;
  }
  const termDigits = term.replace(/\D/g, "");
  const matchesSearch = (text) => text.includes(term) || (termDigits.length >= 4 && text.includes(termDigits));
  const matchedItems = items.filter((item) => matchesSearch(getItemSearchText(item))).slice(0, 8);
  const matchedClients = getClientRegistry(items).filter((client) => matchesSearch(client.searchText)).slice(0, 4);
  const totalResults = matchedItems.length + matchedClients.length;
  const clientResults = matchedClients
    .map((client) => {
      const latest = client.items[0];
      const actionButton =
        latest?.kind === "proposal"
          ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(latest.id)}">Abrir</button>`
          : `<button class="secondary" type="button" data-use-request="${escapeHtml(latest?.id || "")}">Abrir</button>`;
      return `<article class="global-search-hit"><span>Cliente · ${escapeHtml(client.items.length)} registro(s)</span><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml([client.company, client.email, client.phone].filter(Boolean).join(" · ") || "Sem contato completo")}</small>${actionButton}</article>`;
    })
    .join("");
  const itemResults = matchedItems.map(renderGlobalSearchItem).join("");
  nodes.globalSearchResults.innerHTML = clientResults || itemResults
    ? `<div class="global-search-summary">${totalResults} resultado(s) para "${escapeHtml(fields.globalSearchInput?.value || "")}"</div>${clientResults}${itemResults}`
    : `<p>Nada encontrado para essa busca.</p>`;
}

function renderGlobalSearchItem(item) {
  const actionButton =
    item.kind === "proposal"
      ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(item.id)}">Abrir</button>`
      : `<button class="secondary" type="button" data-use-request="${escapeHtml(item.id)}">Abrir</button>`;
  return `
    <article class="global-search-hit">
      <span>${escapeHtml(getProposalStatusLabel(item.status))}</span>
      <strong>${escapeHtml(item.name || "Cliente")}</strong>
      <small>${escapeHtml([item.type, item.date ? formatDateFromIso(item.date) : "", item.time ? String(item.time).slice(0, 5) : "", item.reference].filter(Boolean).join(" · "))}</small>
      ${actionButton}
    </article>
  `;
}

function isQuoteWorkspaceEffectivelyEmpty() {
  return (
    !state.activeProposalId &&
    !state.activeQuoteRequestId &&
    !state.selectedIds.size &&
    !fields.clientName.value.trim() &&
    !fields.clientEmail.value.trim() &&
    !fields.clientPhone.value.trim() &&
    !fields.eventType.value.trim() &&
    !fields.eventReason.value.trim() &&
    !fields.notes.value.trim() &&
    !hasMeaningfulManualAdjustment()
  );
}

function getCurrentEditorSignature() {
  return JSON.stringify({
    activeProposalId: state.activeProposalId || "",
    activeQuoteRequestId: state.activeQuoteRequestId || "",
    client: fields.clientName?.value.trim() || "",
    email: fields.clientEmail?.value.trim() || "",
    phone: fields.clientPhone?.value.trim() || "",
    eventType: getCurrentEventType(),
    date: fields.eventDate?.value || "",
    time: fields.eventTime?.value || "",
    guests: getGuestCount(),
    duration: getDuration(),
    validity: fields.validity?.value.trim() || "",
    signalDeadlineHours: fields.signalDeadlineHours?.value || "",
    adjustment: roundCurrency(getManualAdjustment()),
    adjustmentLabel: fields.manualAdjustmentLabel?.value.trim() || "",
    reason: fields.eventReason?.value.trim() || "",
    notes: fields.notes?.value.trim() || "",
    selectedIds: [...state.selectedIds].sort(),
    guided: state.guided,
    privatizationChoice: state.privatizationChoice || "",
    sourceOverrides: getCurrentSourceOverrides(),
  });
}

function getEditorContextFromCurrent(kind = state.activeProposalId ? "proposal" : "request", sourceLabel = "") {
  const proposal = getActiveProposal();
  const request = state.quoteRequests.find((item) => item.id === state.activeQuoteRequestId) || null;
  const status = proposal ? normalizeProposalStatus(proposal.status) : request ? normalizeRequestStatus(request.status) : "";
  const stageId = getPipelineStage(status || "lead_recebido");
  return {
    kind,
    id: kind === "proposal" ? state.activeProposalId : state.activeQuoteRequestId,
    name: fields.clientName?.value.trim() || proposal?.cliente_nome || request?.cliente_nome || "Cliente",
    date: fields.eventDate?.value || proposal?.data_evento || request?.data_evento || "",
    time: fields.eventTime?.value || proposal?.horario_evento || request?.horario_evento || "",
    type: getCurrentEventType() || proposal?.tipo_evento || request?.tipo_evento || "Evento",
    status,
    stageId,
    sourceLabel: sourceLabel || state.pendingOpenSourceLabel || (status ? `Funil: ${getProposalStatusLabel(status)}` : "Edição manual"),
  };
}

function markEditorClean(context = null) {
  state.activeEditorContext = context || getEditorContextFromCurrent();
  state.loadedEditorSignature = getCurrentEditorSignature();
  state.pendingOpenSourceLabel = "";
  renderLoadedEditorBar();
}

function hasUnsavedEditorChanges() {
  if (isQuoteWorkspaceEffectivelyEmpty() || !state.loadedEditorSignature) return false;
  return getCurrentEditorSignature() !== state.loadedEditorSignature;
}

function renderLoadedEditorBar() {
  if (!nodes.loadedEditorBar) return;
  const context = state.activeEditorContext;
  if (!context || isQuoteWorkspaceEffectivelyEmpty()) {
    nodes.loadedEditorBar.classList.add("is-hidden");
    nodes.loadedEditorBar.innerHTML = "";
    return;
  }
  const dirty = hasUnsavedEditorChanges();
  const dateLabel = context.date ? formatDateFromIso(context.date) : "Data a definir";
  const timeLabel = context.time ? String(context.time).slice(0, 5) : "Horário a definir";
  const stageLabel = getProposalStatusLabel(context.status || "lead_recebido");
  nodes.loadedEditorBar.classList.remove("is-hidden");
  nodes.loadedEditorBar.innerHTML = `
    <div class="loaded-editor-main">
      <span>${escapeHtml(context.sourceLabel || "Carregado do funil")}</span>
      <strong>Você está editando: ${escapeHtml(context.name)} · ${escapeHtml(dateLabel)} · ${escapeHtml(context.type)}</strong>
      <small>Funil &gt; ${escapeHtml(stageLabel)} &gt; ${escapeHtml(context.name)}${dirty ? " · alterações não salvas" : ""}</small>
    </div>
    <div class="loaded-editor-actions">
      ${dirty ? `<span class="loaded-editor-dirty">Não salvo</span>` : `<span class="loaded-editor-saved">Atualizado</span>`}
      <button class="secondary" type="button" data-return-pipeline-stage="${escapeHtml(context.stageId || "lead_recebido")}">Voltar ao funil</button>
    </div>
  `;
}

async function confirmEditorSwitch() {
  if (!hasUnsavedEditorChanges()) return true;
  const saveFirst = window.confirm(
    "Você alterou esta proposta.\n\nOK: salvar antes de abrir outro lead.\nCancelar: abrir outro lead sem salvar estas alterações.",
  );
  if (!saveFirst) {
    return window.confirm("Abrir sem salvar? As alterações feitas neste editor serão descartadas.");
  }
  const activeStatus = getActiveProposal()?.status || "proposta_enviada";
  const saved = await saveCurrentProposal(activeStatus);
  if (!saved) {
    return window.confirm("Não consegui salvar automaticamente. Abrir outro lead mesmo assim e descartar as alterações locais?");
  }
  markEditorClean(getEditorContextFromCurrent("proposal", "Salva antes de trocar"));
  return true;
}

function getOpenSourceLabelForItem(item, fallback = "Funil") {
  if (!item) return fallback;
  return `${fallback}: ${getProposalStatusLabel(item.status)}`;
}

async function safeOpenSavedProposal(proposalId, sourceLabel = "") {
  if (!proposalId) {
    showToast("Não encontrei o código desta proposta. Atualize o funil e tente de novo.");
    return;
  }
  if (!state.proposals.some((item) => item.id === proposalId)) {
    showToast("Não encontrei essa proposta no histórico carregado. Clique em Atualizar e tente novamente.");
    return;
  }
  if (!(await confirmEditorSwitch())) return;
  openSavedProposal(proposalId, sourceLabel);
  scheduleLoadedEditorJump("client", "auto");
}

async function safeApplyQuoteRequest(requestId, sourceLabel = "") {
  if (!requestId) {
    showToast("Não encontrei o código deste lead. Atualize o funil e tente de novo.");
    return;
  }
  if (!state.quoteRequests.some((item) => item.id === requestId)) {
    showToast("Não encontrei esse lead carregado. Clique em Atualizar e tente novamente.");
    return;
  }
  if (!(await confirmEditorSwitch())) return;
  await applyQuoteRequest(requestId, sourceLabel);
  scheduleLoadedEditorJump("client", "auto");
}

function renderQuoteWorkspaceGuide() {
  if (!nodes.quoteEmptyState) return;
  const shouldShow = isQuoteWorkspaceEffectivelyEmpty() && !state.quoteGuideDismissed;
  nodes.quoteEmptyState.hidden = !shouldShow;
}

function getActionTasks(items = getPipelineItems()) {
  const today = startOfDay(new Date());
  const next48h = addDays(today, 2);
  const tasks = [];
  items.forEach((item) => {
    const status = getReportStatus(item);
    const hours = getHoursSince(item.updatedAt || item.createdAt);
    const eventDate = parseLocalIsoDate(item.date);
    const base = {
      item,
      meta: `${item.date ? formatDateFromIso(item.date) : "Data a definir"} · ${item.time ? String(item.time).slice(0, 5) : "Horário a definir"} · ${item.guests || 0} pax`,
      sla: getSlaMeta(item),
    };

    if (item.kind === "request" && status === "lead_recebido") {
      const age = getLeadAgeInfo(item);
      tasks.push({
        ...base,
        title: "Responder lead",
        note: age?.label || "Novo pedido recebido",
        priority: age?.level === "critical" ? 100 : age?.level === "danger" ? 86 : age?.level === "warning" ? 68 : 42,
        track: "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "proposta_enviada") {
      const followUp = getProposalFollowUpInfo(item);
      tasks.push({
        ...base,
        title: item.clientResponse === "confirmar" ? "Registrar sinal" : "Retomar proposta",
        note: item.clientResponse === "confirmar" ? "Cliente aprovou pelo link. Falta sinal." : followUp?.note || `Sem resposta há ${hours || 0}h.`,
        priority: item.clientResponse === "confirmar" ? 92 : hours >= 72 ? 90 : hours >= 48 ? 82 : hours >= 24 ? 66 : 38,
        track: item.clientResponse === "confirmar" ? "Venda" : "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "negociacao") {
      const changeDetails = item.clientResponse === "alteracao" ? getClientChangeDetails(item) : null;
      tasks.push({
        ...base,
        title: "Avançar negociação",
        note: changeDetails ? `Cliente pediu alteração: ${changeDetails.summary}` : "Ajuste comercial em andamento.",
        priority: item.clientResponse === "alteracao" ? 74 : 50,
        track: "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "confirmado") {
      if (item.hasPaymentComplete) {
        tasks.push({
          ...base,
          title: "Enviar para planejamento",
          note: "Pagamento completo. Liberar a operação do evento.",
          priority: 62,
          track: "Operação",
        });
      } else {
        tasks.push({
          ...base,
          title: "Cobrar pagamento restante",
          note: `Sinal recebido. Falta registrar ${formatMoney(item.paymentRemainingDue || 0)}.`,
          priority: 72,
          track: "Financeiro",
        });
      }
      if (!item.hasSignalProof) {
        tasks.push({
          ...base,
          title: "Anexar comprovante do sinal",
          note: "Venda confirmada sem comprovante no histórico.",
          priority: 76,
          track: "Financeiro",
        });
      }
    }

    if (item.kind === "proposal" && status === "pagamento_final") {
      if (!item.hasPaymentComplete) {
        tasks.push({
          ...base,
          title: "Registrar pagamento restante",
          note: "Saldo final ainda não registrado.",
          priority: 78,
          track: "Financeiro",
        });
      } else if (!item.hasRemainingProof) {
        tasks.push({
          ...base,
          title: "Anexar comprovante do saldo",
          note: "Pagamento restante registrado sem comprovante.",
          priority: 60,
          track: "Financeiro",
        });
      }
    }

    if (item.kind === "proposal" && ["pagamento_final", "planejamento"].includes(status)) {
      const progress = getChecklistProgress(item.snapshot || {});
      if (progress.done < progress.total) {
        tasks.push({
          ...base,
          title: "Concluir checklist operacional",
          note: `${progress.done}/${progress.total} itens concluídos.`,
          priority: status === "planejamento" ? 58 : 44,
          track: "Operação",
        });
      }
    }

    if (item.kind === "proposal" && isSoldReportItem(item) && eventDate && eventDate >= today && eventDate <= next48h) {
      tasks.push({
        ...base,
        title: "Revisar evento 48h",
        note: "Confirmar detalhes finais antes da execução.",
        priority: 88,
        track: "Operação",
      });
    }
  });

  const scheduleItems = items.filter((item) => {
    if (!item.date || !item.time || !isAvailabilityRelevantStatus(item.status)) return false;
    return item.kind === "proposal" || item.kind === "request";
  });
  for (let index = 0; index < scheduleItems.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < scheduleItems.length; nextIndex += 1) {
      const first = scheduleItems[index];
      const second = scheduleItems[nextIndex];
      if (first.date !== second.date) continue;
      const firstStart = timeToMinutes(String(first.time).slice(0, 5));
      const secondStart = timeToMinutes(String(second.time).slice(0, 5));
      if (firstStart === null || secondStart === null) continue;
      const firstEnd = firstStart + (Number(first.duration) || 2) * 60;
      const secondEnd = secondStart + (Number(second.duration) || 2) * 60;
      if (!rangesOverlap(firstStart, firstEnd, secondStart, secondEnd)) continue;
      const hasSoldConflict = operationStatuses.has(normalizeProposalStatus(first.status)) || operationStatuses.has(normalizeProposalStatus(second.status));
      tasks.push({
        item: first.kind === "proposal" ? first : second,
        title: hasSoldConflict ? "Conflito de agenda" : "Checar disputa de agenda",
        meta: `${formatDateFromIso(first.date)} · ${String(first.time).slice(0, 5)} · ${first.guests || 0} pax`,
        note: `${first.name || "Cliente"} e ${second.name || "Cliente"} no mesmo horário.`,
        priority: hasSoldConflict ? 96 : 64,
        track: "Agenda",
      });
    }
  }

  const profile = getTeamProfile();
  const rankedTasks = tasks.map((task) => ({
    ...task,
    priority:
      profile.canManageFinance && getActionTrack(task) === "Financeiro"
        ? task.priority + 12
        : profile.canManageCommercial && ["Comercial", "Venda"].includes(getActionTrack(task))
          ? task.priority + 6
          : task.priority,
  }));
  return rankedTasks.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

function getActionTaskSteps(task = {}) {
  const title = String(task.title || "").toLowerCase();
  const track = getActionTrack(task);
  if (title.includes("responder lead")) {
    return ["Abrir lead", "Conferir data, horário, pax e contato", "Enviar proposta ou resposta inicial"];
  }
  if (title.includes("follow-up") || title.includes("retorno")) {
    return ["Abrir proposta", "Ver último envio e resposta", "Reenviar link ou ligar para destravar"];
  }
  if (title.includes("registrar sinal")) {
    return ["Abrir proposta", "Enviar dados bancários se necessário", "Registrar sinal e comprovante"];
  }
  if (title.includes("pagamento restante") || title.includes("saldo")) {
    return ["Abrir proposta", "Conferir valor restante", "Registrar banco, data e comprovante"];
  }
  if (title.includes("checklist") || title.includes("48h") || track === "Operação") {
    return ["Abrir evento", "Checar cardápio, extras e responsáveis", "Marcar operação como pronta"];
  }
  if (title.includes("agenda") || track === "Agenda") {
    return ["Abrir registro", "Conferir sobreposição de horários", "Ajustar etapa ou negociar alternativa"];
  }
  return ["Abrir registro", "Revisar próximo passo", "Registrar ação no histórico"];
}

function renderActionTasks(items = getPipelineItems()) {
  if (!nodes.actionList) return;
  const tasks = getActionTasks(items);
  if (nodes.actionCenterMeta) {
    const criticalCount = tasks.filter((task) => task.priority >= 90).length;
    const commercialCount = tasks.filter((task) => ["Comercial", "Venda"].includes(getActionTrack(task))).length;
    const operationCount = tasks.filter((task) => ["Operação", "Agenda", "Financeiro"].includes(getActionTrack(task))).length;
    nodes.actionCenterMeta.textContent = `${tasks.length} no radar · ${criticalCount} agora · ${commercialCount} venda · ${operationCount} operação`;
  }
  if (!tasks.length) {
    nodes.actionList.innerHTML = `<p>Nenhuma ação crítica agora. O funil está limpo para novos contatos e retornos pendentes.</p>`;
    return;
  }
  const topTask = tasks[0];
  const topItem = topTask.item;
  const topActionButton =
    topItem.kind === "proposal"
      ? `<button class="primary action-open-button" type="button" data-proposal-id="${escapeHtml(topItem.id)}">Abrir e resolver</button>`
      : `<button class="primary action-open-button" type="button" data-use-request="${escapeHtml(topItem.id)}">Abrir e resolver</button>`;
  const groupedCounts = tasks.reduce(
    (acc, task) => {
      const track = getActionTrack(task);
      acc[track] = (acc[track] || 0) + 1;
      return acc;
    },
    {},
  );
  const groupedLine = Object.entries(groupedCounts)
    .map(([track, count]) => `<span>${escapeHtml(track)} <b>${count}</b></span>`)
    .join("");
  const topSteps = getActionTaskSteps(topTask)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  nodes.actionList.innerHTML = `
    <article
      class="action-focus-card action-${getActionPriorityClass(topTask.priority)}"
      tabindex="0"
      data-action-kind="${escapeHtml(topItem.kind)}"
      data-action-id="${escapeHtml(topItem.id)}"
      aria-label="Abrir prioridade agora de ${escapeHtml(topItem.name || "Cliente")}"
    >
      <div>
        <span>Prioridade agora</span>
        <strong>${escapeHtml(topTask.title)}</strong>
        <small>${escapeHtml(topItem.name || "Cliente")} · ${escapeHtml(topTask.meta)}</small>
        <p>${escapeHtml(topTask.note)}</p>
        <ol class="action-focus-steps">${topSteps}</ol>
      </div>
      ${topActionButton}
    </article>
    <div class="action-track-summary">${groupedLine}</div>
    ${tasks
    .map((task) => {
      const item = task.item;
      const actionButton =
        item.kind === "proposal"
          ? `<button class="primary action-open-button" type="button" data-proposal-id="${escapeHtml(item.id)}">Abrir</button>`
          : `<button class="primary action-open-button" type="button" data-use-request="${escapeHtml(item.id)}">Abrir</button>`;
      const clientChangeBlock = item.clientResponse === "alteracao" ? renderClientResponseBlock(item) : "";
      return `
        <article
          class="action-task action-${getActionPriorityClass(task.priority)}"
          tabindex="0"
          data-action-kind="${escapeHtml(item.kind)}"
          data-action-id="${escapeHtml(item.id)}"
          aria-label="Abrir ação de ${escapeHtml(item.name || "Cliente")}"
        >
          <div class="action-task-topline">
            <span class="action-task-track">${escapeHtml(getActionTrack(task))}</span>
            <b class="action-task-urgency">${escapeHtml(getActionUrgencyLabel(task.priority))}</b>
          </div>
          <div class="action-task-body">
            <strong>${escapeHtml(item.name || "Cliente")}</strong>
            <span class="action-task-title">${escapeHtml(task.title)}</span>
            <small>${escapeHtml(task.meta)}</small>
            ${task.sla ? `<small class="action-task-sla sla-${escapeHtml(task.sla.level)}">${escapeHtml(task.sla.label)}</small>` : ""}
            <p>${escapeHtml(task.note)}</p>
          </div>
          ${clientChangeBlock}
          <div class="action-task-footer">
            <small>${escapeHtml([item.type || item.clientType || "Lead", item.updatedAt ? `atualizado ${formatSavedAt(item.updatedAt)}` : ""].filter(Boolean).join(" · "))}</small>
            ${actionButton}
          </div>
        </article>
      `;
    })
    .join("")}
  `;
}

async function openNextPriorityItem() {
  const [task] = getActionTasks(getPipelineItems());
  if (!task?.item) {
    showToast("Nenhuma prioridade crítica agora. O funil está limpo.");
    document.querySelector(".pipeline-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const source = `Prioridade agora: ${task.title}`;
  if (task.item.kind === "proposal") {
    await safeOpenSavedProposal(task.item.id, source);
  } else {
    await safeApplyQuoteRequest(task.item.id, source);
  }
}

async function openActionElement(element, sourceLabel = "Prioridade agora") {
  if (!element) return;
  const { actionKind, actionId } = element.dataset;
  if (actionKind === "proposal") {
    await safeOpenSavedProposal(actionId, sourceLabel);
  } else if (actionKind === "request") {
    await safeApplyQuoteRequest(actionId, sourceLabel);
  }
}

function renderFinanceCommandPanel(items = getPipelineItems()) {
  if (!nodes.financeCommandPanel) return;
  if (!state.session || !isFinanceSession()) {
    nodes.financeCommandPanel.classList.add("is-hidden");
    nodes.financeCommandPanel.innerHTML = "";
    return;
  }
  const proposals = items.filter((item) => item.kind === "proposal");
  const awaitingSignal = proposals.filter((item) => ["proposta_enviada", "negociacao"].includes(item.status));
  const awaitingRemaining = proposals.filter((item) => ["confirmado", "pagamento_final"].includes(item.status) && !item.hasPaymentComplete);
  const missingProof = proposals.filter(
    (item) =>
      (operationStatuses.has(item.status) && !item.hasSignalProof) ||
      (item.hasRemainingPayment && !item.hasRemainingProof),
  );
  const receivedMonth = proposals.reduce((sum, item) => {
    const signal = item.snapshot?.pagamentoSinal;
    const remaining = item.snapshot?.pagamentoRestante;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const signalValue = signal?.data?.startsWith(currentMonth) ? toNumber(signal.valor) : 0;
    const remainingValue = remaining?.data?.startsWith(currentMonth) ? toNumber(remaining.valor) : 0;
    return sum + signalValue + remainingValue;
  }, 0);
  nodes.financeCommandPanel.classList.remove("is-hidden");
  nodes.financeCommandPanel.innerHTML = `
    <div class="finance-command-heading">
      <span>Financeiro</span>
      <strong>Pagamentos que pedem atenção</strong>
    </div>
    <div class="finance-command-grid">
      <article><span>Aguardando sinal</span><strong>${awaitingSignal.length}</strong></article>
      <article><span>Saldo pendente</span><strong>${awaitingRemaining.length}</strong></article>
      <article><span>Comprovante faltando</span><strong>${missingProof.length}</strong></article>
      <article><span>Recebido no mês</span><strong>${escapeHtml(formatMoney(receivedMonth))}</strong></article>
    </div>
  `;
}

function getAgendaEventLabel(item) {
  const dateLabel = item.date ? formatDateFromIso(item.date) : "Data a definir";
  const timeLabel = item.time ? String(item.time).slice(0, 5) : "Horário a definir";
  return `${dateLabel} · ${timeLabel} · ${item.guests || 0} pax`;
}

function getOperationalAgendaCollections(items = getPipelineItems()) {
  const today = startOfDay(new Date());
  const tomorrowLimit = addDays(today, 2);
  const agendaItems = items
    .map((item) => ({ ...item, eventDate: parseLocalIsoDate(item.date) }))
    .filter((item) => item.eventDate);

  const upcoming = agendaItems
    .filter((item) => item.kind === "proposal" && isSoldReportItem(item) && item.eventDate >= today && item.eventDate < tomorrowLimit)
    .sort((a, b) => {
      const dateDiff = a.eventDate - b.eventDate;
      if (dateDiff) return dateDiff;
      return (timeToMinutes(String(a.time).slice(0, 5)) || 0) - (timeToMinutes(String(b.time).slice(0, 5)) || 0);
    });

  const planningQueue = agendaItems
    .filter((item) => item.kind === "proposal" && ["confirmado", "pagamento_final", "planejamento"].includes(getReportStatus(item)))
    .sort((a, b) => {
      const dateDiff = a.eventDate - b.eventDate;
      if (dateDiff) return dateDiff;
      return (timeToMinutes(String(a.time).slice(0, 5)) || 0) - (timeToMinutes(String(b.time).slice(0, 5)) || 0);
    });

  const scheduleItems = agendaItems.filter((item) => item.time && isAvailabilityRelevantStatus(item.status));
  const conflictPairs = [];
  for (let index = 0; index < scheduleItems.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < scheduleItems.length; nextIndex += 1) {
      const first = scheduleItems[index];
      const second = scheduleItems[nextIndex];
      if (first.date !== second.date) continue;
      const firstStart = timeToMinutes(String(first.time).slice(0, 5));
      const secondStart = timeToMinutes(String(second.time).slice(0, 5));
      if (firstStart === null || secondStart === null) continue;
      const firstEnd = firstStart + (Number(first.duration) || 2) * 60;
      const secondEnd = secondStart + (Number(second.duration) || 2) * 60;
      if (!rangesOverlap(firstStart, firstEnd, secondStart, secondEnd)) continue;
      if (first.id === second.id && first.kind === second.kind) continue;
      const hasSoldConflict =
        operationStatuses.has(normalizeProposalStatus(first.status)) || operationStatuses.has(normalizeProposalStatus(second.status));
      conflictPairs.push({
        id: `${first.kind}-${first.id}-${second.kind}-${second.id}`,
        date: first.date,
        time: first.time,
        severity: hasSoldConflict ? "danger" : "warning",
        primary: first.kind === "proposal" ? first : second,
        note: `${first.name} e ${second.name} se sobrepõem no mesmo horário.`,
      });
    }
  }

  const loadByDate = agendaItems
    .filter((item) => item.kind === "proposal" && isAvailabilityRelevantStatus(item.status))
    .reduce((accumulator, item) => {
      accumulator[item.date] = (accumulator[item.date] || 0) + 1;
      return accumulator;
    }, {});
  const busiestDay = Object.entries(loadByDate).sort((a, b) => b[1] - a[1])[0];

  return {
    upcoming,
    planningQueue,
    conflicts: conflictPairs.slice(0, 6),
    busiestDay: busiestDay
      ? `${formatDateFromIso(busiestDay[0])} com ${busiestDay[1]} ${busiestDay[1] === 1 ? "registro" : "registros"}`
      : "Sem concentração crítica na agenda.",
  };
}

function renderAgendaItemCard(item, options = {}) {
  const isProposal = item.kind === "proposal";
  const actionButton = isProposal
    ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(item.id)}">Abrir</button>`
    : `<button class="secondary" type="button" data-use-request="${escapeHtml(item.id)}">Abrir</button>`;
  return `
    <article class="agenda-event-card${options.className ? ` ${options.className}` : ""}">
      <div class="agenda-event-topline">
        <span>${escapeHtml(options.kicker || getProposalStatusLabel(item.status))}</span>
        <b>${escapeHtml(options.value || (item.total ? formatMoney(item.total) : getAgendaEventLabel(item)))}</b>
      </div>
      <strong>${escapeHtml(item.name || "Cliente")}</strong>
      <small>${escapeHtml(getAgendaEventLabel(item))}</small>
      <p>${escapeHtml(options.note || item.type || "Evento")}</p>
      <div class="agenda-event-footer">
        <em>${escapeHtml(options.footer || item.type || "Evento")}</em>
        ${actionButton}
      </div>
    </article>
  `;
}

function renderConflictCard(conflict) {
  return `
    <article class="agenda-event-card agenda-conflict-card agenda-conflict-${escapeHtml(conflict.severity)}">
      <div class="agenda-event-topline">
        <span>${escapeHtml(conflict.severity === "danger" ? "Conflito com venda" : "Disputa de agenda")}</span>
        <b>${escapeHtml(`${formatDateFromIso(conflict.date)} · ${String(conflict.time).slice(0, 5)}`)}</b>
      </div>
      <strong>${escapeHtml(conflict.primary?.name || "Evento")}</strong>
      <small>${escapeHtml(conflict.primary?.type || "Evento")}</small>
      <p>${escapeHtml(conflict.note)}</p>
      <div class="agenda-event-footer">
        <em>${escapeHtml(conflict.primary?.status ? getProposalStatusLabel(conflict.primary.status) : "Agenda")}</em>
        ${
          conflict.primary?.kind === "proposal"
            ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(conflict.primary.id)}">Abrir</button>`
            : `<button class="secondary" type="button" data-use-request="${escapeHtml(conflict.primary.id)}">Abrir</button>`
        }
      </div>
    </article>
  `;
}

function renderOperationsAgenda(items = getPipelineItems()) {
  if (!nodes.operationsAgenda) return;
  if (!state.supabase) {
    nodes.operationsAgenda.innerHTML = "<p>Entre com Supabase para ver a agenda operacional.</p>";
    if (nodes.operationsAgendaMeta) nodes.operationsAgendaMeta.textContent = "Atualiza com o funil.";
    return;
  }
  if (!state.session) {
    nodes.operationsAgenda.innerHTML = "<p>Entre com o e-mail da equipe para ver a agenda operacional.</p>";
    if (nodes.operationsAgendaMeta) nodes.operationsAgendaMeta.textContent = "Atualiza com o funil.";
    return;
  }

  const { upcoming, planningQueue, conflicts, busiestDay } = getOperationalAgendaCollections(items);
  if (nodes.operationsAgendaMeta) {
    nodes.operationsAgendaMeta.textContent = `${upcoming.length} próximo(s) · ${planningQueue.length} em preparação · ${conflicts.length} conflito(s) · ${busiestDay}`;
  }

  const columns = [
    {
      title: "Hoje e amanhã",
      subtitle: "Execução na janela crítica",
      items: upcoming.slice(0, 4),
      empty: "Nenhum evento em execução imediata.",
      render: (item) =>
        renderAgendaItemCard(item, {
          kicker: item.eventDate && startOfDay(item.eventDate).getTime() === startOfDay(new Date()).getTime() ? "Hoje" : "Amanhã",
          value: item.total ? formatMoney(item.total) : getAgendaEventLabel(item),
          note: `${item.type} · ${item.guests || 0} pax`,
          footer: getProposalStatusLabel(item.status),
        }),
    },
    {
      title: "Aguardando planejamento",
      subtitle: "Sinal, saldo e checklist",
      items: planningQueue.slice(0, 5),
      empty: "Sem fila operacional agora.",
      render: (item) => {
        const progress = getChecklistProgress(item.snapshot || {});
        return renderAgendaItemCard(item, {
          kicker: getProposalStatusLabel(item.status),
          value: item.total ? formatMoney(item.total) : getAgendaEventLabel(item),
          note:
            ["confirmado", "pagamento_final"].includes(getReportStatus(item))
              ? "Falta alinhar saldo final ou liberar a operação."
              : `${progress.done}/${progress.total} itens do checklist concluídos.`,
          footer: item.type,
        });
      },
    },
    {
      title: "Conflitos e carga",
      subtitle: busiestDay,
      items: conflicts,
      empty: "Sem conflito de horário no radar.",
      render: renderConflictCard,
    },
  ];

  nodes.operationsAgenda.innerHTML = columns
    .map(
      (column) => `
        <section class="operations-agenda-column">
          <header>
            <span>${escapeHtml(column.title)}</span>
            <strong>${column.items.length}</strong>
          </header>
          <small>${escapeHtml(column.subtitle)}</small>
          <div class="operations-agenda-list">
            ${column.items.length ? column.items.map((item) => column.render(item)).join("") : `<p class="agenda-empty">${escapeHtml(column.empty)}</p>`}
          </div>
        </section>
      `,
    )
    .join("");
}

function getClientResponseLabel(response) {
  const labels = {
    confirmar: "Cliente aprovou a proposta",
    alteracao: "Cliente pediu alteração",
    cancelar: "Cliente cancelou",
  };
  return labels[response] || "";
}

function normalizeClientRequestPayload(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (_) {
      return { mensagem: payload };
    }
  }
  return typeof payload === "object" ? payload : {};
}

function firstClientRequestValue(payload, keys = []) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return "";
}

function formatClientRequestDate(value) {
  if (!value) return "";
  return formatDateFromIso(String(value).slice(0, 10));
}

function formatClientRequestTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function getClientChangeDetails(item = {}) {
  const payload = normalizeClientRequestPayload(item.clientRequest || item.snapshot?.clienteResposta || {});
  const message = (
    item.clientMessage ||
    firstClientRequestValue(payload, ["mensagem", "message", "observacao", "observacoes"]) ||
    ""
  ).trim();
  const requestedDate = firstClientRequestValue(payload, ["data", "requested_date", "requestedDate", "novaData"]);
  const requestedTime = firstClientRequestValue(payload, ["horario", "requested_time", "requestedTime", "novoHorario"]);
  const requestedGuests = firstClientRequestValue(payload, ["convidados", "requested_guests", "requestedGuests", "pax", "novoPax"]);
  const responseAt = item.clientResponseAt || firstClientRequestValue(payload, ["registradoEm", "created_at", "at"]);
  const metaParts = [
    requestedDate ? `Data: ${formatClientRequestDate(requestedDate)}` : "",
    requestedTime ? `Horário: ${formatClientRequestTime(requestedTime)}` : "",
    requestedGuests ? `Público: ${requestedGuests}` : "",
  ].filter(Boolean);
  const fallbackMessage = "Cliente pediu ajuste, mas não deixou detalhes no campo aberto.";
  return {
    message: message || fallbackMessage,
    metaParts,
    responseAt,
    summary: [message || fallbackMessage, ...metaParts].filter(Boolean).join(" · "),
  };
}

function renderClientResponseBlock(item) {
  if (!item.clientResponse) return "";
  if (item.clientResponse === "alteracao") {
    const details = getClientChangeDetails(item);
    return `
      <button
        class="pipeline-client-change"
        type="button"
        data-client-change-kind="${escapeHtml(item.kind)}"
        data-client-change-id="${escapeHtml(item.id)}"
        title="Ver pedido completo de alteração do cliente"
      >
        <span>Cliente pediu alteração</span>
        <strong>${escapeHtml(details.message)}</strong>
        <small>${escapeHtml(details.metaParts.length ? details.metaParts.join(" · ") : "Clique para ver o pedido completo e ajustar a proposta")}</small>
      </button>
    `;
  }
  return `<small class="pipeline-client-response">${escapeHtml(getClientResponseLabel(item.clientResponse))}${item.clientMessage ? ` · ${escapeHtml(item.clientMessage)}` : ""}</small>`;
}

function findPipelineItem(kind, id) {
  return getPipelineItems().find((item) => item.kind === kind && item.id === id);
}

function closeClientChangeDialog() {
  document.querySelector(".client-change-dialog-backdrop")?.remove();
}

function showClientChangeDetails(kind, id) {
  const item = findPipelineItem(kind, id);
  if (!item) {
    showToast("Não encontrei os detalhes desta alteração. Atualize o funil e tente de novo.");
    return;
  }
  const details = getClientChangeDetails(item);
  closeClientChangeDialog();
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="client-change-dialog-backdrop" role="presentation">
        <section class="client-change-dialog" role="dialog" aria-modal="true" aria-labelledby="clientChangeDialogTitle">
          <div class="client-change-dialog-header">
            <span>Pedido do cliente</span>
            <h2 id="clientChangeDialogTitle">Alteração solicitada na proposta</h2>
            <button class="icon-button" type="button" data-close-client-change aria-label="Fechar">×</button>
          </div>
          <div class="client-change-dialog-summary">
            <div>
              <span>Cliente</span>
              <strong>${escapeHtml(item.name || "Cliente")}</strong>
              <small>${escapeHtml([item.type, item.date ? formatDateFromIso(item.date) : "", item.time ? String(item.time).slice(0, 5) : ""].filter(Boolean).join(" · "))}</small>
            </div>
            ${
              details.responseAt
                ? `<div><span>Recebido</span><strong>${escapeHtml(formatSavedAt(details.responseAt))}</strong><small>Resposta pelo link público</small></div>`
                : ""
            }
          </div>
          <div class="client-change-dialog-message">
            <span>O que o cliente pediu</span>
            <p>${escapeHtml(details.message)}</p>
          </div>
          ${
            details.metaParts.length
              ? `<div class="client-change-dialog-meta">${details.metaParts.map((part) => `<strong>${escapeHtml(part)}</strong>`).join("")}</div>`
              : ""
          }
          <div class="client-change-dialog-actions">
            <button class="secondary" type="button" data-close-client-change>Fechar</button>
            <button class="primary" type="button" data-open-client-change data-client-change-kind="${escapeHtml(item.kind)}" data-client-change-id="${escapeHtml(item.id)}">Abrir e ajustar proposta</button>
          </div>
        </section>
      </div>
    `,
  );
  const dialog = document.querySelector(".client-change-dialog-backdrop");
  dialog?.addEventListener("click", async (event) => {
    if (event.target === dialog || event.target.closest("[data-close-client-change]")) {
      closeClientChangeDialog();
      return;
    }
    const openButton = event.target.closest("[data-open-client-change]");
    if (!openButton) return;
    closeClientChangeDialog();
    if (openButton.dataset.clientChangeKind === "proposal") {
      await safeOpenSavedProposal(openButton.dataset.clientChangeId, "Alteração do cliente");
    } else {
      await safeApplyQuoteRequest(openButton.dataset.clientChangeId, "Alteração do cliente");
    }
  });
  dialog?.querySelector("[data-open-client-change]")?.focus?.();
}

function isTestCancelReason(reason) {
  return slugify(reason).includes("teste");
}

function canDeletePipelineItem(item) {
  if (!isSuperAdminSession()) return false;
  if (item.status !== "cancelado") return false;
  return isTestCancelReason(item.cancelReason || "");
}

function getPipelineOpenButtonLabel(item, primaryAction) {
  const status = getReportStatus(item);
  if (item.status === "cancelado") return "Abrir";
  if (item.kind === "request" || status === "lead_recebido") return "Responder";
  if (status === "proposta_enviada") return item.clientResponse === "confirmar" ? "Cobrar sinal" : "Reenviar";
  if (status === "negociacao") return "Ajustar";
  if (status === "confirmado") return item.hasPaymentComplete ? "Planejar" : "Cobrar saldo";
  if (status === "pagamento_final") return item.hasPaymentComplete ? "Planejar" : "Registrar saldo";
  if (status === "planejamento") return "Planejar";
  if (status === "evento_proximo") return "Revisar 48h";
  if (status === "pos_venda") return "Pós-venda";
  return primaryAction?.label || "Abrir";
}

function getPipelineValueBreakdown(item = {}) {
  const total = toNumber(item.total);
  if (item.kind !== "proposal" || total <= 0) return null;
  const totals = item.snapshot?.totals || {};
  const privatizationAmount = roundCurrency(
    toNumber(item.privatizationAmount ?? item.privatizacao ?? totals.privatizationAmount ?? totals.privatization?.amount ?? 0),
  );
  return {
    foodBeverage: roundCurrency(Math.max(0, total - privatizationAmount)),
    privatization: privatizationAmount,
  };
}

function renderPipelineValueBreakdown(item = {}, className = "") {
  const breakdown = getPipelineValueBreakdown(item);
  if (!breakdown) return "";
  return `
    <div class="pipeline-value-breakdown ${escapeHtml(className)}" aria-label="Composição do valor da proposta">
      ${item.type ? `<span class="pipeline-product-chip" title="Formato do evento">${escapeHtml(item.type)}</span>` : ""}
      <span title="Alimentos e bebidas">A&amp;B ${formatMoney(breakdown.foodBeverage)}</span>
      <span class="${breakdown.privatization > 0 ? "has-privatization" : ""}" title="Privatização">Priv. ${formatMoney(breakdown.privatization)}</span>
    </div>
  `;
}

function renderPipelineCard(item) {
  const status = getReportStatus(item);
  const dateLabel = item.date ? formatDateFromIso(item.date) : "Data a definir";
  const timeLabel = item.time ? String(item.time).slice(0, 5) : "Horário a definir";
  const valueLabel = item.total ? formatMoney(item.total) : "Sem proposta";
  const statusClass = item.status === "cancelado" ? " canceled" : operationStatuses.has(item.status) ? " confirmed" : "";
  const cancelInfo = item.cancelReason ? `<small>Cancelado: ${escapeHtml(item.cancelReason)}</small>` : "";
  const weekdayLabel = item.date ? formatWeekdayShortFromIso(item.date) : "";
  const eventLine = [dateLabel, weekdayLabel, timeLabel, `${item.guests} pax`].filter(Boolean).join(" · ");
  const displayName = item.company ? `${item.name} - ${item.company}` : item.name;
  const clientTypeLine = item.clientType || item.meta[0] || "";
  const finalClientLine = [item.finalClient ? `Cliente final: ${item.finalClient}` : "", item.groupName ? `Grupo: ${item.groupName}` : ""]
    .filter(Boolean)
    .join(" · ");
  const leadAge = getLeadAgeInfo(item);
  const commercialScore = getCommercialScore(item);
  const leadAgeBadge = leadAge
    ? `<small class="lead-age-badge lead-age-${escapeHtml(leadAge.level)}">${escapeHtml(leadAge.label)}</small>`
    : "";
  const followUp = getProposalFollowUpInfo(item);
  const followUpBadge = followUp
    ? `<small class="follow-up-badge follow-up-${escapeHtml(followUp.level)}">${escapeHtml(followUp.label)}</small>`
    : "";
  const stageChipLabel = item.status === "cancelado" ? getProposalStatusLabel(item.status) : clientTypeLine || getProposalStatusLabel(item.status);
  const scoreTitle = commercialScore.reasons.length
    ? ` title="${escapeHtml(commercialScore.reasons.join(" · "))}"`
    : "";
  const scoreBadge = `<small class="pipeline-score-badge pipeline-score-${escapeHtml(commercialScore.level)}"${scoreTitle}>${escapeHtml(commercialScore.label)} ${commercialScore.value}</small>`;
  const primaryAction = getPipelinePrimaryAction(item);
  const riskAlerts = getPipelineRiskAlerts(item);
  const riskAlertsLine = riskAlerts.length
    ? `<div class="pipeline-card-alerts">${riskAlerts
        .map((alert) => `<small class="pipeline-alert pipeline-alert-${escapeHtml(alert.level)}">${escapeHtml(alert.label)}</small>`)
        .join("")}</div>`
    : "";
  const clientResponseLine = renderClientResponseBlock(item);
  const signalProofLink =
    item.hasSignalProof && item.signalProof?.dataUrl
      ? `<a class="pipeline-top-action pipeline-proof-download" href="${escapeHtml(item.signalProof.dataUrl)}" download="${escapeHtml(item.signalProof.nome || "comprovante-sinal")}">Comprovante</a>`
      : "";
  const remainingProofLink =
    item.hasRemainingProof && item.remainingProof?.dataUrl
      ? `<a class="pipeline-top-action pipeline-proof-download" href="${escapeHtml(item.remainingProof.dataUrl)}" download="${escapeHtml(item.remainingProof.nome || "comprovante-restante")}">Comprovante restante</a>`
      : "";
  const signalButton =
    item.kind === "proposal" && !operationStatuses.has(item.status) && item.status !== "cancelado"
      ? `<button class="pipeline-top-action pipeline-signal-action" type="button" data-mark-paid="${escapeHtml(item.id)}" title="Registrar sinal pago e confirmar a venda">Registrar sinal</button>`
      : "";
  const actionInsideNext = signalButton || (status === "confirmado" ? signalProofLink : "");
  const primaryActionButton = actionInsideNext ? `<span class="pipeline-next-action-button">${actionInsideNext}</span>` : "";
  const primaryActionLine = `
    <div class="pipeline-card-next-action is-${escapeHtml(primaryAction.tone)}${primaryActionButton ? " has-action-button" : ""}">
      <span>${escapeHtml(primaryAction.eyebrow)}</span>
      <strong>${escapeHtml(primaryAction.label)}</strong>
      <small>${escapeHtml(primaryAction.note || "")}</small>
      ${primaryActionButton}
    </div>
  `;
  const remainingButton =
    item.kind === "proposal" && item.status === "pagamento_final" && !item.hasPaymentComplete
      ? `<button class="pipeline-top-action pipeline-final-payment-action" type="button" data-mark-final-payment="${escapeHtml(item.id)}" title="Registrar pagamento restante">Registrar saldo</button>`
      : "";
  const topAction = remainingButton || remainingProofLink || (status === "confirmado" ? "" : signalProofLink);
  const openButton =
    item.kind === "proposal"
      ? `<button class="primary pipeline-open-button" type="button" data-proposal-id="${escapeHtml(item.id)}" title="Abrir proposta">${escapeHtml(getPipelineOpenButtonLabel(item, primaryAction))}</button>`
      : `<button class="primary pipeline-open-button" type="button" data-use-request="${escapeHtml(item.id)}" title="Abrir lead">${escapeHtml(getPipelineOpenButtonLabel(item, primaryAction))}</button>`;
  const cancelButton =
    item.status === "cancelado"
      ? ""
      : `<button class="secondary danger-light pipeline-cancel-chip" type="button" data-cancel-kind="${escapeHtml(item.kind)}" data-cancel-id="${escapeHtml(item.id)}" title="Cancelar e registrar motivo">Cancelar</button>`;
  const reopenButton =
    item.status === "cancelado"
      ? `<button class="secondary pipeline-reopen-chip" type="button" data-reopen-kind="${escapeHtml(item.kind)}" data-reopen-id="${escapeHtml(item.id)}" title="Reabrir este cancelamento para atendimento">Reabrir</button>`
      : "";
  const deleteTestButton = canDeletePipelineItem(item)
    ? `<button class="secondary danger-light pipeline-delete-chip" type="button" data-delete-kind="${escapeHtml(item.kind)}" data-delete-id="${escapeHtml(item.id)}">Apagar teste</button>`
    : "";
  const actionButtons = `
    <span class="pipeline-card-actions">
      ${cancelButton}
      ${reopenButton}
      ${renderStatusSelect(item)}
      ${deleteTestButton}
      ${openButton}
    </span>
  `;
  return `
    <article
      class="pipeline-card"
      draggable="true"
      tabindex="0"
      aria-label="Abrir ${escapeHtml(displayName)} no editor"
      data-pipeline-card-kind="${escapeHtml(item.kind)}"
      data-pipeline-card-id="${escapeHtml(item.id)}"
      data-pipeline-card-status="${escapeHtml(item.status)}"
    >
      <div class="pipeline-card-kicker">
        <span class="status-chip${statusClass} pipeline-stage-chip">${escapeHtml(stageChipLabel)}</span>
        ${leadAgeBadge}
        ${followUpBadge}
        ${topAction}
      </div>
      <div class="pipeline-card-event-row">
        <small class="pipeline-card-event-line">${escapeHtml(eventLine)}</small>
        <span class="pipeline-card-value-stack">
          <span class="pipeline-card-value">${escapeHtml(valueLabel)}</span>
        </span>
      </div>
      <div class="pipeline-card-breakdown-row">
        ${renderPipelineValueBreakdown(item)}
        ${scoreBadge}
      </div>
      <div class="pipeline-card-name-row">
        <small class="pipeline-card-name">${escapeHtml(displayName)}</small>
      </div>
      ${finalClientLine ? `<small class="pipeline-card-final-client">${escapeHtml(finalClientLine)}</small>` : ""}
      ${riskAlertsLine}
      ${primaryActionLine}
      ${clientResponseLine}
      <div class="pipeline-card-bottom-row">
        <small class="pipeline-card-reference-bottom">${escapeHtml(item.reference || "Sem referência")}</small>
        ${actionButtons}
      </div>
      ${cancelInfo}
    </article>
  `;
}

function renderPipelineEmptyState(stage) {
  const nextFocus = {
    lead_recebido: "Sem leads aqui. Próximo foco: propostas sem resposta e negociações.",
    proposta_enviada: "Sem propostas paradas aqui. Próximo foco: leads novos e negociações abertas.",
    negociacao: "Sem negociação ativa. Próximo foco: leads e propostas sem resposta.",
    confirmado: "Sem sinal novo agora. Próximo foco: propostas aprovadas e cobrança de sinal.",
    pagamento_final: "Sem saldo pendente. Próximo foco: planejamento e eventos próximos.",
    planejamento: "Sem evento aguardando planejamento. Próximo foco: pagamentos restantes e 48h.",
    evento_proximo: "Sem evento hoje ou amanhã. Próximo foco: planejamento da semana.",
    pos_venda: "Sem pós-venda pendente. Próximo foco: clientes realizados e recompra.",
    cancelado: "Sem cancelados nesta visão. Motivos registrados aparecem aqui quando houver.",
  };
  return `
    <div class="pipeline-empty-state">
      <strong>${escapeHtml(stage.description || "Nada nesta etapa.")}</strong>
      <small>${escapeHtml(nextFocus[stage.id] || "Sem itens aqui agora. Siga pela próxima prioridade do sistema.")}</small>
    </div>
  `;
}

function renderPipelineStage(stage, items) {
  const stageItems = items.filter((item) => item.stage === stage.id);
  if (stage.row === "archive") {
    return `
      <section class="pipeline-column pipeline-stage-${escapeHtml(stage.id)} pipeline-column-collapsible">
        <details>
          <summary class="pipeline-column-heading pipeline-column-summary">
            <span>${escapeHtml(stage.title)}</span>
            <strong>${stageItems.length}</strong>
          </summary>
          <div class="pipeline-column-list" data-pipeline-drop-status="${escapeHtml(stage.statuses[0])}">
            ${stageItems.length ? stageItems.map(renderPipelineCard).join("") : renderPipelineEmptyState(stage)}
          </div>
        </details>
      </section>
    `;
  }
  return `
    <section class="pipeline-column pipeline-stage-${escapeHtml(stage.id)}">
      <div class="pipeline-column-heading">
        <span>${escapeHtml(stage.title)}</span>
        <strong>${stageItems.length}</strong>
      </div>
      <div class="pipeline-column-list" data-pipeline-drop-status="${escapeHtml(stage.statuses[0])}">
        ${stageItems.length ? stageItems.map(renderPipelineCard).join("") : renderPipelineEmptyState(stage)}
      </div>
    </section>
  `;
}

function renderPipeline() {
  if (!nodes.pipelineBoard) {
    renderPipelineMetrics(getPipelineItems());
    return;
  }
  if (!state.supabase) {
    renderPipelineQuickFilters([]);
    renderOperationsAgenda([]);
    nodes.pipelineBoard.innerHTML = `<p>A conexão da equipe ainda está carregando.</p>`;
    renderPipelineMetrics([]);
    renderFinanceCommandPanel([]);
    return;
  }

  if (!state.session) {
    renderPipelineQuickFilters([]);
    renderOperationsAgenda([]);
    nodes.pipelineBoard.innerHTML = `<p>Entre com o e-mail da equipe para carregar o funil.</p>`;
    renderPipelineMetrics([]);
    renderFinanceCommandPanel([]);
    return;
  }

  const items = getPipelineItems();
  const filteredItems = getFilteredPipelineItems(items);
  renderPipelineQuickFilters(items);
  renderPipelineMetrics(items);
  renderFinanceCommandPanel(items);
  renderOperationsAgenda(items);
  renderAvailabilityAlert();

  const rows = [
    { id: "commercial", title: "Comercial", stages: funnelStages.filter((stage) => stage.row === "commercial") },
    { id: "operation", title: "Operação", stages: funnelStages.filter((stage) => stage.row === "operation") },
    { id: "archive", title: "Encerrados", stages: funnelStages.filter((stage) => stage.row === "archive") },
  ];

  nodes.pipelineBoard.innerHTML = rows
    .map((row) => `
      <div class="pipeline-row pipeline-row-${escapeHtml(row.id)}" aria-label="${escapeHtml(row.title)}">
        ${row.stages.map((stage) => renderPipelineStage(stage, filteredItems)).join("")}
      </div>
    `)
    .join("");
}

function renderQuoteRequests() {
  renderPipeline();
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
    if (nodes.pipelineBoard) {
      nodes.pipelineBoard.innerHTML = `<p>Não foi possível carregar solicitações. Rode o schema atualizado no Supabase.</p>`;
    }
    return;
  }

  state.quoteRequests = data || [];
  renderQuoteRequests();
  await applyPendingDashboardTarget();
}

function buildNotesFromRequest(request) {
  const eventSnapshot = request.snapshot?.evento || {};
  const lines = [];
  if (eventSnapshot.extras) lines.push(`Extras: ${eventSnapshot.extras}`);
  if (request.preferencias || eventSnapshot.preferencias) {
    lines.push(`Preferências de A&B: ${request.preferencias || eventSnapshot.preferencias}`);
  }
  const clientObservation = cleanClientObservationText(request, request.snapshot || {});
  if (clientObservation) lines.push(`Observação do cliente: ${clientObservation}`);
  return lines.join("\n");
}

function getEventCategoryFromRequest(type) {
  const normalized = normalizarTextoSeguro(type);
  if (!normalized) return "";
  if (normalized.includes("cafe") || normalized.includes("coffee") || normalized.includes("brunch")) {
    return "Café da Manhã / Coffee Break";
  }
  if (normalized.includes("almoco")) return "Almoço Carioca";
  if (normalized.includes("coquetel")) return "Coquetel";
  if (normalized.includes("workshop")) return "Workshop de Caipirinha";
  if (normalized.includes("welcome")) return "Welcome Drink";
  return "";
}

function getGuidedEventKeyFromType(type) {
  const category = getEventCategoryFromRequest(type);
  const byCategory = {
    Coquetel: "coquetel",
    "Workshop de Caipirinha": "workshop",
    "Café da Manhã / Coffee Break": "cafe",
    "Almoço Carioca": "almoco",
    "Welcome Drink": "welcome",
  };
  return byCategory[category] || "";
}

function resetProposalDraftState() {
  state.selectedIds.clear();
  state.guided = { event: "", beverageId: "", foodId: "", welcomeId: "", workshopId: "" };
  state.privatizationChoice = "";
  saveSelectedIds();
  fields.manualAdjustment.value = "0";
  fields.manualAdjustmentLabel.value = "";
  fields.searchPrice.value = "";
  fields.categoryFilter.value = "";
  nodes.coquetelChoices?.classList.add("is-hidden");
  if (nodes.flowStatus) {
    nodes.flowStatus.textContent =
      "Comece escolhendo o tipo de evento. O app filtra os pacotes e seleciona automaticamente quando houver uma regra clara.";
  }
  setChoiceState(nodes.flowEventOptions, "", "flowEvent");
  setChoiceState(nodes.flowBeverageOptions, "", "selectPackage");
  setChoiceState(nodes.flowFoodOptions, "", "selectPackage");
  setChoiceState(nodes.flowWelcomeOptions, "", "selectPackage");
  setChoiceState(nodes.flowWorkshopOptions, "", "selectPackage");
  setChoiceState(nodes.optionalPrivatizationControls, "", "privatizationChoice");
}

async function applyQuoteRequest(requestId, sourceLabel = "") {
  const request = state.quoteRequests.find((item) => item.id === requestId);
  if (!request) return;

  state.activeQuoteRequestId = request.id;
  state.activeProposalId = "";
  state.manualSourceKey = "";
  state.quoteGuideDismissed = true;
  resetProposalDraftState();
  fields.clientName.value = request.cliente_nome || "";
  fields.clientEmail.value = request.cliente_email || "";
  fields.clientPhone.value = request.cliente_whatsapp || "";
  fields.eventType.value = request.tipo_evento || "";
  fields.eventDate.value = request.data_evento || "";
  fields.eventTime.value = request.horario_evento ? String(request.horario_evento).slice(0, 5) : "18:00";
  syncDateTimeFromFields();
  fields.guestCount.value = request.convidados || 30;
  fields.eventDuration.value = String(request.duracao || 1);
  fields.eventReason.value = request.motivo_evento || "";
  fields.notes.value = buildNotesFromRequest(request);
  const guidedKey = getGuidedEventKeyFromType(request.tipo_evento);
  const eventCategory = getEventCategoryFromRequest(request.tipo_evento);
  state.guided.event = guidedKey;
  fields.categoryFilter.value = eventCategory;
  const templateStatus = applySmartTemplateForEvent(guidedKey);
  if (nodes.flowStatus) {
    nodes.flowStatus.textContent = templateStatus
      ? `${templateStatus} Revise data, horário, pax e observações antes de enviar.`
      : eventCategory
      ? `${eventCategory} carregado. Confira cardápio, pax e agenda.`
      : "Lead carregado do formulário. Escolha o formato e confira os pontos essenciais.";
  }
  nodes.coquetelChoices?.classList.toggle("is-hidden", guidedKey !== "coquetel");
  setChoiceState(nodes.flowEventOptions, guidedKey, "flowEvent");
  renderSignalPaymentInfo(null, null);
  renderOperationalChecklist(null);
  renderCommercialTimeline(null);
  renderInternalNotesPanel(null);
  renderEventAttachmentsPanel(null);

  renderAll();
  markEditorClean(getEditorContextFromCurrent("request", sourceLabel || "Funil: Lead"));
  focusLoadedProposalEditor("Lead carregado. Revise dados, itens, valor e checklist antes de enviar.", "client");
}

async function markQuoteRequestAnalyzed(requestId) {
  await updateQuoteRequest(requestId, { status: "lead_recebido" });
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
  renderPipeline();
  if (shouldToast) showToast("Solicitação atualizada.");
}

function canMoveProposalStatus(currentStatus, nextStatus) {
  const current = normalizeProposalStatus(currentStatus);
  const next = normalizeProposalStatus(nextStatus);
  if (current === next) return { ok: true };
  if (!proposalStatusOptions.includes(next)) {
    return { ok: false, message: "Propostas só podem avançar pelas etapas comerciais e operacionais." };
  }
  if (current === "cancelado" && !["negociacao", "proposta_enviada"].includes(next)) {
    return { ok: false, message: "Reabra primeiro para negociação antes de avançar para outra etapa." };
  }
  if (next === "cancelado") return { ok: false, message: "Use o botão Cancelar para registrar o motivo." };
  if (next === "confirmado") return { ok: true };
  if (next === "pagamento_final" && !operationStatuses.has(current)) {
    return { ok: false, message: "Sem sinal recebido, o evento não pode entrar em pagamento restante." };
  }
  if (next === "planejamento" && !operationStatuses.has(current)) {
    return { ok: false, message: "Sem sinal recebido, o evento não pode entrar em planejamento." };
  }
  if (next === "evento_proximo" && !operationStatuses.has(current)) {
    return { ok: false, message: "Sem sinal recebido, o evento não pode entrar em evento hoje/amanhã." };
  }
  if (next === "pos_venda" && current !== "evento_proximo" && current !== "pos_venda") {
    return { ok: false, message: "Pós-venda vem depois da etapa Evento hoje/amanhã." };
  }
  return { ok: true };
}

function buildReopenedSnapshot(snapshot = {}, nextStatus = "negociacao") {
  const { cancelamento, cancelamentosAnteriores, ...rest } = snapshot || {};
  const previousCancelations = Array.isArray(cancelamentosAnteriores) ? cancelamentosAnteriores : [];
  const reopenedSnapshot = {
    ...rest,
    ...(cancelamento ? { cancelamentosAnteriores: [cancelamento, ...previousCancelations].slice(0, 10) } : {}),
  };
  return withCommercialHistoryEntries(reopenedSnapshot, [
    createCommercialHistoryEntry(
      "reabertura",
      "Cancelamento revertido",
      `Registro reaberto para ${getProposalStatusLabel(nextStatus)}. Motivo anterior: ${cancelamento?.motivo || "sem motivo informado"}.`,
    ),
  ]);
}

function getCancelReason() {
  const options = cancelReasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n");
  const answer = window.prompt(`Motivo do cancelamento:\n\n${options}\n\nUse 6 para leads de teste. Digite o número ou escreva outro motivo.`);
  if (answer === null) return "";
  const trimmed = answer.trim();
  if (!trimmed) return "";
  const selectedIndex = Number(trimmed) - 1;
  return cancelReasons[selectedIndex] || trimmed;
}

async function deleteTestPipelineItem(kind, id) {
  if (!state.supabase || !state.session) return;
  if (!isSuperAdminSession()) {
    showToast("Apenas o super administrador pode apagar testes.");
    return;
  }

  const collection = kind === "request" ? state.quoteRequests : state.proposals;
  const item = collection.find((entry) => entry.id === id);
  const cancelReason = item?.snapshot?.cancelamento?.motivo || "";
  if (!item || item.status !== "cancelado" || !isTestCancelReason(cancelReason)) {
    showToast("Só é possível apagar itens cancelados com motivo de teste.");
    renderPipeline();
    return;
  }

  const label = item.cliente_nome || item.clienteNome || item.name || "este item";
  const confirmed = window.confirm(
    `Apagar definitivamente o teste de ${label}?\n\nEssa ação remove o registro do Supabase e não pode ser desfeita.`,
  );
  if (!confirmed) return;

  const table = kind === "request" ? "solicitacoes_cotacao" : "propostas";
  const { error } = await state.supabase.from(table).delete().eq("id", id);
  if (error) {
    console.warn("Falha ao apagar item de teste.", error);
    showToast("Não foi possível apagar. Confira permissão do super admin no Supabase.");
    return;
  }

  if (kind === "request") {
    state.quoteRequests = state.quoteRequests.filter((entry) => entry.id !== id);
    if (state.activeQuoteRequestId === id) state.activeQuoteRequestId = null;
  } else {
    state.proposals = state.proposals.filter((entry) => entry.id !== id);
    if (state.activeProposalId === id) state.activeProposalId = null;
  }
  renderHistory();
  renderPipeline();
  renderAll();
  showToast("Teste apagado do histórico.");
}

async function reopenPipelineItem(kind, id, targetStatus = "") {
  if (!state.supabase || !state.session) return;
  const isRequest = kind === "request";
  const collection = isRequest ? state.quoteRequests : state.proposals;
  const item = collection.find((entry) => entry.id === id);
  if (!item) {
    showToast("Não encontrei este registro para reabrir.");
    renderPipeline();
    return;
  }

  const currentStatus = isRequest ? normalizeRequestStatus(item.status) : normalizeProposalStatus(item.status);
  if (currentStatus !== "cancelado") {
    showToast("Este registro não está cancelado.");
    renderPipeline();
    return;
  }

  const nextStatus = targetStatus || (isRequest ? "lead_recebido" : "negociacao");
  const label = item.cliente_nome || item.clienteNome || item.name || "este registro";
  const confirmed = window.confirm(
    `Reabrir ${label}?\n\nO motivo do cancelamento fica salvo no histórico e o registro volta para ${getProposalStatusLabel(nextStatus)}.`,
  );
  if (!confirmed) {
    renderPipeline();
    return;
  }

  if (!isRequest) {
    await updateProposalStatus(id, nextStatus);
    return;
  }

  const snapshot = buildReopenedSnapshot(item.snapshot || {}, nextStatus);
  const { data, error } = await state.supabase
    .from("solicitacoes_cotacao")
    .update({ status: nextStatus, snapshot })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.warn("Falha ao reabrir lead cancelado.", error);
    showToast("Não foi possível reabrir este lead.");
    renderPipeline();
    return;
  }

  state.quoteRequests = state.quoteRequests.map((entry) => (entry.id === id ? data : entry));
  renderPipeline();
  showToast("Lead reaberto para atendimento.");
}

async function cancelPipelineItem(kind, id) {
  if (!state.supabase || !state.session) return;
  const reason = getCancelReason();
  if (!reason) {
    showToast("Cancelamento não registrado.");
    renderPipeline();
    return;
  }
  const cancelamento = {
    motivo: reason,
    canceladoEm: new Date().toISOString(),
    canceladoPor: state.session.user?.email || "",
  };

  if (kind === "request") {
    const request = state.quoteRequests.find((item) => item.id === id);
    if (!request) return;
    const snapshot = {
      ...(request.snapshot || {}),
      cancelamento,
      commercialHistory: [
        createCommercialHistoryEntry("cancelamento", "Lead cancelado", reason, { actor: cancelamento.canceladoPor }),
        createCommercialHistoryEntry("auditoria", "Cancelamento auditado", `Motivo: ${reason}`, { actor: cancelamento.canceladoPor }),
        ...getCommercialHistory(request.snapshot || {}),
      ].slice(0, 50),
    };
    await updateQuoteRequest(id, { status: "cancelado", snapshot });
    return;
  }

  const proposal = state.proposals.find((item) => item.id === id);
  if (!proposal) return;
  const snapshot = withCommercialHistoryEntries(
    { ...(proposal.snapshot || {}), cancelamento },
    [
      createCommercialHistoryEntry("cancelamento", "Cancelamento registrado", reason, { actor: cancelamento.canceladoPor }),
      createCommercialHistoryEntry("auditoria", "Cancelamento auditado", `Motivo: ${reason}`, { actor: cancelamento.canceladoPor }),
    ],
  );
  const { data, error } = await state.supabase
    .from("propostas")
    .update({ status: "cancelado", snapshot })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.warn("Falha ao cancelar proposta.", error);
    showToast("Não foi possível cancelar.");
    return;
  }

  upsertProposalState(data);
  renderHistory();
  renderPipeline();
  if (state.activeProposalId === id) {
    renderCommercialTimeline(data);
    renderProposalNextStep();
  }
  showToast("Cancelamento registrado.");
}

async function updateProposalStatus(proposalId, nextStatus, signalInfo = null) {
  if (!state.supabase || !state.session) return;
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return;
  const validation = canMoveProposalStatus(proposal.status, nextStatus);
  if (!validation.ok) {
    showToast(validation.message);
    renderPipeline();
    return;
  }

  const normalizedNext = normalizeProposalStatus(nextStatus);
  const wasCanceled = normalizeProposalStatus(proposal.status) === "cancelado" && normalizedNext !== "cancelado";
  const finalPaymentRequiredStatuses = new Set(["planejamento", "evento_proximo", "pos_venda"]);
  let paymentSignal = signalInfo;
  let remainingPayment = null;
  if (normalizedNext === "confirmado" && !proposal.snapshot?.pagamentoSinal) {
    paymentSignal = paymentSignal || (await showSignalPaymentDialog(proposal.total));
    if (!paymentSignal) {
      showToast("Sinal não registrado. A etapa não foi alterada.");
      renderPipeline();
      return;
    }
  }
  if (finalPaymentRequiredStatuses.has(normalizedNext)) {
    const signal = proposal.snapshot?.pagamentoSinal || paymentSignal;
    const paymentCoverage = getPaymentCoverage(proposal.total, signal, proposal.snapshot?.pagamentoRestante);
    if (!signal) {
      showToast("Registre o sinal antes do pagamento restante.");
      renderPipeline();
      return;
    }
    if (!paymentCoverage.isFullyPaid) {
      remainingPayment = await showRemainingPaymentDialog(paymentCoverage.remainingDue, proposal.total, signal, proposal.snapshot?.pagamentoRestante);
      if (!remainingPayment) {
        showToast("Pagamento restante não registrado. A etapa não foi alterada.");
        renderPipeline();
        return;
      }
    }
  }

  const historyEntries = [];
  if (normalizeProposalStatus(proposal.status) !== normalizedNext) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "etapa",
        "Etapa alterada",
        `${getProposalStatusLabel(proposal.status)} → ${getProposalStatusLabel(nextStatus)}.`,
      ),
    );
  }
  if (normalizedNext === "confirmado" && paymentSignal) {
    historyEntries.push(
      createCommercialHistoryEntry("sinal", "Sinal registrado", `${formatMoney(paymentSignal.valor)} · ${formatSignalPaymentDate(paymentSignal.data)} · ${(paymentSignal.bancos || []).join(", ")}.`),
    );
    if (paymentSignal.comprovante?.nome) {
      historyEntries.push(
        createCommercialHistoryEntry("anexo", "Comprovante do sinal anexado", paymentSignal.comprovante.nome),
      );
    }
  }
  if (remainingPayment) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "pagamento_restante",
        "Pagamento restante registrado",
        `${formatMoney(remainingPayment.valor)} · ${formatSignalPaymentDate(remainingPayment.data)} · ${(remainingPayment.bancos || []).join(", ")}.`,
      ),
    );
    if (remainingPayment.comprovante?.nome) {
      historyEntries.push(
        createCommercialHistoryEntry("anexo", "Comprovante do pagamento restante anexado", remainingPayment.comprovante.nome),
      );
    }
  }

  const snapshotBase = wasCanceled ? buildReopenedSnapshot(proposal.snapshot || {}, normalizedNext) : proposal.snapshot || {};
  const snapshot = withCommercialHistoryEntries(
    {
      ...snapshotBase,
      ...(normalizedNext === "confirmado" && paymentSignal ? { pagamentoSinal: paymentSignal } : {}),
      ...(remainingPayment ? { pagamentoRestante: remainingPayment } : {}),
    },
    historyEntries,
  );
  const changes = { status: nextStatus, snapshot };

  const { data, error } = await state.supabase
    .from("propostas")
    .update(changes)
    .eq("id", proposalId)
    .select("*")
    .single();

  if (error) {
    console.warn("Falha ao atualizar status da proposta.", error);
    showToast("Não foi possível mudar a etapa.");
    renderPipeline();
    return;
  }

  upsertProposalState(data);
  renderHistory();
  renderPipeline();
  if (state.activeProposalId === proposalId) {
    renderSignalPaymentInfo(data.snapshot?.pagamentoSinal || null, data.snapshot?.pagamentoRestante || null);
    renderOperationalChecklist(data);
    renderCommercialTimeline(data);
    renderInternalNotesPanel(data);
    renderEventAttachmentsPanel(data);
    renderProposalNextStep();
  }
  showToast(
    wasCanceled
      ? "Cancelamento revertido. Registro voltou para atendimento."
      : nextStatus === "confirmado"
      ? "Sinal pago: evento confirmado."
      : remainingPayment
        ? "Pagamento restante registrado. Etapa atualizada."
        : "Etapa atualizada.",
  );
}

async function movePipelineItem(kind, id, nextStatus) {
  if (!nextStatus) return;
  if (kind === "request") {
    const request = state.quoteRequests.find((item) => item.id === id);
    if (normalizeRequestStatus(request?.status) === "cancelado" && nextStatus !== "cancelado") {
      await reopenPipelineItem(kind, id, nextStatus);
      return;
    }
    if (!requestStatusOptions.includes(nextStatus)) {
      showToast("Para avançar para proposta, abra o lead e salve a proposta enviada.");
      renderPipeline();
      return;
    }
    if (nextStatus === "cancelado") {
      await cancelPipelineItem(kind, id);
      return;
    }
    await updateQuoteRequest(id, { status: nextStatus });
    return;
  }

  const proposal = state.proposals.find((item) => item.id === id);
  if (normalizeProposalStatus(proposal?.status) === "cancelado" && nextStatus !== "cancelado") {
    await reopenPipelineItem(kind, id, nextStatus);
    return;
  }
  if (nextStatus === "cancelado") {
    await cancelPipelineItem(kind, id);
    return;
  }
  await updateProposalStatus(id, nextStatus);
}

async function initSupabase() {
  if (!fields.supabaseUrl || !fields.supabaseAnonKey) {
    updateAuthUI();
    return;
  }
  const config = loadSupabaseConfig();
  fields.supabaseUrl.value = config.url;
  fields.supabaseAnonKey.value = config.anonKey;

  if (!config.url || !config.anonKey) {
    renderSupabaseStatus("Supabase ainda não configurado.");
    updateAuthUI();
    renderHistory();
    renderConfirmedEvents();
    renderQuoteRequests();
    return;
  }

  if (!window.supabase?.createClient) {
    renderSupabaseStatus("Biblioteca do Supabase não carregou. Verifique a internet deste navegador.");
    updateAuthUI();
    renderHistory();
    renderConfirmedEvents();
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
        renderConfirmedEvents();
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
        renderConfirmedEvents();
        renderQuoteRequests();
      } else {
        await loadProposalHistory();
        await loadQuoteRequests();
        await applyPendingDashboardTarget();
      }
    } else {
      renderHistory();
      renderConfirmedEvents();
      renderQuoteRequests();
    }
  } catch (error) {
    console.warn("Falha ao iniciar Supabase.", error);
    state.supabase = null;
    state.session = null;
    renderSupabaseStatus("Não foi possível conectar. Confira URL e anon key.");
    updateAuthUI();
    renderHistory();
    renderConfirmedEvents();
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
    showToast("A conexão da equipe ainda está carregando. Tente novamente em instantes.");
    return;
  }

  if (state.sendLocks.auth) {
    showToast("O link de acesso já está sendo preparado.");
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

  state.sendLocks.auth = true;
  const loginButton = document.querySelector("#loginBtn");
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Enviando...";
  }

  try {
    const { error } = await state.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });

    if (error) {
      const message = getMagicLinkErrorMessage(error);
      nodes.authStatus.textContent = message;
      showToast(message);
      return;
    }

    nodes.authStatus.textContent = "Link de acesso enviado. Abra o e-mail neste navegador.";
    showToast("Link de acesso enviado.");
  } finally {
    state.sendLocks.auth = false;
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Entrar por e-mail";
    }
  }
}

function getMagicLinkErrorMessage(error) {
  const text = `${error?.message || ""} ${error?.name || ""}`.toLowerCase();
  const match = text.match(/after\s+(\d+)\s+seconds?/);
  if (text.includes("security purposes") || text.includes("rate limit") || match) {
    const seconds = match?.[1] || "alguns";
    return `Aguarde ${seconds} segundos antes de pedir outro link. O Supabase protege o acesso contra cliques repetidos.`;
  }
  if (text.includes("invalid") || text.includes("email")) {
    return "Não foi possível enviar o link. Confira se o e-mail autorizado está correto.";
  }
  return "Não foi possível enviar o link agora. Tente novamente em instantes.";
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
    showToast("Não foi possível entrar com essa URL. Peça um novo magic link.");
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
  state.activeProposalId = "";
  state.activeQuoteRequestId = "";
  state.manualSourceKey = "";
  state.activeEditorContext = null;
  state.loadedEditorSignature = "";
  updateAuthUI();
  renderHistory();
  renderConfirmedEvents();
  renderQuoteRequests();
}

function upsertProposalState(proposal) {
  const existingIndex = state.proposals.findIndex((item) => item.id === proposal.id);
  if (existingIndex >= 0) {
    state.proposals = state.proposals.map((item) => (item.id === proposal.id ? proposal : item));
  } else {
    state.proposals = [proposal, ...state.proposals];
  }
  state.proposals = state.proposals.slice(0, 60);
}

async function saveCurrentProposal(status, signalInfo = null) {
  if (!state.supabase) {
    showToast("Conecte o Supabase para salvar no histórico.");
    return null;
  }

  if (!state.session) {
    showToast("Entre com o e-mail da equipe antes de salvar.");
    return null;
  }

  const snapshot = getProposalSnapshot();
  const activeProposal = state.proposals.find((item) => item.id === state.activeProposalId);
  const nextStatus = status || activeProposal?.status || "proposta_enviada";
  const normalizedNext = normalizeProposalStatus(nextStatus);
  const finalPaymentRequiredStatuses = new Set(["planejamento", "evento_proximo", "pos_venda"]);
  let paymentSignal = signalInfo;
  let remainingPayment = null;

  if (normalizedNext === "proposta_enviada") {
    const reviewItems = getProposalReviewItems();
    const reviewSummary = getProposalReviewSummary(reviewItems);
    if (!reviewSummary.ready || !isSendReviewApproved(reviewItems)) {
      renderSendReview();
      showToast(
        reviewSummary.ready
          ? "Antes de salvar como enviada, aprove o checklist de revisão."
          : "Antes de salvar como enviada, corrija o checklist de revisão.",
      );
      nodes.sendReviewPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
      return null;
    }
    const blockingItems = getReadinessBlockingItems();
    if (blockingItems.length) {
      const confirmed = window.confirm(
        [
          "A proposta ainda tem pendências antes do envio:",
          "",
          ...blockingItems.map((item) => `- ${item.label}: ${item.detail}`),
          "",
          "Deseja salvar mesmo assim?",
        ].join("\n"),
      );
      if (!confirmed) {
        showToast("Envio pausado para revisar o checklist.");
        renderLeadReviewPanel();
        return null;
      }
    }
  }

  if (normalizedNext === "confirmado" && !activeProposal?.snapshot?.pagamentoSinal) {
    paymentSignal = paymentSignal || (await showSignalPaymentDialog(snapshot.totals.total));
    if (!paymentSignal) {
      showToast("Sinal não registrado. O evento continua sem confirmação.");
      return null;
    }
  }

  const isNewRealizedManual = state.manualSourceKey === "manual:realized" && !activeProposal;
  if (normalizedNext === "pos_venda" && isNewRealizedManual && !snapshot.pagamentoSinal) {
    paymentSignal =
      paymentSignal ||
      (await showSignalPaymentDialog(snapshot.totals.total, {
        mode: "realized",
        defaultPreset: "100",
      }));
    if (!paymentSignal) {
      showToast("Pagamento não registrado. O evento realizado não foi salvo.");
      return null;
    }
  }

  snapshot.pagamentoSinal = paymentSignal || activeProposal?.snapshot?.pagamentoSinal || snapshot.pagamentoSinal || null;
  if (finalPaymentRequiredStatuses.has(normalizedNext)) {
    const signal = snapshot.pagamentoSinal || activeProposal?.snapshot?.pagamentoSinal || null;
    const previousRemaining = activeProposal?.snapshot?.pagamentoRestante || snapshot.pagamentoRestante || null;
    const paymentCoverage = getPaymentCoverage(snapshot.totals.total, signal, previousRemaining);
    if (!signal) {
      showToast("Registre o sinal antes do pagamento restante.");
      return null;
    }
    if (!paymentCoverage.isFullyPaid) {
      remainingPayment = await showRemainingPaymentDialog(paymentCoverage.remainingDue, snapshot.totals.total, signal, previousRemaining);
      if (!remainingPayment) {
        showToast("Pagamento restante não registrado. A proposta não foi atualizada.");
        return null;
      }
    }
  }
  if (finalPaymentRequiredStatuses.has(normalizedNext)) {
    snapshot.pagamentoRestante = remainingPayment || activeProposal?.snapshot?.pagamentoRestante || null;
  }
  snapshot.pagamentoRestante = snapshot.pagamentoRestante || activeProposal?.snapshot?.pagamentoRestante || null;
  const historyEntries = [];
  const previousStatus = normalizeProposalStatus(activeProposal?.status || "");
  if (!activeProposal) {
    historyEntries.push(
      createCommercialHistoryEntry("proposta", "Proposta criada", `${formatMoney(snapshot.totals.total)} · ${snapshot.event.guests} pax · ${snapshot.event.type || "Evento"}.`),
    );
  } else {
    historyEntries.push(
      createCommercialHistoryEntry("proposta", "Proposta atualizada", `${formatMoney(snapshot.totals.total)} · ${snapshot.event.guests} pax · ${snapshot.event.type || "Evento"}.`),
    );
  }
  if (activeProposal && previousStatus !== normalizedNext) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "etapa",
        "Etapa alterada",
        `${getProposalStatusLabel(activeProposal.status)} → ${getProposalStatusLabel(nextStatus)}.`,
      ),
    );
  }
  if (activeProposal) {
    const proposalChanges = getProposalChangeList(activeProposal.snapshot || {}, snapshot);
    if (proposalChanges.length) {
      historyEntries.push(
        createCommercialHistoryEntry(
          "auditoria",
          "Alterações salvas",
          formatAuditChanges(proposalChanges.slice(0, 5)),
          { changes: proposalChanges.slice(0, 8) },
        ),
      );
    }
  }
  if (
    normalizedNext === "proposta_enviada" &&
    snapshot.sendReviewApproval?.signature &&
    snapshot.sendReviewApproval.signature !== activeProposal?.snapshot?.sendReviewApproval?.signature
  ) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "aprovacao",
        "Checklist aprovado para envio",
        `Nota de confiança ${snapshot.reviewConfidence?.score || snapshot.sendReviewApproval.confidence || 0}%. ${snapshot.reviewConfidence?.label || "Revisão humana registrada"}. ${snapshot.automationReadiness?.label || snapshot.sendReviewApproval.automation?.label || ""}`,
        {
          approval: snapshot.sendReviewApproval,
          automationReadiness: snapshot.automationReadiness,
          customerDecisionLoop: snapshot.customerDecisionLoop,
          smartAlerts: snapshot.smartAlerts,
        },
      ),
    );
  }
  if (paymentSignal && !activeProposal?.snapshot?.pagamentoSinal) {
    historyEntries.push(
      createCommercialHistoryEntry("sinal", "Sinal registrado", `${formatMoney(paymentSignal.valor)} · ${formatSignalPaymentDate(paymentSignal.data)} · ${(paymentSignal.bancos || []).join(", ")}.`),
    );
    if (paymentSignal.comprovante?.nome) {
      historyEntries.push(
        createCommercialHistoryEntry("anexo", "Comprovante do sinal anexado", paymentSignal.comprovante.nome),
      );
    }
  }
  if (remainingPayment && !activeProposal?.snapshot?.pagamentoRestante) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "pagamento_restante",
        "Pagamento restante registrado",
        `${formatMoney(remainingPayment.valor)} · ${formatSignalPaymentDate(remainingPayment.data)} · ${(remainingPayment.bancos || []).join(", ")}.`,
      ),
    );
    if (remainingPayment.comprovante?.nome) {
      historyEntries.push(
        createCommercialHistoryEntry("anexo", "Comprovante do pagamento restante anexado", remainingPayment.comprovante.nome),
      );
    }
  }
  const snapshotWithHistory = withCommercialHistoryEntries(snapshot, historyEntries);

  const row = getProposalRow(snapshotWithHistory, nextStatus);
  const query = state.activeProposalId
    ? state.supabase.from("propostas").update(row).eq("id", state.activeProposalId)
    : state.supabase.from("propostas").insert(row);
  const { data, error } = await query.select("*").single();

  if (error) {
    console.warn("Falha ao salvar proposta.", error);
    showToast("Não foi possível salvar. Confira o schema no Supabase.");
    return null;
  }

  state.activeProposalId = data.id;
  upsertProposalState(data);
  if (state.activeQuoteRequestId) {
    await updateQuoteRequest(
      state.activeQuoteRequestId,
      { status: "proposta_enviada", proposta_id: data.id },
      false,
    );
  }
  renderHistory();
  renderPipeline();
  renderSignalPaymentInfo(data.snapshot?.pagamentoSinal || null, data.snapshot?.pagamentoRestante || null);
  renderOperationalChecklist(data);
  renderCommercialTimeline(data);
  renderInternalNotesPanel(data);
  renderEventAttachmentsPanel(data);
  renderProposalNextStep();
  markEditorClean(getEditorContextFromCurrent("proposal", `Funil: ${getProposalStatusLabel(data.status)}`));
  showToast(nextStatus === "confirmado" ? "Evento confirmado com sinal pago." : "Proposta enviada salva no funil.");
  return data;
}

async function confirmCurrentEvent() {
  await saveCurrentProposal("confirmado");
}

async function loadProposalHistory() {
  if (!state.supabase || !state.session) {
    renderHistory();
    renderPipeline();
    return;
  }

  const { data, error } = await state.supabase
    .from("propostas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    console.warn("Falha ao carregar histórico.", error);
    nodes.historyList.innerHTML = `<p>Não foi possível carregar o histórico. Confira as políticas RLS.</p>`;
    return;
  }

  state.proposals = data || [];
  renderHistory();
  renderPipeline();
  if (state.activeProposalId) {
    const activeProposal = getActiveProposal();
    renderCommercialTimeline(activeProposal);
    renderInternalNotesPanel(activeProposal);
    renderEventAttachmentsPanel(activeProposal);
    renderProposalNextStep();
  }
  await applyPendingDashboardTarget();
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
  syncDateTimeFromFields();
  fields.guestCount.value = snapshot.event?.guests || 30;
  fields.eventDuration.value = String(snapshot.event?.duration || 1);
  fields.validity.value = snapshot.event?.validity || "14 dias";
  if (fields.signalDeadlineHours) {
    fields.signalDeadlineHours.value = String(snapshot.event?.signalDeadlineHours || DEFAULT_SIGNAL_DEADLINE_HOURS);
  }
  fields.manualAdjustment.value = getManualAdjustmentInputValue(snapshot.event?.manualAdjustment, snapshot.totals?.adjustment);
  fields.manualAdjustmentLabel.value = snapshot.event?.manualAdjustmentLabel || snapshot.totals?.adjustmentLabel || "";
  fields.eventReason.value = snapshot.event?.reason || "";
  fields.notes.value = snapshot.event?.notes || "";
  fields.generalTerms.value = snapshot.generalTerms || loadGeneralTerms();
  renderProposalNextStep();
  renderSignalPaymentInfo(snapshot.pagamentoSinal, snapshot.pagamentoRestante);
  renderOperationalChecklist(getActiveProposal());
  renderCommercialTimeline(getActiveProposal());
  renderInternalNotesPanel(getActiveProposal());
  renderEventAttachmentsPanel(getActiveProposal());

  if (Array.isArray(snapshot.prices) && snapshot.prices.length) {
    state.prices = snapshot.prices.map(normalizeCatalogItem);
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

function openSavedProposal(proposalId, sourceLabel = "") {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return;
  state.activeProposalId = proposal.id;
  state.activeQuoteRequestId = proposal.solicitacao_id || proposal.snapshot?.activeQuoteRequestId || "";
  state.manualSourceKey = "";
  state.quoteGuideDismissed = true;
  applyProposalSnapshot(proposal.snapshot);
  markEditorClean(getEditorContextFromCurrent("proposal", sourceLabel || `Funil: ${getProposalStatusLabel(proposal.status)}`));
  focusLoadedProposalEditor("Proposta carregada. Confira dados, itens e checklist antes de reenviar ou avançar.", "auto");
}

function formatDateFromIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatWeekdayShortFromIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";
  return ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][date.getDay()];
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
  if (!nodes.proposalContent) return;
  const selected = getSelectedItems();
  const sourceData = getFormSourceData();
  const notes = fields.notes.value.trim();
  const reason = fields.eventReason.value.trim() || sourceData.reason;
  const terms = fields.generalTerms.value.trim();
  const totals = getQuoteTotals();
  const repeatedHeader = `
    <div class="proposal-header proposal-header-repeat" aria-hidden="true">
      <div class="proposal-lockup">
        <img class="brand-logo print-logo" src="./assets/logo-embaixada.svg" alt="" />
        <div>
          <p>Embaixada Carioca</p>
          <h2>Proposta comercial</h2>
        </div>
      </div>
      <div class="proposal-total-box">
        <span>Total estimado</span>
        <strong>${formatMoney(totals.total)}</strong>
      </div>
    </div>
  `;
  const includedSummary = selected.length
    ? selected.map((item) => item.nome).join(", ")
    : "Itens a definir pela equipe.";

  nodes.proposalContent.innerHTML = `
    <section class="proposal-page proposal-page-main">
      <div class="proposal-cover">
        <img src="./assets/venue.jpg" alt="" />
        <div>
          <span>Evento no Morro da Urca</span>
          <strong>${escapeHtml(getCurrentEventType() || "Proposta de evento")}</strong>
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
        <div><span>Formato</span>${escapeHtml(getCurrentEventType() || "Evento")}</div>
        <div><span>Duração</span>${getDuration()}h</div>
        <div><span>Validade da proposta</span>${escapeHtml(fields.validity.value.trim() || "14 dias")}</div>
        <div><span>Prazo para sinal</span>${escapeHtml(formatSignalDeadlineHours())}</div>
        <div><span>Data da proposta</span>${escapeHtml(getTodayLabel())}</div>
        <div class="proposal-grid-wide"><span>Motivo</span>${escapeHtml(reason || "A definir")}</div>
      </div>
      <div class="proposal-note">
        <span>Experiência proposta</span>
        Pensamos esta proposta para receber ${getGuestCount()} pessoa(s) no Morro da Urca com o cuidado da Embaixada Carioca: vista, serviço e uma experiência gastronômica carioca em ritmo confortável. Inclui: ${escapeHtml(includedSummary)}.
      </div>

      ${
      terms
          ? `<div class="proposal-terms-header"><img src="./assets/logo-reducao.svg" alt="Embaixada Carioca" /><div><span>Embaixada Carioca</span><strong>Condições comerciais</strong></div></div><div class="proposal-section-title terms-title"><span>02</span><h3>Condições gerais</h3></div><div class="proposal-note terms-note">${formatMultilineHtml(terms)}</div>`
          : ""
      }

    </section>

    <section class="proposal-page proposal-page-details">
      ${repeatedHeader}
      <div class="proposal-section-title proposal-details-title">
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
                    <td>${escapeHtml(item.commercialSummary || item.descricao)}<br /><small>${escapeHtml(item.calc.detail)}</small></td>
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
        ${totals.adjustment ? `<div><span>${escapeHtml(totals.adjustmentLabel)}</span><strong>${formatMoney(totals.adjustment)}</strong></div>` : ""}
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

function renderCommunicationTemplateEditor() {
  const container = document.querySelector("#communicationTemplates");
  if (!container) return;
  const templates = loadCommunicationTemplates();
  const sampleContext = {
    clientName: "Mariana Silva",
    company: "Agência Rio",
    email: "cliente@empresa.com.br",
    phone: "+55 21 99999-0000",
    eventType: "Coquetel",
    eventDate: "30/06/2026",
    eventTime: "18:00",
    guests: 40,
    duration: "2",
    total: "R$ 18.500,00",
    status: "proposta_enviada",
  };
  const sampleUrl = `${CANONICAL_PUBLIC_PROPOSAL_URL}?p=exemplo`;
  container.innerHTML = templates
    .map(
      (template) => `
        <article class="communication-template-card" data-template-id="${escapeHtml(template.id)}">
          <div class="communication-template-head">
            <div>
              <span>${escapeHtml(template.stage)}</span>
              <h3>${escapeHtml(template.title)}</h3>
              <p>${escapeHtml(template.note)}</p>
            </div>
            <strong>${escapeHtml(template.id)}</strong>
          </div>
          <label>
            Assunto do e-mail
            <input data-template-field="subject" type="text" value="${escapeHtml(template.subject)}" />
          </label>
          <label>
            Texto do WhatsApp
            <textarea class="template-textarea" data-template-field="whatsappBody" rows="9">${escapeHtml(template.whatsappBody)}</textarea>
          </label>
          <label>
            Texto do e-mail
            <textarea class="template-textarea" data-template-field="emailBody" rows="9">${escapeHtml(template.emailBody)}</textarea>
          </label>
          <details class="template-preview">
            <summary>Ver exemplo preenchido</summary>
            <pre>${escapeHtml(renderCommunicationTemplateText(template.whatsappBody, sampleContext, sampleUrl))}</pre>
          </details>
        </article>
      `,
    )
    .join("");
}

function collectCommunicationTemplateEditorValues() {
  return loadCommunicationTemplates().map((template) => {
    const card = document.querySelector(`[data-template-id="${CSS.escape(template.id)}"]`);
    if (!card) return template;
    const subject = card.querySelector('[data-template-field="subject"]')?.value.trim() || template.subject;
    const whatsappBody = card.querySelector('[data-template-field="whatsappBody"]')?.value.trim() || template.whatsappBody;
    const emailBody = card.querySelector('[data-template-field="emailBody"]')?.value.trim() || template.emailBody;
    return { ...template, subject, whatsappBody, emailBody };
  });
}

function handleSaveCommunicationTemplates() {
  saveCommunicationTemplates(collectCommunicationTemplateEditorValues());
  renderCommunicationTemplateEditor();
  renderQuickReplies();
  showToast("Textos de comunicação salvos.");
}

function handleResetCommunicationTemplates() {
  if (!window.confirm("Restaurar os textos padrão de e-mail e WhatsApp?")) return;
  localStorage.removeItem(COMMUNICATION_TEMPLATES_KEY);
  renderCommunicationTemplateEditor();
  renderQuickReplies();
  showToast("Textos padrão restaurados.");
}

function ensureCommunicationShortcut() {
  const actions = document.querySelector(".topbar-actions");
  if (!actions || actions.querySelector('[href="./comunicacao.html"], [href="comunicacao.html"]')) return;

  const link = document.createElement("a");
  link.className = "button-link secondary communication-shortcut";
  link.href = "./comunicacao.html";
  link.textContent = "Comunicação";

  const formRow = actions.querySelector(".topbar-action-row");
  actions.insertBefore(link, formRow || null);
}

function renderAll() {
  ensureCommunicationShortcut();
  syncDateTimeFromFields();
  syncEventTypeFromSelection();
  renderQuoteWorkspaceGuide();
  renderProductTypeManager();
  renderPriceList();
  renderPricesTable();
  renderCommercialLibrarySummary();
  renderAvailabilityAlert();
  renderFormSourcePanel();
  renderServiceCockpit();
  renderLoadedEditorBar();
  renderLeadReviewPanel();
  renderProposalNextStep();
  renderInternalNotesPanel();
  renderEventAttachmentsPanel();
  renderQuickReplies();
  renderSummary();
  renderSendReview();
  renderCalculation();
  renderProposal();
  renderSystemHealth();
  renderIntegrationLogs();
  renderCommunicationTemplateEditor();
}

function startNewProposal(options = {}) {
  const mode = options.mode || "manual";
  const isRealizedMode = mode === "realized";
  const hasDraft =
    state.activeProposalId ||
    state.activeQuoteRequestId ||
    fields.clientName.value.trim() ||
    state.selectedIds.size;
  const confirmMessage = isRealizedMode
    ? "Registrar um evento já realizado e limpar os dados atuais da tela?"
    : "Começar uma nova proposta e limpar os dados atuais da tela?";
  if (hasDraft && !window.confirm(confirmMessage)) return;

  state.activeProposalId = "";
  state.activeQuoteRequestId = "";
  delete state.sourceOverrides["manual:draft"];
  delete state.sourceOverrides["manual:realized"];
  state.manualSourceKey = isRealizedMode ? "manual:realized" : "manual:draft";
  state.activeEditorContext = null;
  state.loadedEditorSignature = "";
  state.quoteGuideDismissed = true;
  state.selectedIds.clear();
  state.guided = { event: "", beverageId: "", foodId: "", welcomeId: "", workshopId: "" };
  state.privatizationChoice = "";
  saveSelectedIds();

  fields.clientName.value = "";
  fields.clientEmail.value = "";
  fields.clientPhone.value = "";
  fields.eventType.value = "";
  fields.eventDate.value = "";
  fields.eventTime.value = isRealizedMode ? "12:00" : "18:00";
  syncDateTimeFromFields();
  fields.guestCount.value = "30";
  fields.eventDuration.value = "1";
  fields.validity.value = "14 dias";
  if (fields.signalDeadlineHours) fields.signalDeadlineHours.value = String(DEFAULT_SIGNAL_DEADLINE_HOURS);
  fields.manualAdjustment.value = "0";
  fields.manualAdjustmentLabel.value = "";
  fields.eventReason.value = "";
  fields.notes.value = "";
  fields.searchPrice.value = "";
  fields.categoryFilter.value = "";
  if (isRealizedMode) {
    state.sourceOverrides[state.manualSourceKey] = {
      clientType: "Cliente direto",
      budgetRange: "Ainda não definido",
      origin: "Negociado fora do sistema",
      moment: "Usar data e horário acima",
      occasion: "Evento já realizado",
      reason: "Evento realizado fora do sistema",
      observations: "Registro retroativo de evento negociado fora do sistema.",
    };
    fields.notes.value =
      "Registro retroativo: informe itens vendidos, valor final, pagamento recebido e observações úteis para histórico e recompra.";
  }
  renderProposalNextStep();
  renderSignalPaymentInfo(null, null);
  renderOperationalChecklist(null);
  renderCommercialTimeline(null);
  renderInternalNotesPanel(null);
  renderEventAttachmentsPanel(null);
  renderAll();
  markEditorClean({
    kind: "manual",
    id: "",
    name: isRealizedMode ? "Registro de evento realizado" : "Nova proposta manual",
    date: "",
    time: isRealizedMode ? "12:00" : "",
    type: isRealizedMode ? "Evento realizado" : "Evento a definir",
    status: isRealizedMode ? "pos_venda" : "proposta_enviada",
    stageId: isRealizedMode ? "pos_venda" : "proposta_enviada",
    sourceLabel: isRealizedMode ? "Registro retroativo" : "Edição manual",
  });
  scrollToClientData();
  showToast(isRealizedMode ? "Registro retroativo pronto. Preencha o essencial e salve como realizado." : "Nova proposta pronta para preencher.");
}

function startRealizedEventRegistration() {
  startNewProposal({ mode: "realized" });
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

function getPublicProposalUrl(proposal) {
  const token = proposal?.public_token;
  return token ? `${CANONICAL_PUBLIC_PROPOSAL_URL}?p=${encodeURIComponent(token)}` : "";
}

function scrollToReviewTarget(target) {
  const targets = {
    client: "#clientDataSection",
    source: "#formSourcePanel",
    items: "#eventConfigSection",
    notes: "#notes",
    review: "#sendReviewPanel",
  };
  const selector = targets[target] || "#sendReviewPanel";
  const node = document.querySelector(selector);
  scrollToNodeReliably(node, { behavior: "smooth", offset: 14 });
  window.setTimeout(() => {
    if (target === "source") {
      const data = getFormSourceData();
      const missing = getFormSourceMissingItems(data);
      const fieldByMissing = {
        "tipo de cliente": "clientType",
        "cliente final ou nome do grupo": data.finalClient ? "groupName" : "finalClient",
        momento: "moment",
        "ocasião": "occasion",
      };
      const firstField = fieldByMissing[missing[0]] || "clientType";
      document.querySelector(`[data-source-field="${firstField}"]`)?.focus?.({ preventScroll: true });
      return;
    }
    if (target === "client") {
      const contact = getCurrentContactValues();
      if (!contact.name) fields.clientName?.focus?.({ preventScroll: true });
      else if (!contact.email && !contact.phone) fields.clientPhone?.focus?.({ preventScroll: true });
      else if (!fields.eventDate?.value) fields.eventDate?.focus?.({ preventScroll: true });
      else if (!fields.eventTime?.value) fields.eventTime?.focus?.({ preventScroll: true });
      return;
    }
    if (target === "notes") fields.notes?.focus?.({ preventScroll: true });
  }, 180);
}

function ensureProposalReadyForSending() {
  const items = getProposalReviewItems();
  const summary = getProposalReviewSummary(items);
  renderSendReview();
  if (summary.ready && isSendReviewApproved(items)) return true;
  if (summary.ready) {
    showToast("Aprove o checklist: clique em “Revisado, pode enviar” antes de mandar ao cliente.");
    nodes.sendReviewPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  const firstError = items.find((item) => item.status === "error");
  showToast(firstError?.detail || "Revise os pontos obrigatórios antes de enviar.");
  nodes.sendReviewPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

function isInteractivePipelineTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(target.closest("button, a, input, select, textarea, details, summary, label"));
}

async function openPipelineCardElement(card) {
  if (!card) return;
  const source = `Funil: ${getProposalStatusLabel(card.dataset.pipelineCardStatus)}`;
  if (card.dataset.pipelineCardKind === "proposal") {
    await safeOpenSavedProposal(card.dataset.pipelineCardId, source);
  } else {
    await safeApplyQuoteRequest(card.dataset.pipelineCardId, source);
  }
}

async function ensureProposalForSharing() {
  if (!ensureProposalReadyForSending()) return null;
  const activeProposal = state.proposals.find((item) => item.id === state.activeProposalId);
  const status = activeProposal?.status && activeProposal.status !== "cancelado" ? activeProposal.status : "proposta_enviada";
  const saved = await saveCurrentProposal(status);
  if (!saved) return null;
  const url = getPublicProposalUrl(saved);
  if (!url) {
    showToast("Rode o schema atualizado no Supabase para gerar links públicos.");
    return null;
  }
  return { saved, url };
}

async function ensureProposalLink() {
  const share = await ensureProposalForSharing();
  return share?.url || "";
}

function buildProposalWhatsAppMessage(proposalUrl) {
  const context = getQuickReplyContext();
  const template = getCommunicationTemplate("proposta");
  return renderCommunicationTemplateText(template.whatsappBody, context, proposalUrl);
}

function confirmClientSend({ channel, destination, title = "Proposta comercial", action = "enviar" }) {
  const clientName = fields.clientName.value.trim() || "cliente";
  const eventType = getCurrentEventType();
  const eventDate = fields.eventDate.value || getEventDateLabel();
  const eventTime = fields.eventTime.value || getEventTimeLabel();
  const approvalItems = getLeadReadinessItems();
  const approvalErrors = approvalItems.filter((item) => item.status === "error");
  const approvalWarnings = approvalItems.filter((item) => item.status === "warning");
  const reviewItems = getProposalReviewItems();
  const smartAlerts = getSmartProposalAlerts(reviewItems);
  const confidence = getProposalConfidence(reviewItems, smartAlerts);
  const automation = getProposalAutomationReadiness(reviewItems, smartAlerts, confidence);
  const totals = getQuoteTotals();
  const requiredLine = approvalErrors.length
    ? approvalErrors.map((item) => `${item.label}: ${item.detail}`).slice(0, 3).join("\n")
    : "Sem bloqueios obrigatórios.";
  const warningLine = approvalWarnings.length
    ? approvalWarnings.map((item) => `${item.label}: ${item.detail}`).slice(0, 3).join("\n")
    : "Sem alertas relevantes.";
  const alertLine = smartAlerts
    .filter((item) => item.level !== "success")
    .map((item) => `${item.title}: ${item.detail}`)
    .slice(0, 3)
    .join("\n");
  const details = [
    "Revisão rápida antes de enviar",
    "",
    `Cliente: ${clientName}`,
    `Canal: ${channel}`,
    destination ? `Destino: ${destination}` : "",
    eventType ? `Evento: ${eventType}` : "",
    eventDate || eventTime ? `Data e horário: ${[eventDate, eventTime].filter(Boolean).join(" - ")}` : "",
    `Pax: ${getGuestCount()} · Total: ${formatMoney(totals.total)} · Confiança: ${confidence.score}%`,
    title ? `Mensagem: ${title}` : "",
    `Automação futura: ${automation.label} - ${automation.note}`,
    "",
    "Obrigatórios:",
    requiredLine,
    "",
    "Atenção:",
    warningLine,
    "",
    "Alertas inteligentes:",
    alertLine || "Sem alertas críticos ou oportunidades obrigatórias.",
    "",
    `Ao confirmar, o app vai ${action}.`,
    channel === "WhatsApp"
      ? `Atenção: este envio sai pelo número automático do bot. Atendimento humano: ${HUMAN_EVENTS_EMAIL} ou ${HUMAN_EVENTS_WHATSAPP}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return window.confirm(details);
}

async function getFunctionErrorMessage(error) {
  if (!error) return "";
  const response = error.context;
  if (response && typeof response.clone === "function") {
    try {
      const body = await response.clone().json();
      if (body?.message) return body.message;
      if (body?.details) return typeof body.details === "string" ? body.details : JSON.stringify(body.details);
    } catch (_jsonError) {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch (_textError) {
        // Mantem fallback abaixo.
      }
    }
  }
  return error.message || "";
}

async function sendProposalWhatsAppViaZapi({ proposal, proposalUrl, message, title = "Proposta comercial", skipConfirm = false }) {
  if (!state.supabase || !state.session) {
    showToast("Entre com o e-mail da equipe para enviar WhatsApp direto.");
    return false;
  }

  if (state.sendLocks.whatsapp) {
    showToast("Envio por WhatsApp já está em andamento.");
    return false;
  }

  const phone = fields.clientPhone.value.trim() || proposal?.cliente_whatsapp || proposal?.snapshot?.client?.phone || "";
  if (!phone.replace(/\D/g, "")) {
    showToast("Preencha o Celular/WhatsApp do cliente antes de enviar.");
    return false;
  }

  if (!skipConfirm) {
    const confirmed = confirmClientSend({
      channel: "WhatsApp",
      destination: phone,
      title,
      action: "enviar agora pela Z-API e registrar no histórico",
    });
    if (!confirmed) {
      showToast("Envio por WhatsApp cancelado.");
      return false;
    }
  }

  state.sendLocks.whatsapp = true;
  const logId = createIntegrationLog({
    channel: "whatsapp",
    status: "pending",
    title,
    detail: "Enviando proposta pela Z-API.",
    target: phone,
    meta: { proposalId: proposal?.id || "" },
  });
  try {
    showToast("Enviando proposta por WhatsApp...");
    const outboundMessage = appendBotWhatsAppNotice(message || buildProposalWhatsAppMessage(proposalUrl));
    const { data, error } = await state.supabase.functions.invoke("send-proposal-whatsapp", {
      body: {
        proposalId: proposal.id,
        phone,
        message: outboundMessage,
        proposalUrl,
        title,
      },
    });

    if (error || data?.ok === false) {
      console.warn("Falha no envio direto por WhatsApp.", error || data);
      const functionMessage = data?.message || (await getFunctionErrorMessage(error));
      updateIntegrationLog(logId, {
        status: functionMessage?.toLowerCase().includes("config") || functionMessage?.toLowerCase().includes("token") ? "config" : "error",
        detail: functionMessage || "Não foi possível enviar pela Z-API. Confira a configuração.",
      });
      showToast(functionMessage || "Não foi possível enviar pela Z-API. Confira a configuração.");
      return false;
    }

    updateIntegrationLog(logId, {
      status: "success",
      detail: `Proposta enviada para ${phone}.`,
    });
    showToast("Proposta enviada por WhatsApp e registrada no histórico.");
    await loadProposalHistory();
    return true;
  } catch (error) {
    updateIntegrationLog(logId, {
      status: "error",
      detail: getHealthErrorMessage(error) || "Falha inesperada ao enviar WhatsApp.",
    });
    showToast("Não foi possível enviar pela Z-API. Confira a conexão e tente novamente.");
    return false;
  } finally {
    state.sendLocks.whatsapp = false;
  }
}

async function sendProposalEmailViaZepto({ proposal, proposalUrl, email, title = "Proposta comercial", skipConfirm = false }) {
  if (!state.supabase || !state.session) {
    showToast("Entre com o e-mail da equipe para enviar e-mail direto.");
    return false;
  }

  const destination = (email || fields.clientEmail.value || proposal?.cliente_email || proposal?.snapshot?.client?.email || "").trim();
  if (!destination || !isLikelyEmailAddress(destination)) {
    showToast("Preencha um e-mail válido do cliente antes de enviar.");
    return false;
  }

  if (state.sendLocks.email) {
    showToast("Envio por e-mail já está em andamento.");
    return false;
  }

  if (!skipConfirm) {
    const confirmed = confirmClientSend({
      channel: "E-mail",
      destination,
      title,
      action: "enviar agora pelo ZeptoMail e registrar no histórico",
    });
    if (!confirmed) {
      showToast("Envio por e-mail cancelado.");
      return false;
    }
  }

  state.sendLocks.email = true;
  const logId = createIntegrationLog({
    channel: "email",
    status: "pending",
    title,
    detail: "Enviando proposta por e-mail.",
    target: destination,
    meta: { proposalId: proposal?.id || "" },
  });
  try {
    showToast("Enviando proposta por e-mail...");
    const emailTemplate = getCommunicationTemplate("proposta");
    const emailMessage = renderCommunicationTemplateText(emailTemplate.emailBody, getQuickReplyContext(), proposalUrl);
    const { data, error } = await state.supabase.functions.invoke("send-proposal-email", {
      body: {
        proposalId: proposal.id,
        email: destination,
        proposalUrl,
        title: emailTemplate.subject || "Sua proposta de evento na Embaixada Carioca",
        message: emailMessage,
      },
    });

    if (error || data?.ok === false) {
      console.warn("Falha no envio direto por e-mail.", error || data);
      const functionMessage = data?.message || (await getFunctionErrorMessage(error));
      updateIntegrationLog(logId, {
        status: functionMessage?.toLowerCase().includes("config") || functionMessage?.toLowerCase().includes("token") ? "config" : "error",
        detail: functionMessage || "Não foi possível enviar o e-mail. Confira a configuração.",
      });
      showToast(functionMessage || "Não foi possível enviar o e-mail. Confira a configuração.");
      return false;
    }

    updateIntegrationLog(logId, {
      status: "success",
      detail: `Proposta enviada para ${destination}.`,
    });
    showToast("Proposta enviada por e-mail e registrada no histórico.");
    await loadProposalHistory();
    return true;
  } catch (error) {
    updateIntegrationLog(logId, {
      status: "error",
      detail: getHealthErrorMessage(error) || "Falha inesperada ao enviar e-mail.",
    });
    showToast("Não foi possível enviar o e-mail. Confira a conexão e tente novamente.");
    return false;
  } finally {
    state.sendLocks.email = false;
  }
}

async function openEmail() {
  const email = fields.clientEmail.value.trim();
  if (!email) {
    showToast("Preencha o e-mail do cliente para enviar a proposta.");
    fields.clientEmail?.focus?.();
    return;
  }
  if (!isLikelyEmailAddress(email)) {
    showToast("Confira o e-mail do cliente antes de enviar.");
    fields.clientEmail?.focus?.();
    return;
  }
  if (!ensureProposalReadyForSending()) return;
  const confirmed = confirmClientSend({
    channel: "E-mail",
    destination: email,
    title: "Proposta comercial",
    action: "enviar agora pelo ZeptoMail e registrar no histórico",
  });
  if (!confirmed) {
    showToast("Envio por e-mail cancelado.");
    createIntegrationLog({
      channel: "email",
      status: "canceled",
      title: "Proposta comercial",
      detail: "A equipe cancelou o envio de e-mail antes de confirmar.",
      target: email,
    });
    return;
  }
  const share = await ensureProposalForSharing();
  if (!share?.saved || !share?.url) {
    createIntegrationLog({
      channel: "email",
      status: "error",
      title: "Proposta comercial",
      detail: "E-mail não enviado: não foi possível gerar o link seguro da proposta.",
      target: email,
    });
    showToast("E-mail não enviado: não consegui gerar o link seguro da proposta.");
    return;
  }
  await sendProposalEmailViaZepto({
    proposal: share.saved,
    proposalUrl: share.url,
    email,
    title: "Proposta comercial",
    skipConfirm: true,
  });
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

async function copyProposalLink() {
  const proposalUrl = await ensureProposalLink();
  if (!proposalUrl) return;
  try {
    await navigator.clipboard.writeText(proposalUrl);
    showToast("Link da proposta copiado.");
  } catch (error) {
    console.warn("Falha ao copiar link da proposta.", error);
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

async function runProposalNextStepAction(action) {
  const activeProposal = getActiveProposal();
  switch (action) {
    case "save_proposal":
      await saveCurrentProposal(activeProposal?.status || "proposta_enviada");
      break;
    case "save_realized_event":
      await saveCurrentProposal("pos_venda");
      break;
    case "copy_link":
      await copyProposalLink();
      break;
    case "mark_signal":
      if (activeProposal) await updateProposalStatus(activeProposal.id, "confirmado");
      break;
    case "mark_remaining":
      if (activeProposal) await updateProposalStatus(activeProposal.id, "planejamento");
      break;
    case "focus_client":
      scrollToReviewTarget("client");
      break;
    case "focus_items":
      scrollToItems();
      break;
    case "focus_review":
      scrollToReviewTarget("review");
      break;
    case "focus_checklist":
      nodes.operationalChecklist?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    case "focus_notes":
      fields.notes?.scrollIntoView({ behavior: "smooth", block: "center" });
      fields.notes?.focus();
      break;
    default:
      break;
  }
}

async function runServiceCockpitAction(action, button = null) {
  switch (action) {
    case "apply_recommended_template": {
      const context = getActiveServiceContext();
      const eventKey = getGuidedEventKeyFromType(context.eventType) || state.guided.event || "";
      if (!eventKey) {
        document.querySelector("#eventConfigSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("Escolha o formato do evento para aplicar uma base.");
        return;
      }
      const template = smartEventTemplates[eventKey];
      const selectedIds = [...state.selectedIds];
      const selectedDiffers =
        selectedIds.length &&
        (!template?.ids?.length || selectedIds.some((id) => !template.ids.includes(id)) || template.ids.some((id) => !state.selectedIds.has(id)));
      if (selectedDiffers && !window.confirm("Aplicar a proposta recomendada e substituir os itens selecionados?")) return;
      applyGuidedEvent(eventKey);
      showToast("Proposta base aplicada. Revise detalhes e valor antes de enviar.");
      break;
    }
    case "open_client_last": {
      const id = button?.dataset.serviceTarget || "";
      const kind = button?.dataset.serviceKind || "";
      if (kind === "proposal") await safeOpenSavedProposal(id, "Atendimento guiado");
      else if (kind === "request") await safeApplyQuoteRequest(id, "Atendimento guiado");
      break;
    }
    default:
      await runProposalNextStepAction(action);
      break;
  }
}

async function openWhatsApp() {
  if (!ensureProposalReadyForSending()) return;
  const phone = fields.clientPhone.value.trim();
  const confirmed = confirmClientSend({
    channel: "WhatsApp",
    destination: phone,
    title: "Proposta comercial",
    action: "enviar agora pela Z-API e registrar no histórico",
  });
  if (!confirmed) {
    showToast("Envio por WhatsApp cancelado.");
    return;
  }
  const share = await ensureProposalForSharing();
  if (!share?.saved || !share?.url) return;
  await sendProposalWhatsAppViaZapi({
    proposal: share.saved,
    proposalUrl: share.url,
    message: buildProposalWhatsAppMessage(share.url),
    title: "Proposta comercial",
    skipConfirm: true,
  });
}

function resetPrices() {
  const confirmed = window.confirm("Restaurar os preços originais da planilha enviada?");
  if (!confirmed) return;
  state.prices = clonePrices(initialPrices);
  savePrices();
  renderCategoryFilter();
  renderAll();
  showToast("Preços restaurados.");
}

function clearNewItemForm() {
  fields.newCodigo.value = "";
  fields.newTipo.value = "";
  fields.newNome.value = "";
  fields.newDescricao.value = "";
  if (fields.newResumoComercial) fields.newResumoComercial.value = "";
  if (fields.newPrioridadeComercial) fields.newPrioridadeComercial.value = "media";
  if (fields.newHorariosRecomendados) fields.newHorariosRecomendados.value = "";
  if (fields.newProdutoAtivo) fields.newProdutoAtivo.checked = true;
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
    commercialSummary: fields.newResumoComercial?.value.trim() || descricao,
    priority: fields.newPrioridadeComercial?.value || "media",
    recommendedWindows: fields.newHorariosRecomendados?.value.trim() || getDefaultRecommendedWindows({ tipoEvento: tipo }),
    active: fields.newProdutoAtivo?.checked !== false,
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
  state.productTypes = [...new Set([...(state.productTypes || []), tipo])];
  state.selectedIds.add(item.id);
  syncEventTypeFromSelection();
  savePrices();
  saveProductTypes();
  saveSelectedIds();
  renderCategoryFilter();
  if (fields.categoryFilter) fields.categoryFilter.value = tipo;
  clearNewItemForm();
  renderAll();
  showToast("Item criado e adicionado ao orçamento.");
}

const productCsvColumns = [
  ["id", "ID"],
  ["codigo", "Código"],
  ["tipoEvento", "Tipo"],
  ["nome", "Nome"],
  ["descricao", "Descrição"],
  ["commercialSummary", "Resumo comercial"],
  ["priority", "Prioridade"],
  ["recommendedWindows", "Horários indicados"],
  ["preco1h", "Preço 1h"],
  ["preco2h", "Preço 2h"],
  ["precoMeiaHoraExtra", "Preço 1/2h extra"],
  ["precoFixo", "Preço fixo"],
  ["valorAdicional", "Valor adicional"],
  ["minimo", "Mínimo"],
  ["idioma", "Idioma"],
  ["formula", "Fórmula"],
  ["active", "Ativo"],
];

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportProductsCsv() {
  const header = productCsvColumns.map(([, label]) => label).join(";");
  const rows = state.prices.map((item) =>
    productCsvColumns
      .map(([key]) => {
        if (key === "active") return item.active !== false ? "sim" : "não";
        return escapeCsvValue(item[key] ?? "");
      })
      .join(";"),
  );
  const csv = `\ufeff${[header, ...rows].join("\n")}`;
  downloadCsvFile(csv, `produtos-embaixada-carioca-${new Date().toISOString().slice(0, 10)}.csv`);
  showToast("Planilha de produtos exportada.");
}

function getProductsTemplateExamples() {
  return [
    {
      id: "modelo-coquetel-premium",
      codigo: "CP",
      tipoEvento: "Coquetel",
      nome: "Coquetel Premium",
      descricao: "Bebidas, petiscos e serviço conforme proposta.",
      commercialSummary: "Recepção completa para networking, celebrações e eventos corporativos.",
      priority: "alta",
      recommendedWindows: "Após 17h e 19h-21h",
      preco1h: "95",
      preco2h: "145",
      precoMeiaHoraExtra: "30",
      precoFixo: "",
      valorAdicional: "",
      minimo: "20",
      idioma: "",
      formula: "durationPerPerson",
      active: "sim",
    },
    {
      id: "modelo-extra-musica",
      codigo: "EX",
      tipoEvento: "Extras",
      nome: "Trio de Jazz/Bossa Nova",
      descricao: "Música ao vivo sob consulta de disponibilidade.",
      commercialSummary: "Experiência musical para valorizar recepção, coquetel ou almoço especial.",
      priority: "media",
      recommendedWindows: "Sob consulta",
      preco1h: "",
      preco2h: "",
      precoMeiaHoraExtra: "",
      precoFixo: "3500",
      valorAdicional: "",
      minimo: "1",
      idioma: "",
      formula: "fixedTotal",
      active: "sim",
    },
  ];
}

function buildProductsSpreadsheetHtml(products = state.prices, options = {}) {
  const { title = "Planilha de produtos e preços", subtitle = "", includeGuide = true, template = false } = options;
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const sourceProducts = (products || []).filter((item) => template || item.active !== false);
  const rows = sourceProducts
    .sort((a, b) => `${a.tipoEvento || ""} ${a.nome || ""}`.localeCompare(`${b.tipoEvento || ""} ${b.nome || ""}`, "pt-BR"))
    .map((item) => `
      <tr>
        ${productCsvColumns
          .map(([key]) => {
            const value = key === "active" ? (item.active !== false && item.active !== "não" ? "sim" : "não") : item[key] ?? "";
            return `<td>${escapeHtml(value)}</td>`;
          })
          .join("")}
      </tr>
    `)
    .join("");
  const guide = includeGuide
    ? `
        <section class="guide">
          <h2>Como usar</h2>
          <div class="quick-guide">
            <div>
              <strong>1. Preencha como uma tabela comercial</strong>
              <span>Tipo, nome, descrição, preços, mínimo, fórmula e ativo são os campos que o sistema importa.</span>
            </div>
            <div>
              <strong>2. Não altere os cabeçalhos</strong>
              <span>A primeira linha é o mapa de importação. Pode editar as linhas abaixo, mas mantenha os nomes das colunas.</span>
            </div>
            <div>
              <strong>3. Use número puro nos valores</strong>
              <span>Exemplos corretos: 95, 125, 3500. Não use R$, texto ou fórmula do Excel nos campos de preço.</span>
            </div>
          </div>
          <ol>
            <li>Edite apenas as linhas da tabela "Produtos para importar".</li>
            <li>Não renomeie nem apague a primeira linha da tabela.</li>
            <li>Campos obrigatórios: Tipo, Nome e Descrição.</li>
            <li>Use números sem "R$" nos preços. Exemplo: 95, 125 ou 3500.</li>
            <li>Depois de editar, volte ao sistema e clique em "Importar planilha".</li>
          </ol>
          <h2>Colunas principais</h2>
          <table class="formula-table">
            <tr><th>Coluna</th><th>O que significa</th><th>Dica de preenchimento</th></tr>
            <tr><td>Tipo</td><td>Categoria comercial do produto.</td><td>Ex.: Coquetel, Comidas, Workshop, Extras.</td></tr>
            <tr><td>Nome</td><td>Nome exibido para a equipe e na proposta.</td><td>Use nome curto e claro. Ex.: Coquetel Carioca.</td></tr>
            <tr><td>Descrição</td><td>O que está incluído.</td><td>Se o resumo comercial ficar vazio, este texto entra na proposta.</td></tr>
            <tr><td>Resumo comercial</td><td>Texto mais vendável para o cliente.</td><td>Use para deixar a proposta elegante e objetiva.</td></tr>
            <tr><td>Ativo</td><td>Define se o produto aparece no orçamento.</td><td>Use sim ou não.</td></tr>
          </table>
          <h2>Fórmulas aceitas</h2>
          <table class="formula-table">
            <tr><th>Fórmula</th><th>Quando usar</th><th>Campos principais</th></tr>
            <tr><td>durationPerPerson<br><small>Por pessoa + duração</small></td><td>Coquetel, café ou pacote por convidado com 1h, 2h e extra.</td><td>Preço 1h, Preço 2h, 1/2h extra e Mínimo</td></tr>
            <tr><td>serviceIncluded90PerPerson<br><small>1h30 taxa inclusa</small></td><td>Almoço Carioca ou produto com taxa já incluída no valor por pessoa.</td><td>Preço 1h, 1/2h extra e Mínimo</td></tr>
            <tr><td>perPersonFixed<br><small>Por pessoa fixo</small></td><td>Valor por pessoa que não muda com a duração.</td><td>Preço 1h e Mínimo</td></tr>
            <tr><td>fixedPlusPerPerson<br><small>Fixo + por pessoa</small></td><td>Workshop ou experiência com base fixa e adicional por pessoa acima do mínimo.</td><td>Preço fixo, Valor adicional e Mínimo</td></tr>
            <tr><td>fixedCoversMinimum<br><small>Fixo inclui mínimo</small></td><td>Valor fechado que cobre até o mínimo e cobra adicional acima disso.</td><td>Preço fixo, Valor adicional e Mínimo</td></tr>
            <tr><td>fixedTotal<br><small>Valor fixo total</small></td><td>DJ, decoração, audiovisual, taxa ou extra cobrado uma única vez.</td><td>Preço fixo</td></tr>
          </table>
        </section>`
    : "";
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <style>
          body { color: #153d2d; font-family: Arial, sans-serif; margin: 18px; }
          h1 { color: #153d2d; font-size: 24px; margin: 0; }
          h2 { color: #153d2d; font-size: 15px; margin: 18px 0 8px; text-transform: uppercase; }
          .meta { color: #66736e; font-size: 12px; font-weight: 700; margin: 6px 0 14px; }
          .hero { background: #eef5f0; border-left: 6px solid #153d2d; border-radius: 10px; margin-bottom: 16px; padding: 14px 16px; }
          .hero p { color: #66736e; font-size: 12px; font-weight: 700; margin: 6px 0 0; }
          .guide { background: #fff8e8; border: 1px solid #f2c469; border-radius: 10px; margin: 12px 0 18px; padding: 12px 16px; }
          .quick-guide { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); margin: 8px 0 12px; }
          .quick-guide div { background: #ffffff; border: 1px solid #eadfca; border-radius: 8px; padding: 10px; }
          .quick-guide strong { color: #153d2d; display: block; font-size: 12px; margin-bottom: 4px; }
          .quick-guide span { color: #66736e; display: block; font-size: 11px; font-weight: 700; line-height: 1.35; }
          .guide ol { font-size: 12px; font-weight: 700; line-height: 1.45; margin: 0 0 10px 18px; padding: 0; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #153d2d; color: #ffffff; font-size: 11px; padding: 8px; text-align: left; }
          td { border: 1px solid #d9e1dc; font-size: 10px; padding: 7px; vertical-align: top; }
          tr:nth-child(even) td { background: #f4f8f5; }
          .formula-table th { background: #2e6b53; }
          .formula-table td { font-size: 11px; }
          .formula-table small { color: #66736e; font-weight: 700; }
          .money { mso-number-format:"R$ #,##0.00"; }
        </style>
      </head>
      <body>
        <div class="hero">
          <h1>Embaixada Carioca - ${escapeHtml(title)}</h1>
          <div class="meta">Gerado em ${escapeHtml(generatedAt)} · ${sourceProducts.length} produto(s)</div>
          <p>${escapeHtml(subtitle || "Use esta planilha para revisar produtos, preços e regras comerciais com segurança.")}</p>
        </div>
        ${guide}
        <h2>Produtos para importar</h2>
        <table data-products-table="true">
          <thead>
            <tr>
              ${productCsvColumns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${productCsvColumns.length}">Nenhum produto encontrado.</td></tr>`}</tbody>
        </table>
      </body>
    </html>`;
}

function exportProductsExcel() {
  const html = buildProductsSpreadsheetHtml(state.prices, {
    title: "produtos e preços atuais",
    subtitle: "Exportação da tabela atual. Edite com cuidado e importe de volta somente depois de conferir.",
    includeGuide: true,
  });
  downloadExcelFile(html, `produtos-embaixada-carioca-${new Date().toISOString().slice(0, 10)}.xls`);
  showToast("Planilha Excel exportada.");
}

function downloadProductsTemplateGuide() {
  const html = buildProductsSpreadsheetHtml(getProductsTemplateExamples(), {
    title: "modelo guiado de produtos",
    subtitle: "Preencha este modelo para cadastrar ou atualizar produtos sem precisar conhecer o sistema.",
    includeGuide: true,
    template: true,
  });
  downloadExcelFile(html, "modelo-guiado-produtos-embaixada-carioca.xls");
  showToast("Modelo guiado baixado.");
}

function downloadCsvFile(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadExcelFile(html, filename) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getProductFormulaLabel(formula) {
  const labels = {
    durationPerPerson: "Por pessoa + duração",
    serviceIncluded90PerPerson: "1h30 por pessoa, taxa inclusa",
    perPersonFixed: "Por pessoa fixo",
    fixedPlusPerPerson: "Fixo + por pessoa",
    fixedCoversMinimum: "Fixo inclui mínimo",
    fixedTotal: "Valor fixo total",
  };
  return labels[formula] || formula || "Por pessoa + duração";
}

function formatProductMoney(value) {
  const text = String(value ?? "").trim();
  const number = Number(text.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return number ? formatMoney(number) : "-";
}

function buildPrintableProductsHtml() {
  const activeProducts = state.prices.filter((item) => item.active !== false);
  const grouped = activeProducts.reduce((acc, item) => {
    const type = item.tipoEvento || "Sem tipo";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});
  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const groups = Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((type) => `
      <section class="print-group">
        <h2>${escapeHtml(type)} <small>${grouped[type].length} item(ns)</small></h2>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th>Resumo</th>
              <th>1h</th>
              <th>2h</th>
              <th>Extra</th>
              <th>Fixo</th>
              <th>Mín.</th>
              <th>Fórmula</th>
            </tr>
          </thead>
          <tbody>
            ${grouped[type].map((item) => `
              <tr>
                <td>${escapeHtml(item.codigo || "-")}</td>
                <td><strong>${escapeHtml(item.nome || "-")}</strong><br><span>${escapeHtml(item.priority || "média")}</span></td>
                <td>${escapeHtml(item.commercialSummary || item.descricao || "-")}</td>
                <td>${formatProductMoney(item.preco1h)}</td>
                <td>${formatProductMoney(item.preco2h)}</td>
                <td>${formatProductMoney(item.precoMeiaHoraExtra)}</td>
                <td>${formatProductMoney(item.precoFixo)}</td>
                <td>${escapeHtml(item.minimo ?? "-")}</td>
                <td>${escapeHtml(getProductFormulaLabel(item.formula))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `).join("");
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Catálogo de produtos - Embaixada Carioca</title>
        <style>
          @page { margin: 14mm; size: A4 landscape; }
          * { box-sizing: border-box; }
          body { color: #153d2d; font-family: Arial, sans-serif; margin: 0; }
          header { align-items: center; border-bottom: 2px solid #153d2d; display: flex; justify-content: space-between; margin-bottom: 18px; padding-bottom: 12px; }
          h1 { font-size: 24px; line-height: 1; margin: 0; }
          p { color: #66736e; font-size: 11px; font-weight: 700; margin: 4px 0 0; }
          .summary { background: #eef5f0; border-left: 5px solid #153d2d; border-radius: 8px; color: #153d2d; font-size: 12px; font-weight: 700; margin-bottom: 16px; padding: 10px 12px; }
          .print-group { break-inside: avoid; margin-bottom: 18px; }
          h2 { color: #153d2d; font-size: 15px; margin: 0 0 8px; text-transform: uppercase; }
          h2 small { color: #f39200; font-size: 11px; margin-left: 8px; text-transform: none; }
          table { border-collapse: collapse; font-size: 10px; width: 100%; }
          th { background: #153d2d; color: #fff; padding: 7px 6px; text-align: left; }
          td { border-bottom: 1px solid #d9e1dc; padding: 7px 6px; vertical-align: top; }
          td:nth-child(3) { max-width: 280px; }
          span { color: #66736e; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <p>EMBAIXADA CARIOCA</p>
            <h1>Catálogo de produtos e preços</h1>
          </div>
          <p>Gerado em ${escapeHtml(generatedAt)}</p>
        </header>
        <div class="summary">${activeProducts.length} produto(s) ativo(s). Use esta versão para conferência interna, treinamento e revisão comercial.</div>
        ${groups || "<p>Nenhum produto ativo encontrado.</p>"}
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`;
}

function printProductsCatalog() {
  const win = window.open("", "_blank");
  if (!win) {
    showToast("Permita pop-ups para imprimir o catálogo.");
    return;
  }
  win.document.open();
  win.document.write(buildPrintableProductsHtml());
  win.document.close();
}

function parseCsvTable(text) {
  const cleanText = String(text || "").replace(/^\ufeff/, "");
  const delimiter = (cleanText.split("\n")[0].match(/;/g) || []).length >= (cleanText.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const next = cleanText[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function parseProductsHtmlTable(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(text || ""), "text/html");
  const table = doc.querySelector("table[data-products-table='true']") || doc.querySelector("table");
  if (!table) return [];
  const headerCells = Array.from(table.querySelectorAll("thead th")).map((cell) => cell.textContent.trim());
  const rows = Array.from(table.querySelectorAll("tbody tr"))
    .map((row) => Array.from(row.children).map((cell) => cell.textContent.trim()))
    .filter((row) => row.some(Boolean));
  return headerCells.length ? [headerCells, ...rows] : rows;
}

function parseProductsSheetTable(text) {
  const source = String(text || "");
  if (/<table[\s>]/i.test(source) || /<html[\s>]/i.test(source)) return parseProductsHtmlTable(source);
  return parseCsvTable(source);
}

function normalizeCsvHeader(value) {
  return normalizarTextoSeguro(value).replace(/\s+/g, "");
}

function mapProductCsvHeaders(headerRow) {
  const aliases = {
    id: "id",
    codigo: "codigo",
    cod: "codigo",
    tipo: "tipoEvento",
    tipoevento: "tipoEvento",
    categoria: "tipoEvento",
    nome: "nome",
    produto: "nome",
    descricao: "descricao",
    descrio: "descricao",
    resumocomercial: "commercialSummary",
    resumo: "commercialSummary",
    prioridade: "priority",
    horariosindicados: "recommendedWindows",
    horriosindicados: "recommendedWindows",
    janelarecomendada: "recommendedWindows",
    preco1h: "preco1h",
    preo1h: "preco1h",
    preco2h: "preco2h",
    preo2h: "preco2h",
    preco12hextra: "precoMeiaHoraExtra",
    preo12hextra: "precoMeiaHoraExtra",
    precoextrameiahora: "precoMeiaHoraExtra",
    precofixo: "precoFixo",
    preofixo: "precoFixo",
    valoradicional: "valorAdicional",
    adicional: "valorAdicional",
    minimo: "minimo",
    mnimo: "minimo",
    idioma: "idioma",
    formula: "formula",
    frmula: "formula",
    ativo: "active",
  };
  return headerRow.map((cell) => aliases[normalizeCsvHeader(cell)] || "");
}

function normalizeImportedProduct(row, headerMap, index) {
  const item = {};
  headerMap.forEach((key, cellIndex) => {
    if (key) item[key] = String(row[cellIndex] ?? "").trim();
  });
  item.tipoEvento = item.tipoEvento || "";
  item.nome = item.nome || "";
  item.descricao = item.descricao || item.commercialSummary || "";
  if (!item.tipoEvento || !item.nome || !item.descricao) return null;
  item.id = item.id || `import-${slugify(item.tipoEvento)}-${slugify(item.nome)}-${Date.now()}-${index}`;
  item.codigo = item.codigo || "IMP";
  item.commercialSummary = item.commercialSummary || item.descricao;
  item.priority = ["alta", "media", "baixa"].includes(normalizarTextoSeguro(item.priority)) ? normalizarTextoSeguro(item.priority) : "media";
  item.recommendedWindows = item.recommendedWindows || getDefaultRecommendedWindows(item);
  item.active = !["nao", "não", "false", "0", "inativo"].includes(normalizarTextoSeguro(item.active));
  item.preco1h = item.preco1h || "";
  item.preco2h = item.preco2h || "";
  item.precoMeiaHoraExtra = item.precoMeiaHoraExtra || "";
  item.precoFixo = item.precoFixo || "";
  item.valorAdicional = item.valorAdicional || "";
  item.minimo = item.minimo || 0;
  item.idioma = item.idioma || "";
  const formulaAliases = {
    durationperperson: "durationPerPerson",
    porpessoaduracao: "durationPerPerson",
    porpessoaeduracao: "durationPerPerson",
    serviceincluded90perperson: "serviceIncluded90PerPerson",
    "1h30porpessoataxainclusa": "serviceIncluded90PerPerson",
    perpersonfixed: "perPersonFixed",
    porpessoafixo: "perPersonFixed",
    fixedplusperperson: "fixedPlusPerPerson",
    fixoporpessoa: "fixedPlusPerPerson",
    fixomaisporpessoa: "fixedPlusPerPerson",
    fixedcoversminimum: "fixedCoversMinimum",
    fixoincluiminimo: "fixedCoversMinimum",
    fixedtotal: "fixedTotal",
    valorfixototal: "fixedTotal",
  };
  item.formula = formulaAliases[normalizeCsvHeader(item.formula)] || item.formula || "durationPerPerson";
  item.custom = !initialPrices.some((catalogItem) => catalogItem.id === item.id);
  return normalizeCatalogItem(item);
}

async function importProductsCsv(file) {
  if (!file) return;
  if (/\.xlsx$/i.test(file.name || "")) {
    showToast("Use CSV ou o modelo Excel (.xls) baixado pelo sistema. Arquivo .xlsx direto ainda não é importado.");
    return;
  }
  const text = await file.text();
  const rows = parseProductsSheetTable(text);
  if (rows.length < 2) {
    showToast("A planilha não tem produtos para importar. Use o modelo guiado e mantenha a tabela de produtos.");
    return;
  }
  const headerMap = mapProductCsvHeaders(rows[0]);
  const imported = rows
    .slice(1)
    .map((row, index) => normalizeImportedProduct(row, headerMap, index))
    .filter(Boolean);
  if (!imported.length) {
    showToast("Nenhum produto válido encontrado. Confira se Tipo, Nome e Descrição estão preenchidos.");
    return;
  }
  const confirmed = window.confirm(
    `Importar ${imported.length} produto(s) e substituir a lista atual neste navegador?\n\nDica: exporte uma cópia antes se quiser preservar a tabela atual.`,
  );
  if (!confirmed) return;
  state.prices = imported;
  state.productTypes = getProductTypes();
  state.selectedIds = new Set([...state.selectedIds].filter((id) => state.prices.some((item) => item.id === id)));
  savePrices();
  saveProductTypes();
  saveSelectedIds();
  renderCategoryFilter();
  renderAll();
  showToast(`${imported.length} produto(s) importado(s). Confira a tabela antes de usar em proposta.`);
}

function addProductType() {
  const type = fields.newProductTypeName?.value.trim();
  if (!type) {
    showToast("Digite o nome do novo tipo.");
    return;
  }
  state.productTypes = [...new Set([...(state.productTypes || []), type])];
  saveProductTypes();
  renderCategoryFilter();
  renderProductTypeManager();
  if (fields.newTipo) fields.newTipo.value = type;
  if (fields.newProductTypeName) fields.newProductTypeName.value = "";
  showToast("Tipo criado. Agora cadastre o primeiro produto dele.");
}

function bindEvents() {
  Object.values(fields).forEach((field) => {
    if (!field) return;
    const refreshFormOutputs = (event) => {
      if (event?.target === fields.eventDateTime) {
        syncFieldsFromDateTime();
      } else if (event?.target === fields.eventDate || event?.target === fields.eventTime) {
        syncDateTimeFromFields();
      }
      renderPriceList();
      renderAvailabilityAlert();
      renderFormSourcePanel();
      renderServiceCockpit();
      renderLeadReviewPanel();
      renderProposalNextStep();
      renderQuickReplies();
      renderLoadedEditorBar();
      renderSummary();
      renderSendReview();
      renderCalculation();
      renderProposal();
    };
    field.addEventListener("input", refreshFormOutputs);
    field.addEventListener("change", refreshFormOutputs);
  });

  fields.clientPhone?.addEventListener("input", () => {
    fields.clientPhone.value = formatPhoneForField(fields.clientPhone.value);
  });

  fields.newFormula?.addEventListener("change", updateFormulaHelp);
  document.querySelectorAll("[data-formula-option]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!fields.newFormula || !button.dataset.formulaOption) return;
      fields.newFormula.value = button.dataset.formulaOption;
      updateFormulaHelp();
    });
  });
  updateFormulaHelp();

  fields.eventDateTime?.setAttribute("step", "1800");

  fields.categoryFilter?.addEventListener("change", renderPriceList);
  fields.eventDuration?.addEventListener("change", renderAll);

  nodes.flowEventOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-flow-event]");
    if (!button) return;
    applyGuidedEvent(button.dataset.flowEvent);
  });

  nodes.flowBeverageOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-select-package]");
    if (!button) return;
    applyGuidedPackage(button.dataset.selectPackage);
  });

  nodes.flowFoodOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-select-package]");
    if (!button) return;
    applyGuidedPackage(button.dataset.selectPackage);
  });

  nodes.flowWelcomeOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-select-package]");
    if (!button) return;
    applyGuidedPackage(button.dataset.selectPackage);
  });

  nodes.flowWorkshopOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-select-package]");
    if (!button) return;
    applyGuidedPackage(button.dataset.selectPackage);
  });

  nodes.optionalPrivatizationControls?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-privatization-choice]");
    if (!button) return;
    state.privatizationChoice = button.dataset.privatizationChoice;
    renderSummary();
    renderCalculation();
    renderProposal();
  });

  nodes.privatizationRulesTable?.addEventListener("input", (event) => {
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

  fields.generalTerms?.addEventListener("input", saveGeneralTerms);

  nodes.priceList?.addEventListener("change", (event) => {
    const id = event.target.dataset.selectId;
    if (!id) return;
    if (event.target.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    syncEventTypeFromSelection();
    saveSelectedIds();
    renderSummary();
    renderSendReview();
    renderProposal();
  });

  nodes.pricesTable?.addEventListener("input", (event) => {
    const { priceId, field } = event.target.dataset;
    if (!priceId || !field) return;
    const item = state.prices.find((price) => price.id === priceId);
    if (!item) return;
    item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    savePrices();
    renderPriceList();
    renderCommercialLibrarySummary();
    renderSummary();
    renderProposal();
  });

  nodes.pricesTable?.addEventListener("change", (event) => {
    const { priceId, field } = event.target.dataset;
    if (!priceId || !["formula", "priority", "active"].includes(field)) return;
    const item = state.prices.find((price) => price.id === priceId);
    if (!item) return;
    item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    savePrices();
    renderAll();
  });

  document.querySelector("#printBtn")?.addEventListener("click", () => window.print());
  document.querySelector("#newProposalBtn")?.addEventListener("click", startNewProposal);
  nodes.startManualProposalBtn?.addEventListener("click", startNewProposal);
  nodes.startRealizedEventBtn?.addEventListener("click", startRealizedEventRegistration);
  nodes.openNextPriorityBtn?.addEventListener("click", () => openNextPriorityItem());
  nodes.jumpToPipelineBtn?.addEventListener("click", () => {
    document.querySelector(".pipeline-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  nodes.loadedEditorBar?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-return-pipeline-stage]");
    if (!button) return;
    jumpToPipelineStage(button.dataset.returnPipelineStage);
  });
  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal());
  document.querySelector("#confirmEventBtn")?.addEventListener("click", confirmCurrentEvent);
  document.querySelector("#copyBtn")?.addEventListener("click", copyProposalLink);
  document.addEventListener("click", (event) => {
    const emailButton = event.target.closest?.("#emailBtn");
    if (emailButton) {
      event.preventDefault();
      openEmail();
      return;
    }
    const whatsappButton = event.target.closest?.("#whatsappBtn");
    if (whatsappButton) {
      event.preventDefault();
      openWhatsApp();
    }
  });
  document.querySelector("#resetPricesBtn")?.addEventListener("click", resetPrices);
  document.querySelector("#saveCommunicationTemplatesBtn")?.addEventListener("click", handleSaveCommunicationTemplates);
  document.querySelector("#resetCommunicationTemplatesBtn")?.addEventListener("click", handleResetCommunicationTemplates);
  document.querySelector("#clearFlowBtn")?.addEventListener("click", clearGuidedFlow);
  document.querySelector("#addItemBtn")?.addEventListener("click", createNewItem);
  document.querySelector("#addProductTypeBtn")?.addEventListener("click", addProductType);
  document.querySelector("#downloadPricesTemplateBtn")?.addEventListener("click", downloadProductsTemplateGuide);
  document.querySelector("#exportPricesBtn")?.addEventListener("click", exportProductsCsv);
  document.querySelector("#exportPricesExcelBtn")?.addEventListener("click", exportProductsExcel);
  document.querySelector("#printPricesBtn")?.addEventListener("click", printProductsCatalog);
  document.querySelector("#importPricesBtn")?.addEventListener("click", () => {
    document.querySelector("#importPricesFile")?.click();
  });
  document.querySelector("#importPricesFile")?.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    await importProductsCsv(file);
    event.target.value = "";
  });
  nodes.productTypeList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-type]");
    if (!button) return;
    const type = button.dataset.productType || "";
    if (fields.newTipo) fields.newTipo.value = type;
    if (fields.categoryFilter) {
      fields.categoryFilter.value = type;
      renderPriceList();
    }
    fields.newNome?.focus();
    showToast(`Tipo "${type}" selecionado para novo produto.`);
  });
  document.querySelector("#saveSupabaseConfigBtn")?.addEventListener("click", configureSupabaseFromForm);
  document.querySelector("#loginBtn")?.addEventListener("click", loginWithEmail);
  document.querySelectorAll("[data-team-email]").forEach((button) => {
    button.addEventListener("click", () => {
      fields.loginEmail.value = button.dataset.teamEmail;
      fields.loginEmail.focus();
    });
  });
  document.querySelector("#recoverMagicLinkBtn")?.addEventListener("click", recoverMagicLinkSession);
  document.querySelector("#logoutBtn")?.addEventListener("click", logoutSupabase);
  document.querySelector("#refreshHistoryBtn")?.addEventListener("click", loadProposalHistory);
  document.querySelector("#refreshPipelineBtn")?.addEventListener("click", async () => {
    await loadProposalHistory();
    await loadQuoteRequests();
  });
  document.querySelector("#refreshReportsBtn")?.addEventListener("click", async () => {
    await loadProposalHistory();
    await loadQuoteRequests();
    renderDashboardReports(getPipelineItems());
  });
  document.querySelector("#runSystemHealthBtn")?.addEventListener("click", runSystemHealthCheck);
  document.querySelector("#clearIntegrationLogBtn")?.addEventListener("click", () => {
    if (!state.integrationLogs.length) return;
    if (!window.confirm("Limpar o diário visual de envios deste navegador? O histórico comercial das propostas não será apagado.")) return;
    state.integrationLogs = [];
    saveIntegrationLogs();
    renderIntegrationLogs();
  });
  document.querySelector("#applyCustomReportBtn")?.addEventListener("click", applyCustomReport);
  nodes.reportPresets?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-preset]");
    if (!button) return;
    selectReportPreset(button.dataset.reportPreset);
  });
  nodes.reportOutput?.addEventListener("click", async (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      await safeOpenSavedProposal(proposalButton.dataset.proposalId, "Relatório");
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) await safeApplyQuoteRequest(requestButton.dataset.useRequest, "Relatório");
  });
  nodes.actionList?.addEventListener("click", async (event) => {
    const changeButton = event.target.closest("[data-client-change-id]");
    if (changeButton) {
      showClientChangeDetails(changeButton.dataset.clientChangeKind, changeButton.dataset.clientChangeId);
      return;
    }
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      await safeOpenSavedProposal(proposalButton.dataset.proposalId, "Prioridade agora");
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) {
      await safeApplyQuoteRequest(requestButton.dataset.useRequest, "Prioridade agora");
      return;
    }
    if (!isInteractivePipelineTarget(event.target)) {
      await openActionElement(event.target.closest("[data-action-id]"), "Prioridade agora");
    }
  });
  nodes.actionList?.addEventListener("keydown", async (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const action = event.target.closest?.("[data-action-id]");
    if (!action || event.target !== action) return;
    event.preventDefault();
    await openActionElement(action, "Prioridade agora");
  });
  nodes.operationsAgenda?.addEventListener("click", async (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      await safeOpenSavedProposal(proposalButton.dataset.proposalId, "Agenda operacional");
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) await safeApplyQuoteRequest(requestButton.dataset.useRequest, "Agenda operacional");
  });
  fields.globalSearchInput?.addEventListener("input", () => {
    const items = getPipelineItems();
    renderGlobalSearch(items);
    renderClientRegistry(items);
  });
  nodes.globalSearchResults?.addEventListener("click", async (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      await safeOpenSavedProposal(proposalButton.dataset.proposalId, "Busca global");
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) await safeApplyQuoteRequest(requestButton.dataset.useRequest, "Busca global");
  });
  nodes.clientDirectory?.addEventListener("click", async (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      await safeOpenSavedProposal(proposalButton.dataset.proposalId, "Cadastro de clientes");
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) await safeApplyQuoteRequest(requestButton.dataset.useRequest, "Cadastro de clientes");
  });
  nodes.pipelineQuickFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pipeline-filter]");
    if (!button) return;
    state.activePipelineFilter = button.dataset.pipelineFilter || "all";
    renderPipeline();
  });
  nodes.ownerMetrics?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pipeline-stage-jump]");
    if (!button) return;
    jumpToPipelineStage(button.dataset.pipelineStageJump);
  });
  nodes.proposalNextStep?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-next-step-action]");
    if (!button) return;
    runProposalNextStepAction(button.dataset.nextStepAction);
  });
  nodes.serviceCockpit?.addEventListener("click", (event) => {
    const reviewButton = event.target.closest("[data-service-review-target]");
    if (reviewButton) {
      scrollToReviewTarget(reviewButton.dataset.serviceReviewTarget);
      return;
    }
    const nextButton = event.target.closest("button[data-service-next-action]");
    if (nextButton) {
      runServiceCockpitAction(nextButton.dataset.serviceNextAction, nextButton);
      return;
    }
    const actionButton = event.target.closest("button[data-service-action]");
    if (actionButton) runServiceCockpitAction(actionButton.dataset.serviceAction, actionButton);
  });
  nodes.formSourcePanel?.addEventListener("input", handleFormSourceFieldInput);
  nodes.formSourcePanel?.addEventListener("change", handleFormSourceFieldChange);
  document.addEventListener("input", captureFormSourceFieldValue, true);
  document.addEventListener("change", captureFormSourceFieldValue, true);
  nodes.leadReviewPanel?.addEventListener("click", (event) => {
    const upsellButton = event.target.closest("button[data-upsell-add]");
    if (upsellButton) {
      applyUpsellSuggestion(upsellButton.dataset.upsellAdd);
      return;
    }
    const reviewButton = event.target.closest("button[data-review-target]");
    if (reviewButton) scrollToReviewTarget(reviewButton.dataset.reviewTarget);
  });
  nodes.sendReviewPanel?.addEventListener("pointerdown", (event) => {
    const actionButton = event.target.closest("button[data-send-review-action]");
    if (!actionButton || actionButton.dataset.sendReviewAction !== "approve") return;
    event.preventDefault();
    state.lastSendReviewPointerApprovalAt = Date.now();
    approveSendReview();
  });
  nodes.sendReviewPanel?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("button[data-send-review-action]");
    if (actionButton) {
      event.preventDefault();
      const action = actionButton.dataset.sendReviewAction;
      if (action === "whatsapp") {
        openWhatsApp();
        return;
      }
      if (action === "email") {
        openEmail();
        return;
      }
      if (action === "approve") {
        if (Date.now() - state.lastSendReviewPointerApprovalAt < 500) return;
        approveSendReview();
        return;
      }
      scrollToReviewTarget(actionButton.dataset.reviewTarget || "client");
      return;
    }
    const button = event.target.closest("button[data-review-target]");
    if (!button) return;
    scrollToReviewTarget(button.dataset.reviewTarget);
  });
  nodes.quickReplies?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-quick-reply][data-quick-reply-channel]");
    if (!button) return;
    runQuickReply(button.dataset.quickReply, button.dataset.quickReplyChannel);
  });
  nodes.operationalChecklist?.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-checklist-id]");
    if (!checkbox) return;
    updateOperationalChecklist(checkbox.dataset.checklistId, checkbox.checked);
  });
  nodes.operationalChecklist?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-operational-doc]");
    if (!button) return;
    handleOperationalDocAction(button.dataset.operationalDoc);
  });
  nodes.internalNotesPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-add-internal-comment]");
    if (!button) return;
    addInternalComment(button.dataset.addInternalComment);
  });
  nodes.eventAttachmentsPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-add-event-attachment]");
    if (!button) return;
    addEventAttachment(button.dataset.addEventAttachment);
  });
  document.querySelector("#copyClientFormLinkBtn")?.addEventListener("click", copyClientFormLink);
  nodes.historyList?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-proposal-id]");
    if (!button) return;
    await safeOpenSavedProposal(button.dataset.proposalId, "Histórico");
  });
  nodes.pipelineBoard?.addEventListener("click", async (event) => {
    const changeButton = event.target.closest("[data-client-change-id]");
    if (changeButton) {
      showClientChangeDetails(changeButton.dataset.clientChangeKind, changeButton.dataset.clientChangeId);
      return;
    }
    const button = event.target.closest("button[data-proposal-id]");
    if (button) {
      await safeOpenSavedProposal(button.dataset.proposalId, "Funil");
      return;
    }
    const paidButton = event.target.closest("button[data-mark-paid]");
    if (paidButton) {
      updateProposalStatus(paidButton.dataset.markPaid, "confirmado");
      return;
    }
    const finalPaymentButton = event.target.closest("button[data-mark-final-payment]");
    if (finalPaymentButton) {
      updateProposalStatus(finalPaymentButton.dataset.markFinalPayment, "planejamento");
      return;
    }
    const useButton = event.target.closest("button[data-use-request]");
    if (useButton) {
      await safeApplyQuoteRequest(useButton.dataset.useRequest, "Funil: Lead");
      return;
    }
    const markButton = event.target.closest("button[data-mark-request]");
    if (markButton) markQuoteRequestAnalyzed(markButton.dataset.markRequest);
    const cancelButton = event.target.closest("button[data-cancel-id]");
    if (cancelButton) cancelPipelineItem(cancelButton.dataset.cancelKind, cancelButton.dataset.cancelId);
    const reopenButton = event.target.closest("button[data-reopen-id]");
    if (reopenButton) reopenPipelineItem(reopenButton.dataset.reopenKind, reopenButton.dataset.reopenId);
    const deleteButton = event.target.closest("button[data-delete-id]");
    if (deleteButton) deleteTestPipelineItem(deleteButton.dataset.deleteKind, deleteButton.dataset.deleteId);
    const card = event.target.closest("[data-pipeline-card-id]");
    if (card && !isInteractivePipelineTarget(event.target)) {
      await openPipelineCardElement(card);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeClientChangeDialog();
  });
  nodes.pipelineBoard?.addEventListener("keydown", async (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const card = event.target.closest?.("[data-pipeline-card-id]");
    if (!card || event.target !== card) return;
    event.preventDefault();
    await openPipelineCardElement(card);
  });
  nodes.pipelineBoard?.addEventListener("change", (event) => {
    const select = event.target.closest("select[data-pipeline-status-id]");
    if (!select) return;
    const { pipelineStatusKind, pipelineStatusId } = select.dataset;
    movePipelineItem(pipelineStatusKind, pipelineStatusId, select.value);
  });
  nodes.pipelineBoard?.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-pipeline-card-id]");
    if (!card) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        kind: card.dataset.pipelineCardKind,
        id: card.dataset.pipelineCardId,
      }),
    );
    card.classList.add("is-dragging");
  });
  nodes.pipelineBoard?.addEventListener("dragend", (event) => {
    event.target.closest("[data-pipeline-card-id]")?.classList.remove("is-dragging");
    document.querySelectorAll(".pipeline-column-list.is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
  });
  nodes.pipelineBoard?.addEventListener("dragover", (event) => {
    const dropZone = event.target.closest("[data-pipeline-drop-status]");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.add("is-drop-target");
  });
  nodes.pipelineBoard?.addEventListener("dragleave", (event) => {
    const dropZone = event.target.closest("[data-pipeline-drop-status]");
    if (dropZone && !dropZone.contains(event.relatedTarget)) dropZone.classList.remove("is-drop-target");
  });
  nodes.pipelineBoard?.addEventListener("drop", (event) => {
    const dropZone = event.target.closest("[data-pipeline-drop-status]");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.remove("is-drop-target");
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      movePipelineItem(payload.kind, payload.id, dropZone.dataset.pipelineDropStatus);
    } catch (error) {
      console.warn("Falha ao mover card no funil.", error);
    }
  });
}

renderCategoryFilter();
renderPrivatizationRulesTable();
renderClientFormLink();
initializeReportDefaults();
if (fields.generalTerms) fields.generalTerms.value = loadGeneralTerms();
syncDateTimeFromFields();
syncDashboardDeepLinkState();
window.addEventListener("hashchange", async () => {
  syncDashboardDeepLinkState();
  await applyPendingDashboardTarget();
});
bindEvents();
renderAll();
if (QA_MODE) {
  initQaMode();
} else {
  initSupabase();
}
