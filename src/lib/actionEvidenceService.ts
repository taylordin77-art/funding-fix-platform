/**
 * C-SHIFT Action Evidence Read Service.
 *
 * Read-only service that loads individual action_evidence records for a given
 * action. RLS ensures only evidence for the caller's organization (or C-SHIFT
 * admin) is returned. No writes.
 */
import { supabase } from './supabase';
import type { EvidenceRecord, EvidenceType } from './actionWorkflowService';

/* ============================================================
   Types
   ============================================================ */

export type ActionEvidenceErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'QUERY_FAILED'
  | 'UNEXPECTED_ERROR';

export type ActionEvidenceResult =
  | { ok: true; actionId: string; evidence: EvidenceRecord[] }
  | { ok: false; error: { code: ActionEvidenceErrorCode; message: string } };

const SAFE_MESSAGES: Record<ActionEvidenceErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to view evidence for this action.',
  QUERY_FAILED: 'Unable to load evidence at this time.',
  UNEXPECTED_ERROR: 'Unable to load evidence at this time.',
};

/* ============================================================
   Internal: validate the returned row shape
   ============================================================ */

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
   Public entry point
   ============================================================ */

export async function getActionEvidence(actionId: string): Promise<ActionEvidenceResult> {
  if (!actionId || actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const { data, error } = (await supabase
    .from('action_evidence')
    .select('*')
    .eq('action_id', actionId)
    .order('created_at', { ascending: true })) as { data: unknown; error: { message?: string; code?: string } | null };

  if (error) {
    console.error('[actionEvidenceService] query error:', error.message);
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      return { ok: false, error: { code: 'NOT_AUTHENTICATED', message: SAFE_MESSAGES.NOT_AUTHENTICATED } };
    }
    return { ok: false, error: { code: 'QUERY_FAILED', message: SAFE_MESSAGES.QUERY_FAILED } };
  }

  if (!Array.isArray(data)) {
    console.error('[actionEvidenceService] unexpected response shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const evidence = (data as unknown[]).filter(isEvidenceRow) as EvidenceRecord[];

  return { ok: true, actionId, evidence };
}

/* ============================================================
   Evidence type labels (display only; stored value is the DB value)
   ============================================================ */

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  document: 'Document',
  image: 'Image',
  website_link: 'Website Link',
  written_response: 'Written Response',
  completed_form: 'Completed Form',
  meeting_record: 'Meeting Record',
  policy: 'Policy',
  budget: 'Budget',
  board_roster: 'Board Roster',
  board_matrix: 'Board Matrix',
  strategic_plan: 'Strategic Plan',
  logic_model: 'Logic Model',
  outcome_report: 'Outcome Report',
  financial_report: 'Financial Report',
  filing_confirmation: 'Filing Confirmation',
  workshop_completion: 'Workshop Completion',
  other: 'Other',
};

export const EVIDENCE_TYPE_OPTIONS: { value: EvidenceType; label: string }[] = (
  Object.entries(EVIDENCE_TYPE_LABELS) as [EvidenceType, string][]
).map(([value, label]) => ({ value, label }));
