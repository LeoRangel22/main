# P0/P1 integrado: segurança operacional e piloto assistido

## Escopo único

Base: publicação `6b7eceec569b735ad4d967ee06cc9ad4a68a6aa9` (PR #60).
Reutiliza cadastro manual/assistido, proposta, financeiro, reserva, produção,
checklist, ponte do Bot e ledger de canais já existentes. Não cria um fluxo
comercial concorrente. A resposta consultiva continua determinística e editável,
não negociação autônoma.

## Correções verificáveis

- A troca de evento na agenda remove imediatamente as ações do evento anterior.
  Leituras tardias, falha, sessão e revisão diferentes não podem direcionar ciência,
  reserva ou ficha para outro acordo. A atribuição invalida o cache antes da releitura.
- A aprovação direta de desconto exige a revisão exibida e trava a proposta no
  servidor. A antiga entrada sem revisão fica inacessível ao usuário autenticado;
  os fluxos internos já vinculados a conteúdo preservam compatibilidade.
- A exclusividade negociada não desaparece quando seu preço é zerado: a decisão
  usa o modo e a base numérica já protegidos pelo fingerprint. Texto livre,
  desconto negativo ou escolha solta não criam exclusividade. Reservas divergentes
  pedem conferência explícita; nenhuma reserva real é reescrita pela migração.
- A jornada distingue aprovação geral opcional de exceção de desconto e aditivo.
  Execução histórica concluída e desfecho realizado não significam autorização para
  nova liberação. Reserva encerrada sem auditoria preservada não ganha evidência fictícia.
- A agenda informa quantas tarefas estão sem pessoa, ciência e conclusão auditada.
  Planejar, nomear ou imprimir não registra ciência nem execução.
- Um adaptador Zoho Mail único e desativado reutiliza a ingestão existente. Consulta
  conta/endereço, preserva IDs grandes, limita páginas e conteúdo, deduplica e
  confirma ingestão/cursor atomicamente. Sem envio, anexos, leitura marcada,
  exclusão, OAuth novo ou troca de callbacks.

## Implantação e limites

Migrações novas: `20261020143000_integrated_readiness.sql` e
`20261020143100_zoho_mailbox_adapter.sql`. Aplicar apenas estas migrações novas,
na ordem, pelo procedimento de release; nunca reaplicar bootstrap/schema.
Publicar `event-mailbox-sync` com a validação privada de job definida no handler.
A migração não instala credenciais, não habilita a caixa e não cria um cron ativo.
A função `event_private.queue_mailbox_sync()` não trabalha enquanto a configuração
estiver desativada. O runbook específico descreve a configuração posterior.

A publicação frontend, migração e Edge Function devem ser conciliadas. O frontend
mais novo usa a aprovação com revisão; versões antigas falham de modo seguro no
RPC não vinculado, em vez de aprovar conteúdo não revisado.

## Piloto controlado: critérios de aceite

1. Escolher contato controlado, canal, texto exato e autorização do titular. Não usar
   cliente real, enviar formulário público ou fazer disparo por inferência.
2. Percorrer formulário e cadastro manual em fixtures isoladas, preservando uma
   oportunidade, responsável, próxima ação, contexto e versões de proposta.
3. Revisar conteúdo e preço; comprovar autonomia comum e exceções específicas,
   inclusive cancelamento, repetição, nova versão e mudança de sessão.
4. Com autorização de envio, comprovar aceitação, entrega e resposta separadamente,
   com IDs e destinatário exatos. A duplicação de retorno não pode duplicar conversa
   nem gerar novo envio. Mensagem incerta nunca é repetida automaticamente.
5. O cliente efetua o aceite. Financeiro/Eventos confere crédito e registra evidência
   bancária real. Não transformar comprovante ou fixture em pagamento validado.
6. Conferir capacidade/exclusividade, reserva, ficha quantitativa, estoque informado,
   escala, pessoas e ciência por versão. Somente a equipe registra execução real.
7. Registrar desfecho conhecido. Uma data passada, tarefa atribuída ou produção
   planejada não comprova realização física.

## Validação

- `npm run build` e `node --test checks/*.test.cjs`: verificações locais isoladas.
- `npm test`: inclui regressões de navegador de troca/interrupção e alçada revisada.
- `npm run test:db`: PostgreSQL isolado, banco novo/upgrade/permissões/concorrência,
  com fixtures transacionais revertidas. Não executar contra produção.
- CI e restauração precisam passar para o SHA final antes de solicitar integração.
- Testes sintéticos não homologam OAuth, acesso à caixa ou entrega real dos canais.
