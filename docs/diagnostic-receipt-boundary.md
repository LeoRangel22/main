# Private diagnostic receipt boundary (draft)

This candidate prepares isolated persistence for the once-only Events diagnostic.
It does not implement Bot routing or an authenticated receipt transport adapter.
Do not enable the commercial bridge to import a diagnostic. Do not merge/deploy
this draft as though the complete integration were ready.

## Contract

The trusted worker must read an owner-authorized accepted pilot and fetch a
receipt directly from the existing authenticated Bot infrastructure. The JSON
envelope alone is not proof of origin. Never expose a service credential or an
adapter accepting pasted/browser-supplied receipts to the client.

Diagnostic events require `purpose: event_diagnostic`, revision1, identical pilot
and context UUIDs, the exact recorded destination and original provider message.
An inbound event must explicitly reference that original message and equal the
requested test reply. Commercial `event_proposal` remains on its existing path;
mixed or foreign pages fail before committing any diagnostic event.

Bot ownership classification must remain separate from export/send gate state.
A late correlated reply still belongs to Events after the send window closes.
The Bot owner must prove no generic menu/FAQ response is emitted, including when
routing/export is OFF or unavailable, while preserving stop/urgency safeguards.
`Inbox DONE` alone does not prove isolation. No Bot source is changed here.

## Persistence and error handling

Only the private worker role can reconcile receipts. The authenticated owner
reader retains the existing verified Master/ownership checks. Phone and reply
body are revalidated and discarded; the receipt table stores metadata only.
Rows are additive and duplicate event keys are idempotent; conflicting reuse
rejects the transaction. Out-of-order statuses never overwrite stronger proof.
Reply evidence does not invent a separate provider READ callback.

Raw adapter/database errors are not propagated. A failed commit is explicitly
unconfirmed and requires a read-back before another attempt; it is not reported
as proof that nothing was written. There is no automatic send or retry.

## Publication gates

Before any production application: agree the authenticated bounded Bot receipt
adapter, prove routing isolation, review the final worker delta and request
specific approval for the migration and runtime publication. Reconcile the
already-sent diagnostic; do not send a new message to obtain the same evidence.
No secrets, new users, grants of sending authority, webhook changes, schedulers
or channel activation are part of this draft.

Rollback revokes the two new RPCs and preserves receipts and send history; see
`diagnostic-pilot-receipts-rollback.sql`. Production migration is not run by PR CI.
