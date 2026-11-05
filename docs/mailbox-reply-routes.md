# Per-send reply routing — dormant candidate

A 256-bit random, canonical lowercase base32 capability produces a 60-octet local part on the existing Events mailbox. The authenticated team preview obtains a stable route for its immutable account/proposal/revision/recipient/content context. The final Reply-To is included in the reviewed fingerprint. Service-only binding attaches it to the claimed send and attempt before any provider call. A failure pauses the unattempted claim or requires ledger readback if the pause itself is uncertain. Nothing retries a send.

Routing is OFF unless EVENT_PROPOSAL_REPLY_ROUTES_ENABLED is exactly true. Publication does not set it. The neutral QA-COM-EMAIL-01 SMTP renderer remains unchanged. No OAuth, secret generation, extra mailbox alias, schedule or general capture is installed here.

Only an exact registered capability can authorize a body read. A recognized address is metadata, not binding. Account, expected recipient/sender, accepted ledger, attempt, immutable revision, bounded capture allowlist, message budget and window all remain required. Pending transports defer without consuming the cursor. Known conflicting RFC ancestors or multiple routes remain unresolved. Unknown routes, wrong sender, revoked/expired routes and out-of-scope sends never fall back to names or subjects.

Route provenance is server_generated_reply_to_capability. It is never asserted as a verified outbound RFC Message-ID. Possession of a route and a matching From header do not authenticate authorship; imported text cannot approve a sale, payment, discount or reservation. Messages sent from a different address require review. Duplicates retain the existing account/RFC identity and cannot mutate negotiation history.

The shared QA reader stays base-address-only; only the guarded commercial preparer opts into route metadata. A preview with no claimed/bound send is not a pending transport and cannot stall another send's cursor.

Routes have the mandatory proposal link expiry captured when prepared and an independent revocation field. Renewing the public link does not extend an old route. Historic replies remain associated with the reviewed send revision; no new revision is silently approved.

## Real evidence and remaining gate

The owner reported QA-ROTA-02 arriving in the Events mailbox at 2026-11-04 19:02:44 BRT, addressed to eventos+qa-rota-02@… . This is recipient-side feasibility evidence only. Delivered-To and authenticated API retrieval were not supplied. That probe is not an application route token. The previous neutral pilot was manually reviewed and persisted; it is not proof of automatic commercial capture.

Before activation, demonstrate the exact reviewed Reply-To survives an actual authorized outbound proposal test and its reply is retrievable through the authorized Mail API and persisted/reloaded in the correct case/revision, once. Do not resend either existing neutral test. Keep capture and routing OFF until reviewed migration/function readback, closure/rollback and the bounded real pilot are ready.

## Rollback

Close and read back capture/routing first. Preserve route, receipt and message rows. Restoring previous worker and sender source is a code rollback, not a reason to drop history, reopen contact-based ingress, replay a send, or reclassify an uncertain transport. Database changes are additive except the reviewed bound commit implementation; retain its previous source for controlled restoration while capture stays OFF.

## Isolated pre-release pilot

Keep the public routing flag false. EVENT_PROPOSAL_REPLY_ROUTE_PILOT may contain one JSON object with exactly proposal_ids (one or two distinct UUIDs), recipient (canonical lower-case email), started_at and expires_at (UTC ISO timestamps with milliseconds). The positive window must be no longer than fifteen minutes. Only a listed proposal and the exact recipient receive a route. Other proposals keep the existing base address, even after pilot expiry. Invalid policy fails closed; a selected expired or future pilot cannot silently send through the base address.

The sender rechecks the mode, exact policy and wall clock after binding, immediately before commercial HTTP transport. A detected change pauses the claim; uncertain finalization requires ledger readback and never automatic replay. The neutral SMTP fixture stays independent. Environment propagation is not transactional revocation across warm workers: use the fixed expiry as the hard deadline, close the database capture gates and revoke the test route when ending the window. Do not claim an environment update cancels an already-started transport.

This control does not send or schedule anything. Capture still needs its separate one-to-two-send allowlist, budget and bounded window. No credentials, OAuth scopes, client data, commercial minima or payment rules are changed. Real account/API delivery, reply persistence and reload remain an operational gate; do not resend earlier tests.
