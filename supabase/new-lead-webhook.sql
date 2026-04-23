-- Embaixada Carioca - webhook para avisar novo lead por e-mail
-- Antes de rodar:
-- 1. Faça deploy da Edge Function `notify-new-lead`
-- 2. Substitua PROJECT_REF e LEAD_WEBHOOK_SECRET
-- 3. Rode este SQL no Supabase SQL Editor

drop trigger if exists notify_new_lead_webhook on public.solicitacoes_cotacao;

create trigger notify_new_lead_webhook
after insert on public.solicitacoes_cotacao
for each row
execute function supabase_functions.http_request(
  'https://PROJECT_REF.supabase.co/functions/v1/notify-new-lead',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"LEAD_WEBHOOK_SECRET"}',
  '{}',
  '5000'
);
