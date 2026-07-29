/**
 * C-SHIFT Action Plan Persistence Layer.
 *
 * Converts the validated output of generateProposedActionPlan into persisted
 * organization_actions rows via a single SECURITY DEFINER RPC. The TypeScript
 * Action Template Library remains the source of recommendation content; this
 * service only shapes the payload, calls the RPC once, and maps errors.
 */
import { supabase } from './supabase';
import {
  generateProposedActionPlan,
  type ProposedAction,
} from './actionPlanService';

export type ActionPillarName =
  | 'Clarity'
  | 'Structure'
  | 'Health'
  | 'Impact'
  | 'Funding'
  | 'Transformation';

export type ActionPriorityDb =
  | 'Critical'
  | 'High'
  | 'Moderate'
  | 'Low';

export interface PersistedOrganizationAction {
  id: string;
  organization_id: string;
  assessment_id: string | null;
  pillar_name: ActionPillarName;
  action_category: string | null;
  title: string;
  description: string;
  why_it_matters: string | null;
  why_funders_care: string | null;
  priority: ActionPriorityDb;
  status: string;
  estimated_completion_days: number | null;
  evidence_required: boolean | null;
  evidence_requirements: string | null;
  estimated_pillar_score_increase: number | null;
  estimated_overall_score_increase: number | null;
  source_type: string | null;
  source_reference: string | null;
  created_at: string | null;
  assigned_user_id: string | null;
  due_date: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  certification_requirement: boolean | null;
  updated_at: string | null;
  review_claimed_by: string | null;
  review_claimed_at: string | null;
}

export type ActionPersistenceErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ASSESSMENT_NOT_FOUND'
  | 'ASSESSMENT_NOT_COMPLETED'
  | 'ASSESSMENT_NOT_LINKED'
  | 'NOT_AUTHORIZED'
  | 'ACTION_PLAN_ALREADY_CREATED'
  | 'DUPLICATE_ACTIONS_EXIST'
  | 'INVALID_ACTION_PLAN'
  | 'ACTION_MISMATCH'
  | 'INCOMPLETE_ACTION_PLAN'
  | 'NO_ACTION_PLAN_REQUIRED'
  | 'GENERATION_FAILED'
  | 'UNEXPECTED_ERROR';

export type ActionPersistenceResult =
  | {
      ok: true;
      assessmentId: string;
      organizationId: string;
      actions: PersistedOrganizationAction[];
      actionCount: number;
    }
  | {
      ok: false;
      error: { code: ActionPersistenceErrorCode; message: string };
    };

/* ============================================================
   Internal: shape a ProposedAction into the RPC payload object
   ============================================================ */

interface RpcActionPayload {
  templateId: string;
  assessmentId: string;
  organizationId: string;
  pillar: string;
  questionIndex: number;
  questionText: string;
  answerScore: number;
  title: string;
  description: string;
  whyItMatters: string;
  whyFundersCare: string;
  evidenceRequirements: string;
  estimatedCompletionDays: number;
  priority: string;
  actionCategory: string;
  sourceReference: string;
  estimatedPillarScoreIncrease: number;
  estimatedOverallScoreIncrease: number;
}

function toRpcPayload(a: ProposedAction): RpcActionPayload {
  return {
    templateId: a.templateId,
    assessmentId: a.assessmentId,
    organizationId: a.organizationId,
    pillar: a.pillar,
    questionIndex: a.questionIndex,
    questionText: a.questionText,
    answerScore: a.answerScore,
    title: a.title,
    description: a.description,
    whyItMatters: a.whyItMatters,
    whyFundersCare: a.whyFundersCare,
    evidenceRequirements: a.evidenceRequirements,
    estimatedCompletionDays: a.estimatedCompletionDays,
    priority: a.priority,
    actionCategory: a.actionCategory,
    sourceReference: a.sourceReference,
    estimatedPillarScoreIncrease: a.estimatedPillarScoreIncrease,
    estimatedOverallScoreIncrease: a.estimatedOverallScoreIncrease,
  };
}

/* ============================================================
   Internal: map a PostgREST/RPC error to a safe application code
   ============================================================ */

// Map the leading token the RPC raises (e.g. "NOT_AUTHORIZED: ...") to the
// application code. Falls back to UNEXPECTED_ERROR for unknown tokens.
const RPC_TOKEN_MAP: Record<string, ActionPersistenceErrorCode> = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  ASSESSMENT_NOT_FOUND: 'ASSESSMENT_NOT_FOUND',
  ASSESSMENT_NOT_COMPLETED: 'ASSESSMENT_NOT_COMPLETED',
  ASSESSMENT_NOT_LINKED: 'ASSESSMENT_NOT_LINKED',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ACTION_PLAN_ALREADY_CREATED: 'ACTION_PLAN_ALREADY_CREATED',
  DUPLICATE_ACTIONS_EXIST: 'DUPLICATE_ACTIONS_EXIST',
  INVALID_ACTION_PLAN: 'INVALID_ACTION_PLAN',
  INVALID_ACTION_FIELD: 'INVALID_ACTION_PLAN',
  ACTION_MISMATCH: 'ACTION_MISMATCH',
  DUPLICATE_ACTIONS: 'INVALID_ACTION_PLAN',
  INCOMPLETE_ACTION_PLAN: 'INCOMPLETE_ACTION_PLAN',
  NO_ACTION_PLAN_REQUIRED: 'NO_ACTION_PLAN_REQUIRED',
};

// Safe user-facing messages per code. Never expose raw DB text.
const SAFE_MESSAGES: Record<ActionPersistenceErrorCode, string> = {
  NOT_AUTHENTICATED: 'You must be signed in to persist an action plan.',
  ASSESSMENT_NOT_FOUND: 'The assessment could not be found.',
  ASSESSMENT_NOT_COMPLETED: 'Actions can only be persisted for completed assessments.',
  ASSESSMENT_NOT_LINKED: 'This assessment is not linked to an organization.',
  NOT_AUTHORIZED: 'Only organization admins or C-SHIFT platform admins may persist an action plan.',
  ACTION_PLAN_ALREADY_CREATED: 'An action plan has already been created for this assessment.',
  DUPLICATE_ACTIONS_EXIST: 'Actions already exist for this assessment.',
  INVALID_ACTION_PLAN: 'The action plan payload was invalid.',
  ACTION_MISMATCH: 'One or more actions did not match the assessment answers.',
  INCOMPLETE_ACTION_PLAN: 'The action plan does not cover all weak assessment answers.',
  NO_ACTION_PLAN_REQUIRED: 'This assessment has no weak answers; no action plan is required.',
  GENERATION_FAILED: 'Unable to generate the proposed action plan.',
  UNEXPECTED_ERROR: 'Something went wrong while persisting the action plan.',
};

function mapRpcError(message: string | undefined): ActionPersistenceErrorCode {
  if (!message) return 'UNEXPECTED_ERROR';
  const token = message.split(':')[0].trim();
  return RPC_TOKEN_MAP[token] ?? 'UNEXPECTED_ERROR';
}

/* ============================================================
   Internal: validate the returned rows
   ============================================================ */

function isPersistedRow(row: unknown): row is PersistedOrganizationAction {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.organization_id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.description === 'string' &&
    typeof r.priority === 'string' &&
    typeof r.status === 'string' &&
    typeof r.pillar_name === 'string'
  );
}

/* ============================================================
   Public entry point
   ============================================================ */

export async function persistAssessmentActionPlan(
  assessmentId: string,
): Promise<ActionPersistenceResult> {
  // 1. Generate the validated proposed plan. Stop immediately on error.
  const proposed = await generateProposedActionPlan(assessmentId);
  if (!proposed.ok) {
    // Generation already returned a typed error; map its codes onto ours.
    const code: ActionPersistenceErrorCode =
      proposed.error.code === 'NOT_AUTHENTICATED' ? 'NOT_AUTHENTICATED' :
      proposed.error.code === 'ASSESSMENT_NOT_FOUND' ? 'ASSESSMENT_NOT_FOUND' :
      proposed.error.code === 'ASSESSMENT_NOT_COMPLETED' ? 'ASSESSMENT_NOT_COMPLETED' :
      proposed.error.code === 'ASSESSMENT_NOT_LINKED' ? 'ASSESSMENT_NOT_LINKED' :
      proposed.error.code === 'NOT_AUTHORIZED' ? 'NOT_AUTHORIZED' :
      'GENERATION_FAILED';
    return {
      ok: false,
      error: { code, message: SAFE_MESSAGES[code] },
    };
  }

  // 2. No weak answers -> short-circuit before calling the RPC.
  if (proposed.proposedActions.length === 0) {
    return {
      ok: false,
      error: { code: 'NO_ACTION_PLAN_REQUIRED', message: SAFE_MESSAGES.NO_ACTION_PLAN_REQUIRED },
    };
  }

  // 3. Shape and call the persistence RPC once.
  const payload = proposed.proposedActions.map(toRpcPayload);
  const { data, error } = (await supabase
    .rpc('persist_assessment_action_plan', {
      p_assessment_id: assessmentId,
      p_actions: payload,
    })) as { data: unknown; error: { message?: string } | null };

  if (error) {
    console.error('[actionPersistenceService] RPC error:', error.message);
    const code = mapRpcError(error.message);
    return { ok: false, error: { code, message: SAFE_MESSAGES[code] } };
  }

  // 4. Validate the returned rows.
  if (!Array.isArray(data)) {
    console.error('[actionPersistenceService] RPC returned non-array data');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (data.length !== payload.length) {
    console.error(
      `[actionPersistenceService] RPC inserted ${data.length} rows, expected ${payload.length}`,
    );
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }
  if (!data.every(isPersistedRow)) {
    console.error('[actionPersistenceService] RPC returned rows with unexpected shape');
    return { ok: false, error: { code: 'UNEXPECTED_ERROR', message: SAFE_MESSAGES.UNEXPECTED_ERROR } };
  }

  // 5. Return the inserted actions.
  return {
    ok: true,
    assessmentId: proposed.assessmentId,
    organizationId: proposed.organizationId,
    actions: data as PersistedOrganizationAction[],
    actionCount: data.length,
  };
}
