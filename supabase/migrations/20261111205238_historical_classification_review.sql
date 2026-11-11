create schema if not exists event_crm_review_api authorization postgres;
revoke all on schema event_crm_review_api from public,anon,service_role;
grant usage on schema event_crm_review_api to authenticated;
alter default privileges for role postgres in schema event_crm_review_api revoke execute on functions from public;
-- Manual classification is an append-only overlay. Imported evidence is never rewritten.
create table if not exists event_crm.classification_review_events (
 request_id uuid primary key,
 batch_id text not null references event_crm.import_batches(id),
 kind text not null check(kind in ('organization','contact')),
 record_id text not null,
 revision integer not null check(revision>0),
 actor_id uuid not null,
 actor_email text not null,
 classification text check(classification in ('customer','supplier','service','other','unknown')),
 segment text check(segment in ('tourism','events','company','person','unknown')),
 reason text not null check(length(reason) between 10 and 500),
 created_at timestamptz not null default clock_timestamp(),
 unique(batch_id,kind,record_id,revision),
 foreign key(batch_id,kind,record_id) references event_crm.foundation_records(batch_id,kind,record_id)
);
alter table event_crm.classification_review_events enable row level security;
revoke all on event_crm.classification_review_events from public,anon,authenticated,service_role;
comment on table event_crm.classification_review_events is
 'Append-only manual classification overlay; not event/financial evidence, contact consent or an identity merge.';
create or replace function event_crm_review_api.require_review_owner()
returns void language plpgsql stable security definer set search_path='' as $f$
begin
 if auth.uid() is null or not public.is_super_admin() or not exists(
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and lower(u.email)=lower(auth.jwt()->>'email')
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
   and s.id::text=auth.jwt()->>'session_id' and(s.not_after is null or s.not_after>now())
 ) then raise exception using errcode='42501',message='Revisão disponível somente na sessão Master ativa.'; end if;
end; $f$;
revoke all on function event_crm_review_api.require_review_owner() from public,anon,authenticated,service_role;

create or replace function event_crm_review_api.immutable_review()
returns trigger language plpgsql security invoker set search_path='' as $f$
begin raise exception using errcode='42501',message='O histórico de classificação é imutável.'; end; $f$;
revoke all on function event_crm_review_api.immutable_review() from public,anon,authenticated,service_role;
drop trigger if exists immutable_classification_review on event_crm.classification_review_events;
create trigger immutable_classification_review before update or delete on event_crm.classification_review_events
 for each row execute function event_crm_review_api.immutable_review();

create or replace function event_crm_review_api.review_summary(b text,k text,r text)
returns jsonb language sql stable security invoker set search_path='' as $f$
 select coalesce((select jsonb_build_object('revision',e.revision,'classification',e.classification,
  'segment',e.segment,'reason',e.reason,'created_at',e.created_at,'request_id',e.request_id,'actor_id',e.actor_id,'actor_email',e.actor_email)
  from event_crm.classification_review_events e where e.batch_id=b and e.kind=k and e.record_id=r
  order by e.revision desc limit 1),
  jsonb_build_object('revision',0,'classification',null,'segment',null));
$f$;
revoke all on function event_crm_review_api.review_summary(text,text,text) from public,anon,authenticated,service_role;

create or replace function event_crm_review_api.read_classification(
 p_batch_id text,p_kind text,p_record_id text,p_offset integer default 0,p_request_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $f$
declare current_batch text; total integer; items jsonb; receipt jsonb;
begin
 perform event_crm_review_api.require_review_owner();
 if p_kind is null or p_kind not in ('organization','contact') or p_offset is null or p_offset not between 0 and 10000
  or p_batch_id is null or length(p_batch_id)>160 or p_record_id is null or length(p_record_id)>160 then
  raise exception using errcode='22023',message='Parâmetros de revisão inválidos.'; end if;
 select id into current_batch from event_crm.import_batches where status='validated'
  order by created_at desc,id desc limit 1;
 if p_batch_id is distinct from current_batch then
  raise exception using errcode='PT409',message='A base histórica mudou. Atualize antes de revisar.'; end if;
 if not exists(select 1 from event_crm.foundation_records
  where batch_id=p_batch_id and kind=p_kind and record_id=p_record_id) then
  raise exception using errcode='22023',message='Registro não encontrado nesta base.'; end if;
 select count(*) into total from event_crm.classification_review_events
  where batch_id=p_batch_id and kind=p_kind and record_id=p_record_id;
 select coalesce(jsonb_agg(x.data order by x.revision desc),'[]'::jsonb) into items from(
  select revision,jsonb_build_object('revision',revision,'classification',classification,'segment',segment,
   'reason',reason,'created_at',created_at,'request_id',request_id,'actor_id',actor_id,'actor_email',actor_email) data
  from event_crm.classification_review_events where batch_id=p_batch_id and kind=p_kind and record_id=p_record_id
  order by revision desc limit 10 offset p_offset) x;
 if p_request_id is not null then
  select jsonb_build_object('request_id',request_id,'revision',revision) into receipt
   from event_crm.classification_review_events where request_id=p_request_id
    and batch_id=p_batch_id and kind=p_kind and record_id=p_record_id;
 end if;
 return jsonb_build_object('batch_id',p_batch_id,'kind',p_kind,'record_id',p_record_id,
  'current',event_crm_review_api.review_summary(p_batch_id,p_kind,p_record_id),
  'history',items,'total',total,'offset',p_offset,'limit',10,'receipt',receipt);
end; $f$;
revoke all on function event_crm_review_api.read_classification(text,text,text,integer,uuid) from public,anon,service_role;
grant execute on function event_crm_review_api.read_classification(text,text,text,integer,uuid) to authenticated;

create or replace function event_crm_review_api.save_classification(
 p_batch_id text,p_kind text,p_record_id text,p_expected_revision integer,p_request_id uuid,
 p_classification text,p_segment text,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='8s' as $f$
declare latest text; existing event_crm.classification_review_events; v integer; clean_reason text:=btrim(p_reason);
begin
 perform event_crm_review_api.require_review_owner();
 if p_kind is null or p_kind not in ('organization','contact') or p_request_id is null
  or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>1000000000
  or p_batch_id is null or length(p_batch_id)>160 or p_record_id is null or length(p_record_id)>160
  or clean_reason is null or length(clean_reason) not between 10 and 500
  or (p_classification is not null and p_classification not in ('customer','supplier','service','other','unknown'))
  or (p_segment is not null and p_segment not in ('tourism','events','company','person','unknown')) then
  raise exception using errcode='22023',message='Confira classificação, segmento e motivo da revisão.'; end if;
 -- Same transaction lock for each immutable batch/kind/id; no name/e-mail matching.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  jsonb_build_array(p_batch_id,p_kind,p_record_id)::text,0));
 select id into latest from event_crm.import_batches where status='validated'
  order by created_at desc,id desc limit 1;
 if p_batch_id is distinct from latest then
  raise exception using errcode='PT409',message='A base histórica mudou. Atualize antes de revisar.'; end if;
 if not exists(select 1 from event_crm.foundation_records
  where batch_id=p_batch_id and kind=p_kind and record_id=p_record_id) then
  raise exception using errcode='22023',message='Registro não encontrado nesta base.'; end if;
 select * into existing from event_crm.classification_review_events where request_id=p_request_id;
 if found then
  if existing.batch_id is distinct from p_batch_id or existing.kind is distinct from p_kind
   or existing.record_id is distinct from p_record_id or existing.classification is distinct from p_classification
   or existing.segment is distinct from p_segment or existing.reason is distinct from clean_reason
   or existing.revision<>p_expected_revision+1 or existing.actor_id<>auth.uid() then
   raise exception using errcode='22023',message='Esta solicitação pertence a outra revisão.'; end if;
  return jsonb_build_object('status','already_saved','revision',existing.revision,'request_id',existing.request_id);
 end if;
 select coalesce(max(revision),0) into v from event_crm.classification_review_events
  where batch_id=p_batch_id and kind=p_kind and record_id=p_record_id;
 if v<>p_expected_revision then
  raise exception using errcode='PT409',message='Outra revisão foi registrada. Atualize antes de continuar.'; end if;
 insert into event_crm.classification_review_events
  (request_id,batch_id,kind,record_id,revision,actor_id,actor_email,classification,segment,reason)
 values(p_request_id,p_batch_id,p_kind,p_record_id,v+1,auth.uid(),lower(auth.jwt()->>'email'),p_classification,p_segment,clean_reason);
 return jsonb_build_object('status','saved','revision',v+1,'request_id',p_request_id);
exception when unique_violation then
 raise exception using errcode='PT409',message='Esta solicitação já está em uso. Consulte o estado sem repetir.';
end; $f$;
revoke all on function event_crm_review_api.save_classification(text,text,text,integer,uuid,text,text,text) from public,anon,service_role;
grant execute on function event_crm_review_api.save_classification(text,text,text,integer,uuid,text,text,text) to authenticated;

create or replace function event_crm_review_api.decorate_history(data jsonb)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $f$
declare k text:=data->>'kind'; b text:=data->>'batch_id'; records jsonb; latest text;
begin
 perform event_crm_review_api.require_review_owner();
 if data->>'available' is distinct from 'true' then return data; end if;
 select id into latest from event_crm.import_batches where status='validated' order by created_at desc,id desc limit 1;
 if b is distinct from latest then raise exception using errcode='PT409',message='A base histórica mudou. Atualize a consulta.'; end if;
 if k not in ('organization','contact') then return data; end if;
 if data ? 'record' then
  return data||jsonb_build_object('classification_review',
   event_crm_review_api.read_classification(b,k,data->'record'->>'id',0,null));
 end if;
 select coalesce(jsonb_agg(x.value||jsonb_build_object('classification_review',
  event_crm_review_api.review_summary(b,k,x.value->>'id')) order by x.ordinality),'[]'::jsonb)
 into records from jsonb_array_elements(data->'records') with ordinality as x(value,ordinality);
 return data||jsonb_build_object('records',records);
end; $f$;
revoke all on function event_crm_review_api.decorate_history(jsonb) from public,anon,service_role;
grant execute on function event_crm_review_api.decorate_history(jsonb) to authenticated;

create or replace function public.event_crm_history(
 p_kind text default 'organization',p_query text default '',p_sort text default 'name',
 p_limit integer default 20,p_offset integer default 0,p_record_id text default null,p_organization_id text default null)
returns jsonb language sql stable security invoker set search_path='' as $f$
 select event_crm_review_api.decorate_history(event_crm_api.read_history(p_kind,p_query,p_sort,p_limit,p_offset,p_record_id,p_organization_id));
$f$;

create or replace function public.event_crm_classification_status(
 p_batch_id text,p_kind text,p_record_id text,p_offset integer default 0,p_request_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $f$
 select event_crm_review_api.read_classification(p_batch_id,p_kind,p_record_id,p_offset,p_request_id);
$f$;
revoke all on function public.event_crm_classification_status(text,text,text,integer,uuid) from public,anon,service_role;
grant execute on function public.event_crm_classification_status(text,text,text,integer,uuid) to authenticated;
create or replace function public.event_crm_review_classification(
 p_batch_id text,p_kind text,p_record_id text,p_expected_revision integer,p_request_id uuid,
 p_classification text,p_segment text,p_reason text)
returns jsonb language sql volatile security invoker set search_path='' as $f$
 select event_crm_review_api.save_classification(p_batch_id,p_kind,p_record_id,p_expected_revision,p_request_id,p_classification,p_segment,p_reason);
$f$;
revoke all on function public.event_crm_review_classification(text,text,text,integer,uuid,text,text,text) from public,anon,service_role;
grant execute on function public.event_crm_review_classification(text,text,text,integer,uuid,text,text,text) to authenticated;
