# Recebimento e comprovantes de entrega dos canais

O Sistema de Eventos recebe mensagens e retornos por `event-channel-webhook`.
Enviar uma proposta continua exigindo login da equipe e aprovação humana.
Callbacks de entrega nunca disparam novo envio. Capacidade operacional: 200 pessoas,
configurada por Leo em 06/10/2026; não é alterada pelas migrações deste pacote.

## Ativação pelo gestor

Entre com o usuário gestor no site e abra **Central comercial → Canais**.
URLs e chaves de cada origem são geradas no banco e mostradas somente ao gestor.
Não publique essas URLs/chaves em documentos, código, comentários ou mensagens.
O painel distingue canal habilitado de primeiro retorno autenticado recebido.
Nenhum canal é apresentado como homologado apenas porque o código foi publicado.

### WhatsApp / Z-API

1. Abra **Configurar WhatsApp → Verificar instância**. A função usa as credenciais
   de envio existentes no servidor; não devolve tokens da conta/instância.
2. Confira a instância e marque a aprovação antes de **Ativar callbacks disponíveis**.
3. Ativação altera somente `receivedCallbackUrl` e `messageStatusCallbackUrl`.
   Reconsulta `/me` para verificar as duas URLs. Não muda auto-read, demais callbacks
   ou o Bot. Uma configuração parcial exige conferir o painel antes de repetir.
4. Se qualquer uma das duas URLs já aponta para outro sistema, a ativação é bloqueada.
   Se for o Bot, preservar a configuração e definir instância própria de Eventos.
   Uma ponte com o Bot não pertence a este pacote e depende de decisão separada.
5. As mensagens recebidas verificam chave da URL e instância igual àquela usada
   no envio. Mensagens próprias, grupos, newsletters, edições, status replies e
   mensagens aguardando decodificação são ignoradas.
6. `SENT` significa aceito; `RECEIVED` significa entregue; `READ` informa leitura.
   `READ_BY_ME` não é leitura do cliente. Os retornos são vinculados por ID do
   provedor e destinatário exato, nunca apenas por telefone.

### ZeptoMail / Zoho CPaaS

1. No agente que envia os e-mails, adicione um webhook com a URL de **Retornos de
   e-mail**. Habilite hard bounce, soft bounce, open, click e feedback loop.
2. Configure a Authentication Key com a chave gerada no Sistema de Eventos.
   Se o agente já usa uma chave, preserve-a e configure a chave existente no
   RPC autenticado `configure_event_channel`; trocar a chave global afeta outros
   webhooks desse agente. Não compartilhar a chave na conversa.
3. Informe a `mailagent_key` exata na Central e habilite a origem. A função verifica
   `producer-signature` HMAC SHA-256, timestamp até ±10 minutos e conta de origem.
   Aceita JSON ou o campo `data` de formulário URL encoded e verifica o conteúdo
   assinado antes de interpretar seus campos.
4. Novos envios carregam `client_reference=EV:<send_uuid>:<attempt>`. Isso permite
   conciliar retorno anterior à resposta HTTP e rejeitar retornos de outra tentativa.
   `request_id` e `email_reference` são preservados para correlacionar respostas.
5. Bounce do lote afeta somente `bounced_recipient`. Abertura/clique sem destinatário
   explícito só são aplicados a mensagens com um destinatário. Não são prova de
   leitura humana, nem são usados para marcar entrega.

#### Entrega real de e-mail

O token de envio `Zoho-enczapikey` não permite consultar registros. Crie autorização
OAuth com escopo **Zeptomail.email.READ** na conta correta. Configure no servidor:

- `EVENT_ZOHO_CLIENT_ID`
- `EVENT_ZOHO_CLIENT_SECRET`
- `EVENT_ZOHO_REFRESH_TOKEN`
- Quando a conta estiver em outro centro de dados, `EVENT_ZOHO_ACCOUNTS_URL` e
  `EVENT_ZOHO_LOGS_URL`, usando as origens oficiais admitidas pelo código.

Secrets são definidos no Supabase, sem expô-los ao frontend ou incluí-los no Git.
Depois clique **Consultar entregas de e-mail**. Só uma consulta OAuth bem-sucedida
habilita a rotina. O job `event-email-delivery-check` verifica a cada cinco minutos,
mesmo com a Central fechada, se há mensagens pendentes nos últimos 60 dias.
Até cinco registros são consultados por ciclo, priorizando os menos recentemente
verificados. Uma falha transitória continua pendente para o próximo ciclo.

A confirmação exige um registro único com `request_id`, agente e destinatário
exatos, com `status=delivered` na API do provedor. Isso comprova entrega ao servidor
do destinatário, não caixa principal, ausência de spam ou leitura humana.
O job usa chave própria privada; sua autenticação não é a chave do webhook.

### Respostas de e-mail / caixa de entrada

ZeptoMail envia e-mails e informa eventos de envio. Ele não é a caixa que recebe
respostas. A origem da caixa `eventos@embaixadacarioca.com.br` precisa ser confirmada
para construir e conectar seu adaptador (Zoho Mail, Gmail, IMAP ou outro).
Este pacote fornece o endpoint autenticado e contrato de ingestão; não afirma
que o adaptador do provedor da caixa já foi instalado.

O adaptador de confiança deve validar a origem, autenticar notificações/conta,
deduplicar pelo Message-ID, extrair texto e headers de reply, e enviar:

```json
{
  "mailbox": "identificador-exato-configurado",
  "kind": "inbound",
  "message_id": "Message-ID-exato",
  "in_reply_to": "Message-ID-original-opcional",
  "from": "cliente@example.com",
  "text": "Mensagem recebida",
  "received_at": "2026-10-06T12:00:00Z"
}
```

Assinar o corpo exato JSON com HMAC SHA-256 e a chave da origem mailbox.
Header: `producer-signature: ts=<Unix milliseconds>;s=<URL-encoded Base64 HMAC>;s-algorithm=HmacSHA256`.
A URL usa `?provider=mailbox`; só a caixa configurada é admitida. Não enviar HTML
ativo nem baixar URLs de mídia recebidas. Attachments permanecem na caixa original.

## Atendimento e triagem

Respostas entram na conversa quando um reply identifica um envio ao mesmo contato
ou existe exatamente um evento ativo com contato exato. Telefone brasileiro local
de 11 dígitos usa a mesma regra de país +55 do remetente de propostas.
Vários eventos do mesmo contato, contatos desconhecidos e falta de vínculo seguro
ficam em **Conversas → Mensagens para vincular**. A equipe revisa e vincula ao evento
correto, ou arquiva sem vínculo. Essas ações têm usuário e horário registrados.
Respostas não criam novas vendas, não reabrem eventos passados e não confirmam sinal.
Uma resposta mais recente que o último contato prioriza atendimento. Salvar a
proposta preserva a data de uma resposta de canal mais recente que o link público.

Receipts aguardando o ID de envio ficam persistidos, com reconciliação após o commit
do envio. Duplicações não repetem mensagens. `read` não regride para `delivered` ou
`accepted`; uma entrega provada não habilita retry, mesmo com erro HTTP registrado.
Uma nova tentativa permitida limpa os metadados da tentativa anterior.
Chaves são privadas, ingressos/RPCs de worker não são executáveis por anon/equipe,
e a equipe lê apenas a fila/conversas autorizadas por RLS.

## Homologação operacional

É necessário um telefone e e-mail controlados e autorização de envio para esse
destino. Sem isso, executar apenas testes isolados e consultas sem mensagens reais.

1. Enviar uma proposta revisada para o destino de teste pela interface autenticada.
2. Confirmar receipt de WhatsApp por ID/destino e consulta `delivered` de e-mail.
3. Responder no WhatsApp e no e-mail; verificar ingestão e conversa/triagem.
4. Repetir o retorno e verificar que não cria duplicação nem dispara outro envio.
5. Verificar com o destinatário a chegada real. Registrar evidência de provedor e
   confirmação do destinatário separadamente; ambas não são equivalentes.

## Verificação técnica

`npm test`: testes Node dos handlers e Playwright da interface.
`checks/channel-events.sql`: asserções transacionais com rollback; não usa provedores.
Também executar regressões `checks/event-operations.sql` e `checks/capture-idempotency.sql`.
Não interpretar fixtures ou requests anônimos recusados como teste de entrega real.

Fontes primárias verificadas em 06/10/2026:

- https://developer.z-api.io/en/webhooks/on-message-received-examples
- https://developer.z-api.io/en/webhooks/on-whatsapp-message-status-changes
- https://developer.z-api.io/en/instance/me
- https://www.zoho.com/cpaas/help/webhooks.html
- https://www.zoho.com/cpaas/webhooks-instant-notification.html
- https://www.zoho.com/cpaas/help/api/get-email-logs.html
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/database/extensions/pg_net
