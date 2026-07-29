import {
  FileCheck2, Upload, ArrowRight, ShieldCheck, Loader2, ClipboardList, Plus, Send,
  Clock, TrendingUp, Calendar, User, BadgeCheck, AlertCircle, RotateCcw,
} from 'lucide-react';
import type { WorkflowActionWithEvidence } from '../../lib/actionWorkflowService';

interface ActionCardProps {
  action: WorkflowActionWithEvidence;
  /** Whether the current user may start this action (client-side gate). */
  canStart?: boolean;
  /** Whether this specific action is currently being started. */
  isStarting?: boolean;
  /** Called when the user clicks Start (opens confirmation in the page). */
  onStart?: (actionId: string) => void;
  /** Whether the current user may request evidence for this action. */
  canRequestEvidence?: boolean;
  /** Whether this specific action is currently being moved to evidence collection. */
  isRequestingEvidence?: boolean;
  /** Called when the user clicks Request Evidence (opens confirmation in the page). */
  onRequestEvidence?: (actionId: string) => void;
  /** Whether the current user may manage evidence for this action. */
  canManageEvidence?: boolean;
  /** Whether evidence is currently being loaded for this action. */
  isLoadingEvidence?: boolean;
  /** Called when the user clicks Add Evidence (opens the evidence workspace). */
  onAddEvidence?: (actionId: string) => void;
  /** Called when the user clicks View Evidence (opens the evidence workspace). */
  onViewEvidence?: (actionId: string) => void;
  /** Whether this action is currently being submitted for verification. */
  isSubmittingEvidence?: boolean;
  /** Called when the user clicks Submit Evidence (opens the evidence workspace for selection). */
  onSubmitEvidence?: (actionId: string) => void;
  /** Called when the user clicks Revise Evidence (opens the evidence workspace in revision mode). */
  onReviseEvidence?: (actionId: string) => void;
}

const PRIORITY_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  Critical: { bg: 'rgba(224,101,107,0.12)', border: 'rgba(224,101,107,0.3)', color: '#E0656B' },
  High: { bg: 'rgba(212,168,67,0.12)', border: 'rgba(212,168,67,0.3)', color: '#D4A843' },
  Moderate: { bg: 'rgba(28,116,134,0.12)', border: 'rgba(28,116,134,0.3)', color: '#1C7486' },
  Low: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' },
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'Not Started': { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' },
  'In Progress': { bg: 'rgba(28,116,134,0.12)', color: '#1C7486' },
  'Awaiting Evidence': { bg: 'rgba(212,168,67,0.12)', color: '#D4A843' },
  'Submitted for Verification': { bg: 'rgba(28,116,134,0.15)', color: '#2592A8' },
  'Revision Required': { bg: 'rgba(224,101,107,0.12)', color: '#E0656B' },
  'Verified': { bg: 'rgba(52,180,120,0.12)', color: '#34B478' },
  'Completed': { bg: 'rgba(52,180,120,0.12)', color: '#34B478' },
  'Deferred': { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' },
};

function evidenceStatusLabel(action: WorkflowActionWithEvidence): { label: string; color: string } {
  const e = action.evidenceSummary;
  if (!e.evidenceRequired) return { label: 'Not required', color: 'rgba(255,255,255,0.4)' };
  if (e.evidenceVerified > 0) return { label: 'Verified', color: '#34B478' };
  if (e.evidenceRejectedOrRevisionRequired > 0) return { label: 'Revision required', color: '#E0656B' };
  if (e.evidenceSubmitted > 0) return { label: 'Submitted for review', color: '#2592A8' };
  if (e.evidenceCount > 0) return { label: 'Draft', color: 'rgba(255,255,255,0.5)' };
  return { label: 'Awaiting evidence', color: '#D4A843' };
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No due date';
  const d = new Date(dueDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ActionCard({
  action, canStart = false, isStarting = false, onStart,
  canRequestEvidence = false, isRequestingEvidence = false, onRequestEvidence,
  canManageEvidence = false, isLoadingEvidence = false, onAddEvidence, onViewEvidence,
  isSubmittingEvidence = false, onSubmitEvidence, onReviseEvidence,
}: ActionCardProps) {
  const pr = PRIORITY_STYLES[action.priority] ?? PRIORITY_STYLES.Low;
  const st = STATUS_STYLES[action.status] ?? STATUS_STYLES['Not Started'];
  const ev = evidenceStatusLabel(action);
  const estDays = action.estimated_completion_days;
  const pillarGain = action.estimated_pillar_score_increase;
  const overallGain = action.estimated_overall_score_increase;

  return (
    <div className="card-premium p-5 h-full flex flex-col">
      {/* Top row: priority + pillar + status + cert badge */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{ background: pr.bg, border: `1px solid ${pr.border}`, color: pr.color }}
        >
          {action.priority}
        </span>
        <span className="badge-teal" style={{ padding: '0.2rem 0.6rem', fontSize: '0.6875rem' }}>
          {action.pillar_name}
        </span>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: st.bg, color: st.color }}
        >
          {action.status}
        </span>
        {action.certification_requirement === true && (
          <span className="badge-gold inline-flex items-center gap-1" style={{ padding: '0.2rem 0.6rem', fontSize: '0.6875rem' }}>
            <ShieldCheck size={11} /> Cert
          </span>
        )}
      </div>

      {/* Title + description */}
      <h3 className="text-white font-bold text-base leading-snug mb-2">{action.title}</h3>
      <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {action.description}
      </p>

      {/* Why it matters / Why funders care */}
      {(action.why_it_matters || action.why_funders_care) && (
        <div className="space-y-2 mb-4">
          {action.why_it_matters && (
            <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>Why it matters: </span>
              {action.why_it_matters}
            </div>
          )}
          {action.why_funders_care && (
            <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>Why funders care: </span>
              {action.why_funders_care}
            </div>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-3 mb-4 mt-auto">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <Clock size={13} style={{ color: '#1C7486' }} />
          <span>{estDays ? `${estDays} days est.` : 'No estimate'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <TrendingUp size={13} style={{ color: '#D4A843' }} />
          <span>
            {pillarGain != null ? `+${pillarGain} pillar` : '—'}
            {overallGain != null ? ` / +${overallGain} overall` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <Calendar size={13} style={{ color: '#1C7486' }} />
          <span>{formatDueDate(action.due_date)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: ev.color }}>
          <FileCheck2 size={13} />
          <span>{ev.label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs col-span-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <User size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span>{action.assigned_user_id ? 'Assigned' : 'Unassigned'}</span>
        </div>
      </div>

      {/* Evidence requirements display for In Progress evidence-required actions */}
      {action.status === 'In Progress' && action.evidence_required === true && (
        <div className="mb-4">
          {action.evidence_requirements?.trim() ? (
            <div
              className="rounded-xl px-3.5 py-3"
              style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.18)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: '#D4A843' }}>
                <ClipboardList size={12} /> Evidence Required
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {action.evidence_requirements}
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl px-3.5 py-3"
              style={{ background: 'rgba(224,101,107,0.06)', border: '1px solid rgba(224,101,107,0.18)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: '#E0656B' }}>
                <ClipboardList size={12} /> Evidence Required
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Evidence requirements have not been defined.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {action.status === 'Not Started' && (
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}
            onClick={() => onStart?.(action.id)}
            disabled={!canStart || isStarting}
            aria-label={canStart ? 'Start this action' : 'You do not have permission to start this action'}
            title={canStart ? undefined : 'You do not have permission to start this action'}
          >
            {isStarting ? (
              <><Loader2 size={14} className="animate-spin" /> Starting…</>
            ) : (
              <><ArrowRight size={14} /> Start</>
            )}
          </button>
        )}
        {action.status === 'In Progress' && action.evidence_required === true && (
          <button
            type="button"
            className="btn-primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8125rem',
              background: 'rgba(212,168,67,0.15)',
              borderColor: 'rgba(212,168,67,0.4)',
              color: '#D4A843',
            }}
            onClick={() => onRequestEvidence?.(action.id)}
            disabled={!canRequestEvidence || isRequestingEvidence || !action.evidence_requirements?.trim()}
            aria-label={
              !action.evidence_requirements?.trim()
                ? 'Evidence requirements have not been defined'
                : canRequestEvidence
                  ? 'Move this action to evidence collection'
                  : 'You do not have permission to move this action to evidence collection'
            }
            title={
              !action.evidence_requirements?.trim()
                ? 'Evidence requirements have not been defined'
                : canRequestEvidence
                  ? undefined
                  : 'You do not have permission to move this action to evidence collection'
            }
          >
            {isRequestingEvidence ? (
              <><Loader2 size={14} className="animate-spin" /> Moving…</>
            ) : (
              <><FileCheck2 size={14} /> Request Evidence</>
            )}
          </button>
        )}
        {action.status === 'Awaiting Evidence' && (
          <button
            type="button"
            className="btn-primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8125rem',
              background: 'rgba(212,168,67,0.15)',
              borderColor: 'rgba(212,168,67,0.4)',
              color: '#D4A843',
            }}
            onClick={() => onAddEvidence?.(action.id)}
            disabled={!canManageEvidence || isLoadingEvidence}
            aria-label={canManageEvidence ? 'Add evidence for this action' : 'You do not have permission to manage evidence for this action'}
            title={canManageEvidence ? undefined : 'You do not have permission to manage evidence for this action'}
          >
            {isLoadingEvidence ? (
              <><Loader2 size={14} className="animate-spin" /> Loading…</>
            ) : (
              <><Plus size={14} /> Add Evidence</>
            )}
          </button>
        )}
        {action.status === 'Awaiting Evidence' && action.evidenceSummary.evidenceCount > 0 && action.evidenceSummary.evidenceSubmitted === 0 && (
          <button
            type="button"
            className="btn-primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8125rem',
              background: 'rgba(28,116,134,0.15)',
              borderColor: 'rgba(28,116,134,0.4)',
              color: '#2592A8',
            }}
            onClick={() => onSubmitEvidence?.(action.id)}
            disabled={!canManageEvidence || isSubmittingEvidence}
            aria-label={canManageEvidence ? 'Submit evidence for verification' : 'You do not have permission to submit evidence for this action'}
            title={canManageEvidence ? undefined : 'You do not have permission to submit evidence for this action'}
          >
            {isSubmittingEvidence ? (
              <><Loader2 size={14} className="animate-spin" /> Submitting…</>
            ) : (
              <><Send size={14} /> Submit Evidence</>
            )}
          </button>
        )}
        {action.evidenceSummary.evidenceCount > 0 && (
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}
            onClick={() => onViewEvidence?.(action.id)}
          >
            <FileCheck2 size={14} /> View Evidence
          </button>
        )}
        {action.status === 'Submitted for Verification' && action.review_claimed_by !== null && action.review_claimed_by !== undefined && (
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1"
            style={{ background: 'rgba(28,116,134,0.12)', color: '#2592A8' }}
          >
            <Clock size={12} /> Review In Progress
          </span>
        )}
        {action.status === 'Revision Required' && (
          <>
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1"
              style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}
            >
              <AlertCircle size={12} /> Additional Information Required
            </span>
            {canManageEvidence && (
              <button
                type="button"
                className="btn-primary"
                style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.8125rem',
                  background: 'rgba(212,168,67,0.15)',
                  borderColor: 'rgba(212,168,67,0.4)',
                  color: '#D4A843',
                }}
                onClick={() => onReviseEvidence?.(action.id)}
                disabled={isLoadingEvidence}
                aria-label="Revise evidence for this action"
              >
                {isLoadingEvidence ? (
                  <><Loader2 size={14} className="animate-spin" /> Loading…</>
                ) : (
                  <><RotateCcw size={14} /> Revise Evidence</>
                )}
              </button>
            )}
          </>
        )}
        {action.evidence_required === true && action.evidenceSummary.evidenceVerified === 0 && action.status !== 'Submitted for Verification' && (
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}
            onClick={() => onViewEvidence?.(action.id)}
            aria-label="Submit evidence for verification"
          >
            <Upload size={14} /> Submit Evidence
          </button>
        )}
        {action.status === 'In Progress' && (
          <button type="button" className="btn-ghost" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}>
            <BadgeCheck size={14} /> Mark Ready for Review
          </button>
        )}
      </div>
    </div>
  );
}
