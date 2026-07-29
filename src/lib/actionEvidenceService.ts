/**
 * C-SHIFT Action Evidence Read Service.
 *
 * Read-only service that loads individual action_evidence records for a given
 * action. RLS ensures only evidence for the caller's organization (or C-SHIFT
 * admin) is returned. No writes.
 */
import { supabase } from './supabase';
import type { EvidenceRecord, EvidenceType, EvidenceVerificationStatus } from './actionWorkflowService';

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
  | { ok: true; actionId: string; evidence: OrganizationEvidenceRecord[] }
  | { ok: false; error: { code: ActionEvidenceErrorCode; message: string } };

const SAFE_MESSAGES: Record<ActionEvidenceErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to view evidence for this action.',
  QUERY_FAILED: 'Unable to load evidence at this time.',
  UNEXPECTED_ERROR: 'Unable to load evidence at this time.',
};

/* ============================================================
   Organization-safe evidence DTO
   ============================================================ */

/**
 * Organization-safe evidence record. Excludes reviewer_notes, reviewed_by,
 * submitted_by, and any internal reviewer identity fields. This is the only
 * type that should be consumed by organization-facing React components.
 */
export interface OrganizationEvidenceRecord {
  id: string;
  action_id: string;
  evidence_type: EvidenceType;
  verification_status: EvidenceVerificationStatus;
  file_url: string | null;
  external_url: string | null;
  written_response: string | null;
  submission_notes: string | null;
  organization_visible_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Strip internal reviewer fields from an EvidenceRecord before exposing it
 * to organization-facing code. Never expose reviewer_notes, reviewed_by, or
 * submitted_by to the organization.
 */
export function toOrganizationEvidence(ev: EvidenceRecord): OrganizationEvidenceRecord {
  return {
    id: ev.id,
    action_id: ev.action_id,
    evidence_type: ev.evidence_type,
    verification_status: ev.verification_status,
    file_url: ev.file_url,
    external_url: ev.external_url,
    written_response: ev.written_response,
    submission_notes: ev.submission_notes,
    organization_visible_notes: ev.organization_visible_notes,
    submitted_at: ev.submitted_at,
    reviewed_at: ev.reviewed_at,
    created_at: ev.created_at,
    updated_at: ev.updated_at,
  };
}

/**
 * Map an array of EvidenceRecord to the organization-safe DTO.
 */
export function toOrganizationEvidenceList(evidence: EvidenceRecord[]): OrganizationEvidenceRecord[] {
  return evidence.map(toOrganizationEvidence);
}

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

  // Select all columns (RLS-protected) but strip internal fields via DTO
  // before returning to organization-facing React.
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

  const rawEvidence = (data as unknown[]).filter(isEvidenceRow) as EvidenceRecord[];
  const evidence = toOrganizationEvidenceList(rawEvidence);

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
