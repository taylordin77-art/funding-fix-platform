/**
 * C-SHIFT Action Template Library
 *
 * Foundation for the Action Generation Engine.
 * One template per assessment question (6 pillars x 5 questions = 30).
 * Consumed later by the Action Generator. Does NOT create organization_actions.
 *
 * Content is placeholder. The final C-SHIFT recommendations will be inserted later.
 */

export type ActionPriority = 'Critical' | 'High' | 'Moderate' | 'Low';

export type ActionPillar =
  | 'Clarity'
  | 'Structure'
  | 'Health'
  | 'Impact'
  | 'Funding'
  | 'Transformation';

export interface ActionTemplate {
  id: string;
  pillar: ActionPillar;
  questionIndex: number;
  title: string;
  description: string;
  whyItMatters: string;
  whyFundersCare: string;
  evidenceRequirements: string;
  estimatedCompletionDays: number;
  defaultPriority: ActionPriority;
  actionCategory: string;
  recommendedResources: string[];
}

const PLACEHOLDER = 'The final C-SHIFT recommendation will be inserted later.';
const PENDING_RESOURCES = ['Template pending'];

/* ============================================================
   CLARITY
   ============================================================ */
const CLARITY_TEMPLATES: ActionTemplate[] = [
  {
    id: 'clarity-0',
    pillar: 'Clarity',
    questionIndex: 0,
    title: 'Mission statement (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Critical',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'clarity-1',
    pillar: 'Clarity',
    questionIndex: 1,
    title: 'Vision documentation (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'High',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'clarity-2',
    pillar: 'Clarity',
    questionIndex: 2,
    title: 'Theory of change (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'High',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'clarity-3',
    pillar: 'Clarity',
    questionIndex: 3,
    title: 'Mission alignment across stakeholders (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Moderate',
    actionCategory: 'Communications',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'clarity-4',
    pillar: 'Clarity',
    questionIndex: 4,
    title: 'Strategic plan alignment (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'Moderate',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
];

/* ============================================================
   STRUCTURE
   ============================================================ */
const STRUCTURE_TEMPLATES: ActionTemplate[] = [
  {
    id: 'structure-0',
    pillar: 'Structure',
    questionIndex: 0,
    title: 'Board composition and roles (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'Critical',
    actionCategory: 'Governance',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'structure-1',
    pillar: 'Structure',
    questionIndex: 1,
    title: 'Bylaws review (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'High',
    actionCategory: 'Governance',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'structure-2',
    pillar: 'Structure',
    questionIndex: 2,
    title: 'Documented policies (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'High',
    actionCategory: 'Governance',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'structure-3',
    pillar: 'Structure',
    questionIndex: 3,
    title: 'Compliance and filings (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Moderate',
    actionCategory: 'Compliance',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'structure-4',
    pillar: 'Structure',
    questionIndex: 4,
    title: 'Organizational chart and roles (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Moderate',
    actionCategory: 'Operations',
    recommendedResources: PENDING_RESOURCES,
  },
];

/* ============================================================
   HEALTH
   ============================================================ */
const HEALTH_TEMPLATES: ActionTemplate[] = [
  {
    id: 'health-0',
    pillar: 'Health',
    questionIndex: 0,
    title: 'Operating reserve (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 90,
    defaultPriority: 'Critical',
    actionCategory: 'Financial Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'health-1',
    pillar: 'Health',
    questionIndex: 1,
    title: 'Monthly budget vs. actual reporting (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'High',
    actionCategory: 'Financial Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'health-2',
    pillar: 'Health',
    questionIndex: 2,
    title: 'Revenue diversification (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 90,
    defaultPriority: 'High',
    actionCategory: 'Financial Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'health-3',
    pillar: 'Health',
    questionIndex: 3,
    title: 'Board-approved annual budget (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Moderate',
    actionCategory: 'Financial Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'health-4',
    pillar: 'Health',
    questionIndex: 4,
    title: 'Audit or financial review (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'Moderate',
    actionCategory: 'Compliance',
    recommendedResources: PENDING_RESOURCES,
  },
];

/* ============================================================
   IMPACT
   ============================================================ */
const IMPACT_TEMPLATES: ActionTemplate[] = [
  {
    id: 'impact-0',
    pillar: 'Impact',
    questionIndex: 0,
    title: 'Program outcomes framework (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'Critical',
    actionCategory: 'Data & Evaluation',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'impact-1',
    pillar: 'Impact',
    questionIndex: 1,
    title: 'Participant data collection (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'High',
    actionCategory: 'Data & Evaluation',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'impact-2',
    pillar: 'Impact',
    questionIndex: 2,
    title: 'Data management system (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'High',
    actionCategory: 'Technology',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'impact-3',
    pillar: 'Impact',
    questionIndex: 3,
    title: 'Impact storytelling (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Moderate',
    actionCategory: 'Communications',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'impact-4',
    pillar: 'Impact',
    questionIndex: 4,
    title: 'Evaluation-driven improvement (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'Moderate',
    actionCategory: 'Data & Evaluation',
    recommendedResources: PENDING_RESOURCES,
  },
];

/* ============================================================
   FUNDING
   ============================================================ */
const FUNDING_TEMPLATES: ActionTemplate[] = [
  {
    id: 'funding-0',
    pillar: 'Funding',
    questionIndex: 0,
    title: 'Written fundraising plan (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Critical',
    actionCategory: 'Development',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'funding-1',
    pillar: 'Funding',
    questionIndex: 1,
    title: 'Grant research and application pipeline (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'High',
    actionCategory: 'Development',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'funding-2',
    pillar: 'Funding',
    questionIndex: 2,
    title: 'Major donor cultivation (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 90,
    defaultPriority: 'High',
    actionCategory: 'Development',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'funding-3',
    pillar: 'Funding',
    questionIndex: 3,
    title: 'Grant writing capacity (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'Moderate',
    actionCategory: 'Development',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'funding-4',
    pillar: 'Funding',
    questionIndex: 4,
    title: 'Grant reporting and funder relationships (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 30,
    defaultPriority: 'Moderate',
    actionCategory: 'Development',
    recommendedResources: PENDING_RESOURCES,
  },
];

/* ============================================================
   TRANSFORMATION
   ============================================================ */
const TRANSFORMATION_TEMPLATES: ActionTemplate[] = [
  {
    id: 'transformation-0',
    pillar: 'Transformation',
    questionIndex: 0,
    title: 'Leadership professional development (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'Critical',
    actionCategory: 'Leadership',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'transformation-1',
    pillar: 'Transformation',
    questionIndex: 1,
    title: 'Succession plan (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 90,
    defaultPriority: 'High',
    actionCategory: 'Leadership',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'transformation-2',
    pillar: 'Transformation',
    questionIndex: 2,
    title: 'Capacity assessment (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 45,
    defaultPriority: 'High',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'transformation-3',
    pillar: 'Transformation',
    questionIndex: 3,
    title: 'Partnerships and collaborations (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 60,
    defaultPriority: 'Moderate',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
  {
    id: 'transformation-4',
    pillar: 'Transformation',
    questionIndex: 4,
    title: 'Scaling plan (template pending)',
    description: PLACEHOLDER,
    whyItMatters: PLACEHOLDER,
    whyFundersCare: PLACEHOLDER,
    evidenceRequirements: PLACEHOLDER,
    estimatedCompletionDays: 90,
    defaultPriority: 'Moderate',
    actionCategory: 'Strategic Planning',
    recommendedResources: PENDING_RESOURCES,
  },
];

export const ACTION_TEMPLATES: ActionTemplate[] = [
  ...CLARITY_TEMPLATES,
  ...STRUCTURE_TEMPLATES,
  ...HEALTH_TEMPLATES,
  ...IMPACT_TEMPLATES,
  ...FUNDING_TEMPLATES,
  ...TRANSFORMATION_TEMPLATES,
];

/* ============================================================
   Helpers
   ============================================================ */

export function getTemplate(pillar: ActionPillar, questionIndex: number): ActionTemplate | undefined {
  return ACTION_TEMPLATES.find(
    (t) => t.pillar === pillar && t.questionIndex === questionIndex,
  );
}

export function getTemplatesForPillar(pillar: ActionPillar): ActionTemplate[] {
  return ACTION_TEMPLATES.filter((t) => t.pillar === pillar);
}

export function getCriticalTemplates(): ActionTemplate[] {
  return ACTION_TEMPLATES.filter((t) => t.defaultPriority === 'Critical');
}
