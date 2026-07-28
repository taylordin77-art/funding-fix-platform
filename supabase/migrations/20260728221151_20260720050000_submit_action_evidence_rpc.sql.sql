/*
# Submit Action Evidence RPC

## Purpose
Adds one SECURITY DEFINER RPC `submit_action_evidence` that atomically:
  1. Revalidates and locks selected Draft evidence records.
  2. Updates each selected evidence row: verification_status = 'Submitted',
     submitted_at = now().
  3. Updates the parent action: status = 'Submitted for Verification',
     submitted_at = now().
  4. The existing AFTER UPDATE trigger creates exactly one action_history row
     (previous_status = 'Awaiting Evidence', new_status = 'Submitted for
     Verification', changed_by = auth.uid()).

All evidence updates + the action update occur in a single transaction. If
any step fails, everything rolls back.

## Approach
- ADDITIVE ONLY. No tables, columns, indexes, triggers, or RLS policies
  created, altered, or dropped. Reuses existing action_evidence,
  organization_actions, organization_members, and helper functions
  (is_cshift_admin, is_org_member).
- SECURITY DEFINER + SET search_path = public.
- Revoke PUBLIC; grant EXECUTE only to authenticated.
- Returns JSONB: { action, evidence, evidence_count }.

## Authorization (same policy as existing action/evidence RPCs)
1. auth.uid() IS NOT NULL -> else NOT_AUTHENTICATED
2. Action exists (FOR UPDATE lock) -> else ACTION_NOT_FOUND
3. Caller is C-SHIFT platform admin OR active member with authorized role
   -> else NOT_AUTHORIZED.
   Authorized roles: owner, executive_director, administrator (any action);
   staff (only when assigned_user_id = auth.uid()).

## Action eligibility
- status = 'Awaiting Evidence' -> proceed
- status = 'Not Started' -> ACTION_NOT_STARTED
- status = 'In Progress' -> ACTION_NOT_READY_FOR_SUBMISSION
- status = 'Submitted for Verification' -> ACTION_ALREADY_SUBMITTED
- any other status -> INVALID_ACTION_STATUS
- evidence_required IS DISTINCT FROM TRUE -> EVIDENCE_NOT_REQUIRED
- evidence_requirements NULL/empty/whitespace -> EVIDENCE_REQUIREMENTS_MISSING

## Evidence selection validation
- p_evidence_ids not null/empty -> else NO_EVIDENCE_SELECTED
- Deduplicate IDs.
- Every requested ID must exist -> else EVIDENCE_NOT_FOUND
- Every evidence row must belong to p_action_id -> else EVIDENCE_ACTION_MISMATCH
- Every evidence row must belong to action.organization_id -> else EVIDENCE_ORGANIZATION_MISMATCH
- Every evidence row must have verification_status = 'Draft' -> else EVIDENCE_NOT_SUBMITTABLE

## Content revalidation
Each selected Draft is revalidated using the same rules as Draft creation:
- website_link: external_url required, http/https only, no unsafe schemes
- written_response: written_response required, non-empty
- other: at least one of written_response, external_url, submission_notes
- document-like: at least one of external_url, written_response, submission_notes, file_url
Invalid -> EVIDENCE_CONTENT_INVALID

## Return
JSONB: { "action": <organization_actions row>, "evidence": [<action_evidence rows>], "evidence_count": <int> }

## Error tokens (P0001 with leading token)
NOT_AUTHENTICATED | ACTION_NOT_FOUND | NOT_AUTHORIZED | ACTION_NOT_STARTED |
ACTION_NOT_READY_FOR_SUBMISSION | ACTION_ALREADY_SUBMITTED | EVIDENCE_NOT_REQUIRED |
EVIDENCE_REQUIREMENTS_MISSING | NO_EVIDENCE_SELECTED | EVIDENCE_NOT_FOUND |
EVIDENCE_ACTION_MISMATCH | EVIDENCE_ORGANIZATION_MISMATCH | EVIDENCE_NOT_SUBMITTABLE |
EVIDENCE_CONTENT_INVALID | INVALID_ACTION_STATUS | ACTION_STATE_INCONSISTENT |
UNEXPECTED_ERROR
*/

CREATE OR REPLACE FUNCTION public.submit_action_evidence(
  p_action_id uuid,
  p_evidence_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_action      public.organization_actions;
  v_org_id      uuid;
  v_membership  record;
  v_authorized  boolean := FALSE;
  v_ev_ids      uuid[];
  v_ev_row      public.action_evidence;
  v_ev_rows     public.action_evidence[];
  v_url_lower   text;
  v_has_content boolean;
  v_submitted   public.action_evidence[];
  v_result      jsonb;
  v_i           integer;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to submit evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate action ID
  IF p_action_id IS NULL THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validate evidence IDs
  IF p_evidence_ids IS NULL OR array_length(p_evidence_ids, 1) IS NULL OR array_length(p_evidence_ids, 1) = 0 THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one Draft evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Normalize duplicates (preserve order, keep first occurrence)
  SELECT array_agg(DISTINCT id) INTO v_ev_ids FROM (SELECT unnest(p_evidence_ids) AS id) t;

  -- 5. Load + lock the action
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  -- 6. Confirm action exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_action.organization_id;

  -- 7-8. Authorization
  IF public.is_cshift_admin() THEN
    v_authorized := TRUE;
  ELSE
    SELECT organization_role INTO v_membership
      FROM public.organization_members
      WHERE organization_id = v_org_id
        AND user_id = v_uid
        AND membership_status = 'active'
      LIMIT 1;

    IF FOUND THEN
      IF v_membership.organization_role IN ('owner', 'executive_director', 'administrator') THEN
        v_authorized := TRUE;
      ELSIF v_membership.organization_role = 'staff'
            AND v_action.assigned_user_id = v_uid THEN
        v_authorized := TRUE;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to submit evidence for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Action status validation
  IF v_action.status = 'Not Started' THEN
    RAISE EXCEPTION 'ACTION_NOT_STARTED: This action must be started before evidence can be submitted.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'In Progress' THEN
    RAISE EXCEPTION 'ACTION_NOT_READY_FOR_SUBMISSION: This action is not ready for evidence submission.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Submitted for Verification' THEN
    RAISE EXCEPTION 'ACTION_ALREADY_SUBMITTED: This action has already been submitted for verification.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be submitted from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. evidence_required
  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_REQUIRED: This action does not require evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 11. evidence_requirements
  IF btrim(COALESCE(v_action.evidence_requirements, '')) = '' THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIREMENTS_MISSING: Evidence requirements have not been defined for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 12-16. Load + lock evidence rows, validate each
  FOR v_i IN 1..array_length(v_ev_ids, 1) LOOP
    SELECT * INTO v_ev_row
      FROM public.action_evidence
      WHERE id = v_ev_ids[v_i]
      FOR UPDATE;

    -- 13. Every requested ID must exist
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: One or more selected evidence records could not be found.'
        USING ERRCODE = 'P0001';
    END IF;

    -- 14. Must belong to this action
    IF v_ev_row.action_id != p_action_id THEN
      RAISE EXCEPTION 'EVIDENCE_ACTION_MISMATCH: One or more selected evidence records do not belong to this action.'
        USING ERRCODE = 'P0001';
    END IF;

    -- 15. Must belong to this organization
    IF v_ev_row.organization_id != v_org_id THEN
      RAISE EXCEPTION 'EVIDENCE_ORGANIZATION_MISMATCH: One or more selected evidence records do not belong to this organization.'
        USING ERRCODE = 'P0001';
    END IF;

    -- 16. Must be Draft
    IF v_ev_row.verification_status IS DISTINCT FROM 'Draft' THEN
      RAISE EXCEPTION 'EVIDENCE_NOT_SUBMITTABLE: One or more selected evidence records can no longer be submitted.'
        USING ERRCODE = 'P0001';
    END IF;

    -- 17. Content revalidation
    v_has_content := FALSE;
    IF v_ev_row.evidence_type = 'website_link' THEN
      IF v_ev_row.external_url IS NULL OR btrim(v_ev_row.external_url) = '' THEN
        RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
          USING ERRCODE = 'P0001';
      END IF;
      v_url_lower := lower(btrim(v_ev_row.external_url));
      IF v_url_lower LIKE 'javascript:%' OR v_url_lower LIKE 'data:%' OR v_url_lower LIKE 'file:%'
         OR v_url_lower LIKE 'vbscript:%' OR v_url_lower LIKE 'about:%' THEN
        RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
          USING ERRCODE = 'P0001';
      END IF;
      IF v_url_lower NOT LIKE 'http://%' AND v_url_lower NOT LIKE 'https://%' THEN
        RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
          USING ERRCODE = 'P0001';
      END IF;
      v_has_content := TRUE;
    ELSIF v_ev_row.evidence_type = 'written_response' THEN
      IF v_ev_row.written_response IS NULL OR btrim(v_ev_row.written_response) = '' THEN
        RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
          USING ERRCODE = 'P0001';
      END IF;
      v_has_content := TRUE;
    ELSIF v_ev_row.evidence_type = 'other' THEN
      IF (v_ev_row.written_response IS NOT NULL AND btrim(v_ev_row.written_response) != '')
         OR (v_ev_row.external_url IS NOT NULL AND btrim(v_ev_row.external_url) != '')
         OR (v_ev_row.submission_notes IS NOT NULL AND btrim(v_ev_row.submission_notes) != '') THEN
        v_has_content := TRUE;
      END IF;
    ELSE
      -- document-like types
      IF (v_ev_row.external_url IS NOT NULL AND btrim(v_ev_row.external_url) != '')
         OR (v_ev_row.written_response IS NOT NULL AND btrim(v_ev_row.written_response) != '')
         OR (v_ev_row.submission_notes IS NOT NULL AND btrim(v_ev_row.submission_notes) != '')
         OR (v_ev_row.file_url IS NOT NULL AND btrim(v_ev_row.file_url) != '') THEN
        v_has_content := TRUE;
      END IF;
    END IF;

    IF NOT v_has_content THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
        USING ERRCODE = 'P0001';
    END IF;

    v_ev_rows := v_ev_rows || v_ev_row;
  END LOOP;

  -- State-consistency guard
  IF v_action.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid workflow state and could not be submitted.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 18. Update evidence records: verification_status = 'Submitted', submitted_at = now()
  UPDATE public.action_evidence
    SET verification_status = 'Submitted',
        submitted_at = now()
    WHERE id = ANY(v_ev_ids)
    RETURNING * INTO v_submitted;

  -- 19. Update parent action: status = 'Submitted for Verification', submitted_at = now()
  -- The AFTER UPDATE trigger creates exactly one action_history row.
  UPDATE public.organization_actions
    SET status = 'Submitted for Verification',
        submitted_at = now()
    WHERE id = p_action_id;

  -- 20. Return structured result
  SELECT jsonb_build_object(
    'action', to_jsonb(a),
    'evidence', COALESCE((SELECT jsonb_agg(e) FROM public.action_evidence e WHERE e.id = ANY(v_ev_ids)), '[]'::jsonb),
    'evidence_count', array_length(v_ev_ids, 1)
  ) INTO v_result
  FROM public.organization_actions a
  WHERE a.id = p_action_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_action_evidence(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_action_evidence(uuid, uuid[]) TO authenticated;
