import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getOrganizationWorkflow, type OrganizationWorkflow } from '../lib/actionWorkflowService';
import { persistAssessmentActionPlan, type ActionPersistenceErrorCode } from '../lib/actionPersistenceService';
import {
  getEligibleAssessmentsForActionPlan,
  type EligibleAssessmentResult,
  type EligibleAssessment,
} from '../lib/assessmentSelectionService';
import { ActionCenterHeader } from '../components/action-center/ActionCenterHeader';
import { ExecutiveSummaryCards } from '../components/action-center/ExecutiveSummaryCards';
import { ActionFilters, type ActionFilterState, type SortOption } from '../components/action-center/ActionFilters';
import { PriorityQueue } from '../components/action-center/PriorityQueue';
import { ProgressSidebar } from '../components/action-center/ProgressSidebar';
import { EmptyActionState, type EmptyStatePhase } from '../components/action-center/EmptyActionState';
import { LoadingState } from '../components/action-center/LoadingState';
import type {
  WorkflowActionWithEvidence,
  ActionPriority,
  ActionGroup,
} from '../lib/actionWorkflowService';

/* ============================================================
   Page-state model (typed, avoids deeply nested conditional JSX)
   ============================================================ */

type WorkflowState =
  | { status: 'loading' }
  | { status: 'workflow-error'; code: string; message: string }
  | { status: 'ready'; data: OrganizationWorkflow };

type CreationState =
  | { phase: 'idle' }
  | { phase: 'persisting' }
  | { phase: 'success'; actionCount: number }
  | { phase: 'error'; code: ActionPersistenceErrorCode; message: string; isNoActionsRequired: boolean };

type EligibilityState =
  | { status: 'loading' }
  | { status: 'loaded'; result: EligibleAssessmentResult }
  | { status: 'error' };

/* ============================================================
   Constants + sorting helpers (unchanged from prior ticket)
   ============================================================ */

const PRIORITY_RANK: Record<ActionPriority, number> = { Critical: 1, High: 2, Moderate: 3, Low: 4 };

const DEFAULT_FILTERS: ActionFilterState = {
  pillar: 'all', priority: 'all', status: 'all',
  certificationRequired: 'all', evidenceRequired: 'all',
  search: '', sort: 'priority',
};

const PERSIST_CODES_THAT_IMPLY_EXISTING_PLAN: ReadonlySet<ActionPersistenceErrorCode> = new Set([
  'ACTION_PLAN_ALREADY_CREATED',
  'DUPLICATE_ACTIONS_EXIST',
]);

function dueSoonDays(action: WorkflowActionWithEvidence): number | null {
  if (!action.due_date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(action.due_date + 'T00:00:00');
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

function isOverdueAction(a: WorkflowActionWithEvidence): boolean {
  if (!a.due_date) return false;
  if (a.status === 'Completed' || a.status === 'Verified' || a.status === 'Deferred') return false;
  return (dueSoonDays(a) ?? 0) < 0;
}

function sortActionsForGroup(actions: WorkflowActionWithEvidence[], sort: SortOption): WorkflowActionWithEvidence[] {
  if (sort === 'newest') {
    return [...actions].sort((a, b) => {
      const ac = a.created_at ?? ''; const bc = b.created_at ?? '';
      return bc < ac ? -1 : bc > ac ? 1 : 0;
    });
  }
  return [...actions].sort((a, b) => {
    const ao = isOverdueAction(a) ? 0 : 1; const bo = isOverdueAction(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const ad = dueSoonDays(a); const bd = dueSoonDays(b);
    if (ad != null && bd != null && ad !== bd) return ad - bd;
    if (ad != null && bd == null) return -1;
    if (ad == null && bd != null) return 1;
    if (sort === 'priority') {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
    }
    const ac = a.created_at ?? ''; const bc = b.created_at ?? '';
    return bc < ac ? -1 : bc > ac ? 1 : 0;
  });
}

function buildFilteredGroups(actions: WorkflowActionWithEvidence[], filters: ActionFilterState): ActionGroup[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = actions.filter((a) => {
    if (filters.pillar !== 'all' && a.pillar_name !== filters.pillar) return false;
    if (filters.priority !== 'all' && a.priority !== filters.priority) return false;
    if (filters.status !== 'all' && a.status !== filters.status) return false;
    if (filters.certificationRequired !== 'all' && (a.certification_requirement === true) !== filters.certificationRequired) return false;
    if (filters.evidenceRequired !== 'all' && (a.evidence_required === true) !== filters.evidenceRequired) return false;
    if (q) {
      const hay = `${a.title} ${a.description} ${a.why_it_matters ?? ''} ${a.action_category ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const order: ActionPriority[] = ['Critical', 'High', 'Moderate', 'Low'];
  return order.map((priority) => {
    const list = filtered.filter((a) => a.priority === priority);
    return { priority, actions: sortActionsForGroup(list, filters.sort), count: list.length };
  });
}

/* ============================================================
   Page
   ============================================================ */

export default function ActionCenterPage() {
  const [workflow, setWorkflow] = useState<WorkflowState>({ status: 'loading' });
  const [filters, setFilters] = useState<ActionFilterState>(DEFAULT_FILTERS);

  // Eligibility + creation state only matter when the workflow is empty.
  const [eligibility, setEligibility] = useState<EligibilityState>({ status: 'loading' });
  const [creation, setCreation] = useState<CreationState>({ phase: 'idle' });
  // Guard against double-click / double-submission.
  const [submitting, setSubmitting] = useState(false);

  /* ---- reusable workflow loader ---- */
  const loadWorkflow = useCallback(async () => {
    setWorkflow({ status: 'loading' });
    const result = await getOrganizationWorkflow();
    if (!result.ok) {
      setWorkflow({ status: 'workflow-error', code: result.error.code, message: result.error.message });
    } else {
      setWorkflow({ status: 'ready', data: result.data });
    }
  }, []);

  useEffect(() => { loadWorkflow(); }, [loadWorkflow]);

  /* ---- eligibility loader (only when workflow is empty + ready) ---- */
  const loadEligibility = useCallback(async () => {
    setEligibility({ status: 'loading' });
    const result = await getEligibleAssessmentsForActionPlan();
    setEligibility({ status: 'loaded', result });
  }, []);

  // When the workflow resolves to empty, fetch eligible assessments once.
  useEffect(() => {
    if (workflow.status === 'ready' && workflow.data.organization.totalActions === 0) {
      loadEligibility();
    }
  }, [workflow, loadEligibility]);

  /* ---- persistence handler ---- */
  const handleCreatePlan = useCallback(async (assessmentId: string) => {
    // Double-click / double-submit guard.
    if (submitting) return;
    setSubmitting(true);
    setCreation({ phase: 'persisting' });

    const result = await persistAssessmentActionPlan(assessmentId);

    if (result.ok) {
      setCreation({ phase: 'success', actionCount: result.actionCount });
      // Refresh workflow data; the empty state will transition to the
      // populated Action Center once actions appear. The success banner
      // stays visible above it.
      await loadWorkflow();
      setSubmitting(false);
      return;
    }

    const code = result.error.code;

    // ACTION_PLAN_ALREADY_CREATED / DUPLICATE_ACTIONS_EXIST: the plan already
    // exists. Reload workflow; if actions now exist, show the populated
    // Action Center instead of an error state.
    if (PERSIST_CODES_THAT_IMPLY_EXISTING_PLAN.has(code)) {
      await loadWorkflow();
      setSubmitting(false);
      // If the refresh produced actions, the page will render the populated
      // center and the success banner is irrelevant. If still empty, surface
      // a soft error so the user isn't stuck.
      setWorkflow((prev) => {
        if (prev.status === 'ready' && prev.data.organization.totalActions > 0) {
          // Actions exist — clear creation state so the populated center shows.
          setCreation({ phase: 'idle' });
          return prev;
        }
        setCreation({
          phase: 'error',
          code,
          message: result.error.message,
          isNoActionsRequired: false,
        });
        return prev;
      });
      return;
    }

    // NO_ACTION_PLAN_REQUIRED: a non-failure explanation.
    if (code === 'NO_ACTION_PLAN_REQUIRED') {
      setCreation({
        phase: 'error',
        code,
        message: 'Your assessment did not identify any actions requiring remediation.',
        isNoActionsRequired: true,
      });
      setSubmitting(false);
      return;
    }

    // All other persistence errors: safe plain-language message.
    setCreation({
      phase: 'error',
      code,
      message: result.error.message,
      isNoActionsRequired: false,
    });
    setSubmitting(false);
  }, [submitting, loadWorkflow]);

  /* ---- early returns for non-ready workflow ---- */
  if (workflow.status === 'loading') return <LoadingState />;

  if (workflow.status === 'workflow-error') {
    return (
      <div className="min-h-screen py-16 flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="max-w-md mx-auto px-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(224,101,107,0.1)', border: '1px solid rgba(224,101,107,0.25)' }}
          >
            <AlertTriangle size={22} style={{ color: '#E0656B' }} />
          </div>
          <h1 className="heading-lg text-white mb-3">Unable to load the Action Center</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{workflow.message}</p>
          <button type="button" className="btn-primary" onClick={loadWorkflow}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const { data } = workflow;

  /* ---- empty workflow: drive the creation flow ---- */
  if (data.organization.totalActions === 0) {
    // Derive the empty-state phase from eligibility + creation state.
    let phase: EmptyStatePhase;
    let assessments: EligibleAssessment[] = [];
    let canCreate = false;

    if (creation.phase === 'persisting') {
      phase = 'persisting';
    } else if (creation.phase === 'error') {
      phase = 'error';
    } else if (creation.phase === 'success') {
      // Success but workflow still empty (e.g. zero actions). Show success,
      // then the populated center will appear once actions exist. If actions
      // are still 0 after refresh, keep success visible.
      phase = 'success';
    } else if (eligibility.status === 'loading') {
      phase = 'loading-assessments';
    } else if (eligibility.status === 'error') {
      // Treat eligibility failure as a soft error — fall back to the
      // "no assessment" state so the user can still take an assessment.
      phase = 'no-assessment';
    } else {
      const r = eligibility.result;
      if (!r.ok) {
        // NOT_AUTHENTICATED / NO_ORGANIZATION should not reach here because
        // the workflow load would have failed first, but guard anyway.
        phase = 'no-assessment';
      } else {
        assessments = r.assessments;
        canCreate = r.canCreateActionPlan;
        if (!canCreate) {
          phase = 'unauthorized';
        } else if (assessments.length === 0) {
          phase = 'no-assessment';
        } else {
          phase = 'eligible';
        }
      }
    }

    return (
      <EmptyActionState
        organizationName={data.organization.organizationName}
        phase={phase}
        assessments={assessments}
        canCreateActionPlan={canCreate}
        actionCount={creation.phase === 'success' ? creation.actionCount : undefined}
        errorMessage={creation.phase === 'error' ? creation.message : undefined}
        isNoActionsRequired={creation.phase === 'error' ? creation.isNoActionsRequired : undefined}
        onCreatePlan={handleCreatePlan}
        onDismissSuccess={() => setCreation({ phase: 'idle' })}
      />
    );
  }

  /* ---- populated workflow ---- */
  const filteredGroups = useMemo(
    () => buildFilteredGroups(data.actions, filters),
    [data.actions, filters],
  );

  const showSuccessBanner = creation.phase === 'success';

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto px-4">
        {showSuccessBanner && (
          <div
            className="card-premium p-4 mb-6 flex items-center justify-between gap-4"
            style={{ borderColor: 'rgba(52,180,120,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} style={{ color: '#34B478' }} />
              <div>
                <p className="text-sm font-semibold text-white">Your action plan was created successfully.</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {creation.phase === 'success' && creation.actionCount > 0
                    ? `${creation.actionCount} prioritized actions were added to the Action Center.`
                    : 'Your prioritized actions were added to the Action Center.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => setCreation({ phase: 'idle' })}
            >
              Dismiss
            </button>
          </div>
        )}

        <ActionCenterHeader
          organization={data.organization}
          summary={data.summary}
          certification={data.certificationReadiness}
        />

        <ExecutiveSummaryCards workflow={data} />

        <div className="mb-8">
          <ActionFilters filters={filters} onChange={setFilters} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="order-2 lg:order-1">
            <PriorityQueue groups={filteredGroups} />
          </div>
          <div className="order-1 lg:order-2">
            <ProgressSidebar workflow={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
