# Public quote capture: unknown guests

Prepared locally only. Applying this migration, publishing the frontend, or changing production requires explicit approval after security, impact and reversal review.

## Contract and compatibility

- Draft RPC accepts absent, JSON null or blank guest input as unknown; request and opportunity both store SQL NULL. Clearing a prior draft estimate clears both. If an existing current proposal already owns commercial data, its opportunity count remains authoritative, matching the existing trigger contract. No count is manufactured or backfilled.
- Explicit malformed, fractional, non-positive or above-500 input raises SQLSTATE 22023 before any write. No clamping. Integer JSON values and integer strings 1–500 remain supported for existing callers. The public form may enforce its narrower 2–500 rule.
- Final submission requires a real positive count. Completed capture tokens return their existing identity without changing history, including stale blank retries.
- Existing RPC signatures, OIDs, owners, ACLs, security-definer/empty search path, capture advisory locks, first-touch attribution, language and metadata remain intact. No new endpoint, privilege, transport or automation is introduced.
- Only partial requests may contain a NULL count. Existing positive-count constraint remains. The request column's default 1 is removed: direct complete inserts must supply a count. Historical values, including previously inferred 1, are preserved because their meaning cannot safely be inferred retrospectively.

## Rollout

1. Review the migration, database test results and consumer NULL handling. Take/verify the standard database backup and capture function definitions/ACLs plus request/opportunity counts for operational comparison.
2. Apply `20261108095000_public_quote_unknown_guests.sql` transactionally through the approved release process, BEFORE frontend publication. DDL requires a brief exclusive table lock; schedule appropriately and use the release process's bounded lock timeout. No data rewrite/backfill is required, but CHECK validation scans existing requests.
3. Verify both RPC identities/ACLs and existing history are unchanged; exercise synthetic draft NULL → valid → final in an isolated staging environment with providers disabled. Verify no default on the request column.
4. Publish the frontend only after backend checks pass. Observe capture errors and draft/final conversion through already-approved monitoring; do not enable new outreach or transport.

## Safe reversal

- Before transaction commit, normal transaction rollback restores the prior schema/functions without data loss.
- After new unknown captures exist, the safe operational reversal is frontend rollback while KEEPING this backward-compatible backend and its nullable partial-count contract. Keep the no-invented-count frontend fix, or temporarily revert only presentation changes; restoring the old assumed-30 form would reintroduce false data.
- Do NOT restore the old RPC bodies: they fabricate 1 and clamp invalid values. Do NOT restore NOT NULL or default 1, delete unknown drafts, backfill guesses, or restore a database backup over newly captured contacts.
- If a complete schema reversal becomes necessary, pause writes via an explicitly approved operational procedure, inventory NULL partial requests, retain all captured data, and obtain a separately reviewed migration. There is deliberately no destructive SQL rollback script. A bug fix should roll forward while retaining unknown counts and historical records.

## Test boundaries

`npm run test:db` runs only against allowlisted local hosts and disposable databases. New coverage compares function identities/configuration/ACLs, table ACL/RLS and complete capture row snapshots before/after migration, then verifies anonymous execution, NULL draft values in both records, clearing estimates, invalid inputs without writes, final count requirement, positive legacy callers, first attribution/language/metadata, immutable retries the storage constraint, normal notification/sync triggers via a no-network HTTP recorder, and pre-commit transactional reversal. A real two-session test verifies an unknown draft racing final submission keeps one capture and first attribution. Existing database suite covers other capture flows and concurrency.

Platform-test adapters mock Supabase auth, Vault, cron and HTTP. These checks do not prove production JWT validation, scheduled jobs, external delivery, real production migration timing or a production backup restore.
