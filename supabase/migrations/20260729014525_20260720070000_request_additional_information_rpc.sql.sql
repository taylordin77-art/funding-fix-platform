/*
# Request Additional Information: reviewer decision RPC

## Purpose
Allows the C-SHIFT reviewer who owns a review claim to request additional
information from the organization for selected Under Review evidence records.

Transitions:
  - Selected evidence: Under Review -> Additional Information Required
  - Parent action: Submitted for Verification -> Revision Required

The existing `record_action_status_change` trigger fires on the action status
change and creates exactly one `action_history` row automatically. No manual
history insert is needed.

## Approach
- ADDITIVE ONLY. One RPC, no schema changes.
- SECURITY DEFINER + SET search_path = public.
- Revoke PUBLIC; grant EXECUTE only to authenticated.
- Atomic: all evidence updates + action update in one transaction.
- Concurrency-safe: SELECT ... FOR UPDATE on action + evidence rows.

## Reviewer authorization
Only the reviewer who owns the claim (action.review_claimed_by = auth.uid())
may request additional information. is_cshift_admin() confirms platform role;
the claim ownership check confirms the specific reviewer.

## Error tokens (P0001 with leading token)
NOT_AUTHENTICATED | ACTION_NOT_FOUND | NOT_AUTHORIZED | ACTION_NOT_SUBMITTED |
REVIEW_NOT_CLAIMED | REVIEW_NOT_OWNED | ACTION_ALREADY_RETURNED_FOR_REVISION |
NO_EVIDENCE_SELECTED | EVIDENCE_NOT_FOUND | EVIDENCE_ACTION_MISMATCH |
EVIDENCE_ORGANIZATION_MISMATCH | EVIDENCE_NOT_UNDER_REVIEW |
EVIDENCE_REVIEWER_MISMATCH | ORGANIZATION_NOTES_REQUIRED | INVALID_ACTION_STATUS |
ACTION_STATE_INCONSISTENT | UNEXPECTED_ERROR
*/

CREATE OR REPLACE FUNCTION public.request_additional_information(
  p_action_id uuid,
  p_evidence_ids uuid[],
  p_organization_visible_notes text,
  p_reviewer_notes text DEFAULT null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_action      public.organization_actions;
  v_evidence    public.action_evidence[];
  v_ev_row      public.action_evidence;
  v_evidence_ids uuid[];
  v_org_notes   text;
  v_rev_notes   text;
  v_ev_count    integer;
  v_result      jsonb;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to perform this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate action ID
  IF p_action_id IS NULL THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This review action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validate and normalize evidence IDs
  IF p_evidence_ids IS NULL OR array_length(p_evidence_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one Under Review evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Deduplicate evidence IDs
  SELECT array_agg(DISTINCT eid) INTO v_evidence_ids
  FROM unnest(p_evidence_ids) AS eid
  WHERE eid IS NOT NULL;

  IF v_evidence_ids IS NULL OR array_length(v_evidence_ids, 1) = 0 THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one Under Review evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate organization-visible notes
  v_org_notes := btrim(coalesce(p_organization_visible_notes, ''));
  IF v_org_notes = '' THEN
    RAISE EXCEPTION 'ORGANIZATION_NOTES_REQUIRED: Provide clear instructions explaining what the organization needs to revise.'
      USING ERRCODE = 'P0001';
  END IF;
  IF length(v_org_notes) > 10000 THEN
    RAISE EXCEPTION 'ORGANIZATION_NOTES_REQUIRED: Provide clear instructions explaining what the organization needs to revise.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Normalize optional reviewer notes
  v_rev_notes := btrim(coalesce(p_reviewer_notes, ''));
  IF v_rev_notes = '' THEN
    v_rev_notes := NULL;
  END IF;

  -- 6. Confirm caller is an authorized C-SHIFT reviewer
  IF NOT public.is_cshift_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to make this review decision.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Load + lock the action
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  -- 8. Confirm action exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This review action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Validate action status
  IF v_action.status = 'Not Started' OR v_action.status = 'In Progress'
     OR v_action.status = 'Verified' OR v_action.status = 'Completed'
     OR v_action.status = 'Deferred' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be returned for revision from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'ACTION_NOT_SUBMITTED: This action has not been submitted for review.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Revision Required' THEN
    RAISE EXCEPTION 'ACTION_ALREADY_RETURNED_FOR_REVISION: This action has already been returned to the organization for revision.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Submitted for Verification' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be returned for revision from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate lifecycle fields
  IF v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This review has an invalid workflow state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This review has an invalid workflow state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Confirm the review is claimed
  IF v_action.review_claimed_by IS NULL THEN
    RAISE EXCEPTION 'REVIEW_NOT_CLAIMED: This action has not been claimed for review.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.review_claimed_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This review has an invalid workflow state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 11. Confirm auth.uid() owns the claim
  IF v_action.review_claimed_by != v_uid THEN
    RAISE EXCEPTION 'REVIEW_NOT_OWNED: You are not the assigned reviewer for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 12. Load + lock all selected evidence records
  SELECT array_agg(e) INTO v_evidence
  FROM public.action_evidence e
  WHERE e.id = ANY(v_evidence_ids)
  FOR UPDATE OF e;

  -- 13. Confirm all requested evidence IDs exist
  IF v_evidence IS NULL OR array_length(v_evidence, 1) != array_length(v_evidence_ids, 1) THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: One or more selected evidence records could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 14. Confirm action and organization ownership + status + reviewer
  FOREACH v_ev_row IN ARRAY v_evidence LOOP
    IF v_ev_row.action_id != p_action_id THEN
      RAISE EXCEPTION 'EVIDENCE_ACTION_MISMATCH: One or more selected evidence records do not belong to this action.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_ev_row.organization_id != v_action.organization_id THEN
      RAISE EXCEPTION 'EVIDENCE_ORGANIZATION_MISMATCH: One or more selected evidence records do not belong to this organization.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_ev_row.verification_status != 'Under Review' THEN
      RAISE EXCEPTION 'EVIDENCE_NOT_UNDER_REVIEW: One or more selected evidence records are no longer Under Review.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_ev_row.reviewed_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'EVIDENCE_REVIEWER_MISMATCH: One or more selected evidence records are assigned to another reviewer.'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 17. Update selected evidence records
  UPDATE public.action_evidence
    SET verification_status = 'Additional Information Required',
        organization_visible_notes = v_org_notes,
        reviewer_notes = v_rev_notes
    WHERE id = ANY(v_evidence_ids);

  -- 18. Update the parent action (triggers record_action_status_change)
  UPDATE public.organization_actions
    SET status = 'Revision Required'
    WHERE id = p_action_id;

  -- 19. Return structured result
  SELECT jsonb_build_object(
    'action', to_jsonb(a),
    'evidence', COALESCE((
      SELECT jsonb_agg(e) FROM public.action_evidence e
      WHERE e.id = ANY(v_evidence_ids)
    ), '[]'::jsonb),
    'evidence_count', array_length(v_evidence_ids, 1),
    'reviewer_id', v_uid,
    'organization_visible_notes', v_org_notes
  ) INTO v_result
  FROM public.organization_actions a
  WHERE a.id = p_action_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_additional_information(uuid, uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_additional_information(uuid, uuid[], text, text) TO authenticated;
