-- Explicit, reviewed use of a saved tariff after its stated validity.
-- Generated with Supabase CLI 2.121.0. No business-data backfill, provider changes,
-- new public RPCs, signature changes, existing grants or commercial fingerprint changes.
-- Private provenance prevents client-authored or pre-migration JSON from becoming proof.
create table event_private.tariff_applications (
 proposal_id uuid not null references public.propostas(id) on delete cascade deferrable initially deferred,
 request_id uuid not null,
 opportunity_id uuid references public.oportunidades(id),
 proof jsonb not null check(jsonb_typeof(proof)='object'),
 originated boolean not null,
 active boolean not null default true,
 primary key(proposal_id,request_id)
);
create unique index tariff_applications_one_active on event_private.tariff_applications(proposal_id) where active;
create unique index tariff_applications_one_request on event_private.tariff_applications(request_id) where originated;
create index tariff_applications_request_lookup on event_private.tariff_applications(request_id);
alter table event_private.tariff_applications enable row level security;
revoke all on event_private.tariff_applications from public,anon,authenticated,service_role;

-- Array order and explicit JSON nulls are significant. Quantities, totals and the
-- confirmation itself are deliberately excluded; saved unit rates are not.
create function event_private.tariff_application_basis(snapshot jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(snapshot->'prices')='array'
  and jsonb_typeof(snapshot->'privatizationRules')='array'
  and jsonb_typeof(snapshot->'generalTerms')='string'
  and jsonb_typeof(snapshot->'selectedItems')='array'
  and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(snapshot->'selectedItems')='array' then snapshot->'selectedItems' else '[]' end) i where jsonb_typeof(i)<>'object')
 then jsonb_build_object('prices',snapshot->'prices','privatizationRules',snapshot->'privatizationRules',
  'generalTerms',snapshot->'generalTerms','selectedPrices',
  coalesce((select jsonb_agg(jsonb_build_object('id',i->'id','formula',i->'formula',
    'preco1h',i->'preco1h','preco2h',i->'preco2h','precoMeiaHoraExtra',i->'precoMeiaHoraExtra',
    'precoFixo',i->'precoFixo','valorAdicional',i->'valorAdicional','minimo',i->'minimo') order by ord)
   from jsonb_array_elements(case when jsonb_typeof(snapshot->'selectedItems')='array' then snapshot->'selectedItems' else '[]' end) with ordinality a(i,ord)),'[]'::jsonb)) end;
$$;
revoke all on function event_private.tariff_application_basis(jsonb) from public,anon,authenticated,service_role;

create function event_private.tariff_application_valid(p public.propostas) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from event_private.tariff_applications a
  where a.proposal_id=p.id and a.opportunity_id is not distinct from p.oportunidade_id and a.active
  and a.proof=p.snapshot#>'{event,tariffApplication}'
  and a.proof->>'proposalId'=p.id::text
  and a.proof->>'eventDate'=p.data_evento::text
  and p.snapshot#>>'{event,date}'=p.data_evento::text
  and a.proof->>'validUntil'=event_private.tariff_valid_until(p.snapshot->>'generalTerms')::text
  and p.data_evento>event_private.tariff_valid_until(p.snapshot->>'generalTerms')
  and a.proof->>'basisHash'=encode(extensions.digest(event_private.tariff_application_basis(p.snapshot)::text,'sha256'),'hex')
  and a.proof#>>'{catalog,reference}'=encode(extensions.digest((p.snapshot->'prices')::text,'sha256'),'hex'));
$$;
revoke all on function event_private.tariff_application_valid(public.propostas) from public,anon,authenticated,service_role;

create function event_private.guard_tariff_application() returns trigger
language plpgsql security definer set search_path='' as $$
declare candidate jsonb:=new.snapshot#>'{event,tariffApplication}'; prior jsonb; proof jsonb;
 basis jsonb; deadline date; request uuid; requested_version integer; verified_version integer;
 actor uuid:=auth.uid(); source public.propostas; reviewed public.propostas;
 keys text[]:=array['schema','kind','mode','requestId','eventDate','validUntil','catalogVersion','reviewedBasis'];
begin
 if tg_op='UPDATE' then prior:=old.snapshot#>'{event,tariffApplication}'; end if;
 if jsonb_typeof(candidate)='object' and candidate->>'kind'='request' then
  perform event_private.require_team();
  if not exists(select 1 from auth.users u where u.id=actor and lower(u.email)=lower(auth.jwt()->>'email')) then
   raise insufficient_privilege using message='A aplicação do tarifário exige um integrante autenticado da equipe.';
  end if;
  basis:=event_private.tariff_application_basis(new.snapshot);
  deadline:=event_private.tariff_valid_until(new.snapshot->>'generalTerms');
  if candidate->'schema' is distinct from '1'::jsonb
    or candidate->'kind' is distinct from '"request"'::jsonb
    or candidate->'mode' is distinct from '"use_current_table"'::jsonb
    or not candidate ?& keys or candidate-keys<>'{}'::jsonb
    or jsonb_typeof(candidate->'requestId') is distinct from 'string'
    or coalesce(candidate->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(candidate->'eventDate') is distinct from 'string'
    or candidate->>'eventDate' is distinct from new.data_evento::text
    or candidate->>'eventDate' is distinct from new.snapshot#>>'{event,date}'
    or jsonb_typeof(candidate->'validUntil') is distinct from 'string'
    or candidate->>'validUntil' is distinct from deadline::text
    or deadline is null or new.data_evento is null or new.data_evento<=deadline
    or basis is null or candidate->'reviewedBasis' is distinct from basis then
   raise exception using errcode='PT409',message='O tarifário ou a data mudou. Revise os valores e confirme novamente a aplicação da tabela atual.';
  end if;
  if candidate->'catalogVersion'<>'null'::jsonb then
   if jsonb_typeof(candidate->'catalogVersion') is distinct from 'number' then
    raise exception using errcode='PT409',message='Referência do tarifário inválida. Revise e confirme novamente.';
   end if;
   if (candidate->>'catalogVersion')::numeric<>trunc((candidate->>'catalogVersion')::numeric)
     or (candidate->>'catalogVersion')::numeric not between -2147483648 and 2147483647 then
    raise exception using errcode='PT409',message='Referência do tarifário inválida. Revise e confirme novamente.';
   end if;
   requested_version:=(candidate->>'catalogVersion')::numeric::integer;
  end if;
  request:=(candidate->>'requestId')::uuid;
  if tg_op='UPDATE' and prior->>'requestId'=request::text and event_private.tariff_application_valid(old) then
   reviewed:=new; reviewed.snapshot:=jsonb_set(new.snapshot,'{event,tariffApplication}',prior);
   if event_private.tariff_application_valid(reviewed) and prior->>'confirmedBy'=actor::text then
    new.snapshot:=reviewed.snapshot; return new;
   end if;
   raise exception using errcode='PT409',message='Esta confirmação já pertence à revisão anterior. Revise e confirme novamente com uma nova tentativa.';
  end if;
  -- A consumed request cannot be replayed after invalidation or in another proposal.
  if exists(select 1 from event_private.tariff_applications where request_id=request) then
   raise exception using errcode='PT409',message='Esta confirmação já foi usada. Revise e confirme novamente com uma nova tentativa.';
  end if;
  if requested_version is not null and (exists(select 1 from public.commercial_settings c where c.config_key='catalog' and c.version=requested_version and c.value=new.snapshot->'prices')
    or exists(select 1 from public.commercial_settings_history c where c.config_key='catalog' and c.version=requested_version and c.value=new.snapshot->'prices')) then verified_version:=requested_version; end if;
  proof:=jsonb_build_object('schema',1,'kind','confirmed','mode','use_current_table','requestId',request,
   'eventDate',new.data_evento::text,'validUntil',deadline::text,
   'catalog',jsonb_build_object('source',case when verified_version is null then 'proposal_snapshot' else 'shared_catalog' end,
    'version',verified_version,'reference',encode(extensions.digest((new.snapshot->'prices')::text,'sha256'),'hex')),
   'basisHash',encode(extensions.digest(basis::text,'sha256'),'hex'),
   'confirmedBy',actor,'confirmedAt',clock_timestamp(),'proposalId',new.id);
  update event_private.tariff_applications set active=false where proposal_id=new.id and active;
  begin
   insert into event_private.tariff_applications(proposal_id,request_id,opportunity_id,proof,originated)
    values(new.id,request,new.oportunidade_id,proof,true);
  exception when unique_violation then
   raise exception using errcode='PT409',message='Esta confirmação já foi usada. Revise e confirme novamente com uma nova tentativa.';
  end;
  new.snapshot:=jsonb_set(new.snapshot,'{event,tariffApplication}',proof);
  return new;
 end if;
 -- Only the exact OLD server proof survives an ordinary update, never a reintroduced
 -- historical proof. In particular, changing a date away and back does not revive it.
 if tg_op='UPDATE' and candidate=prior and event_private.tariff_application_valid(old)
   and event_private.tariff_application_valid(new) then return new; end if;
 -- A version may carry the exact active proof of its persisted predecessor in the
 -- same opportunity. Keep original actor/time, but bind proof to the new row ID.
 if tg_op='INSERT' and candidate->>'kind'='confirmed' and actor is not null
   and public.is_team_member() and exists(select 1 from auth.users u where u.id=actor and lower(u.email)=lower(auth.jwt()->>'email')) then
  select * into source from public.propostas p where p.id::text=candidate->>'proposalId'
   and p.oportunidade_id=new.oportunidade_id and p.id<>new.id
   and p.snapshot#>'{event,tariffApplication}'=candidate;
  if found and event_private.tariff_application_valid(source)
    and event_private.tariff_application_basis(source.snapshot)=event_private.tariff_application_basis(new.snapshot)
    and candidate->>'basisHash'=encode(extensions.digest(event_private.tariff_application_basis(new.snapshot)::text,'sha256'),'hex')
    and candidate#>>'{catalog,reference}'=encode(extensions.digest((new.snapshot->'prices')::text,'sha256'),'hex')
    and source.data_evento=new.data_evento and new.snapshot#>>'{event,date}'=new.data_evento::text then
   proof:=jsonb_set(candidate,'{proposalId}',to_jsonb(new.id));
   insert into event_private.tariff_applications(proposal_id,request_id,opportunity_id,proof,originated)
    values(new.id,(proof->>'requestId')::uuid,new.oportunidade_id,proof,false);
   new.snapshot:=jsonb_set(new.snapshot,'{event,tariffApplication}',proof);
   return new;
  end if;
 end if;
 update event_private.tariff_applications set active=false where proposal_id=new.id and active;
 -- Ignore forged/malformed client proof on drafts; the send guard still fails closed.
 if candidate is not null then new.snapshot:=new.snapshot#-'{event,tariffApplication}'; end if;
 return new;
end; $$;
revoke all on function event_private.guard_tariff_application() from public,anon,authenticated,service_role;
-- Existing amendment freeze runs first, revision bump remains in place, and journey
-- locks validate the final server-owned event before version promotion occurs.
create trigger event_tariff_application before insert or update on public.propostas
 for each row execute function event_private.guard_tariff_application();

-- Replace the existing implementation in place: same trigger, function OID and ACL.
create or replace function event_private.guard_send_tariff() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.propostas; deadline date;
begin
 -- Reviewed sends already hold this row lock; direct worker inserts must not race a save.
 select * into p from public.propostas where id=new.proposal_id for update;
 deadline:=event_private.tariff_valid_until(p.snapshot->>'generalTerms');
 if deadline is not null and p.data_evento>deadline and not event_private.tariff_application_valid(p) then
  raise exception 'Evento após a vigência do tarifário. Confirme expressamente a aplicação da tabela atual para esta data antes de enviar.';
 end if;
 return new;
end; $$;

-- Customer surfaces expose only quote-specific applicability, never internal actor,
-- timestamp, request identity, proposal identity, reviewed basis or provenance rows.
create function event_private.public_tariff_application(p public.propostas) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when event_private.tariff_application_valid(p) then jsonb_build_object(
  'schema',1,'kind','confirmed','mode','use_current_table',
  'eventDate',p.snapshot#>'{event,tariffApplication,eventDate}',
  'validUntil',p.snapshot#>'{event,tariffApplication,validUntil}',
  'catalog',p.snapshot#>'{event,tariffApplication,catalog}') end;
$$;
revoke all on function event_private.public_tariff_application(public.propostas) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_public_proposal(proposal_token uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, cliente_nome text, cliente_email text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, duracao numeric, subtotal numeric, taxa_servico numeric, privatizacao numeric, total numeric, status text, snapshot jsonb, cliente_resposta text, cliente_resposta_em timestamp with time zone, cliente_mensagem text, cliente_solicitacao jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with requested as (
    select p.*
    from public.propostas p
    where p.public_token = proposal_token
      and p.public_token_revoked_at is null
    limit 1
  ),
  resolved as (
    select coalesce(current_p.id, requested.id) as resolved_id
    from requested
    left join public.propostas current_p
      on current_p.oportunidade_id = requested.oportunidade_id
     and current_p.is_current = true
     and current_p.public_token_revoked_at is null
     and current_p.public_token_expires_at > now()
     and event_private.remote_proposal_is_public(current_p)
  )
  select
    p.id,
    p.created_at,
    p.cliente_nome,
    p.cliente_email,
    p.tipo_evento,
    p.data_evento,
    p.horario_evento,
    p.convidados,
    p.duracao,
    p.subtotal,
    p.taxa_servico,
    p.privatizacao,
    p.total,
    p.status,
    jsonb_strip_nulls(jsonb_build_object(
      'paymentSummary', event_private.public_payment_summary(p),
      'analyticsEntityHash', left(encode(extensions.digest('ec-events:v1:'||p.oportunidade_id::text,'sha256'),'hex'),24),
      'event', jsonb_build_object(
        'date', p.data_evento,
        'type', p.snapshot #> '{event,type}',
        'validity', p.snapshot #> '{event,validity}',
        'signalDeadlineHours', p.snapshot #> '{event,signalDeadlineHours}',
        'signalDeadlineAt', p.snapshot #> '{event,signalDeadlineAt}',
        'clientLanguage', p.snapshot #> '{event,clientLanguage}',
        'tariffApplication', event_private.public_tariff_application(p)
      ),
      'totals', jsonb_build_object(
        'subtotal', p.subtotal,
        'serviceFee', p.taxa_servico,
        'privatizationAmount', p.privatizacao,
        'total', p.total,
        'privatization', jsonb_build_object('mode', p.snapshot #> '{totals,privatization,mode}')
      ),
      'selectedItems', event_private.public_proposal_items(p.snapshot),
      'versionChanges', p.snapshot -> 'versionChanges',
      'publicOfferOptions', p.snapshot -> 'publicOfferOptions',
      'generalTerms', p.snapshot -> 'generalTerms',
      'paymentTerms', p.snapshot -> 'paymentTerms',
      'clienteResposta', p.snapshot -> 'clienteResposta',
      'versao', p.versao,
      'publicRevision', p.revision
    )) as snapshot,
    p.cliente_resposta,
    p.cliente_resposta_em,
    p.cliente_mensagem,
    p.cliente_solicitacao
  from public.propostas p
  join resolved r on r.resolved_id = p.id
  where p.public_token_revoked_at is null
    and p.public_token_expires_at > now()
    and p.publication_status <> 'draft'
    and event_private.remote_proposal_is_public(p)
  limit 1;
$function$
;


create or replace function public.get_my_event_history()
returns table(proposal_id uuid, oportunidade_id uuid, versao integer, status text, cliente_nome text, tipo_evento text, data_evento date, horario_evento time without time zone, convidados integer, total numeric, public_token uuid, snapshot jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path='' as $$
with me as (
  select lower(nullif(trim(coalesce(auth.jwt()->>'email','')),'')) as email
), visible as (
  select distinct on (coalesce(p.oportunidade_id,p.id)) p.*
  from public.propostas p,me
  where me.email is not null and lower(coalesce(p.cliente_email,''))=me.email
    and p.publication_status<>'draft' and p.public_token_revoked_at is null
    and event_private.remote_proposal_is_public(p)
  order by coalesce(p.oportunidade_id,p.id),coalesce(p.is_current,false) desc,p.versao desc nulls last,p.updated_at desc,p.id
)
select p.id,p.oportunidade_id,p.versao,p.status,p.cliente_nome,p.tipo_evento,p.data_evento,p.horario_evento,p.convidados,p.total,p.public_token,
  jsonb_strip_nulls(jsonb_build_object('client',p.snapshot->'client','event',((p.snapshot->'event')-'tariffApplication')||jsonb_build_object('tariffApplication',event_private.public_tariff_application(p)),'selectedItems',event_private.public_proposal_items(p.snapshot),'qualificacao',p.snapshot->'qualificacao','sourceRequestSnapshot',p.snapshot->'sourceRequestSnapshot')),
  p.created_at,p.updated_at
from visible p
order by coalesce(p.data_evento,p.created_at::date) desc,p.updated_at desc limit 12;
$$;
