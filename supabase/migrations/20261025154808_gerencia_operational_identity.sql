-- Candidate only: empty authority binding. No actual person/user is assigned.
-- Read the EXISTING canonical team whitelist, without cloning its real values
-- into this migration or changing the public team predicate. Unsupported policy
-- shapes fail closed and require an explicitly reviewed adapter.
create function event_private.gerencia_team_emails() returns text[]
language plpgsql stable security definer set search_path='' as $team$
declare source text; language_name text; normalized text; parts text[]; item text[]; emails text[]:='{}';
begin
 select p.prosrc,l.lanname into source,language_name from pg_catalog.pg_proc p
 join pg_catalog.pg_language l on l.oid=p.prolang where p.oid=pg_catalog.to_regprocedure('public.is_team_member()');
 if language_name is distinct from 'sql' then return null;end if;
 for item in select regexp_matches(source,$literal$'([^']*)'$literal$,'g') loop
  if item[1] ~ '[[:space:]]' then return null;end if;
 end loop;
 normalized:=regexp_replace(source,'[[:space:]]','','g');
 parts:=regexp_match(normalized,$shape$^selectlower\(coalesce\(auth\.jwt\(\)->>'email',''\)\)in\(('[^']+'(?:,'[^']+')*)\);?$shape$);
 if parts is null then return null;end if;
 for item in select regexp_matches(parts[1],$literal$'([^']+)'$literal$,'g') loop emails:=array_append(emails,item[1]);end loop;
 return emails;
end; $team$;
revoke all on function event_private.gerencia_team_emails() from public,anon,authenticated,service_role;
do $$ begin if event_private.gerencia_team_emails() is null then
 raise exception 'Política de equipe não compatível com o adaptador de identidade; revisão necessária antes da instalação.';
end if;end $$;
create table event_private.operation_gerencia_identity(
 singleton boolean primary key default true check(singleton),
 user_id uuid references auth.users(id), expected_email text,
 config_version integer not null default 0 check(config_version>=0),
 retired boolean not null default false,
 configured_by uuid, configured_db_role text not null default session_user,
 configured_at timestamptz not null default clock_timestamp(),
 check((user_id is null)=(expected_email is null)),
 check(expected_email is null or length(expected_email)<=254)
);
insert into event_private.operation_gerencia_identity(singleton) values(true);
create table event_private.operation_gerencia_identity_audit(
 config_version integer primary key, action text not null check(action in ('assign','revoke','retire')),
 previous_user_id uuid, user_id uuid, expected_email text,
 configured_by uuid, configured_db_role text not null default session_user,
 configured_at timestamptz not null default clock_timestamp()
);
alter table event_private.operation_gerencia_identity enable row level security;
alter table event_private.operation_gerencia_identity_audit enable row level security;
revoke all on event_private.operation_gerencia_identity,event_private.operation_gerencia_identity_audit from public,anon,authenticated,service_role;

create function event_private.gerencia_identity_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from event_private.operation_gerencia_identity i
  join auth.users u on u.id=i.user_id where i.singleton and not i.retired
   and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=clock_timestamp())
   and lower(u.email)=i.expected_email and lower(u.email)=any(event_private.gerencia_team_emails()));
$$;
revoke all on function event_private.gerencia_identity_ready() from public,anon,authenticated,service_role;

create function event_private.gerencia_can_sign() returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_team_member() and event_private.gerencia_identity_ready()
  and exists(select 1 from event_private.operation_gerencia_identity i where i.singleton and i.user_id=auth.uid() and not i.retired);
$$;
revoke all on function event_private.gerencia_can_sign() from public,anon,authenticated,service_role;

-- Owner-only administrative primitive, NOT a new authenticated API/grant.
-- A separate exact configuration approval is required for any real binding.
create function event_private.configure_gerencia_identity(expected_version integer,target_user uuid,target_email text,confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg event_private.operation_contact_config; prior event_private.operation_gerencia_identity;
 account auth.users; normalized text:=nullif(lower(btrim(target_email)),''); next_version integer;
begin
 if confirmed is distinct from true then raise exception 'Confirme explicitamente a alteração de identidade.';end if;
 select * into cfg from event_private.operation_contact_config where id for update;
 if not found or cfg.version is distinct from expected_version then raise exception using errcode='PT409',message='A configuração mudou. Atualize antes de vincular identidade.';end if;
 -- Recheck retirement AFTER the shared config lock, including calls in flight.
 if exists(select 1 from pg_catalog.pg_trigger where tgrelid='event_private.operation_contact_config'::regclass
  and tgname='operation_signoffs_retired_guard' and tgenabled<>'D') then
  raise exception using errcode='55000',message='Controle retirado por reversão; reinstalação revisada necessária.';
 end if;
 select * into prior from event_private.operation_gerencia_identity where singleton for update;
 if not found or prior.retired then raise exception using errcode='55000',message='Identidade retirada por reversão; reinstalação revisada necessária.';end if;
 if target_user is null then
  if normalized is not null then raise exception 'Revogação não recebe e-mail.';end if;
 else
  select * into account from auth.users where id=target_user for key share;
  if not found or normalized is null or length(normalized)>254 or lower(account.email) is distinct from normalized
   or (normalized=any(event_private.gerencia_team_emails())) is distinct from true
   or account.email_confirmed_at is null or (account.banned_until is not null and account.banned_until>clock_timestamp()) then
   raise exception 'Conta existente, e-mail confirmado e identidade correspondente são obrigatórios.';
  end if;
 end if;
 if prior.user_id is not distinct from target_user and prior.expected_email is not distinct from normalized then
  return jsonb_build_object('version',cfg.version,'assigned',prior.user_id is not null,'changed',false);
 end if;
 next_version:=cfg.version+1;
 update event_private.operation_gerencia_identity set user_id=target_user,expected_email=normalized,config_version=next_version,
  configured_by=auth.uid(),configured_db_role=session_user,configured_at=clock_timestamp() where singleton;
 -- Existing fingerprint/config invalidation preserves old signatures but makes
 -- them non-current. No payment, reservation or capacity rule is weakened.
 update event_private.operation_contact_config set version=next_version,updated_by=auth.uid(),updated_at=clock_timestamp() where id;
 insert into event_private.operation_gerencia_identity_audit(config_version,action,previous_user_id,user_id,expected_email,configured_by)
 values(next_version,case when target_user is null then 'revoke' else 'assign' end,prior.user_id,target_user,normalized,auth.uid());
 return jsonb_build_object('version',next_version,'assigned',target_user is not null,'changed',true);
end; $$;
revoke all on function event_private.configure_gerencia_identity(integer,uuid,text,boolean) from public,anon,authenticated,service_role;

create or replace function event_private.operation_signoff_evidence(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c event_private.operation_contact_config; h public.event_handoffs; fingerprint text; roles jsonb;
begin
 select * into c from event_private.operation_contact_config where id;
 select * into h from public.event_handoffs where opportunity_id=p.oportunidade_id;
 fingerprint:=event_private.operation_review_fingerprint(p);
 select jsonb_agg(jsonb_build_object('role',r.role,'required',r.role in ('financeiro','gerencia'),
   'signed',s.signed_by is not null and (r.role<>'gerencia' or (event_private.gerencia_identity_ready() and s.signed_by=(select user_id from event_private.operation_gerencia_identity where singleton and not retired))),
   'signed_at',case when r.role='gerencia' and not event_private.gerencia_identity_ready() then null else s.signed_at end,
   'can_sign',c.enabled and ((r.role='financeiro' and event_private.journey_financial_operator()) or (r.role='gerencia' and event_private.gerencia_can_sign())) and s.signed_by is null,
   'identity_pending',r.role='salao' or (r.role='gerencia' and not event_private.gerencia_identity_ready())) order by r.ordinality) into roles
 from unnest(array['financeiro','gerencia','salao']) with ordinality r(role,ordinality)
 left join event_private.operation_signoffs s on s.proposal_id=p.id and s.proposal_revision=p.revision and s.handoff_version=h.version
  and s.config_version=c.version and s.review_fingerprint=fingerprint and s.role=r.role;
 return jsonb_build_object('enabled',c.enabled,'config_version',c.version,'proposal_revision',p.revision,
  'handoff_version',h.version,'review_fingerprint',fingerprint,'roles',roles);
end; $$;
revoke all on function event_private.operation_signoff_evidence(public.propostas) from public,anon,authenticated,service_role;


create or replace function public.sign_event_operation(target_proposal uuid,expected_revision bigint,target_handoff_version integer,reviewed_fingerprint text,signoff_role text,confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c event_private.operation_contact_config; p public.propostas; h public.event_handoffs; fingerprint text;
begin
 perform event_private.require_team();
 if confirmed is distinct from true then raise exception 'Confirme explicitamente o seu próprio de acordo.';end if;
 select * into c from event_private.operation_contact_config where id for share;
 if not c.enabled then raise exception 'O controle de de acordos não está ativado.';end if;
 -- Authority is revalidated only AFTER the config lock, so revocation/signing serialize.
 if not ((signoff_role='financeiro' and event_private.journey_financial_operator()) or
   (signoff_role='gerencia' and event_private.gerencia_can_sign())) or signoff_role is null then
  raise insufficient_privilege using message='Identidade autorizada para este papel não disponível.';
 end if;
 select * into p from public.propostas where id=target_proposal for update;
 if not found or p.revision is distinct from expected_revision or p.is_current is distinct from true
  or coalesce(p.status,'') not in ('confirmado','pagamento_final','planejamento','evento_proximo') or p.snapshot ? 'amendmentOf' then
  raise exception using errcode='PT409',message='Revise o acordo confirmado atual antes de assinar.';
 end if;
 select * into h from public.event_handoffs where opportunity_id=p.oportunidade_id for update;
 if h.proposal_id is distinct from p.id or h.version is distinct from target_handoff_version or h.changes_pending is distinct from false then
  raise exception using errcode='PT409',message='O checklist mudou; revise a versão operacional atual.';
 end if;
 fingerprint:=event_private.operation_review_fingerprint(p);
 if reviewed_fingerprint is null or reviewed_fingerprint !~ '^[0-9a-f]{64}$' or reviewed_fingerprint is distinct from fingerprint then
  raise exception using errcode='PT409',message='As evidências mudaram. Atualize a agenda e revise antes de assinar.';
 end if;
 if signoff_role='gerencia' and not event_private.gerencia_can_sign() then
  raise insufficient_privilege using message='A identidade mudou durante a revisão. Atualize antes de assinar.';
 end if;
 insert into event_private.operation_signoffs(proposal_id,proposal_revision,handoff_version,config_version,review_fingerprint,role,signed_by)
 values(p.id,p.revision,h.version,c.version,fingerprint,signoff_role,auth.uid()) on conflict do nothing;
 if exists(select 1 from event_private.operation_signoffs s where s.proposal_id=p.id and s.proposal_revision=p.revision
  and s.handoff_version=h.version and s.config_version=c.version and s.review_fingerprint=fingerprint
  and s.role=signoff_role and s.signed_by is distinct from auth.uid()) then
  raise exception using errcode='PT409',message='Este de acordo já foi registrado por outra pessoa autorizada. Atualize a agenda; nenhuma assinatura foi atribuída a você.';
 end if;
 return event_private.operation_readiness(p);
end; $$;
revoke all on function public.sign_event_operation(uuid,bigint,integer,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.sign_event_operation(uuid,bigint,integer,text,text,boolean) to authenticated;

