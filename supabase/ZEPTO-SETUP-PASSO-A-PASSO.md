# Passo a passo - ZeptoMail + Supabase

## 1. No ZeptoMail

Confirme no painel:

- domínio do remetente: `embaixadacarioca.com.br`
- remetente: `leads@embaixadacarioca.com.br`
- destinatário: `eventos@embaixadacarioca.com.br`

Como o token foi compartilhado durante a configuração, por segurança é recomendável gerar um novo token quando o fluxo estiver validado.

## 2. No Supabase - criar secrets

Abra:

- Project Settings
- Edge Functions
- Secrets

Crie estes secrets:

- `ZEPTO_MAIL_TOKEN`
- `LEAD_ALERT_FROM_EMAIL`
- `LEAD_ALERT_FROM_NAME`
- `LEAD_ALERT_TO_EMAIL`
- `LEAD_WEBHOOK_SECRET`
- `APP_BASE_URL`

### Valores sugeridos

- `LEAD_ALERT_FROM_EMAIL=leads@embaixadacarioca.com.br`
- `LEAD_ALERT_FROM_NAME=Eventos Embaixada`
- `LEAD_ALERT_TO_EMAIL=eventos@embaixadacarioca.com.br`
- `LEAD_WEBHOOK_SECRET=seu segredo do webhook`
- `APP_BASE_URL=https://leorangel22.github.io/main/`

Em `ZEPTO_MAIL_TOKEN`, cole o valor completo do header da API do ZeptoMail:

- `Zoho-enczapikey ...`

## 3. Deploy da função

```bash
supabase functions deploy notify-new-lead --project-ref SEU_PROJECT_REF --no-verify-jwt
```

## 4. Criar o webhook do banco

Abra:

- `supabase/new-lead-webhook.sql`

Substitua:

- `PROJECT_REF`
- `LEAD_WEBHOOK_SECRET`

Depois rode o SQL no editor do Supabase.

## 5. Teste

1. Envie um lead pelo formulário
2. Verifique se entrou em `solicitacoes_cotacao`
3. Verifique se o e-mail chegou em `eventos@embaixadacarioca.com.br`
4. Se falhar, confira os logs da função `notify-new-lead`
