-- Read-only commercial dashboard. No callbacks, delivery or commercial writes.
create function event_private.dashboard_compact(value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; pair record;
begin
  case jsonb_typeof(value)
    when 'object' then
      result='{}'::jsonb;
      for pair in select key,v from jsonb_each(value) as e(key,v) loop
        if pair.key not in ('dataUrl','data_url','base64','approval','sendReviewApproval','smartAlerts','automationReadiness','signature','approvedSignature') then
          result=result||jsonb_build_object(pair.key,event_private.dashboard_compact(pair.v));
        end if;
      end loop;
      return result;
    when 'array' then
      select coalesce(jsonb_agg(event_private.dashboard_compact(v) order by n),'[]'::jsonb) into result from jsonb_array_elements(value) with ordinality as e(v,n);
      return result;
    when 'string' then
      if left(value#>>'{}',5)='data:' then return 'null'::jsonb; end if;
      return value;
    else return value;
  end case;
end; $$;
revoke all on function event_private.dashboard_compact(jsonb) from public,anon,authenticated;

create function event_private.dashboard_proposal(p public.propostas) returns jsonb
language sql immutable set search_path='' as $$
 select (to_jsonb(p)-'snapshot'-'cliente_solicitacao')||jsonb_build_object(
  '_dashboard_summary',true,
  'cliente_solicitacao',event_private.dashboard_compact(p.cliente_solicitacao),
  'snapshot',event_private.dashboard_compact(coalesce(p.snapshot,'{}'::jsonb)-array['prices','generalTerms','proposalText','privatizationRules','sourceOverrides','sendReviewApproval'])||jsonb_build_object('_dashboard_summary',true)
 );
$$;
revoke all on function event_private.dashboard_proposal(public.propostas) from public,anon,authenticated;

create function event_private.reject_dashboard_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.snapshot->>'_dashboard_summary'='true' then
  raise exception using errcode='PT409',message='Carregue a proposta completa antes de salvar. O resumo do painel não pode substituir os detalhes.';
 end if;
 return new;
end; $$;
revoke all on function event_private.reject_dashboard_snapshot() from public,anon,authenticated;
create trigger propostas_reject_dashboard_snapshot before insert or update on public.propostas for each row execute function event_private.reject_dashboard_snapshot();

-- Whitelist relation names before constructing SQL; private and never directly callable.
create function event_private.dashboard_relation(kind text) returns regclass
language plpgsql stable set search_path='' as $$
begin
 case kind
 when 'propostas' then return 'public.propostas'::regclass;
 when 'solicitacoes_cotacao' then return 'public.solicitacoes_cotacao'::regclass;
 when 'oportunidades' then return 'public.oportunidades'::regclass;
 when 'event_messages' then return 'public.event_messages'::regclass;
 when 'event_outbox' then return 'public.event_outbox'::regclass;
 when 'event_reservations' then return 'public.event_reservations'::regclass;
 when 'event_commercial_policy' then return 'public.event_commercial_policy'::regclass;
 when 'event_provider_events' then return 'public.event_provider_events'::regclass;
 when 'active_event_handoffs' then return 'public.active_event_handoffs'::regclass;
 when 'active_event_handoff_tasks' then return 'public.active_event_handoff_tasks'::regclass;
 when 'active_event_handoff_changes' then return 'public.active_event_handoff_changes'::regclass;
 else raise exception 'Tipo de registro inválido';
 end case;
end; $$;
revoke all on function event_private.dashboard_relation(text) from public,anon,authenticated;

create function event_private.dashboard_reply_hours(value text,created timestamptz) returns double precision
language plpgsql stable set search_path='' as $$
declare replied timestamptz;
begin
 if value is null then return null; end if;
 begin replied=value::timestamptz; exception when invalid_datetime_format or datetime_field_overflow then return null; end;
 if replied<created or replied>now() then return null; end if;
 return extract(epoch from (replied-created))/3600;
end; $$;
revoke all on function event_private.dashboard_reply_hours(text,timestamptz) from public,anon,authenticated;

create function public.get_event_dashboard_manifest() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare kind text; relation regclass; descriptors jsonb; records jsonb='{}'::jsonb; views jsonb; summary jsonb;
begin
 perform event_private.require_team();
 for kind in select unnest(array['propostas','solicitacoes_cotacao','oportunidades','event_messages','event_outbox','event_reservations','event_commercial_policy','event_provider_events','active_event_handoffs','active_event_handoff_tasks','active_event_handoff_changes']) loop
  relation=event_private.dashboard_relation(kind);
  if kind='propostas' then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',revision::text) order by id),'[]'::jsonb) into descriptors from public.propostas;
  elsif kind in ('solicitacoes_cotacao','oportunidades') then
   execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''version'',updated_at::text) order by id),''[]''::jsonb) from %s',relation) into descriptors;
  else
   execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''version'',md5(to_jsonb(r)::text)) order by id),''[]''::jsonb) from %s r',relation) into descriptors;
  end if;
  records=records||jsonb_build_object(kind,descriptors);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',proposal_id,'version',md5(to_jsonb(a)::text)) order by proposal_id),'[]'::jsonb) into descriptors from public.get_event_discount_approvals() a;
 records=records||jsonb_build_object('event_discount_approvals',descriptors);
 select coalesce(jsonb_agg(to_jsonb(v) order by v.proposta_id),'[]'::jsonb) into views from (
  select proposta_id,count(*) as view_count,min(created_at) as first_view_at,max(created_at) as created_at from public.proposta_visualizacoes group by proposta_id
 ) v;
 with scoped as (
  select o.*,o.status in ('novo','em_cotacao','qualificado','lead_recebido','proposta_pronta','proposta_enviada','negociacao') and (o.data_evento is null or o.data_evento >= (now() at time zone 'America/Sao_Paulo')::date) as open_sale
  from public.oportunidades o where coalesce(o.motivo_perda,'') !~* 'teste'
 ), reply as (
  select event_private.dashboard_reply_hours(metadata->>'first_reply_sent_at',created_at) as hours from scoped
  where event_private.dashboard_reply_hours(metadata->>'first_reply_sent_at',created_at) is not null
 )
 select jsonb_build_object(
  'open',count(*) filter(where open_sale),
  'unassigned',count(*) filter(where open_sale and nullif(trim(responsavel_email),'') is null),
  'unplanned',count(*) filter(where open_sale and (nullif(trim(proxima_acao),'') is null or proxima_acao_em is null)),
  'overdue',count(*) filter(where open_sale and proxima_acao_em<now()),
  'won_30d',count(*) filter(where ganho_em>=now()-interval '30 days'),
  'lost_30d',count(*) filter(where perdido_em>=now()-interval '30 days'),
  'created_30d',count(*) filter(where created_at>=now()-interval '30 days'),
  'reply_samples',(select count(*) from reply),
  'reply_median_hours',(select percentile_cont(.5) within group(order by hours) from reply),
  'reply_p90_hours',(select percentile_cont(.9) within group(order by hours) from reply),
  'records',jsonb_build_object('proposals',(select count(*) from public.propostas),'requests',(select count(*) from public.solicitacoes_cotacao),'opportunities',(select count(*) from public.oportunidades))
 ) into summary from scoped;
 return jsonb_build_object('version',1,'generated_at',now(),'records',records,'views',views,'summary',summary,'channel_health',public.get_event_channel_health());
end; $$;
revoke all on function public.get_event_dashboard_manifest() from public,anon;
grant execute on function public.get_event_dashboard_manifest() to authenticated;

create function public.get_event_dashboard_rows(record_type text,record_ids text[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare relation regclass; result jsonb;
begin
 perform event_private.require_team();
 if record_ids is null or cardinality(record_ids) not between 1 and 80 then raise exception 'Informe entre 1 e 80 registros'; end if;
 if record_type='event_discount_approvals' then
  select coalesce(jsonb_agg(to_jsonb(a) order by proposal_id),'[]'::jsonb) into result from public.get_event_discount_approvals() a where proposal_id=any(record_ids::uuid[]);
 elsif record_type='propostas' then
  select coalesce(jsonb_agg(event_private.dashboard_proposal(p) order by id),'[]'::jsonb) into result from public.propostas p where id=any(record_ids::uuid[]);
 else
  relation=event_private.dashboard_relation(record_type);
  if record_type='event_commercial_policy' then
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by id),''[]''::jsonb) from %s r where id::text=any($1)',relation) into result using record_ids;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by id),''[]''::jsonb) from %s r where id=any($1::uuid[])',relation) into result using record_ids;
  end if;
 end if;
 return result;
end; $$;
revoke all on function public.get_event_dashboard_rows(text,text[]) from public,anon;
grant execute on function public.get_event_dashboard_rows(text,text[]) to authenticated;

-- FK access used by deletes/assignment, and owner/due access used by commercial planning.
create index if not exists commercial_settings_updated_by_idx on public.commercial_settings(updated_by) where updated_by is not null;
create index if not exists commercial_settings_history_updated_by_idx on public.commercial_settings_history(updated_by) where updated_by is not null;
create index if not exists oportunidades_responsavel_id_idx on public.oportunidades(responsavel_id) where responsavel_id is not null;
create index if not exists propostas_responsavel_id_idx on public.propostas(responsavel_id) where responsavel_id is not null;
create index if not exists solicitacoes_proposta_id_idx on public.solicitacoes_cotacao(proposta_id) where proposta_id is not null;
