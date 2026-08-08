/**
 * C-SHIFT Review Queue Read Service — read-only.
 *
 * Loads actions submitted for verification AND actions returned for revision
 * for the C-SHIFT reviewer queue.
 *
 * No database writes.
 */
import { supabase } from './supabase';
import type { EvidenceRecord } from './actionWorkflowService';

/* ============================================================
   Types
   ============================================================ */

export interface ReviewQueueItem {
  id: string;
  organization_id: string;
  organization_name: string;
  pillar_name: string;
  title: string;
  priority: string;
  status: string;
  submitted_at: string | null;
  due_date: string | null;
  evidence_required: boolean | null;
  evidence_requirements: string | null;
  certification_requirement: boolean | null;
  submitted_evidence_count: number;
  under_review_evidence_count: number;
  revision_required_evidence_count: number;
  approved_evidence_count: number;
  unresolved_revision_draft_count: number;
  verification_ready: boolean;
  review_claimed_by: string | null;
  review_claimed_at: string | null;
}

export interface ReviewActionDetail extends ReviewQueueItem {
  evidence: EvidenceRecord[];
}

/* ============================================================
   V1 Verification Readiness Rule
   ============================================================

   verificationReady is true when:
   - evidence_required = false (no evidence needed)
   - OR evidence_required = true AND:
     approved_count >= 1
     under_review_count = 0
     submitted_count = 0
     revision_required_count = 0
     unresolved_revision_draft_count = 0

   An "unresolved revision draft" is a Draft evidence record with non-null
   organization_visible_notes (returned revision item).
   ============================================================ */

export function computeVerificationReady(params: {
  evidenceRequired: boolean | null;
  approvedCount: number;
  underReviewCount: number;
  submittedCount: number;
  revisionRequiredCount: number;
  unresolvedRevisionDraftCount: number;
}): boolean {
  if (params.evidenceRequired !== true) return true;
  return (
    params.approvedCount >= 1 &&
    params.underReviewCount === 0 &&
    params.submittedCount === 0 &&
    params.revisionRequiredCount === 0 &&
    params.unresolvedRevisionDraftCount === 0
  );
}

export type ReviewQueueErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_AUTHORIZED'
  | 'QUEUE_QUERY_FAILED'
  | 'DETAIL_QUERY_FAILED'
  | 'EVIDENCE_QUERY_FAILED'
  | 'UNEXPECTED_ERROR';

export type ReviewQueueResult =
  | { ok: true; items: ReviewQueueItem[] }
  | { ok: false; error: { code: ReviewQueueErrorCode; message: string } };

export type ReviewActionDetailResult =
  | { ok: true; action: ReviewActionDetail }
  | { ok: false; error: { code: ReviewQueueErrorCode; message: string } };

const SAFE_MESSAGES: Record<ReviewQueueErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  NOT_AUTHORIZED: 'You do not have permission to access the review queue.',
  QUEUE_QUERY_FAILED: 'Unable to load the review queue at this time.',
  DETAIL_QUERY_FAILED: 'Unable to load this review action at this time.',
  EVIDENCE_QUERY_FAILED: 'Unable to load evidence for this action at this time.',
  UNEXPECTED_ERROR: 'Unable to load the review queue at this time.',
};

/* ============================================================
   Internal: validate row shapes
   ============================================================ */

interface RawActionRow {
  id: string;
  organization_id: string;
  pillar_name: string;
  title: string;
  priority: string;
  status: string;
  submitted_at: string | null;
  due_date: string | null;
  evidence_required: boolean | null;
  evidence_requirements: string | null;
  certification_requirement: boolean | null;
  review_claimed_by: string | null;
  review_claimed_at: string | null;
  organizations: { name: string } | null;
}

function isRawActionRow(row: unknown): row is RawActionRow {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.organization_id === 'string' &&
    typeof r.pillar_name === 'string' &&
    typeof r.title === 'string' &&
    typeof r.status === 'string'
  );
}

function isEvidenceRow(row: unknown): row is EvidenceRecord {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.action_id === 'string' &&
    typeof r.organization_id === 'string' &&
    typeof r.submitted_by === 'string' &&
    typeof r.evidence_type === 'string' &&
    typeof r.verification_status === 'string'
  );
}

/* ============================================================
   Public: getReviewQueue
   ============================================================ */

export async function getReviewQueue(): Promise<ReviewQueueResult> {
  const { data, error } = (await supabase
    .from('organization_actions')
    .select(`
      id, organization_id, pillar_name, title, priority, status,
      submitted_at, due_date, evidence_required, evidence_requirements,
      certification_requirement, review_claimed_by, review_claimed_at,
      organizations!inner ( name )
    `)
    .in('status', ['Submitted for Verification', 'Revision Required'])
    .order('submitted_at', { ascending: true })) as { data: unknown; error: { message?: string; code?: string } | null };

  if (error) {
    console.error('[reviewQueueService] queue query error:', error.message);
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      return { ok: false, error: { code: 'NOT_AUTHENTICATED', message: SAFE_MESSAGES.NOT_AUTHENTICATED } };
    }
    return { ok: false, error: { code: 'QUEUE_QUERY_FAILED', message: SAFE_MESSAGES.QUEUE_QUERY_FAILED } };
  }

  if (!Array.isArray(data)) {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const rows = (data as unknown[]).filter(isRawActionRow) as RawActionRow[];

  // Fetch evidence counts in a single query
  const actionIds = rows.map((r) => r.id);
  let submittedCounts: Record<string, number> = {};
  let underReviewCounts: Record<string, number> = {};
  let revisionRequiredCounts: Record<string, number> = {};
  let approvedCounts: Record<string, number> = {};
  let unresolvedDraftCounts: Record<string, number> = {};

  if (actionIds.length > 0) {
    const { data: evData, error: evError } = (await supabase
      .from('action_evidence')
      .select('action_id, verification_status, organization_visible_notes')
      .in('action_id', actionIds)) as { data: { action_id: string; verification_status: string; organization_visible_notes: string | null }[] | null; error: { message?: string } | null };

    if (evError) {
      console.error('[reviewQueueService] evidence count query error:', evError.message);
    } else if (evData) {
      for (const ev of evData) {
        if (ev.verification_status === 'Submitted') {
          submittedCounts[ev.action_id] = (submittedCounts[ev.action_id] ?? 0) + 1;
        } else if (ev.verification_status === 'Under Review') {
          underReviewCounts[ev.action_id] = (underReviewCounts[ev.action_id] ?? 0) + 1;
        } else if (ev.verification_status === 'Additional Information Required') {
          revisionRequiredCounts[ev.action_id] = (revisionRequiredCounts[ev.action_id] ?? 0) + 1;
        } else if (ev.verification_status === 'Approved') {
          approvedCounts[ev.action_id] = (approvedCounts[ev.action_id] ?? 0) + 1;
        } else if (ev.verification_status === 'Draft' && ev.organization_visible_notes) {
          unresolvedDraftCounts[ev.action_id] = (unresolvedDraftCounts[ev.action_id] ?? 0) + 1;
        }
      }
    }
  }

  const items: ReviewQueueItem[] = rows.map((r) => ({
    id: r.id,
    organization_id: r.organization_id,
    organization_name: r.organizations?.name ?? 'Unknown Organization',
    pillar_name: r.pillar_name,
    title: r.title,
    priority: r.priority,
    status: r.status,
    submitted_at: r.submitted_at,
    due_date: r.due_date,
    evidence_required: r.evidence_required,
    evidence_requirements: r.evidence_requirements,
    certification_requirement: r.certification_requirement,
    submitted_evidence_count: submittedCounts[r.id] ?? 0,
    under_review_evidence_count: underReviewCounts[r.id] ?? 0,
    revision_required_evidence_count: revisionRequiredCounts[r.id] ?? 0,
    approved_evidence_count: approvedCounts[r.id] ?? 0,
    unresolved_revision_draft_count: unresolvedDraftCounts[r.id] ?? 0,
    verification_ready: computeVerificationReady({
      evidenceRequired: r.evidence_required,
      approvedCount: approvedCounts[r.id] ?? 0,
      underReviewCount: underReviewCounts[r.id] ?? 0,
      submittedCount: submittedCounts[r.id] ?? 0,
      revisionRequiredCount: revisionRequiredCounts[r.id] ?? 0,
      unresolvedRevisionDraftCount: unresolvedDraftCounts[r.id] ?? 0,
    }),
    review_claimed_by: r.review_claimed_by,
    review_claimed_at: r.review_claimed_at,
  }));

  return { ok: true, items };
}

/* ============================================================
   Public: getReviewAction
   ============================================================ */

export async function getReviewAction(actionId: string): Promise<ReviewActionDetailResult> {
  if (!actionId || actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const { data, error } = (await supabase
    .from('organization_actions')
    .select(`
      id, organization_id, pillar_name, title, priority, status,
      submitted_at, due_date, evidence_required, evidence_requirements,
      certification_requirement, review_claimed_by, review_claimed_at,
      organizations!inner ( name )
    `)
    .eq('id', actionId)
    .maybeSingle()) as { data: unknown; error: { message?: string; code?: string } | null };

  if (error) {
    console.error('[reviewQueueService] detail query error:', error.message);
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      return { ok: false, error: { code: 'NOT_AUTHENTICATED', message: SAFE_MESSAGES.NOT_AUTHENTICATED } };
    }
    return { ok: false, error: { code: 'DETAIL_QUERY_FAILED', message: SAFE_MESSAGES.DETAIL_QUERY_FAILED } };
  }

  if (!isRawActionRow(data)) {
    return { ok: false, error: { code: 'DETAIL_QUERY_FAILED', message: SAFE_MESSAGES.DETAIL_QUERY_FAILED } };
  }

  const row = data as RawActionRow;

  const { data: evData, error: evError } = (await supabase
    .from('action_evidence')
    .select('*')
    .eq('action_id', actionId)
    .order('created_at', { ascending: true })) as { data: unknown; error: { message?: string } | null };

  if (evError) {
    console.error('[reviewQueueService] evidence query error:', evError.message);
    return { ok: false, error: { code: 'EVIDENCE_QUERY_FAILED', message: SAFE_MESSAGES.EVIDENCE_QUERY_FAILED } };
  }

  const evidence = Array.isArray(evData) ? (evData as unknown[]).filter(isEvidenceRow) as EvidenceRecord[] : [];

  let submittedCount = 0;
  let underReviewCount = 0;
  let revisionRequiredCount = 0;
  let approvedCount = 0;
  let unresolvedDraftCount = 0;
  for (const ev of evidence) {
    if (ev.verification_status === 'Submitted') submittedCount++;
    else if (ev.verification_status === 'Under Review') underReviewCount++;
    else if (ev.verification_status === 'Additional Information Required') revisionRequiredCount++;
    else if (ev.verification_status === 'Approved') approvedCount++;
    else if (ev.verification_status === 'Draft' && ev.organization_visible_notes) unresolvedDraftCount++;
  }

  const verificationReady = computeVerificationReady({
    evidenceRequired: row.evidence_required,
    approvedCount,
    underReviewCount,
    submittedCount,
    revisionRequiredCount,
    unresolvedRevisionDraftCount: unresolvedDraftCount,
  });

  const action: ReviewActionDetail = {
    id: row.id,
    organization_id: row.organization_id,
    organization_name: row.organizations?.name ?? 'Unknown Organization',
    pillar_name: row.pillar_name,
    title: row.title,
    priority: row.priority,
    status: row.status,
    submitted_at: row.submitted_at,
    due_date: row.due_date,
    evidence_required: row.evidence_required,
    evidence_requirements: row.evidence_requirements,
    certification_requirement: row.certification_requirement,
    submitted_evidence_count: submittedCount,
    under_review_evidence_count: underReviewCount,
    revision_required_evidence_count: revisionRequiredCount,
    approved_evidence_count: approvedCount,
    unresolved_revision_draft_count: unresolvedDraftCount,
    verification_ready: verificationReady,
    review_claimed_by: row.review_claimed_by,
    review_claimed_at: row.review_claimed_at,
    evidence,
  };

  return { ok: true, action };
}
