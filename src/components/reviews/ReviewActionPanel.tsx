import { ShieldCheck, Clock, FileText, Link as LinkIcon, StickyNote, Eye } from 'lucide-react';
import type { ReviewActionDetail } from '../../lib/reviewQueueService';
import { EVIDENCE_TYPE_LABELS } from '../../lib/actionEvidenceService';

interface ReviewActionPanelProps {
  action: ReviewActionDetail;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Draft: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' },
  Submitted: { bg: 'rgba(28,116,134,0.15)', color: '#2592A8' },
  'Under Review': { bg: 'rgba(28,116,134,0.15)', color: '#2592A8' },
  'Additional Information Required': { bg: 'rgba(212,168,67,0.12)', color: '#D4A843' },
  Approved: { bg: 'rgba(52,180,120,0.12)', color: '#34B478' },
  Rejected: { bg: 'rgba(224,101,107,0.12)', color: '#E0656B' },
  Expired: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
};

export function ReviewActionPanel({ action }: ReviewActionPanelProps) {
  const reqsText = action.evidence_requirements?.trim() || '';

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {action.organization_name}
          </p>
          <h3 className="text-lg font-bold text-white mb-2 leading-snug">{action.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-teal" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>{action.pillar_name}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{action.priority} priority</span>
            {action.certification_requirement === true && (
              <span className="badge-gold inline-flex items-center gap-1" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
                <ShieldCheck size={11} /> Certification
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 mb-5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <span className="flex items-center gap-1"><Clock size={11} /> Submitted {formatDate(action.submitted_at)}</span>
        {action.due_date && <span>Due {formatDate(action.due_date)}</span>}
        <span>{action.submitted_evidence_count + action.under_review_evidence_count} evidence items</span>
      </div>

      {/* Evidence requirements */}
      {reqsText && (
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4A843' }}>Evidence Requirements</p>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>{reqsText}</p>
        </div>
      )}

      {/* Evidence records */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Evidence Records
        </p>
        {action.evidence.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No evidence records found.</p>
        ) : (
          action.evidence.map((ev) => {
            const badge = STATUS_BADGE[ev.verification_status] ?? STATUS_BADGE.Draft;
            return (
              <div
                key={ev.id}
                className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-white">{EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {ev.verification_status}
                  </span>
                </div>
                {ev.external_url && (
                  <p className="text-xs mb-1 truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <LinkIcon size={10} className="inline mr-1" />
                    <a href={ev.external_url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#1C7486' }}>
                      {ev.external_url}
                    </a>
                  </p>
                )}
                {ev.written_response && (
                  <p className="text-xs mb-1 line-clamp-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <FileText size={10} className="inline mr-1" />{ev.written_response}
                  </p>
                )}
                {ev.submission_notes && (
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <StickyNote size={10} className="inline mr-1" />{ev.submission_notes}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span>Submitted {formatDate(ev.submitted_at)}</span>
                  {ev.reviewed_at && <span>Reviewed {formatDate(ev.reviewed_at)}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Read-only indicator */}
      <div className="flex items-center gap-2 mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <Eye size={12} /> Read-only review view
      </div>
    </div>
  );
}
