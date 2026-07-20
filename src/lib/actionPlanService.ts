/**
 * C-SHIFT Action Plan Generator — read-only proposed plan service.
 *
 * Reads one completed, organization-linked assessment and its 30 assessment_answers,
 * matches weak answers (score <= 3) to ACTION_TEMPLATES, and returns a prioritized
 * proposed action plan. Performs NO database writes.
 */
import { supabase } from './supabase';
import {
  ACTION_TEMPLATES,
  getTemplate,
  type ActionPillar,
  type ActionPriority,
  type ActionTemplate,
} from './actionTemplates';

export type AssessmentAnswerPillar =
  | 'clarity'
  | 'structure'
  | 'health'
  | 'impact'
  | 'funding'
  | 'transformation';

export interface ProposedAction {
  templateId: string;
  assessmentId: string;
  organizationId: string;
  pillar: ActionPillar;
  questionIndex: number;
  questionText: string;
  answerScore: number;
  title: string;
  description: string;
  whyItMatters: string;
  whyFundersCare: string;
  evidenceRequirements: string;
  estimatedCompletionDays: number;
  priority: ActionPriority;
  actionCategory: string;
  recommendedResources: string[];
  sourceReference: string;
  estimatedPillarScoreIncrease: number;
  estimatedOverallScoreIncrease: number;
}

export interface ActionPlanSummary {
  totalActions: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  byPillar: Record<ActionPillar, number>;
}

export type ActionPlanErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ASSESSMENT_NOT_FOUND'
  | 'ASSESSMENT_NOT_COMPLETED'
  | 'ASSESSMENT_NOT_LINKED'
  | 'NOT_AUTHORIZED'
  | 'ANSWERS_NOT_FOUND'
  | 'TEMPLATE_NOT_FOUND'
  | 'UNEXPECTED_ERROR';

export type ActionPlanResult =
  | {
      ok: true;
      assessmentId: string;
      organizationId: string;
      proposedActions: ProposedAction[];
      summary: ActionPlanSummary;
    }
  | {
      ok: false;
      error: { code: ActionPlanErrorCode; message: string };
    };

/* ============================================================
   Constants & pure mapping tables
   ============================================================ */

const PILLAR_ORDER = ['Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transformation'] as const;
const PRIORITY_ORDER = ['Critical', 'High', 'Moderate', 'Low'] as const;
const WEAK_SCORE_THRESHOLD = 3;
const TOTAL_QUESTIONS = 30;

const PILLAR_MAP: Record<AssessmentAnswerPillar, ActionPillar> = {
  clarity: 'Clarity',
  structure: 'Structure',
  health: 'Health',
  impact: 'Impact',
  funding: 'Funding',
  transformation: 'Transformation',
};

const SCORE_PRIORITY_MAP: Record<number, ActionPriority> = {
  1: 'Critical',
  2: 'High',
  3: 'Moderate',
};

const VALID_ANSWER_PILLARS: AssessmentAnswerPillar[] = [
  'clarity', 'structure', 'health', 'impact', 'funding', 'transformation',
];

/* ============================================================
   Pure helpers (exported for testability and reuse)
   ============================================================ */

export function mapPillar(pillar: AssessmentAnswerPillar): ActionPillar {
  return PILLAR_MAP[pillar];
}

export function priorityFromScore(score: number): ActionPriority | null {
  return SCORE_PRIORITY_MAP[score] ?? null;
}

export function isWeakScore(score: number): boolean {
  return score >= 1 && score <= WEAK_SCORE_THRESHOLD;
}

export function sortProposedActions(actions: ProposedAction[]): ProposedAction[] {
  return [...actions].sort((a, b) => {
    const pr = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (pr !== 0) return pr;
    const prr = PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar);
    if (prr !== 0) return prr;
    return a.questionIndex - b.questionIndex;
  });
}

export function buildSummary(actions: ProposedAction[]): ActionPlanSummary {
  const byPillar: Record<ActionPillar, number> = {
    Clarity: 0,
    Structure: 0,
    Health: 0,
    Impact: 0,
    Funding: 0,
    Transformation: 0,
  };
  let critical = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  for (const a of actions) {
    byPillar[a.pillar] += 1;
    if (a.priority === 'Critical') critical += 1;
    else if (a.priority === 'High') high += 1;
    else if (a.priority === 'Moderate') moderate += 1;
    else if (a.priority === 'Low') low += 1;
  }
  return { totalActions: actions.length, critical, high, moderate, low, byPillar };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function estimatedOverall(score: number): number {
  return round2(((5 - score) / 150) * 100);
}

/* ============================================================
   Answer row type + validation
   ============================================================ */

interface AssessmentAnswerRow {
  assessment_id: string;
  pillar: string;
  question_index: number;
  question_text: string;
  score: number;
}

interface AssessmentRow {
  id: string;
  organization_id: string | null;
  status: string | null;
  created_action_plan: boolean | null;
}

interface MembershipRow {
  organization_id: string;
}

function isValidAnswerPillar(p: string): p is AssessmentAnswerPillar {
  return VALID_ANSWER_PILLARS.includes(p as AssessmentAnswerPillar);
}

function validateAnswer(row: AssessmentAnswerRow): boolean {
  if (!isValidAnswerPillar(row.pillar)) return false;
  if (!Number.isInteger(row.question_index) || row.question_index < 0 || row.question_index > 4) return false;
  if (!Number.isInteger(row.score) || row.score < 1 || row.score > 5) return false;
  return true;
}

/* ============================================================
   Core pure builder (testable without DB)
   ============================================================ */

export function buildProposedActionsFromAnswers(
  answers: AssessmentAnswerRow[],
  assessmentId: string,
  organizationId: string,
): { ok: true; actions: ProposedAction[] } | { ok: false; error: { code: ActionPlanErrorCode; message: string } } {
  const proposed: ProposedAction[] = [];

  for (const answer of answers) {
    if (!validateAnswer(answer)) {
      console.error(
        `[actionPlanService] Invalid answer row: pillar=${answer.pillar} idx=${answer.question_index} score=${answer.score}`,
      );
      return {
        ok: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: 'One or more assessment answers could not be processed.',
        },
      };
    }

    if (!isWeakScore(answer.score)) continue;

    const mappedPillar = mapPillar(answer.pillar);
    const template: ActionTemplate | undefined = getTemplate(mappedPillar, answer.question_index);
    if (!template) {
      console.error(
        `[actionPlanService] Missing template for pillar=${answer.pillar} questionIndex=${answer.question_index}`,
      );
      return {
        ok: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'A recommendation template could not be found for a weak assessment answer.',
        },
      };
    }

    const priority = priorityFromScore(answer.score);
    if (!priority) continue;

    proposed.push({
      templateId: template.id,
      assessmentId,
      organizationId,
      pillar: mappedPillar,
      questionIndex: answer.question_index,
      questionText: answer.question_text,
      answerScore: answer.score,
      title: template.title,
      description: template.description,
      whyItMatters: template.whyItMatters,
      whyFundersCare: template.whyFundersCare,
      evidenceRequirements: template.evidenceRequirements,
      estimatedCompletionDays: template.estimatedCompletionDays,
      priority,
      actionCategory: template.actionCategory,
      recommendedResources: [...template.recommendedResources],
      sourceReference: `${answer.pillar}:${answer.question_index}`,
      estimatedPillarScoreIncrease: 5 - answer.score,
      estimatedOverallScoreIncrease: estimatedOverall(answer.score),
    });
  }

  return { ok: true, actions: sortProposedActions(proposed) };
}

/* ============================================================
   Public DB-backed entry point
   ============================================================ */

export async function generateProposedActionPlan(
  assessmentId: string,
): Promise<ActionPlanResult> {
  // 1. Require authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'You must be signed in to generate an action plan.' },
    };
  }

  // 2. Load the assessment (RLS-enforced)
  const { data: assessment, error: assessmentError } = (await supabase
    .from('assessments')
    .select('id, organization_id, status, created_action_plan')
    .eq('id', assessmentId)
    .maybeSingle()) as { data: AssessmentRow | null; error: { code?: string; message?: string } | null };

  if (assessmentError) {
    console.error('[actionPlanService] Assessment query error:', assessmentError.message);
    return {
      ok: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Unable to load the assessment.' },
    };
  }
  if (!assessment) {
    return {
      ok: false,
      error: { code: 'ASSESSMENT_NOT_FOUND', message: 'The assessment could not be found.' },
    };
  }

  // 3. Validate completed + organization-linked
  if (assessment.status !== 'completed') {
    return {
      ok: false,
      error: { code: 'ASSESSMENT_NOT_COMPLETED', message: 'Actions can only be generated for completed assessments.' },
    };
  }
  if (!assessment.organization_id) {
    return {
      ok: false,
      error: { code: 'ASSESSMENT_NOT_LINKED', message: 'This assessment is not linked to an organization.' },
    };
  }

  const organizationId = assessment.organization_id;

  // 4. Confirm the authenticated user is an active member of that organization
  const { data: membership, error: membershipError } = (await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .maybeSingle()) as { data: MembershipRow | null; error: { code?: string; message?: string } | null };

  if (membershipError) {
    console.error('[actionPlanService] Membership query error:', membershipError.message);
    return {
      ok: false,
      error: { code: 'NOT_AUTHORIZED', message: 'Unable to verify organization membership.' },
    };
  }
  if (!membership) {
    return {
      ok: false,
      error: { code: 'NOT_AUTHORIZED', message: 'You do not have access to this organization.' },
    };
  }

  // 5. Read assessment_answers (RLS-enforced)
  const { data: answers, error: answersError } = (await supabase
    .from('assessment_answers')
    .select('assessment_id, pillar, question_index, question_text, score')
    .eq('assessment_id', assessmentId)
    .order('pillar', { ascending: true })
    .order('question_index', { ascending: true }) as unknown as Promise<{ data: AssessmentAnswerRow[] | null; error: { code?: string; message?: string } | null }>);

  if (answersError) {
    console.error('[actionPlanService] Answers query error:', answersError.message);
    return {
      ok: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Unable to load assessment answers.' },
    };
  }
  if (!answers || answers.length === 0) {
    return {
      ok: false,
      error: { code: 'ANSWERS_NOT_FOUND', message: 'No assessment answers were found for this assessment.' },
    };
  }
  if (answers.length !== TOTAL_QUESTIONS) {
    console.warn(
      `[actionPlanService] Expected ${TOTAL_QUESTIONS} answers for assessment ${assessmentId}, got ${answers.length}.`,
    );
  }

  // 6. Build the proposed action plan (pure logic, no DB)
  const built = buildProposedActionsFromAnswers(answers, assessmentId, organizationId);
  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  return {
    ok: true,
    assessmentId,
    organizationId,
    proposedActions: built.actions,
    summary: buildSummary(built.actions),
  };
}

// Re-export for convenience
export { ACTION_TEMPLATES };
