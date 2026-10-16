# Execução das pendências — 16/10/2026

Comparação com main a9ca489: aprovação remota, integridade da jornada e monitor de aprovações já estavam publicados. Esta mudança atua nas lacunas que continuavam abertas, sem recriar essas entregas.

## Entregas na ordem de dependência e impacto

1. Serialização de envio e gravação local: um envio legado mantém exclusividade entre canais até a conciliação da revisão observada. O vendedor pode continuar digitando; uma gravação espera o envio terminar. Não altera a proteção contra mudanças de outro usuário.
2. Atendimento preparado integrado à aprovação remota: mensagem, destinatário, canal, revisão e última resposta são os conferidos pela equipe. O gestor revisa o conteúdo completo no painel existente. A central não chama mais os endpoints de envio direto. Sem política confirmada, não oferece envio integrado.
3. Central “Executar agora”: reúne decisão do gestor, sinal sem validação, prontidão, contatos vencidos e desfechos históricos, com responsável, motivo, filtros e paginação. Tarefas de versões antigas não compõem a prontidão atual. Aprovações expiradas são identificadas. Falha na leitura conserva o último estado e mostra aviso; respostas de outra sessão são descartadas.
4. Conferência bancária sem mudar a etapa: Financeiro/gestor devem conferir valor, data, banco e declarar o crédito efetivo no extrato. A data informada e o comprovante anterior são preservados. A proposta precisa continuar atual e na mesma revisão após a conferência. Os atalhos antigos seguem essa conferência sem retornar um evento operacional à etapa Confirmado. O formulário bancário agora permite rolagem em telas baixas. O servidor continua auditando o usuário e a data de validação.

## Validação e limites

Testes automatizados cobrem concorrência entre canais/gravações, falha de leitura, troca de sessão, paginação, tarefa obsoleta, cancelamento e conflito na conferência bancária, payload exato da aprovação e telas em 320/390/1440 px. A CI também executa o banco isolado e restauração.

Não foram enviados contatos ou pedidos de aprovação para validar estas telas. Nenhum pagamento, ciência, conclusão ou desfecho foi criado como teste em produção. Publicação e testes não demonstram uso real pela equipe ou recebimento bancário.

Continuam dependendo de ação real: conferência dos comprovantes, decisões pendentes, ciência/conclusão operacional e classificação de eventos passados. A integração de retornos exige configuração e homologação autenticada dos canais. Aditivos continuam como rascunho isolado; não há nesta entrega um ciclo de aprovação, aceite e aplicação de aditivo. Os bloqueios do acordo vigente foram preservados.
