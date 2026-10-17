-- Explicit tariff validity; never extend the price list by changing its year silently.
create function event_private.tariff_valid_until(terms text) returns date
language plpgsql immutable set search_path='' as $$
declare parts text[]; deadline date;
begin
 parts:=regexp_match(coalesce(terms,''),'(?i)VALIDADE[^\r\n]*?([0-9]{2})/([0-9]{2})/([0-9]{4})');
 if parts is null then return null;end if;
 begin deadline:=make_date(parts[3]::integer,parts[2]::integer,parts[1]::integer);exception when others then return null;end;
 return deadline;
end; $$;
revoke all on function event_private.tariff_valid_until(text) from public,anon,authenticated;
create function event_private.guard_send_tariff() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.propostas; deadline date;
begin
 select * into p from public.propostas where id=new.proposal_id;
 deadline:=event_private.tariff_valid_until(p.snapshot->>'generalTerms');
 if deadline is not null and p.data_evento>deadline then raise exception 'Evento após a vigência do tarifário. Revise as condições e salve a versão correta antes de enviar.';end if;
 return new;
end; $$;
revoke all on function event_private.guard_send_tariff() from public,anon,authenticated;
create trigger guard_send_tariff before insert on public.event_outbox for each row execute function event_private.guard_send_tariff();
