-- Fixtures sem disparar webhook: configuração temporária apenas nesta transação.
begin;
set local session_replication_role=replica;
do $$
declare token uuid:=gen_random_uuid(); second_token uuid:=gen_random_uuid(); snapshot jsonb:='{"cliente":{"nome":"Fixture captura","email":"fixture@example.test"},"evento":{"tipo":"Coquetel","data":"2099-10-10","convidados":30}}'; first_id uuid; first_opportunity uuid; next_id uuid; next_opportunity uuid; row_count integer;
begin
  select request_id,opportunity_id into first_id,first_opportunity from public.upsert_public_quote_draft(token,snapshot,'essencial');
  perform public.upsert_public_quote_draft(token,snapshot,'essencial');
  perform public.upsert_public_quote_draft(token,snapshot,'essencial');
  select count(*) into row_count from public.solicitacoes_cotacao where capture_token=token;
  assert row_count=1,'Entrada parcial repetida deve ser única';
  select request_id,opportunity_id into next_id,next_opportunity from public.submit_public_quote_request(token,snapshot);
  assert first_id=next_id and first_opportunity=next_opportunity,'Conclusão deve preservar origem';
  update public.oportunidades set status='negociacao' where id=first_opportunity;
  update public.solicitacoes_cotacao set status='proposta_enviada' where id=first_id;
  perform public.submit_public_quote_request(token,snapshot);
  perform public.submit_public_quote_request(token,snapshot);
  perform public.upsert_public_quote_draft(token,snapshot,'essencial');
  assert (select status='negociacao' from public.oportunidades where id=first_opportunity),'Reenvio tardio não regride funil';
  assert (select capture_status='complete' and status='proposta_enviada' from public.solicitacoes_cotacao where id=first_id),'Rascunho tardio não desfaz conclusão';
  select opportunity_id into next_opportunity from public.submit_public_quote_request(second_token,snapshot);
  assert next_opportunity<>first_opportunity,'Mesmo contato com outro pedido deve permanecer separado';
  assert position('pg_advisory_xact_lock' in pg_get_functiondef('public.submit_public_quote_request(uuid,jsonb)'::regprocedure))>0,'Captação concorrente deve serializar por identificador';
end $$;
rollback;
