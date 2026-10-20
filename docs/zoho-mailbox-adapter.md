# Adaptador de entrada: Zoho Mail

## Evidência e limite atual

Em 20/10/2026 às 14:27 UTC, a consulta pública MX do domínio
`embaixadacarioca.com.br` retornou `mx.zoho.com` (10), `mx2.zoho.com` (20) e
`mx3.zoho.com` (50). Isso identifica o roteamento de entrada do domínio para
**Zoho Mail**, não comprova que a caixa `eventos@embaixadacarioca.com.br` existe,
é acessível à identidade disponível ou pertence a um centro de dados específico.
A navegação autenticada não estava disponível: `mail.zoho.com` redirecionou para
a página pública de produto. Nenhuma senha, autorização OAuth ou mensagem real
foi solicitada/usada para este pacote.

O adaptador está implementado, mas **desabilitado por padrão e sem agendamento**.
Fixtures e MX não são homologação operacional. Não houve importação real.

## Contrato e componentes

- `_shared/zoho-mailbox.ts`: consultas OAuth/REST de leitura, identidade exata,
  coleta limitada, headers e conversão inerte para texto.
- `event-mailbox-sync`: worker privado com `x-event-job-key`, ações `diagnose` e
  `sync`. Não possui ação de habilitação e nunca envia mensagens.
- `event_private.mailbox_sync_state`: conta, endereço, início aprovado, cursor,
  versão otimista e último sucesso. Nenhuma credencial OAuth é armazenada aqui.
- `event_private.mailbox_seen`: deduplicação por conta e ID interno do Zoho.
- `event_mailbox_commit`: deduplicação, ingestão normalizada existente e cursor
  numa única transação. Concorrência usa lock + compare-and-swap de versão.
- `event_private.queue_mailbox_sync`: fila canônica, inerte quando desabilitada.
  A migração não cria cron. O agendamento é uma decisão posterior de ativação.

A entrada reutiliza `normalizeMailbox` e `ingest_event_provider_events`, sem um
segundo mecanismo de vínculo comercial. O worker servidor já autenticado usa o
RPC de serviço; um adaptador externo continuaria exigindo HMAC no webhook.
Mensagem recebida não significa aceite, confirmação de reserva, pagamento ou
permissão de novo envio.

## OAuth e configuração aprovados separadamente

O grant deve conter somente:

- `ZohoMail.accounts.READ`
- `ZohoMail.folders.READ`
- `ZohoMail.messages.READ`

São diferentes do grant `Zeptomail.email.READ`, utilizado para comprovar entrega
de e-mails enviados. Não reutilizar automaticamente os secrets `EVENT_ZOHO_*`.

Secrets exclusivos do adaptador, somente no Supabase servidor:

- `EVENT_MAILBOX_CLIENT_ID`
- `EVENT_MAILBOX_CLIENT_SECRET`
- `EVENT_MAILBOX_REFRESH_TOKEN`
- `EVENT_MAILBOX_API_ORIGIN`, quando diferente de `https://mail.zoho.com`
- `EVENT_MAILBOX_ACCOUNTS_ORIGIN`, quando diferente de `https://accounts.zoho.com`

As origens precisam ser um par exato de centros de dados oficiais admitido pelo
código. Não há redirecionamento automático nem URL arbitrária. O refresh utiliza
POST de formulário, nunca coloca secrets na URL. Tokens e respostas brutas não
são retornados ao navegador, gravados em tabelas públicas ou registrados em logs.

Criar/configurar grants e credenciais persistentes requer aprovação específica.
O acesso permitido é ler conta/pastas e as novas respostas destinadas ao endereço
aprovado, trazendo remetente, destinatário, texto, horário e IDs de conversa para
o Sistema de Eventos. Não inclui envio, marcação de leitura, exclusão, mudança
de pasta, acesso a outra conta, importação histórica ou download de anexos.
O escopo OAuth do provedor é por conta, não por alias; a restrição ao endereço é
adicionalmente aplicada pelo adaptador e precisa ser explicitada na aprovação.

## Ativação futura

1. Confirmar em sessão autorizada que a conta Zoho correta contém o endereço
   `eventos@embaixadacarioca.com.br`, seja primário ou alias confirmado.
2. Confirmar o centro de dados e obter autorização para os três escopos READ.
   Instalar os secrets no servidor por canal seguro, sem copiá-los para chat/Git.
3. Fixar a conta e o endereço na configuração privada, mantendo `enabled=false`.
   Configurar a origem `mailbox` para o mesmo endereço, sem habilitá-la ainda.
4. Executar a ação privada `diagnose`. Ela consulta `/api/accounts`, exige
   exatamente uma conta `ZOHO_ACCOUNT` habilitada, recebimento desbloqueado e
   `emailAddress[].mailId` exato com `isConfirmed=true`. Não consulta mensagens,
   não escreve estado e não habilita nada. O ID interno deve ser string.
5. Homologar com destino controlado e mensagens cujo envio/resposta já tenha sido
   autorizado. Conferir os casos abaixo antes de qualquer ativação. Não importar
   e-mails existentes de clientes para usar como teste.
6. Com aprovação específica, o operador de confiança registra a hora inicial
   atual em `activated_at_ms` e `watermark_ms`, habilita a configuração privada e
   o canal `mailbox`, e instala o cron canônico (cadência proposta: 5 minutos).
   Não há endpoint público de ativação. O grant não autoriza sozinho o cron.
7. Verificar uma resposta nova no ledger/conversa ou triagem. Distinguir essa
   prova da entrega do e-mail original e da confirmação humana do destinatário.

Para pausar, desabilitar o canal ou o estado privado. O worker não consulta o
provedor quando a ação `sync` está desabilitada. Pausa/retomada não deve redefinir
o início aprovado nem avançar artificialmente o cursor.

## Leitura e limites

Cada ciclo verifica a conta e pastas novamente. Não usa filtro de não lidos:
abrir a mensagem na caixa não pode removê-la da coleta. A busca é desagrupada,
com limite explícito de 100 por página, até 10 páginas e corte superior congelado
de dois minutos. O filtro de data é mais amplo que a janela de recebimento,
com sobreposição de 24 horas. Processa no máximo 20 mensagens não vistas por
execução, da mais antiga para a mais recente.

O limite de páginas, resposta inválida, mudança conflitante na paginação,
identidade divergente, falha de parsing, autenticação ou commit preserva o cursor.
Se houver mais de 20 itens, o cursor avança somente até o último processado.
IDs com o mesmo horário reaparecem e são deduplicados. Não usa `max(messageId)`
como timestamp. IDs numéricos de JSON são convertidos de forma sem perda antes
que `JSON.parse` possa arredondá-los além de 2^53.

A API de pesquisa é paginada por offset, **não é um changefeed transacional**.
O parâmetro `receivedTime` é limite superior (antes de), não limite inferior.
`fromDate` tem precisão de dia e a documentação o descreve como data do e-mail.
A cobertura de mensagens indexadas com atraso maior que a sobreposição, mensagens
movidas/excluídas durante a busca e mensagens novas com header Date muito antigo
não está comprovada. Esses casos precisam de teste real antes de ativar; o pacote
não promete entrega exatamente uma vez nem cobertura ilimitada. Um backlog acima
do limite retorna `mailbox_backlog`, sem marcar sincronização concluída.
Não aumentar o cursor manualmente para ocultar esse bloqueio.

Exclui pastas Sent, Drafts, Outbox, Templates, Spam e Trash. Uma pasta desconhecida
bloqueia o ciclo. A preflight de headers exige destinatário exato em To, Cc, Delivered-To ou
X-Original-To antes de buscar o conteúdo. Outros destinatários/aliases e Bcc sem
evidência de entrega são ignorados com um marcador privado de deduplicação,
sem download do conteúdo. From precisa coincidir com o remetente dos metadados.
Remetentes da própria conta também são ignorados somente pelos headers.
Conta divergente e headers ambíguos de uma mensagem destinada à caixa bloqueiam
o ciclo. O escopo OAuth permite metadados da conta, mas o adaptador não baixa
conteúdo de outras aliases nem o publica no Sistema de Eventos.
O RFC Message-ID é a chave da mensagem; o ID interno do Zoho é uma identidade de
coleta separada. In-Reply-To precisa ter um único ID válido.

Somente os endpoints de headers e conteúdo são usados. Não usa `originalmessage`
(poderia incluir anexos), não busca anexos/mídia/URLs e não executa HTML. Texto é
limitado a 6.000 caracteres. Conteúdo vazio e headers incompatíveis bloqueiam o
ciclo para revisão da caixa, sem descartar silenciosamente a mensagem.

## Testes e registro de publicação

`node --test checks/zoho-mailbox.test.cjs` cobre identidade/alias, origens, IDs
largos, conteúdo malicioso, destinatário/sender, OAuth privado, paginação acima
de 200, limite total, deduplicação, empate de horário, lote parcial, falhas e
configuração desabilitada. As fixtures não acessam provedores.

A migração deve passar pelo banco isolado/CI e regressões de canais antes da
publicação. Os testes Node verificam o contrato do RPC e a estrutura SQL; não
substituem execução transacional nem corrida real de dois clientes PostgreSQL.
Na verificação local desta entrega, PostgreSQL não estava ouvindo na porta 5432.

Registros exigidos no pacote de implantação:

- `supabase/config.toml`: `[functions.event-mailbox-sync]`, `verify_jwt=false`;
  a autenticação obrigatória é a chave privada do job dentro do handler.
- Incluir `event-mailbox-sync` na lista explícita de deploy das Edge Functions.
- Aplicar a migração sem habilitar o canal, OAuth ou cron como efeito colateral.

## Fontes primárias verificadas em 20/10/2026

- MX: https://dns.google/resolve?name=embaixadacarioca.com.br&type=MX
- Contas: https://www.zoho.com/mail/help/api/get-all-users-accounts.html
- Pastas: https://www.zoho.com/mail/help/api/get-all-folder-details.html
- Busca: https://www.zoho.com/mail/help/api/get-search-emails.html
- Lista: https://www.zoho.com/mail/help/api/get-emails-list.html
- Sintaxe: https://www.zoho.com/pt-br/mail/help/search-syntax.html?sredirect=true
- Headers: https://www.zoho.com/mail/help/api/get-email-header.html
- Conteúdo: https://www.zoho.com/mail/help/api/get-email-content.html
- OAuth: https://www.zoho.com/mail/help/api/using-oauth-2.html
- Centros de dados: https://www.zoho.com/mail/help/api/getting-started-with-api.html
- Accounts DC: https://help.zoho.com/portal/en/kb/accounts/manage-your-zoho-account/articles/data-center-for-zoho-account
