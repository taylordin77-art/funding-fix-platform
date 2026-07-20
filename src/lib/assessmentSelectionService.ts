/**
 * C-SHIFT Assessment Selection Service — read-only.
 *
 * Resolves the caller's active organization + membership role and returns the
 * completed, organization-linked assessments that are still eligible to drive
 * a new action plan. The database RPC remains the final authorization
 * authority; this service only mirrors the same role rules for UX gating.
 *
 * No database writes. Uses existing RLS only.
 */
import { supabase } from './supabase';

/* ============================================================
   Types
   ============================================================ */

export interface EligibleAssessment {
  id: string;
  completedAt: string | null;
  createdAt: string | null;
  overallScore: number | null;
  assessmentType: string | null;
  createdActionPlan: boolean;
}

export type AssessmentSelectionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_ORGANIZATION'
  | 'NOT_AUTHORIZED'
  | 'QUERY_FAILED'
  | 'UNEXPECTED_ERROR';

export type EligibleAssessmentResult =
  | {
      ok: true;
      assessments: EligibleAssessment[];
      organizationId: string;
      canCreateActionPlan: boolean;
      userRole: string;
    }
  | {
      ok: false;
      error: {
        code: AssessmentSelectionErrorCode;
        message: string;
      };
    };

/* ============================================================
   Constants — mirror the RPC's authorization helpers exactly
   ============================================================ */

// is_org_admin(): active member with one of these organization_role values.
const ORG_ADMIN_ROLES: ReadonlySet<string> = new Set([
  'owner',
  'executive_director',
  'administrator',
]);

// is_cshift_admin(): profiles.role = 'admin'
const CSHIFT_ADMIN_PROFILE_ROLE = 'admin';

const SAFE_MESSAGES: Record<AssessmentSelectionErrorCode, string> = {
  NOT_AUTHENTICATED: 'You must be signed in to select an assessment.',
  NO_ORGANIZATION: 'No active organization found for this account.',
  NOT_AUTHORIZED: 'Only organization admins or C-SHIFT platform admins may create an action plan.',
  QUERY_FAILED: 'Unable to load completed assessments.',
  UNEXPECTED_ERROR: 'Something went wrong while loading eligible assessments.',
};

/* ============================================================
   Internal row types
   ============================================================ */

interface MembershipRow {
  organization_id: string;
  organization_role: string;
  membership_status: string;
  organizations: { id: string; organization_name: string } | null;
}

interface ProfileRow {
  id: string;
  role: string | null;
}

interface AssessmentRow {
  id: string;
  completed_at: string | null;
  created_at: string | null;
  overall_percentage: number | null;
  total_score: number | null;
  assessment_type: string | null;
  created_action_plan: boolean | null;
}

interface ExistingActionRow {
  assessment_id: string;
}

/* ============================================================
   Pure helpers (exported for testing)
   ============================================================ */

/**
 * Mirror of public.is_org_admin() + public.is_cshift_admin() for UX gating.
 * The database RPC remains the final authority.
 */
export function canCreateActionPlan(
  organizationRole: string | null,
  profileRole: string | null,
): boolean {
  if (profileRole === CSHIFT_ADMIN_PROFILE_ROLE) return true;
  if (organizationRole && ORG_ADMIN_ROLES.has(organizationRole)) return true;
  return false;
}

function toEligibleAssessment(row: AssessmentRow): EligibleAssessment {
  return {
    id: row.id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    overallScore: row.overall_percentage != null
      ? Math.round(Number(row.overall_percentage) * 100) / 100
      : row.total_score != null
        ? row.total_score
        : null,
    assessmentType: row.assessment_type,
    createdActionPlan: row.created_action_plan === true,
  };
}

/**
 * Pure filter for testability: exclude assessments that already have
 * assessment-generated organization_actions. `existingActionAssessmentIds` is
 * the set of assessment_ids that already appear in organization_actions with
 * source_type = 'assessment'.
 */
export function excludeAssessmentsWithExistingActions(
  assessments: EligibleAssessment[],
  existingActionAssessmentIds: Set<string>,
): EligibleAssessment[] {
  return assessments.filter((a) => !existingActionAssessmentIds.has(a.id));
}

/**
 * Sort newest completed assessment first (completed_at desc, then created_at
 * desc as a tiebreaker). Null timestamps sort last.
 */
export function sortNewestCompletedFirst(assessments: EligibleAssessment[]): EligibleAssessment[] {
  return [...assessments].sort((a, b) => {
    const ac = a.completedAt ?? a.createdAt ?? '';
    const bc = b.completedAt ?? b.createdAt ?? '';
    if (ac !== bc) return ac < bc ? 1 : -1;
    const ac2 = a.createdAt ?? '';
    const bc2 = b.createdAt ?? '';
    if (ac2 !== bc2) return ac2 < bc2 ? 1 : -1;
    return 0;
  });
}

/* ============================================================
   Public entry point
   ============================================================ */

export async function getEligibleAssessmentsForActionPlan(): Promise<EligibleAssessmentResult> {
  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'NOT_AUTHENTICATED', message: SAFE_MESSAGES.NOT_AUTHENTICATED } };
  }

  // 2. Resolve active organization + membership role (RLS-enforced).
  //    Use the same resolution order as the workflow/dashboard services.
  const { data: membership, error: membershipError } = (await supabase
    .from('organization_members')
    .select('organization_id, organization_role, membership_status, organizations!inner(id, organization_name)')
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()) as { data: MembershipRow | null; error: { message?: string } | null };

  if (membershipError) {
    console.error('[assessmentSelectionService] Membership query error:', membershipError.message);
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (!membership || !membership.organizations) {
    return { ok: false, error: { code: 'NO_ORGANIZATION', message: SAFE_MESSAGES.NO_ORGANIZATION } };
  }

  const organizationId = membership.organizations.id;
  const organizationRole = membership.organization_role;

  // 3. Read the caller's profile to check the C-SHIFT platform-admin role.
  //    Mirrors is_cshift_admin(): profiles.role = 'admin'.
  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()) as { data: ProfileRow | null; error: { message?: string } | null };

  if (profileError) {
    console.error('[assessmentSelectionService] Profile query error:', profileError.message);
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const profileRole = profile?.role ?? null;
  const allowed = canCreateActionPlan(organizationRole, profileRole);

  // 4. Read completed, organization-linked assessments for the resolved org.
  //    RLS-enforced. created_action_plan = false is filtered at the DB layer.
  const { data: rawAssessments, error: assessmentsError } = await supabase
    .from('assessments')
    .select(
      'id, completed_at, created_at, overall_percentage, total_score, assessment_type, created_action_plan',
    )
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .eq('created_action_plan', false)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }) as { data: AssessmentRow[] | null; error: { message?: string; code?: string } | null };

  if (assessmentsError) {
    console.error('[assessmentSelectionService] Assessments query error:', assessmentsError.message);
    return { ok: false, error: { code: 'QUERY_FAILED', message: SAFE_MESSAGES.QUERY_FAILED } };
  }

  let eligible = (rawAssessments ?? []).map(toEligibleAssessment);

  // 5. Exclude assessments that already have assessment-generated actions.
  //    This guards against the edge case where actions exist but
  //    created_action_plan was not flipped to true. Read-only.
  if (eligible.length > 0) {
    const { data: existingActions, error: existingActionsError } = await supabase
      .from('organization_actions')
      .select('assessment_id')
      .eq('organization_id', organizationId)
      .eq('source_type', 'assessment')
      .not('assessment_id', 'is', null) as { data: ExistingActionRow[] | null; error: { message?: string; code?: string } | null };

    if (existingActionsError) {
      console.error('[assessmentSelectionService] Existing actions query error:', existingActionsError.message);
      return { ok: false, error: { code: 'QUERY_FAILED', message: SAFE_MESSAGES.QUERY_FAILED } };
    }

    const existingIds = new Set<string>(
      (existingActions ?? []).map((r: ExistingActionRow) => r.assessment_id).filter((id: string | null): id is string => id != null),
    );
    eligible = excludeAssessmentsWithExistingActions(eligible, existingIds);
  }

  // 6. Final newest-first ordering.
  eligible = sortNewestCompletedFirst(eligible);

  return {
    ok: true,
    assessments: eligible,
    organizationId,
    canCreateActionPlan: allowed,
    userRole: profileRole ?? organizationRole ?? 'member',
  };
}
