-- Correct only derived cohort observations, never commercial agreements.
-- The already-installed historical migration remains immutable. Its two
-- observation sources are reconciled here before this release is published.
-- An applied amendment removes amendmentOf, so both markers must be considered.
delete from event_private.proposal_preparation_evidence e
using public.propostas p
where p.id=e.proposal_id and (
 p.snapshot ?| array['amendmentOf','appliedAmendment']
 or (e.source='approval_snapshot' and exists(
  select 1 from public.event_proposal_approvals a
  where a.id=e.source_id and a.proposal_id=p.id
   and coalesce(a.proposal_snapshot->'snapshot','{}'::jsonb) ?| array['amendmentOf','appliedAmendment']
 ))
);
-- Ongoing capture already rejects both markers in final_review_edges.
-- Reapplying this correction is harmless; legitimate original observations stay.
