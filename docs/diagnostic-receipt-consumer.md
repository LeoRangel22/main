# Authenticated diagnostic receipt reconciliation

This candidate adds a reconciliation branch to the existing `event-whatsapp-pilot`
Edge Function, keeping JWT verification and the existing getUser/Master checks.
It is not a new endpoint, send action, webhook, grant or credential.

An existing authenticated client can request the following body; no other fields
are accepted. This operation reads the bounded Bot receipt **and writes receipt
metadata in Events**. It is not a pure status query and must not be polled or
automatically retried after an unconfirmed commit.

```json
{"action":"reconcileReceipt","pilotId":"11111111-1111-4111-8111-111111111111"}
```

The UUID above is synthetic. The private deployment configuration pins the one
already accepted pilot. The browser cannot supply a Bot URL, credential, hash,
raw receipt, phone, body or attestation. Legacy pilot input stays on its existing
separate path; reconciliation never calls claim/dispatch/finish.

## Context and source

The existing new owner-bound `get_event_whatsapp_pilot_receipt(uuid)` reader adds
only `context{id,status,attempts,provider_id,content_hash,claimed_at,network_attempted}`.
Its signature, owner/Master guard and grants stay unchanged. This avoids using
the old pilot reader that returns phone/body and omits the claim timestamp.
The Edge removes context from its final response. No phone/body is fetched.

The server-bound fetch uses the fixed existing Bot deployment and existing
server-only send credential for `events_diagnostic_receipt`; it does not activate
or execute sending. `botPostJson` retains the existing safe redirect behavior:
credentials stay in the initial POST, never in a redirected GET or the browser.
Request/response metadata-v2 rules are specified in diagnostic-receipt-boundary.md.
The response cap is262144characters; timeout is at most15seconds and no longer
than the remaining configured window.

Invalid origin/envelope/correlation does not call the writer. The owner context
and window are rechecked before the service writer. SQL controls transaction
atomicity, duplicate/conflict handling and original-ledger immutability.

## Closed by default and bounded configuration

The following server configuration is required; absence or incompatibility
keeps the branch closed. No values are provisioned by this candidate:

- `EVENT_BOT_DIAGNOSTIC_READ_ENABLED=true`.
- `EVENT_BOT_DIAGNOSTIC_PILOT_ID` equals the one authorized pilot UUID.
- `EVENT_BOT_DIAGNOSTIC_READ_STARTED_AT` and
  `EVENT_BOT_DIAGNOSTIC_READ_EXPIRES_AT` are canonical UTC timestamps with three
  fraction digits. Start is not future, end is future, duration is at most15min.
- Existing `EVENT_BOT_SEND_ENABLED=false` and `EVENT_BOT_PILOT_ENABLED=false`
  must both be explicit. They are never changed by this code.
- Existing `EVENT_BOT_SEND_URL` must equal the fixed approved deployment, and
  `EVENT_BOT_SEND_SECRET` must already exist. No key is generated or replaced.

Bot's separate `EVENTS_DIAGNOSTIC_RECEIPT_READ_ENABLED` gate is controlled by its
owner. It is not enabled here and has no independently verified TTL/pilot pin.
The Events consumer supplies those restrictions. A supported manual closure
path and its authorization must be confirmed before opening that Bot gate.
The existing private credential could read metadata of other accepted diagnostic
claims while the Bot gate is enabled; do not describe the global Bot flag as a
one-pilot or one-use capability by itself.

The requested operational run is one reconciliation, followed by verified
closure. Configuration alone is not a distributed one-use counter; repeated
authorized calls within the window remain possible and SQL is idempotent.
There is no automatic retry or scheduler.

## Results, uncertainty and closure

The Edge returns only `ok`, `willSend:false`, `inserted` and a whitelisted receipt
summary: pilot ID, accepted send status/attempts, delivery/read/reply timestamps
and their distinct booleans. Reply evidence does not invent delivery or READ.

A commit failure returns `DIAGNOSTIC_RECEIPT_COMMIT_UNCONFIRMED` and
`writeMayHaveOccurred:true`; a failed post-commit reader additionally reports
`persistenceConfirmed:true`. Consult existing metadata before another action.
Raw provider/database errors, credentials and context are never returned/logged.

Closing or expiry blocks new fetch/commit starts at the recheck boundaries; it
cannot atomically cancel a database RPC already in flight. Preserve and reconcile
such results rather than assuming rollback. Bot's gate must also be closed and
verified manually. No message, grant, commercial cursor or send ledger is reset.

Deploy order: verified Bot containment/adapter with gates OFF; reviewed receipts
migration; reviewed Edge with read configuration closed; specifically approved
temporary read configuration; reconcile the already existing receipt; close and
verify. Roll back by closing the reader/consumer, restoring only the affected
Edge and revoking the two receipt RPCs while preserving table/history. Never
undo Bot containment merely to disable diagnostic export.
