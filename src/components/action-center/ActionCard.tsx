import {
  FileCheck2, Upload, ArrowRight, ShieldCheck,
  Clock, TrendingUp, Calendar, User, BadgeCheck,
} from 'lucide-react';
import type { WorkflowActionWithEvidence } from '../../lib/actionWorkflowService';

interface ActionCardProps {
  action: WorkflowActionWithEvidence;
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

export function ActionCard({ action }: ActionCardProps) {
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

      {/* Visual-only action buttons (no writes) */}
      <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {(action.status === 'Not Started' || action.status === 'Deferred') && (
          <button type="button" className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}>
            <ArrowRight size={14} /> Start
          </button>
        )}
        {action.evidenceSummary.evidenceCount > 0 && (
          <button type="button" className="btn-ghost" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}>
            <FileCheck2 size={14} /> View Evidence
          </button>
        )}
        {action.evidence_required === true && action.evidenceSummary.evidenceVerified === 0 && (
          <button type="button" className="btn-ghost" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }}>
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
