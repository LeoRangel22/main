-- Seller workflow feedback, authorized by the owner on 2026-10-17.
-- Reviewed SQL source. Generate its versioned migration with Supabase CLI before rollout.
-- No proposal, payment, approval decision, reservation or message is rewritten here.
-- Ordinary proposals retain seller preview and reviewed sending, without manager queue.
update event_private.proposal_approval_policy set enabled=false where id;

-- The verified Events account may INSERT/validate a new signal after explicit bank attestation.
-- Finance retains payment corrections/removals, balance validation and the existing under-50% exception.
create or replace function event_private.journey_signal_operator() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
  and lower(u.email) in ('eventos@embaixadacarioca.com.br','financeiro@embaixadacarioca.com.br','leorangel@gmail.com'));
$$;
revoke all on function event_private.journey_signal_operator() from public,anon,authenticated;

create or replace function event_private.guard_journey_proposal() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb:='{}'; key text; value jsonb; paid numeric; actor_email text; original public.propostas;
  booked text[]:=array['confirmado','pagamento_final','planejamento','evento_proximo','pos_venda'];
begin
 -- Trusted maintenance has no end-user claims. User-facing writes do not get this exemption.
 if auth.uid() is null and session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null then return new; end if;
 if tg_op='UPDATE' then
  new.journey_booked_locked:=old.journey_booked_locked or old.status=any(booked) or new.status=any(booked);
  new.journey_commercial_locked:=old.journey_commercial_locked or old.journey_booked_locked or old.publication_status='sent' or old.status=any(booked)
    or exists(select 1 from public.event_outbox b where b.proposal_id=old.id and b.status in ('sending','accepted','uncertain'))
    or exists(select 1 from event_private.proposal_public_baseline b where b.proposal_id=old.id);
  prior:=old.snapshot;
  if new.journey_commercial_locked and event_private.journey_commercial_value(old) is distinct from event_private.journey_commercial_value(new) then
   raise exception using errcode='PT409',message='O conteúdo liberado deve ser preservado. Crie uma nova versão ou rascunho de aditivo, sem sobrescrever o acordo.';
  end if;
  if old.is_current and (old.journey_booked_locked or old.status=any(booked)) and not new.is_current then
   raise exception using errcode='PT409',message='O acordo confirmado não pode ser substituído por um rascunho. O aditivo exige aprovação e aceite próprios.';
  end if;
 end if;
 if new.is_current and new.oportunidade_id is not null then
  select * into original from public.propostas p where p.oportunidade_id=new.oportunidade_id and p.is_current
    and p.id<>new.id and (p.journey_booked_locked or p.status=any(booked)) for update;
  if found then raise exception using errcode='PT409',message='Preserve o evento confirmado. Salve a alteração como rascunho de aditivo, sem promover ou alterar a operação.'; end if;
 end if;
 if tg_op='INSERT' then
  new.journey_booked_locked:=new.status=any(booked);
  new.journey_commercial_locked:=new.publication_status='sent' or new.journey_booked_locked;
 end if;
 if new.snapshot ? 'amendmentOf' and (new.is_current or new.publication_status<>'draft' or new.status=any(booked)
    or nullif(new.snapshot->'pagamentoSinal','null'::jsonb) is not null or nullif(new.snapshot->'pagamentoRestante','null'::jsonb) is not null) then
  raise exception using errcode='PT409',message='Aditivo em rascunho não pode confirmar venda, pagamento, envio ou operação. Preserve o acordo atual.';
 end if;
 for key in select unnest(array['pagamentoSinal','pagamentoRestante']) loop
  value:=nullif(new.snapshot->key,'null'::jsonb);
  if nullif(prior->key,'null'::jsonb) is distinct from value then
   if not event_private.journey_financial_operator() then
    if key<>'pagamentoSinal' or not event_private.journey_signal_operator()
      or jsonb_typeof(value) is distinct from 'object'
      or value->'bankConferido' is distinct from 'true'::jsonb
      or (nullif(prior->key,'null'::jsonb) is not null
        and coalesce((prior#>>'{pagamentoSinal,validacaoPendente}')::boolean,false)=false
        and nullif(prior#>>'{pagamentoSinal,validadoPor}','') is not null) then
     raise insufficient_privilege using message='Eventos pode registrar um novo sinal após conferir o crédito no banco. Correções e remoções de pagamentos validados e pagamento restante exigem Financeiro ou gestor.';
    end if;
    if coalesce(value->>'data','') !~ '^\d{4}-\d{2}-\d{2}$'
      or (value->>'data')::date>(now() at time zone 'America/Sao_Paulo')::date
      or jsonb_typeof(value->'bancos') is distinct from 'array'
      or jsonb_array_length(value->'bancos')=0
      or exists(select 1 from jsonb_array_elements(value->'bancos') b where jsonb_typeof(b)<>'string' or length(trim(b#>>'{}'))=0) then
     raise exception 'Informe a data efetiva e o banco do crédito conferido';
    end if;
   end if;
   if value is not null then
    if jsonb_typeof(value)<>'object' or jsonb_typeof(value->'valor')<>'number' or coalesce((value->>'valor')::numeric,0)<=0 then
     raise exception 'Informe um pagamento válido e positivo';
    end if;
    paid:=(value->>'valor')::numeric;
    if key='pagamentoSinal' and paid+0.01<new.total*0.5 then
     if not public.is_super_admin() or length(trim(coalesce(value->>'motivoExcecao','')))<10 then
      raise insufficient_privilege using message='Sinal abaixo do padrão exige autorização do gestor e justificativa da condição aprovada.';
     end if;
     value:=value||jsonb_build_object('excecaoAutorizadaPor',auth.uid(),'excecaoAutorizadaEm',now());
    end if;
    select lower(email) into actor_email from auth.users where id=auth.uid();
    value:=value||jsonb_build_object('validadoPor',auth.uid(),'validadoEmail',actor_email,'validadoEm',now(),'validacaoPendente',false);
    new.snapshot:=jsonb_set(new.snapshot,array[key],value,true);
   end if;
  end if;
 end loop;
 if new.is_current and new.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
  and (coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0
    or coalesce((new.snapshot#>>'{pagamentoSinal,validacaoPendente}')::boolean,false)) then
  raise exception 'Registre e valide o sinal antes de confirmar ou preparar a reserva';
 end if;
 return new;
end; $$;

-- Privatization negotiation has seller autonomy; general commercial discount limits stay intact.
create or replace function event_private.check_discount(p public.propostas) returns void language plpgsql security definer set search_path='' as $$
declare discount numeric; base numeric;
begin
  discount := greatest(0,-coalesce((p.snapshot#>>'{totals,adjustment}')::numeric,0));
  base := greatest(coalesce(p.subtotal,0),1);
  if (discount>1000 or discount/base>0.10) and not exists(select 1 from public.event_discount_approvals a where a.proposal_id=p.id and a.fingerprint=event_private.proposal_fingerprint(p)) then
    raise exception 'Desconto fora da alçada. Salve a proposta e solicite aprovação autenticada do gestor.';
  end if;
end; $$;
