-- LOCAL CANDIDATE, NOT A PRODUCTION MIGRATION. No credentials or activation.
-- Vault must already exist. Do not grant callers access to its decrypted view.
create table event_private.mailbox_oauth_attempts (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 state text not null check(state in ('prepared','claimed','stored','uncertain')),
 client_fingerprint text not null check(client_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),prepare_expires_at timestamptz not null,
 claimed_at timestamptz,claim_expires_at timestamptz,diagnostic text,
 check(prepare_expires_at>created_at)
);
create table event_private.mailbox_oauth_connection (
 singleton boolean primary key default true check(singleton),attempt_id uuid not null unique references event_private.mailbox_oauth_attempts(id),
 owner_id uuid not null references auth.users(id),account_id text not null check(account_id ~ '^[0-9]{1,40}$'),
 mailbox text not null check(mailbox='eventos@embaixadacarioca.com.br'),vault_secret_id uuid not null unique,
 client_fingerprint text not null check(client_fingerprint ~ '^[0-9a-f]{64}$'),stored_at timestamptz not null default clock_timestamp()
);
alter table event_private.mailbox_oauth_attempts enable row level security;
alter table event_private.mailbox_oauth_connection enable row level security;
revoke all on event_private.mailbox_oauth_attempts,event_private.mailbox_oauth_connection from public,anon,authenticated,service_role;

create function event_private.require_mailbox_oauth_owner() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_super_admin() is distinct from true or public.is_team_member() is distinct from true then raise exception 'oauth_owner_required';end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(auth.jwt()->>'email')) then raise exception 'oauth_owner_required';end if;
end $$;
revoke all on function event_private.require_mailbox_oauth_owner() from public,anon,authenticated,service_role;
create function event_private.require_mailbox_oauth_off() returns void language plpgsql security definer set search_path='' as $$
declare s event_private.mailbox_sync_state;c event_private.channel_credentials;
begin
 select * into s from event_private.mailbox_sync_state where singleton for update;
 if not found then raise exception 'oauth_configuration_missing';end if;
 select * into c from event_private.channel_credentials where provider='mailbox' for update;
 if not found then raise exception 'oauth_configuration_missing';end if;
 if s.enabled is distinct from false or c.enabled is distinct from false or coalesce(cardinality(s.capture_send_ids),0)<>0 or s.capture_started_at is not null or s.capture_expires_at is not null then raise exception 'oauth_capture_must_be_off';end if;
end $$;
revoke all on function event_private.require_mailbox_oauth_off() from public,anon,authenticated,service_role;

create function public.event_mailbox_oauth_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare a event_private.mailbox_oauth_attempts;
begin
 perform event_private.require_mailbox_oauth_owner();
 if exists(select 1 from event_private.mailbox_oauth_connection where singleton) then return jsonb_build_object('state','stored');end if;
 select * into a from event_private.mailbox_oauth_attempts where owner_id=auth.uid() order by created_at desc,id limit 1;
 if not found then return jsonb_build_object('state','absent');end if;
 return jsonb_build_object('state',case when a.state='prepared' and a.prepare_expires_at<=clock_timestamp() then 'expired' when a.state='claimed' and a.claim_expires_at<=clock_timestamp() then 'uncertain' else a.state end,'attempt_id',a.id,'expires_at',a.prepare_expires_at);
end $$;
revoke all on function public.event_mailbox_oauth_status() from public,anon;
grant execute on function public.event_mailbox_oauth_status() to authenticated;

create function public.event_mailbox_oauth_prepare(client_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a event_private.mailbox_oauth_attempts;
begin
 perform event_private.require_mailbox_oauth_owner();
 if client_fingerprint is null or client_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'oauth_request_invalid';end if;
 perform pg_advisory_xact_lock(716613);
 perform event_private.require_mailbox_oauth_off();
 if exists(select 1 from event_private.mailbox_oauth_connection) or exists(select 1 from vault.secrets where name='events-mailbox-refresh-v1') then raise exception 'oauth_connection_already_exists';end if;
 if exists(select 1 from event_private.mailbox_oauth_attempts where state in ('claimed','uncertain') or (state='prepared' and prepare_expires_at>clock_timestamp())) then raise exception 'oauth_attempt_requires_readback';end if;
 insert into event_private.mailbox_oauth_attempts(owner_id,state,client_fingerprint,prepare_expires_at)
 values(auth.uid(),'prepared',$1,clock_timestamp()+interval '10 minutes') returning * into a;
 return jsonb_build_object('attempt_id',a.id,'expires_at',a.prepare_expires_at);
end $$;
revoke all on function public.event_mailbox_oauth_prepare(text) from public,anon;
grant execute on function public.event_mailbox_oauth_prepare(text) to authenticated;

create function public.event_mailbox_oauth_claim(target_attempt uuid,client_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a event_private.mailbox_oauth_attempts;
begin
 perform event_private.require_mailbox_oauth_owner();
 perform pg_advisory_xact_lock(716613);
 perform event_private.require_mailbox_oauth_off();
 select * into a from event_private.mailbox_oauth_attempts where id=target_attempt for update;
 if not found or a.owner_id is distinct from auth.uid() or a.state<>'prepared' or a.prepare_expires_at<=clock_timestamp() or a.client_fingerprint is distinct from $2 or exists(select 1 from event_private.mailbox_oauth_connection) then raise exception 'oauth_claim_rejected';end if;
 update event_private.mailbox_oauth_attempts set state='claimed',claimed_at=clock_timestamp(),claim_expires_at=clock_timestamp()+interval '120 seconds' where id=target_attempt;
 return jsonb_build_object('claimed',true);
end $$;
revoke all on function public.event_mailbox_oauth_claim(uuid,text) from public,anon;
grant execute on function public.event_mailbox_oauth_claim(uuid,text) to authenticated;

create function public.event_mailbox_oauth_claim_status(target_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare active boolean;
begin
 perform event_private.require_mailbox_oauth_owner();
 perform event_private.require_mailbox_oauth_off();
 select a.state='claimed' and a.claim_expires_at>clock_timestamp() into active from event_private.mailbox_oauth_attempts a where id=target_attempt and owner_id=auth.uid();
 return jsonb_build_object('active',coalesce(active,false));
end $$;
revoke all on function public.event_mailbox_oauth_claim_status(uuid) from public,anon;
grant execute on function public.event_mailbox_oauth_claim_status(uuid) to authenticated;

create function public.event_mailbox_oauth_store(target_attempt uuid,owner_id uuid,target_account text,refresh_value text,client_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a event_private.mailbox_oauth_attempts;v uuid;verified text;s event_private.mailbox_sync_state;c event_private.channel_credentials;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'oauth_worker_required';end if;
 if target_account is null or target_account !~ '^[0-9]{1,40}$' or refresh_value is null or length(refresh_value)>8192 or refresh_value !~ '^[A-Za-z0-9._~-]+$' then raise exception 'oauth_store_invalid';end if;
 perform pg_advisory_xact_lock(716613);
 perform event_private.require_mailbox_oauth_off();
 select * into a from event_private.mailbox_oauth_attempts where id=target_attempt for update;
 if not found or a.owner_id is distinct from $2 or a.state<>'claimed' or a.claim_expires_at<=clock_timestamp() or a.client_fingerprint is distinct from $5 then raise exception 'oauth_store_claim_rejected';end if;
 if exists(select 1 from event_private.mailbox_oauth_connection) or exists(select 1 from vault.secrets where name='events-mailbox-refresh-v1') then raise exception 'oauth_no_overwrite';end if;
 select * into s from event_private.mailbox_sync_state where singleton for update;
 select * into c from event_private.channel_credentials where provider='mailbox' for update;
 if s.account_id is not null and s.account_id<>target_account or s.mailbox is not null and s.mailbox<>'eventos@embaixadacarioca.com.br' or c.expected_account is not null and c.expected_account<>'eventos@embaixadacarioca.com.br' then raise exception 'oauth_existing_pin_conflict';end if;
 v:=vault.create_secret(refresh_value,'events-mailbox-refresh-v1','Events Mail READ-only refresh credential');
 select decrypted_secret into verified from vault.decrypted_secrets where id=v;
 if verified is distinct from refresh_value then raise exception 'oauth_vault_readback_failed';end if;
 insert into event_private.mailbox_oauth_connection(singleton,attempt_id,owner_id,account_id,mailbox,vault_secret_id,client_fingerprint)
 values(true,target_attempt,$2,target_account,'eventos@embaixadacarioca.com.br',v,$5);
 -- Only identity pins: no cursor reset, watermark, capture, schedule or activation.
 update event_private.mailbox_sync_state set account_id=target_account,mailbox='eventos@embaixadacarioca.com.br',version=version+1 where singleton;
 update event_private.channel_credentials set expected_account='eventos@embaixadacarioca.com.br' where provider='mailbox';
 if a.claim_expires_at<=clock_timestamp() then raise exception 'oauth_store_claim_expired';end if;
 update event_private.mailbox_oauth_attempts set state='stored',diagnostic=null where id=target_attempt;
 return jsonb_build_object('stored',true);
exception when others then raise exception using errcode='PT409',message='oauth_storage_unconfirmed';
end $$;
revoke all on function public.event_mailbox_oauth_store(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.event_mailbox_oauth_store(uuid,uuid,text,text,text) to service_role;

create function public.event_mailbox_oauth_uncertain(target_attempt uuid,owner_id uuid,diagnostic text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role' is distinct from 'service_role' or diagnostic not in ('EXCHANGE','CLAIM_READBACK','ACCOUNT','STORE','STATUS') then raise exception 'oauth_worker_required';end if;
 perform pg_advisory_xact_lock(716613);
 update event_private.mailbox_oauth_attempts a set state='uncertain',diagnostic=$3 where a.id=target_attempt and a.owner_id=$2 and a.state='claimed';
 -- No reset/rearm; a stored connection cannot be overwritten by a late failure.
end $$;
revoke all on function public.event_mailbox_oauth_uncertain(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.event_mailbox_oauth_uncertain(uuid,uuid,text) to service_role;

create function public.event_mailbox_oauth_worker_credential(target_account text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c event_private.mailbox_oauth_connection;refresh_value text;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' then raise exception 'oauth_worker_required';end if;
 select * into c from event_private.mailbox_oauth_connection where singleton;
 if not found then return jsonb_build_object('available',false);end if;
 if c.account_id is distinct from target_account then raise exception 'oauth_account_mismatch';end if;
 select decrypted_secret into refresh_value from vault.decrypted_secrets where id=c.vault_secret_id;
 if nullif(refresh_value,'') is null then raise exception 'oauth_credential_unavailable';end if;
 return jsonb_build_object('available',true,'refresh_token',refresh_value);
end $$;
revoke all on function public.event_mailbox_oauth_worker_credential(text) from public,anon,authenticated;
grant execute on function public.event_mailbox_oauth_worker_credential(text) to service_role;
