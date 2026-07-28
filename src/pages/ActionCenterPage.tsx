import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { getOrganizationWorkflow, type OrganizationWorkflow } from '../lib/actionWorkflowService';
import { persistAssessmentActionPlan, type ActionPersistenceErrorCode } from '../lib/actionPersistenceService';
import { startAction, type StartActionErrorCode, moveActionToAwaitingEvidence, type AwaitingEvidenceErrorCode, createEvidenceDraft, updateEvidenceDraft, type EvidenceDraftErrorCode } from '../lib/actionMutationService';
import {
  getActionAuthContext,
  userCanStartAction,
  type ActionAuthContext,
  type ActionAuthResult,
} from '../lib/actionAuthService';
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
import { StartActionModal } from '../components/action-center/StartActionModal';
import { RequestEvidenceModal } from '../components/action-center/RequestEvidenceModal';
import { EvidenceWorkspaceModal } from '../components/action-center/EvidenceWorkspaceModal';
import { getActionEvidence, type ActionEvidenceResult } from '../lib/actionEvidenceService';
import type { EvidenceRecord, EvidenceType } from '../lib/actionWorkflowService';
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

/* ---- Start Action state ---- */

type StartState =
  | { phase: 'idle' }
  | { phase: 'confirming'; action: WorkflowActionWithEvidence }
  | { phase: 'starting'; action: WorkflowActionWithEvidence }
  | { phase: 'success'; actionTitle: string }
  | { phase: 'error'; message: string; reloadWorkflow: boolean };

const START_ERROR_MESSAGES: Record<StartActionErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to start this action.',
  ACTION_ALREADY_STARTED: 'This action has already been started.',
  INVALID_ACTION_STATUS: 'This action cannot be started from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid workflow state and could not be started.',
  UNEXPECTED_ERROR: 'We could not start this action. Please try again.',
};

/* ---- Request Evidence state ---- */

type EvidenceState =
  | { phase: 'idle' }
  | { phase: 'confirming'; action: WorkflowActionWithEvidence }
  | { phase: 'requesting'; action: WorkflowActionWithEvidence }
  | { phase: 'success'; actionTitle: string }
  | { phase: 'error'; message: string; reloadWorkflow: boolean };

const EVIDENCE_ERROR_MESSAGES: Record<AwaitingEvidenceErrorCode, string> = {
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

/* ---- Evidence Draft state ---- */

type DraftWorkspaceState =
  | { phase: 'idle' }
  | { phase: 'open'; action: WorkflowActionWithEvidence; evidence: EvidenceRecord[]; loadingEvidence: boolean; saving: boolean; feedback: string | null };

const DRAFT_ERROR_MESSAGES: Record<EvidenceDraftErrorCode, string> = {
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

  // Start-action state
  const [startState, setStartState] = useState<StartState>({ phase: 'idle' });
  // Request-evidence state
  const [evidenceState, setEvidenceState] = useState<EvidenceState>({ phase: 'idle' });
  // Evidence draft workspace state
  const [draftState, setDraftState] = useState<DraftWorkspaceState>({ phase: 'idle' });
  const [authContext, setAuthContext] = useState<ActionAuthContext | null>(null);

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

  // Resolve the auth context once when the workflow is ready (for Start button visibility).
  useEffect(() => {
    if (workflow.status === 'ready') {
      getActionAuthContext().then((r: ActionAuthResult) => {
        if (r.ok) setAuthContext(r.data);
      });
    }
  }, [workflow.status]);

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

  /* ---- Start Action handler ---- */
  const handleStartClick = useCallback((actionId: string) => {
    if (workflow.status !== 'ready') return;
    const action = workflow.data.actions.find((a) => a.id === actionId);
    if (!action || action.status !== 'Not Started') return;
    if (startState.phase === 'starting' || startState.phase === 'confirming') return; // prevent double-open
    setStartState({ phase: 'confirming', action });
  }, [workflow, startState.phase]);

  const handleStartConfirm = useCallback(async () => {
    if (startState.phase !== 'confirming') return;
    const action = startState.action;
    // Guard against double submission.
    setStartState({ phase: 'starting', action });

    const result = await startAction(action.id);

    if (result.ok) {
      setStartState({ phase: 'success', actionTitle: action.title });
      await loadWorkflow();
      return;
    }

    const code = result.error.code;

    // ACTION_ALREADY_STARTED: reload workflow so the card reflects the current state.
    if (code === 'ACTION_ALREADY_STARTED') {
      setStartState({
        phase: 'error',
        message: START_ERROR_MESSAGES[code],
        reloadWorkflow: true,
      });
      await loadWorkflow();
      return;
    }

    setStartState({
      phase: 'error',
      message: START_ERROR_MESSAGES[code],
      reloadWorkflow: false,
    });
  }, [startState, loadWorkflow]);

  const closeStartModal = useCallback(() => {
    if (startState.phase === 'starting') return; // can't cancel mid-RPC
    setStartState({ phase: 'idle' });
  }, [startState.phase]);

  const canStartForAction = useCallback((action: WorkflowActionWithEvidence): boolean => {
    if (!authContext) return false;
    if (action.status !== 'Not Started') return false;
    return userCanStartAction(action, authContext);
  }, [authContext]);

  /* ---- Request Evidence handler ---- */
  const handleRequestEvidenceClick = useCallback((actionId: string) => {
    if (workflow.status !== 'ready') return;
    const action = workflow.data.actions.find((a) => a.id === actionId);
    if (!action || action.status !== 'In Progress' || action.evidence_required !== true) return;
    if (evidenceState.phase === 'requesting' || evidenceState.phase === 'confirming') return;
    setEvidenceState({ phase: 'confirming', action });
  }, [workflow, evidenceState.phase]);

  const handleRequestEvidenceConfirm = useCallback(async () => {
    if (evidenceState.phase !== 'confirming') return;
    const action = evidenceState.action;
    setEvidenceState({ phase: 'requesting', action });

    const result = await moveActionToAwaitingEvidence(action.id);

    if (result.ok) {
      setEvidenceState({ phase: 'success', actionTitle: action.title });
      await loadWorkflow();
      return;
    }

    const code = result.error.code;

    if (code === 'ACTION_ALREADY_AWAITING_EVIDENCE') {
      setEvidenceState({
        phase: 'error',
        message: EVIDENCE_ERROR_MESSAGES[code],
        reloadWorkflow: true,
      });
      await loadWorkflow();
      return;
    }

    setEvidenceState({
      phase: 'error',
      message: EVIDENCE_ERROR_MESSAGES[code],
      reloadWorkflow: false,
    });
  }, [evidenceState, loadWorkflow]);

  const closeEvidenceModal = useCallback(() => {
    if (evidenceState.phase === 'requesting') return;
    setEvidenceState({ phase: 'idle' });
  }, [evidenceState.phase]);

  const canRequestEvidenceForAction = useCallback((action: WorkflowActionWithEvidence): boolean => {
    if (!authContext) return false;
    if (action.status !== 'In Progress') return false;
    if (action.evidence_required !== true) return false;
    return userCanStartAction(action, authContext);
  }, [authContext]);

  const canManageEvidenceForAction = useCallback((action: WorkflowActionWithEvidence): boolean => {
    if (!authContext) return false;
    if (action.status !== 'Awaiting Evidence') return false;
    return userCanStartAction(action, authContext);
  }, [authContext]);

  /* ---- Evidence Draft workspace handlers ---- */
  const refreshEvidence = useCallback(async (actionId: string) => {
    setDraftState((prev) => {
      if (prev.phase !== 'open') return prev;
      return { ...prev, loadingEvidence: true };
    });
    const result: ActionEvidenceResult = await getActionEvidence(actionId);
    setDraftState((prev) => {
      if (prev.phase !== 'open') return prev;
      return {
        ...prev,
        evidence: result.ok ? result.evidence : [],
        loadingEvidence: false,
      };
    });
  }, []);

  const handleAddEvidenceClick = useCallback(async (actionId: string) => {
    if (workflow.status !== 'ready') return;
    const action = workflow.data.actions.find((a) => a.id === actionId);
    if (!action || action.status !== 'Awaiting Evidence') return;
    setDraftState({ phase: 'open', action, evidence: [], loadingEvidence: true, saving: false, feedback: null });
    await refreshEvidence(actionId);
  }, [workflow, refreshEvidence]);

  const handleViewEvidenceClick = useCallback(async (actionId: string) => {
    if (workflow.status !== 'ready') return;
    const action = workflow.data.actions.find((a) => a.id === actionId);
    if (!action) return;
    setDraftState({ phase: 'open', action, evidence: [], loadingEvidence: true, saving: false, feedback: null });
    await refreshEvidence(actionId);
  }, [workflow, refreshEvidence]);

  const closeDraftWorkspace = useCallback(() => {
    setDraftState({ phase: 'idle' });
  }, []);

  const handleAddDraft = useCallback(async (values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => {
    if (draftState.phase !== 'open') return;
    const actionId = draftState.action.id;
    setDraftState((prev) => prev.phase === 'open' ? { ...prev, saving: true, feedback: null } : prev);

    const result = await createEvidenceDraft({
      actionId,
      evidenceType: values.evidenceType,
      externalUrl: values.externalUrl,
      writtenResponse: values.writtenResponse,
      submissionNotes: values.submissionNotes,
    });

    if (result.ok) {
      setDraftState((prev) => prev.phase === 'open' ? { ...prev, saving: false, feedback: 'Evidence draft saved.' } : prev);
      await refreshEvidence(actionId);
      await loadWorkflow();
      return;
    }

    setDraftState((prev) => prev.phase === 'open'
      ? { ...prev, saving: false, feedback: DRAFT_ERROR_MESSAGES[result.error.code] }
      : prev);
  }, [draftState, refreshEvidence, loadWorkflow]);

  const handleUpdateDraft = useCallback(async (evidenceId: string, values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => {
    if (draftState.phase !== 'open') return;
    const actionId = draftState.action.id;
    setDraftState((prev) => prev.phase === 'open' ? { ...prev, saving: true, feedback: null } : prev);

    const result = await updateEvidenceDraft({
      evidenceId,
      evidenceType: values.evidenceType,
      externalUrl: values.externalUrl,
      writtenResponse: values.writtenResponse,
      submissionNotes: values.submissionNotes,
    });

    if (result.ok) {
      setDraftState((prev) => prev.phase === 'open' ? { ...prev, saving: false, feedback: 'Evidence draft updated.' } : prev);
      await refreshEvidence(actionId);
      await loadWorkflow();
      return;
    }

    setDraftState((prev) => prev.phase === 'open'
      ? { ...prev, saving: false, feedback: DRAFT_ERROR_MESSAGES[result.error.code] }
      : prev);
  }, [draftState, refreshEvidence, loadWorkflow]);

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
  const showStartSuccess = startState.phase === 'success';
  const showStartError = startState.phase === 'error';
  const confirmingAction = startState.phase === 'confirming' ? startState.action : null;
  const startingActionId = startState.phase === 'starting' ? startState.action.id : null;

  const showEvidenceSuccess = evidenceState.phase === 'success';
  const showEvidenceError = evidenceState.phase === 'error';
  const confirmingEvidenceAction = evidenceState.phase === 'confirming' ? evidenceState.action : null;
  const requestingEvidenceActionId = evidenceState.phase === 'requesting' ? evidenceState.action.id : null;

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

        {/* Start Action success banner */}
        {showStartSuccess && (
          <div
            className="card-premium p-4 mb-6 flex items-center justify-between gap-4"
            style={{ borderColor: 'rgba(52,180,120,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} style={{ color: '#34B478' }} />
              <div>
                <p className="text-sm font-semibold text-white">Action started successfully.</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {startState.phase === 'success' && `${startState.actionTitle} is now In Progress.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => setStartState({ phase: 'idle' })}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Start Action error banner */}
        {showStartError && (
          <div
            className="card-premium p-4 mb-6 flex items-start justify-between gap-4"
            style={{ borderColor: 'rgba(224,101,107,0.3)' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} style={{ color: '#E0656B', marginTop: 2 }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {startState.phase === 'error' ? startState.message : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss error"
              className="flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onClick={() => setStartState({ phase: 'idle' })}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Request Evidence success banner */}
        {showEvidenceSuccess && (
          <div
            className="card-premium p-4 mb-6 flex items-center justify-between gap-4"
            style={{ borderColor: 'rgba(52,180,120,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} style={{ color: '#34B478' }} />
              <div>
                <p className="text-sm font-semibold text-white">Evidence collection is now required.</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {evidenceState.phase === 'success' && `${evidenceState.actionTitle} moved to Awaiting Evidence.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => setEvidenceState({ phase: 'idle' })}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Request Evidence error banner */}
        {showEvidenceError && (
          <div
            className="card-premium p-4 mb-6 flex items-start justify-between gap-4"
            style={{ borderColor: 'rgba(224,101,107,0.3)' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} style={{ color: '#E0656B', marginTop: 2 }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {evidenceState.phase === 'error' ? evidenceState.message : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss error"
              className="flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onClick={() => setEvidenceState({ phase: 'idle' })}
            >
              <X size={16} />
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
            <PriorityQueue
              groups={filteredGroups}
              canStartForAction={canStartForAction}
              startingActionId={startingActionId}
              onStart={handleStartClick}
              canRequestEvidenceForAction={canRequestEvidenceForAction}
              requestingEvidenceActionId={requestingEvidenceActionId}
              onRequestEvidence={handleRequestEvidenceClick}
              canManageEvidenceForAction={canManageEvidenceForAction}
              loadingEvidenceActionId={draftState.phase === 'open' && draftState.loadingEvidence ? draftState.action.id : null}
              onAddEvidence={handleAddEvidenceClick}
              onViewEvidence={handleViewEvidenceClick}
            />
          </div>
          <div className="order-1 lg:order-2">
            <ProgressSidebar workflow={data} />
          </div>
        </div>
      </div>

      {/* Start Action confirmation modal */}
      <StartActionModal
        open={confirmingAction !== null}
        actionTitle={confirmingAction?.title ?? ''}
        actionPillar={confirmingAction?.pillar_name ?? ''}
        estimatedDays={confirmingAction?.estimated_completion_days ?? null}
        disabled={startState.phase === 'starting'}
        onCancel={closeStartModal}
        onConfirm={handleStartConfirm}
      />

      {/* Request Evidence confirmation modal */}
      <RequestEvidenceModal
        open={confirmingEvidenceAction !== null}
        actionTitle={confirmingEvidenceAction?.title ?? ''}
        actionPillar={confirmingEvidenceAction?.pillar_name ?? ''}
        evidenceRequirements={confirmingEvidenceAction?.evidence_requirements ?? null}
        estimatedDays={confirmingEvidenceAction?.estimated_completion_days ?? null}
        certificationRequired={confirmingEvidenceAction?.certification_requirement === true}
        disabled={evidenceState.phase === 'requesting'}
        onCancel={closeEvidenceModal}
        onConfirm={handleRequestEvidenceConfirm}
      />

      {/* Evidence Draft workspace modal */}
      <EvidenceWorkspaceModal
        open={draftState.phase === 'open'}
        action={draftState.phase === 'open' ? draftState.action : null}
        evidence={draftState.phase === 'open' ? draftState.evidence : []}
        loadingEvidence={draftState.phase === 'open' ? draftState.loadingEvidence : false}
        saving={draftState.phase === 'open' ? draftState.saving : false}
        canManageEvidence={draftState.phase === 'open' ? canManageEvidenceForAction(draftState.action) : false}
        onClose={closeDraftWorkspace}
        onAddDraft={handleAddDraft}
        onUpdateDraft={handleUpdateDraft}
      />
    </div>
  );
}
