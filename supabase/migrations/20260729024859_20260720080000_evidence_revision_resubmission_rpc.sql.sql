/*
# Evidence Revision and Resubmission: 3 additive RPCs

## Purpose
Implements the organization-side correction loop for actions returned by a
reviewer via `request_additional_information`:

  1. `revise_action_evidence_draft` — edit a returned evidence record
     (Additional Information Required -> Draft), clearing review metadata.
  2. `create_revision_evidence_draft` — add a supplemental Draft while the
     action is in Revision Required.
  3. `resubmit_revised_action_evidence` — submit corrected Draft evidence,
     moving the action back to Submitted for Verification.

All three are SECURITY DEFINER, SET search_path = public, authenticated-only,
atomic, row-locking, and safe from cross-organization access. PUBLIC is
revoked; EXECUTE granted only to authenticated.

Authorization mirrors the existing evidence RPCs:
  - C-SHIFT admin always authorized
  - active owner / executive_director / administrator authorized
  - active staff authorized only if assigned to the action
  - all others rejected

The existing `record_action_status_change` trigger fires on the action status
transition (Revision Required -> Submitted for Verification) and creates exactly
one action_history row. No manual history insert. No history on evidence-only
updates.
*/

-- ============================================================
-- 1. revise_action_evidence_draft
-- ============================================================

CREATE OR REPLACE FUNCTION public.revise_action_evidence_draft(
  p_evidence_id uuid,
  p_evidence_type text,
  p_external_url text DEFAULT null,
  p_written_response text DEFAULT null,
  p_submission_notes text DEFAULT null,
  p_file_url text DEFAULT null
) RETURNS public.action_evidence
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_evidence    public.action_evidence;
  v_action      public.organization_actions;
  v_org_id      uuid;
  v_membership  record;
  v_authorized  boolean := FALSE;
  v_ext_url     text := NULL;
  v_written     text := NULL;
  v_notes       text := NULL;
  v_file        text := NULL;
  v_url_lower   text;
  v_has_content boolean := FALSE;
  v_updated     public.action_evidence;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to revise evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate evidence ID
  IF p_evidence_id IS NULL THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: This evidence record could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Load + lock the evidence row
  SELECT * INTO v_evidence
    FROM public.action_evidence
    WHERE id = p_evidence_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: This evidence record could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_evidence.organization_id;

  -- 4. Load + lock the parent action
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = v_evidence.action_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Organization authorization
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
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to revise evidence for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Action must be Revision Required
  IF v_action.status IS DISTINCT FROM 'Revision Required' THEN
    IF v_action.status = 'Awaiting Evidence' THEN
      RAISE EXCEPTION 'ACTION_NOT_IN_REVISION: This action is not currently awaiting revision.'
        USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'ACTION_NOT_IN_REVISION: This action is not currently awaiting revision.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Review claim fields must remain populated
  IF v_action.review_claimed_by IS NULL OR v_action.review_claimed_at IS NULL
     OR v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid revision state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_REQUIRED: This action does not require evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  IF btrim(COALESCE(v_action.evidence_requirements, '')) = '' THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIREMENTS_MISSING: Evidence requirements have not been defined for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Evidence must be Additional Information Required
  IF v_evidence.verification_status IS DISTINCT FROM 'Additional Information Required' THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_REVISION_EDITABLE: This evidence record is not available for revision.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Confirm evidence belongs to the action and organization
  IF v_evidence.action_id != v_action.id THEN
    RAISE EXCEPTION 'EVIDENCE_ACTION_MISMATCH: One or more selected evidence records do not belong to this action.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_evidence.organization_id != v_action.organization_id THEN
    RAISE EXCEPTION 'EVIDENCE_ORGANIZATION_MISMATCH: One or more selected evidence records do not belong to this organization.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 11. Evidence-type validation
  IF p_evidence_type NOT IN (
    'document','image','website_link','written_response','completed_form',
    'meeting_record','policy','budget','board_roster','board_matrix',
    'strategic_plan','logic_model','outcome_report','financial_report',
    'filing_confirmation','workshop_completion','other'
  ) THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_TYPE: Select a valid evidence type.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 12. Normalize optional strings
  v_ext_url := CASE WHEN p_external_url IS NOT NULL AND btrim(p_external_url) != '' THEN btrim(p_external_url) ELSE NULL END;
  v_written := CASE WHEN p_written_response IS NOT NULL AND btrim(p_written_response) != '' THEN p_written_response ELSE NULL END;
  v_notes   := CASE WHEN p_submission_notes IS NOT NULL AND btrim(p_submission_notes) != '' THEN p_submission_notes ELSE NULL END;
  v_file    := CASE WHEN p_file_url IS NOT NULL AND btrim(p_file_url) != '' THEN btrim(p_file_url) ELSE NULL END;

  -- Content validation per type (same rules as create/update draft)
  IF p_evidence_type = 'website_link' THEN
    IF v_ext_url IS NULL THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving.'
        USING ERRCODE = 'P0001';
    END IF;
    v_url_lower := lower(v_ext_url);
    IF v_url_lower LIKE 'javascript:%' OR v_url_lower LIKE 'data:%' OR v_url_lower LIKE 'file:%'
       OR v_url_lower LIKE 'vbscript:%' OR v_url_lower LIKE 'about:%' THEN
      RAISE EXCEPTION 'UNSAFE_EXTERNAL_URL: This type of link is not permitted.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_url_lower NOT LIKE 'http://%' AND v_url_lower NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'INVALID_EXTERNAL_URL: Enter a valid web address.'
        USING ERRCODE = 'P0001';
    END IF;
    v_has_content := TRUE;
  ELSIF p_evidence_type = 'written_response' THEN
    IF v_written IS NULL THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving.'
        USING ERRCODE = 'P0001';
    END IF;
    v_has_content := TRUE;
  ELSIF p_evidence_type = 'other' THEN
    IF v_written IS NOT NULL OR v_ext_url IS NOT NULL OR v_notes IS NOT NULL THEN
      v_has_content := TRUE;
    END IF;
  ELSE
    IF v_ext_url IS NOT NULL OR v_written IS NOT NULL OR v_notes IS NOT NULL OR v_file IS NOT NULL THEN
      v_has_content := TRUE;
    END IF;
  END IF;

  IF p_evidence_type != 'website_link' AND v_ext_url IS NOT NULL THEN
    v_url_lower := lower(v_ext_url);
    IF v_url_lower LIKE 'javascript:%' OR v_url_lower LIKE 'data:%' OR v_url_lower LIKE 'file:%'
       OR v_url_lower LIKE 'vbscript:%' OR v_url_lower LIKE 'about:%' THEN
      RAISE EXCEPTION 'UNSAFE_EXTERNAL_URL: This type of link is not permitted.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_url_lower NOT LIKE 'http://%' AND v_url_lower NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'INVALID_EXTERNAL_URL: Enter a valid web address.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NOT v_has_content THEN
    RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 13. Update evidence: return to Draft, clear review metadata, preserve instructions
  UPDATE public.action_evidence
    SET verification_status = 'Draft',
        evidence_type = p_evidence_type,
        external_url = v_ext_url,
        written_response = v_written,
        submission_notes = v_notes,
        file_url = v_file,
        submitted_at = NULL,
        reviewed_at = NULL,
        reviewed_by = NULL
    WHERE id = p_evidence_id
    RETURNING * INTO v_updated;

  -- 14. Return the revised Draft evidence row
  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.revise_action_evidence_draft(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_action_evidence_draft(uuid, text, text, text, text, text) TO authenticated;

-- ============================================================
-- 2. create_revision_evidence_draft
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_revision_evidence_draft(
  p_action_id uuid,
  p_evidence_type text,
  p_external_url text DEFAULT null,
  p_written_response text DEFAULT null,
  p_submission_notes text DEFAULT null,
  p_file_url text DEFAULT null
) RETURNS public.action_evidence
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
  v_ext_url     text := NULL;
  v_written     text := NULL;
  v_notes       text := NULL;
  v_file        text := NULL;
  v_url_lower   text;
  v_has_content boolean := FALSE;
  v_inserted    public.action_evidence;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to create evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Load + lock the action
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_action.organization_id;

  -- 3. Organization authorization
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
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to revise evidence for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Action must be Revision Required
  IF v_action.status IS DISTINCT FROM 'Revision Required' THEN
    RAISE EXCEPTION 'ACTION_NOT_IN_REVISION: This action is not currently awaiting revision.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Review claim + lifecycle fields
  IF v_action.review_claimed_by IS NULL OR v_action.review_claimed_at IS NULL
     OR v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid revision state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_REQUIRED: This action does not require evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  IF btrim(COALESCE(v_action.evidence_requirements, '')) = '' THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIREMENTS_MISSING: Evidence requirements have not been defined for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Evidence-type validation
  IF p_evidence_type NOT IN (
    'document','image','website_link','written_response','completed_form',
    'meeting_record','policy','budget','board_roster','board_matrix',
    'strategic_plan','logic_model','outcome_report','financial_report',
    'filing_confirmation','workshop_completion','other'
  ) THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_TYPE: Select a valid evidence type.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Normalize optional strings
  v_ext_url := CASE WHEN p_external_url IS NOT NULL AND btrim(p_external_url) != '' THEN btrim(p_external_url) ELSE NULL END;
  v_written := CASE WHEN p_written_response IS NOT NULL AND btrim(p_written_response) != '' THEN p_written_response ELSE NULL END;
  v_notes   := CASE WHEN p_submission_notes IS NOT NULL AND btrim(p_submission_notes) != '' THEN p_submission_notes ELSE NULL END;
  v_file    := CASE WHEN p_file_url IS NOT NULL AND btrim(p_file_url) != '' THEN btrim(p_file_url) ELSE NULL END;

  -- 8. Content validation per type
  IF p_evidence_type = 'website_link' THEN
    IF v_ext_url IS NULL THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving.'
        USING ERRCODE = 'P0001';
    END IF;
    v_url_lower := lower(v_ext_url);
    IF v_url_lower LIKE 'javascript:%' OR v_url_lower LIKE 'data:%' OR v_url_lower LIKE 'file:%'
       OR v_url_lower LIKE 'vbscript:%' OR v_url_lower LIKE 'about:%' THEN
      RAISE EXCEPTION 'UNSAFE_EXTERNAL_URL: This type of link is not permitted.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_url_lower NOT LIKE 'http://%' AND v_url_lower NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'INVALID_EXTERNAL_URL: Enter a valid web address.'
        USING ERRCODE = 'P0001';
    END IF;
    v_has_content := TRUE;
  ELSIF p_evidence_type = 'written_response' THEN
    IF v_written IS NULL THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving.'
        USING ERRCODE = 'P0001';
    END IF;
    v_has_content := TRUE;
  ELSIF p_evidence_type = 'other' THEN
    IF v_written IS NOT NULL OR v_ext_url IS NOT NULL OR v_notes IS NOT NULL THEN
      v_has_content := TRUE;
    END IF;
  ELSE
    IF v_ext_url IS NOT NULL OR v_written IS NOT NULL OR v_notes IS NOT NULL OR v_file IS NOT NULL THEN
      v_has_content := TRUE;
    END IF;
  END IF;

  IF p_evidence_type != 'website_link' AND v_ext_url IS NOT NULL THEN
    v_url_lower := lower(v_ext_url);
    IF v_url_lower LIKE 'javascript:%' OR v_url_lower LIKE 'data:%' OR v_url_lower LIKE 'file:%'
       OR v_url_lower LIKE 'vbscript:%' OR v_url_lower LIKE 'about:%' THEN
      RAISE EXCEPTION 'UNSAFE_EXTERNAL_URL: This type of link is not permitted.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_url_lower NOT LIKE 'http://%' AND v_url_lower NOT LIKE 'https://%' THEN
      RAISE EXCEPTION 'INVALID_EXTERNAL_URL: Enter a valid web address.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NOT v_has_content THEN
    RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Insert supplemental Draft
  INSERT INTO public.action_evidence (
    action_id, organization_id, submitted_by, evidence_type,
    file_url, external_url, written_response, submission_notes,
    verification_status
  ) VALUES (
    p_action_id, v_org_id, v_uid, p_evidence_type,
    v_file, v_ext_url, v_written, v_notes,
    'Draft'
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_revision_evidence_draft(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_revision_evidence_draft(uuid, text, text, text, text, text) TO authenticated;

-- ============================================================
-- 3. resubmit_revised_action_evidence
-- ============================================================

CREATE OR REPLACE FUNCTION public.resubmit_revised_action_evidence(
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
  v_returned    public.action_evidence[];
  v_url_lower   text;
  v_has_content boolean;
  v_result      jsonb;
  v_now         timestamptz := now();
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to resubmit evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate action ID
  IF p_action_id IS NULL THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validate evidence IDs
  IF p_evidence_ids IS NULL OR array_length(p_evidence_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one revised evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Normalize duplicates
  SELECT array_agg(DISTINCT eid) INTO v_ev_ids
    FROM unnest(p_evidence_ids) AS eid
    WHERE eid IS NOT NULL;

  IF v_ev_ids IS NULL OR array_length(v_ev_ids, 1) = 0 THEN
    RAISE EXCEPTION 'NO_EVIDENCE_SELECTED: Select at least one revised evidence record.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Load + lock the action
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_action.organization_id;

  -- 5. Organization authorization
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
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to revise evidence for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Action must be Revision Required
  IF v_action.status = 'Submitted for Verification' THEN
    RAISE EXCEPTION 'ACTION_ALREADY_RESUBMITTED: This action has already been resubmitted for verification.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Revision Required' THEN
    RAISE EXCEPTION 'ACTION_NOT_IN_REVISION: This action is not currently awaiting revision.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Review claim + lifecycle fields
  IF v_action.review_claimed_by IS NULL OR v_action.review_claimed_at IS NULL
     OR v_action.submitted_at IS NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid revision state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_REQUIRED: This action does not require evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  IF btrim(COALESCE(v_action.evidence_requirements, '')) = '' THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIREMENTS_MISSING: Evidence requirements have not been defined for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Load + lock ALL returned evidence (organization_visible_notes IS NOT NULL)
  SELECT array_agg(e) INTO v_returned
    FROM public.action_evidence e
    WHERE e.action_id = p_action_id
      AND e.organization_visible_notes IS NOT NULL
    FOR UPDATE OF e;

  -- 9. Check for outstanding returned evidence still in Additional Information Required
  IF v_returned IS NOT NULL THEN
    FOREACH v_ev_row IN ARRAY v_returned LOOP
      IF v_ev_row.verification_status = 'Additional Information Required' THEN
        RAISE EXCEPTION 'REVISION_ITEMS_OUTSTANDING: Complete every requested revision before resubmitting this action.'
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    -- Every returned evidence Draft must be included in the submission
    FOREACH v_ev_row IN ARRAY v_returned LOOP
      IF NOT (v_ev_row.id = ANY(v_ev_ids)) THEN
        RAISE EXCEPTION 'REQUIRED_REVISION_NOT_SELECTED: Select every revised evidence item that was returned for correction.'
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  -- 10. Load + lock selected evidence records
  SELECT array_agg(e) INTO v_ev_rows
    FROM public.action_evidence e
    WHERE e.id = ANY(v_ev_ids)
    FOR UPDATE OF e;

  -- 11. Confirm all requested evidence IDs exist
  IF v_ev_rows IS NULL OR array_length(v_ev_rows, 1) != array_length(v_ev_ids, 1) THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: One or more selected evidence records could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 12. Validate each selected evidence record
  FOREACH v_ev_row IN ARRAY v_ev_rows LOOP
    IF v_ev_row.action_id != p_action_id THEN
      RAISE EXCEPTION 'EVIDENCE_ACTION_MISMATCH: One or more selected evidence records do not belong to this action.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_ev_row.organization_id != v_org_id THEN
      RAISE EXCEPTION 'EVIDENCE_ORGANIZATION_MISMATCH: One or more selected evidence records do not belong to this organization.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_ev_row.verification_status IS DISTINCT FROM 'Draft' THEN
      RAISE EXCEPTION 'EVIDENCE_NOT_SUBMITTABLE: One or more selected evidence records cannot be resubmitted.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Content revalidation
    v_has_content := FALSE;
    IF v_ev_row.evidence_type = 'website_link' THEN
      IF v_ev_row.external_url IS NULL THEN
        RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
          USING ERRCODE = 'P0001';
      END IF;
      v_url_lower := lower(v_ev_row.external_url);
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
      IF v_ev_row.written_response IS NULL THEN
        RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
          USING ERRCODE = 'P0001';
      END IF;
      v_has_content := TRUE;
    ELSIF v_ev_row.evidence_type = 'other' THEN
      IF v_ev_row.written_response IS NOT NULL OR v_ev_row.external_url IS NOT NULL OR v_ev_row.submission_notes IS NOT NULL THEN
        v_has_content := TRUE;
      END IF;
    ELSE
      IF v_ev_row.external_url IS NOT NULL OR v_ev_row.written_response IS NOT NULL
         OR v_ev_row.submission_notes IS NOT NULL OR v_ev_row.file_url IS NOT NULL THEN
        v_has_content := TRUE;
      END IF;
    END IF;

    IF NOT v_has_content THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_INVALID: One or more selected evidence records do not contain valid evidence content.'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 13. Update selected evidence: Draft -> Submitted
  UPDATE public.action_evidence
    SET verification_status = 'Submitted',
        submitted_at = v_now
    WHERE id = ANY(v_ev_ids);

  -- 14. Update parent action: Revision Required -> Submitted for Verification
  UPDATE public.organization_actions
    SET status = 'Submitted for Verification',
        submitted_at = v_now
    WHERE id = p_action_id;

  -- 15. Return structured result
  SELECT jsonb_build_object(
    'action', to_jsonb(a),
    'evidence', COALESCE((
      SELECT jsonb_agg(e) FROM public.action_evidence e
      WHERE e.id = ANY(v_ev_ids)
    ), '[]'::jsonb),
    'evidence_count', array_length(v_ev_ids, 1),
    'reviewer_id', v_action.review_claimed_by,
    'resubmitted_at', v_now
  ) INTO v_result
  FROM public.organization_actions a
  WHERE a.id = p_action_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.resubmit_revised_action_evidence(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resubmit_revised_action_evidence(uuid, uuid[]) TO authenticated;
