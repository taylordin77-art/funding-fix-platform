/*
# Review Claim: Add action-level claim columns + claim_action_for_review RPC

## Purpose
Adds two nullable columns to organization_actions for review ownership:
  - review_claimed_by uuid (FK -> auth.users, ON DELETE SET NULL)
  - review_claimed_at timestamptz

Adds one SECURITY DEFINER RPC `claim_action_for_review` that atomically:
  1. Validates the caller is a C-SHIFT platform admin (the only reviewer role
     that currently exists — profiles.role = 'admin').
  2. Locks the action (FOR UPDATE).
  3. Validates action status = 'Submitted for Verification'.
  4. Validates submitted_at is populated.
  5. Validates evidence_required = true.
  6. Checks current claim ownership.
  7. Locks all Submitted evidence rows for the action (FOR UPDATE).
  8. Confirms at least one Submitted evidence record exists.
  9. Confirms no evidence in the package is already Under Review by another
     reviewer (package consistency).
  10. Sets review_claimed_by = auth.uid(), review_claimed_at = now().
  11. Transitions all Submitted evidence to Under Review with
      reviewed_by = auth.uid(), reviewed_at = now().
  12. Returns JSONB: { action, evidence, evidence_count, reviewer_id, claimed_at }.

Action status does NOT change. No action_history row is created.

## Approach
- ADDITIVE ONLY. Two nullable columns, one FK, one index, one RPC.
- No existing columns, constraints, triggers, or RLS policies modified.
- SECURITY DEFINER + SET search_path = public.
- Revoke PUBLIC; grant EXECUTE only to authenticated.

## Reviewer authorization
Only profiles.role = 'admin' (C-SHIFT platform admin) may claim reviews.
No dedicated reviewer role exists in the current schema. Organization-side
roles (owner, executive_director, administrator, staff, board_member,
consultant, viewer) may NOT claim reviews. This is enforced independently
inside the RPC via is_cshift_admin().

## Error tokens (P0001 with leading token)
NOT_AUTHENTICATED | ACTION_NOT_FOUND | NOT_AUTHORIZED | ACTION_NOT_SUBMITTED |
ACTION_ALREADY_CLAIMED | ACTION_ALREADY_CLAIMED_BY_YOU | NO_SUBMITTED_EVIDENCE |
EVIDENCE_PACKAGE_INCONSISTENT | INVALID_ACTION_STATUS | ACTION_STATE_INCONSISTENT |
UNEXPECTED_ERROR
*/

-- ============================================================
-- Add review claim columns
-- ============================================================
ALTER TABLE public.organization_actions
  ADD COLUMN IF NOT EXISTS review_claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_claimed_at timestamptz;

-- Index for review-queue filtering (unclaimed submitted actions)
CREATE INDEX IF NOT EXISTS idx_org_actions_review_claim
  ON public.organization_actions (review_claimed_by)
  WHERE review_claimed_by IS NULL;

-- ============================================================
-- claim_action_for_review RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_action_for_review(
  p_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_action    public.organization_actions;
  v_evidence  public.action_evidence[];
  v_ev_row    public.action_evidence;
  v_has_submitted boolean := FALSE;
  v_has_under_review boolean := FALSE;
  v_result    jsonb;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to claim a review.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate action ID
  IF p_action_id IS NULL THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This review action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Confirm caller is an authorized C-SHIFT reviewer
  IF NOT public.is_cshift_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to claim reviews.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Load + lock the action
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  -- 5. Confirm action exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This review action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Validate action status
  IF v_action.status = 'Not Started' OR v_action.status = 'In Progress'
     OR v_action.status = 'Revision Required' OR v_action.status = 'Verified'
     OR v_action.status = 'Completed' OR v_action.status = 'Deferred' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be claimed from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'ACTION_NOT_SUBMITTED: This action has not been submitted for verification.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Submitted for Verification' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be claimed from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Validate submitted_at
  IF v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid workflow state and cannot be claimed.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Validate evidence_required
  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid workflow state and cannot be claimed.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Check current claim ownership
  IF v_action.review_claimed_by IS NOT NULL THEN
    IF v_action.review_claimed_by = v_uid THEN
      RAISE EXCEPTION 'ACTION_ALREADY_CLAIMED_BY_YOU: You have already claimed this action.'
        USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'ACTION_ALREADY_CLAIMED: This action has already been claimed by another reviewer.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 10. Load + lock all Submitted and Under Review evidence rows for this action
  SELECT array_agg(e) INTO v_evidence
  FROM public.action_evidence e
  WHERE e.action_id = p_action_id
    AND (e.verification_status = 'Submitted' OR e.verification_status = 'Under Review')
  FOR UPDATE OF e;

  -- 11. Confirm at least one Submitted evidence record exists
  -- 12. Confirm no evidence is already Under Review (package consistency)
  IF v_evidence IS NOT NULL THEN
    FOREACH v_ev_row IN ARRAY v_evidence LOOP
      IF v_ev_row.verification_status = 'Submitted' THEN
        v_has_submitted := TRUE;
      ELSIF v_ev_row.verification_status = 'Under Review' THEN
        v_has_under_review := TRUE;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_has_submitted THEN
    RAISE EXCEPTION 'NO_SUBMITTED_EVIDENCE: This action does not contain submitted evidence to review.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_has_under_review THEN
    RAISE EXCEPTION 'EVIDENCE_PACKAGE_INCONSISTENT: The submitted evidence package is in an inconsistent review state.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 13. Assign the review claim
  UPDATE public.organization_actions
    SET review_claimed_by = v_uid,
        review_claimed_at = now()
    WHERE id = p_action_id;

  -- 14. Transition Submitted evidence to Under Review
  UPDATE public.action_evidence
    SET verification_status = 'Under Review',
        reviewed_by = v_uid,
        reviewed_at = now()
    WHERE action_id = p_action_id
      AND verification_status = 'Submitted';

  -- 15. Return structured result
  SELECT jsonb_build_object(
    'action', to_jsonb(a),
    'evidence', COALESCE((
      SELECT jsonb_agg(e) FROM public.action_evidence e
      WHERE e.action_id = p_action_id AND e.verification_status = 'Under Review'
    ), '[]'::jsonb),
    'evidence_count', (
      SELECT count(*) FROM public.action_evidence e
      WHERE e.action_id = p_action_id AND e.verification_status = 'Under Review'
    ),
    'reviewer_id', v_uid,
    'claimed_at', a.review_claimed_at
  ) INTO v_result
  FROM public.organization_actions a
  WHERE a.id = p_action_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_action_for_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_action_for_review(uuid) TO authenticated;
