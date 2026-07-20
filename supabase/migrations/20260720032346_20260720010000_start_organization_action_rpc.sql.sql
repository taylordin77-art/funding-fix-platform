/*
# Start Organization Action RPC

## Purpose
Adds a single SECURITY DEFINER RPC `start_organization_action` that performs
the first C-SHIFT Action Lifecycle transition: Not Started -> In Progress.
This is the only status transition implemented by this migration.

## Approach
- ADDITIVE ONLY. No tables, columns, indexes, triggers, or RLS policies are
  created, altered, or dropped. The RPC reuses the existing
  `organization_actions` table, the existing `action_history` table, the
  existing `organization_members` table, and the existing
  `is_org_admin()` / `is_cshift_admin()` helper functions.
- SECURITY DEFINER + `SET search_path = public` so the function runs with
  elevated privileges and a stable schema path.
- Revoke PUBLIC access; grant EXECUTE only to `authenticated`.

## Authorization (checked in order, inside the RPC)
1. `auth.uid()` IS NOT NULL  -> else 'NOT_AUTHENTICATED'
2. Action exists for `p_action_id` -> else 'ACTION_NOT_FOUND'
3. Caller is a C-SHIFT platform admin (`is_cshift_admin`)
   OR an active member of the action's organization with an authorized role
   -> else 'NOT_AUTHORIZED'.
   Authorized roles:
   - owner, executive_director, administrator (always — may start any action,
     including unassigned ones)
   - staff (only when `organization_actions.assigned_user_id = auth.uid()`)
   Board members, consultants, and viewers are never authorized. Unassigned
   staff are rejected for actions where `assigned_user_id IS NULL`.
   Users from another organization are rejected.

## Status validation (Not Started is the only valid source state)
- `status = 'Not Started'` -> proceed.
- `status = 'In Progress'` -> 'ACTION_ALREADY_STARTED' (idempotency: reload UI).
- Any other status (Awaiting Evidence, Submitted for Verification,
  Revision Required, Verified, Completed, Deferred) -> 'INVALID_ACTION_STATUS'.

## State-consistency guard
If `started_at IS NOT NULL` while `status = 'Not Started'`, the row is in an
inconsistent state -> 'ACTION_STATE_INCONSISTENT'. We reject rather than
silently overwrite a pre-existing timestamp.

## Update behavior
On success:
- `status` = 'In Progress'
- `started_at` = now()
- `updated_at` is set automatically by the existing `trg_organization_actions_updated_at`
  BEFORE UPDATE trigger (set_updated_at()).
The following fields are NOT modified:
- submitted_at, completed_at, verified_at, verified_by, due_date,
  assigned_user_id, evidence fields, certification fields.

## Action history
The existing AFTER UPDATE trigger `trg_record_action_status_change`
(record_action_status_change()) automatically inserts one row into
`action_history` whenever `OLD.status IS DISTINCT FROM NEW.status`, capturing
action_id, organization_id, previous_status, new_status, and created_at.
This RPC does NOT manually insert a second history row — that would create a
duplicate. The `changed_by` column is populated by the trigger from
`NEW.verified_by`, which remains NULL for a Start transition (correct —
verified_by belongs to the verification lifecycle, not Start).

## Concurrency / idempotency
The action row is locked with `SELECT ... FOR UPDATE` before the status check,
so two concurrent calls cannot both pass the Not Started guard. The first
commit wins; the second sees `status = 'In Progress'` and returns
'ACTION_ALREADY_STARTED'. Exactly one UPDATE, one history row, one
started_at value.

## Return
Returns the updated `organization_actions` row (full row shape).

## Error codes (raised as P0001 with a fixed leading token for client mapping)
NOT_AUTHENTICATED | ACTION_NOT_FOUND | NOT_AUTHORIZED |
ACTION_ALREADY_STARTED | INVALID_ACTION_STATUS | ACTION_STATE_INCONSISTENT |
UNEXPECTED_ERROR
*/

CREATE OR REPLACE FUNCTION public.start_organization_action(
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
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to start an action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Load + lock the action row (FOR UPDATE prevents concurrent duplicate starts)
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
  --    C-SHIFT platform admin (profiles.role = 'admin')
  IF public.is_cshift_admin() THEN
    v_authorized := TRUE;
  ELSE
    -- Active membership in this action's organization
    SELECT organization_role INTO v_membership
      FROM public.organization_members
      WHERE organization_id = v_org_id
        AND user_id = v_uid
        AND membership_status = 'active'
      LIMIT 1;

    IF FOUND THEN
      -- Org admins (owner / executive_director / administrator) may start any action
      IF v_membership.organization_role IN ('owner', 'executive_director', 'administrator') THEN
        v_authorized := TRUE;
      -- Staff may start only the action assigned to them
      ELSIF v_membership.organization_role = 'staff'
            AND v_action.assigned_user_id = v_uid THEN
        v_authorized := TRUE;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You do not have permission to start this action.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Status validation (only Not Started may transition to In Progress)
  IF v_action.status = 'In Progress' THEN
    RAISE EXCEPTION 'ACTION_ALREADY_STARTED: This action has already been started.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action.status IS DISTINCT FROM 'Not Started' THEN
    RAISE EXCEPTION 'INVALID_ACTION_STATUS: This action cannot be started from its current status.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. State-consistency guard: started_at must be null for a Not Started action
  IF v_action.started_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACTION_STATE_INCONSISTENT: This action has an invalid workflow state and could not be started.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Perform the transition.
  --    started_at is set now. updated_at is set by the BEFORE trigger.
  --    The AFTER trigger trg_record_action_status_change inserts exactly one
  --    action_history row (previous_status = 'Not Started', new_status = 'In Progress').
  --    No manual history insert here — that would duplicate the trigger's row.
  UPDATE public.organization_actions
    SET status = 'In Progress',
        started_at = now()
    WHERE id = p_action_id;

  -- 7. Return the updated row.
  SELECT * INTO v_action
    FROM public.organization_actions
    WHERE id = p_action_id;

  RETURN v_action;
END;
$function$;

-- Revoke any default EXECUTE from PUBLIC and grant only to authenticated users.
REVOKE ALL ON FUNCTION public.start_organization_action(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_organization_action(uuid) TO authenticated;
