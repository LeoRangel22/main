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

This boundary accepts **metadata-v2 only**, with no v1 conversion. The private
worker reads the accepted pilot's existing `content_hash` and `provider_id`
from `event_private.whatsapp_pilots` after the existing owner/Master check. It
does not recompute a hash from a pasted body, phone or client-supplied value.

The server-bound fetch dependency receives exactly `{scope, contentHash,
originalProviderId}` from that record. The Bot request uses the existing fixed
Bot endpoint and existing server-only authentication, with these exact fields:

```json
{"version":2,"action":"events_diagnostic_receipt","tenant":"embaixada_urca","scope":"<pilot UUID>","contentHash":"<existing accepted SHA-256>","originalProviderId":"<accepted provider ID>","sentAt":"<current ISO timestamp>","credential":"<existing server-only credential>"}
```

No credential is stored in this module or returned to a browser. This PR still
does not supply the network adapter; its final implementation must bind the
fixed destination and authenticated owner context, reject non-success results,
and never accept a browser-supplied receipt or endpoint.

The response has only `ok: true`, `version: 2`, `account:
"bot:embaixada_urca"`, `scope`, `content_hash`, `events`. `scope` must equal the
accepted pilot UUID; `content_hash` must equal that same record's 64-character
lowercase hexadecimal hash. The request's `contentHash` and response's
`content_hash` naming is intentional and must not be renamed on only one side.
The envelope itself is not authentication.

Each event has `key`, `channel: "whatsapp"`, `purpose: "event_diagnostic"`,
`kind`, `send_id`, `context_id`, `revision: 1`, `message_id`, `occurred_at`,
`captured_at`, `destination_match: true`. Both UUIDs equal the pilot. Status
events require `message_id` equal to the accepted provider ID and `signal` one
of `accepted`, `delivered`, `read`; no `reply_to_id` or `expected_reply_match`.
Inbound events require `reply_to_id` equal to that provider ID and
`expected_reply_match: true`, with no `signal`. Both attestations are strict
JSON booleans computed by the authenticated Bot from its original claim and
callback: exact destination and exact requested test response are checked there.
Neither phone nor body nor a phone hash may cross this boundary. Unknown fields,
per-event `version`, legacy versions, string booleans and mixed/foreign pages
are rejected before commit. Commercial `event_proposal` stays on its own path.
Timestamps require an ISO date/time with seconds, optional 1-6 fraction digits,
and `Z` or an explicit numeric offset. Source civil day/month/leap-year and
clock/offset ranges are checked before parsing, so impossible dates are rejected
rather than normalized into a different month. A valid timezone crossing into
another UTC day remains valid. The existing claim/capture/future time bounds
continue to apply.

Example inbound response (placeholders are synthetic):

```json
{"ok":true,"version":2,"account":"bot:embaixada_urca","scope":"<pilot UUID>","content_hash":"<existing accepted SHA-256>","events":[{"key":"<stable event key>","channel":"whatsapp","purpose":"event_diagnostic","kind":"inbound","send_id":"<pilot UUID>","context_id":"<pilot UUID>","revision":1,"message_id":"<reply ID>","reply_to_id":"<accepted provider ID>","occurred_at":"<ISO timestamp>","captured_at":"<ISO timestamp>","destination_match":true,"expected_reply_match":true}]}
```

Bot ownership classification must remain separate from export/send gate state.
A late correlated reply still belongs to Events after the send window closes.
The Bot owner must prove no generic menu/FAQ response is emitted, including when
routing/export is OFF or unavailable, while preserving stop/urgency safeguards.
`Inbox DONE` alone does not prove isolation. No Bot source is changed here.

## Persistence and error handling

Only the private worker role can reconcile receipts. The authenticated owner
reader retains the existing verified Master/ownership checks. SQL rechecks the
pilot/context/revision/content hash and strict attestations without receiving
phone/body. The receipt table stores only the original bounded metadata fields.
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
