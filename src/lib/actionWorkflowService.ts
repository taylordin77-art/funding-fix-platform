/**
 * C-SHIFT Action Workflow Service — read-only workflow intelligence.
 *
 * Reads persisted organization_actions (RLS-enforced) and converts them into
 * the structured data the Action Center, Certification, Progress Tracking,
 * AI Advisor, and Executive Dashboard will consume. No database writes.
 */
import { supabase } from './supabase';

/* ============================================================
   Types
   ============================================================ */

export type ActionPriority = 'Critical' | 'High' | 'Moderate' | 'Low';

export type ActionPillarName =
  | 'Clarity'
  | 'Structure'
  | 'Health'
  | 'Impact'
  | 'Funding'
  | 'Transformation';

export interface WorkflowAction {
  id: string;
  organization_id: string;
  assessment_id: string | null;
  pillar_name: ActionPillarName;
  action_category: string | null;
  title: string;
  description: string;
  why_it_matters: string | null;
  why_funders_care: string | null;
  priority: ActionPriority;
  status: string;
  assigned_user_id: string | null;
  due_date: string | null;
  estimated_completion_days: number | null;
  evidence_required: boolean | null;
  evidence_requirements: string | null;
  estimated_pillar_score_increase: number | null;
  estimated_overall_score_increase: number | null;
  certification_requirement: boolean | null;
  source_type: string | null;
  source_reference: string | null;
  created_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  updated_at: string | null;
}

export interface OrganizationSummary {
  organizationId: string;
  organizationName: string;
  totalActions: number;
}

export interface WorkflowSummary {
  totalActions: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  verified: number;
  awaitingEvidence: number;
  awaitingVerification: number;
  revisionRequired: number;
  blocked: number;
  overdue: number;
  completionPercentage: number;
  verificationPercentage: number;
}

export interface ActionGroup {
  priority: ActionPriority;
  actions: WorkflowAction[];
  count: number;
}

export interface CompletionMetrics {
  totalActions: number;
  completed: number;
  verified: number;
  awaitingEvidence: number;
  awaitingVerification: number;
  revisionRequired: number;
  blocked: number;
  completionPercentage: number;
  verificationPercentage: number;
}

export interface PillarSummary {
  pillar: ActionPillarName;
  totalActions: number;
  completed: number;
  verified: number;
  averagePriority: number;
  estimatedScoreGain: number;
}

export interface CertificationReadiness {
  requiredEvidenceComplete: boolean;
  verificationComplete: boolean;
  remainingActions: number;
  readyForCertification: boolean;
  reasons: string[];
}

export interface OverdueAction {
  action: WorkflowAction;
  daysOverdue: number;
}

export interface OrganizationWorkflow {
  organization: OrganizationSummary;
  workflowSummary: WorkflowSummary;
  actionGroups: ActionGroup[];
  completionMetrics: CompletionMetrics;
  pillarSummaries: PillarSummary[];
  certificationReadiness: CertificationReadiness;
  overdueActions: OverdueAction[];
  awaitingEvidence: WorkflowAction[];
  awaitingVerification: WorkflowAction[];
  completedActions: WorkflowAction[];
  blockedActions: WorkflowAction[];
}

export type WorkflowErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_ORGANIZATION'
  | 'UNEXPECTED_ERROR';

export type OrganizationWorkflowResult =
  | { ok: true; data: OrganizationWorkflow }
  | { ok: false; error: { code: WorkflowErrorCode; message: string } };

/* ============================================================
   Constants
   ============================================================ */

const PILLAR_ORDER: ActionPillarName[] = [
  'Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transformation',
];

const PRIORITY_ORDER: ActionPriority[] = ['Critical', 'High', 'Moderate', 'Low'];

const PRIORITY_RANK: Record<ActionPriority, number> = {
  Critical: 1, High: 2, Moderate: 3, Low: 4,
};

const BLOCKED_STATUSES = ['Awaiting Evidence', 'Revision Required'] as const;

/* ============================================================
   Pure helpers (exported for reuse by Action Center, AI Advisor, etc.)
   ============================================================ */

export function isCompleted(a: WorkflowAction): boolean {
  return a.status === 'Completed';
}

export function isVerified(a: WorkflowAction): boolean {
  return a.verified_at !== null;
}

export function isAwaitingEvidence(a: WorkflowAction): boolean {
  return a.status === 'Awaiting Evidence';
}

export function isAwaitingVerification(a: WorkflowAction): boolean {
  return a.status === 'Completed' && a.verified_at === null;
}

export function isRevisionRequired(a: WorkflowAction): boolean {
  return a.status === 'Revision Required';
}

export function isBlocked(a: WorkflowAction): boolean {
  return (BLOCKED_STATUSES as readonly string[]).includes(a.status);
}

export function isOverdue(a: WorkflowAction): boolean {
  if (!a.due_date) return false;
  if (a.status === 'Completed' || a.verified_at !== null) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(a.due_date + 'T00:00:00');
  return today.getTime() > due.getTime();
}

export function daysOverdue(a: WorkflowAction): number {
  if (!a.due_date) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(a.due_date + 'T00:00:00');
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

export function isEvidenceComplete(a: WorkflowAction): boolean {
  if (!a.evidence_required) return true;
  return a.status === 'Completed' || a.verified_at !== null;
}

export function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

/* ============================================================
   Pure builders (exported for reuse and testing)
   ============================================================ */

export function sortActions(actions: WorkflowAction[]): WorkflowAction[] {
  return [...actions].sort((a, b) => {
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    } else if (a.due_date && !b.due_date) {
      return -1;
    } else if (!a.due_date && b.due_date) {
      return 1;
    }
    if (a.created_at && b.created_at) {
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    }
    if (a.created_at) return -1;
    if (b.created_at) return 1;
    return 0;
  });
}

export function buildActionGroups(actions: WorkflowAction[]): ActionGroup[] {
  return PRIORITY_ORDER.map((priority) => {
    const filtered = actions.filter((a) => a.priority === priority);
    return { priority, actions: sortActions(filtered), count: filtered.length };
  });
}

export function buildWorkflowSummary(actions: WorkflowAction[]): WorkflowSummary {
  const total = actions.length;
  const completed = actions.filter(isCompleted).length;
  const verified = actions.filter(isVerified).length;
  const awEv = actions.filter(isAwaitingEvidence).length;
  const awVf = actions.filter(isAwaitingVerification).length;
  const rev = actions.filter(isRevisionRequired).length;
  const blocked = actions.filter(isBlocked).length;
  const overdue = actions.filter(isOverdue).length;
  return {
    totalActions: total,
    notStarted: actions.filter((a) => a.status === 'Not Started').length,
    inProgress: actions.filter((a) => a.status === 'In Progress').length,
    completed,
    verified,
    awaitingEvidence: awEv,
    awaitingVerification: awVf,
    revisionRequired: rev,
    blocked,
    overdue,
    completionPercentage: pct(completed, total),
    verificationPercentage: pct(verified, total),
  };
}

export function buildCompletionMetrics(actions: WorkflowAction[]): CompletionMetrics {
  const total = actions.length;
  const completed = actions.filter(isCompleted).length;
  const verified = actions.filter(isVerified).length;
  const awEv = actions.filter(isAwaitingEvidence).length;
  const awVf = actions.filter(isAwaitingVerification).length;
  const rev = actions.filter(isRevisionRequired).length;
  const blocked = actions.filter(isBlocked).length;
  return {
    totalActions: total,
    completed,
    verified,
    awaitingEvidence: awEv,
    awaitingVerification: awVf,
    revisionRequired: rev,
    blocked,
    completionPercentage: pct(completed, total),
    verificationPercentage: pct(verified, total),
  };
}

export function buildPillarSummaries(actions: WorkflowAction[]): PillarSummary[] {
  return PILLAR_ORDER.map((pillar) => {
    const pa = actions.filter((a) => a.pillar_name === pillar);
    const total = pa.length;
    const completed = pa.filter(isCompleted).length;
    const verified = pa.filter(isVerified).length;
    const avgPriority =
      total > 0
        ? Math.round((pa.reduce((s, a) => s + PRIORITY_RANK[a.priority], 0) / total) * 10) / 10
        : 0;
    const estGain = pa.reduce((s, a) => s + (a.estimated_pillar_score_increase ?? 0), 0);
    return { pillar, totalActions: total, completed, verified, averagePriority: avgPriority, estimatedScoreGain: estGain };
  });
}

export function buildCertificationReadiness(actions: WorkflowAction[]): CertificationReadiness {
  const total = actions.length;
  const reasons: string[] = [];

  const evidenceRequiring = actions.filter((a) => a.evidence_required === true);
  const evidenceIncomplete = evidenceRequiring.filter((a) => !isEvidenceComplete(a));
  const requiredEvidenceComplete = evidenceIncomplete.length === 0;
  if (evidenceIncomplete.length > 0) {
    reasons.push(`${evidenceIncomplete.length} action(s) still require evidence submission.`);
  }

  const unverified = actions.filter((a) => a.verified_at === null);
  const verificationComplete = total > 0 && unverified.length === 0;
  if (unverified.length > 0) {
    reasons.push(`${unverified.length} action(s) awaiting verification.`);
  }

  const remaining = actions.filter((a) => a.status !== 'Completed' && a.verified_at === null).length;
  if (remaining > 0) {
    reasons.push(`${remaining} action(s) not yet completed.`);
  }

  const ready = total > 0 && requiredEvidenceComplete && verificationComplete;
  if (ready) reasons.push('All actions verified and evidence complete.');

  return {
    requiredEvidenceComplete,
    verificationComplete,
    remainingActions: remaining,
    readyForCertification: ready,
    reasons,
  };
}

export function buildOverdueActions(actions: WorkflowAction[]): OverdueAction[] {
  return sortActions(actions.filter(isOverdue)).map((action) => ({
    action,
    daysOverdue: daysOverdue(action),
  }));
}

export function buildOrganizationWorkflow(
  actions: WorkflowAction[],
  organizationId: string,
  organizationName: string,
): OrganizationWorkflow {
  return {
    organization: {
      organizationId,
      organizationName,
      totalActions: actions.length,
    },
    workflowSummary: buildWorkflowSummary(actions),
    actionGroups: buildActionGroups(actions),
    completionMetrics: buildCompletionMetrics(actions),
    pillarSummaries: buildPillarSummaries(actions),
    certificationReadiness: buildCertificationReadiness(actions),
    overdueActions: buildOverdueActions(actions),
    awaitingEvidence: sortActions(actions.filter(isAwaitingEvidence)),
    awaitingVerification: sortActions(actions.filter(isAwaitingVerification)),
    completedActions: sortActions(actions.filter((a) => isCompleted(a) || isVerified(a))),
    blockedActions: sortActions(actions.filter(isBlocked)),
  };
}

/* ============================================================
   DB-backed entry point
   ============================================================ */

interface MembershipRow {
  organization_id: string;
  organizations: { id: string; organization_name: string } | null;
}

export async function getOrganizationWorkflow(): Promise<OrganizationWorkflowResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'You must be signed in to view the action workflow.' },
    };
  }

  const { data: membership, error: membershipError } = (await supabase
    .from('organization_members')
    .select('organization_id, organizations!inner(id, organization_name)')
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()) as { data: MembershipRow | null; error: { message?: string } | null };

  if (membershipError) {
    console.error('[actionWorkflowService] Membership query error:', membershipError.message);
    return {
      ok: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Unable to load organization membership.' },
    };
  }
  if (!membership || !membership.organizations) {
    return {
      ok: false,
      error: { code: 'NO_ORGANIZATION', message: 'No active organization found for this account.' },
    };
  }

  const organizationId = membership.organizations.id;
  const organizationName = membership.organizations.organization_name;

  const { data: actions, error: actionsError } = (await supabase
    .from('organization_actions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })) as { data: WorkflowAction[] | null; error: { message?: string } | null };

  if (actionsError) {
    console.error('[actionWorkflowService] Actions query error:', actionsError.message);
    return {
      ok: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Unable to load organization actions.' },
    };
  }

  return {
    ok: true,
    data: buildOrganizationWorkflow(actions ?? [], organizationId, organizationName),
  };
}
