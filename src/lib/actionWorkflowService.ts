/**
 * C-SHIFT Action Workflow Service — read-only workflow + evidence intelligence.
 *
 * Reads persisted organization_actions and action_evidence (RLS-enforced) and
 * converts them into structured workflow intelligence for the Action Center,
 * Certification, Progress Tracking, AI Advisor, and Executive Dashboard.
 *
 * No database writes. Uses existing RLS only.
 *
 * Status values (from the organization_actions_status_check constraint):
 *   Not Started | In Progress | Awaiting Evidence | Submitted for Verification |
 *   Revision Required | Verified | Completed | Deferred
 *
 * Evidence verification (from the action_evidence_verification_status_check
 * constraint): Draft | Submitted | Under Review | Additional Information
 * Required | Approved | Rejected | Expired. "Approved" is the verified state.
 */
import { supabase } from './supabase';

/* ============================================================
   Types — organization_actions
   ============================================================ */

export type ActionPriority = 'Critical' | 'High' | 'Moderate' | 'Low';

export type ActionPillarName =
  | 'Clarity'
  | 'Structure'
  | 'Health'
  | 'Impact'
  | 'Funding'
  | 'Transformation';

export type ActionStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Awaiting Evidence'
  | 'Submitted for Verification'
  | 'Revision Required'
  | 'Verified'
  | 'Completed'
  | 'Deferred';

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

/* ============================================================
   Types — action_evidence (matches the verified schema exactly)
   ============================================================ */

export type EvidenceType =
  | 'document'
  | 'image'
  | 'website_link'
  | 'written_response'
  | 'completed_form'
  | 'meeting_record'
  | 'policy'
  | 'budget'
  | 'board_roster'
  | 'board_matrix'
  | 'strategic_plan'
  | 'logic_model'
  | 'outcome_report'
  | 'financial_report'
  | 'filing_confirmation'
  | 'workshop_completion'
  | 'other';

export type EvidenceVerificationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Additional Information Required'
  | 'Approved'
  | 'Rejected'
  | 'Expired';

export interface EvidenceRecord {
  id: string;
  action_id: string;
  organization_id: string;
  submitted_by: string;
  evidence_type: EvidenceType;
  file_url: string | null;
  external_url: string | null;
  written_response: string | null;
  submission_notes: string | null;
  verification_status: EvidenceVerificationStatus;
  reviewer_notes: string | null;
  organization_visible_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ActionEvidenceSummary {
  actionId: string;
  evidenceRequired: boolean;
  evidenceCount: number;
  evidenceSubmitted: number;
  evidenceVerified: number;
  evidenceRejectedOrRevisionRequired: number;
  latestEvidenceSubmittedAt: string | null;
  latestEvidenceVerifiedAt: string | null;
  evidenceTypes: EvidenceType[];
  evidenceComplete: boolean;
}

export interface WorkflowActionWithEvidence extends WorkflowAction {
  evidenceSummary: ActionEvidenceSummary;
}

/* ============================================================
   Types — workflow intelligence
   ============================================================ */

export interface OrganizationSummary {
  organizationId: string;
  organizationName: string;
  totalActions: number;
}

export interface WorkflowSummary {
  totalActions: number;
  notStarted: number;
  inProgress: number;
  awaitingEvidence: number;
  awaitingVerification: number;
  revisionRequired: number;
  verified: number;
  completed: number;
  deferred: number;
  blocked: number;
  overdue: number;
  evidenceRequired: number;
  evidenceComplete: number;
  completionPercentage: number;
  verificationPercentage: number;
  evidenceCompletionPercentage: number;
}

export interface CompletionMetrics {
  totalActions: number;
  notStarted: number;
  inProgress: number;
  awaitingEvidence: number;
  awaitingVerification: number;
  revisionRequired: number;
  verified: number;
  completed: number;
  deferred: number;
  blocked: number;
  overdue: number;
  evidenceRequired: number;
  evidenceComplete: number;
  completionPercentage: number;
  verificationPercentage: number;
  evidenceCompletionPercentage: number;
}

export interface ActionGroup {
  priority: ActionPriority;
  actions: WorkflowActionWithEvidence[];
  count: number;
}

export interface PillarSummary {
  pillar: ActionPillarName;
  totalActions: number;
  completed: number;
  verified: number;
  deferred: number;
  awaitingEvidence: number;
  awaitingVerification: number;
  revisionRequired: number;
  evidenceRequired: number;
  evidenceComplete: number;
  estimatedScoreGain: number;
  completionPercentage: number;
  /** Average priority rank. Critical=4, High=3, Moderate=2, Low=1. 0 when empty. */
  averagePriority: number;
}

export interface CertificationReadiness {
  certificationActionsRequired: number;
  certificationActionsCompleted: number;
  certificationActionsVerified: number;
  certificationEvidenceRequired: number;
  certificationEvidenceComplete: number;
  remainingActions: number;
  requiredEvidenceComplete: boolean;
  verificationComplete: boolean;
  readyForCertification: boolean;
  reasons: string[];
}

export interface OverdueAction {
  action: WorkflowActionWithEvidence;
  daysOverdue: number;
}

export interface OrganizationWorkflow {
  organization: OrganizationSummary;
  summary: WorkflowSummary;
  metrics: CompletionMetrics;
  pillarSummaries: PillarSummary[];
  actionGroups: ActionGroup[];
  actions: WorkflowActionWithEvidence[];
  notStartedActions: WorkflowActionWithEvidence[];
  inProgressActions: WorkflowActionWithEvidence[];
  awaitingEvidenceActions: WorkflowActionWithEvidence[];
  awaitingVerificationActions: WorkflowActionWithEvidence[];
  revisionRequiredActions: WorkflowActionWithEvidence[];
  verifiedActions: WorkflowActionWithEvidence[];
  completedActions: WorkflowActionWithEvidence[];
  deferredActions: WorkflowActionWithEvidence[];
  blockedActions: WorkflowActionWithEvidence[];
  overdueActions: OverdueAction[];
  certificationReadiness: CertificationReadiness;
}

export type WorkflowErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_ORGANIZATION'
  | 'ACTIONS_QUERY_FAILED'
  | 'EVIDENCE_QUERY_FAILED'
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

// Rank used for averagePriority. Higher rank = higher urgency.
const PRIORITY_RANK: Record<ActionPriority, number> = {
  Critical: 4, High: 3, Moderate: 2, Low: 1,
};

const BLOCKED_STATUSES: ReadonlySet<string> = new Set([
  'Awaiting Evidence',
  'Submitted for Verification',
  'Revision Required',
]);

const APPROVED_STATUS: EvidenceVerificationStatus = 'Approved';

// Verification statuses that indicate a reviewer rejected the evidence or
// asked for revision. Used for evidenceRejectedOrRevisionRequired.
const REJECTED_OR_REVISION_STATUSES: ReadonlySet<EvidenceVerificationStatus> = new Set([
  'Additional Information Required',
  'Rejected',
]);

// Evidence is considered "submitted" (handed over for review) when its
// verification_status is past Draft and not Expired.
const SUBMITTED_STATUSES: ReadonlySet<EvidenceVerificationStatus> = new Set([
  'Submitted',
  'Under Review',
  'Additional Information Required',
  'Approved',
  'Rejected',
]);

const NO_CERT_REQUIREMENTS_REASON = 'No certification requirements have been assigned.';

const SAFE_MESSAGES: Record<WorkflowErrorCode, string> = {
  NOT_AUTHENTICATED: 'You must be signed in to view the action workflow.',
  NO_ORGANIZATION: 'No active organization found for this account.',
  ACTIONS_QUERY_FAILED: 'Unable to load organization actions.',
  EVIDENCE_QUERY_FAILED: 'Unable to load action evidence.',
  UNEXPECTED_ERROR: 'Something went wrong while loading the action workflow.',
};

/* ============================================================
   Pure status helpers (exported for reuse)
   ============================================================ */

export function isCompleted(a: WorkflowAction): boolean {
  return a.status === 'Completed' || a.status === 'Verified';
}

export function isVerified(a: WorkflowAction): boolean {
  return a.status === 'Verified' || a.verified_at !== null;
}

export function isAwaitingEvidence(a: WorkflowAction): boolean {
  return a.status === 'Awaiting Evidence';
}

export function isAwaitingVerification(a: WorkflowAction): boolean {
  return a.status === 'Submitted for Verification';
}

export function isRevisionRequired(a: WorkflowAction): boolean {
  return a.status === 'Revision Required';
}

export function isDeferred(a: WorkflowAction): boolean {
  return a.status === 'Deferred';
}

export function isBlocked(a: WorkflowAction): boolean {
  return BLOCKED_STATUSES.has(a.status);
}

export function isOverdue(a: WorkflowAction): boolean {
  if (!a.due_date) return false;
  if (a.status === 'Completed' || a.status === 'Verified' || a.status === 'Deferred') return false;
  const today = todayDateOnly();
  const due = dateOnly(a.due_date);
  return today.getTime() > due.getTime();
}

export function daysOverdue(a: WorkflowAction): number {
  if (!a.due_date) return 0;
  const today = todayDateOnly();
  const due = dateOnly(a.due_date);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

export function requiresEvidence(a: WorkflowAction): boolean {
  return a.evidence_required === true;
}

/* ============================================================
   Date helpers (date-only comparison to avoid timezone errors)
   ============================================================ */

function todayDateOnly(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateOnly(value: string): Date {
  // due_date is a DATE column (YYYY-MM-DD). Append T00:00:00 to parse locally.
  return new Date(value + 'T00:00:00');
}

/* ============================================================
   Evidence helpers
   ============================================================ */

export function isEvidenceVerified(e: EvidenceRecord): boolean {
  return e.verification_status === APPROVED_STATUS;
}

export function isEvidenceSubmitted(e: EvidenceRecord): boolean {
  return SUBMITTED_STATUSES.has(e.verification_status);
}

export function isEvidenceRejectedOrRevision(e: EvidenceRecord): boolean {
  return REJECTED_OR_REVISION_STATUSES.has(e.verification_status);
}

/**
 * Build a per-action evidence summary from the action's evidence records.
 *
 * Evidence is complete only when:
 *   - the action does not require evidence, OR
 *   - the action requires evidence AND at least one valid evidence record
 *     exists AND at least one evidence record is Approved (verified).
 *
 * Action status alone never implies evidence completion.
 */
export function buildEvidenceSummary(
  action: WorkflowAction,
  evidence: EvidenceRecord[],
): ActionEvidenceSummary {
  const evidenceRequired = requiresEvidence(action);
  const submitted = evidence.filter(isEvidenceSubmitted);
  const verified = evidence.filter(isEvidenceVerified);
  const rejectedOrRevision = evidence.filter(isEvidenceRejectedOrRevision);

  const latestSubmittedAt = latestTimestamp(submitted.map((e) => e.submitted_at));
  const latestVerifiedAt = latestTimestamp(verified.map((e) => e.reviewed_at ?? e.submitted_at));

  const evidenceTypes = uniqueEvidenceTypes(evidence);

  let evidenceComplete: boolean;
  if (!evidenceRequired) {
    evidenceComplete = true;
  } else {
    evidenceComplete = evidence.length > 0 && verified.length > 0;
  }

  return {
    actionId: action.id,
    evidenceRequired,
    evidenceCount: evidence.length,
    evidenceSubmitted: submitted.length,
    evidenceVerified: verified.length,
    evidenceRejectedOrRevisionRequired: rejectedOrRevision.length,
    latestEvidenceSubmittedAt: latestSubmittedAt,
    latestEvidenceVerifiedAt: latestVerifiedAt,
    evidenceTypes,
    evidenceComplete,
  };
}

function latestTimestamp(values: (string | null)[]): string | null {
  let latest: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (latest === null || v > latest) latest = v;
  }
  return latest;
}

function uniqueEvidenceTypes(evidence: EvidenceRecord[]): EvidenceType[] {
  const seen = new Set<EvidenceType>();
  for (const e of evidence) seen.add(e.evidence_type);
  return Array.from(seen);
}

function evidenceByActionId(records: EvidenceRecord[]): Map<string, EvidenceRecord[]> {
  const map = new Map<string, EvidenceRecord[]>();
  for (const r of records) {
    const list = map.get(r.action_id);
    if (list) list.push(r);
    else map.set(r.action_id, [r]);
  }
  return map;
}

function enrichActions(
  actions: WorkflowAction[],
  evidenceMap: Map<string, EvidenceRecord[]>,
): WorkflowActionWithEvidence[] {
  return actions.map((a) => ({
    ...a,
    evidenceSummary: buildEvidenceSummary(a, evidenceMap.get(a.id) ?? []),
  }));
}

/* ============================================================
   Generic helpers
   ============================================================ */

export function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

/**
 * Evidence completion percentage: evidence-complete actions divided by
 * evidence-required actions. Returns 100 when no actions require evidence.
 */
export function evidencePct(evidenceComplete: number, evidenceRequired: number): number {
  if (evidenceRequired <= 0) return 100;
  return Math.round((evidenceComplete / evidenceRequired) * 100);
}

export function sortActions<T extends WorkflowAction>(actions: T[]): T[] {
  return [...actions].sort((a, b) => {
    // due_date ascending (nulls last)
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    } else if (a.due_date && !b.due_date) {
      return -1;
    } else if (!a.due_date && b.due_date) {
      return 1;
    }
    // created_at ascending
    if (a.created_at && b.created_at) {
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    }
    if (a.created_at) return -1;
    if (b.created_at) return 1;
    return 0;
  });
}

/* ============================================================
   Pure builders (exported for reuse and testing)
   ============================================================ */

export function buildActionGroups(actions: WorkflowActionWithEvidence[]): ActionGroup[] {
  return PRIORITY_ORDER.map((priority) => {
    const filtered = actions.filter((a) => a.priority === priority);
    return { priority, actions: sortActions(filtered), count: filtered.length };
  });
}

export function buildWorkflowSummary(actions: WorkflowActionWithEvidence[]): WorkflowSummary {
  return buildSummaryAndMetrics(actions);
}

export function buildCompletionMetrics(actions: WorkflowActionWithEvidence[]): CompletionMetrics {
  return buildSummaryAndMetrics(actions);
}

function buildSummaryAndMetrics(actions: WorkflowActionWithEvidence[]): WorkflowSummary & CompletionMetrics {
  const total = actions.length;
  const completedSet = actions.filter(isCompleted);
  const verifiedSet = actions.filter(isVerified);
  const completed = completedSet.length;
  const verified = verifiedSet.length;
  const awaitingEvidence = actions.filter(isAwaitingEvidence).length;
  const awaitingVerification = actions.filter(isAwaitingVerification).length;
  const revisionRequired = actions.filter(isRevisionRequired).length;
  const deferred = actions.filter(isDeferred).length;
  const blocked = actions.filter(isBlocked).length;
  const overdue = actions.filter(isOverdue).length;
  const notStarted = actions.filter((a) => a.status === 'Not Started').length;
  const inProgress = actions.filter((a) => a.status === 'In Progress').length;

  const evidenceRequiredActions = actions.filter((a) => a.evidenceSummary.evidenceRequired);
  const evidenceRequired = evidenceRequiredActions.length;
  const evidenceComplete = evidenceRequiredActions.filter((a) => a.evidenceSummary.evidenceComplete).length;

  return {
    totalActions: total,
    notStarted,
    inProgress,
    awaitingEvidence,
    awaitingVerification,
    revisionRequired,
    verified,
    completed,
    deferred,
    blocked,
    overdue,
    evidenceRequired,
    evidenceComplete,
    // completion = (completed + verified) / total, no double counting because
    // a Verified action is also counted as completed by isCompleted, and the
    // union is already what isCompleted returns.
    completionPercentage: pct(completed, total),
    verificationPercentage: pct(verified, total),
    evidenceCompletionPercentage: evidencePct(evidenceComplete, evidenceRequired),
  };
}

export function buildPillarSummaries(actions: WorkflowActionWithEvidence[]): PillarSummary[] {
  return PILLAR_ORDER.map((pillar) => {
    const pa = actions.filter((a) => a.pillar_name === pillar);
    const total = pa.length;
    const completed = pa.filter(isCompleted).length;
    const verified = pa.filter(isVerified).length;
    const deferred = pa.filter(isDeferred).length;
    const awaitingEvidence = pa.filter(isAwaitingEvidence).length;
    const awaitingVerification = pa.filter(isAwaitingVerification).length;
    const revisionRequired = pa.filter(isRevisionRequired).length;
    const evidenceRequiredActions = pa.filter((a) => a.evidenceSummary.evidenceRequired);
    const evidenceRequired = evidenceRequiredActions.length;
    const evidenceComplete = evidenceRequiredActions.filter((a) => a.evidenceSummary.evidenceComplete).length;
    const estGain = pa.reduce((s, a) => s + (a.estimated_pillar_score_increase ?? 0), 0);
    const averagePriority =
      total > 0
        ? Math.round((pa.reduce((s, a) => s + PRIORITY_RANK[a.priority], 0) / total) * 10) / 10
        : 0;
    return {
      pillar,
      totalActions: total,
      completed,
      verified,
      deferred,
      awaitingEvidence,
      awaitingVerification,
      revisionRequired,
      evidenceRequired,
      evidenceComplete,
      estimatedScoreGain: estGain,
      completionPercentage: pct(completed, total),
      averagePriority,
    };
  });
}

export function buildCertificationReadiness(
  actions: WorkflowActionWithEvidence[],
): CertificationReadiness {
  const certActions = actions.filter((a) => a.certification_requirement === true);
  const required = certActions.length;

  if (required === 0) {
    return {
      certificationActionsRequired: 0,
      certificationActionsCompleted: 0,
      certificationActionsVerified: 0,
      certificationEvidenceRequired: 0,
      certificationEvidenceComplete: 0,
      remainingActions: 0,
      requiredEvidenceComplete: false,
      verificationComplete: false,
      readyForCertification: false,
      reasons: [NO_CERT_REQUIREMENTS_REASON],
    };
  }

  const completed = certActions.filter(isCompleted).length;
  const verified = certActions.filter(isVerified).length;
  const evidenceRequiredActions = certActions.filter((a) => a.evidenceSummary.evidenceRequired);
  const evidenceRequired = evidenceRequiredActions.length;
  const evidenceComplete = evidenceRequiredActions.filter((a) => a.evidenceSummary.evidenceComplete).length;
  const remaining = certActions.filter((a) => !isVerified(a)).length;

  const requiredEvidenceComplete = evidenceRequired === 0 || evidenceComplete === evidenceRequired;
  const verificationComplete = verified === required;
  const ready = required > 0 && verificationComplete && requiredEvidenceComplete;

  const reasons: string[] = [];
  if (!requiredEvidenceComplete) {
    const incomplete = evidenceRequired - evidenceComplete;
    reasons.push(`${incomplete} certification action(s) still require verified evidence.`);
  }
  if (!verificationComplete) {
    reasons.push(`${remaining} certification action(s) are not yet verified.`);
  }
  if (ready) {
    reasons.push('All certification actions are verified and evidence is complete.');
  }

  return {
    certificationActionsRequired: required,
    certificationActionsCompleted: completed,
    certificationActionsVerified: verified,
    certificationEvidenceRequired: evidenceRequired,
    certificationEvidenceComplete: evidenceComplete,
    remainingActions: remaining,
    requiredEvidenceComplete,
    verificationComplete,
    readyForCertification: ready,
    reasons,
  };
}

export function buildOverdueActions(actions: WorkflowActionWithEvidence[]): OverdueAction[] {
  return sortActions(actions.filter(isOverdue)).map((action) => ({
    action,
    daysOverdue: daysOverdue(action),
  }));
}

/**
 * Build the full OrganizationWorkflow from enriched actions. Exported for
 * reuse and for testing the pure assembly without a database.
 */
export function buildOrganizationWorkflow(
  enriched: WorkflowActionWithEvidence[],
  organizationId: string,
  organizationName: string,
): OrganizationWorkflow {
  const sorted = sortActions(enriched);
  return {
    organization: {
      organizationId,
      organizationName,
      totalActions: sorted.length,
    },
    summary: buildWorkflowSummary(sorted),
    metrics: buildCompletionMetrics(sorted),
    pillarSummaries: buildPillarSummaries(sorted),
    actionGroups: buildActionGroups(sorted),
    actions: sorted,
    notStartedActions: sorted.filter((a) => a.status === 'Not Started'),
    inProgressActions: sorted.filter((a) => a.status === 'In Progress'),
    awaitingEvidenceActions: sorted.filter(isAwaitingEvidence),
    awaitingVerificationActions: sorted.filter(isAwaitingVerification),
    revisionRequiredActions: sorted.filter(isRevisionRequired),
    verifiedActions: sorted.filter(isVerified),
    completedActions: sorted.filter(isCompleted),
    deferredActions: sorted.filter(isDeferred),
    blockedActions: sorted.filter(isBlocked),
    overdueActions: buildOverdueActions(sorted),
    certificationReadiness: buildCertificationReadiness(sorted),
  };
}

/* ============================================================
   DB-backed entry point
   ============================================================ */

interface MembershipRow {
  organization_id: string;
  organizations: { id: string; organization_name: string } | null;
}

interface RawActionRow extends WorkflowAction {}

export async function getOrganizationWorkflow(): Promise<OrganizationWorkflowResult> {
  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'NOT_AUTHENTICATED', message: SAFE_MESSAGES.NOT_AUTHENTICATED } };
  }

  // 2. Resolve the caller's active organization (RLS-enforced)
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
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (!membership || !membership.organizations) {
    return { ok: false, error: { code: 'NO_ORGANIZATION', message: SAFE_MESSAGES.NO_ORGANIZATION } };
  }

  const organizationId = membership.organizations.id;
  const organizationName = membership.organizations.organization_name;

  // 3. Read organization_actions for the resolved organization (RLS-enforced)
  const { data: rawActions, error: actionsError } = (await supabase
    .from('organization_actions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true }) as unknown as Promise<{
      data: RawActionRow[] | null;
      error: { message?: string; code?: string } | null;
    }>);

  if (actionsError) {
    console.error('[actionWorkflowService] Actions query error:', actionsError.message);
    return { ok: false, error: { code: 'ACTIONS_QUERY_FAILED', message: SAFE_MESSAGES.ACTIONS_QUERY_FAILED } };
  }

  const actions: WorkflowAction[] = rawActions ?? [];

  // 4. Read action_evidence for the organization's actions only.
  //    Fetch only after organization access is resolved. RLS-enforced.
  let evidence: EvidenceRecord[] = [];
  if (actions.length > 0) {
    const { data: rawEvidence, error: evidenceError } = (await supabase
      .from('action_evidence')
      .select('*')
      .in('action_id', actions.map((a) => a.id))
      .order('created_at', { ascending: true }) as unknown as Promise<{
        data: EvidenceRecord[] | null;
        error: { message?: string; code?: string } | null;
      }>);

    if (evidenceError) {
      console.error('[actionWorkflowService] Evidence query error:', evidenceError.message);
      return { ok: false, error: { code: 'EVIDENCE_QUERY_FAILED', message: SAFE_MESSAGES.EVIDENCE_QUERY_FAILED } };
    }
    evidence = rawEvidence ?? [];
  }

  // 5. Enrich and assemble (pure, no DB)
  const evidenceMap = evidenceByActionId(evidence);
  const enriched = enrichActions(actions, evidenceMap);

  return { ok: true, data: buildOrganizationWorkflow(enriched, organizationId, organizationName) };
}
