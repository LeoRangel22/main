# Aviso de novo lead por e-mail com ZeptoMail

Fluxo:

1. Cliente envia o formulário
2. A tabela `public.solicitacoes_cotacao` recebe um `INSERT`
3. O webhook do banco chama a Edge Function `notify-new-lead`
4. A função envia um e-mail pelo ZeptoMail para `eventos@embaixadacarioca.com.br`

## Secrets necessários no Supabase

Configure estes secrets no projeto:

- `ZEPTO_MAIL_TOKEN`
- `LEAD_ALERT_FROM_EMAIL`
- `LEAD_ALERT_FROM_NAME`
- `LEAD_ALERT_TO_EMAIL`
- `LEAD_WEBHOOK_SECRET`
- `APP_BASE_URL`

### Sugestão de valores

- `LEAD_ALERT_FROM_NAME=Eventos Embaixada`
- `LEAD_ALERT_TO_EMAIL=eventos@embaixadacarioca.com.br`
- `APP_BASE_URL=https://leorangel22.github.io/main/`

`LEAD_ALERT_FROM_EMAIL` precisa ser um remetente válido no ZeptoMail, por exemplo:

- `leads@embaixadacarioca.com.br`

`ZEPTO_MAIL_TOKEN` deve guardar o valor completo do header da API:

- `Zoho-enczapikey ...`

## Deploy da função

Com Supabase CLI configurado:

```bash
supabase functions deploy notify-new-lead --project-ref SEU_PROJECT_REF --no-verify-jwt
```

## Criar o webhook do banco

Abra o arquivo:

- `supabase/new-lead-webhook.sql`

Troque:

- `PROJECT_REF`
- `LEAD_WEBHOOK_SECRET`

Depois rode o SQL no editor do Supabase.

## Teste

1. Envie um lead pelo formulário
2. Verifique se entrou em `solicitacoes_cotacao`
3. Verifique se chegou e-mail em `eventos@embaixadacarioca.com.br`
4. Se não chegar, veja os logs da função `notify-new-lead`
