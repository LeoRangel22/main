# Correções do fluxo de Eventos — feedback da gerente em 17/10/2026

Base: main a39589ec1e3f4e524b8da519056e2fd6bdd41022. Pacote independente do aditivo pendente no PR 56.

## Comportamento preparado

1. Eventos consegue registrar um sinal efetivamente recebido após confirmar explicitamente a conferência do crédito no banco. O servidor valida a conta real e grava autor e horário. Comprovante sozinho não confirma o pagamento. Correção/remoção de um pagamento já auditado e registro do saldo continuam com Financeiro/gestor. A exceção de sinal abaixo de 50% continua exigindo gestor; não foi solicitada mudança dessa condição.
2. A fila geral de aprovação do gestor fica desativada para propostas comuns, inclusive retornadas para ajuste. A revisão do vendedor, o conteúdo exato do envio, a revisão concorrente e a deduplicação continuam ativos. Nenhum envio ou aprovação é executado por este pacote.
3. Desconto na privatização deixa de contar na alçada de desconto comercial. Os limites do desconto comercial geral permanecem.
4. Um item personalizado pode constituir toda a proposta sem produto base do catálogo. Nome e descrição são campos distintos, persistidos e renderizados com escape de HTML.
5. A coluna Sem resposta usa a rolagem da página e mantém cards de tamanho mínimo uniforme. Não há rolagem interna na coluna.
6. Mudar etapa fica acessível fora de Detalhes e opções. Sem resposta pode ir diretamente a Sinal; quando há comprovante pendente, o mesmo fluxo confere o sinal e aplica a etapa na mesma gravação.

## Testes

CI instala a migration em bases descartáveis antes das verificações comuns, além de regressões novas de papéis, autoria, limite comercial, reserva, revisão concorrente e ausência de reenvio. Os testes de navegador exercitam item personalizado isolado, descrição após salvar/reabrir, desconto de privatização, sinal pela conta Eventos, etapa direta e coluna sem rolagem em desktop/celular. A política habilitada continua coberta pelos testes existentes; proposta devolvida é coberta no modo autônomo.

## Publicação

Publicação autorizada pelo proprietário em 17/10/2026. A migration foi aplicada e conferida no projeto pdgbnpztdnrvrphzdjas às 18:29 UTC, versão real 20261017182928. O arquivo originalmente gerado pelo CLI como 20261017162110 foi renomeado para coincidir com o histórico instalado. A política de aprovação geral está desligada; o operador de sinal continua privado, sem execução por anon/authenticated.

A conferência pós-instalação manteve 206 propostas, nenhuma reserva e 19 envios já aceitos, sem criação de pagamentos, decisões ou comunicações. O frontend só segue para publicação após o CI completo.

A revisão adicional bloqueia a confirmação de proposta cancelada no navegador e no banco, registra etapa e conferência bancária no histórico e exige descrição em itens personalizados, inclusive na revisão de itens antigos.

A regra de sinais substitui guard_journey_proposal mantendo os demais controles e é compatível com o ciclo de aditivos do PR 56. A aplicação dos dois pacotes exige nova verificação integrada. Testes isolados não substituem conferência de extrato e piloto da equipe.
