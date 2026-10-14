# Integridade da jornada comercial e operacional — 14/10/2026

## Objetivo e limites

Correções dos defeitos encontrados na auditoria funcional de 14/10. Os registros reais de propostas, pagamentos, reservas e ciências não devem ser alterados pelo processo de instalação. A migração acrescenta proteções para futuras gravações e preserva o histórico existente. Ensaios usam dados sintéticos em banco isolado.

Este pacote não conclui a aplicação de aditivos contratados: permite guardá-los separadamente, mas bloqueia seu envio/promoção até existir o ciclo específico de aprovação, aceite, reconciliação financeira e reserva. Também não ativa o monitor/renovação da PR #50 nem os canais de recebimento.

## Cotação e versões

- Uma cotação nova restaura as condições-padrão. Exceções da proposta anterior não se tornam padrões globais do navegador.
- Salvar rascunho guarda o trabalho parcial. Salvar proposta pronta exige revisão e promove um rascunho completo para `ready`, sem registrar envio.
- O comparador detecta mudanças de composição, descrição, preços, condições, prazos e demais dados comerciais, mesmo com total inalterado.
- O comparativo mostrado ao cliente usa texto legível; não exibe a serialização interna, identificadores ou fórmulas.
- A última proposta enviada não aceita sobrescrita comercial. Alterações comerciais são guardadas como outra versão; notas internas preservam os dados comerciais históricos exatos.
- Um acordo confirmado recebe bloqueio persistente, mesmo se sua etapa for posteriormente alterada. O rascunho de aditivo não substitui o acordo corrente, não desloca o evento confirmado no funil/agenda e não atualiza a operação.
- Remarcar uma proposta enviada guarda outra versão, com referência à data anterior. Remarcar um acordo contratado produz somente rascunho de aditivo. O vínculo à solicitação e ao responsável vem do registro de origem, não de outro editor aberto.

## Pagamentos e edição

- Atualizações próprias de sinal/etapa reconciliam a revisão do editor, sem perder a digitação posterior. Alterações concorrentes continuam bloqueadas.
- Financeiro ou gestor validam, corrigem ou removem pagamentos. O servidor registra identidade e horário da validação.
- Um sinal abaixo do padrão de 50% exige gestor e justificativa. A regra não presume que todo valor menor seja comercialmente incorreto: exige registro da exceção aprovada.
- Aceite público com comprovante registra o arquivo como evidência, sem inferir valor de sinal nem confirmar reserva. O fluxo de resposta mantém validação de arquivo, revisão e idempotência.
- Valores antigos marcados como `validacaoPendente` não são contabilizados como recebidos. O painel orienta a validação e a liberação final permanece bloqueada. Não se deve cobrar novamente apenas pela existência dessa pendência.
- Planejamento pode começar após o sinal validado; a ação de registrar saldo permanece explícita e separada.

## Operação

- Tela, ficha, resumo e próximo passo usam as mesmas tarefas setoriais e a mesma versão do evento. Controles adicionais legados ficam identificados separadamente.
- Uma versão operacional desatualizada não aparece como checklist vigente.
- Ciência financeira é do Financeiro/gestor; ciência e liberação final são do gestor autorizado.
- A liberação final exige acordo atual, sinal validado, ausência de mudanças pendentes e as sete tarefas prévias concluídas com ciência na versão correta.
- Reabrir um pré-requisito invalida a liberação final. O sistema não conclui tarefas nem registra ciência em nome de uma pessoa por conveniência.

## Verificação

A publicação exige: suíte completa de código/navegador; banco recém-instalado e atualizado; papéis reais anon/equipe/financeiro/gestor em ambiente isolado; concorrência; preservação de links e histórico; restauração isolada; revisão dos apontamentos; migração confirmada no projeto correto; e verificação pública do commit implantado.

Os testes de remarcação foram atualizados para exigir outra versão e a preservação da proposta anterior, em vez de aceitar a sobrescrita como comportamento esperado. A simulação de um comprovante pendente em um acordo legado confirma que nem o gestor pode liberar a execução sem a validação financeira exigida.

Nenhuma execução simulada comprova recebimento real de WhatsApp/e-mail, decisão real do gestor ou conciliação bancária.
