begin;
create table event_private.lead_webhook_rotation (id boolean primary key default true check(id),legacy_until timestamptz);
insert into event_private.lead_webhook_rotation(id) values(true);
alter table event_private.lead_webhook_rotation enable row level security;
revoke all on event_private.lead_webhook_rotation from public,anon,authenticated,service_role;
create function public.event_authorize_lead_webhook(candidate_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hook text; p event_private.lead_alert_policy; rotation event_private.lead_webhook_rotation; legacy boolean:=false;
begin
 if candidate_secret is null or length(candidate_secret) not between 1 and 8192 or candidate_secret~'[[:cntrl:]]' then
  return jsonb_build_object('valid',false,'legacyAllowed',false);
 end if;
 select * into p from event_private.lead_alert_policy where id;
 if not found then return jsonb_build_object('valid',false,'legacyAllowed',false); end if;
 select * into rotation from event_private.lead_webhook_rotation where id;
 if not found then return jsonb_build_object('valid',false,'legacyAllowed',false); end if;
 legacy:=case when rotation.legacy_until is not null then now()<rotation.legacy_until
  when not p.enabled then true else now()<p.started_at+interval '15 minutes' end;
 select decrypted_secret into hook from vault.decrypted_secrets where name='event_lead_webhook_secret';
 return jsonb_build_object('valid',coalesce(length(hook)>=32 and extensions.digest(candidate_secret,'sha256')=extensions.digest(hook,'sha256'),false),'legacyAllowed',legacy);
end $$;
revoke all on function public.event_authorize_lead_webhook(text) from public,anon,authenticated;
grant execute on function public.event_authorize_lead_webhook(text) to service_role;
create function event_private.notify_lead_vault()
returns trigger language plpgsql security definer set search_path='' as $$
declare endpoint text; hook text;
begin
 if TG_TABLE_SCHEMA<>'public' or TG_TABLE_NAME<>'solicitacoes_cotacao' or TG_OP not in('INSERT','UPDATE') then return new; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='event_lead_webhook_url';
 select decrypted_secret into hook from vault.decrypted_secrets where name='event_lead_webhook_secret';
 if endpoint!~'^https://[a-z0-9]{20}\.supabase\.co/functions/v1/notify-new-lead$' or length(hook)<32 or endpoint is null or hook is null then
  raise warning 'lead_alert_configuration_unavailable'; return new;
 end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',hook),
  body:=jsonb_build_object('type',TG_OP,'table',TG_TABLE_NAME,'schema',TG_TABLE_SCHEMA,'record',jsonb_build_object('id',new.id)));
 return new;
exception when others then
 raise warning 'lead_alert_queue_unavailable'; return new;
end $$;
revoke all on function event_private.notify_lead_vault() from public,anon,authenticated,service_role;
create or replace function event_private.dispatch_due_lead_alerts()
returns text language plpgsql security definer set search_path='' as $$
declare endpoint text; hook text;
begin
 if not coalesce((select enabled from event_private.lead_alert_policy where id),false) then return 'paused'; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='event_lead_webhook_url';
 select decrypted_secret into hook from vault.decrypted_secrets where name='event_lead_webhook_secret';
 if endpoint is null or hook is null or endpoint!~'^https://[a-z0-9]{20}\.supabase\.co/functions/v1/notify-new-lead$' or length(hook)<32 then return 'setup_pending'; end if;
 if not exists(select 1 from public.event_due_lead_alerts()) then return 'idle'; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',hook),body:='{"action":"scan-abandoned"}'::jsonb);
 return 'queued';
end $$;
revoke all on function event_private.dispatch_due_lead_alerts() from public,anon,authenticated,service_role;
commit;
