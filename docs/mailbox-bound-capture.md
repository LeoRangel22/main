# Bounded proposal email capture (dormant foundation)

The worker authenticates its existing server job key and verifies the configured Zoho account. It resolves the complete RFC reply chain to an accepted immutable send/attempt/proposal revision before requesting a body. Names, subjects, contact matches and opaque Zepto IDs are not RFC provenance.

Capture additionally requires 1–2 explicit send IDs, a live window of at most 15 minutes and a message limit. The config returns the used count; the worker processes only the remaining budget and checks the config again before each body request. SQL revalidates the full chain and gates using the wall clock after lock waits and before committing the cursor. The queue does not schedule requests for expired scopes. No schedule or activation is installed here.

The transaction records exact proposal revision, RFC identity, aliases, metadata review markers, seen IDs and cursor together. Duplicate RFC aliases do not produce another message or follow-up update. Responses to a historic revision remain historic and never approve the latest revision, payments, discounts or reservations. The generic mailbox ingress and legacy commit cannot bypass the bound path; other providers retain their existing implementation through a narrow wrapper.

## Remaining operational prerequisites

- The header mapping table starts empty and has no public registrar. An authenticated, reviewed provenance population path is required before capture can work. Do not fabricate mappings from email_reference, request_id, subject or customer name.
- Metadata-only review remains private. Its operational review path has not been implemented here.
- No new OAuth, credential, authenticated provider query, send, production migration, gate change or pilot is part of this PR.
- Capture configuration requires a separately authorized operator procedure with readback and close. No new authenticated-role configuration RPC or permission was added.
- The limit bounds persisted messages and each worker's budget; it is not a global reservation of concurrent external reads. Already in-flight HTTP requests are not cancelled by flag changes or expiry. TTL denies further work but does not physically turn flags OFF.
- API-origin authentication and From/thread correlation do not cryptographically authenticate the author. Imported mail is untrusted content, never an approval action.

## Apply and rollback boundaries

Only after approval of the exact commit: keep capture OFF, apply the named migration, verify ACL/RLS/function identities and deploy only the composed mailbox worker and its helpers. Preserve all other functions, Bot transport, credentials and channels. Do not enable capture until account connection, provenance, review operation and the scoped operator are ready.

For rollback, first close and read back capture. Preserve all receipts, messages and history. Reverting code must not reactivate legacy contact-based ingestion; do not drop the new tables/column or reopen the old RPC as an automatic rollback. A reverse source patch is not a destructive database rollback plan.

## Validation

Synthetic tests only: account schema, header/correlation parsing, remaining budget, scope changes before body, duplicates, uncertain commit, complete-chain ambiguity and expiry after real lock contention. The existing full database suite exercises fresh install, upgrades, concurrent journeys and compatibility rollback. Managed Auth/HTTP/cron are local test adapters, not real-provider evidence.
