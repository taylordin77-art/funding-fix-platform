/*
# Verify Organization Action RPC

1. Purpose
   Allows the C-SHIFT reviewer who owns the action's review claim to verify
   the action when the complete evidence package satisfies the V1 readiness
   rules.  Sets status = 'Verified', verified_at = now(), verified_by =
   auth.uid().  The existing action-history trigger creates exactly one
   transition row.  No score data is touched.

2. New routine
   - `verify_organization_action(p_action_id uuid)`
     RETURNS jsonb — SECURITY DEFINER, SET search_path = public.
     PUBLIC execution revoked; EXECUTE granted to authenticated only.

3. Authorization
   - Caller must be authenticated (`auth.uid()` not null).
   - Caller must pass `is_cshift_admin()`.
   - `action.review_claimed_by` must equal `auth.uid()`.
   - `action.review_claimed_at` must be populated.

4. Action eligibility
   - Action must exist, be 'Submitted for Verification', have submitted_at
     populated, review_claimed_by = auth.uid(), review_claimed_at populated,
     verified_at IS NULL, verified_by IS NULL.

5. Evidence readiness (V1 rule)
   If evidence_required = false: no evidence checks.
   If evidence_required = true:
     - approved_count >= 1
     - under_review_count = 0
     - submitted_count = 0
     - additional_info_required_count = 0
     - unresolved_revision_draft_count = 0
   An "unresolved revision draft" is a Draft evidence record with non-null
   organization_visible_notes (returned revision item).

6. Updates
   - organization_actions: status = 'Verified', verified_at = now(),
     verified_by = auth.uid().  No other columns touched.
   - action_history: created by existing trigger (one row).

7. Concurrency
   - SELECT ... FOR UPDATE on the action.

8. Return shape
   { action, evidence_summary: { approved, under_review, submitted,
     revision_required, unresolved_revision_drafts }, reviewer_id, verified_at }

9. Security notes
   - Raw Postgres error messages are never returned; the RPC raises P0001
     exceptions with a TOKEN: safe message pattern.
*/

CREATE OR REPLACE FUNCTION public.verify_organization_action(
  p_action_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_action      public.organization_actions;
  v_approved    int := 0;
  v_under_rev   int := 0;
  v_submitted   int := 0;
  v_addl_info   int := 0;
  v_unres_draft int := 0;
  v_ev_count    int := 0;
  v_result      jsonb;
  v_now         timestamptz := now();
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: Your session has expired. Please sign in again.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate action ID
  IF p_action_id IS NULL THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Confirm reviewer authority
  IF NOT public.is_cshift_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to verify this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Load + lock the action
  SELECT * INTO v_action
  FROM public.organization_actions
  WHERE id = p_action_id
  FOR UPDATE;

  -- 5. Confirm action exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Validate action status
  IF v_action.status = 'Verified' THEN
    RAISE EXCEPTION 'ACTION_ALREADY_VERIFIED: This action has already been verified.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Revision Required' THEN
    RAISE EXCEPTION 'ACTION_IN_REVISION: This action is currently awaiting organization revision.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'ACTION_NOT_SUBMITTED: This action has not been submitted for verification.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Not Started' OR v_action.status = 'In Progress'
  OR v_action.status = 'Completed' OR v_action.status = 'Deferred' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be verified from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Submitted for Verification' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be verified from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Validate submitted_at
  IF v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid review state and could not be verified.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Validate review claim
  IF v_action.review_claimed_by IS NULL THEN
    RAISE EXCEPTION 'REVIEW_NOT_CLAIMED: This action has not been claimed for review.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Validate review ownership
  IF v_action.review_claimed_by <> v_uid THEN
    RAISE EXCEPTION 'REVIEW_NOT_OWNED: You are not the assigned reviewer for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.review_claimed_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid review state and could not be verified.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Validate existing verification fields
  IF v_action.verified_at IS NOT NULL OR v_action.verified_by IS NOT NULL THEN
    RAISE EXCEPTION 'ACTION_ALREADY_VERIFIED: This action has already been verified.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 11-12. Read evidence rows and calculate counts
  SELECT
    count(*) FILTER (WHERE e.verification_status = 'Approved'),
    count(*) FILTER (WHERE e.verification_status = 'Under Review'),
    count(*) FILTER (WHERE e.verification_status = 'Submitted'),
    count(*) FILTER (WHERE e.verification_status = 'Additional Information Required'),
    count(*) FILTER (WHERE e.verification_status = 'Draft' AND e.organization_visible_notes IS NOT NULL),
    count(*)
  INTO v_approved, v_under_rev, v_submitted, v_addl_info, v_unres_draft, v_ev_count
  FROM public.action_evidence e
  WHERE e.action_id = p_action_id;

  -- 13. Validate evidence readiness
  IF v_action.evidence_required = true THEN
    IF v_ev_count = 0 THEN
      RAISE EXCEPTION 'EVIDENCE_REQUIRED: This action requires evidence before it can be verified.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_approved = 0 THEN
      RAISE EXCEPTION 'NO_APPROVED_EVIDENCE: At least one evidence record must be approved before verification.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_under_rev > 0 THEN
      RAISE EXCEPTION 'EVIDENCE_STILL_UNDER_REVIEW: All evidence must be reviewed before verification.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_submitted > 0 THEN
      RAISE EXCEPTION 'EVIDENCE_STILL_SUBMITTED: All evidence must be reviewed before verification.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_addl_info > 0 THEN
      RAISE EXCEPTION 'REVISION_ITEMS_OUTSTANDING: All revision items must be resolved before verification.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_unres_draft > 0 THEN
      RAISE EXCEPTION 'REVISION_ITEMS_OUTSTANDING: All returned revision drafts must be resolved before verification.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 14. Update action exactly once
  UPDATE public.organization_actions
  SET status = 'Verified',
      verified_at = v_now,
      verified_by = v_uid
  WHERE id = p_action_id;

  -- 15. Return verified action plus readiness summary
  SELECT jsonb_build_object(
    'action', to_jsonb(a),
    'evidence_summary', jsonb_build_object(
      'approved', v_approved,
      'under_review', v_under_rev,
      'submitted', v_submitted,
      'revision_required', v_addl_info,
      'unresolved_revision_drafts', v_unres_draft
    ),
    'reviewer_id', v_uid,
    'verified_at', v_now
  ) INTO v_result
  FROM public.organization_actions a
  WHERE a.id = p_action_id;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_organization_action(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_organization_action(uuid) TO authenticated;