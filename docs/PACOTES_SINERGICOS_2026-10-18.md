# Pacotes sinérgicos do Sistema de Eventos

A implementação reúne os cinco pacotes do diagnóstico e inclui o P0 como pré-requisito. Cada decisão comercial e operacional continua vinculada ao acordo vigente. A publicação e a homologação operacional são verificações distintas.

## Contratos e limites

| Pacote | Comportamento |
| --- | --- |
| P0 — Confirmação confiável | Sinal legado sem auditoria não é crédito comprovado. A liberação consulta uma única regra no servidor: acordo, auditoria, reserva, checklist atual, responsáveis, produção revisada e capacidade com montagem/desmontagem. |
| 1 — Operação | Entrada própria com Hoje, 7/30 dias e todos os futuros; busca e setor; pessoa nominal, prazo e impedimento. Distribuição da tarefa não dá ciência nem conclui. Eventos pode conferir reserva e liberar dentro das regras. Financeiro mantém sua validação exclusiva. |
| 2 — Canais e medição | Coortes pela entrada da oportunidade no sistema, janela completa de decisão, perdas no denominador e testes marcados excluídos. Aceito, entregue, resposta e sinal auditado são marcos distintos. Hash de correlação pseudônimo compartilhado entre painel e portal. |
| 3 — Venda intuitiva | Navegação em cinco etapas, foco opcional sem perder dados, alerta de escopo incompatível, verificação explícita da vigência do tarifário e bloqueio do envio integrado fora da vigência. Nenhum ano ou preço foi estendido automaticamente. |
| 4 — Pagamento e decisão | Referência interna, identificação de extrato, retry idempotente, prevenção de referência bancária duplicada, parcelas acumuladas de saldo e estorno conferido pelo gestor. Cancelamento e crédito excedente têm tratamento explícito. O portal não equipara status confirmado a prova financeira/reserva. |
| 5 — Produção | Insumo/serviço por item, quantidades por convidado ou evento, rendimento, perda, estoque informado e compras; escala; acesso, ingressos, autorização e clima/teleférico. Custos desconhecidos não geram margem. Financeiro/gestor controlam os custos; ordem operacional não inclui valores. |

## Implantação e compatibilidade

- As migrações acrescentam estruturas e regras; não fazem backfill de crédito, reserva, ciência, execução, resultado de evento ou receita técnica.
- Os canais mantêm os callbacks pertencentes ao Bot. Nenhum teste técnico envia ou reenvia mensagens a clientes.
- Referência interna não é cobrança emitida por PSP. O Pix usa os dados oficiais existentes. Não há autorização para movimentar conta bancária por este módulo.
- A medição de coorte observa evidências registradas na janela. Não mede causalidade, lucro efetivo nem fatos de meses anteriores ausentes do sistema.
- Estoque e receitas precisam de entrada e conferência da equipe. O módulo não promete saldo em tempo real de um ERP.
- Alteração do plano reabre tarefas dos setores afetados e a liberação; preserva as assinaturas dos setores não afetados. Mudanças no acordo seguem o versionamento e os aditivos existentes.
- Os acessos existentes continuam restritos à equipe autorizada. A indicação nominal de executores não cria contas, convites ou logins setoriais.

## Homologações que dependem de evidência externa

1. Ponte do Bot: publicação do adaptador, URL e segredo exclusivo em ambos os ambientes; identidade/cursor verificados antes de ativar, preservando callbacks.
2. E-mail: permissão OAuth de leitura e primeiro retorno autenticado associado ao evento correto.
3. Financeiro: conciliação real de sinais legados; nenhum valor informado pode ser transformado em crédito por inferência.
4. Operação: responsáveis reais, fichas quantitativas, escala, estoque, autorizações e execução dos checklists.
5. Produto: teste acompanhado com gerente e operador novo. Metas de tempo, conversão e usabilidade ainda exigem medição real.

## Verificação

Regressões de lógica, navegador, banco novo, upgrade, permissões, concorrência e restauração. O relatório final da entrega registra os resultados e a versão efetivamente publicada.
