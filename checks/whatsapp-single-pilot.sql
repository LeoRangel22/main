-- Isolated synthetic database only; no external requests or real recipient.
begin;
update auth.users set email_confirmed_at=now(),banned_until=null where email='leorangel@gmail.com';
insert into event_private.whatsapp_pilots(id,owner_id,destination,body,content_hash,approval_reference,expires_at,enabled)
select '00000000-0000-4000-8000-000000000711',id,'5521000000001','Synthetic pilot fixture; never sent',repeat('a',64),'fixture:single-pilot',now()+interval '10 minutes',true from auth.users where email='leorangel@gmail.com';
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'email',email,'role','authenticated')::text from auth.users where email='leorangel@gmail.com'),true);
set local role authenticated;
do $$ declare p jsonb; begin
 p:=public.get_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');
 if p->>'status'<>'ready' or p->>'eligible'<>'true' then raise exception 'Owner preparation failed'; end if;
 begin perform 1 from event_private.whatsapp_pilots;raise exception 'Direct table access allowed';exception when insufficient_privilege then null;end;
 p:=public.claim_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');
 if p->>'claimed'<>'true' or p#>>'{pilot,attempts}'<>'1' or p#>>'{pilot,status}'<>'claimed' then raise exception 'First claim failed'; end if;
 p:=public.claim_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');
 if p->>'claimed'<>'false' then raise exception 'Repeated claim replayed'; end if;
 begin perform public.finish_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711','accepted','synthetic-provider',true);raise exception 'Authenticated finished service claim';exception when insufficient_privilege then null;end;
end; $$;
reset role;
set local role service_role;
select public.finish_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711','uncertain',null,true);
reset role;
set local role authenticated;
do $$ declare p jsonb; begin
 p:=public.claim_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');
 if p->>'claimed'<>'false' or p#>>'{pilot,status}'<>'uncertain' then raise exception 'Uncertainty replayed';end if;
end; $$;
reset role;
do $$ begin
 begin update event_private.whatsapp_pilots set destination='5521000000002' where id='00000000-0000-4000-8000-000000000711';raise exception 'Destination changed';exception when sqlstate 'PT409' then null;end;
 begin update event_private.whatsapp_pilots set attempts=0,status='ready',claimed_at=null,finished_at=null where id='00000000-0000-4000-8000-000000000711';raise exception 'Attempt reset';exception when sqlstate 'PT409' then null;end;
 update event_private.whatsapp_pilots set enabled=false;
 begin update event_private.whatsapp_pilots set enabled=true;raise exception 'Scope reenabled';exception when sqlstate 'PT409' then null;end;
end; $$;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'email','leorangel@gmail.com','role','authenticated')::text from auth.users where email='financeiro@embaixadacarioca.com.br'),true);
set local role authenticated;
do $$ begin
 begin perform public.get_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');raise exception 'Another account read pilot';exception when insufficient_privilege then null;end;
 begin perform public.claim_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');raise exception 'Another account claimed pilot';exception when insufficient_privilege then null;end;
end; $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
 begin perform public.get_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');raise exception 'Anonymous read pilot';exception when insufficient_privilege then null;end;
 begin perform public.claim_event_whatsapp_pilot('00000000-0000-4000-8000-000000000711');raise exception 'Anonymous claimed pilot';exception when insufficient_privilege then null;end;
end; $$;
reset role;
rollback;
