# Approval frontend hotfix — 2026-10-13

This release fixes the returning-browser asset URLs and the disabled-policy email quick-reply path without changing the production database or Edge Functions.

## Behavior

- The seven affected entry pages version the changed application assets as `20261013-approval-hotfix`.
- When remote approval is enabled, a link-bearing email quick reply still requests the manager's approval.
- When the server confirms approval is disabled, the selected quick reply is shown for explicit review and opened as the exact mailto draft. It is not wrapped in the initial-proposal email template.
- Unknown/unavailable approval policy fails closed. Canceling review does not open or send an email.
- Opening a draft is logged as `opened`, never as a confirmed send.
- The direct proposal sender preserves explicitly supplied message/subject; proposal defaults remain available when neither is supplied.

## Verification

The dedicated refinement workflow `38451925617` passed the full application/browser suite before committing the source. Added coverage includes seven asset-version checks, four real-function routing tests (enabled, disabled, unknown policy, cancellation), and a production-mode browser fixture verifying preview/dispatch subject and message. The standard pull-request checks and public-release verifier remain mandatory before calling this release published.

## Explicit non-deliveries

This release does not install expired-request renewal or the stalled-approval watchdog. Those remain in draft PR #50: its production migration was blocked by the tool safety layer, and additional review findings remain. No alternate migration path was attempted. There was no real manager-channel probe or customer test send. Manager approval remains required under the existing active server policy.
