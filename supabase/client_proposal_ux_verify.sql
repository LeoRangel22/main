-- Executar após client_proposal_ux.sql. Consultas somente leitura.
select p.proname, pg_get_function_arguments(p.oid) as argumentos,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_pode_executar
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'submit_public_signal_proof';

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'propostas'
  and column_name in ('public_token', 'public_token_revoked_at', 'public_token_expires_at',
    'oportunidade_id', 'is_current', 'cliente_resposta', 'cliente_solicitacao', 'snapshot', 'total', 'status')
order by column_name;
