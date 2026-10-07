-- Return an already committed receipt even after its link expires or is revoked.
-- New responses still require an active link and matching proposal revision.
create or replace function public.respond_public_proposal_v2(
  proposal_token uuid,action text,request_id uuid,expected_proposal_id uuid,expected_revision bigint,
  requested_date date default null,requested_time time default null,requested_guests integer default null,
  message text default null,payment_proof jsonb default null
) returns table(ok boolean,status text,cliente_resposta text) language plpgsql security definer set search_path='' as $$
declare p public.propostas; receipt event_private.public_response_requests; result_row record; result_json jsonb;
  token_digest text:=encode(extensions.digest(proposal_token::text,'sha256'),'hex');
  payload_digest text:=encode(extensions.digest(jsonb_build_array(action,expected_proposal_id,expected_revision,requested_date,requested_time,requested_guests,message,payment_proof)::text,'sha256'),'hex');
begin
  if request_id is null or expected_proposal_id is null or expected_revision is null then raise exception 'Identidade e revisao da resposta obrigatorias'; end if;
  perform pg_advisory_xact_lock(hashtextextended('event-response:'||request_id::text,71938504));
  select * into receipt from event_private.public_response_requests r where r.request_id=respond_public_proposal_v2.request_id;
  if found then
    if receipt.token_hash<>token_digest or receipt.payload_hash<>payload_digest then raise exception 'Identidade de resposta reutilizada com conteudo diferente'; end if;
    return query select (receipt.result->>'ok')::boolean,receipt.result->>'status',receipt.result->>'cliente_resposta';
    return;
  end if;
  p:=event_private.lock_public_proposal(proposal_token);
  if p.id<>expected_proposal_id or p.revision<>expected_revision then raise sqlstate 'PT409' using message='A proposta mudou. Recarregue e confira a versao atual antes de responder.'; end if;
  select * into result_row from public.respond_public_proposal(proposal_token,action,requested_date,requested_time,requested_guests,message,payment_proof);
  result_json:=to_jsonb(result_row);
  insert into event_private.public_response_requests values(request_id,p.id,token_digest,payload_digest,result_json,now());
  return query select result_row.ok,result_row.status,result_row.cliente_resposta;
end; $$;
revoke all on function public.respond_public_proposal_v2(uuid,text,uuid,uuid,bigint,date,time,integer,text,jsonb) from public;
grant execute on function public.respond_public_proposal_v2(uuid,text,uuid,uuid,bigint,date,time,integer,text,jsonb) to anon,authenticated;
