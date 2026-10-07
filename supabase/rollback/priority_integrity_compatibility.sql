-- Emergency frontend compatibility only. Review before applying in a transaction.
-- No columns, data, revision triggers, version indexes or private receipts are removed.
-- Existing hardened link, capture and locking functions remain installed.
-- Restores legacy writes without the expected-revision guarantee; fix forward promptly.
grant insert,update on public.propostas to authenticated;
grant insert on public.solicitacoes_cotacao to anon;
create policy "Cliente pode enviar solicitacao" on public.solicitacoes_cotacao
  for insert to anon with check(status='novo' and proposta_id is null and origem='formulario');
grant execute on function public.respond_public_proposal(uuid,text,date,time,integer,text,jsonb) to anon,authenticated;
