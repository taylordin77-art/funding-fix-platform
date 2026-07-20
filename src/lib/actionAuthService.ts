/**
 * C-SHIFT Action Authorization Service — read-only.
 *
 * Resolves the current user's organization membership role + C-SHIFT platform
 * role ONCE so ActionCard can compute `canStart` without per-card DB queries.
 * The database RPC (`start_organization_action`) remains the final authority;
 * this helper only mirrors the same role rules for button visibility.
 *
 * No database writes.
 */
import { supabase } from './supabase';
import type { WorkflowActionWithEvidence } from './actionWorkflowService';

/* ============================================================
   Types
   ============================================================ */

export type ActionAuthErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_ORGANIZATION'
  | 'UNEXPECTED_ERROR';

export interface ActionAuthContext {
  /** The resolved active-organization id (matches the workflow org). */
  organizationId: string;
  /** The caller's organization_role within that org (null if none). */
  organizationRole: string | null;
  /** The caller's profiles.role ('admin' = C-SHIFT platform admin). */
  profileRole: string | null;
  /** The authenticated user's id. */
  userId: string;
  /** Whether the caller may start actions per the client-side role mirror. */
  canStartActions: boolean;
}

export type ActionAuthResult =
  | { ok: true; data: ActionAuthContext }
  | { ok: false; error: { code: ActionAuthErrorCode; message: string } };

/* ============================================================
   Constants — mirror the RPC's authorization logic exactly
   ============================================================ */

// start_organization_action: org admins may start any action.
const ORG_ADMIN_ROLES: ReadonlySet<string> = new Set([
  'owner',
  'executive_director',
  'administrator',
]);

// start_organization_action: staff may start only actions assigned to them.
const STAFF_ROLE = 'staff';

// is_cshift_admin(): profiles.role = 'admin'
const CSHIFT_ADMIN_PROFILE_ROLE = 'admin';

const SAFE_MESSAGES: Record<ActionAuthErrorCode, string> = {
  NOT_AUTHENTICATED: 'You must be signed in to perform this action.',
  NO_ORGANIZATION: 'No active organization found for this account.',
  UNEXPECTED_ERROR: 'Unable to resolve your permissions.',
};

/* ============================================================
   Internal row types
   ============================================================ */

interface MembershipRow {
  organization_id: string;
  organization_role: string;
  membership_status: string;
}

interface ProfileRow {
  id: string;
  role: string | null;
}

/* ============================================================
   Pure helper (exported for testing + reuse)
   ============================================================ */

/**
 * Client-side mirror of start_organization_action's authorization.
 * The RPC is authoritative; this is for button visibility only.
 *
 * - C-SHIFT platform admin -> true
 * - org admin (owner/executive_director/administrator) -> true
 * - staff -> true only when the action is assigned to this user
 * - everyone else -> false
 */
export function canStartAction(
  action: { assigned_user_id: string | null },
  auth: { organizationRole: string | null; profileRole: string | null; userId: string },
): boolean {
  if (auth.profileRole === CSHIFT_ADMIN_PROFILE_ROLE) return true;
  if (auth.organizationRole && ORG_ADMIN_ROLES.has(auth.organizationRole)) return true;
  if (auth.organizationRole === STAFF_ROLE && action.assigned_user_id === auth.userId) return true;
  return false;
}

/* ============================================================
   Public entry point
   ============================================================ */

let cached: ActionAuthContext | null = null;

/**
 * Resolve the caller's authorization context once per page load.
 * Subsequent calls return the cached context (same session, same org).
 */
export async function getActionAuthContext(): Promise<ActionAuthResult> {
  if (cached) return { ok: true, data: cached };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'NOT_AUTHENTICATED', message: SAFE_MESSAGES.NOT_AUTHENTICATED } };
  }

  const { data: membership, error: membershipError } = (await supabase
    .from('organization_members')
    .select('organization_id, organization_role, membership_status')
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()) as { data: MembershipRow | null; error: { message?: string } | null };

  if (membershipError) {
    console.error('[actionAuthService] Membership query error:', membershipError.message);
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (!membership) {
    return { ok: false, error: { code: 'NO_ORGANIZATION', message: SAFE_MESSAGES.NO_ORGANIZATION } };
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()) as { data: ProfileRow | null; error: { message?: string } | null };

  if (profileError) {
    console.error('[actionAuthService] Profile query error:', profileError.message);
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const ctx: ActionAuthContext = {
    organizationId: membership.organization_id,
    organizationRole: membership.organization_role,
    profileRole: profile?.role ?? null,
    userId: user.id,
    canStartActions:
      profile?.role === CSHIFT_ADMIN_PROFILE_ROLE ||
      (membership.organization_role != null && ORG_ADMIN_ROLES.has(membership.organization_role)) ||
      membership.organization_role === STAFF_ROLE,
  };

  cached = ctx;
  return { ok: true, data: ctx };
}

/**
 * Reset the cache (used by tests or after a session/org change).
 */
export function resetActionAuthCache(): void {
  cached = null;
}

/**
 * Convenience: compute canStart for a specific action against a resolved context.
 */
export function userCanStartAction(
  action: WorkflowActionWithEvidence,
  auth: ActionAuthContext,
): boolean {
  return canStartAction(action, {
    organizationRole: auth.organizationRole,
    profileRole: auth.profileRole,
    userId: auth.userId,
  });
}
