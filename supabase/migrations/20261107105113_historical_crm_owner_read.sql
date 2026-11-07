CREATE SCHEMA IF NOT EXISTS event_crm AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA event_crm FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS event_crm.import_batches (
 id text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 source_period_start date NOT NULL,
 source_period_end date NOT NULL,
 status text NOT NULL CHECK (status IN ('preparing','validated','failed')),
 manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object')
);
CREATE TABLE IF NOT EXISTS event_crm.foundation_records (
 batch_id text NOT NULL REFERENCES event_crm.import_batches(id),
 kind text NOT NULL CHECK(kind IN ('organization','contact','case','event','action','source_index','quality_issue','event_party')),
 record_id text NOT NULL CHECK(length(record_id)>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 search_document tsvector GENERATED ALWAYS AS
 (jsonb_to_tsvector('pg_catalog.portuguese'::regconfig,payload,'["string"]'::jsonb)) STORED,
 PRIMARY KEY(batch_id,kind,record_id)
);
CREATE INDEX IF NOT EXISTS foundation_records_search_idx ON event_crm.foundation_records USING gin(search_document);
CREATE INDEX IF NOT EXISTS foundation_records_email_idx ON event_crm.foundation_records(lower(payload->>'email')) WHERE kind='contact';
CREATE INDEX IF NOT EXISTS foundation_records_event_date_idx ON event_crm.foundation_records((payload->>'event_date')) WHERE kind='event';
ALTER TABLE event_crm.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_crm.foundation_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA event_crm FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA event_crm FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA event_crm REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA event_crm IS 'Private evidence-backed CRM foundation; no API access, notifications, worker, financial or proposal mutations.';
COMMENT ON TABLE event_crm.foundation_records IS 'Versioned provisional CRM data. Counts distinguish conversation, reservation, performed event and evidence. No automatic marketing permission or current identity verification.';
CREATE OR REPLACE VIEW event_crm.validated_records WITH (security_invoker=true) AS
 SELECT r.batch_id,r.kind,r.record_id,r.payload
 FROM event_crm.foundation_records r
 JOIN event_crm.import_batches b ON b.id=r.batch_id
 WHERE b.status='validated';
REVOKE ALL ON event_crm.validated_records FROM PUBLIC, anon, authenticated, service_role;

-- Private read API. Existing historical rows and operational records are untouched.
create schema if not exists event_crm_api authorization postgres;
revoke all on schema event_crm_api from public, anon, service_role;
grant usage on schema event_crm_api to authenticated;
alter default privileges for role postgres in schema event_crm_api revoke execute on functions from public;
create index if not exists foundation_records_organization_idx
 on event_crm.foundation_records(batch_id,kind,(payload->>'organization_id'))
 where kind in ('contact','action','event_party');
create index if not exists foundation_records_party_event_idx
 on event_crm.foundation_records(batch_id,(payload->>'event_id'),(payload->>'organization_id'))
 where kind='event_party';

create or replace function event_crm_api.normalize_text(value text)
returns text language sql immutable security invoker set search_path=''
as $f$
 select translate(lower(coalesce(value,'')),
 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn');
$f$;
revoke all on function event_crm_api.normalize_text(text) from public,anon,authenticated,service_role;

create or replace function event_crm_api.matches_query(document jsonb, query text)
returns boolean language plpgsql immutable security invoker set search_path=''
as $f$
declare s text; q text; term text; digits text;
begin
 q:=event_crm_api.normalize_text(trim(coalesce(query,'')));
 if q='' then return true; end if;
 if q ~ '^[+()0-9[:space:].-]+$' then
   digits:=regexp_replace(q,'[^0-9]','','g');
   if length(digits) between 7 and 15 then
     return exists(select 1 from jsonb_path_query(document,'$.**.digits') v
       where strpos(v#>>'{}',digits)>0);
   end if;
 end if;
 s:=event_crm_api.normalize_text(document::text||' '||
   regexp_replace(document::text,'([0-9]{4})-([0-9]{2})-([0-9]{2})','\3/\2/\1','g'));
 foreach term in array regexp_split_to_array(q,'[[:space:]]+') loop
   if strpos(s,term)=0 then return false; end if;
 end loop;
 return true;
end; $f$;
revoke all on function event_crm_api.matches_query(jsonb,text) from public,anon,authenticated,service_role;

create or replace function event_crm_api.read_history(
 p_kind text default 'organization', p_query text default '', p_sort text default 'name',
 p_limit integer default 20, p_offset integer default 0,
 p_record_id text default null, p_organization_id text default null)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s'
as $f$
declare b event_crm.import_batches; target jsonb; org jsonb; result jsonb;
 total integer; items jsonb; sources jsonb; source_total integer; summary jsonb;
begin
 -- The definer stays outside exposed schemas. The public RPC is an invoker.
 -- Check the existing Master identity against the current account AND session.
 if auth.uid() is null or not public.is_super_admin() or not exists(
   select 1 from auth.users u join auth.sessions s on s.user_id=u.id
   where u.id=auth.uid()
     and lower(u.email)=lower(auth.jwt()->>'email')
     and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
     and s.id::text=auth.jwt()->>'session_id'
     and (s.not_after is null or s.not_after>now())
 ) then raise exception using errcode='42501',message='Histórico disponível somente na sessão Master ativa.'; end if;
 if p_kind is null or p_kind not in ('organization','contact','event','case','action')
   or p_sort is null or p_sort not in ('name','recent','event_date')
   or p_limit is null or p_limit not between 1 and 50
   or p_offset is null or p_offset not between 0 and 10000
   or length(coalesce(p_query,''))>200
   or length(coalesce(p_record_id,''))>160
   or length(coalesce(p_organization_id,''))>160
 then raise exception using errcode='22023',message='Parâmetros de consulta inválidos.'; end if;
 select * into b from event_crm.import_batches where status='validated'
 order by created_at desc,id desc limit 1;
 if not found then
   return jsonb_build_object('available',false,'records','[]'::jsonb,'total',0);
 end if;
 select jsonb_object_agg(kind,n) into summary from(
   select kind,count(*) n from event_crm.foundation_records where batch_id=b.id group by kind
 ) q;
 summary:=summary||jsonb_build_object('realized',(select count(*) from event_crm.foundation_records
   where batch_id=b.id and kind='event' and payload->>'phase'='realizado_comprovado'));
 result:=jsonb_build_object('available',true,'batch_id',b.id,'summary',summary,
   'period_start',b.source_period_start,'period_end',b.source_period_end,
   'validated_at',b.manifest->>'validated_at');
 if p_organization_id is not null then
   select payload into org from event_crm.foundation_records where batch_id=b.id
    and kind='organization' and record_id=p_organization_id;
   if not found then raise exception using errcode='22023',message='Conta não encontrada nesta base.'; end if;
 end if;
 if p_record_id is not null then
   select payload into target from event_crm.foundation_records where batch_id=b.id
    and kind=p_kind and record_id=p_record_id;
   if not found then raise exception using errcode='22023',message='Registro não encontrado nesta base.'; end if;
   select count(*) into source_total from event_crm.foundation_records s
    where s.batch_id=b.id and s.kind='source_index' and coalesce(target->'source_ids','[]'::jsonb) ? s.record_id;
   select coalesce(jsonb_agg(x.payload order by x.occurred_sort desc nulls last,x.id),'[]'::jsonb) into sources from(
    select s.record_id id,s.payload->>'occurred_at' as occurred_sort,
     jsonb_build_object('id',s.record_id,'kind',s.payload->>'kind','subject',s.payload->>'subject',
      'from_email',s.payload->>'from_email','occurred_at',s.payload->>'occurred_at',
      'message_id',s.payload->>'message_id','format',s.payload->>'format',
      'extraction_status',s.payload->>'extraction_status') payload
    from event_crm.foundation_records s where s.batch_id=b.id and s.kind='source_index'
     and coalesce(target->'source_ids','[]'::jsonb) ? s.record_id
    order by s.payload->>'occurred_at' desc nulls last,s.record_id
    limit p_limit offset p_offset
   ) x;
   if target->>'organization_id' is not null then
    select payload into org from event_crm.foundation_records
     where batch_id=b.id and kind='organization' and record_id=target->>'organization_id';
   end if;
   return result||jsonb_build_object('record',target,'kind',p_kind,'organization',org,
      'sources',sources,'source_total',source_total,'offset',p_offset,'limit',p_limit);
 end if;
 with base as materialized(
   select r.record_id,r.payload,o.payload organization,
    case
     when trim(coalesce(p_query,''))='' then '[]'::jsonb
     when r.kind='case' then coalesce((
       select jsonb_agg(c.payload-'source_ids')
       from jsonb_array_elements_text(coalesce(r.payload->'contact_ids','[]'::jsonb)) ids(id)
       join event_crm.foundation_records c on c.batch_id=b.id and c.kind='contact' and c.record_id=ids.id
     ),'[]'::jsonb)
     when r.kind in ('organization','event','action') then coalesce((
       select jsonb_agg(c.payload-'source_ids') from event_crm.foundation_records c
       where c.batch_id=b.id and c.kind='contact'
        and c.payload->>'organization_id'=case when r.kind='organization' then r.record_id else o.record_id end
     ),'[]'::jsonb)
     else '[]'::jsonb end contacts
   from event_crm.foundation_records r
   left join event_crm.foundation_records o on o.batch_id=b.id and o.kind='organization' and(
     o.record_id=r.payload->>'organization_id' or
     (r.kind='event' and nullif(o.payload->>'domain','') is not null and o.payload->>'domain'=r.payload->>'organization_domain')
   )
   where r.batch_id=b.id and r.kind=p_kind and(
    p_organization_id is null or
    (r.kind='organization' and r.record_id=p_organization_id) or
    (r.kind in ('contact','action') and r.payload->>'organization_id'=p_organization_id) or
    (r.kind='case' and exists(select 1 from event_crm.foundation_records c where c.batch_id=b.id
      and c.kind='contact' and c.payload->>'organization_id'=p_organization_id
      and coalesce(r.payload->'contact_ids','[]'::jsonb) ? c.record_id)) or
    (r.kind='event' and(
      (nullif(org->>'domain','') is not null and r.payload->>'organization_domain'=org->>'domain') or
      exists(select 1 from event_crm.foundation_records e where e.batch_id=b.id and e.kind='event_party'
        and e.payload->>'event_id'=r.record_id and e.payload->>'organization_id'=p_organization_id)
    ))
   )
 ), filtered as materialized(
  select record_id,payload,organization from base
  where event_crm_api.matches_query(payload||jsonb_build_object('_organization',organization,'_contacts',contacts),p_query)
 ), page as(
  select record_id,(payload-'observations'-'source_ids'-'document_ids')||
    jsonb_build_object('source_count',jsonb_array_length(coalesce(payload->'source_ids','[]'::jsonb)),
     'organization_name',organization->>'name') data,
   case when p_sort='name' then event_crm_api.normalize_text(coalesce(payload->>'name',payload->>'title',payload->>'organization','')) end name_sort,
   case when p_sort='recent' then coalesce(payload->>'last_contact_at',payload->>'last_document_at') end recent_sort,
   case when p_sort='event_date' then payload->>'event_date' end date_sort
  from filtered
  order by name_sort asc nulls last,recent_sort desc nulls last,date_sort asc nulls last,record_id
  limit p_limit offset p_offset
 )
 select (select count(*) from filtered),
  coalesce((select jsonb_agg(data order by name_sort asc nulls last,recent_sort desc nulls last,date_sort asc nulls last,record_id) from page),'[]'::jsonb)
 into total,items;
 return result||jsonb_build_object('records',items,'total',total,'kind',p_kind,
  'offset',p_offset,'limit',p_limit,'organization',org);
end; $f$;
revoke all on function event_crm_api.read_history(text,text,text,integer,integer,text,text)
 from public,anon,service_role;
grant execute on function event_crm_api.read_history(text,text,text,integer,integer,text,text) to authenticated;

create or replace function public.event_crm_history(
 p_kind text default 'organization', p_query text default '', p_sort text default 'name',
 p_limit integer default 20, p_offset integer default 0,
 p_record_id text default null, p_organization_id text default null)
returns jsonb language sql stable security invoker set search_path=''
as $f$
 select event_crm_api.read_history(p_kind,p_query,p_sort,p_limit,p_offset,p_record_id,p_organization_id);
$f$;
revoke all on function public.event_crm_history(text,text,text,integer,integer,text,text) from public,anon,service_role;
grant execute on function public.event_crm_history(text,text,text,integer,integer,text,text) to authenticated;
comment on function public.event_crm_history(text,text,text,integer,integer,text,text)
 is 'Master-only read of the latest validated historical CRM batch; no operational mutations or outbound messages.';
