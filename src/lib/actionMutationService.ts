/**
 * C-SHIFT Action Mutation Service.
 *
 * Wraps the SECURITY DEFINER RPCs that perform C-SHIFT Action Lifecycle
 * transitions. This service is the sole caller of those RPCs from React. It
 * validates input, calls each RPC exactly once, validates the returned row,
 * and maps database error tokens to safe application codes. Raw
 * Postgres/Supabase messages are never returned to callers.
 *
 * Transitions:
 *  - startAction:                       Not Started -> In Progress
 *  - moveActionToAwaitingEvidence:      In Progress  -> Awaiting Evidence
 */
import { supabase } from './supabase';
import type { PersistedOrganizationAction } from './actionPersistenceService';
import type { EvidenceRecord, EvidenceType } from './actionWorkflowService';

/* ============================================================
   Types
   ============================================================ */

export type StartActionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ACTION_ALREADY_STARTED'
  | 'INVALID_ACTION_STATUS'
  | 'ACTION_STATE_INCONSISTENT'
  | 'UNEXPECTED_ERROR';

export type StartActionResult =
  | { ok: true; action: PersistedOrganizationAction; message: string }
  | { ok: false; error: { code: StartActionErrorCode; message: string } };

/* ============================================================
   Internal: map RPC error tokens to safe application codes
   ============================================================ */

const RPC_TOKEN_MAP: Record<string, StartActionErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_ALREADY_STARTED: 'ACTION_ALREADY_STARTED',
  INVALID_ACTION_STATUS: 'INVALID_ACTION_STATUS',
  ACTION_STATE_INCONSISTENT: 'ACTION_STATE_INCONSISTENT',
};

const SAFE_MESSAGES: Record<StartActionErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to start this action.',
  ACTION_ALREADY_STARTED: 'This action has already been started.',
  INVALID_ACTION_STATUS: 'This action cannot be started from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid workflow state and could not be started.',
  UNEXPECTED_ERROR: 'We could not start this action. Please try again.',
};

function mapRpcError(message: string | undefined): StartActionErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return RPC_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

/* ============================================================
   Internal: validate the returned row shape
   ============================================================ */

function isPersistedRow(row: unknown): row is PersistedOrganizationAction {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.organization_id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.status === 'string' &&
    typeof r.pillar_name === 'string'
  );
}

/* ============================================================
   Public entry point
   ============================================================ */

export async function startAction(actionId: string): Promise<StartActionResult> {
  // 1. Validate input
  if (!actionId || actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // 2. Call the RPC exactly once.
  const { data, error } = (await supabase.rpc('start_organization_action', {
    p_action_id: actionId,
  })) as { data: unknown; error: { message?: string } | null };

  // 3. Map errors to safe codes; log technical details internally.
  if (error) {
    console.error('[actionMutationService] start_organization_action RPC error:', error.message);
    const code = mapRpcError(error.message);
    return { ok: false, error: { code, message: SAFE_MESSAGES[code] } };
  }

  // 4. Validate the returned row shape.
  if (!isPersistedRow(data)) {
    console.error('[actionMutationService] RPC returned unexpected row shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const row = data as PersistedOrganizationAction;

  // 5. Verify the transition actually occurred (defense in depth).
  if (row.status !== 'In Progress') {
    console.error('[actionMutationService] RPC returned status', row.status, 'expected In Progress');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return {
    ok: true,
    action: row,
    message: 'Action started successfully.',
  };
}

/* ============================================================
   move_action_to_awaiting_evidence: In Progress -> Awaiting Evidence
   ============================================================ */

export type AwaitingEvidenceErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ACTION_NOT_STARTED'
  | 'ACTION_ALREADY_AWAITING_EVIDENCE'
  | 'EVIDENCE_NOT_REQUIRED'
  | 'EVIDENCE_REQUIREMENTS_MISSING'
  | 'INVALID_ACTION_STATUS'
  | 'ACTION_STATE_INCONSISTENT'
  | 'UNEXPECTED_ERROR';

export type AwaitingEvidenceResult =
  | { ok: true; action: PersistedOrganizationAction; message: string }
  | { ok: false; error: { code: AwaitingEvidenceErrorCode; message: string } };

const EVIDENCE_RPC_TOKEN_MAP: Record<string, AwaitingEvidenceErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_NOT_STARTED: 'ACTION_NOT_STARTED',
  ACTION_ALREADY_AWAITING_EVIDENCE: 'ACTION_ALREADY_AWAITING_EVIDENCE',
  EVIDENCE_NOT_REQUIRED: 'EVIDENCE_NOT_REQUIRED',
  EVIDENCE_REQUIREMENTS_MISSING: 'EVIDENCE_REQUIREMENTS_MISSING',
  INVALID_ACTION_STATUS: 'INVALID_ACTION_STATUS',
  ACTION_STATE_INCONSISTENT: 'ACTION_STATE_INCONSISTENT',
};

const EVIDENCE_SAFE_MESSAGES: Record<AwaitingEvidenceErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to move this action to evidence collection.',
  ACTION_NOT_STARTED: 'This action must be started before evidence can be requested.',
  ACTION_ALREADY_AWAITING_EVIDENCE: 'This action is already awaiting evidence.',
  EVIDENCE_NOT_REQUIRED: 'This action does not require evidence and cannot enter the evidence collection stage.',
  EVIDENCE_REQUIREMENTS_MISSING: 'Evidence requirements must be defined before this action can move to Awaiting Evidence.',
  INVALID_ACTION_STATUS: 'This action cannot move to evidence collection from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid workflow state and could not be updated.',
  UNEXPECTED_ERROR: 'We could not move this action to evidence collection. Please try again.',
};

function mapEvidenceRpcError(message: string | undefined): AwaitingEvidenceErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return EVIDENCE_RPC_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

export async function moveActionToAwaitingEvidence(actionId: string): Promise<AwaitingEvidenceResult> {
  if (!actionId || actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: EVIDENCE_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const { data, error } = (await supabase.rpc('move_action_to_awaiting_evidence', {
    p_action_id: actionId,
  })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionMutationService] move_action_to_awaiting_evidence RPC error:', error.message);
    const code = mapEvidenceRpcError(error.message);
    return { ok: false, error: { code, message: EVIDENCE_SAFE_MESSAGES[code] } };
  }

  if (!isPersistedRow(data)) {
    console.error('[actionMutationService] evidence RPC returned unexpected row shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: EVIDENCE_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const row = data as PersistedOrganizationAction;

  if (row.status !== 'Awaiting Evidence') {
    console.error('[actionMutationService] evidence RPC returned status', row.status, 'expected Awaiting Evidence');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: EVIDENCE_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return {
    ok: true,
    action: row,
    message: 'Evidence collection is now required.',
  };
}

/* ============================================================
   create_action_evidence_draft / update_action_evidence_draft
   ============================================================ */

export type EvidenceDraftErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'EVIDENCE_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ACTION_NOT_STARTED'
  | 'ACTION_NOT_READY_FOR_EVIDENCE'
  | 'EVIDENCE_NOT_REQUIRED'
  | 'EVIDENCE_REQUIREMENTS_MISSING'
  | 'INVALID_ACTION_STATUS'
  | 'INVALID_EVIDENCE_TYPE'
  | 'EVIDENCE_CONTENT_REQUIRED'
  | 'INVALID_EXTERNAL_URL'
  | 'UNSAFE_EXTERNAL_URL'
  | 'EVIDENCE_NOT_EDITABLE'
  | 'UNEXPECTED_ERROR';

const DRAFT_TOKEN_MAP: Record<string, EvidenceDraftErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  EVIDENCE_NOT_FOUND: 'EVIDENCE_NOT_FOUND',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_NOT_STARTED: 'ACTION_NOT_STARTED',
  ACTION_NOT_READY_FOR_EVIDENCE: 'ACTION_NOT_READY_FOR_EVIDENCE',
  EVIDENCE_NOT_REQUIRED: 'EVIDENCE_NOT_REQUIRED',
  EVIDENCE_REQUIREMENTS_MISSING: 'EVIDENCE_REQUIREMENTS_MISSING',
  INVALID_ACTION_STATUS: 'INVALID_ACTION_STATUS',
  INVALID_EVIDENCE_TYPE: 'INVALID_EVIDENCE_TYPE',
  EVIDENCE_CONTENT_REQUIRED: 'EVIDENCE_CONTENT_REQUIRED',
  INVALID_EXTERNAL_URL: 'INVALID_EXTERNAL_URL',
  UNSAFE_EXTERNAL_URL: 'UNSAFE_EXTERNAL_URL',
  EVIDENCE_NOT_EDITABLE: 'EVIDENCE_NOT_EDITABLE',
};

const DRAFT_SAFE_MESSAGES: Record<EvidenceDraftErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  EVIDENCE_NOT_FOUND: 'This evidence record could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to manage evidence for this action.',
  ACTION_NOT_STARTED: 'This action must be started before evidence can be added.',
  ACTION_NOT_READY_FOR_EVIDENCE: 'This action is not ready to receive evidence.',
  EVIDENCE_NOT_REQUIRED: 'This action does not require evidence.',
  EVIDENCE_REQUIREMENTS_MISSING: 'Evidence requirements have not been defined for this action.',
  INVALID_ACTION_STATUS: 'This action cannot receive evidence in its current status.',
  INVALID_EVIDENCE_TYPE: 'Select a valid evidence type.',
  EVIDENCE_CONTENT_REQUIRED: 'Provide evidence content before saving this draft.',
  INVALID_EXTERNAL_URL: 'Enter a valid web address.',
  UNSAFE_EXTERNAL_URL: 'This type of link is not permitted.',
  EVIDENCE_NOT_EDITABLE: 'This evidence record can no longer be edited.',
  UNEXPECTED_ERROR: 'We could not save this evidence draft. Please try again.',
};

function mapDraftRpcError(message: string | undefined): EvidenceDraftErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return DRAFT_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

const VALID_EVIDENCE_TYPES: ReadonlySet<string> = new Set<EvidenceType>([
  'document', 'image', 'website_link', 'written_response', 'completed_form',
  'meeting_record', 'policy', 'budget', 'board_roster', 'board_matrix',
  'strategic_plan', 'logic_model', 'outcome_report', 'financial_report',
  'filing_confirmation', 'workshop_completion', 'other',
]);

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

function normalizeOptional(v: string | null | undefined): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : v;
}

export interface CreateEvidenceDraftInput {
  actionId: string;
  evidenceType: EvidenceType;
  externalUrl?: string | null;
  writtenResponse?: string | null;
  submissionNotes?: string | null;
  fileUrl?: string | null;
}

export type CreateEvidenceDraftResult =
  | { ok: true; evidence: EvidenceRecord; message: string }
  | { ok: false; error: { code: EvidenceDraftErrorCode; message: string } };

export async function createEvidenceDraft(input: CreateEvidenceDraftInput): Promise<CreateEvidenceDraftResult> {
  if (!input.actionId || input.actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: DRAFT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (!VALID_EVIDENCE_TYPES.has(input.evidenceType)) {
    return { ok: false, error: { code: 'INVALID_EVIDENCE_TYPE', message: DRAFT_SAFE_MESSAGES.INVALID_EVIDENCE_TYPE } };
  }

  const { data, error } = (await supabase.rpc('create_action_evidence_draft', {
    p_action_id: input.actionId,
    p_evidence_type: input.evidenceType,
    p_external_url: normalizeOptional(input.externalUrl),
    p_written_response: normalizeOptional(input.writtenResponse),
    p_submission_notes: normalizeOptional(input.submissionNotes),
    p_file_url: normalizeOptional(input.fileUrl),
  })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionMutationService] create_action_evidence_draft RPC error:', error.message);
    const code = mapDraftRpcError(error.message);
    return { ok: false, error: { code, message: DRAFT_SAFE_MESSAGES[code] } };
  }

  if (!isEvidenceRow(data)) {
    console.error('[actionMutationService] evidence RPC returned unexpected row shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: DRAFT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const row = data as EvidenceRecord;
  if (row.verification_status !== 'Draft') {
    console.error('[actionMutationService] evidence RPC returned status', row.verification_status, 'expected Draft');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: DRAFT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return { ok: true, evidence: row, message: 'Evidence draft saved.' };
}

export interface UpdateEvidenceDraftInput {
  evidenceId: string;
  evidenceType: EvidenceType;
  externalUrl?: string | null;
  writtenResponse?: string | null;
  submissionNotes?: string | null;
  fileUrl?: string | null;
}

export type UpdateEvidenceDraftResult =
  | { ok: true; evidence: EvidenceRecord; message: string }
  | { ok: false; error: { code: EvidenceDraftErrorCode; message: string } };

export async function updateEvidenceDraft(input: UpdateEvidenceDraftInput): Promise<UpdateEvidenceDraftResult> {
  if (!input.evidenceId || input.evidenceId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: DRAFT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (!VALID_EVIDENCE_TYPES.has(input.evidenceType)) {
    return { ok: false, error: { code: 'INVALID_EVIDENCE_TYPE', message: DRAFT_SAFE_MESSAGES.INVALID_EVIDENCE_TYPE } };
  }

  const { data, error } = (await supabase.rpc('update_action_evidence_draft', {
    p_evidence_id: input.evidenceId,
    p_evidence_type: input.evidenceType,
    p_external_url: normalizeOptional(input.externalUrl),
    p_written_response: normalizeOptional(input.writtenResponse),
    p_submission_notes: normalizeOptional(input.submissionNotes),
    p_file_url: normalizeOptional(input.fileUrl),
  })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionMutationService] update_action_evidence_draft RPC error:', error.message);
    const code = mapDraftRpcError(error.message);
    return { ok: false, error: { code, message: DRAFT_SAFE_MESSAGES[code] } };
  }

  if (!isEvidenceRow(data)) {
    console.error('[actionMutationService] update evidence RPC returned unexpected row shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: DRAFT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const row = data as EvidenceRecord;
  if (row.verification_status !== 'Draft') {
    console.error('[actionMutationService] update evidence RPC returned status', row.verification_status, 'expected Draft');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: DRAFT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return { ok: true, evidence: row, message: 'Evidence draft updated.' };
}
