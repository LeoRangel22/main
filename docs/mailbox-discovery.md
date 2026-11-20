# Bounded mailbox discovery and latency visibility

The mailbox worker retains its existing verified account, capture scope, indexed
search window, 24-hour overlap, 20-item processing bound and atomic SQL commit.
It additionally samples the verified Inbox through the official read-only
[`messages/view` API](https://www.zoho.com/mail/help/api/get-emails-list.html).
The existing [`messages/search` API](https://www.zoho.com/mail/help/api/get-search-emails.html)
remains the primary bounded search; its `receivedTime` parameter is an upper
bound, not a lower bound.

## Supplement and limits

- Exactly one system Inbox must be identified by the verified folders response:
  type `Inbox` plus canonical path `/Inbox`. The provider also assigns type `Inbox`
  to user-created folders, as shown in its official
  [folder-list response](https://www.zoho.com/mail/help/api/get-all-folder-details.html).
  A custom folder, localized display label, missing path or ambiguous root cannot
  substitute for the system Inbox.
- At most three pages of 100 metadata entries are read, ordered by `date`, with
  `status=all`, `threadedMails=false`, no sent/archive expansion and no unread
  filter. These parameters use the existing `ZohoMail.messages.READ` scope.
- Folder listing has no documented received-time range parameter. The worker
  applies the same activation/overlap/two-minute upper bound locally. It does not
  assume that provider date ordering guarantees received-time ordering and does
  not stop early when an old entry appears. Provider subjects/summaries are
  discarded; only the existing routing metadata enters the transient union.
- Source results are united by the exact string provider ID before the existing
  seen lookup. Conflicting folder, timestamp or sender metadata aborts the cycle.
  The union is sorted by received time before selection, preserving the existing
  cursor rule and never rewinding it.
- A saturated 300-entry supplement is reported as `inbox_tail_capped=true`. This
  is an incomplete sample and never proof that an omitted message does not exist.
  It does not claim exhaustive folder/window coverage or replace primary search.
  Messages outside that tail still depend on the existing indexed search window.
- Folder HTTP/parse/identity errors abort before cursor commit. Only the existing
  bounded idempotent GET retry applies. Content, SQL and transport are not replayed.
- The worker caps its own Mail GETs, including retries, at 26 per cycle, below
  the documented [30 API requests/minute](https://www.zoho.com/mail/help/adminconsole/rates-and-limits.html).
  Each selected response reserves capacity for header/body and their bounded GET
  retries. A shorter batch commits only its processed boundary with `hasMore`;
  unselected IDs remain pending. Discovery exhausting the budget cannot advance
  the cursor. This is not a global quota guarantee for other API consumers.
- Bodies are fetched only after the existing protected exact-send/revision route
  resolver and fresh capture checks; persistence revalidates all gates in SQL.

Different documented endpoints do not establish independent provider internals.
This supplement can mitigate omission limited to indexed search when Inbox
listing exposes the message; it cannot guarantee recovery if both sources omit
it. It does not establish a historical incident's cause without per-cycle evidence.

## Minimal telemetry

Authenticated cycles emit `mailbox_sync_completed` only after SQL commit. Its
schema-1 payload contains source/selection counts, review-reason counts and
aggregate age (`max_age_seconds`, `over_15m`, `over_1h`) for prepared replies.
Discovery fields distinguish raw listed rows, time-eligible rows, Inbox-only
IDs, union size, excluded/seen/selected counts and tail saturation. `inbox_only`
is a discovery count, not a count of new stored bodies or commercial approvals.

Failures retain the allowlisted stage/code and bounded discovery counts;
`search_complete` / `inbox_sampled` disambiguate unexecuted stages. Logs contain
only client-side completion evidence; a completed request does not certify the
provider index's completeness. They contain
no account/message/send/proposal IDs, addresses, route capabilities, subject,
content, credentials, raw cursor or per-message timestamp. The platform's normal
execution metadata can correlate a cycle log to the scheduled HTTP invocation.
Telemetry failure after commit does not turn a committed result into a replay.

## Isolated proof and production gate

The integration suite executes the actual worker/helpers against real disposable
PostgreSQL. A synthetic continuous-capture case has a sent V1 reviewed at technical
revision 2 and a later current revision 4. The exact same immutable ID/received
timestamp is available in Inbox from the beginning while search omits it. A pinned
search-only v49 entry snapshot advances the cursor without finding it; the
candidate recovers it from Inbox page 2 before search catches up. The search
fixture honors its documented upper time bound, and the folder fixture accepts no
undocumented time parameter or assumed received-time sorting. A transient GET
error, source catch-up, duplicate detection, equal-time quota-limited batches and
lost commit acknowledgement exercise retry/cursor safety. A new connection
verifies the committed exact binding with no final duplicate.
All OAuth/Vault values in this fixture are fictitious and local. No scheduler or
external provider is invoked.

No production activation, new scope or configuration change is part of this
patch. The smallest next live proof requires an approved private metadata-only
comparison of both sources for the already-known internal test ID, reporting only
listing eligibility/source and existing seen/binding evidence. It must not read a
body, commit, replay, reset a cursor or send. After approved deployment, normal
cycle counts can establish whether an Inbox-only discovery actually occurs.
Rollback restores the previous worker/discovery source without deleting receipts
or moving the existing cursor; no database migration or credential change is needed.
