Warning: truncated output (original token count: 166584)
Total output lines: 15968

﻿const STORAGE_KEY = "embaixada_orcamentos_precos_v1";
const PRODUCT_TYPES_KEY = "embaixada_orcamentos_tipos_produto_v1";
const SELECTED_KEY = "embaixada_orcamentos_selecionados_v1";
const PRIVATIZATION_KEY = "embaixada_orcamentos_privatizacao_v1";
const TERMS_KEY = "embaixada_orcamentos_condicoes_v1";
const SUPABASE_CONFIG_KEY = "embaixada_orcamentos_supabase_v1";
const INTEGRATION_LOG_KEY = "embaixada_orcamentos_envios_v1";
const COMMUNICATION_TEMPLATES_KEY = "embaixada_orcamentos_comunicacao_v1";
const WORKSPACE_MODE_KEY = "embaixada_orcamentos_modo_trabalho_v1";
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
const COMMERCIAL_APPROVAL_ABSOLUTE_LIMIT = 1000;
const COMMERCIAL_APPROVAL_PERCENT_LIMIT = 0.1;
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

function getCommercialAnalyticsProperties(entity = {}) {
  const analytics = window.EventAnalytics;
  const snapshot = entity.snapshot || {};
  const event = snapshot.event || snapshot.evento || {};
  const qualification = snapshot.qualificacao || snapshot.sourceRequestSnapshot?.qualificacao || {};
  const totals = snapshot.totals || {};
  return {
    surface: "admin",
    language: event.clientLanguage || snapshot.client?.language || "pt",
    status: entity.status || "unknown",
    event_type: event.type || event.tipo || entity.tipo_evento || "unknown",
    guests_bucket: analytics?.bucketGuests(entity.convidados || event.guests || event.convidados),
    duration_bucket: analytics?.bucketDuration(entity.duracao || event.duration || event.duracao),
    days_to_event_bucket: analytics?.bucketDaysToEvent(entity.data_evento || event.date || event.data),
    value_bucket: analytics?.bucketCurrency(entity.total || totals.total),
    proposal_version: Number(entity.versao || 1),
    lead_source: qualification.origem || "unknown",
    client_type: qualification.tipoCliente || snapshot.client?.clientType || "unknown",
    budget_range: qualification.faixaInvestimento || "unknown",
    has_upsell_options: Array.isArray(snapshot.publicOfferOptions) && snapshot.publicOfferOptions.some((option) => !option.base),
  };
}

function captureEventAnalytics(eventName, entity = {}, properties = {}, options = {}) {
  const entityId = options.entityId || entity.oportunidade_id || entity.id;
  return window.EventAnalytics?.capture(
    eventName,
    { ...getCommercialAnalyticsProperties(entity), ...properties },
    { ...options, entityId },
  );
}

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
    id: "proposta_pronta",
    row: "commercial",
    title: "PRONTA PARA ENVIO",
    description: "Proposta salva e revisada, ainda sem envio confirmado.",
    statuses: ["proposta_pronta"],
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
    id: "desfecho_pendente",
    row: "archive",
    title: "HISTÓRICO — DESFECHO PENDENTE",
    description: "A data passou. Confirme o resultado real sem deixar o sistema adivinhar.",
    statuses: ["desfecho_pendente"],
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
  "proposta_pronta",
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

const pastEventOutcomes = [
  { id: "realizado", label: "Realizado / vendido", detail: "O evento aconteceu e entra em pós-venda." },
  { id: "concorrencia", label: "Perdemos para concorrência", detail: "O cliente fechou em outro local." },
  { id: "preco", label: "Achou caro", detail: "O valor foi o principal motivo informado." },
  { id: "desistencia", label: "Desistiu do evento", detail: "O cliente deixou de realizar o evento." },
  { id: "remarcado", label: "Trocou de data", detail: "Informe a nova data para devolver a oportunidade ao funil." },
  { id: "outro", label: "Outro desfecho", detail: "Registre o motivo real com suas palavras." },
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
VALIDADE: este tarifário é válido exclusivamente para eventos realizados até o dia 31/12/2026.
ATRAÇÃO MUSICAL, ENTRETENIMENTO E DIVULGAÇÃO: a realização de atrações musicais, atividades de entretenimento, instalação de faixas, banners, materiais promocionais ou qualquer ação de divulgação somente será permitida mediante autorização prévia, por escrito, do Setor de Eventos do Parque Bondinho Pão de Açúcar. Após autorizada, essa autorização deverá ser formalmente encaminhada à Embaixada Carioca. Em caso de ausência desse envio, a execução poderá ser impedida.
UTILIZAÇÃO DA MARCA DO BONDINHO: qualquer uso comercial ou promocional envolvendo o Bondinho do Pão de Açúcar e os perfis dos morros deverá ser previamente aprovado pelo Setor de Eventos do Caminho Aéreo Pão de Açúcar.
É expressamente proibida a distribuição de cartazes pela cidade, a fixação de materiais promocionais e a projeção de imagens nos morros sem autorização formal. O descumprimento poderá acarretar penalidades e multas legais, inclusive em momento posterior ao evento.`;

function loadWorkspaceMode() {
  try {
    return localStorage.getItem(WORKSPACE_MODE_KEY) === "full" ? "full" : "sales";
  } catch (_) {
    return "sales";
  }
}

const state = {
  prices: loadPrices(),
  productTypes: loadProductTypes(),
  selectedIds: loadSelectedIds(),
  privatizationRules: loadPrivatizationRules(),
  supabase: null,
  session: null,
  proposals: [],
  quoteRequests: [],
  opportunities: [],
  proposalViews: [],
  activeProposalId: "",
  activeQuoteRequestId: "",
  activeOpportunityId: "",
  activeEditorContext: null,
  loadedEditorSignature: "",
  pendingOpenSourceLabel: "",
  pendingDashboardLeadId: "",
  pendingDashboardProposalId: "",
  lastAppliedDashboardTarget: "",
  activeReportPreset: "currentMonth",
  activePipelineFilter: "all",
  workspaceMode: loadWorkspaceMode(),
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
  lastProposalSaveError: "",
  lastProposalShareError: "",
  sharedSettings: {},
  sharedSaveTimers: {},
  sharedSaving: {},
  sharedQueued: {},
  firstReplySourceId: "",
  firstReplyDraft: "",
  firstReplyChannel: "",
  smartDraftSuggestion: null,
  smartDraftApproval: null,
  commercialApproval: null,
  forceNewVersionDraft: false,
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
  commercialApprovalBy: document.querySelector("#commercialApprovalBy"),
  commercialApprovalConfirmed: document.querySelector("#commercialApprovalConfirmed"),
  privatizationAdjustment: document.querySelector("#privatizationAdjustment"),
  privatizationAdjustmentLabel: document.querySelector("#privatizationAdjustmentLabel"),
  notes: document.querySelector("#notes"),
  eventReason: document.querySelector("#eventReason"),
  generalTerms: document.querySelector("#generalTerms"),
  searchPrice: document.querySelector("#searchPrice"),
  categoryFilter: document.querySelector("#categoryFilter"),
  quickItemName: document.querySelector("#quickItemName"),
  quickItemValue: document.querySelector("#quickItemValue"),
  quickItemCategory: document.querySelector("#quickItemCategory"),
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
  loginPassword: document.querySelector("#loginPassword"),
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
  addQuickItemBtn: document.querySelector("#addQuickItemBtn"),
  sendReviewPanel: document.querySelector("#sendReviewPanel"),
  proposalTotal: document.querySelector("#proposalTotal"),
  proposalContent: document.querySelector("#proposalContent"),
  supabaseStatus: document.querySelector("#supabaseStatus"),
  authStatus: document.querySelector("#authStatus"),
  historyList: document.querySelector("#historyList"),
  pipelineBoard: document.querySelector("#pipelineBoard"),
  ownerMetrics: document.querySelector(".owner-metrics"),
  metricStageLead: document.querySelector("#metricStageLead"),
  metricStageReady: document.querySelector("#metricStageReady"),
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
  workspaceModeSwitch: document.querySelector("#workspaceModeSwitch"),
  operationsAgenda: document.querySelector("#operationsAgenda"),
  operationsAgendaMeta: document.querySelector("#operationsAgendaMeta"),
  pipelineQuickFilters: document.querySelector("#pipelineQuickFilters"),
  loadedEditorBar: document.querySelector("#loadedEditorBar"),
  firstReplyPanel: document.querySelector("#firstReplyPanel"),
  smartDraftPanel: document.querySelector("#smartDraftPanel"),
  commercialApprovalPanel: document.querySelector("#commercialApprovalPanel"),
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
  manualContactPanel: document.querySelector("#manualContactPanel"),
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

function savePrices({ localOnly = false } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prices));
  if (!localOnly && document.body.dataset.page === "valores") queueSharedSettingSave("catalog");
}

function saveSelectedIds() {
  localStorage.setItem(SELECTED_KEY, JSON.stringify([...state.selectedIds]));
}

function savePrivatizationRules({ localOnly = false } = {}) {
  localStorage.setItem(PRIVATIZATION_KEY, JSON.stringify(state.privatizationRules));
  if (!localOnly && document.body.dataset.page === "valores") queueSharedSettingSave("privatization");
}

function saveGeneralTerms() {
  localStorage.setItem(TERMS_KEY, fields.generalTerms.value);
}

function getCommercialSettingValue(key) {
  if (key === "catalog") return state.prices;
  if (key === "privatization") return state.privatizationRules;
  return loadCommunicationTemplates();
}

async function persistCommercialSetting(key, { firstPublication = false } = {}) {
  if (!state.supabase || !state.session || state.supabase.__qa) return false;
  if (!firstPublication && !state.sharedSettings[key]) return false;
  if (state.sharedSaving[key]) {
    state.sharedQueued[key] = true;
    return false;
  }
  state.sharedSaving[key] = true;
  const expected = state.sharedSettings[key]?.version || 0;
  const value = getCommercialSettingValue(key);
  try {
    const { data, error } = await state.supabase.rpc("save_commercial_setting", {
      p_key: key, p_value: value, p_expected_version: expected,
    });
    if (error || !data) {
      console.warn("Falha ao sincronizar configuração comercial.", key, error);
      showToast("Esta configuração mudou em outro navegador ou não foi salva. Recarregue antes de editar novamente.");
      return false;
    }
    state.sharedSettings[key] = data;
    renderSharedSettingStatus();
    return true;
  } finally {
    state.sharedSaving[key] = false;
    if (state.sharedQueued[key]) {
      state.sharedQueued[key] = false;
      queueSharedSettingSave(key, 0);
    }
  }
}

function queueSharedSettingSave(key, delay = 900) {
  if (!state.sharedSettings[key] || !state.session) return;
  clearTimeout(state.sharedSaveTimers[key]);
  state.sharedSaveTimers[key] = window.setTimeout(() => persistCommercialSetting(key), delay);
}

function renderSharedSettingStatus() {
  const catalog = document.querySelector("#catalogSharedStatus");
  const communication = document.querySelector("#communicationSharedStatus");
  if (catalog) catalog.textContent = state.sharedSettings.catalog && state.sharedSettings.privatization
    ? `Preços e regras compartilhados · versões ${state.sharedSettings.catalog.version} e ${state.sharedSettings.privatization.version}.`
    : "Valores deste navegador. Publique o catálogo e as regras aprovadas para compartilhar com a equipe.";
  if (communication) communication.textContent = state.sharedSettings.communication
    ? `Modelos compartilhados · versão ${state.sharedSettings.communication.version}.`
    : "Modelos deste navegador. Publique a versão aprovada para compartilhar com a equipe.";
}

async function loadSharedSettings() {
  if (!state.supabase || !state.session || state.supabase.__qa) return;
  const { data, error } = await state.supabase.from("commercial_settings").select("*");
  if (error) {
    console.warn("Não foi possível carregar configurações compartilhadas.", error);
    renderSharedSettingStatus();
    return;
  }
  state.sharedSettings = Object.fromEntries((data || []).map((row) => [row.config_key, row]));
  const editingEvent = Boolean(state.activeProposalId || state.activeQuoteRequestId);
  if (!editingEvent && Array.isArray(state.sharedSettings.catalog?.value)) {
    state.prices = state.sharedSettings.catalog.value.map(normalizeCatalogItem);
    savePrices({ localOnly: true });
  }
  if (!editingEvent && Array.isArray(state.sharedSettings.privatization?.value)) {
    state.privatizationRules = state.sharedSettings.privatization.value;
    savePrivatizationRules({ localOnly: true });
  }
  if (Array.isArray(state.sharedSettings.communication?.value)) {
    localStorage.setItem(COMMUNICATION_TEMPLATES_KEY, JSON.stringify(state.sharedSettings.communication.value));
  }
  renderSharedSettingStatus();
  renderAll();
}

async function publishCommercialSettings(keys) {
  if (!state.session) {
    showToast("Entre com o e-mail da equipe antes de publicar.");
    return;
  }
  const results = await Promise.all(keys.map((key) => persistCommercialSetting(key, { firstPublication: true })));
  if (results.every(Boolean)) showToast("Configuração compartilhada com a equipe.");
}

function loadSupabaseConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
    if (saved && saved.url && saved.anonKey) {
      // Evita que uma chave antiga salva neste navegador continue prevalecendo
      // depois de uma atualização da configuração oficial do projeto.
      if (saved.url === DEFAULT_SUPABASE_URL && saved.anonKey !== DEFAULT_SUPABASE_ANON_KEY) {
        const canonical = { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
        localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(canonical));
        return canonical;
      }
      return saved;
    }
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

function getLocalInputDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const localIso = new Date(safeDate.getTime() - safeDate.getTimezoneOffset() * 60000).toISOString();
  return {
    date: localIso.slice(0, 10),
    time: localIso.slice(11, 16),
  };
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

function getManualContacts(snapshot = {}) {
  return Array.isArray(snapshot.manualContacts) ? snapshot.manualContacts : [];
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

function getClientVisibleProposalChanges(previousSnapshot = {}, nextSnapshot = {}) {
  const visibleLabels = new Set(["Tipo", "Data", "Horário", "Convidados", "Duração", "Itens", "Total"]);
  return getProposalChangeList(previousSnapshot, nextSnapshot).filter((change) => visibleLabels.has(change.label));
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
    proposta_pronta: "Proposta revisada, aguardando envio.",
    proposta_enviada: "Envio confirmado; acompanhar resposta.",
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
    proposta_pronta: "Proposta pronta para envio.",
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
  if (entry.type === "contato_manual") return "contact";
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
    contact: "CONTATO",
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

    if (status === "proposta_pronta") {
      return {
        tone: "commercial",
        title: "Enviar proposta ao cliente",
        note: "A proposta está pronta. Escolha WhatsApp ou e-mail e confirme o envio antes de iniciar o acompanhamento.",
        action: "focus_review",
        actionLabel: "Revisar e enviar",
      };
    }

    if (status === "proposta_enviada") {
      return {
        tone: "commercial",
        title: "Acompanhar retorno do cliente",
        note: "Confira o envio no histórico e escolha uma retomada curta se o cliente ainda não respondeu.",
        action: "focus_quick_replies",
        actionLabel: "Ver respostas rápidas",
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
      title: "Salvar proposta pronta para envio",
      note: "Salve a proposta e confira o canal antes de enviar ao cliente.",
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

function buildFirstReplyDraft(request) {
  const en=request.snapshot?.cliente?.idioma === "en" || request.snapshot?.event?.clientLanguage === "en";
  const tr=(pt,english)=>en?english:pt;
  const name=String(request.cliente_nome || fields.clientName.value || "").trim().split(/\s+/)[0] || tr("cliente","there");
  const type=request.tipo_evento || fields.eventType.value || tr("seu evento","your event");
  const date=request.data_evento || fields.eventDate.value, guests=Number(request.convidados || 0);
  const dateLabel=date?(en?new Intl.DateTimeFormat("en-US",{dateStyle:"medium"}).format(new Date(`${date}T12:00:00`)):formatDateFromIso(date)):"";
  const context=[date?tr(`para ${dateLabel}`,`on ${dateLabel}`):"",guests>1?tr(`para ${guests} pessoas`,`for ${guests} guests`):""].filter(Boolean).join(" ");
  const missing=[!date?tr("qual data você tem em mente?","which date are you considering?"):"",!request.horario_evento?tr("qual seria o horário?","what time would suit you?"):"",!guests?tr("quantas pessoas participarão?","how many guests will attend?"):""].filter(Boolean);
  return [tr(`Olá, ${name}! Recebemos seu pedido para ${type}${context?` ${context}`:""} na Embaixada Carioca.`,`Hello, ${name}! We received your request for ${type}${context?` ${context}`:""} at Embaixada Carioca.`),missing.length?tr(`Para preparar uma opção precisa, preciso confirmar: ${missing.slice(0,2).join(" ")}`,`To prepare a suitable option, I need to confirm: ${missing.slice(0,2).join(" ")}`):tr("Vou conferir os detalhes e volto com uma proposta adequada ao seu grupo.","I will review the details and return with a proposal for your group."),tr("Se tiver alguma preferência ou necessidade especial, pode me contar por aqui.","Please let me know if you have any preferences or special requirements.")].join("\n\n");
}

function buildSmartDraftSuggestion(request) {
  if (!request) return null;
  const eventKey = getGuidedEventKeyFromType(request.tipo_evento);
  const template = smartEventTemplates[eventKey];
  if (!template) return null;
  const guests = Number(request.convidados || request.snapshot?.evento?.convidados || 0);
  const text = normalizarTextoSeguro([
    request.tipo_evento,
    request.preferencias,
    request.observacoes,
    request.snapshot?.evento?.preferencias,
    request.snapshot?.evento?.observacoes,
    request.snapshot?.qualificacao?.momento,
  ].filter(Boolean).join(" "));
  let baseIds = template.ids.filter(itemExists);
  if (eventKey === "cafe" && guests >= 50 && itemExists("cafe-completo")) baseIds = ["cafe-completo"];
  if (eventKey === "coquetel" && guests > 0 && guests <= 25) {
    baseIds = ["coquetel-caipirinha", "brasileiro-i"].filter(itemExists);
  }
  const defaultDurations = { coquetel: 2, workshop: 1.5, cafe: 1.5, almoco: 1.5, welcome: 1 };
  const informedDuration = Number(request.duracao || request.snapshot?.evento?.duracao || 0);
  const duration = informedDuration > 0 ? informedDuration : defaultDurations[eventKey] || 1;
  const addOns = [];
  if (eventKey === "coquetel" && guests >= 40 && itemExists("welcome-caipirinha")) {
    addOns.push({ id: "welcome-caipirinha", reason: "Recepção fluida para grupo de 40 pessoas ou mais." });
  }
  if (eventKey === "coquetel" && /ingles|english|estrangeir|international/.test(text) && itemExists("workshop-caipirinha-en")) {
    addOns.push({ id: "workshop-caipirinha-en", reason: "Experiência em inglês indicada pelo perfil internacional do grupo." });
  }
  if (eventKey === "almoco" && guests >= 40 && itemExists("welcome-caipirinha")) {
    addOns.push({ id: "welcome-caipirinha", reason: "Ajuda a receber o grupo enquanto todos chegam para o almoço." });
  }
  const reasons = [
    `Formato informado: ${request.tipo_evento || template.label}.`,
    guests ? `Dimensionado para ${guests} convidados.` : "Público ainda precisa ser confirmado.",
    informedDuration ? `Duração de ${duration}h preservada do briefing.` : `Duração inicial sugerida: ${duration}h.`,
    request.snapshot?.qualificacao?.momento ? `Momento informado: ${request.snapshot.qualificacao.momento}.` : "Horário será validado antes do envio.",
  ];
  return {
    requestId: request.id,
    eventKey,
    label: template.label,
    baseIds,
    addOns,
    selectedAddOns: [],
    duration,
    reasons,
    message: buildFirstReplyDraft(request),
    dismissed: false,
  };
}

function getSmartDraftItemLabel(id) {
  return state.prices.find((item) => item.id === id)?.nome || id;
}

function renderSmartDraftPanel() {
  if (!nodes.smartDraftPanel) return;
  const suggestion = state.smartDraftSuggestion;
  const request = getActiveQuoteRequest();
  if (!suggestion || suggestion.dismissed || !request || suggestion.requestId !== request.id || getActiveProposal()) {
    nodes.smartDraftPanel.classList.add("is-hidden");
    nodes.smartDraftPanel.innerHTML = "";
    return;
  }
  const approved = state.smartDraftApproval?.requestId === request.id;
  const selectedAddOns = new Set(suggestion.selectedAddOns || []);
  nodes.smartDraftPanel.classList.remove("is-hidden");
  nodes.smartDraftPanel.innerHTML = `
    <div class="smart-draft-heading">
      <div><span>Rascunho inteligente</span><h2>${escapeHtml(approved ? "Sugestão aprovada pelo vendedor" : "Sugestão pronta para sua revisão")}</h2></div>
      <small>Nada é enviado ou aplicado sem sua aprovação.</small>
    </div>
    <div class="smart-draft-grid">
      <article>
        <span>Pacote-base</span>
        <strong>${escapeHtml(suggestion.baseIds.map(getSmartDraftItemLabel).join(" + ") || suggestion.label)}</strong>
        <small>Duração sugerida: ${escapeHtml(String(suggestion.duration).replace(".5", "h30").replace(/^(\d+)$/, "$1h"))}</small>
      </article>
      <article>
        <span>Por que foi sugerido</span>
        <ul>${suggestion.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      </article>
    </div>
    ${suggestion.addOns.length ? `<div class="smart-draft-addons"><span>Adicionais opcionais — escolha antes de aplicar</span>${suggestion.addOns.map((addOn) => `<button type="button" class="${selectedAddOns.has(addOn.id) ? "is-active" : ""}" data-smart-addon-id="${escapeHtml(addOn.id)}"><strong>${escapeHtml(getSmartDraftItemLabel(addOn.id))}</strong><small>${escapeHtml(addOn.reason)}</small></button>`).join("")}</div>` : ""}
    <div class="smart-draft-actions">
      ${approved
        ? `<span class="smart-draft-approved">Aprovado em ${escapeHtml(formatSavedAt(state.smartDraftApproval.approvedAt))}. Você ainda pode editar qualquer campo.</span>`
        : `<button class="primary" type="button" data-smart-draft-action="apply">Aplicar rascunho</button><button class="secondary" type="button" data-smart-draft-action="dismiss">Montar manualmente</button>`}
    </div>
  `;
}

function toggleSmartDraftAddOn(id) {
  const suggestion = state.smartDraftSuggestion;
  if (!suggestion?.addOns.some((item) => item.id === id)) return;
  const selected = new Set(suggestion.selectedAddOns || []);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  suggestion.selectedAddOns = [...selected];
  renderSmartDraftPanel();
}

function applySmartDraftSuggestion() {
  const suggestion = state.smartDraftSuggestion;
  if (!suggestion) return;
  const appliedIds = [...new Set([...suggestion.baseIds, ...(suggestion.selectedAddOns || [])])].filter(itemExists);
  state.selectedIds.clear();
  appliedIds.forEach((id) => state.selectedIds.add(id));
  state.guided.event = suggestion.eventKey;
  state.guided.beverageId = appliedIds.find((id) => coquetelBeverageIds.includes(id)) || "";
  state.guided.foodId = appliedIds.find((id) => coquetelFoodIds.includes(id)) || "";
  state.guided.welcomeId = appliedIds.find((id) => welcomeDrinkIds.includes(id)) || "";
  state.guided.workshopId = appliedIds.find((id) => workshopIds.includes(id)) || "";
  fields.eventDuration.value = String(suggestion.duration);
  fields.categoryFilter.value = getEventCategoryFromRequest(fields.eventType.value);
  state.firstReplyDraft = suggestion.message;
  state.smartDraftApproval = {
    requestId: suggestion.requestId,
    approvedAt: new Date().toISOString(),
    approvedBy: getCurrentTeamEmail(),
    appliedIds,
    duration: suggestion.duration,
    reasons: suggestion.reasons,
  };
  saveSelectedIds();
  setChoiceState(nodes.flowEventOptions, suggestion.eventKey, "flowEvent");
  setChoiceState(nodes.flowBeverageOptions, state.guided.beverageId, "selectPackage");
  setChoiceState(nodes.flowFoodOptions, state.guided.foodId, "selectPackage");
  setChoiceState(nodes.flowWelcomeOptions, state.guided.welcomeId, "selectPackage");
  setChoiceState(nodes.flowWorkshopOptions, state.guided.workshopId, "selectPackage");
  if (nodes.flowStatus) nodes.flowStatus.textContent = "Rascunho aplicado após aprovação humana. Revise itens, valores, disponibilidade e mensagem antes do envio.";
  renderAll();
  showToast("Rascunho aplicado. Revise e personalize antes de salvar ou enviar.");
}

function renderFirstReplyPanel() {
  if (!nodes.firstReplyPanel) return;
  const request = getActiveQuoteRequest();
  if (!request || getActiveProposal()) {
    nodes.firstReplyPanel.classList.add("is-hidden");
    nodes.firstReplyPanel.innerHTML = "";
    return;
  }
  if (state.firstReplySourceId !== request.id) {
    state.firstReplySourceId = request.id;
    state.firstReplyDraft = buildFirstReplyDraft(request);
    state.firstReplyChannel = "";
  }
  const opportunity = getOpportunityForItem({ opportunityId: request.oportunidade_id });
  const responded = Boolean(opportunity?.metadata?.first_reply_sent_at);
  const summary = [
    request.tipo_evento || "Formato a confirmar",
    request.data_evento ? formatDateFromIso(request.data_evento) : "Data a confirmar",
    request.horario_evento || "Horário a confirmar",
    request.convidados ? `${request.convidados} pax` : "Pax a confirmar",
  ].join(" · ");
  nodes.firstReplyPanel.classList.remove("is-hidden");
  nodes.firstReplyPanel.innerHTML = `
    <div class="first-reply-heading">
      <div><span>Atendimento imediato</span><h2>${escapeHtml(responded ? "Primeiro contato registrado" : "Responda antes de fechar a proposta")}</h2></div>
      <small>${escapeHtml(summary)}</small>
    </div>
    <label for="firstReplyText">Mensagem editável</label>
    <textarea id="firstReplyText" rows="5">${escapeHtml(state.firstReplyDraft)}</textarea>
    <div class="first-reply-actions">
      ${request.cliente_whatsapp ? '<button class="primary" type="button" data-first-reply-action="whatsapp">Abrir WhatsApp</button>' : ""}
      ${request.cliente_email ? '<button class="secondary" type="button" data-first-reply-action="email">Abrir e-mail</button>' : ""}
      <button class="secondary" type="button" data-first-reply-action="copy">Copiar mensagem</button>
      <button class="secondary" type="button" data-first-reply-action="register" ${state.firstReplyChannel ? "" : "disabled"}>Registrar contato feito</button>
    </div>
    <small>Abra ou copie, envie pelo canal escolhido e depois registre o contato. A proposta pode ser montada em seguida.</small>
  `;
}

async function runFirstReplyAction(action) {
  const request = getActiveQuoteRequest();
  if (!request) return;
  const message = String(state.firstReplyDraft || "").trim();
  if (!message) {
    showToast("Escreva a mensagem antes de continuar.");
    nodes.firstReplyPanel?.querySelector("textarea")?.focus();
    return;
  }
  if (action === "register") {
    const opportunity = getOpportunityForItem({ opportunityId: request.oportunidade_id });
    if (!opportunity || !state.firstReplyChannel) {
      showToast("Abra um canal ou copie a mensagem antes de registrar o contato.");
      return;
    }
    const at = new Date().toISOString();
    const followsDefault = opportunity.metadata?.next_action_source === "default";
    const { data, error } = await state.supabase.from("oportunidades")
      .update({
        ultimo_contato_em: at,
        ...(followsDefault ? { proxima_acao: "Montar proposta", proxima_acao_em: new Date(Date.now() + 864e5).toISOString() } : {}),
        metadata: {
          ...(opportunity.metadata || {}),
          first_reply_sent_at: at,
          first_reply_channel: state.firstReplyChannel,
          first_reply_text: message.slice(0, 3000),
        },
      })
      .eq("id", opportunity.id).select("*").single();
    if (error || !data) {
      showToast("Não foi possível registrar o contato. Tente novamente.");
      return;
    }
    state.opportunities = state.opportunities.map((row) => row.id === data.id ? data : row);
    state.firstReplyChannel = "";
    renderFirstReplyPanel();
    renderPipeline();
    showToast("Primeiro contato registrado. Agora monte a proposta.");
    return;
  }
  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(message);
      state.firstReplyChannel = "copiado";
      renderFirstReplyPanel();
      showToast("Mensagem copiada. Após enviar, registre o contato.");
    } catch (_error) {
      showToast("Não foi possível copiar. Selecione o texto para copiar manualmente.");
    }
    return;
  }
  if (action === "email" && request.cliente_email) {
    window.location.href = `mailto:${encodeURIComponent(request.cliente_email)}?subject=${encodeURIComponent("Seu evento na Embaixada Carioca")}&body=${encodeURIComponent(message)}`;
  } else if (action === "whatsapp" && request.cliente_whatsapp) {
    const digits = request.cliente_whatsapp.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  } else return;
  state.firstReplyChannel = action;
  renderFirstReplyPanel();
  showToast("Confira e envie a mensagem no aplicativo. Depois registre o contato.");
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
    ${renderProposalJourney(proposal)}
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
               …116584 tokens truncated…s";
  if (fields.signalDeadlineHours) {
    fields.signalDeadlineHours.value = String(snapshot.event?.signalDeadlineHours || DEFAULT_SIGNAL_DEADLINE_HOURS);
  }
  fields.manualAdjustment.value = getManualAdjustmentInputValue(snapshot.event?.manualAdjustment, snapshot.totals?.adjustment);
  fields.manualAdjustmentLabel.value = snapshot.event?.manualAdjustmentLabel || snapshot.totals?.adjustmentLabel || "";
  if (fields.commercialApprovalBy) fields.commercialApprovalBy.value = snapshot.commercialApproval?.approvedBy || "";
  if (fields.commercialApprovalConfirmed) fields.commercialApprovalConfirmed.checked = Boolean(snapshot.commercialApproval?.approved);
  if (fields.privatizationAdjustment) {
    fields.privatizationAdjustment.value = getPrivatizationAdjustmentInputValue(
      snapshot.event?.privatizationAdjustment,
      snapshot.totals?.privatizationAdjustment,
    );
  }
  if (fields.privatizationAdjustmentLabel) {
    fields.privatizationAdjustmentLabel.value =
      snapshot.event?.privatizationAdjustmentLabel || snapshot.totals?.privatizationAdjustmentLabel || "";
  }
  fields.eventReason.value = snapshot.event?.reason || "";
  fields.notes.value = snapshot.event?.notes || "";
  fields.generalTerms.value = snapshot.generalTerms || loadGeneralTerms();
  state.smartDraftSuggestion = null;
  state.smartDraftApproval = snapshot.smartDraft || null;
  renderProposalNextStep();
  renderSignalPaymentInfo(snapshot.pagamentoSinal, snapshot.pagamentoRestante);
  renderOperationalChecklist(getActiveProposal());
  renderCommercialTimeline(getActiveProposal());
  renderManualContactPanel(getActiveProposal());
  renderInternalNotesPanel(getActiveProposal());
  renderEventAttachmentsPanel(getActiveProposal());

  if (Array.isArray(snapshot.prices) && snapshot.prices.length) {
    state.prices = snapshot.prices.map(normalizeCatalogItem);
    savePrices({ localOnly: true });
  }
  if (Array.isArray(snapshot.selectedItems) && snapshot.selectedItems.length) {
    snapshot.selectedItems.forEach((item) => {
      if (!item?.id || state.prices.some((price) => price.id === item.id)) return;
      const active = item.active !== undefined ? item.active : false;
      state.prices.push(normalizeCatalogItem({ ...item, active }));
    });
  }

  state.selectedIds = new Set(snapshot.selectedIds || snapshot.selectedItems?.map((item) => item.id) || []);
  state.guided = snapshot.guided || { event: "", beverageId: "", foodId: "" };
  state.privatizationChoice = snapshot.privatizationChoice || "";

  if (Array.isArray(snapshot.privatizationRules) && snapshot.privatizationRules.length) {
    state.privatizationRules = snapshot.privatizationRules;
    savePrivatizationRules({ localOnly: true });
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
  state.activeOpportunityId = proposal.oportunidade_id || "";
  state.manualSourceKey = "";
  state.quoteGuideDismissed = true;
  state.smartDraftSuggestion = null;
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
  const clientExperience = getClientExperience(totals.privatization);
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
        ${clientExperience ? `<div><span>${escapeHtml(clientExperience.label)}</span><strong>${formatMoney(totals.privatization.amount)}</strong></div>` : ""}
        ${totals.adjustment ? `<div><span>${escapeHtml(totals.adjustmentLabel)}</span><strong>${formatMoney(totals.adjustment)}</strong></div>` : ""}
        <div><span>Total estimado</span><strong>${formatMoney(totals.total)}</strong></div>
      </div>

      ${clientExperience ? `<div class="proposal-note"><span>${escapeHtml(clientExperience.label)}</span>${escapeHtml(clientExperience.description)}</div>` : ""}

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
  showToast(state.sharedSettings.communication ? "Textos salvos; sincronizando com a equipe." : "Textos salvos neste navegador. Publique para compartilhar.");
}

function handleResetCommunicationTemplates() {
  if (!window.confirm("Restaurar os textos padrão de e-mail e WhatsApp?")) return;
  localStorage.removeItem(COMMUNICATION_TEMPLATES_KEY);
  queueSharedSettingSave("communication", 0);
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
  renderWorkspaceMode();
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
  renderFirstReplyPanel();
  renderSmartDraftPanel();
  renderCommercialApprovalPanel();
  renderLeadReviewPanel();
  renderProposalNextStep();
  renderManualContactPanel();
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
  renderSharedSettingStatus();
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
  state.activeOpportunityId = "";
  if (Array.isArray(state.sharedSettings.catalog?.value)) state.prices = state.sharedSettings.catalog.value.map(normalizeCatalogItem);
  if (Array.isArray(state.sharedSettings.privatization?.value)) state.privatizationRules = state.sharedSettings.privatization.value;
  delete state.sourceOverrides["manual:draft"];
  delete state.sourceOverrides["manual:realized"];
  state.manualSourceKey = isRealizedMode ? "manual:realized" : "manual:draft";
  state.activeEditorContext = null;
  state.loadedEditorSignature = "";
  state.quoteGuideDismissed = true;
  state.smartDraftSuggestion = null;
  state.smartDraftApproval = null;
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
  if (fields.privatizationAdjustment) fields.privatizationAdjustment.value = "0";
  if (fields.privatizationAdjustmentLabel) fields.privatizationAdjustmentLabel.value = "";
  if (fields.quickItemName) fields.quickItemName.value = "";
  if (fields.quickItemValue) fields.quickItemValue.value = "";
  if (fields.quickItemCategory) fields.quickItemCategory.value = "Extra do evento";
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
  renderManualContactPanel(null);
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

function getSupabaseSaveErrorMessage(error, context = {}) {
  const raw = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" ");
  const text = raw.toLowerCase();
  const email = normalizeEmail(context.email || getCurrentTeamEmail());
  if (text.includes("invalid input syntax for type uuid") || text.includes("22p02")) {
    return "Não foi possível salvar: havia um identificador interno inválido. Atualize a página e tente novamente.";
  }
  if (
    text.includes("jwt") ||
    text.includes("unauthorized") ||
    text.includes("not authenticated") ||
    text.includes("auth") ||
    text.includes("401")
  ) {
    return `Sessão expirada no Supabase. Saia e entre novamente com ${getAuthorizedTeamEmailsText()}.`;
  }
  if (text.includes("public_token_expires_at")) {
    return "Não foi possível salvar: falta a validade do link público no Supabase.";
  }
  if (text.includes("public_token") || text.includes("public token")) {
    return "Não foi possível salvar: falta a configuração do link público da proposta no Supabase.";
  }
  if (text.includes("column") || text.includes("schema") || text.includes("cache")) {
    return "Não foi possível salvar: o schema do Supabase precisa ser atualizado.";
  }
  if (text.includes("permission") || text.includes("policy") || text.includes("rls") || text.includes("403") || text.includes("42501")) {
    return email
      ? `Supabase recusou o salvamento para ${email}. Saia e entre novamente; se persistir, revise a permissão da tabela propostas.`
      : "Supabase recusou o salvamento. Entre novamente; se persistir, revise a permissão da tabela propostas.";
  }
  return "Não foi possível salvar a proposta. Confira a conexão e tente novamente.";
}

function getPublicProposalUrl(proposal) {
  const token = proposal?.public_token;
  if (!token) return "";
  const language = proposal?.snapshot?.event?.clientLanguage === "en" ? "&lang=en" : "";
  return `${CANONICAL_PUBLIC_PROPOSAL_URL}?p=${encodeURIComponent(token)}${language}`;
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
  state.lastProposalShareError = "";
  if (!ensureProposalReadyForSending()) return null;
  const activeProposal = state.proposals.find((item) => item.id === state.activeProposalId);
  const status = activeProposal?.status && activeProposal.status !== "cancelado" ? activeProposal.status : "proposta_pronta";
  const saved = await saveCurrentProposal(status, null, { forSharing: true });
  if (!saved) {
    state.lastProposalShareError = state.lastProposalSaveError || "Não foi possível salvar a proposta antes do envio.";
    return null;
  }
  const url = getPublicProposalUrl(saved);
  if (!url) {
    state.lastProposalShareError = "A proposta foi salva, mas ainda não recebeu o link público. Atualize o schema do Supabase.";
    showToast(state.lastProposalShareError);
    return null;
  }
  return { saved, url };
}

async function registerConfirmedProposalSend(proposal, manualChannel = "") {
  if (!proposal || proposal.status !== "proposta_pronta") return true;
  const sentAt = new Date().toISOString();
  // A Edge Function pode ter acrescentado o registro do envio ao snapshot.
  // Leia a versão mais recente antes de gravar o prazo e o histórico manual.
  const { data: currentRow, error: readError } = await state.supabase
    .from("propostas")
    .select("snapshot")
    .eq("id", proposal.id)
    .single();
  if (manualChannel && (readError || !currentRow?.snapshot)) {
    showToast("Não foi possível carregar o histórico da proposta. Atualize e tente registrar o envio novamente.");
    return false;
  }
  const currentSnapshot = currentRow?.snapshot;
  const signalDeadlineHours = Number(currentSnapshot?.event?.signalDeadlineHours) || 0;
  const snapshotWithDeadline = currentSnapshot
    ? {
        ...currentSnapshot,
        event: {
          ...(currentSnapshot.event || {}),
          signalDeadlineAt: signalDeadlineHours > 0
            ? new Date(new Date(sentAt).getTime() + signalDeadlineHours * 36e5).toISOString()
            : null,
        },
      }
    : null;
  const updatedSnapshot = manualChannel && snapshotWithDeadline
    ? withCommercialHistoryEntries(
        { ...snapshotWithDeadline, ultimoEnvioManualEm: sentAt },
        [createCommercialHistoryEntry("envio", "Envio manual registrado", `Canal: ${manualChannel}. Confirmado pela equipe.`)],
      )
    : snapshotWithDeadline;
  const { data, error } = await state.supabase
    .from("propostas")
    .update({
      status: "proposta_enviada",
      publication_status: "sent",
      sent_at: sentAt,
      ...(updatedSnapshot ? { snapshot: updatedSnapshot } : {}),
    })
    .eq("id", proposal.id)
    .eq("status", "proposta_pronta")
    .select("*")
    .single();
  if (error || !data) {
    console.warn("Mensagem enviada; falha ao avançar o funil.", error);
    showToast("Mensagem enviada, mas a etapa não foi atualizada. Atualize o funil e confira o histórico.");
    return false;
  }
  upsertProposalState(data);
  captureEventAnalytics("proposal_sent", data, { channel: manualChannel || "system" }, {
    dedupeKey: `proposal-sent:${data.id}:${data.versao || 1}`,
  });
  if (data.solicitacao_id) {
    const result = await state.supabase
      .from("solicitacoes_cotacao")
      .update({ status: "proposta_enviada" })
      .eq("id", data.solicitacao_id);
    if (result.error) console.warn("Envio confirmado; falha ao atualizar o lead.", result.error);
  }
  renderPipeline();
  renderCommercialTimeline(data);
  renderProposalNextStep();
  return true;
}

function openManualSendDialog() {
  const proposal = getActiveProposal();
  if (!proposal || proposal.status !== "proposta_pronta") {
    showToast("Abra uma proposta pronta para registrar o envio.");
    return;
  }
  const dialog = document.createElement("dialog");
  dialog.className = "send-confirm-dialog";
  dialog.innerHTML = `<form method="dialog" class="send-confirm-form">
    <h2>Registrar envio feito fora do sistema</h2>
    <p>Use após confirmar que o cliente recebeu o link. O registro inicia o acompanhamento no funil.</p>
    <label>Canal <select name="channel" required>
      <option value="">Selecione</option><option value="WhatsApp">WhatsApp</option>
      <option value="E-mail">E-mail</option><option value="Outro">Outro</option>
    </select></label>
    <label><input type="checkbox" name="sent" required /> Enviei o link para o cliente</label>
    <div class="send-confirm-actions">
      <button type="button" class="secondary" data-close-manual>Voltar</button>
      <button type="submit" class="primary">Registrar envio</button>
    </div>
  </form>`;
  document.body.append(dialog);
  dialog.querySelector("[data-close-manual]").addEventListener("click", () => dialog.close());
  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const ok = await registerConfirmedProposalSend(proposal, form.elements.channel.value);
    if (ok) {
      dialog.close();
      await loadProposalHistory();
      showToast("Envio manual registrado e acompanhamento iniciado.");
    } else button.disabled = false;
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
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
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "send-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "sendConfirmTitle");
    dialog.innerHTML = `<form method="dialog" class="send-confirm-form">
      <h2 id="sendConfirmTitle">Revisar ${escapeHtml(channel)} antes de enviar</h2>
      <p class="send-confirm-details">${escapeHtml(details)}</p>
      <div class="send-confirm-actions">
        <button type="submit" value="cancel" class="secondary" autofocus>Cancelar</button>
        <button type="submit" value="confirm" class="primary">${action.startsWith("abrir") ? "Abrir e-mail" : "Confirmar envio"}</button>
      </div>
    </form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "confirm");
      dialog.remove();
    }, { once: true });
    dialog.showModal();
  });
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

  const reviewedResponseAt = getOpportunityForItem({ opportunityId: proposal.oportunidade_id })?.ultima_resposta_cliente_em || null;
  if (!skipConfirm) {
    const confirmed = await confirmClientSend({
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
        approved: true,
        reviewedResponseAt,
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
      detail: data?.duplicate ? data.message : `Aceito pelo canal para ${phone}. Entrega não confirmada.`,
    });
    captureEventAnalytics("proposal_sent", proposal, { channel: "whatsapp", result: data?.duplicate ? "duplicate" : "accepted" }, {
      dedupeKey: `proposal-sent:${proposal.id}:${proposal.versao || 1}`,
    });
    const stageUpdated = QA_MODE ? await registerConfirmedProposalSend(proposal, "WhatsApp") : true;
    if (stageUpdated) showToast(data.message || "Aceito pelo WhatsApp; entrega não confirmada.");
    await loadCommercialInsights();
    if (typeof loadEventOperations === "function") await loadEventOperations();
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

  const reviewedResponseAt = getOpportunityForItem({ opportunityId: proposal.oportunidade_id })?.ultima_resposta_cliente_em || null;
  if (!skipConfirm) {
    const confirmed = await confirmClientSend({
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
        approved: true,
        reviewedResponseAt,
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
      detail: data?.duplicate ? data.message : `Aceito pelo canal para ${destination}. Entrega não confirmada.`,
    });
    captureEventAnalytics("proposal_sent", proposal, { channel: "email", result: data?.duplicate ? "duplicate" : "accepted" }, {
      dedupeKey: `proposal-sent:${proposal.id}:${proposal.versao || 1}`,
    });
    const stageUpdated = QA_MODE ? await registerConfirmedProposalSend(proposal, "E-mail") : true;
    if (stageUpdated) showToast(data.message || "Aceito pelo e-mail; entrega não confirmada.");
    await loadCommercialInsights();
    if (typeof loadEventOperations === "function") await loadEventOperations();
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
  const confirmed = await confirmClientSend({
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
    const detail = state.lastProposalShareError || "E-mail não enviado: não foi possível gerar o link seguro da proposta.";
    createIntegrationLog({
      channel: "email",
      status: "error",
      title: "Proposta comercial",
      detail,
      target: email,
    });
    showToast(detail);
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
    case "focus_quick_replies":
      document.querySelector(".quick-replies-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  const confirmed = await confirmClientSend({
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
      renderCommercialApprovalPanel();
      renderLeadReviewPanel();
      renderProposalNextStep();
      renderQuickReplies();
      renderLoadedEditorBar();
      renderSummary();
      renderSendReview();
      renderCalculation();
      renderProposal();
      if (typeof renderEventOfferBuilder === "function") renderEventOfferBuilder();
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
  nodes.addQuickItemBtn?.addEventListener("click", createQuickBudgetItem);

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
  document.querySelector("#topbarNewProposalBtn")?.addEventListener("click", startNewProposal);
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
  nodes.firstReplyPanel?.addEventListener("input", (event) => {
    if (event.target.id === "firstReplyText") state.firstReplyDraft = event.target.value;
  });
  nodes.firstReplyPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-first-reply-action]");
    if (button) runFirstReplyAction(button.dataset.firstReplyAction);
  });
  nodes.smartDraftPanel?.addEventListener("click", (event) => {
    const addOn = event.target.closest("button[data-smart-addon-id]");
    if (addOn) {
      toggleSmartDraftAddOn(addOn.dataset.smartAddonId);
      return;
    }
    const action = event.target.closest("button[data-smart-draft-action]");
    if (!action) return;
    if (action.dataset.smartDraftAction === "apply") applySmartDraftSuggestion();
    if (action.dataset.smartDraftAction === "dismiss") {
      state.smartDraftSuggestion.dismissed = true;
      renderSmartDraftPanel();
      showToast("Sugestão ignorada. A proposta permanece livre para montagem manual.");
    }
  });
  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal());
  document.querySelector("#confirmEventBtn")?.addEventListener("click", confirmCurrentEvent);
  document.querySelector("#copyBtn")?.addEventListener("click", copyProposalLink);
  document.querySelector("#manualSendBtn")?.addEventListener("click", openManualSendDialog);
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
  document.querySelector("#publishCommunicationBtn")?.addEventListener("click", () => publishCommercialSettings(["communication"]));
  document.querySelector("#publishCatalogBtn")?.addEventListener("click", () => publishCommercialSettings(["catalog", "privatization"]));
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
  document.querySelector("#passwordLoginBtn")?.addEventListener("click", loginWithPassword);
  fields.loginPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginWithPassword();
  });
  document.querySelectorAll("[data-team-email]").forEach((button) => {
    button.addEventListener("click", () => {
      fields.loginEmail.value = button.dataset.teamEmail;
      fields.loginEmail.focus();
    });
  });
  document.querySelector("#recoverMagicLinkBtn")?.addEventListener("click", recoverMagicLinkSession);
  document.querySelector("#logoutBtn")?.addEventListener("click", logoutSupabase);
  document.querySelector("#refreshHistoryBtn")?.addEventListener("click", async () => {
    await loadProposalHistory();
    await loadCommercialInsights();
    renderPipeline();
  });
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
    const planButton = event.target.closest("button[data-plan-id]");
    if (planButton) {
      openActionPlanDialog(planButton.dataset.planKind, planButton.dataset.planId);
      return;
    }
    const changeButton = event.target.closest("[data-client-change-id]");
    if (changeButton) {
      showClientChangeDetails(changeButton.dataset.clientChangeKind, changeButton.dataset.clientChangeId);
      return;
    }
    const resolutionButton = event.target.closest("button[data-action-resolution]");
    if (resolutionButton) {
      await resolveActionTask(resolutionButton, "Prioridade agora");
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
  nodes.workspaceModeSwitch?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-workspace-mode]");
    if (!button) return;
    setWorkspaceMode(button.dataset.workspaceMode);
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
    const handoffTask = event.target.closest("input[data-handoff-task-id]");
    if (handoffTask) {
      updateOperationalHandoffTask(handoffTask.dataset.handoffTaskId, handoffTask.checked);
      return;
    }
    const checkbox = event.target.closest("input[data-checklist-id]");
    if (!checkbox) return;
    updateOperationalChecklist(checkbox.dataset.checklistId, checkbox.checked);
  });
  nodes.operationalChecklist?.addEventListener("click", (event) => {
    if (event.target.closest("button[data-handoff-ack-changes]")) {
      acknowledgeOperationalHandoffChanges();
      return;
    }
    const button = event.target.closest("button[data-operational-doc]");
    if (!button) return;
    handleOperationalDocAction(button.dataset.operationalDoc);
  });
  nodes.manualContactPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-add-manual-contact]");
    if (!button) return;
    addManualContact(button.dataset.addManualContact);
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
  nodes.commercialTimeline?.addEventListener("click", async (event) => {
    const duplicateButton = event.target.closest("button[data-duplicate-proposal-id]");
    if (duplicateButton) {
      await duplicateProposalForAdjustment(duplicateButton.dataset.duplicateProposalId);
      return;
    }
    const button = event.target.closest("button[data-proposal-id]");
    if (button) await safeOpenSavedProposal(button.dataset.proposalId, "Versões da proposta");
  });
  nodes.pipelineBoard?.addEventListener("click", async (event) => {
    const outcomeButton = event.target.closest("button[data-outcome-id]");
    if (outcomeButton) {
      await classifyPastEvent(outcomeButton.dataset.outcomeKind, outcomeButton.dataset.outcomeId);
      return;
    }
    const planButton = event.target.closest("button[data-plan-id]");
    if (planButton) {
      openActionPlanDialog(planButton.dataset.planKind, planButton.dataset.planId);
      return;
    }
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
