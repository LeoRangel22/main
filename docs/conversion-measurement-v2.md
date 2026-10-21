# Medição de conversão v2

Esta versão mantém a captação e as regras comerciais existentes. Nenhum SQL,
callback, canal, pagamento ou oferta é alterado. A medição continua opcional,
sem espera no fluxo de gravação, respeitando opt-out e Do Not Track.

- `lead_created.entity_hash` passa a usar `opportunity_id` devolvido pelo RPC já
  existente. Se uma resposta legada não trouxer o ID, o envio continua confirmado
  e usa a referência anterior com `entity_key_kind=legacy_reference`.
- O painel usa o ID de oportunidade; a proposta pública já recebe do banco o
  hash anônimo da mesma oportunidade. Referências, IDs crus e contatos não são
  transmitidos ao PostHog.
- `$session_id` usa UUIDv7 com horário de início; o `distinct_id` anônimo legado
  é preservado separadamente. A sessão nativa inicia uma série nova na v2,
  sem reescrever a chave legada dos eventos históricos.
- `$raw_user_agent` permite classificar o navegador. `is_test` e `environment`
  distinguem coleta forçada, navegador automatizado e hosts locais de produção.
  Não basta usar o filtro antigo de contas de teste: relatórios v2 devem excluir
  `is_test=true`. O usuário da equipe em produção não é automaticamente teste.
- `proposal_decision_presented` informa `response_available` e um motivo
  categórico. Não é início de resposta; não muda a elegibilidade dos botões.
- `proposal_upsell_presented` significa alternativa renderizada, não vista no
  viewport nem aceita. Ausência de ofertas continua sendo ausência de exposição,
  sem gerar adicionais, preços ou aprovações automaticamente.
- `lead_submit_failed` e `proposal_response_failed` registram apenas categorias
  de falha. Dados técnicos crus e mensagens do cliente não são enviados.
- Storage indisponível, hash rejeitado, captura que lança/rejeita ou não termina
  não podem impedir envio nem confirmação na interface. Deduplicação concorrente
  é específica da medição; não altera a idempotência dos RPCs.

## Limites e validação

Histórico anterior à v2 não é reescrito nem reenviado. A correção não transforma
contagens antigas em conversão comercial confiável. A comparação deve separar
`analytics_version` e calcular a jornada por oportunidade, não pelo usuário
interno que emite várias propostas. Janelas ainda abertas não são perdas finais.

Regressões de navegador usam banco e analytics simulados, sem enviar solicitações
ou mensagens reais: validam captação com falha síncrona, rejeição, ausência e
travamento do analytics, resposta pública preservada, hash comum e diagnósticos.
Testes unitários cobrem storage, migração de sessão, privacidade e deduplicação.
