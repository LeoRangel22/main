-- Future approvals only. No legacy backfill, financial mutation or reservation.
begin;
create function event_private.plan_approved_signal_followup()
returns trigger language plpgsql security definer set search_path='' as $$
declare due timestamptz; event_at timestamptz; hours integer:=48; owner_email text;
begin
 if new.cliente_resposta is distinct from 'confirmar' or new.status<>'negociacao'
 or not coalesce(new.is_current,true) or new.oportunidade_id is null then return new; end if;
 -- The existing projection refreshes the default action on every proposal
 -- update. Reassert this derived plan on every refresh, with the original due
 -- timestamp; never advance it merely because the same response was retried.
 -- A commercial response never certifies a deposit, even with an attachment.
 begin
  if new.snapshot#>>'{event,signalDeadlineHours}' ~ '^\d{1,3}$' then hours:=(new.snapshot#>>'{event,signalDeadlineHours}')::integer; end if;
  if hours not between 1 and 720 then hours:=48; end if;
  due:=nullif(new.snapshot#>>'{event,signalDeadlineAt}','')::timestamptz;
 exception when others then due:=null;
 end;
 if due is null or not isfinite(due) then due:=coalesce(new.sent_at,new.cliente_resposta_em,now())+make_interval(hours=>hours); end if;
 if new.data_evento is not null then
  event_at:=(new.data_evento+coalesce(new.horario_evento,'00:00'::time)) at time zone 'America/Sao_Paulo';
  due:=least(due,event_at);
 end if;
 select coalesce(nullif(trim(o.responsavel_email),''),nullif(trim(new.responsavel_email),''),p.default_owner)
 into owner_email from public.oportunidades o left join public.event_commercial_policy p on p.id where o.id=new.oportunidade_id;
 update public.oportunidades o set proxima_acao='Acompanhar sinal',proxima_acao_em=due,
 responsavel_email=owner_email,
 responsavel_id=(select u.id from auth.users u where lower(u.email)=lower(owner_email) limit 1),
 metadata=coalesce(o.metadata,'{}')||jsonb_build_object('next_action_source','default','signal_followup_proposal',new.id,'signal_followup_revision',new.revision,'owner_missing',owner_email is null)
 where o.id=new.oportunidade_id and (nullif(trim(o.proxima_acao),'') is null or o.metadata->>'next_action_source'='default');
 return new;
end $$;
revoke all on function event_private.plan_approved_signal_followup() from public,anon,authenticated,service_role;
create trigger zz_approved_signal_followup after insert or update on public.propostas
for each row execute function event_private.plan_approved_signal_followup();
commit;
