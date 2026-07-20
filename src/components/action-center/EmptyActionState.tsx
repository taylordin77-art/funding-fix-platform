import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, FileCheck2, CheckCircle2, AlertTriangle, ShieldAlert,
  Loader2, ChevronRight, Sparkles,
} from 'lucide-react';
import type { EligibleAssessment } from '../../lib/assessmentSelectionService';
import { ConfirmCreatePlanModal } from './ConfirmCreatePlanModal';

/* ============================================================
   Props — all data and callbacks flow from the page container.
   No Supabase queries live in this presentational component.
   ============================================================ */

export type EmptyStatePhase =
  | 'loading-assessments'
  | 'unauthorized'
  | 'no-assessment'
  | 'eligible'
  | 'persisting'
  | 'success'
  | 'error';

export interface EmptyActionStateProps {
  organizationName: string;
  phase: EmptyStatePhase;
  assessments: EligibleAssessment[];
  canCreateActionPlan: boolean;
  /** Set when phase === 'success' or 'error' after a persistence attempt. */
  actionCount?: number;
  /** Safe, plain-language error message for phase === 'error'. */
  errorMessage?: string;
  /** Whether the error is the "no actions required" non-failure case. */
  isNoActionsRequired?: boolean;
  /** Called when the user confirms creation in the modal. Page runs persistence. */
  onCreatePlan: (assessmentId: string) => void;
  /** Dismiss the success confirmation. */
  onDismissSuccess?: () => void;
}

/* ============================================================
   Helpers
   ============================================================ */

function formatDate(value: string | null): string {
  if (!value) return 'Date not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date not recorded';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function scoreLabel(a: EligibleAssessment): string {
  if (a.overallScore == null) return 'Score not available';
  return `${a.overallScore}%`;
}

function assessmentLabel(a: EligibleAssessment): string {
  const parts = [formatDate(a.completedAt)];
  parts.push(scoreLabel(a));
  if (a.assessmentType) parts.push(a.assessmentType);
  return parts.join(' · ');
}

/* ============================================================
   Component
   ============================================================ */

export function EmptyActionState({
  organizationName, phase, assessments, canCreateActionPlan,
  actionCount, errorMessage, isNoActionsRequired,
  onCreatePlan, onDismissSuccess,
}: EmptyActionStateProps) {
  // Default to the newest eligible assessment (already sorted newest-first
  // by the service). User can switch when multiple exist.
  const newestId = assessments[0]?.id;
  const [selectedId, setSelectedId] = useState<string | undefined>(newestId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Keep selection valid as the assessments list changes.
  const effectiveSelectedId = selectedId && assessments.some((a) => a.id === selectedId)
    ? selectedId
    : newestId;

  const openConfirm = () => {
    if (!effectiveSelectedId) return;
    setConfirmOpen(true);
  };
  const closeConfirm = () => setConfirmOpen(false);
  const handleConfirm = () => {
    if (!effectiveSelectedId) return;
    setConfirmOpen(false);
    onCreatePlan(effectiveSelectedId);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-xl mx-auto px-4 w-full">

        {/* ---- success banner (stays visible above populated center) ---- */}
        {phase === 'success' && (
          <div
            className="card-premium p-6 mb-6 text-center"
            style={{ borderColor: 'rgba(52,180,120,0.3)' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(52,180,120,0.12)', border: '1px solid rgba(52,180,120,0.25)' }}
            >
              <CheckCircle2 size={24} style={{ color: '#34B478' }} />
            </div>
            <h2 className="heading-lg text-white mb-2">Your action plan was created successfully.</h2>
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {actionCount != null && actionCount > 0
                ? `${actionCount} prioritized actions were added to the Action Center.`
                : 'Your prioritized actions were added to the Action Center.'}
            </p>
            {onDismissSuccess && (
              <button type="button" className="btn-ghost" onClick={onDismissSuccess}>
                View Action Center
              </button>
            )}
          </div>
        )}

        {/* ---- illustration + headline (shared) ---- */}
        {phase !== 'success' && (
          <>
            <div className="relative mx-auto mb-8" style={{ width: '120px', height: '120px' }}>
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(28,116,134,0.06)', filter: 'blur(40px)' }}
              />
              <div
                className="relative w-full h-full rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(28,116,134,0.08)', border: '1px solid rgba(28,116,134,0.2)' }}
              >
                {phase === 'persisting' ? (
                  <Loader2 size={44} style={{ color: '#1C7486' }} className="animate-spin" />
                ) : phase === 'error' && !isNoActionsRequired ? (
                  <AlertTriangle size={44} style={{ color: '#E0656B' }} />
                ) : phase === 'error' && isNoActionsRequired ? (
                  <FileCheck2 size={44} style={{ color: '#34B478' }} />
                ) : phase === 'unauthorized' ? (
                  <ShieldAlert size={44} style={{ color: '#D4A843' }} />
                ) : phase === 'no-assessment' ? (
                  <ClipboardList size={44} style={{ color: '#1C7486' }} />
                ) : (
                  <ClipboardList size={44} style={{ color: '#1C7486' }} />
                )}
              </div>
            </div>

            {/* ---- loading eligible assessments ---- */}
            {phase === 'loading-assessments' && (
              <div className="text-center">
                <h1 className="heading-lg text-white mb-3">Checking for completed assessments…</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {organizationName} does not have an action plan yet. We're looking for your completed assessment.
                </p>
              </div>
            )}

            {/* ---- unauthorized ---- */}
            {phase === 'unauthorized' && (
              <div className="text-center">
                <h1 className="heading-lg text-white mb-4">No Action Plan Exists</h1>
                <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {organizationName} does not have an action plan yet. An organization administrator must create the action plan.
                </p>
                <Link to="/assessment" className="btn-ghost">
                  <ClipboardList size={16} /> Take Assessment
                </Link>
              </div>
            )}

            {/* ---- no completed assessment ---- */}
            {phase === 'no-assessment' && (
              <div className="text-center">
                <h1 className="heading-lg text-white mb-4">No Completed Assessment Is Available</h1>
                <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Complete your organizational assessment before creating an action plan.
                </p>
                <Link to="/assessment" className="btn-primary">
                  <ClipboardList size={16} /> Take Assessment
                </Link>
              </div>
            )}

            {/* ---- one or more eligible assessments ---- */}
            {phase === 'eligible' && canCreateActionPlan && (
              <div>
                <div className="text-center mb-6">
                  <h1 className="heading-lg text-white mb-4">No Action Plan Exists</h1>
                  <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {organizationName} does not have an action plan yet. Generate an action plan from your completed assessment to begin improving your organization.
                  </p>
                </div>

                {/* explanation */}
                <div
                  className="card-premium p-4 mb-5 flex items-start gap-3"
                  style={{ background: 'rgba(28,116,134,0.05)' }}
                >
                  <Sparkles size={16} style={{ color: '#1C7486' }} className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    C-SHIFT will generate prioritized actions from the weakest responses in your completed assessment, targeting the areas with the greatest room to improve.
                  </p>
                </div>

                {/* single assessment: summary card */}
                {assessments.length === 1 && (
                  <div className="card-premium p-5 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <FileCheck2 size={15} style={{ color: '#1C7486' }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        Completed Assessment
                      </span>
                    </div>
                    <AssessmentSummaryCard assessment={assessments[0]} newest />
                  </div>
                )}

                {/* multiple assessments: selectable list */}
                {assessments.length > 1 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <FileCheck2 size={15} style={{ color: '#1C7486' }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        Select an Assessment ({assessments.length} completed)
                      </span>
                    </div>
                    <div className="space-y-3">
                      {assessments.map((a, i) => {
                        const isSelected = effectiveSelectedId === a.id;
                        const isNewest = i === 0;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelectedId(a.id)}
                            className="w-full text-left card-premium p-4 transition-all"
                            style={{
                              borderColor: isSelected ? 'rgba(28,116,134,0.45)' : undefined,
                              boxShadow: isSelected ? '0 0 0 1px rgba(28,116,134,0.3)' : undefined,
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Select assessment completed ${formatDate(a.completedAt)}`}
                          >
                            <AssessmentSummaryCard assessment={a} newest={isNewest} selected={isSelected} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={openConfirm}
                    disabled={!effectiveSelectedId}
                  >
                    <ClipboardList size={16} /> Create My Action Plan
                  </button>
                </div>
              </div>
            )}

            {/* ---- persisting ---- */}
            {phase === 'persisting' && (
              <div className="text-center">
                <h1 className="heading-lg text-white mb-3">Creating your action plan…</h1>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Creating your prioritized action plan…
                </p>
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#1C7486' }}>
                    <Loader2 size={16} className="animate-spin" /> Please wait while we build your plan.
                  </div>
                </div>
              </div>
            )}

            {/* ---- error ---- */}
            {phase === 'error' && (
              <div className="text-center">
                {isNoActionsRequired ? (
                  <>
                    <h1 className="heading-lg text-white mb-4">No Actions Required</h1>
                    <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Your assessment did not identify any actions requiring remediation.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="heading-lg text-white mb-4">Unable to Create the Action Plan</h1>
                    <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {errorMessage || 'Something went wrong while creating your action plan.'}
                    </p>
                  </>
                )}
                {assessments.length > 0 && canCreateActionPlan && !isNoActionsRequired && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => { if (effectiveSelectedId) onCreatePlan(effectiveSelectedId); }}
                  >
                    <ClipboardList size={16} /> Try Again
                  </button>
                )}
                {!canCreateActionPlan && !isNoActionsRequired && (
                  <Link to="/assessment" className="btn-ghost">
                    <ClipboardList size={16} /> Take Assessment
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation modal — rendered when the user clicks Create My Action Plan */}
      <ConfirmCreatePlanModal
        open={confirmOpen && phase === 'eligible'}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
        disabled={!effectiveSelectedId}
        assessmentLabel={
          effectiveSelectedId
            ? assessmentLabel(assessments.find((a) => a.id === effectiveSelectedId) ?? assessments[0])
            : ''
        }
      />
    </div>
  );
}

/* ============================================================
   Assessment summary card (internal)
   ============================================================ */

interface AssessmentSummaryCardProps {
  assessment: EligibleAssessment;
  newest?: boolean;
  selected?: boolean;
}

function AssessmentSummaryCard({ assessment, newest, selected }: AssessmentSummaryCardProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-sm font-semibold text-white">
            {formatDate(assessment.completedAt)}
          </span>
          {newest && (
            <span
              className="badge-teal"
              style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}
            >
              Newest
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span>Score: <span className="font-semibold text-white">{scoreLabel(assessment)}</span></span>
          {assessment.assessmentType && (
            <span className="capitalize">Type: {assessment.assessmentType.replace(/_/g, ' ')}</span>
          )}
        </div>
      </div>
      {selected !== undefined && (
        <ChevronRight
          size={16}
          style={{ color: selected ? '#1C7486' : 'rgba(255,255,255,0.25)' }}
          className="flex-shrink-0 mt-1"
        />
      )}
    </div>
  );
}
