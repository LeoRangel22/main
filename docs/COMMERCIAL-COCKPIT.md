# Painel comercial: velocidade, próxima ação e medição

## Organização

- `event-data.js`: leitura paginada de até 80 registros, no máximo quatro páginas em paralelo; manifesto de revisões, cache somente em memória, reconciliação de exclusões, atualização atômica e isolamento de sessão.
- `commercial-rules.js`: composição de oportunidades/versões, classificação de eventos passados e ranking explicado das ações. Helpers puros de fuso, validade e prioridade têm testes Node.
- `commercial-dashboard.js`: coordenação da leitura, abertura de detalhes completos, paginação visual, filtros de histórico e indicadores.
- `event-performance.js`: até 30 leituras por sessão, mediana/P90, erros e última atualização; nenhuma linha ou mensagem de cliente é armazenada em métricas.
- `app.js`: editor e superfícies existentes; usa os módulos acima. `event-operations.js` compartilha a mesma leitura, sem buscar novamente todas as tabelas a cada ciclo.

## Leitura e segurança

O manifesto contém somente IDs/revisões, indicadores agregados, contagens de visualização e estado dos canais. Cada ciclo baixa apenas páginas dos registros que mudaram; IDs ausentes removem registros excluídos. Chamadas simultâneas usam a mesma leitura, e chamadas repetidas de inicialização compartilham cinco segundos de validade. Atualização manual ignora esse intervalo. O ciclo automático permanece em 30 segundos, somente com aba visível e sem diálogo aberto.

A primeira leitura recebe resumos de todas as propostas, preservando a base completa dos relatórios e do aprendizado histórico, sem catálogo duplicado, texto pronto, condições extensas ou arquivos embutidos. Solicitações e demais entidades mantêm seus campos completos. Visitas são agregadas por proposta no banco; user-agent, referrer e token de visita não são transportados ao painel.

Abrir uma proposta, registrar pagamento, cancelar, classificar desfecho ou baixar comprovante busca os detalhes completos quando necessário. O editor continua usando a revisão original até salvar. Atualizar o painel não substitui a revisão da edição. O backend recusa snapshots marcados como resumo, impedindo perda de catálogo, condições, histórico ou comprovantes.

Os dois novos RPCs exigem usuário de equipe através de `event_private.require_team`; anon não tem EXECUTE. Relações são escolhidas por whitelist, páginas são limitadas a 80 IDs e IDs de UUID usam índices primários. Os novos índices cobrem as cinco FKs já apontadas pelos advisors; nenhum índice especulativo é adicionado apenas para aparecer no diagnóstico. Funções privadas não são diretamente executáveis por clientes. Canais, callbacks e Bot não mudam.

Falha de qualquer página não aplica uma leitura parcial. Últimos dados válidos continuam visíveis, com alerta e botão de tentar novamente. Logout invalida leituras em andamento, inclusive se o mesmo usuário entrar novamente.

## Uso comercial

O radar conserva resposta do cliente, regras de pagamento e retornos combinados. Adiciona validade comercial/link próximos de vencer ou vencidos; antes de reenviar condições vencidas, orienta conferir preço e agenda. Mostra o motivo da prioridade, prazo vencido e ausência de responsável. Não confirma reserva ou pagamento automaticamente.

Filtros: prazo vencido, sem próximo passo e validade em risco. Funil e histórico mostram 20 registros por página visual, com contagens completas e botão de carregar mais; o histórico chega além do antigo limite de 100 propostas. Histórico permite todos, futuros ou passados. Eventos passados continuam fora das etapas de venda e exigem resultado confirmado pela equipe.

## Indicadores e limites

Indicadores do banco: oportunidades de venda futuras/sem data, falta de responsável/plano, prazos vencidos, ganhos/perdas registrados nos últimos 30 dias, novas oportunidades e mediana/P90 da primeira resposta registrada. Datas de fechamento e de entrada são janelas diferentes; ganhos divididos por entradas não seriam uma taxa de conversão válida. Amostras de primeira resposta usam tempo corrido, dependem de contatos registrados e excluem datas inválidas, negativas ou futuras.

Medição de velocidade: tempo de leitura/transporte e parsing dos dados, consultas, bytes JSON antes da compressão HTTP, registros alterados e falhas. Não mede todo o tempo de renderização nem comprova aumento de vendas. Observação histórica começa com a publicação; não há resultados inventados.

Telemetria existente ampliada com `dashboard_loaded`, `dashboard_refresh_failed` e `dashboard_priority_opened`, apenas propriedades numéricas/categorias permitidas. Do Not Track, opt-out e bloqueio de PII permanecem. Operação e números do banco continuam funcionando se analytics estiver desativado. O catálogo de métricas do PostHog não está acessível pela conexão atual; definições derivadas são operacionais, sem certificação de métricas.

## Verificação e publicação

`npm test` valida build, regras, leitura, telemetria e Chromium. `npm run test:db` inclui regressão `checks/commercial-cockpit.sql`, com permissões reais, resumo sem arquivos, rejeição de escrita de resumo e limites/whitelist. Instalação vazia, upgrade, concorrência e restauração continuam no CI. Fixtures de banco executam em transação com rollback.

Aplicar somente a migração incremental de commercial cockpit no projeto de Eventos, verificar funções/grants e tamanhos agregados, depois publicar frontend aprovado no CI. Se o serviço de leitura faltar, mostrar erro e retry; não reabrir gravações antigas nem remover validação de revisão. Para reversão do frontend, a versão anterior continua compatível com o banco, pois a migração mantém APIs de gravação e dados comerciais existentes.
