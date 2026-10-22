-- Contacts are private metadata, never account provisioning or authorization.
create table event_private.operation_contact_config(
 id boolean primary key default true check(id), version integer not null default 0 check(version>=0),
 enabled boolean not null default false, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into event_private.operation_contact_config(id) values(true);
create table event_private.operation_contacts(
 role text primary key check(role in ('financeiro','gerencia','salao','eventos')),
 email text check(email is null or length(email)<=254), whatsapp text check(whatsapp is null or whatsapp ~ '^[+][1-9][0-9]{7,14}$')
);
insert into event_private.operation_contacts(role) values('financeiro'),('gerencia'),('salao'),('eventos');
create table event_private.operation_signoffs(
 proposal_id uuid not null references public.propostas(id), proposal_revision bigint not null,
 handoff_version integer not null, config_version integer not null,
 review_fingerprint text not null check(review_fingerprint ~ '^[0-9a-f]{64}$'),
 role text not null check(role in ('financeiro','gerencia','salao')),
 signed_by uuid not null references auth.users(id), signed_at timestamptz not null default clock_timestamp(),
 primary key(proposal_id,proposal_revision,handoff_version,config_version,review_fingerprint,role)
);
alter table event_private.operation_contact_config enable row level security;
alter table event_private.operation_contacts enable row level security;
alter table event_private.operation_signoffs enable row level security;
revoke all on event_private.operation_contact_config,event_private.operation_contacts,event_private.operation_signoffs from public,anon,authenticated,service_role;

create function public.get_event_operational_contacts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform event_private.require_team();
 if not public.is_super_admin() then raise insufficient_privilege using message='Contatos privados exclusivos do gestor.';end if;
 return (select jsonb_build_object('version',c.version,'enabled',c.enabled,'updated_at',c.updated_at,
  'contacts',(select jsonb_agg(jsonb_build_object('role',r.role,'email',r.email,'whatsapp',r.whatsapp,
    'required',r.role in ('financeiro','gerencia')) order by r.role) from event_private.operation_contacts r))
  from event_private.operation_contact_config c where id);
end; $$;
revoke all on function public.get_event_operational_contacts() from public,anon,authenticated,service_role;
grant execute on function public.get_event_operational_contacts() to authenticated;

create function public.configure_event_operational_contacts(expected_version integer,contacts jsonb,enable_signoffs boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c event_private.operation_contact_config; item jsonb; address text; phone text; changed boolean:=false; affected integer;
begin
 perform event_private.require_team();
 if not public.is_super_admin() then raise insufficient_privilege using message='Contatos privados exclusivos do gestor.';end if;
 select * into c from event_private.operation_contact_config where id for update;
 if c.version is distinct from expected_version then raise exception using errcode='PT409',message='A configuração mudou. Atualize antes de salvar.';end if;
 if enable_signoffs is null or (c.enabled and not enable_signoffs) then raise exception 'Não é permitido desativar os de acordos obrigatórios por esta operação.';end if;
 if jsonb_typeof(contacts) is distinct from 'array' or jsonb_array_length(contacts)<>4 then raise exception 'Informe exatamente os quatro papéis operacionais.';end if;
 if (select count(distinct x->>'role') from jsonb_array_elements(contacts) x)<>4 then raise exception 'Papéis duplicados ou ausentes.';end if;
 for item in select value from jsonb_array_elements(contacts) loop
  if jsonb_typeof(item) is distinct from 'object' or item->>'role' not in ('financeiro','gerencia','salao','eventos')
    or not item ? 'role' or exists(select 1 from jsonb_object_keys(item) k where k not in ('role','email','whatsapp'))
    or (item ? 'email' and jsonb_typeof(item->'email') not in ('string','null'))
    or (item ? 'whatsapp' and jsonb_typeof(item->'whatsapp') not in ('string','null')) then
   raise exception 'Somente papel, e-mail e WhatsApp são aceitos. Identidades e permissões não são configuradas aqui.';
  end if;
  address:=nullif(lower(btrim(item->>'email')),''); phone:=nullif(btrim(item->>'whatsapp'),'');
  if address is not null and (length(address)>254 or address !~ '^[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9.-]+[.][a-z]{2,}$') then raise exception 'E-mail inválido.';end if;
  if phone is not null and phone !~ '^[+][1-9][0-9]{7,14}$' then raise exception 'WhatsApp inválido; use formato internacional.';end if;
  update event_private.operation_contacts set email=address,whatsapp=phone where role=item->>'role' and (email,whatsapp) is distinct from (address,phone);
  get diagnostics affected=row_count;changed:=changed or affected>0;
 end loop;
 if not changed and c.enabled=enable_signoffs then return public.get_event_operational_contacts();end if;
 update event_private.operation_contact_config set version=version+1,enabled=enable_signoffs,updated_by=auth.uid(),updated_at=now() where id;
 return public.get_event_operational_contacts();
end; $$;
revoke all on function public.configure_event_operational_contacts(integer,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.configure_event_operational_contacts(integer,jsonb,boolean) to authenticated;

-- Bind every signoff to the evidence actually reviewed. Final release's own
-- decision/stamps are excluded so signing does not depend on itself.
create function event_private.operation_review_fingerprint(p public.propostas) returns text
language sql stable security definer set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object(
  'proposal_id',p.id,'revision',p.revision,'agreement',event_private.proposal_fingerprint(p),
  'config',(select version from event_private.operation_contact_config where id),
  'handoff',(select to_jsonb(h)-array['updated_at','status'] from public.event_handoffs h where opportunity_id=p.oportunidade_id),
  'reservation',(select to_jsonb(r)-'updated_at' from public.event_reservations r where opportunity_id=p.oportunidade_id),
  'production',(select to_jsonb(x)-'updated_at' from event_private.production_plans x where opportunity_id=p.oportunidade_id),
  'tasks',(select jsonb_agg(case when t.task_key='gerencia_go_no_go' then to_jsonb(t)-array['status','notes','acknowledged_at','acknowledged_by','completed_at','completed_by','updated_at']
    else to_jsonb(t)-'updated_at' end order by t.task_key) from public.event_handoff_tasks t join public.event_handoffs h using(opportunity_id)
    where t.opportunity_id=p.oportunidade_id and t.source_version=h.version)
 )::text,'sha256'),'hex');
$$;
revoke all on function event_private.operation_review_fingerprint(public.propostas) from public,anon,authenticated,service_role;

create function event_private.operation_signoff_evidence(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c event_private.operation_contact_config; h public.event_handoffs; fingerprint text; roles jsonb;
begin
 select * into c from event_private.operation_contact_config where id;
 select * into h from public.event_handoffs where opportunity_id=p.oportunidade_id;
 fingerprint:=event_private.operation_review_fingerprint(p);
 select jsonb_agg(jsonb_build_object('role',r.role,'required',r.role in ('financeiro','gerencia'),
   'signed',s.signed_by is not null,'signed_at',s.signed_at,
   'can_sign',c.enabled and r.role='financeiro' and event_private.journey_financial_operator() and s.signed_by is null,
   'identity_pending',r.role in ('gerencia','salao')) order by r.ordinality) into roles
 from unnest(array['financeiro','gerencia','salao']) with ordinality r(role,ordinality)
 left join event_private.operation_signoffs s on s.proposal_id=p.id and s.proposal_revision=p.revision and s.handoff_version=h.version
  and s.config_version=c.version and s.review_fingerprint=fingerprint and s.role=r.role;
 return jsonb_build_object('enabled',c.enabled,'config_version',c.version,'proposal_revision',p.revision,
  'handoff_version',h.version,'review_fingerprint',fingerprint,'roles',roles);
end; $$;
revoke all on function event_private.operation_signoff_evidence(public.propostas) from public,anon,authenticated,service_role;

-- Preserve all existing finance, reservation, production and capacity checks.
alter function event_private.operation_readiness(public.propostas) rename to operation_readiness_before_signoffs;
revoke all on function event_private.operation_readiness_before_signoffs(public.propostas) from public,anon,authenticated,service_role;
create function event_private.operation_readiness(p public.propostas) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb; signoffs jsonb; r jsonb; blockers jsonb;
begin
 evidence:=event_private.operation_readiness_before_signoffs(p); signoffs:=event_private.operation_signoff_evidence(p);
 blockers:=evidence->'blockers';
 if (signoffs->>'enabled')::boolean then
  for r in select value from jsonb_array_elements(signoffs->'roles') loop
   if (r->>'required')::boolean and not (r->>'signed')::boolean then
    blockers:=blockers||jsonb_build_array('Falta o de acordo de '||case r->>'role' when 'financeiro' then 'Financeiro' else 'Gerência' end||' para esta versão.');
   end if;
  end loop;
 end if;
 return evidence||jsonb_build_object('operational_signoffs',signoffs,'blockers',blockers,'ready',(evidence->>'ready')::boolean and jsonb_array_length(blockers)=0);
end; $$;
revoke all on function event_private.operation_readiness(public.propostas) from public,anon,authenticated,service_role;

create function public.sign_event_operation(target_proposal uuid,expected_revision bigint,target_handoff_version integer,reviewed_fingerprint text,signoff_role text,confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c event_private.operation_contact_config; p public.propostas; h public.event_handoffs; fingerprint text;
begin
 perform event_private.require_team();
 if confirmed is distinct from true then raise exception 'Confirme explicitamente o seu próprio de acordo.';end if;
 -- Contacts never confer authority. Only the existing Financeiro authority is
 -- usable; Gerência/Salão await a separately authorized identity mechanism.
 if signoff_role is distinct from 'financeiro' or not event_private.journey_financial_operator() then
  raise insufficient_privilege using message='Identidade autorizada para este papel ainda não disponível.';
 end if;
 select * into c from event_private.operation_contact_config where id for share;
 if not c.enabled then raise exception 'O controle de de acordos não está ativado.';end if;
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

-- The same H -> G order is used by configuration and evidence invalidation.
create function event_private.reset_operation_release(opportunity uuid) returns void
language plpgsql security definer set search_path='' as $$
declare h public.event_handoffs; affected integer;
begin
 select * into h from public.event_handoffs where opportunity_id=opportunity for update;
 if not found then return;end if;
 update public.event_handoff_tasks set status='pending',acknowledged_at=null,acknowledged_by=null,
  completed_at=null,completed_by=null,updated_at=now()
 where opportunity_id=opportunity and source_version=h.version and task_key='gerencia_go_no_go'
  and (status<>'pending' or acknowledged_at is not null or completed_at is not null);
 get diagnostics affected=row_count;
 if affected>0 then update public.event_handoffs set status='active',updated_at=now() where opportunity_id=opportunity;end if;
end; $$;
revoke all on function event_private.reset_operation_release(uuid) from public,anon,authenticated,service_role;

-- Configuration changes never rewrite completed historical events. Upcoming or
-- undated, currently open agreements need a fresh final release under the policy.
create function event_private.invalidate_signoff_configuration() returns trigger
language plpgsql security definer set search_path='' as $$
declare h public.event_handoffs;
begin
 if not new.enabled or new.version=old.version then return null;end if;
 for h in select x.* from public.event_handoffs x join public.propostas p on p.id=x.proposal_id
  where p.is_current and p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
   and (p.data_evento is null or p.data_evento>=(now() at time zone 'America/Sao_Paulo')::date)
  order by x.opportunity_id for update of x loop
  perform event_private.reset_operation_release(h.opportunity_id);
 end loop;
 return null;
end; $$;
revoke all on function event_private.invalidate_signoff_configuration() from public,anon,authenticated,service_role;
create trigger invalidate_signoff_configuration after update on event_private.operation_contact_config
 for each row execute function event_private.invalidate_signoff_configuration();

-- Semantic edits invalidate final release, but do not erase historical signatures.
create function event_private.invalidate_signoff_release() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not (select enabled from event_private.operation_contact_config where id) then return null;end if;
 if tg_table_name='event_handoff_tasks' and coalesce(new.task_key,old.task_key)='gerencia_go_no_go' then return null;end if;
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return null;end if;
 perform event_private.reset_operation_release(coalesce(new.opportunity_id,old.opportunity_id));
 return null;
end; $$;
revoke all on function event_private.invalidate_signoff_release() from public,anon,authenticated,service_role;
create trigger invalidate_signoff_task after insert or update or delete on public.event_handoff_tasks for each row execute function event_private.invalidate_signoff_release();
create trigger invalidate_signoff_reservation after insert or update or delete on public.event_reservations for each row execute function event_private.invalidate_signoff_release();
create trigger invalidate_signoff_production after insert or update or delete on event_private.production_plans for each row execute function event_private.invalidate_signoff_release();
