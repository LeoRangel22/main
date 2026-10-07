-- Fresh installations only. Existing deployments retain their configured webhook.
-- Configure Vault secrets event_lead_webhook_url and event_lead_webhook_secret
-- separately. No network request occurs without both values.
create function public.notify_new_lead_fn() returns trigger
language plpgsql security definer set search_path='' as $$
declare endpoint text; webhook_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return new; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
    into endpoint using 'event_lead_webhook_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1 limit 1'
    into webhook_secret using 'event_lead_webhook_secret';
  if endpoint is null or webhook_secret is null then return new; end if;
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),body:=jsonb_build_object('type',tg_op,'table',tg_table_name,'schema',tg_table_schema,'record',to_jsonb(new)));
  return new;
end $$;
revoke all on function public.notify_new_lead_fn() from public,anon,authenticated;
create trigger notify_new_lead_webhook after insert on public.solicitacoes_cotacao
for each row when (new.capture_status='complete') execute function public.notify_new_lead_fn();
