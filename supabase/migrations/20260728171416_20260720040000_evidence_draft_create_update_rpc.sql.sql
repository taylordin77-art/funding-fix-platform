/*
# Evidence Draft Create + Update RPCs

## Purpose
Adds two SECURITY DEFINER RPCs for the C-SHIFT Evidence Draft workflow:
  - create_action_evidence_draft: inserts a new action_evidence row with
    verification_status = 'Draft'
  - update_action_evidence_draft: edits an existing Draft action_evidence row

Neither RPC changes organization_actions.status or inserts action_history.
Evidence remains in Draft status until a later ticket implements submission.

## Approach
- ADDITIVE ONLY. No tables, columns, indexes, triggers, or RLS policies
  created, altered, or dropped. Reuses existing action_evidence,
  organization_actions, organization_members, and helper functions
  (is_cshift_admin, is_org_member).
- SECURITY DEFINER + SET search_path = public.
- Revoke PUBLIC; grant EXECUTE only to authenticated.

## Authorization (same policy as start_organization_action)
1. auth.uid() IS NOT NULL -> else NOT_AUTHENTICATED
2. Action/evidence exists -> else ACTION_NOT_FOUND / EVIDENCE_NOT_FOUND
3. Caller is C-SHIFT platform admin (is_cshift_admin) OR active member of the
   action's organization with an authorized role -> else NOT_AUTHORIZED.
   Authorized roles: owner, executive_director, administrator (any action,
   including unassigned); staff (only when assigned_user_id = auth.uid()).
   Board members, consultants, viewers, inactive members, unassigned staff,
   and users from another organization are rejected.

## Action eligibility (create only)
- status = 'Awaiting Evidence' -> proceed
- status = 'Not Started' -> ACTION_NOT_STARTED
- status = 'In Progress' -> ACTION_NOT_READY_FOR_EVIDENCE
- any other status -> INVALID_ACTION_STATUS
- evidence_required IS DISTINCT FROM TRUE -> EVIDENCE_NOT_REQUIRED
- evidence_requirements NULL/empty/whitespace -> EVIDENCE_REQUIREMENTS_MISSING

## Evidence-type validation
Validates p_evidence_type against the live CHECK constraint values. Invalid
type -> INVALID_EVIDENCE_TYPE.

## Content validation (server-side, RPC is final authority)
At least one content field must be meaningful:
- website_link: external_url required; must be http/https; reject
  javascript:, data:, file:, and other unsafe schemes.
- written_response: written_response required; trim + non-empty.
- other: at least one of written_response, external_url, submission_notes.
- All other types (document-like): at least one of external_url,
  written_response, submission_notes, file_url.
- If no content field is meaningful -> EVIDENCE_CONTENT_REQUIRED.
- Invalid URL format -> INVALID_EXTERNAL_URL.
- Unsafe URL scheme -> UNSAFE_EXTERNAL_URL.

## Create behavior
- organization_id = action.organization_id (never caller-supplied)
- submitted_by = auth.uid() (never caller-supplied)
- verification_status = 'Draft' (never caller-supplied)
- submitted_at, reviewed_at, reviewed_by, reviewer_notes,
  organization_visible_notes = NULL
Returns the inserted action_evidence row.

## Update behavior
- Evidence must exist -> else EVIDENCE_NOT_FOUND
- Must belong to an accessible organization (authorization covers this)
- Its action must remain 'Awaiting Evidence' -> else ACTION_NOT_READY_FOR_EVIDENCE
- verification_status must be 'Draft' -> else EVIDENCE_NOT_EDITABLE
- Only updates: evidence_type, external_url, written_response,
  submission_notes, file_url. Does NOT change: id, action_id,
  organization_id, submitted_by, verification_status, submitted_at,
  reviewed_at, reviewed_by, reviewer_notes, organization_visible_notes.
Returns the updated action_evidence row.

## Duplicate prevention
No artificial one-draft-per-action restriction. Multiple Draft records are
allowed. Double-click is prevented client-side; the RPC is stateless and
idempotent at the row level (each INSERT gets a new gen_random_uuid()).

## Error tokens (P0001 with leading token)
NOT_AUTHENTICATED | ACTION_NOT_FOUND | EVIDENCE_NOT_FOUND | NOT_AUTHORIZED |
ACTION_NOT_STARTED | ACTION_NOT_READY_FOR_EVIDENCE | EVIDENCE_NOT_REQUIRED |
EVIDENCE_REQUIREMENTS_MISSING | INVALID_ACTION_STATUS | INVALID_EVIDENCE_TYPE |
EVIDENCE_CONTENT_REQUIRED | INVALID_EXTERNAL_URL | UNSAFE_EXTERNAL_URL |
EVIDENCE_NOT_EDITABLE | UNEXPECTED_ERROR
*/

CREATE OR REPLACE FUNCTION public.create_action_evidence_draft(
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

  -- 2. Load + lock the action row
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_action.organization_id;

  -- 3. Authorization
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
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to manage evidence for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Action eligibility
  IF v_action.status = 'Not Started' THEN
    RAISE EXCEPTION 'ACTION_NOT_STARTED: This action must be started before evidence can be added.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'In Progress' THEN
    RAISE EXCEPTION 'ACTION_NOT_READY_FOR_EVIDENCE: This action is not ready to receive evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot receive evidence in its current status.'
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

  -- 5. Evidence-type validation
  IF p_evidence_type NOT IN (
    'document','image','website_link','written_response','completed_form',
    'meeting_record','policy','budget','board_roster','board_matrix',
    'strategic_plan','logic_model','outcome_report','financial_report',
    'filing_confirmation','workshop_completion','other'
  ) THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_TYPE: Select a valid evidence type.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Normalize optional strings
  v_ext_url := CASE WHEN p_external_url IS NOT NULL AND btrim(p_external_url) != '' THEN btrim(p_external_url) ELSE NULL END;
  v_written := CASE WHEN p_written_response IS NOT NULL AND btrim(p_written_response) != '' THEN p_written_response ELSE NULL END;
  v_notes   := CASE WHEN p_submission_notes IS NOT NULL AND btrim(p_submission_notes) != '' THEN p_submission_notes ELSE NULL END;
  v_file    := CASE WHEN p_file_url IS NOT NULL AND btrim(p_file_url) != '' THEN btrim(p_file_url) ELSE NULL END;

  -- 7. Content validation per type
  IF p_evidence_type = 'website_link' THEN
    IF v_ext_url IS NULL THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving this draft.'
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
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving this draft.'
        USING ERRCODE = 'P0001';
    END IF;
    v_has_content := TRUE;
  ELSIF p_evidence_type = 'other' THEN
    IF v_written IS NOT NULL OR v_ext_url IS NOT NULL OR v_notes IS NOT NULL THEN
      v_has_content := TRUE;
    END IF;
  ELSE
    -- Document-like types: accept any content field
    IF v_ext_url IS NOT NULL OR v_written IS NOT NULL OR v_notes IS NOT NULL OR v_file IS NOT NULL THEN
      v_has_content := TRUE;
    END IF;
  END IF;

  -- Validate URL if provided by non-website_link types too
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
    RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving this draft.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Insert the Draft evidence row
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

REVOKE ALL ON FUNCTION public.create_action_evidence_draft(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_action_evidence_draft(uuid, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_action_evidence_draft(
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
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to update evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Load + lock the evidence row
  SELECT * INTO v_evidence
    FROM public.action_evidence
    WHERE id = p_evidence_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_FOUND: This evidence record could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_evidence.organization_id;

  -- 3. Authorization (check against the related action)
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = v_evidence.action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: The action for this evidence could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

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
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to manage evidence for this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Editability: must be Draft
  IF v_evidence.verification_status IS DISTINCT FROM 'Draft' THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_EDITABLE: This evidence record can no longer be edited.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Action must still be Awaiting Evidence
  IF v_action.status = 'Not Started' THEN
    RAISE EXCEPTION 'ACTION_NOT_STARTED: This action must be started before evidence can be added.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'In Progress' THEN
    RAISE EXCEPTION 'ACTION_NOT_READY_FOR_EVIDENCE: This action is not ready to receive evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot receive evidence in its current status.'
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

  -- 8. Content validation per type (same as create)
  IF p_evidence_type = 'website_link' THEN
    IF v_ext_url IS NULL THEN
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving this draft.'
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
      RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving this draft.'
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
    RAISE EXCEPTION 'EVIDENCE_CONTENT_REQUIRED: Provide evidence content before saving this draft.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Update only the editable fields
  UPDATE public.action_evidence
    SET evidence_type = p_evidence_type,
        external_url = v_ext_url,
        written_response = v_written,
        submission_notes = v_notes,
        file_url = v_file
    WHERE id = p_evidence_id
    RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_action_evidence_draft(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_action_evidence_draft(uuid, text, text, text, text, text) TO authenticated;
