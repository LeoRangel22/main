# Ciclo de aditivos — 17/10/2026

## Fluxo entregue

A Central comercial passa a oferecer **Aditivos**. A equipe prepara e salva a alteração como rascunho no editor existente e solicita revisão nessa tela. O gestor compara acordo atual e alteração, incluindo data, horário, convidados, itens, valores e condições. Somente a aprovação do gestor libera um link específico para o cliente. A tela não envia mensagens.

O cliente confere os dois acordos, informa seu nome e registra aceite ou pedido de ajustes pelo link. Esse registro comprova uma resposta por posse do link; não é verificação documental de identidade. Aceitar não altera a reserva. O gestor ainda precisa aplicar a alteração.

Na aplicação, o servidor exige as revisões exatas aprovadas, o aceite vigente, pagamentos com validação bancária auditada, capacidade e ausência de conflito. O novo total exige sinal mínimo de 50% ou uma exceção explicitamente justificada pelo gestor. Pagamento acima do novo total bloqueia a aplicação até o Financeiro resolver o crédito ou estorno; nenhum estorno é presumido ou criado.

Somente após todas as verificações a nova versão vira o acordo vigente. A anterior é preservada. A reserva muda atomicamente e o handoff gera nova versão: os setores precisam dar nova ciência e concluir suas tarefas. Os comprovantes e os autores da validação bancária são mantidos. A trilha de jornada reconhece aprovação e aceite deste fluxo.

## Integridade e acesso

- Rascunho submetido fica bloqueado até retirada ou decisão de ajustes; alteração na revisão do acordo original invalida a decisão subsequente.
- Gestor, cliente e aplicação têm decisões separadas. A equipe não pode agir como gestor nem registrar aceite sem a capacidade específica do link.
- O link usa token aleatório, expira em até sete dias ou no início do primeiro dos eventos comparados e pode ser invalidado por retirada.
- A lista mantém todas as solicitações ativas, além de até 200 encerradas; links autenticados específicos recuperam registros fora desse recorte.
- O retorno público contém somente campos comerciais permitidos. Os itens são projetados campo a campo, sem fórmulas, faixas de preço ou metadados internos de agenda, também no portal de propostas existente. Briefing interno, contatos, provas bancárias e registros privados não são retornados.
- A aplicação usa contexto privado restrito à transação e às duas linhas exatas esperadas; não aceita sinalizadores de sessão controláveis pelo cliente.
- Repetir a solicitação, a resposta com a mesma chave ou a aplicação não cria novas decisões ou reservas.

## Limites da homologação

Os testes usam clientes, pagamentos e decisões fictícios em banco isolado e mocks de navegador. Não constituem aceite de cliente real ou conferência de extrato real. O piloto e a ciência dos setores continuam dependendo das pessoas responsáveis. Os bloqueios já constatados na ponte do Bot, OAuth de leitura de e-mail e conexão WhatsApp são independentes desta entrega e não foram contornados.

## Integração com a autonomia de Eventos

A versão integrada preserva a validação de sinal conferido no banco por Eventos e a proteção contra confirmação de proposta cancelada. A fila de execução consulta a política real e deixa de cobrar decisões antigas quando a aprovação geral está desativada; as decisões históricas permanecem no banco. Erro na leitura da política conserva a última fila e indica a falha.

## Instalação e verificação em produção

Publicação autorizada pelo proprietário em 17/10/2026. Após falha transitória de sessão da ferramenta e confirmação de ausência de instalação parcial, a nova tentativa aplicou a migration às 18:55 UTC no projeto pdgbnpztdnrvrphzdjas. O arquivo originalmente gerado pelo CLI como 20261017075836 foi renomeado para o registro real 20261017185541.

A verificação confirmou tabela privada sem acesso de anon/authenticated, RPC público de resposta instalado, nenhum aditivo ou contexto de aplicação criado, política geral de aprovação ainda desativada e as mesmas 206 propostas, 0 reservas e 19 envios. A versão integrada passou em 264 testes Node, 233 testes de navegador, instalação nova/upgrade, papéis, concorrência e restauração (CI 39058495471). A renomeação exige repetir o CI na ordem efetiva instalada antes do merge.

Quatro acordos futuros ainda não têm validação bancária auditada do sinal. Não foram reconciliados automaticamente: precisam de conferência real da equipe antes da reserva e da operação. Há 18 propostas passadas sem desfecho comercial final segundo os status consultados; a classificação depende da equipe.
