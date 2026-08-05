/*
# Resume Action Review RPC

1. Purpose
   Allows the C-SHIFT reviewer who already owns an action's review claim to
   resume review of revised/supplemental evidence that the organization has
   resubmitted.  Moves selected `Submitted` evidence records to
   `Under Review`, sets `reviewed_by` and `reviewed_at`, and preserves all
   other fields.  The parent action remains `Submitted for Verification` and
   the review claim is untouched.

2. New routine
   - `resume_action_review(p_action_id uuid, p_evidence_ids uuid[])`
     RETURNS jsonb — SECURITY DEFINER, SET search_path = public.
     PUBLIC execution revoked; EXECUTE granted to authenticated only.

3. Authorization
   - Caller must be authenticated (`auth.uid()` not null).
   - Caller must pass `is_cshift_admin()` (C-SHIFT platform reviewer).
   - `action.review_claimed_by` must equal `auth.uid()`.
   - `action.review_claimed_at` must be populated.

4. Validation
   - Action must exist and be `Submitted for Verification` with
     `submitted_at` populated, `evidence_required = true`.
   - Every selected evidence record must exist, belong to the action and its
     organization, have `verification_status = 'Submitted'`, and have
     `reviewed_by IS NULL` and `reviewed_at IS NULL`.
   - Duplicate evidence IDs are normalized; at least one unique ID required.

5. Updates
   - Selected evidence: `verification_status = 'Under Review'`,
     `reviewed_by = auth.uid()`, `reviewed_at = now()`.
   - No update to `organization_actions`.
   - No `action_history` insert (action status does not change).

6. Concurrency
   - `SELECT ... FOR UPDATE` on the parent action and every selected evidence
     record.

7. Return shape
   `{ action, evidence, evidence_count, reviewer_id, resumed_at }`

8. Security notes
   - Raw Postgres error messages are never returned; the RPC raises
     `P0001` exceptions with a `TOKEN: safe message` pattern consumed by the
     TypeScript service layer.
   - Organization-side roles are rejected via `is_cshift_admin()`.
*/

CREATE OR REPLACE FUNCTION public.resume_action_review(
  p_action_id  uuid,
  p_evidence_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_action      public.organization_actions;
  v_org_id      uuid;
  v_ev_ids      uuid[];
  v_ev_row      public.action_evidence;
  v_ev_rows     public.action_evidence[];
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
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This review action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Normalize + validate evidence IDs
  IF p_evidence_ids IS NULL OR array_length(p_evidence_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one submitted evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(DISTINCT eid) INTO v_ev_ids
  FROM unnest(p_evidence_ids) AS eid
  WHERE eid IS NOT NULL;

  IF v_ev_ids IS NULL OR array_length(v_ev_ids, 1) = 0 THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one submitted evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Confirm caller is an authorized C-SHIFT reviewer
  IF NOT public.is_cshift_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to resume this review.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Load + lock the action
  SELECT * INTO v_action
  FROM public.organization_actions
  WHERE id = p_action_id
  FOR UPDATE;

  -- 6. Confirm action exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This review action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Validate action status
  IF v_action.status = 'Not Started' OR v_action.status = 'In Progress'
  OR v_action.status = 'Verified' OR v_action.status = 'Completed'
  OR v_action.status = 'Deferred' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot resume review from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'ACTION_NOT_SUBMITTED: This action has not been submitted for verification.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Revision Required' THEN
    RAISE EXCEPTION 'ACTION_NOT_RESUBMITTED: This action does not contain revised evidence ready for review.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Submitted for Verification' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot resume review from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Validate submitted_at
  IF v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid review state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Confirm the action has an existing claim
  IF v_action.review_claimed_by IS NULL THEN
    RAISE EXCEPTION 'REVIEW_NOT_CLAIMED: This action has not been claimed for review.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Confirm auth.uid() owns the claim
  IF v_action.review_claimed_by <> v_uid THEN
    RAISE EXCEPTION 'REVIEW_NOT_OWNED: You are not the assigned reviewer for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 11. Confirm review_claimed_at is populated
  IF v_action.review_claimed_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid review state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 12. Validate evidence_required
  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid review state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_action.organization_id;

  -- 13. Load + lock selected evidence records
  SELECT array_agg(e) INTO v_ev_rows
  FROM public.action_evidence e
  WHERE e.id = ANY(v_ev_ids)
  FOR UPDATE OF e;

  -- 14. Confirm every requested evidence ID exists
  IF v_ev_rows IS NULL OR array_length(v_ev_rows, 1) <> array_length(v_ev_ids, 1) THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: One or more selected evidence records could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 15-17. Validate each evidence record
  FOREACH v_ev_row IN ARRAY v_ev_rows LOOP
    IF v_ev_row.action_id <> p_action_id THEN
      RAISE EXCEPTION 'EVIDENCE_ACTION_MISMATCH: One or more selected evidence records do not belong to this action.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_ev_row.organization_id <> v_org_id THEN
      RAISE EXCEPTION 'EVIDENCE_ORGANIZATION_MISMATCH: One or more selected evidence records do not belong to this organization.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_ev_row.verification_status <> 'Submitted' THEN
      RAISE EXCEPTION 'EVIDENCE_NOT_RESUMABLE: One or more selected evidence records can no longer be resumed.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_ev_row.reviewed_by IS NOT NULL OR v_ev_row.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'EVIDENCE_REVIEW_STATE_INCONSISTENT: One or more evidence records have an invalid review state.'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 18. Update selected evidence records to Under Review
  UPDATE public.action_evidence
  SET verification_status = 'Under Review',
      reviewed_by = v_uid,
      reviewed_at = v_now
  WHERE id = ANY(v_ev_ids);

  -- 19. Return structured result
  SELECT jsonb_build_object(
    'action', to_jsonb(a),
    'evidence', COALESCE((
      SELECT jsonb_agg(e) FROM public.action_evidence e
      WHERE e.id = ANY(v_ev_ids)
    ), '[]'::jsonb),
    'evidence_count', (
      SELECT count(*) FROM public.action_evidence e
      WHERE e.id = ANY(v_ev_ids)
    ),
    'reviewer_id', v_uid,
    'resumed_at', v_now
  ) INTO v_result
  FROM public.organization_actions a
  WHERE a.id = p_action_id;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resume_action_review(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_action_review(uuid, uuid[]) TO authenticated;