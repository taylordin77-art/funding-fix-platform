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

/* ============================================================
   submit_action_evidence: Draft -> Submitted + Action -> Submitted for Verification
   ============================================================ */

export type SubmitActionEvidenceErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ACTION_NOT_STARTED'
  | 'ACTION_NOT_READY_FOR_SUBMISSION'
  | 'ACTION_ALREADY_SUBMITTED'
  | 'EVIDENCE_NOT_REQUIRED'
  | 'EVIDENCE_REQUIREMENTS_MISSING'
  | 'NO_EVIDENCE_SELECTED'
  | 'EVIDENCE_NOT_FOUND'
  | 'EVIDENCE_ACTION_MISMATCH'
  | 'EVIDENCE_ORGANIZATION_MISMATCH'
  | 'EVIDENCE_NOT_SUBMITTABLE'
  | 'EVIDENCE_CONTENT_INVALID'
  | 'INVALID_ACTION_STATUS'
  | 'ACTION_STATE_INCONSISTENT'
  | 'UNEXPECTED_ERROR';

export interface SubmitActionEvidenceInput {
  actionId: string;
  evidenceIds: string[];
}

export type SubmitActionEvidenceResult =
  | {
      ok: true;
      action: PersistedOrganizationAction;
      evidence: EvidenceRecord[];
      evidenceCount: number;
      message: string;
    }
  | {
      ok: false;
      error: { code: SubmitActionEvidenceErrorCode; message: string };
    };

const SUBMIT_TOKEN_MAP: Record<string, SubmitActionEvidenceErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_NOT_STARTED: 'ACTION_NOT_STARTED',
  ACTION_NOT_READY_FOR_SUBMISSION: 'ACTION_NOT_READY_FOR_SUBMISSION',
  ACTION_ALREADY_SUBMITTED: 'ACTION_ALREADY_SUBMITTED',
  EVIDENCE_NOT_REQUIRED: 'EVIDENCE_NOT_REQUIRED',
  EVIDENCE_REQUIREMENTS_MISSING: 'EVIDENCE_REQUIREMENTS_MISSING',
  NO_EVIDENCE_SELECTED: 'NO_EVIDENCE_SELECTED',
  EVIDENCE_NOT_FOUND: 'EVIDENCE_NOT_FOUND',
  EVIDENCE_ACTION_MISMATCH: 'EVIDENCE_ACTION_MISMATCH',
  EVIDENCE_ORGANIZATION_MISMATCH: 'EVIDENCE_ORGANIZATION_MISMATCH',
  EVIDENCE_NOT_SUBMITTABLE: 'EVIDENCE_NOT_SUBMITTABLE',
  EVIDENCE_CONTENT_INVALID: 'EVIDENCE_CONTENT_INVALID',
  INVALID_ACTION_STATUS: 'INVALID_ACTION_STATUS',
  ACTION_STATE_INCONSISTENT: 'ACTION_STATE_INCONSISTENT',
};

const SUBMIT_SAFE_MESSAGES: Record<SubmitActionEvidenceErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to submit evidence for this action.',
  ACTION_NOT_STARTED: 'This action must be started before evidence can be submitted.',
  ACTION_NOT_READY_FOR_SUBMISSION: 'This action is not ready for evidence submission.',
  ACTION_ALREADY_SUBMITTED: 'This action has already been submitted for verification.',
  EVIDENCE_NOT_REQUIRED: 'This action does not require evidence.',
  EVIDENCE_REQUIREMENTS_MISSING: 'Evidence requirements have not been defined for this action.',
  NO_EVIDENCE_SELECTED: 'Select at least one Draft evidence record.',
  EVIDENCE_NOT_FOUND: 'One or more selected evidence records could not be found.',
  EVIDENCE_ACTION_MISMATCH: 'One or more selected evidence records do not belong to this action.',
  EVIDENCE_ORGANIZATION_MISMATCH: 'One or more selected evidence records do not belong to this organization.',
  EVIDENCE_NOT_SUBMITTABLE: 'One or more selected evidence records can no longer be submitted.',
  EVIDENCE_CONTENT_INVALID: 'One or more selected evidence records do not contain valid evidence content.',
  INVALID_ACTION_STATUS: 'This action cannot be submitted from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid workflow state and could not be submitted.',
  UNEXPECTED_ERROR: 'We could not submit this evidence. Please try again.',
};

function mapSubmitRpcError(message: string | undefined): SubmitActionEvidenceErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return SUBMIT_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

function isActionRow(row: unknown): row is PersistedOrganizationAction {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.organization_id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.status === 'string'
  );
}

export async function submitActionEvidence(input: SubmitActionEvidenceInput): Promise<SubmitActionEvidenceResult> {
  if (!input.actionId || input.actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // Normalize evidence IDs: trim, remove empty, deduplicate
  const uniqueIds = [...new Set(input.evidenceIds.map((id) => id.trim()).filter((id) => id !== ''))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: { code: 'NO_EVIDENCE_SELECTED', message: SUBMIT_SAFE_MESSAGES.NO_EVIDENCE_SELECTED } };
  }

  const { data, error } = (await supabase.rpc('submit_action_evidence', {
    p_action_id: input.actionId,
    p_evidence_ids: uniqueIds,
  })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionMutationService] submit_action_evidence RPC error:', error.message);
    const code = mapSubmitRpcError(error.message);
    return { ok: false, error: { code, message: SUBMIT_SAFE_MESSAGES[code] } };
  }

  // Validate returned structure
  if (!data || typeof data !== 'object') {
    console.error('[actionMutationService] submit RPC returned unexpected shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const result = data as Record<string, unknown>;
  const actionRow = result.action;
  const evidenceArray = result.evidence;
  const evidenceCount = result.evidence_count;

  if (!isActionRow(actionRow)) {
    console.error('[actionMutationService] submit RPC returned invalid action row');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const action = actionRow as PersistedOrganizationAction;
  if (action.status !== 'Submitted for Verification') {
    console.error('[actionMutationService] submit RPC returned action status', action.status, 'expected Submitted for Verification');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  if (!Array.isArray(evidenceArray)) {
    console.error('[actionMutationService] submit RPC returned non-array evidence');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const evidence = (evidenceArray as unknown[]).filter(isEvidenceRow) as EvidenceRecord[];
  if (evidence.length !== uniqueIds.length) {
    console.error('[actionMutationService] submit RPC returned evidence count mismatch');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  for (const ev of evidence) {
    if (ev.verification_status !== 'Submitted') {
      console.error('[actionMutationService] submit RPC returned evidence with status', ev.verification_status, 'expected Submitted');
      return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
    }
  }

  if (typeof evidenceCount !== 'number' || evidenceCount !== uniqueIds.length) {
    console.error('[actionMutationService] submit RPC returned invalid evidence_count');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SUBMIT_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return {
    ok: true,
    action,
    evidence,
    evidenceCount: evidenceCount,
    message: 'Evidence submitted for verification.',
  };
}

/* ============================================================
   claim_action_for_review: Submitted -> Under Review + claim ownership
   ============================================================ */

export type ClaimActionForReviewErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ACTION_NOT_SUBMITTED'
  | 'ACTION_ALREADY_CLAIMED'
  | 'ACTION_ALREADY_CLAIMED_BY_YOU'
  | 'NO_SUBMITTED_EVIDENCE'
  | 'EVIDENCE_PACKAGE_INCONSISTENT'
  | 'INVALID_ACTION_STATUS'
  | 'ACTION_STATE_INCONSISTENT'
  | 'UNEXPECTED_ERROR';

export type ClaimActionForReviewResult =
  | {
      ok: true;
      action: PersistedOrganizationAction;
      evidence: EvidenceRecord[];
      evidenceCount: number;
      reviewerId: string;
      claimedAt: string;
      message: string;
    }
  | {
      ok: false;
      error: { code: ClaimActionForReviewErrorCode; message: string };
    };

const CLAIM_TOKEN_MAP: Record<string, ClaimActionForReviewErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_NOT_SUBMITTED: 'ACTION_NOT_SUBMITTED',
  ACTION_ALREADY_CLAIMED: 'ACTION_ALREADY_CLAIMED',
  ACTION_ALREADY_CLAIMED_BY_YOU: 'ACTION_ALREADY_CLAIMED_BY_YOU',
  NO_SUBMITTED_EVIDENCE: 'NO_SUBMITTED_EVIDENCE',
  EVIDENCE_PACKAGE_INCONSISTENT: 'EVIDENCE_PACKAGE_INCONSISTENT',
  INVALID_ACTION_STATUS: 'INVALID_ACTION_STATUS',
  ACTION_STATE_INCONSISTENT: 'ACTION_STATE_INCONSISTENT',
};

const CLAIM_SAFE_MESSAGES: Record<ClaimActionForReviewErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This review action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to claim reviews.',
  ACTION_NOT_SUBMITTED: 'This action has not been submitted for verification.',
  ACTION_ALREADY_CLAIMED: 'This action has already been claimed by another reviewer.',
  ACTION_ALREADY_CLAIMED_BY_YOU: 'You have already claimed this action.',
  NO_SUBMITTED_EVIDENCE: 'This action does not contain submitted evidence to review.',
  EVIDENCE_PACKAGE_INCONSISTENT: 'The submitted evidence package is in an inconsistent review state.',
  INVALID_ACTION_STATUS: 'This action cannot be claimed from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid workflow state and cannot be claimed.',
  UNEXPECTED_ERROR: 'We could not claim this review. Please try again.',
};

function mapClaimRpcError(message: string | undefined): ClaimActionForReviewErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return CLAIM_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

export async function claimActionForReview(actionId: string): Promise<ClaimActionForReviewResult> {
  if (!actionId || actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const { data, error } = (await supabase.rpc('claim_action_for_review', {
    p_action_id: actionId,
  })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionMutationService] claim_action_for_review RPC error:', error.message);
    const code = mapClaimRpcError(error.message);
    return { ok: false, error: { code, message: CLAIM_SAFE_MESSAGES[code] } };
  }

  if (!data || typeof data !== 'object') {
    console.error('[actionMutationService] claim RPC returned unexpected shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const result = data as Record<string, unknown>;
  const actionRow = result.action;
  const evidenceArray = result.evidence;
  const evidenceCount = result.evidence_count;
  const reviewerId = result.reviewer_id;
  const claimedAt = result.claimed_at;

  if (!isActionRow(actionRow)) {
    console.error('[actionMutationService] claim RPC returned invalid action row');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const action = actionRow as PersistedOrganizationAction;
  if (action.status !== 'Submitted for Verification') {
    console.error('[actionMutationService] claim RPC returned action status', action.status, 'expected Submitted for Verification');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  if (!Array.isArray(evidenceArray)) {
    console.error('[actionMutationService] claim RPC returned non-array evidence');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const evidence = (evidenceArray as unknown[]).filter(isEvidenceRow) as EvidenceRecord[];
  for (const ev of evidence) {
    if (ev.verification_status !== 'Under Review') {
      console.error('[actionMutationService] claim RPC returned evidence with status', ev.verification_status, 'expected Under Review');
      return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
    }
  }

  if (typeof evidenceCount !== 'number' || evidenceCount !== evidence.length) {
    console.error('[actionMutationService] claim RPC returned invalid evidence_count');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  if (typeof reviewerId !== 'string' || typeof claimedAt !== 'string') {
    console.error('[actionMutationService] claim RPC returned invalid reviewer_id or claimed_at');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: CLAIM_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return {
    ok: true,
    action,
    evidence,
    evidenceCount: evidenceCount,
    reviewerId,
    claimedAt,
    message: 'Review claimed successfully.',
  };
}

/* ============================================================
   request_additional_information: Under Review -> Additional Information Required
   ============================================================ */

export type RequestAdditionalInformationErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACTION_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'ACTION_NOT_SUBMITTED'
  | 'REVIEW_NOT_CLAIMED'
  | 'REVIEW_NOT_OWNED'
  | 'ACTION_ALREADY_RETURNED_FOR_REVISION'
  | 'NO_EVIDENCE_SELECTED'
  | 'EVIDENCE_NOT_FOUND'
  | 'EVIDENCE_ACTION_MISMATCH'
  | 'EVIDENCE_ORGANIZATION_MISMATCH'
  | 'EVIDENCE_NOT_UNDER_REVIEW'
  | 'EVIDENCE_REVIEWER_MISMATCH'
  | 'ORGANIZATION_NOTES_REQUIRED'
  | 'INVALID_ACTION_STATUS'
  | 'ACTION_STATE_INCONSISTENT'
  | 'UNEXPECTED_ERROR';

export interface RequestAdditionalInformationInput {
  actionId: string;
  evidenceIds: string[];
  organizationVisibleNotes: string;
  reviewerNotes?: string | null;
}

export type RequestAdditionalInformationResult =
  | {
      ok: true;
      action: PersistedOrganizationAction;
      evidence: EvidenceRecord[];
      evidenceCount: number;
      reviewerId: string;
      organizationVisibleNotes: string;
      message: string;
    }
  | {
      ok: false;
      error: { code: RequestAdditionalInformationErrorCode; message: string };
    };

const REQUEST_TOKEN_MAP: Record<string, RequestAdditionalInformationErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_NOT_SUBMITTED: 'ACTION_NOT_SUBMITTED',
  REVIEW_NOT_CLAIMED: 'REVIEW_NOT_CLAIMED',
  REVIEW_NOT_OWNED: 'REVIEW_NOT_OWNED',
  ACTION_ALREADY_RETURNED_FOR_REVISION: 'ACTION_ALREADY_RETURNED_FOR_REVISION',
  NO_EVIDENCE_SELECTED: 'NO_EVIDENCE_SELECTED',
  EVIDENCE_NOT_FOUND: 'EVIDENCE_NOT_FOUND',
  EVIDENCE_ACTION_MISMATCH: 'EVIDENCE_ACTION_MISMATCH',
  EVIDENCE_ORGANIZATION_MISMATCH: 'EVIDENCE_ORGANIZATION_MISMATCH',
  EVIDENCE_NOT_UNDER_REVIEW: 'EVIDENCE_NOT_UNDER_REVIEW',
  EVIDENCE_REVIEWER_MISMATCH: 'EVIDENCE_REVIEWER_MISMATCH',
  ORGANIZATION_NOTES_REQUIRED: 'ORGANIZATION_NOTES_REQUIRED',
  INVALID_ACTION_STATUS: 'INVALID_ACTION_STATUS',
  ACTION_STATE_INCONSISTENT: 'ACTION_STATE_INCONSISTENT',
};

const REQUEST_SAFE_MESSAGES: Record<RequestAdditionalInformationErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This review action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to make this review decision.',
  ACTION_NOT_SUBMITTED: 'This action has not been submitted for review.',
  REVIEW_NOT_CLAIMED: 'This action has not been claimed for review.',
  REVIEW_NOT_OWNED: 'You are not the assigned reviewer for this action.',
  ACTION_ALREADY_RETURNED_FOR_REVISION: 'This action has already been returned to the organization for revision.',
  NO_EVIDENCE_SELECTED: 'Select at least one Under Review evidence record.',
  EVIDENCE_NOT_FOUND: 'One or more selected evidence records could not be found.',
  EVIDENCE_ACTION_MISMATCH: 'One or more selected evidence records do not belong to this action.',
  EVIDENCE_ORGANIZATION_MISMATCH: 'One or more selected evidence records do not belong to this organization.',
  EVIDENCE_NOT_UNDER_REVIEW: 'One or more selected evidence records are no longer Under Review.',
  EVIDENCE_REVIEWER_MISMATCH: 'One or more selected evidence records are assigned to another reviewer.',
  ORGANIZATION_NOTES_REQUIRED: 'Provide clear instructions explaining what the organization needs to revise.',
  INVALID_ACTION_STATUS: 'This action cannot be returned for revision from its current status.',
  ACTION_STATE_INCONSISTENT: 'This review has an invalid workflow state and could not be updated.',
  UNEXPECTED_ERROR: 'We could not request additional information. Please try again.',
};

function mapRequestRpcError(message: string | undefined): RequestAdditionalInformationErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return REQUEST_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

export async function requestAdditionalInformation(
  input: RequestAdditionalInformationInput,
): Promise<RequestAdditionalInformationResult> {
  // 1. Validate action ID
  if (!input.actionId || input.actionId.trim() === '') {
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // 2. Validate evidence IDs — deduplicate, require at least one
  const uniqueIds = [...new Set(input.evidenceIds.filter((id) => id && id.trim() !== ''))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: { code: 'NO_EVIDENCE_SELECTED', message: REQUEST_SAFE_MESSAGES.NO_EVIDENCE_SELECTED } };
  }

  // 3. Validate required organization-visible notes
  const trimmedOrgNotes = (input.organizationVisibleNotes ?? '').trim();
  if (trimmedOrgNotes === '') {
    return { ok: false, error: { code: 'ORGANIZATION_NOTES_REQUIRED', message: REQUEST_SAFE_MESSAGES.ORGANIZATION_NOTES_REQUIRED } };
  }

  // 4. Call the RPC exactly once
  const { data, error } = (await supabase.rpc('request_additional_information', {
    p_action_id: input.actionId,
    p_evidence_ids: uniqueIds,
    p_organization_visible_notes: trimmedOrgNotes,
    p_reviewer_notes: input.reviewerNotes?.trim() || null,
  })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionMutationService] request_additional_information RPC error:', error.message);
    const code = mapRequestRpcError(error.message);
    return { ok: false, error: { code, message: REQUEST_SAFE_MESSAGES[code] } };
  }

  if (!data || typeof data !== 'object') {
    console.error('[actionMutationService] request RPC returned unexpected shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const result = data as Record<string, unknown>;
  const actionRow = result.action;
  const evidenceArray = result.evidence;
  const evidenceCount = result.evidence_count;
  const reviewerId = result.reviewer_id;
  const orgNotes = result.organization_visible_notes;

  // 5. Validate returned action
  if (!isActionRow(actionRow)) {
    console.error('[actionMutationService] request RPC returned invalid action row');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const action = actionRow as PersistedOrganizationAction;

  // 6. Confirm action.status = 'Revision Required'
  if (action.status !== 'Revision Required') {
    console.error('[actionMutationService] request RPC returned action status', action.status, 'expected Revision Required');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // 7. Validate returned evidence
  if (!Array.isArray(evidenceArray)) {
    console.error('[actionMutationService] request RPC returned non-array evidence');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  const evidence = (evidenceArray as unknown[]).filter(isEvidenceRow) as EvidenceRecord[];

  // 8. Confirm every returned record has verification_status = 'Additional Information Required'
  for (const ev of evidence) {
    if (ev.verification_status !== 'Additional Information Required') {
      console.error('[actionMutationService] request RPC returned evidence with status', ev.verification_status, 'expected Additional Information Required');
      return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
    }
  }

  // 9. Confirm organization_visible_notes is populated
  if (typeof orgNotes !== 'string' || orgNotes.trim() === '') {
    console.error('[actionMutationService] request RPC returned empty organization_visible_notes');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // 10. Confirm reviewed_by remains populated
  for (const ev of evidence) {
    if (!ev.reviewed_by) {
      console.error('[actionMutationService] request RPC returned evidence with null reviewed_by');
      return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
    }
  }

  // 11. Validate evidenceCount
  if (typeof evidenceCount !== 'number' || evidenceCount !== evidence.length) {
    console.error('[actionMutationService] request RPC returned invalid evidence_count');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // 12. Validate reviewerId
  if (typeof reviewerId !== 'string') {
    console.error('[actionMutationService] request RPC returned invalid reviewer_id');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: REQUEST_SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  return {
    ok: true,
    action,
    evidence,
    evidenceCount: evidenceCount,
    reviewerId,
    organizationVisibleNotes: orgNotes,
    message: 'Additional information requested.',
  };
}
