-- Dormant, individually provisioned pilot. Does not register a recipient, activate
-- a channel, grant a Bot scope, schedule work or modify commercial policy.
create table event_private.whatsapp_pilots (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 destination text not null check(destination ~ '^[1-9][0-9]{10,14}$'),
 body text not null check(length(body) between 10 and 6000),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 approval_reference text not null check(approval_reference ~ '^[A-Za-z0-9_./:-]{4,160}$'),
 created_at timestamptz not null default now() check(created_at<=now()),
 expires_at timestamptz not null,
 enabled boolean not null default false,
 status text not null default 'ready' check(status in ('ready','claimed','accepted','failed','uncertain','refused','revoked')),
 attempts integer not null default 0 check(attempts between 0 and 1),
 claimed_at timestamptz,
 finished_at timestamptz,
 provider_id text check(provider_id is null or provider_id ~ '^[A-Za-z0-9_.:-]{1,200}$'),
 network_attempted boolean,
 check(expires_at>created_at and expires_at<=created_at+interval '15 minutes'),
 check((status='ready' and attempts=0 and claimed_at is null) or (status<>'ready' and (status='revoked' or (attempts=1 and claimed_at is not null)))),
 check(status<>'accepted' or (provider_id is not null and network_attempted is true)),
 check(status='accepted' or provider_id is null)
);
create unique index whatsapp_pilots_one_enabled on event_private.whatsapp_pilots ((true)) where enabled;
alter table event_private.whatsapp_pilots enable row level security;
revoke all on event_private.whatsapp_pilots from public,anon,authenticated,service_role;

create function event_private.guard_whatsapp_pilot_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.id,new.owner_id,new.destination,new.body,new.content_hash,new.approval_reference,new.created_at,new.expires_at)
  is distinct from (old.id,old.owner_id,old.destination,old.body,old.content_hash,old.approval_reference,old.created_at,old.expires_at)
  or (not old.enabled and new.enabled) then
  raise exception using errcode='PT409',message='Escopo de piloto imutável; não reutilize a autorização.';
 end if;
 if new.attempts<old.attempts or (old.status<>'ready' and new.status='ready') or
  (old.status in ('accepted','failed','uncertain','refused','revoked') and new.status<>old.status) or
  (old.claimed_at is not null and new.claimed_at is distinct from old.claimed_at) or
  (old.finished_at is not null and (new.finished_at,new.provider_id,new.network_attempted) is distinct from (old.finished_at,old.provider_id,old.network_attempted)) then
  raise exception using errcode='PT409',message='Histórico de tentativa não pode ser reiniciado ou substituído.';
 end if;
 return new;
end; $$;
revoke all on function event_private.guard_whatsapp_pilot_identity() from public,anon,authenticated,service_role;
create trigger guard_whatsapp_pilot_identity before update on event_private.whatsapp_pilots
for each row execute function event_private.guard_whatsapp_pilot_identity();

create function event_private.owned_whatsapp_pilot(target_pilot uuid) returns event_private.whatsapp_pilots
language plpgsql security definer set search_path='' as $$
declare p event_private.whatsapp_pilots;
begin
 if auth.uid() is null or public.is_super_admin() is not true or not exists(
  select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 ) then raise exception using errcode='42501',message='Piloto indisponível para esta conta.'; end if;
 select * into p from event_private.whatsapp_pilots where id=target_pilot;
 if not found or p.owner_id is distinct from auth.uid() then raise exception using errcode='42501',message='Piloto indisponível para esta conta.'; end if;
 return p;
end; $$;
revoke all on function event_private.owned_whatsapp_pilot(uuid) from public,anon,authenticated,service_role;

create function public.get_event_whatsapp_pilot(target_pilot uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p event_private.whatsapp_pilots;
begin
 p:=event_private.owned_whatsapp_pilot(target_pilot);
 return jsonb_build_object('id',p.id,'owner_id',p.owner_id,'destination',p.destination,'body',p.body,'content_hash',p.content_hash,
  'expires_at',to_char(p.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'status',p.status,'attempts',p.attempts,'provider_id',p.provider_id,'network_attempted',p.network_attempted,
  'enabled',p.enabled,'eligible',p.enabled and p.status='ready' and p.attempts=0 and p.expires_at>now());
end; $$;
revoke all on function public.get_event_whatsapp_pilot(uuid) from public,anon,service_role;
grant execute on function public.get_event_whatsapp_pilot(uuid) to authenticated;

create function public.claim_event_whatsapp_pilot(target_pilot uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p event_private.whatsapp_pilots;
begin
 perform pg_advisory_xact_lock(hashtextextended('events-single-whatsapp-pilot',0));
 p:=event_private.owned_whatsapp_pilot(target_pilot);
 select * into p from event_private.whatsapp_pilots where id=target_pilot for update;
 if not p.enabled or p.expires_at<=now() or p.status<>'ready' or p.attempts<>0 then
  return jsonb_build_object('claimed',false,'pilot',public.get_event_whatsapp_pilot(target_pilot));
 end if;
 update event_private.whatsapp_pilots set status='claimed',attempts=1,claimed_at=now() where id=target_pilot;
 return jsonb_build_object('claimed',true,'pilot',public.get_event_whatsapp_pilot(target_pilot));
end; $$;
revoke all on function public.claim_event_whatsapp_pilot(uuid) from public,anon,service_role;
grant execute on function public.claim_event_whatsapp_pilot(uuid) to authenticated;

create function public.finish_event_whatsapp_pilot(target_pilot uuid,result_status text,external_id text,was_attempted boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if result_status is null or result_status not in ('accepted','failed','uncertain','refused') or
  (result_status='accepted' and (was_attempted is not true or external_id is null or external_id !~ '^[A-Za-z0-9_.:-]{1,200}$')) or
  (result_status<>'accepted' and external_id is not null) or
  (result_status='refused' and was_attempted is not false) or
  (result_status in ('failed','uncertain') and was_attempted is not true) then
  raise exception using errcode='22023',message='Resultado de piloto inválido.';
 end if;
 update event_private.whatsapp_pilots set status=result_status,provider_id=external_id,network_attempted=was_attempted,finished_at=now()
 where id=target_pilot and status='claimed' and attempts=1;
 if not found then raise exception using errcode='PT409',message='Resultado já registrado ou tentativa inexistente. Não repetir.'; end if;
end; $$;
revoke all on function public.finish_event_whatsapp_pilot(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_event_whatsapp_pilot(uuid,text,text,boolean) to service_role;
