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
const CANONICAL_PUBLIC_PROPOSAL_URL = "https://leorangel22.github.io/main/proposta.html";
const TEAM_EMAILS = ["eventos@embaixadacarioca.com.br", "leorangel@gmail.com"];
const SERVICE_RATE = 0.12;
const paymentTerms = [
  "50% do valor total na confirmação da reserva.",
  "50% restante até 72 horas antes do evento.",
];
const signalPaymentBanks = ["Itaú", "Santander", "Nubank", "Stone"];

const operationalChecklistItems = [
  { id: "saldo_agendado", label: "Pagamento restante alinhado" },
  { id: "cardapio_confirmado", label: "Cardápio e bebidas confirmados" },
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
    description: "Finalizado. Follow-up e relacionamento.",
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
    status: "Coquetel selecionado. Escolha bebidas, comidas e, se fizer sentido, adicione workshop como experiência.",
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
  selectedIds: loadSelectedIds(),
  privatizationRules: loadPrivatizationRules(),
  supabase: null,
  session: null,
  proposals: [],
  quoteRequests: [],
  activeProposalId: "",
  activeQuoteRequestId: "",
  pendingDashboardLeadId: "",
  pendingDashboardProposalId: "",
  lastAppliedDashboardTarget: "",
  activeReportPreset: "currentMonth",
  activePipelineFilter: "all",
  quoteGuideDismissed: false,
  guided: {
    event: "",
    beverageId: "",
    foodId: "",
    workshopId: "",
  },
  privatizationChoice: "",
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
  categoryOptions: document.querySelector("#categoryOptions"),
  flowStatus: document.querySelector("#flowStatus"),
  coquetelChoices: document.querySelector("#coquetelChoices"),
  flowEventOptions: document.querySelector("#flowEventOptions"),
  flowBeverageOptions: document.querySelector("#flowBeverageOptions"),
  flowFoodOptions: document.querySelector("#flowFoodOptions"),
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
  quoteEmptyState: document.querySelector("#quoteEmptyState"),
  reportOutput: document.querySelector("#reportOutput"),
  reportPresets: document.querySelector(".report-presets"),
  clientFormLink: document.querySelector("#clientFormLink"),
  availabilityAlert: document.querySelector("#availabilityAlert"),
  proposalNextStep: document.querySelector("#proposalNextStep"),
  signalPaymentInfo: document.querySelector("#signalPaymentInfo"),
  operationalChecklist: document.querySelector("#operationalChecklist"),
  commercialTimeline: document.querySelector("#commercialTimeline"),
  quickReplies: document.querySelector("#quickReplies"),
  startManualProposalBtn: document.querySelector("#startManualProposalBtn"),
  jumpToPipelineBtn: document.querySelector("#jumpToPipelineBtn"),
  globalSearchResults: document.querySelector("#globalSearchResults"),
  clientDirectory: document.querySelector("#clientDirectory"),
  clientRegistryMeta: document.querySelector("#clientRegistryMeta"),
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function loadPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return mergeCatalogLabels(saved).map(normalizeCatalogItem);
  } catch (error) {
    console.warn("Nao foi possivel carregar precos salvos.", error);
  }
  return clonePrices(initialPrices).map(normalizeCatalogItem);
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
  const type = String(item.tipoEvento || "").toLowerCase();
  if (type.includes("coquetel") || type.includes("welcome") || type.includes("café") || type.includes("coffee")) return "alta";
  if (type.includes("snacks")) return "baixa";
  return "media";
}

function getDefaultRecommendedWindows(item) {
  const type = String(item.tipoEvento || "").toLowerCase();
  if (type.includes("café") || type.includes("coffee")) return "Manhã de 2ª a 6ª";
  if (type.includes("almoço")) return "Início do almoço em dias úteis";
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
  return `
    <span>${escapeHtml(title)}</span>
    <strong>${formatMoney(payment.valor)} · ${escapeHtml(formatSignalPaymentDate(payment.data))} · ${escapeHtml(banks)}</strong>
    <small>${proof}</small>
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

function createCommercialHistoryEntry(type, title, detail, extra = {}) {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title,
    detail,
    at: new Date().toISOString(),
    actor: getCommercialActor(),
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

function getHistoryTone(entry = {}) {
  const text = `${entry.type || ""} ${entry.title || ""}`.toLowerCase();
  if (entry.type === "proposta_agrupada") return "muted";
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
    muted: "AJUSTE",
    proposal: "PROP",
  };
  return labels[tone] || "LOG";
}

function getCompactCommercialHistory(history = []) {
  const routineUpdates = history.filter(isRoutineProposalUpdate);
  const keyEntries = history.filter((entry) => !isRoutineProposalUpdate(entry));
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

  return {
    visible: visible.slice(0, 8),
    routineCount: routineUpdates.length,
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
    const hasRemaining = Boolean(proposal.snapshot?.pagamentoRestante);

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
        note: "A proposta já está pronta. Gere o link, envie ao cliente e acompanhe a resposta nas próximas horas para não esfriar o lead.",
        action: "copy_link",
        actionLabel: "Copiar link público",
      };
    }

    if (status === "negociacao") {
      return {
        tone: "warning",
        title: "Refinar a proposta e reenviar",
        note: proposal.clientResponse === "alteracao"
          ? "O cliente pediu ajuste. Revise itens, data, horário ou pax e gere uma nova rodada com rapidez."
          : "A negociação está em andamento. Vale revisar itens e reforçar os próximos passos comerciais.",
        action: "focus_items",
        actionLabel: "Ir para itens",
      };
    }

    if (status === "confirmado" && !hasRemaining) {
      return {
        tone: "success",
        title: "Cobrar e registrar o pagamento restante",
        note: "O sinal já entrou. Agora vale alinhar o saldo final para deixar o evento pronto para o planejamento.",
        action: "mark_remaining",
        actionLabel: "Registrar saldo",
      };
    }

    if (["pagamento_final", "planejamento"].includes(status) && hasIncompleteChecklist(proposal.snapshot || {})) {
      return {
        tone: "operation",
        title: "Fechar o checklist operacional",
        note: `${progress.done}/${progress.total} itens concluídos. Revise responsáveis, extras, operação e observações críticas antes da execução.`,
        action: "focus_checklist",
        actionLabel: "Ver checklist",
      };
    }

    if (status === "evento_proximo") {
      return {
        tone: "operation",
        title: "Revisar detalhes finais da execução",
        note: "O evento está na janela crítica de hoje ou amanhã. Faça uma última leitura operacional e confirme qualquer ponto sensível.",
        action: "focus_checklist",
        actionLabel: "Revisar operação",
      };
    }

    if (status === "pos_venda") {
      return {
        tone: "neutral",
        title: "Registrar follow-up e próximos passos",
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
  if (request || hasDraft) {
    return {
      tone: "commercial",
      title: "Salvar proposta enviada e começar o acompanhamento",
      note: "Você já está com os dados do lead ou com um rascunho montado. Salve a proposta para entrar no funil e seguir com envio e retorno.",
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
                    </div>
                    <div class="timeline-entry-meta">
                      <span>${escapeHtml(formatCommercialHistoryDate(entry.at))}</span>
                      <em>${escapeHtml(entry.actor || "Equipe")}</em>
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
    eventType: fields.eventType.value.trim() || proposal?.tipo_evento || request?.tipo_evento || "evento",
    eventDate: getEventDateLabel(),
    eventTime: getEventTimeLabel(),
    guests: getGuestCount(),
    duration: getDuration(),
    total: formatMoney(getQuoteTotals().total),
    investmentRange: qualification.faixaInvestimento || "",
    status: proposal?.status || request?.status || "lead_recebido",
  };
}

function getQuickReplyPresets(status) {
  const recommended = getQuickReplyRecommendation(status);
  return [
    {
      id: "proposta",
      title: "Proposta enviada",
      eyebrow: "Primeiro envio",
      note: "Apresenta a proposta com contexto e CTA de ajuste.",
      subject: "Proposta de evento - Embaixada Carioca",
      needsLink: true,
      recommended: recommended === "proposta",
      buildText: (context, proposalUrl) =>
        [
          `Olá, ${context.clientName}!`,
          "",
          `Preparei a proposta comercial da Embaixada Carioca para o seu ${context.eventType} no dia ${context.eventDate} às ${context.eventTime}, para ${context.guests} pessoa(s).`,
          "",
          "Segue o link para você ver com calma:",
          proposalUrl,
          "",
          "Se fizer sentido, consigo ajustar data, horário, convidados e formato para chegar na melhor versão.",
          "",
          "Fico à disposição.",
        ].join("\n"),
    },
    {
      id: "followup",
      title: "Follow-up sem resposta",
      eyebrow: "Retomada comercial",
      note: "Retoma o contato sem soar insistente.",
      subject: "Follow-up da proposta - Embaixada Carioca",
      needsLink: true,
      recommended: recommended === "followup",
      buildText: (context, proposalUrl) =>
        [
          `Olá, ${context.clientName}! Tudo bem?`,
          "",
          `Passando para saber se você conseguiu ver a proposta do seu ${context.eventType} na Embaixada Carioca.`,
          "",
          "Deixo o link aqui novamente:",
          proposalUrl,
          "",
          "Se fizer sentido, consigo ajustar alguns pontos para chegarmos na versão ideal para o grupo.",
          "",
          "Fico à disposição.",
        ].join("\n"),
    },
    {
      id: "sinal",
      title: "Cobrança de sinal",
      eyebrow: "Reserva da data",
      note: "Explica o próximo passo comercial de forma clara.",
      subject: "Reserva e sinal do evento - Embaixada Carioca",
      needsLink: true,
      recommended: recommended === "sinal",
      buildText: (context, proposalUrl) =>
        [
          `Olá, ${context.clientName}!`,
          "",
          `Para reservarmos a data do seu ${context.eventType}, seguimos com o sinal de 50% do valor total acordado.`,
          "",
          `A proposta continua aqui para consulta:`,
          proposalUrl,
          "",
          "Assim que o sinal entrar, já deixamos a reserva confirmada e seguimos para a parte operacional.",
          "",
          "Se preferir, também posso resumir tudo por aqui.",
        ].join("\n"),
    },
    {
      id: "saldo",
      title: "Cobrança do saldo",
      eyebrow: "Financeiro",
      note: "Alinha o restante com tom profissional e sereno.",
      subject: "Pagamento restante do evento - Embaixada Carioca",
      needsLink: true,
      recommended: recommended === "saldo",
      buildText: (context, proposalUrl) =>
        [
          `Olá, ${context.clientName}!`,
          "",
          `Passando para alinhar o pagamento restante do seu ${context.eventType} na Embaixada Carioca.`,
          "",
          "Deixo o link da proposta aqui como referência:",
          proposalUrl,
          "",
          "Se precisar, também te envio o resumo do combinado por e-mail ou WhatsApp.",
          "",
          "Fico à disposição.",
        ].join("\n"),
    },
    {
      id: "pre_evento",
      title: "Confirmação pré-evento",
      eyebrow: "Reta final",
      note: "Fecha a operação com segurança e elegância.",
      subject: "Confirmação final do evento - Embaixada Carioca",
      needsLink: true,
      recommended: recommended === "pre_evento",
      buildText: (context, proposalUrl) =>
        [
          `Olá, ${context.clientName}!`,
          "",
          `Estamos na reta final do seu ${context.eventType} na Embaixada Carioca.`,
          `Hoje o combinado está assim: ${context.eventDate} às ${context.eventTime}, ${context.guests} pessoa(s), duração estimada de ${context.duration}h.`,
          "",
          "Deixo o link da proposta aqui para referência final:",
          proposalUrl,
          "",
          "Se houver qualquer ajuste de última hora, me avise por aqui.",
          "",
          "Nos vemos em breve.",
        ].join("\n"),
    },
  ];
}

function getQuickReplyPayload(replyId, context, proposalUrl) {
  const preset = getQuickReplyPresets(context.status).find((item) => item.id === replyId);
  if (!preset) return null;
  return {
    ...preset,
    message: preset.buildText(context, proposalUrl),
  };
}

async function runQuickReply(replyId, channel) {
  const context = getQuickReplyContext();
  const needsLink = getQuickReplyPresets(context.status).find((item) => item.id === replyId)?.needsLink;
  let share = needsLink ? await ensureProposalForSharing() : null;
  const proposalUrl = share?.url || "";
  if (needsLink && !proposalUrl) return;
  const payload = getQuickReplyPayload(replyId, context, proposalUrl);
  if (!payload) return;

  if (channel === "copy") {
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
    const subject = encodeURIComponent(payload.subject);
    const body = encodeURIComponent(payload.message);
    showToast(`Abrindo e-mail com "${payload.title}".`);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    return;
  }

  if (channel === "whatsapp") {
    if (!share) {
      share = await ensureProposalForSharing();
      if (!share?.saved || !share?.url) return;
    }
    await sendProposalWhatsAppViaZapi({
      proposal: share.saved,
      proposalUrl: share.url,
      message: payload.message,
      title: payload.title,
    });
  }
}

function renderQuickReplies() {
  if (!nodes.quickReplies) return;
  const context = getQuickReplyContext();
  const hasContext =
    context.clientName && context.clientName !== "cliente" && (context.eventType !== "evento" || context.email || context.phone);

  if (!hasContext) {
    nodes.quickReplies.innerHTML = `<p>Abra um lead ou comece uma proposta para liberar mensagens prontas de envio, follow-up e cobrança.</p>`;
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
      <span>Checklist pós-sinal</span>
      <strong>${progress.done}/${progress.total} concluídos</strong>
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
  renderProposalNextStep();
  renderPipeline();
  showToast("Checklist atualizado.");
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

function createSignalPaymentInfo(amount, date, banks) {
  return {
    valor: roundCurrency(amount),
    data: date,
    bancos: banks,
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

function showSignalPaymentDialog(defaultAmount = 0) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "signal-modal-backdrop";
    backdrop.innerHTML = `
      <form class="signal-modal" novalidate>
        <div>
          <span class="eyebrow">Sinal recebido</span>
          <h3>Registrar pagamento do sinal</h3>
          <p>Confirme valor, data e banco antes de mover o evento para venda concluída.</p>
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
        <small class="signal-error" aria-live="polite"></small>
        <div class="signal-modal-actions">
          <button class="secondary" type="button" data-signal-cancel>Cancelar</button>
          <button class="primary" type="submit">Confirmar sinal</button>
        </div>
      </form>
    `;

    const form = backdrop.querySelector("form");
    const amountInput = form.querySelector('input[name="amount"]');
    const dateInput = form.querySelector('input[name="date"]');
    const proofInput = form.querySelector('input[name="proof"]');
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

      try {
        const proof = await readSignalProofFile(proofInput.files?.[0] || null);
        const info = createSignalPaymentInfo(amount, date, banks);
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

function showRemainingPaymentDialog(defaultAmount = 0, total = 0, signalInfo = null) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    const signalValue = toNumber(signalInfo?.valor);
    const signalBanks = Array.isArray(signalInfo?.bancos) ? signalInfo.bancos.join(", ") : signalInfo?.banco || "Banco não informado";
    backdrop.className = "signal-modal-backdrop";
    backdrop.innerHTML = `
      <form class="signal-modal" novalidate>
        <div>
          <span class="eyebrow">Pagamento restante</span>
          <h3>Registrar pagamento restante</h3>
          <p>Confirme valor, data e banco. O sistema compara sinal + restante com o total do evento.</p>
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

      const paidTotal = roundCurrency(signalValue + amount);
      const expectedTotal = roundCurrency(total);
      const difference = roundCurrency(paidTotal - expectedTotal);
      const hasDifference = Math.abs(difference) >= 0.01;
      let differenceReason = "";

      if (hasDifference) {
        const message = `O sinal de ${formatMoney(signalValue)} em ${formatSignalPaymentDate(signalInfo?.data)} (${signalBanks}) somado ao pagamento restante de ${formatMoney(
          amount,
        )} em ${formatSignalPaymentDate(date)} (${banks.join(", ")}) dá ${formatMoney(
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
        const info = createSignalPaymentInfo(amount, date, banks);
        if (proof) info.comprovante = proof;
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

function getAllowedCategoriesForEvent(eventType = "") {
  const mainCategory = getEventCategoryFromRequest(eventType);
  if (mainCategory === "Coquetel") return ["Coquetel", "Comidas", "Workshop de Caipirinha", "Snacks"];
  if (mainCategory === "Welcome Drink") return ["Welcome Drink", "Snacks"];
  if (mainCategory) return [mainCategory];
  return [];
}

function getProposalReviewItems() {
  const selected = getSelectedItems();
  const totals = getQuoteTotals();
  const clientName = fields.clientName.value.trim();
  const clientEmail = fields.clientEmail.value.trim();
  const clientPhone = fields.clientPhone.value.trim();
  const eventDate = fields.eventDate.value;
  const eventTime = fields.eventTime.value;
  const eventType = fields.eventType.value.trim();
  const guests = getGuestCount();
  const allowedCategories = getAllowedCategoriesForEvent(eventType);
  const requiredCategory = getEventCategoryFromRequest(eventType);
  const hasCategoryMismatch =
    allowedCategories.length > 0 &&
    selected.length > 0 &&
    !selected.some((item) => allowedCategories.includes(item.tipoEvento));
  const missingBaseCategory = requiredCategory && selected.length > 0 && !selected.some((item) => item.tipoEvento === requiredCategory);
  const minimumWarnings = selected.filter((item) => guests < (toNumber(item.minimo) || 0));
  const hasNotes = fields.notes.value.trim() || fields.eventReason.value.trim();

  return [
    {
      id: "contact",
      label: "Contato",
      status: clientName && (clientPhone || clientEmail) ? "ok" : "error",
      detail: clientName
        ? clientPhone || clientEmail
          ? "Cliente e canal de retorno ok."
          : "Inclua celular ou e-mail antes de enviar."
        : "Informe o nome do cliente.",
      target: "client",
    },
    {
      id: "date",
      label: "Data e horário",
      status: eventDate && eventTime ? "ok" : "error",
      detail: eventDate && eventTime ? `${formatDateFromIso(eventDate)} · ${eventTime}` : "Defina data e horário de chegada.",
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
      status: selected.length ? (hasCategoryMismatch || missingBaseCategory ? "warning" : "ok") : "error",
      detail: selected.length
        ? hasCategoryMismatch
          ? `Pedido: ${eventType || "evento"}. Confira se os itens escolhidos combinam com o formato.`
          : missingBaseCategory
            ? `Confira o produto base de ${requiredCategory}. Há complementos, mas falta o item principal.`
          : `${selected.length} item(ns): ${selected.map((item) => item.nome).slice(0, 3).join(", ")}${selected.length > 3 ? "..." : ""}.`
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
      status: totals.total > 0 ? "ok" : "error",
      detail: totals.total > 0 ? `${formatMoney(totals.total)} · validade ${fields.validity.value || "a definir"}.` : "Monte os itens para calcular o total.",
      target: "items",
    },
  ];
}

function getProposalReviewSummary(items = getProposalReviewItems()) {
  const errors = items.filter((item) => item.status === "error").length;
  const warnings = items.filter((item) => item.status === "warning").length;
  return {
    errors,
    warnings,
    ready: errors === 0,
  };
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
    <span>${conflicts.length} item(ns) no mesmo dia e horário. Confirme disponibilidade antes de avançar.</span>
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

function scrollToClientData() {
  document.querySelector("#clientDataSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    openSavedProposal(proposal.id);
    state.lastAppliedDashboardTarget = targetKey;
    return true;
  }

  const linkedProposal = state.proposals.find(
    (item) =>
      item.solicitacao_id === state.pendingDashboardLeadId ||
      item.snapshot?.activeQuoteRequestId === state.pendingDashboardLeadId,
  );
  if (linkedProposal) {
    openSavedProposal(linkedProposal.id);
    state.lastAppliedDashboardTarget = targetKey;
    return true;
  }

  const request = state.quoteRequests.find((item) => item.id === state.pendingDashboardLeadId);
  if (!request) return false;
  await applyQuoteRequest(request.id);
  state.lastAppliedDashboardTarget = targetKey;
  return true;
}

function renderCategoryFilter() {
  const categories = [...new Set(state.prices.map((item) => item.tipoEvento))].sort();
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

function applyGuidedEvent(eventKey) {
  const config = guidedEvents[eventKey];
  if (!config) return;

  state.guided.event = eventKey;
  state.guided.beverageId = "";
  state.guided.foodId = "";
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
  setChoiceState(nodes.flowWorkshopOptions, "", "selectPackage");

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
    nodes.flowStatus.textContent = "Coquetel com bebidas selecionadas e sem pacote de comidas. Se quiser, adicione workshop como experiência.";
  } else if (packageId === "none-workshop") {
    state.guided.workshopId = "";
    setExclusiveSelection(["workshop-caipirinha-pt", "workshop-caipirinha-en"], "");
    setChoiceState(nodes.flowWorkshopOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Coquetel sem workshop adicional. Confira convidados, duração e total estimado.";
  } else if (["coquetel-caipirinha", "coquetel-carioca"].includes(packageId)) {
    state.guided.beverageId = packageId;
    setExclusiveSelection(["coquetel-caipirinha", "coquetel-carioca"], packageId);
    setChoiceState(nodes.flowBeverageOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Bebidas selecionadas. Agora escolha o pacote de comidas ou marque Nenhum.";
  } else if (["brasileiro-i", "brasileiro-ii"].includes(packageId)) {
    state.guided.foodId = packageId;
    setExclusiveSelection(["brasileiro-i", "brasileiro-ii"], packageId);
    setChoiceState(nodes.flowFoodOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Comidas selecionadas. Você ainda pode adicionar workshop como experiência opcional.";
  } else if (["workshop-caipirinha-pt", "workshop-caipirinha-en"].includes(packageId)) {
    state.guided.workshopId = packageId;
    setExclusiveSelection(["workshop-caipirinha-pt", "workshop-caipirinha-en"], packageId);
    setChoiceState(nodes.flowWorkshopOptions, packageId, "selectPackage");
    nodes.flowStatus.textContent = "Workshop adicionado ao coquetel. Confira convidados, duração e total estimado.";
  }

  fields.eventType.value = "Coquetel";
  fields.categoryFilter.value = "";
  saveSelectedIds();
  renderAll();
}

function clearGuidedFlow() {
  state.guided = { event: "", beverageId: "", foodId: "", workshopId: "" };
  ["coquetel-caipirinha", "coquetel-carioca", "brasileiro-i", "brasileiro-ii", "workshop-caipirinha-pt", "workshop-caipirinha-en"].forEach((id) =>
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
  const query = fields.searchPrice?.value.trim().toLowerCase() || "";
  const category = fields.categoryFilter?.value || "";
  return state.prices.filter((item) => {
    const haystack = `${item.codigo} ${item.tipoEvento} ${item.nome} ${item.descricao} ${item.commercialSummary} ${item.recommendedWindows}`.toLowerCase();
    const visible = item.active !== false || state.selectedIds.has(item.id);
    return visible && (!query || haystack.includes(query)) && (!category || item.tipoEvento === category);
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
  const items = getProposalReviewItems();
  const summary = getProposalReviewSummary(items);
  const title = summary.ready ? "Pronto para enviar" : "Revise antes de enviar";
  const note = summary.ready
    ? summary.warnings
      ? `${summary.warnings} ponto(s) de atenção. Dá para enviar, mas vale conferir.`
      : "Dados essenciais, cardápio e valor estão coerentes."
    : `${summary.errors} pendência(s) impedem o envio. Corrija para evitar proposta errada.`;

  nodes.sendReviewPanel.className = `send-review-panel is-${summary.ready ? "ready" : "blocked"}`;
  nodes.sendReviewPanel.innerHTML = `
    <div class="send-review-heading">
      <div>
        <span>Revisão antes do envio</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <small>${escapeHtml(note)}</small>
    </div>
    <div class="send-review-grid">
      ${items
        .map(
          (item) => `
            <button class="send-review-item is-${escapeHtml(item.status)}" type="button" data-review-target="${escapeHtml(item.target)}">
              <span>${item.status === "ok" ? "OK" : item.status === "warning" ? "!" : "!"}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.detail)}</small>
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
    `Validade: ${fields.validity.value.trim() || "14 dias"}`,
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
  const totals = getQuoteTotals();
  const selected = getSelectedItems();
  const activeRequest = state.quoteRequests.find((item) => item.id === state.activeQuoteRequestId);
  const activeProposal = getActiveProposal();
  return {
    version: 1,
    referencia: activeRequest?.snapshot?.referencia || "",
    savedAt: new Date().toISOString(),
    client: {
      name: fields.clientName.value.trim(),
      email: fields.clientEmail.value.trim(),
      phone: fields.clientPhone.value.trim(),
      company: activeRequest?.empresa || activeRequest?.cliente_empresa || activeRequest?.snapshot?.cliente?.empresa || "",
    },
    event: {
      type: fields.eventType.value.trim(),
      date: fields.eventDate.value,
      time: fields.eventTime.value,
      guests: getGuestCount(),
      duration: getDuration(),
      validity: fields.validity.value.trim(),
      manualAdjustment: getManualAdjustment(),
      manualAdjustmentLabel: fields.manualAdjustmentLabel.value.trim(),
      reason: fields.eventReason.value.trim(),
      notes: fields.notes.value.trim(),
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
    qualificacao: activeRequest?.snapshot?.qualificacao || {},
    privatizationRules: state.privatizationRules,
    generalTerms: fields.generalTerms.value,
    paymentTerms,
    operationalChecklist: activeProposal?.snapshot?.operationalChecklist || {},
    commercialHistory: getCommercialHistory(activeProposal?.snapshot || {}),
    proposalText: buildProposalText(),
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
    ? `Conectado como ${state.session.user.email}.`
    : "Use eventos@embaixadacarioca.com.br ou leorangel@gmail.com para receber o link de acesso.";
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
        clientType: getLeadSegment(request),
        meta: [getLeadSegment(request), qualification.faixaInvestimento, qualification.origem].filter(Boolean),
        cancelReason: request.snapshot?.cancelamento?.motivo || "",
        eventDate: parseLocalIsoDate(request.data_evento || eventSnapshot.data || ""),
      };
    });

  const proposalItems = state.proposals.map((proposal) => {
    const status = normalizeProposalStatus(proposal.status);
    return {
      kind: "proposal",
      id: proposal.id,
      status,
      stage: getPipelineStage(status),
      name: proposal.cliente_nome || "Cliente",
      email: proposal.cliente_email || proposal.snapshot?.client?.email || proposal.snapshot?.cliente?.email || "",
      phone: proposal.cliente_whatsapp || proposal.snapshot?.client?.phone || proposal.snapshot?.cliente?.whatsapp || "",
      company:
        proposal.empresa ||
        proposal.cliente_empresa ||
        proposal.snapshot?.client?.company ||
        proposal.snapshot?.cliente?.empresa ||
        "",
      type: proposal.tipo_evento || "Evento",
      date: proposal.data_evento || "",
      time: proposal.horario_evento || "",
      guests: proposal.convidados || 1,
      duration: Number(proposal.duracao || proposal.snapshot?.event?.duration || 1),
      total: proposal.total || 0,
      createdAt: proposal.created_at,
      updatedAt: proposal.updated_at || proposal.created_at,
      reference: proposal.snapshot?.referencia || "",
      snapshot: proposal.snapshot || {},
      clientType: proposal.snapshot?.qualificacao?.tipoCliente || "Cliente direto",
      hasSignalProof: Boolean(proposal.snapshot?.pagamentoSinal?.comprovante?.nome),
      signalProof: proposal.snapshot?.pagamentoSinal?.comprovante || null,
      hasRemainingPayment: Boolean(proposal.snapshot?.pagamentoRestante),
      hasRemainingProof: Boolean(proposal.snapshot?.pagamentoRestante?.comprovante?.nome),
      remainingProof: proposal.snapshot?.pagamentoRestante?.comprovante || null,
      clientResponse: proposal.cliente_resposta || proposal.snapshot?.clienteResposta?.acao || "",
      clientMessage: proposal.cliente_mensagem || proposal.snapshot?.clienteResposta?.mensagem || "",
      meta: [proposal.snapshot?.qualificacao?.tipoCliente, proposal.snapshot?.qualificacao?.faixaInvestimento].filter(Boolean),
      cancelReason: proposal.snapshot?.cancelamento?.motivo || "",
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
      title: "Sinal pago aguardando restante",
      detail: "Venda concluída; saldo ainda pendente",
      filter: (item) => item.kind === "proposal" && getReportStatus(item) === "confirmado",
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
        ${openButton}
      </div>
    </article>
  `;
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
  if (status === "cancelado") return ["cancelado"];
  return ["proposta_enviada", "negociacao", "confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"];
}

function renderStatusSelect(item) {
  const options = item.kind === "request" ? requestStatusOptions : getProposalTransitionOptions(item.status);
  return `
    <details class="pipeline-status-control">
      <summary>Mudar</summary>
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
      reasons.push("SLA quente");
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
  if (!definition || activeFilter === "all") return items;
  return items.filter((item) => definition.matches(item));
}

function renderPipelineQuickFilters(items = getPipelineItems()) {
  if (!nodes.pipelineQuickFilters) return;
  const definitions = getPipelineQuickFilterDefinitions();
  nodes.pipelineQuickFilters.innerHTML = definitions
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

function getItemSearchText(item) {
  return normalizeSearchValue(
    [
      item.name,
      item.company,
      item.email,
      item.phone,
      item.type,
      item.clientType,
      item.reference,
      item.date ? formatDateFromIso(item.date) : "",
      item.time,
      item.guests ? `${item.guests} pax` : "",
      item.meta?.join(" "),
      item.status ? getProposalStatusLabel(item.status) : "",
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

function renderClientRegistryCard(client) {
  const latest = client.items[0];
  const latestButton =
    latest.kind === "proposal"
      ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(latest.id)}">Abrir último</button>`
      : `<button class="secondary" type="button" data-use-request="${escapeHtml(latest.id)}">Abrir último</button>`;
  const realizedItems = client.items.filter((item) => item.kind === "proposal" && normalizeProposalStatus(item.status) === "pos_venda");
  const confirmedItems = client.items.filter((item) => item.kind === "proposal" && operationStatuses.has(normalizeProposalStatus(item.status)) && normalizeProposalStatus(item.status) !== "pos_venda");
  const quoteItems = client.items.filter((item) => item.kind !== "proposal" || !operationStatuses.has(normalizeProposalStatus(item.status)));
  const realizedValue = realizedItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const confirmedValue = confirmedItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const footerLabel = realizedValue
    ? `Realizado: ${formatMoney(realizedValue)}`
    : confirmedValue
      ? `Confirmado: ${formatMoney(confirmedValue)}`
      : "Sem evento realizado";
  const summaryLabel = formatClientRegistrySummary(quoteItems.length, confirmedItems.length, realizedItems.length);
  const history = client.items
    .slice(0, 3)
    .map((item) => {
      const eventKind = getClientHistoryKind(item);
      return `
        <li>
          <span class="client-history-chip client-history-${escapeHtml(eventKind.tone)}">${escapeHtml(eventKind.label)}</span>
          <small>${escapeHtml(item.date ? formatDateFromIso(item.date) : "Data a definir")} · ${escapeHtml(item.type || "Evento")} · ${escapeHtml(getProposalStatusLabel(item.status))}</small>
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
      <div class="client-registry-summary">${escapeHtml(summaryLabel)}</div>
      <ul>${history}</ul>
      <div class="client-registry-footer">
        <b>${escapeHtml(footerLabel)}</b>
        ${latestButton}
      </div>
    </article>
  `;
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
    nodes.globalSearchResults.innerHTML = `<p>Digite para encontrar leads, propostas e clientes.</p>`;
    return;
  }
  const matchedItems = items.filter((item) => getItemSearchText(item).includes(term)).slice(0, 7);
  const matchedClients = getClientRegistry(items).filter((client) => client.searchText.includes(term)).slice(0, 3);
  const clientResults = matchedClients
    .map((client) => {
      const latest = client.items[0];
      const actionButton =
        latest?.kind === "proposal"
          ? `<button class="secondary" type="button" data-proposal-id="${escapeHtml(latest.id)}">Abrir</button>`
          : `<button class="secondary" type="button" data-use-request="${escapeHtml(latest?.id || "")}">Abrir</button>`;
      return `<article class="global-search-hit"><span>Cliente</span><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml([client.company, client.email, client.phone].filter(Boolean).join(" · ") || `${client.items.length} registro(s)`)}</small>${actionButton}</article>`;
    })
    .join("");
  const itemResults = matchedItems.map(renderGlobalSearchItem).join("");
  nodes.globalSearchResults.innerHTML = clientResults || itemResults
    ? `${clientResults}${itemResults}`
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
    !fields.manualAdjustment.value.trim()
  );
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
      tasks.push({
        ...base,
        title: item.clientResponse === "confirmar" ? "Registrar sinal" : "Follow-up da proposta",
        note: item.clientResponse === "confirmar" ? "Cliente aprovou pelo link. Falta sinal." : `Sem resposta há ${hours || 0}h`,
        priority: item.clientResponse === "confirmar" ? 92 : hours >= 48 ? 82 : hours >= 24 ? 66 : 38,
        track: item.clientResponse === "confirmar" ? "Venda" : "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "negociacao") {
      tasks.push({
        ...base,
        title: "Avançar negociação",
        note: item.clientResponse === "alteracao" ? "Cliente pediu ajuste na proposta." : "Ajuste comercial em andamento.",
        priority: item.clientResponse === "alteracao" ? 74 : 50,
        track: "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "confirmado") {
      tasks.push({
        ...base,
        title: "Cobrar pagamento restante",
        note: "Sinal recebido. Falta registrar saldo.",
        priority: 72,
        track: "Financeiro",
      });
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

  return tasks.sort((a, b) => b.priority - a.priority).slice(0, 8);
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
    nodes.actionList.innerHTML = `<p>Nenhuma ação crítica agora.</p>`;
    return;
  }
  nodes.actionList.innerHTML = tasks
    .map((task) => {
      const item = task.item;
      const actionButton =
        item.kind === "proposal"
          ? `<button class="primary action-open-button" type="button" data-proposal-id="${escapeHtml(item.id)}">Abrir</button>`
          : `<button class="primary action-open-button" type="button" data-use-request="${escapeHtml(item.id)}">Abrir</button>`;
      return `
        <article class="action-task action-${getActionPriorityClass(task.priority)}">
          <div class="action-task-topline">
            <span class="action-task-track">${escapeHtml(getActionTrack(task))}</span>
            <b class="action-task-urgency">${escapeHtml(getActionUrgencyLabel(task.priority))}</b>
          </div>
          <div class="action-task-body">
            <strong>${escapeHtml(item.name || "Cliente")}</strong>
            <span class="action-task-title">${escapeHtml(task.title)}</span>
            <small>${escapeHtml(task.meta)}</small>
            <p>${escapeHtml(task.note)}</p>
          </div>
          <div class="action-task-footer">
            <small>${escapeHtml(item.type || item.clientType || "Lead")}</small>
            ${actionButton}
          </div>
        </article>
      `;
    })
    .join("");
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
    busiestDay: busiestDay ? `${formatDateFromIso(busiestDay[0])} com ${busiestDay[1]} item(ns)` : "Sem concentração crítica na agenda.",
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

function renderPipelineCard(item) {
  const dateLabel = item.date ? formatDateFromIso(item.date) : "Data a definir";
  const timeLabel = item.time ? String(item.time).slice(0, 5) : "Horário a definir";
  const valueLabel = item.total ? formatMoney(item.total) : "Sem proposta";
  const statusClass = item.status === "cancelado" ? " canceled" : operationStatuses.has(item.status) ? " confirmed" : "";
  const cancelInfo = item.cancelReason ? `<small>Cancelado: ${escapeHtml(item.cancelReason)}</small>` : "";
  const eventLine = `${dateLabel} · ${timeLabel} · ${item.guests} pax`;
  const displayName = item.company ? `${item.name} - ${item.company}` : item.name;
  const clientTypeLine = item.clientType || item.meta[0] || "";
  const leadAge = getLeadAgeInfo(item);
  const commercialScore = getCommercialScore(item);
  const leadAgeBadge = leadAge
    ? `<small class="lead-age-badge lead-age-${escapeHtml(leadAge.level)}">${escapeHtml(leadAge.label)}</small>`
    : "";
  const scoreTitle = commercialScore.reasons.length
    ? ` title="${escapeHtml(commercialScore.reasons.join(" · "))}"`
    : "";
  const scoreBadge = `<small class="pipeline-score-badge pipeline-score-${escapeHtml(commercialScore.level)}"${scoreTitle}>${escapeHtml(commercialScore.label)} · ${commercialScore.value}</small>`;
  const clientResponseLine = item.clientResponse
    ? `<small class="pipeline-client-response">${escapeHtml(getClientResponseLabel(item.clientResponse))}${item.clientMessage ? ` · ${escapeHtml(item.clientMessage)}` : ""}</small>`
    : "";
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
      ? `<button class="pipeline-top-action pipeline-signal-action" type="button" data-mark-paid="${escapeHtml(item.id)}">Sinal Pago!</button>`
      : "";
  const remainingButton =
    item.kind === "proposal" && item.status === "pagamento_final" && !item.hasRemainingPayment
      ? `<button class="pipeline-top-action pipeline-final-payment-action" type="button" data-mark-final-payment="${escapeHtml(item.id)}">PG Restante!</button>`
      : "";
  const topAction = remainingButton || remainingProofLink || signalProofLink || signalButton;
  const openButton =
    item.kind === "proposal"
      ? `<button class="primary pipeline-open-button" type="button" data-proposal-id="${escapeHtml(item.id)}">ABRIR</button>`
      : `<button class="primary pipeline-open-button" type="button" data-use-request="${escapeHtml(item.id)}">ABRIR</button>`;
  const cancelButton =
    item.status === "cancelado"
      ? ""
      : `<button class="secondary danger-light pipeline-cancel-chip" type="button" data-cancel-kind="${escapeHtml(item.kind)}" data-cancel-id="${escapeHtml(item.id)}">Cancelar</button>`;
  const actionButtons = `
    <span class="pipeline-card-actions">
      ${cancelButton}
      ${renderStatusSelect(item)}
      ${openButton}
    </span>
  `;
  return `
    <article
      class="pipeline-card"
      draggable="true"
      data-pipeline-card-kind="${escapeHtml(item.kind)}"
      data-pipeline-card-id="${escapeHtml(item.id)}"
      data-pipeline-card-status="${escapeHtml(item.status)}"
    >
      <div class="pipeline-card-kicker">
        <span class="status-chip${statusClass} pipeline-stage-chip">${escapeHtml(getProposalStatusLabel(item.status))}</span>
        <small class="pipeline-card-reference">${escapeHtml(item.reference || "Sem referência")}</small>
        ${leadAgeBadge}
        ${topAction}
      </div>
      <div class="pipeline-card-event-row">
        <small class="pipeline-card-event-line">${escapeHtml(eventLine)}</small>
        <span class="pipeline-card-value">${escapeHtml(valueLabel)}</span>
      </div>
      <div class="pipeline-card-name-row">
        <small class="pipeline-card-name">${escapeHtml(displayName)}</small>
      </div>
      <small class="pipeline-card-type">${escapeHtml(item.type)}</small>
      ${clientResponseLine}
      <div class="pipeline-card-bottom-row">
        <span class="pipeline-card-meta-group">
          ${scoreBadge}
          ${clientTypeLine ? `<small class="pipeline-card-meta">${escapeHtml(clientTypeLine)}</small>` : ""}
        </span>
        ${actionButtons}
      </div>
      ${cancelInfo}
    </article>
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
            ${stageItems.length ? stageItems.map(renderPipelineCard).join("") : `<small>Nada nesta etapa.</small>`}
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
        ${stageItems.length ? stageItems.map(renderPipelineCard).join("") : `<small>Nada nesta etapa.</small>`}
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
    return;
  }

  if (!state.session) {
    renderPipelineQuickFilters([]);
    renderOperationsAgenda([]);
    nodes.pipelineBoard.innerHTML = `<p>Entre com o e-mail da equipe para carregar o funil.</p>`;
    renderPipelineMetrics([]);
    return;
  }

  const items = getPipelineItems();
  const filteredItems = getFilteredPipelineItems(items);
  renderPipelineQuickFilters(items);
  renderPipelineMetrics(items);
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
  const qualification = request.snapshot?.qualificacao || {};
  const lines = [];
  if (request.snapshot?.referencia) lines.push(`Referência do formulário: ${request.snapshot.referencia}`);
  if (request.empresa) lines.push(`Empresa: ${request.empresa}`);
  if (qualification.tipoCliente) lines.push(`Tipo de cliente: ${qualification.tipoCliente}`);
  if (qualification.faixaInvestimento) lines.push(`Faixa de investimento: ${qualification.faixaInvestimento}`);
  if (qualification.origem) lines.push(`Origem: ${qualification.origem}`);
  if (eventSnapshot.momento) lines.push(`Momento informado: ${eventSnapshot.momento}`);
  if (eventSnapshot.ocasiao || eventSnapshot.perfil) lines.push(`Ocasião: ${eventSnapshot.ocasiao || eventSnapshot.perfil}`);
  if (request.tipo_evento) lines.push(`Formato escolhido: ${request.tipo_evento}`);
  if (eventSnapshot.dataFlexivel) lines.push(`Janela de data flexível: ${eventSnapshot.dataFlexivel}`);
  if (eventSnapshot.dataFlexivelStatus) lines.push(`Data é flexível: ${eventSnapshot.dataFlexivelStatus}`);
  if (eventSnapshot.faixaHorario) lines.push(`Período do dia: ${eventSnapshot.faixaHorario}`);
  if (eventSnapshot.horario) lines.push(`Horário de chegada: ${eventSnapshot.horario}`);
  if (eventSnapshot.extras) lines.push(`Extras: ${eventSnapshot.extras}`);
  if (request.preferencias) lines.push(`Preferências de A&B: ${request.preferencias}`);
  if (request.observacoes) lines.push(`Briefing do cliente: ${request.observacoes}`);
  lines.push(`Solicitação recebida via formulário em ${formatSavedAt(request.created_at)}.`);
  return lines.join("\n");
}

function getEventCategoryFromRequest(type) {
  const normalized = String(type || "").toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("café") || normalized.includes("coffee") || normalized.includes("brunch")) {
    return "Café da Manhã / Coffee Break";
  }
  if (normalized.includes("almoço")) return "Almoço Carioca";
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
  state.guided = { event: "", beverageId: "", foodId: "", workshopId: "" };
  state.privatizationChoice = "";
  saveSelectedIds();
  fields.manualAdjustment.value = "";
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
  setChoiceState(nodes.flowWorkshopOptions, "", "selectPackage");
  setChoiceState(nodes.optionalPrivatizationControls, "", "privatizationChoice");
}

async function applyQuoteRequest(requestId) {
  const request = state.quoteRequests.find((item) => item.id === requestId);
  if (!request) return;

  state.activeQuoteRequestId = request.id;
  state.activeProposalId = "";
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
  if (nodes.flowStatus) {
    nodes.flowStatus.textContent = eventCategory
      ? `${eventCategory} carregado do formulário. Confira cardápio, pax, data e horário antes de enviar.`
      : "Lead carregado do formulário. Escolha o formato e confira os pontos essenciais.";
  }
  nodes.coquetelChoices?.classList.toggle("is-hidden", guidedKey !== "coquetel");
  setChoiceState(nodes.flowEventOptions, guidedKey, "flowEvent");
  renderSignalPaymentInfo(null, null);
  renderOperationalChecklist(null);
  renderCommercialTimeline(null);

  renderAll();
  showToast("Solicitação carregada para revisão.");
  scrollToClientData();
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
  if (current === "cancelado") return { ok: false, message: "Este evento está cancelado. Reative manualmente em uma nova proposta." };
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

function getCancelReason() {
  const options = cancelReasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n");
  const answer = window.prompt(`Motivo do cancelamento:\n\n${options}\n\nDigite o número ou escreva outro motivo.`);
  if (answer === null) return "";
  const trimmed = answer.trim();
  if (!trimmed) return "";
  const selectedIndex = Number(trimmed) - 1;
  return cancelReasons[selectedIndex] || trimmed;
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
    [createCommercialHistoryEntry("cancelamento", "Cancelamento registrado", reason, { actor: cancelamento.canceladoPor })],
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
  const finalPaymentRequiredStatuses = new Set(["planejamento", "evento_proximo", "pos_venda"]);
  let paymentSignal = signalInfo;
  let remainingPayment = null;
  if (normalizedNext === "confirmado" && !proposal.snapshot?.pagamentoSinal) {
    paymentSignal = paymentSignal || (await showSignalPaymentDialog(getSignalDefaultAmount(proposal.total)));
    if (!paymentSignal) {
      showToast("Sinal não registrado. A etapa não foi alterada.");
      renderPipeline();
      return;
    }
  }
  if (finalPaymentRequiredStatuses.has(normalizedNext) && !proposal.snapshot?.pagamentoRestante) {
    const signal = proposal.snapshot?.pagamentoSinal || paymentSignal;
    if (!signal) {
      showToast("Registre o sinal antes do pagamento restante.");
      renderPipeline();
      return;
    }
    remainingPayment = await showRemainingPaymentDialog(getRemainingDefaultAmount(proposal.total, signal), proposal.total, signal);
    if (!remainingPayment) {
      showToast("Pagamento restante não registrado. A etapa não foi alterada.");
      renderPipeline();
      return;
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
  }
  if (remainingPayment) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "pagamento_restante",
        "Pagamento restante registrado",
        `${formatMoney(remainingPayment.valor)} · ${formatSignalPaymentDate(remainingPayment.data)} · ${(remainingPayment.bancos || []).join(", ")}.`,
      ),
    );
  }

  const snapshot = withCommercialHistoryEntries(
    {
      ...(proposal.snapshot || {}),
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
    renderProposalNextStep();
  }
  showToast(
    nextStatus === "confirmado"
      ? "Sinal pago: evento confirmado."
      : remainingPayment
        ? "Pagamento restante registrado. Etapa atualizada."
        : "Etapa atualizada.",
  );
}

async function movePipelineItem(kind, id, nextStatus) {
  if (!nextStatus) return;
  if (kind === "request") {
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
    renderSupabaseStatus("Supabase ainda nao configurado.");
    updateAuthUI();
    renderHistory();
    renderConfirmedEvents();
    renderQuoteRequests();
    return;
  }

  if (!window.supabase?.createClient) {
    renderSupabaseStatus("Biblioteca do Supabase nao carregou. Verifique a internet deste navegador.");
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
    renderSupabaseStatus("Nao foi possivel conectar. Confira URL e anon key.");
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
  state.activeProposalId = "";
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
    showToast("Conecte o Supabase para salvar no historico.");
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

  if (normalizedNext === "confirmado" && !activeProposal?.snapshot?.pagamentoSinal) {
    paymentSignal = paymentSignal || (await showSignalPaymentDialog(getSignalDefaultAmount(snapshot.totals.total)));
    if (!paymentSignal) {
      showToast("Sinal não registrado. O evento continua sem confirmação.");
      return null;
    }
  }

  snapshot.pagamentoSinal = paymentSignal || activeProposal?.snapshot?.pagamentoSinal || snapshot.pagamentoSinal || null;
  if (finalPaymentRequiredStatuses.has(normalizedNext) && !activeProposal?.snapshot?.pagamentoRestante) {
    const signal = snapshot.pagamentoSinal || activeProposal?.snapshot?.pagamentoSinal || null;
    if (!signal) {
      showToast("Registre o sinal antes do pagamento restante.");
      return null;
    }
    remainingPayment = await showRemainingPaymentDialog(getRemainingDefaultAmount(snapshot.totals.total, signal), snapshot.totals.total, signal);
    if (!remainingPayment) {
      showToast("Pagamento restante não registrado. A proposta não foi atualizada.");
      return null;
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
  if (paymentSignal && !activeProposal?.snapshot?.pagamentoSinal) {
    historyEntries.push(
      createCommercialHistoryEntry("sinal", "Sinal registrado", `${formatMoney(paymentSignal.valor)} · ${formatSignalPaymentDate(paymentSignal.data)} · ${(paymentSignal.bancos || []).join(", ")}.`),
    );
  }
  if (remainingPayment && !activeProposal?.snapshot?.pagamentoRestante) {
    historyEntries.push(
      createCommercialHistoryEntry(
        "pagamento_restante",
        "Pagamento restante registrado",
        `${formatMoney(remainingPayment.valor)} · ${formatSignalPaymentDate(remainingPayment.data)} · ${(remainingPayment.bancos || []).join(", ")}.`,
      ),
    );
  }
  const snapshotWithHistory = withCommercialHistoryEntries(snapshot, historyEntries);

  const row = getProposalRow(snapshotWithHistory, nextStatus);
  const query = state.activeProposalId
    ? state.supabase.from("propostas").update(row).eq("id", state.activeProposalId)
    : state.supabase.from("propostas").insert(row);
  const { data, error } = await query.select("*").single();

  if (error) {
    console.warn("Falha ao salvar proposta.", error);
    showToast("Nao foi possivel salvar. Confira o schema no Supabase.");
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
  renderProposalNextStep();
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
    console.warn("Falha ao carregar historico.", error);
    nodes.historyList.innerHTML = `<p>Nao foi possivel carregar o historico. Confira as politicas RLS.</p>`;
    return;
  }

  state.proposals = data || [];
  renderHistory();
  renderPipeline();
  if (state.activeProposalId) {
    renderCommercialTimeline(getActiveProposal());
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
  fields.manualAdjustment.value = snapshot.event?.manualAdjustment || snapshot.totals?.adjustment || "";
  fields.manualAdjustmentLabel.value = snapshot.event?.manualAdjustmentLabel || snapshot.totals?.adjustmentLabel || "";
  fields.eventReason.value = snapshot.event?.reason || "";
  fields.notes.value = snapshot.event?.notes || "";
  fields.generalTerms.value = snapshot.generalTerms || loadGeneralTerms();
  renderProposalNextStep();
  renderSignalPaymentInfo(snapshot.pagamentoSinal, snapshot.pagamentoRestante);
  renderOperationalChecklist(getActiveProposal());
  renderCommercialTimeline(getActiveProposal());

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

function openSavedProposal(proposalId) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) return;
  state.activeProposalId = proposal.id;
  state.activeQuoteRequestId = proposal.solicitacao_id || proposal.snapshot?.activeQuoteRequestId || "";
  state.quoteGuideDismissed = true;
  applyProposalSnapshot(proposal.snapshot);
  scrollToClientData();
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
  if (!nodes.proposalContent) return;
  const selected = getSelectedItems();
  const notes = fields.notes.value.trim();
  const reason = fields.eventReason.value.trim();
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
        <div><span>Formato</span>${escapeHtml(fields.eventType.value.trim() || "Evento")}</div>
        <div><span>Duração</span>${getDuration()}h</div>
        <div><span>Validade</span>${escapeHtml(fields.validity.value.trim() || "14 dias")}</div>
        <div><span>Data da proposta</span>${escapeHtml(getTodayLabel())}</div>
        <div class="proposal-grid-wide"><span>Motivo</span>${escapeHtml(reason || "A definir")}</div>
      </div>
      <div class="proposal-note">
        <span>Experiência proposta</span>
        ${escapeHtml(fields.eventType.value.trim() || "Evento")} para ${getGuestCount()} pessoa(s), com duração estimada de ${getDuration()}h. Inclui: ${escapeHtml(includedSummary)}.
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

function renderAll() {
  syncDateTimeFromFields();
  renderQuoteWorkspaceGuide();
  renderPriceList();
  renderPricesTable();
  renderCommercialLibrarySummary();
  renderAvailabilityAlert();
  renderProposalNextStep();
  renderQuickReplies();
  renderSummary();
  renderSendReview();
  renderCalculation();
  renderProposal();
}

function startNewProposal() {
  const hasDraft =
    state.activeProposalId ||
    state.activeQuoteRequestId ||
    fields.clientName.value.trim() ||
    state.selectedIds.size;
  if (hasDraft && !window.confirm("Começar uma nova proposta e limpar os dados atuais da tela?")) return;

  state.activeProposalId = "";
  state.activeQuoteRequestId = "";
  state.quoteGuideDismissed = true;
  state.selectedIds.clear();
  state.guided = { event: "", beverageId: "", foodId: "", workshopId: "" };
  state.privatizationChoice = "";
  saveSelectedIds();

  fields.clientName.value = "";
  fields.clientEmail.value = "";
  fields.clientPhone.value = "";
  fields.eventType.value = "";
  fields.eventDate.value = "";
  fields.eventTime.value = "18:00";
  syncDateTimeFromFields();
  fields.guestCount.value = "30";
  fields.eventDuration.value = "1";
  fields.validity.value = "14 dias";
  fields.manualAdjustment.value = "";
  fields.manualAdjustmentLabel.value = "";
  fields.eventReason.value = "";
  fields.notes.value = "";
  fields.searchPrice.value = "";
  fields.categoryFilter.value = "";
  renderProposalNextStep();
  renderSignalPaymentInfo(null, null);
  renderOperationalChecklist(null);
  renderCommercialTimeline(null);
  renderAll();
  scrollToClientData();
  showToast("Nova proposta pronta para preencher.");
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
    items: "#eventConfigSection",
    notes: "#notes",
  };
  const selector = targets[target] || "#sendReviewPanel";
  const node = document.querySelector(selector);
  node?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (target === "notes") fields.notes?.focus();
}

function ensureProposalReadyForSending() {
  const items = getProposalReviewItems();
  const summary = getProposalReviewSummary(items);
  renderSendReview();
  if (summary.ready) return true;
  const firstError = items.find((item) => item.status === "error");
  showToast(firstError?.detail || "Revise os pontos obrigatórios antes de enviar.");
  nodes.sendReviewPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
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
  const clientName = fields.clientName.value.trim();
  const firstName = clientName.split(/\s+/)[0] || "";
  return [
    `Olá${firstName ? `, ${firstName}` : ""}!`,
    "",
    "Segue o link da proposta comercial da Embaixada Carioca:",
    proposalUrl,
    "",
    "Pelo link você pode aprovar a proposta, solicitar ajustes de data, horário ou convidados, ou falar com a nossa equipe.",
  ].join("\n");
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

async function sendProposalWhatsAppViaZapi({ proposal, proposalUrl, message, title = "Proposta comercial" }) {
  if (!state.supabase || !state.session) {
    showToast("Entre com o e-mail da equipe para enviar WhatsApp direto.");
    return false;
  }

  const phone = fields.clientPhone.value.trim() || proposal?.cliente_whatsapp || proposal?.snapshot?.client?.phone || "";
  if (!phone.replace(/\D/g, "")) {
    showToast("Preencha o Celular/WhatsApp do cliente antes de enviar.");
    return false;
  }

  showToast("Enviando proposta por WhatsApp...");
  const { data, error } = await state.supabase.functions.invoke("send-proposal-whatsapp", {
    body: {
      proposalId: proposal.id,
      phone,
      message,
      proposalUrl,
      title,
    },
  });

  if (error || data?.ok === false) {
    console.warn("Falha no envio direto por WhatsApp.", error || data);
    const functionMessage = data?.message || (await getFunctionErrorMessage(error));
    showToast(functionMessage || "Não foi possível enviar pela Z-API. Confira a configuração.");
    return false;
  }

  showToast("Proposta enviada por WhatsApp e registrada no histórico.");
  await loadProposalHistory();
  return true;
}

async function openEmail() {
  const email = fields.clientEmail.value.trim();
  if (!email) {
    showToast("Preencha o e-mail do cliente para abrir a mensagem.");
    return;
  }
  const proposalUrl = await ensureProposalLink();
  if (!proposalUrl) return;
  const subject = encodeURIComponent("Proposta de evento - Embaixada Carioca");
  const body = encodeURIComponent(
    [
      "Olá,",
      "",
      "Segue o link da proposta comercial da Embaixada Carioca:",
      proposalUrl,
      "",
      "Pelo link você pode aprovar a proposta, cancelar ou solicitar ajustes de data, horário e convidados.",
      "",
      "Ficamos à disposição.",
    ].join("\n"),
  );
  showToast("Link da proposta gerado. Abrindo e-mail.");
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
    case "copy_link":
      await copyProposalLink();
      break;
    case "mark_signal":
      if (activeProposal) await updateProposalStatus(activeProposal.id, "confirmado");
      break;
    case "mark_remaining":
      if (activeProposal) await updateProposalStatus(activeProposal.id, "planejamento");
      break;
    case "focus_items":
      scrollToItems();
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

async function openWhatsApp() {
  const share = await ensureProposalForSharing();
  if (!share?.saved || !share?.url) return;
  await sendProposalWhatsAppViaZapi({
    proposal: share.saved,
    proposalUrl: share.url,
    message: buildProposalWhatsAppMessage(share.url),
    title: "Proposta comercial",
  });
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
  state.selectedIds.add(item.id);
  savePrices();
  saveSelectedIds();
  renderCategoryFilter();
  if (fields.categoryFilter) fields.categoryFilter.value = tipo;
  clearNewItemForm();
  renderAll();
  showToast("Item criado e adicionado ao orçamento.");
}

function bindEvents() {
  Object.values(fields).forEach((field) => {
    if (!field) return;
    const refreshFormOutputs = () => {
      renderPriceList();
      renderAvailabilityAlert();
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

  fields.eventDateTime?.setAttribute("step", "1800");
  fields.eventDateTime?.addEventListener("input", () => {
    syncFieldsFromDateTime();
    renderAvailabilityAlert();
    renderSummary();
    renderSendReview();
    renderCalculation();
    renderProposal();
  });

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
  document.querySelector("#emailBtn")?.addEventListener("click", openEmail);
  document.querySelector("#newProposalBtn")?.addEventListener("click", startNewProposal);
  nodes.startManualProposalBtn?.addEventListener("click", startNewProposal);
  nodes.jumpToPipelineBtn?.addEventListener("click", () => {
    document.querySelector(".pipeline-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal());
  document.querySelector("#confirmEventBtn")?.addEventListener("click", confirmCurrentEvent);
  document.querySelector("#copyBtn")?.addEventListener("click", copyProposalLink);
  document.querySelector("#whatsappBtn")?.addEventListener("click", openWhatsApp);
  document.querySelector("#resetPricesBtn")?.addEventListener("click", resetPrices);
  document.querySelector("#clearFlowBtn")?.addEventListener("click", clearGuidedFlow);
  document.querySelector("#addItemBtn")?.addEventListener("click", createNewItem);
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
  document.querySelector("#applyCustomReportBtn")?.addEventListener("click", applyCustomReport);
  nodes.reportPresets?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-preset]");
    if (!button) return;
    selectReportPreset(button.dataset.reportPreset);
  });
  nodes.reportOutput?.addEventListener("click", (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      openSavedProposal(proposalButton.dataset.proposalId);
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) applyQuoteRequest(requestButton.dataset.useRequest);
  });
  nodes.actionList?.addEventListener("click", (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      openSavedProposal(proposalButton.dataset.proposalId);
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) applyQuoteRequest(requestButton.dataset.useRequest);
  });
  nodes.operationsAgenda?.addEventListener("click", (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      openSavedProposal(proposalButton.dataset.proposalId);
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) applyQuoteRequest(requestButton.dataset.useRequest);
  });
  fields.globalSearchInput?.addEventListener("input", () => {
    const items = getPipelineItems();
    renderGlobalSearch(items);
    renderClientRegistry(items);
  });
  nodes.globalSearchResults?.addEventListener("click", (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      openSavedProposal(proposalButton.dataset.proposalId);
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) applyQuoteRequest(requestButton.dataset.useRequest);
  });
  nodes.clientDirectory?.addEventListener("click", (event) => {
    const proposalButton = event.target.closest("button[data-proposal-id]");
    if (proposalButton) {
      openSavedProposal(proposalButton.dataset.proposalId);
      return;
    }
    const requestButton = event.target.closest("button[data-use-request]");
    if (requestButton) applyQuoteRequest(requestButton.dataset.useRequest);
  });
  nodes.pipelineQuickFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pipeline-filter]");
    if (!button) return;
    state.activePipelineFilter = button.dataset.pipelineFilter || "all";
    renderPipeline();
  });
  nodes.proposalNextStep?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-next-step-action]");
    if (!button) return;
    runProposalNextStepAction(button.dataset.nextStepAction);
  });
  nodes.sendReviewPanel?.addEventListener("click", (event) => {
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
  document.querySelector("#copyClientFormLinkBtn")?.addEventListener("click", copyClientFormLink);
  nodes.historyList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-proposal-id]");
    if (!button) return;
    openSavedProposal(button.dataset.proposalId);
  });
  nodes.pipelineBoard?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-proposal-id]");
    if (button) {
      openSavedProposal(button.dataset.proposalId);
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
      applyQuoteRequest(useButton.dataset.useRequest);
      return;
    }
    const markButton = event.target.closest("button[data-mark-request]");
    if (markButton) markQuoteRequestAnalyzed(markButton.dataset.markRequest);
    const cancelButton = event.target.closest("button[data-cancel-id]");
    if (cancelButton) cancelPipelineItem(cancelButton.dataset.cancelKind, cancelButton.dataset.cancelId);
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
initSupabase();
