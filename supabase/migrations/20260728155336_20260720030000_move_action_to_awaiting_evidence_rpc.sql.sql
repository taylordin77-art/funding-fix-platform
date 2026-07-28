/*
# Move Action to Awaiting Evidence RPC

## Purpose
Adds a single SECURITY DEFINER RPC `move_action_to_awaiting_evidence` that
performs the C-SHIFT Action Lifecycle transition: In Progress -> Awaiting
Evidence.

This transition means: "The organization has completed the underlying work
and must now provide the evidence required to substantiate it."

## Approach
- ADDITIVE ONLY. No tables, columns, indexes, triggers, or RLS policies are
  created, altered, or dropped. The RPC reuses the existing
  `organization_actions` table, the existing `action_history` table, the
  existing `organization_members` table, and the existing
  `is_cshift_admin()` / `is_org_admin()` helper functions.
- SECURITY DEFINER + `SET search_path = public`.
- Revoke PUBLIC; grant EXECUTE only to `authenticated`.

## Authorization (same policy as start_organization_action)
1. `auth.uid()` IS NOT NULL -> else 'NOT_AUTHENTICATED'
2. Action exists for `p_action_id` -> else 'ACTION_NOT_FOUND'
3. Caller is a C-SHIFT platform admin (`is_cshift_admin`)
   OR an active member of the action's organization with an authorized role
   -> else 'NOT_AUTHORIZED'.
   Authorized roles:
   - owner, executive_director, administrator (may transition any action,
     including unassigned ones)
   - staff (only when `organization_actions.assigned_user_id = auth.uid()`)
   Board members, consultants, viewers, inactive members, unassigned staff,
   and users from another organization are rejected.

## Status validation (In Progress is the only valid source state)
- `status = 'In Progress'` -> proceed to evidence validation.
- `status = 'Awaiting Evidence'` -> 'ACTION_ALREADY_AWAITING_EVIDENCE'
- `status = 'Not Started'` -> 'ACTION_NOT_STARTED'
- Any other status (Submitted for Verification, Revision Required, Verified,
  Completed, Deferred) -> 'INVALID_ACTION_STATUS'

## Evidence-requirement validation (text column)
- `evidence_required = false` -> 'EVIDENCE_NOT_REQUIRED'
- `evidence_required = true` but `evidence_requirements` is NULL, empty after
  trim, or whitespace-only -> 'EVIDENCE_REQUIREMENTS_MISSING'

## State-consistency guard
If `submitted_at IS NOT NULL` while `status = 'In Progress'`, the row is in
an inconsistent state -> 'ACTION_STATE_INCONSISTENT'.

## Update behavior
On success:
- `status` = 'Awaiting Evidence'
- `updated_at` is set automatically by the existing BEFORE UPDATE trigger.
The following fields are NOT modified:
- started_at, submitted_at, completed_at, verified_at, verified_by,
  due_date, assigned_user_id, evidence_required, evidence_requirements,
  certification_requirement, assessment source fields, score-gain fields.

## Action history
The existing AFTER UPDATE trigger `trg_record_action_status_change`
(corrected to use `COALESCE(auth.uid(), NEW.verified_by)`) automatically
inserts exactly one row into `action_history` when
`OLD.status IS DISTINCT FROM NEW.status`, capturing action_id,
organization_id, previous_status, new_status, created_at, and changed_by
(the authenticated caller). This RPC does NOT manually insert a history row.

## Concurrency / idempotency
The action row is locked with `SELECT ... FOR UPDATE` before validation.
Two concurrent calls cannot both pass the In Progress guard. The first
commit wins; the second sees `Awaiting Evidence` and returns
`ACTION_ALREADY_AWAITING_EVIDENCE`. Exactly one UPDATE, one history row.

## Return
Returns the updated `organization_actions` row (full row shape).

## Error codes (raised as P0001 with a fixed leading token)
NOT_AUTHENTICATED | ACTION_NOT_FOUND | NOT_AUTHORIZED |
ACTION_NOT_STARTED | ACTION_ALREADY_AWAITING_EVIDENCE |
EVIDENCE_NOT_REQUIRED | EVIDENCE_REQUIREMENTS_MISSING |
INVALID_ACTION_STATUS | ACTION_STATE_INCONSISTENT | UNEXPECTED_ERROR
*/

CREATE OR REPLACE FUNCTION public.move_action_to_awaiting_evidence(
  p_action_id uuid
) RETURNS public.organization_actions
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
  v_reqs        text;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to move an action to evidence collection.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Load + lock the action row (FOR UPDATE prevents concurrent duplicate transitions)
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTION_NOT_FOUND: This action could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_action.organization_id;

  -- 3. Authorization: C-SHIFT admin OR active org member with an allowed role.
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
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to move this action to evidence collection.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Status validation
  IF v_action.status = 'Awaiting Evidence' THEN
    RAISE EXCEPTION 'ACTION_ALREADY_AWAITING_EVIDENCE: This action is already awaiting evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status = 'Not Started' THEN
    RAISE EXCEPTION 'ACTION_NOT_STARTED: This action must be started before evidence can be requested.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'In Progress' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot move to evidence collection from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Evidence-requirement validation (text column: trim + non-empty)
  IF v_action.evidence_required IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_REQUIRED: This action does not require evidence and cannot enter the evidence collection stage.'
      USING ERRCODE = 'P0001';
  END IF;

  v_reqs := COALESCE(v_action.evidence_requirements, '');
  IF btrim(v_reqs) = '' THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIREMENTS_MISSING: Evidence requirements must be defined before this action can move to Awaiting Evidence.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. State-consistency guard
  IF v_action.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid workflow state and could not be updated.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Perform the transition. updated_at is set by the BEFORE trigger.
  --    The AFTER trigger inserts exactly one action_history row with
  --    changed_by = COALESCE(auth.uid(), NEW.verified_by) = auth.uid().
  UPDATE public.organization_actions
    SET status = 'Awaiting Evidence'
    WHERE id = p_action_id;

  -- 8. Return the updated row.
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id;

  RETURN v_action;
END;
$function$;

REVOKE ALL ON FUNCTION public.move_action_to_awaiting_evidence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_action_to_awaiting_evidence(uuid) TO authenticated;
