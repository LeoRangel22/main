-- LOCAL CANDIDATE ONLY. Production execution and the two new RPC EXECUTE
-- privileges require explicit approval. No configuration, grants to the Bot,
-- cron, data backfill, new table or provider call is performed here.

create function event_private.whatsapp_prepared_id(fingerprint text) returns uuid
language sql immutable strict set search_path='' as $$
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
 from (select encode(extensions.digest('events-preparation-v1:'||fingerprint,'sha256'),'hex') h) x;
$$;
revoke all on function event_private.whatsapp_prepared_id(text) from public,anon,authenticated,service_role;

create function event_private.whatsapp_canonical(destination text) returns boolean
language plpgsql immutable set search_path='' as $$
declare normalized text:=destination; local_number text; shorter text; area integer;
begin
 if destination is null or destination !~ '^[1-9][0-9]{10,14}$' or (length(destination)=11 and left(destination,1)<>'1') then return false; end if;
 if left(destination,3)='521' and length(destination)=13 then normalized:='52'||substr(destination,4);
 elsif left(destination,2)='54' and length(destination)>=11 then
  local_number:=substr(destination,3); if left(local_number,1)='9' then local_number:=substr(local_number,2); end if;
  for area in 2..4 loop
   if length(local_number)>10 and substr(local_number,area+1,2)='15' then
    shorter:=left(local_number,area)||substr(local_number,area+3);
    if length(shorter) between 8 and 10 then local_number:=shorter;exit;end if;
   end if;
  end loop;
  normalized:='549'||local_number;
 elsif left(destination,2)='55' and length(destination)=12 then normalized:=left(destination,4)||'9'||substr(destination,5);
 end if;
 return destination=normalized;
end; $$;
revoke all on function event_private.whatsapp_canonical(text) from public,anon,authenticated,service_role;

-- Read-only, also executable inside a READ ONLY transaction. VOLATILE is
-- intentional: the claim wrapper must re-read after acquiring its row locks.
-- Definer is required only for private policy; explicit team/manager checks
-- preserve existing access boundaries, and the search path is empty.
create function public.event_whatsapp_preparation(target_proposal uuid,reviewed_revision bigint,
 send_destination text,send_body text,send_title text,reviewed_response_at timestamptz default null,
 target_approval uuid default null,prepared_expires_at timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p public.propostas;b public.event_outbox;a public.event_proposal_approvals;c event_private.proposal_approval_policy;
 fp text;context_fingerprint text;response_at timestamptz;can_claim boolean;expiry timestamptz:=prepared_expires_at;
begin
 perform event_private.require_team();
 select * into p from public.propostas where id=target_proposal;
 if p.id is null or reviewed_revision is null or p.revision is distinct from reviewed_revision then raise exception 'A proposta mudou. Revise a versão atual';end if;
 if p.is_current is distinct from true or coalesce(p.publication_status,'') not in ('ready','sent') or p.status in ('cancelado','pos_venda')
  or p.data_evento is null or p.data_evento < (now() at time zone 'America/Sao_Paulo')::date or p.oportunidade_id is null then raise exception 'Preparação exige versão atual e evento em aberto';end if;
 if not event_private.whatsapp_canonical(send_destination) or send_body is null or length(send_body) not between 10 and 6000
  or send_body<>trim(send_body) or send_title is null or length(trim(send_title)) not between 1 and 200 then raise exception 'Confira mensagem e destinatário canônico';end if;
 -- Use wall-clock time: a claim may have waited behind an editor transaction.
 if p.public_token is null or p.public_token_revoked_at is not null or expiry is null or expiry<=clock_timestamp() or expiry>clock_timestamp()+interval '24 hours'
  or date_trunc('milliseconds',expiry)<>expiry or (p.public_token_expires_at is not null and expiry>p.public_token_expires_at) then raise exception 'Prazo da preparação ou link inválido';end if;
 select ultima_resposta_cliente_em into response_at from public.oportunidades where id=p.oportunidade_id;
 if not found or response_at is distinct from reviewed_response_at then raise exception 'Há resposta nova. Atualize e revise antes de preparar';end if;
 perform event_private.assert_money(p);perform event_private.check_discount(p);
 select * into c from event_private.proposal_approval_policy where id;
 if not found then raise exception 'Política de aprovação indisponível';end if;
 if c.enabled then
  if auth.uid() is distinct from c.approver_id or not public.is_super_admin() then raise exception using errcode='42501',message='Preparação exige o gestor designado';end if;
  select * into a from public.event_proposal_approvals where id=target_approval;
  if a.id is null or a.proposal_id<>p.id or a.status<>'approved' or a.decided_by is distinct from auth.uid() or a.approver_id is distinct from c.approver_id
   or a.revision is distinct from p.revision or a.proposal_fingerprint is distinct from event_private.proposal_fingerprint(p) or a.expires_at<=clock_timestamp()
   or expiry>a.expires_at then raise exception 'Aprovação ausente, alterada ou expirada';end if;
  if a.content->>'channel' is distinct from 'whatsapp' or a.content->>'destination' is distinct from send_destination
   or a.content->>'body' is distinct from send_body or a.content->>'title' is distinct from send_title or a.content->>'contentHash' is not null
   or (a.content->>'reviewedResponseAt')::timestamptz is distinct from reviewed_response_at then raise exception 'Conteúdo diverge da aprovação';end if;
 elsif target_approval is not null then raise exception 'A política de aprovação mudou';
 end if;
 fp:=encode(extensions.digest(event_private.proposal_fingerprint(p)||'|whatsapp|'||lower(trim(send_destination))||'|'||send_body||'|'||send_title,'sha256'),'hex');
 select * into b from public.event_outbox where fingerprint=fp;
 if b.id is not null and (b.proposal_id<>p.id or b.channel<>'whatsapp' or b.destination<>send_destination or b.body<>send_body) then raise exception 'Identidade de envio divergente';end if;
 if a.send_id is not null and a.send_id is distinct from b.id then raise exception 'A aprovação já pertence a outro envio';end if;
 can_claim:=b.id is null or (b.status in ('failed','paused') and coalesce(b.delivery_status,'failed')='failed'
  and (b.status<>'paused' or (b.provider_id is null and b.provider_reference is null and b.engagement is null and b.delivery_status is null and b.delivery_updated_at is null and b.delivery_checked_at is null)));
 context_fingerprint:=encode(extensions.digest(jsonb_build_object('outbox',fp,'revision',p.revision,'token',p.public_token,
  'tokenExpiry',p.public_token_expires_at,'response',response_at,'approval',target_approval,'approvalHash',a.review_hash,'expiry',expiry)::text,'sha256'),'hex');
 return jsonb_build_object('id',coalesce(b.id,event_private.whatsapp_prepared_id(fp)),'contextId',p.id,'revision',p.revision,
  'purpose','event_proposal','destination',send_destination,'body',send_body,'expiresAt',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'fingerprint',context_fingerprint,'existingStatus',b.status,'claimable',can_claim,'attempted',false);
end; $$;
revoke all on function public.event_whatsapp_preparation(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz) from public,anon,authenticated,service_role;
-- PROPOSED NEW PERMISSION: read-only preparation for existing authenticated team.
grant execute on function public.event_whatsapp_preparation(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz) to authenticated;

-- Explicit dispatch only. Preserve lock order proposal -> opportunity -> approval
-- -> outbox. A stale read plan never authorizes a changed context.
create function public.begin_event_prepared_whatsapp_send(target_proposal uuid,reviewed_revision bigint,
 send_destination text,send_body text,send_title text,reviewed_response_at timestamptz,target_approval uuid,
 prepared_expires_at timestamptz,expected_send_id uuid,expected_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas;plan jsonb;result jsonb;
begin
 perform event_private.require_team();
 select * into p from public.propostas where id=target_proposal for update;
 perform 1 from public.oportunidades where id=p.oportunidade_id for update;
 if target_approval is not null then perform 1 from public.event_proposal_approvals where id=target_approval for update;end if;
 plan:=public.event_whatsapp_preparation(target_proposal,reviewed_revision,send_destination,send_body,send_title,reviewed_response_at,target_approval,prepared_expires_at);
 if (plan->>'id')::uuid is distinct from expected_send_id or plan->>'fingerprint' is distinct from expected_fingerprint then raise exception 'Preparação alterada. Revise novamente';end if;
 if target_approval is not null then
  result:=public.begin_event_approved_send(target_approval,reviewed_revision,'whatsapp',send_destination,send_body,send_title,null,reviewed_response_at);
 else
  result:=public.begin_event_send_reviewed(target_proposal,reviewed_revision,'whatsapp',send_destination,send_body,send_title,reviewed_response_at);
 end if;
 if (result#>>'{send,id}')::uuid is distinct from expected_send_id then raise exception 'Identidade preparada mudou';end if;
 return result;
end; $$;
revoke all on function public.begin_event_prepared_whatsapp_send(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;
-- PROPOSED NEW PERMISSION: explicit claim, retaining all existing review gates.
grant execute on function public.begin_event_prepared_whatsapp_send(uuid,bigint,text,text,text,timestamptz,uuid,timestamptz,uuid,text) to authenticated;

-- Preserve the existing function identity and ACL. Only new WhatsApp IDs change.
create or replace function public.begin_event_send(target_proposal uuid,send_channel text,send_destination text,send_body text,send_title text,reviewed_response_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.propostas; b public.event_outbox; fp text; response_at timestamptz;
begin
  perform event_private.require_team();

  select * into p from public.propostas where id=target_proposal for update;
  if not found then raise exception 'Proposta não encontrada'; end if;
  if not coalesce(p.is_current,false) or p.publication_status='draft' or p.status in ('cancelado','pos_venda') or p.data_evento < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Envio exige versão atual e evento em aberto'; end if;
  if length(trim(send_body)) not between 1 and 12000 or length(trim(send_destination)) not between 5 and 320 then raise exception 'Confira mensagem e destinatário'; end if;
  if p.oportunidade_id is null then raise exception 'Salve a proposta e vincule a oportunidade antes de enviar'; end if;
  select ultima_resposta_cliente_em into response_at from public.oportunidades where id=p.oportunidade_id for update;
  if response_at is distinct from reviewed_response_at then raise exception 'Há resposta nova. Atualize e revise antes de enviar'; end if;
  perform event_private.assert_money(p);
  perform event_private.check_discount(p);
  fp:=encode(extensions.digest(event_private.proposal_fingerprint(p)||'|'||send_channel||'|'||lower(trim(send_destination))||'|'||send_body||'|'||send_title,'sha256'),'hex');
  insert into public.event_outbox(id,proposal_id,opportunity_id,fingerprint,channel,destination,body,approved_by,reviewed_revision,reviewed_fingerprint)
    values(case when send_channel='whatsapp' then event_private.whatsapp_prepared_id(fp) else gen_random_uuid() end,p.id,p.oportunidade_id,fp,send_channel,trim(send_destination),send_body,auth.uid(),p.revision,event_private.public_proposal_fingerprint(p)) on conflict(fingerprint) do nothing returning * into b;
  if b.id is not null then return jsonb_build_object('claimed',true,'send',to_jsonb(b)); end if;
  select * into b from public.event_outbox where fingerprint=fp for update;
  if b.status in ('failed','paused') and coalesce(b.delivery_status,'failed')='failed'
    and (b.status<>'paused' or (b.provider_id is null and b.provider_reference is null and b.engagement is null and b.delivery_status is null and b.delivery_updated_at is null and b.delivery_checked_at is null)) then
    update public.event_outbox set reviewed_revision=p.revision,reviewed_fingerprint=event_private.public_proposal_fingerprint(p),status='sending',provider_id=null,provider_reference=null,delivery_status=null,delivery_updated_at=null,delivery_checked_at=null,engagement=null,attempts=attempts+1,approved_by=auth.uid(),updated_at=now() where id=b.id returning * into b;
    return jsonb_build_object('claimed',true,'send',to_jsonb(b));
  end if;
  return jsonb_build_object('claimed',false,'send',to_jsonb(b));
end; $$;


