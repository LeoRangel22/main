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

Não alterar produção nem enviar comunicações, conforme a instrução vigente. A preparação deste PR não muda a política nem os dados de produção.

A migration supabase/migrations/20261017162110_seller_workflow_feedback.sql foi gerada com Supabase CLI 2.121.0 no CI 39048990666, após consultar os comandos --help. O CI confirmou instalação nova, atualização, papéis, transações concorrentes e restauração de backup. O passo temporário de geração foi removido; o arquivo versionado é a fonte de instalação.

Antes de qualquer rollout autorizado, aplicar a migration no projeto correto, registrar a versão real e só então publicar o frontend. Este PR não aplica SQL em produção nem envia comunicações. Não aplicar a migration de aditivos do PR 56 por engano.

A regra de sinais neste pacote substitui a função guard_journey_proposal mantendo os demais controles. É compatível com o PR 56: não remove os gatilhos de aditivo nem a capacidade privada de aplicação exata. Confirmar novamente a ordem e o texto das funções se outra mudança alterar o mesmo guard antes do rollout.
