#!/usr/bin/env bash
set -euo pipefail
# CI's disposable PostgreSQL container only. Contains synthetic fixtures.
: "${PG_TEST_CONTAINER:?Set the isolated CI service container ID}"
docker exec "$PG_TEST_CONTAINER" pg_dump -U postgres -Fc events_test > /tmp/events-test.dump
docker exec "$PG_TEST_CONTAINER" createdb -U postgres events_restored_test
docker exec -i "$PG_TEST_CONTAINER" pg_restore -U postgres --exit-on-error -d events_restored_test < /tmp/events-test.dump
docker exec "$PG_TEST_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -d events_restored_test -c "DO \$\$ BEGIN ASSERT (SELECT count(*)>=3 FROM public.propostas), 'Restore omitted fixtures'; ASSERT (SELECT count(*)=1 FROM public.propostas WHERE snapshot->>'historyMarker'='preserve'), 'Upgrade history missing after restore'; ASSERT NOT has_table_privilege('anon','public.solicitacoes_cotacao','INSERT'), 'Restore lost privilege'; ASSERT to_regprocedure('public.save_event_proposal(uuid,jsonb,bigint,uuid)') IS NOT NULL, 'Restore lost RPC'; END \$\$;"
echo 'PASS pg_dump / pg_restore of schema, data and permissions'
