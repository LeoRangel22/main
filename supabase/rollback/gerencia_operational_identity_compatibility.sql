-- Atomic compatibility withdrawal; never disables an active obligation.
do $gerencia_rollback$
declare cfg event_private.operation_contact_config; identity event_private.operation_gerencia_identity; next_version integer;
begin
 lock table event_private.operation_contact_config in access exclusive mode;
 select * into cfg from event_private.operation_contact_config where id for update;
 if not found or cfg.enabled is distinct from false then raise exception 'Reversão de Gerência exige política ainda desligada.';end if;
 select * into identity from event_private.operation_gerencia_identity where singleton for update;
 if not identity.retired then
  next_version:=cfg.version+1;
  update event_private.operation_gerencia_identity set retired=true,config_version=next_version,configured_by=auth.uid(),configured_db_role=session_user,configured_at=clock_timestamp() where singleton;
  update event_private.operation_contact_config set version=next_version,updated_by=auth.uid(),updated_at=clock_timestamp() where id;
  insert into event_private.operation_gerencia_identity_audit(config_version,action,previous_user_id,user_id,expected_email,configured_by) values(next_version,'retire',identity.user_id,identity.user_id,identity.expected_email,auth.uid());
 end if;
 execute $restore$
create or replace function event_private.operation_signoff_evidence(p public.propostas) returns jsonb
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


$restore$;
 execute $restore$
create or replace function public.sign_event_operation(target_proposal uuid,expected_revision bigint,target_handoff_version integer,reviewed_fingerprint text,signoff_role text,confirmed boolean) returns jsonb
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


$restore$;
 revoke all on function event_private.configure_gerencia_identity(integer,uuid,text,boolean) from public,anon,authenticated,service_role;
end; $gerencia_rollback$;
