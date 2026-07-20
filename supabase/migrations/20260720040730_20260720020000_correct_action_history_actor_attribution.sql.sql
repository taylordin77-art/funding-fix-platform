/*
# Correct action_history Actor Attribution

## Purpose
Corrects the existing `record_action_status_change()` trigger function so
that every authenticated organization-action status change records the actual
authenticated actor in `action_history.changed_by` instead of unconditionally
deriving it from `NEW.verified_by`.

## Root cause
The original trigger function set `changed_by = NEW.verified_by`. That is
correct for a formal verification transition (where the reviewer sets
verified_by), but wrong for every other status transition — including the
Start Action transition (Not Started -> In Progress), which never sets
verified_by. As a result, the Start Action transition produced a history row
with `changed_by = NULL`, losing audit attribution for the authenticated user
who started the action.

## Corrected actor-attribution rule
`changed_by` is now derived inside the database as:

    COALESCE(auth.uid(), NEW.verified_by)

Hierarchy (preferred -> fallback):
  1. auth.uid()           — the authenticated user who caused the update.
                            Available inside AFTER triggers fired by a
                            SECURITY DEFINER RPC because SECURITY DEFINER
                            changes the effective role but does NOT clear
                            the session JWT.
  2. NEW.verified_by      — used only when auth.uid() is unavailable (e.g.
                            a background/service-role transition with no
                            authenticated session but a formal reviewer
                            recorded in verified_by).
  3. NULL                 — only for a legitimate system-generated transition
                            with no authenticated actor AND no verified_by.

verified_by is NOT repurposed. It remains the action's formal verification
field. For a verification transition where both are set, auth.uid() (the
authenticated reviewer) wins in changed_by and verified_by retains the formal
reviewer ID on the action row.

## Approach
- ADDITIVE / corrective only. Uses CREATE OR REPLACE FUNCTION to fix the
  existing trigger function body. No new tables, no new columns, no new
  triggers, no new constraints, no RLS changes, no privilege changes.
- Preserves the existing trigger name (`trg_record_action_status_change`),
  timing (AFTER UPDATE), and table (`organization_actions`).
- Preserves action_id, organization_id, previous_status, new_status,
  change_notes, and created_at behavior exactly.
- The function remains SECURITY DEFINER and now declares an explicit safe
  `SET search_path = public` (it was previously implicit).

## Atomicity
The trigger function runs inside the same implicit transaction as the
UPDATE that fired it. If the history INSERT raises an exception, the
exception propagates and the entire transaction (including the status
UPDATE) rolls back. The status update and history insert remain atomic —
a status change can never succeed without its audit record. The function
does NOT swallow errors.

## Security
- changed_by is derived entirely inside the database from auth.uid() /
  NEW.verified_by. Caller-supplied values cannot override it.
- The trigger function is SECURITY DEFINER and bypasses action_history RLS
  for the audit insert (the existing RLS INSERT policy only allows
  is_cshift_admin(); the SECURITY DEFINER trigger is the sole writer and is
  not callable by anonymous users to forge history).
- The migration does not broaden table or function privileges.
- Ordinary users cannot directly INSERT action_history rows (the INSERT RLS
  policy requires is_cshift_admin()), so they cannot forge falsified audit
  records.
*/

CREATE OR REPLACE FUNCTION public.record_action_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Authenticated actor wins; verified_by is the fallback for background/
    -- service-role transitions with no session but a formal reviewer recorded.
    -- NULL only for a legitimate system-generated transition with neither.
    v_actor := COALESCE(auth.uid(), NEW.verified_by);

    INSERT INTO public.action_history (
      action_id, organization_id, changed_by,
      previous_status, new_status, change_notes
    ) VALUES (
      NEW.id, NEW.organization_id, v_actor,
      OLD.status, NEW.status, NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;
