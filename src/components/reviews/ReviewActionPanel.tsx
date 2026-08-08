import { useState } from 'react';
import { ShieldCheck, Clock, FileText, Link as LinkIcon, StickyNote, Eye, MessageSquare, Lock, Play, CheckCircle2 } from 'lucide-react';
import type { ReviewActionDetail } from '../../lib/reviewQueueService';
import { EVIDENCE_TYPE_LABELS } from '../../lib/actionEvidenceService';
import { RequestInformationForm, type RequestInformationFormValues } from './RequestInformationForm';

interface ReviewActionPanelProps {
  action: ReviewActionDetail;
  currentUserId: string | null;
  onRequestInformation?: (actionId: string, evidenceIds: string[], orgNotes: string, reviewerNotes: string) => void;
  onResumeReview?: (actionId: string, evidenceIds: string[]) => void;
  onVerifyAction?: (actionId: string) => void;
  processing?: boolean;
  resuming?: boolean;
  verifying?: boolean;
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

export function ReviewActionPanel({ action, currentUserId, onRequestInformation, onResumeReview, onVerifyAction, processing, resuming, verifying }: ReviewActionPanelProps) {
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<Set<string>>(new Set());
  const [showRequestForm, setShowRequestForm] = useState(false);

  const reqsText = action.evidence_requirements?.trim() || '';
  const isClaimOwner = action.review_claimed_by === currentUserId;
  const isRevisionRequired = action.status === 'Revision Required';
  const isResubmitted = action.status === 'Submitted for Verification' && isClaimOwner;
  const busy = processing || resuming || verifying;

  const underReviewEvidence = action.evidence.filter((e) => e.verification_status === 'Under Review');
  const submittedEvidence = action.evidence.filter((e) => e.verification_status === 'Submitted');

  // Request Additional Information: select Under Review evidence
  const hasSelectableForRequest = underReviewEvidence.length > 0 && isClaimOwner && !isRevisionRequired && !busy;

  // Resume Review: select Submitted evidence (only when action is resubmitted and claimed by me)
  const hasSelectableForResume = submittedEvidence.length > 0 && isClaimOwner && isResubmitted && !busy;

  const toggleSelect = (id: string) => {
    if (busy) return;
    setSelectedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartRequest = () => {
    if (selectedEvidenceIds.size === 0) return;
    setShowRequestForm(true);
  };

  const handleFormContinue = (values: RequestInformationFormValues) => {
    setShowRequestForm(false);
    onRequestInformation?.(action.id, [...selectedEvidenceIds], values.organizationVisibleNotes, values.reviewerNotes);
  };

  const handleFormCancel = () => {
    setShowRequestForm(false);
  };

  const handleResumeReview = () => {
    if (selectedEvidenceIds.size === 0 || busy) return;
    onResumeReview?.(action.id, [...selectedEvidenceIds]);
  };

  // Clear selections when evidence changes
  const validSelectedIds = new Set(
    [...selectedEvidenceIds].filter((id) => {
      const ev = action.evidence.find((e) => e.id === id);
      if (!ev) return false;
      if (hasSelectableForResume) return ev.verification_status === 'Submitted';
      if (hasSelectableForRequest) return ev.verification_status === 'Under Review';
      return false;
    }),
  );

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
            {isRevisionRequired && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}>
                Waiting for Organization Revision
              </span>
            )}
            {isResubmitted && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(28,116,134,0.12)', color: '#2592A8' }}>
                Revised Evidence Submitted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 mb-5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <span className="flex items-center gap-1"><Clock size={11} /> Submitted {formatDate(action.submitted_at)}</span>
        {action.due_date && <span>Due {formatDate(action.due_date)}</span>}
        <span>{action.evidence.length} evidence items</span>
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

      {/* Request form */}
      {showRequestForm && (
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <RequestInformationForm
            open={showRequestForm}
            disabled={processing}
            onCancel={handleFormCancel}
            onContinue={handleFormContinue}
          />
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
            const isUnderReview = ev.verification_status === 'Under Review';
            const isRevision = ev.verification_status === 'Additional Information Required';
            const isSubmitted = ev.verification_status === 'Submitted';
            const isSelected = validSelectedIds.has(ev.id);

            // Determine if this evidence is selectable in the current mode
            const canSelectForRequest = isUnderReview && hasSelectableForRequest && !showRequestForm;
            const canSelectForResume = isSubmitted && hasSelectableForResume && !showRequestForm;
            const canSelect = canSelectForRequest || canSelectForResume;

            // Badge label overrides (display-only, not stored)
            const badgeLabel: string = isRevision
              ? 'Waiting for Organization'
              : isSubmitted && isResubmitted
                ? 'Ready to Resume'
                : isUnderReview
                  ? 'Under Review'
                  : ev.verification_status;

            return (
              <div
                key={ev.id}
                className="rounded-xl px-4 py-3"
                style={{
                  background: isSelected ? 'rgba(28,116,134,0.04)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid rgba(28,116,134,0.25)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-start gap-3">
                  {canSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(ev.id)}
                      disabled={busy}
                      className="mt-1 flex-shrink-0"
                      style={{ accentColor: '#1C7486', width: 16, height: 16 }}
                      aria-label={`Select ${EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type} for ${canSelectForResume ? 'resume review' : 'revision request'}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-white">{EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type}</span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badgeLabel}
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
                    {/* Organization-visible revision instructions */}
                    {(isRevision || (isSubmitted && ev.organization_visible_notes)) && ev.organization_visible_notes && (
                      <div
                        className="mt-2 rounded-lg px-3 py-2"
                        style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)' }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#D4A843' }}>
                          <MessageSquare size={10} className="inline mr-1" /> Revision Instructions
                        </p>
                        <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {ev.organization_visible_notes}
                        </p>
                      </div>
                    )}
                    {/* Internal reviewer notes — visible only to the assigned reviewer */}
                    {(isRevision || isSubmitted || isUnderReview) && ev.reviewer_notes && isClaimOwner && (
                      <div
                        className="mt-2 rounded-lg px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          <Lock size={10} className="inline mr-1" /> Internal Notes
                        </p>
                        <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {ev.reviewer_notes}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span>Submitted {formatDate(ev.submitted_at)}</span>
                      {ev.reviewed_at && <span>Reviewed {formatDate(ev.reviewed_at)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resume Review action */}
      {hasSelectableForResume && !showRequestForm && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {validSelectedIds.size} {validSelectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'rgba(28,116,134,0.15)', borderColor: 'rgba(28,116,134,0.4)', color: '#2592A8' }}
            onClick={handleResumeReview}
            disabled={busy || validSelectedIds.size === 0}
            aria-label="Resume review of selected evidence"
          >
            {resuming ? (
              <><Clock size={14} className="animate-spin" /> Resuming…</>
            ) : (
              <><Play size={14} /> Resume Review</>
            )}
          </button>
        </div>
      )}

      {/* Request Additional Information action */}
      {hasSelectableForRequest && !showRequestForm && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {validSelectedIds.size} {validSelectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'rgba(212,168,67,0.12)', borderColor: 'rgba(212,168,67,0.3)', color: '#D4A843' }}
            onClick={handleStartRequest}
            disabled={busy || validSelectedIds.size === 0}
            aria-label="Request additional information for selected evidence"
          >
            <MessageSquare size={14} /> Request Additional Information
          </button>
        </div>
      )}

      {/* Verification readiness summary + Verify Action button */}
      {action.verification_ready && onVerifyAction && (
        <div className="mt-5">
          <div
            className="rounded-xl p-4 mb-3"
            style={{ background: 'rgba(52,180,120,0.06)', border: '1px solid rgba(52,180,120,0.2)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} style={{ color: '#34B478' }} />
              <h3 className="text-sm font-bold text-white">Evidence Review Complete</h3>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
              All required review steps for this action are complete. Verify the action to record organizational completion.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Approved Evidence</p>
                <p className="text-sm font-bold" style={{ color: '#34B478' }}>{action.approved_evidence_count}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Under Review</p>
                <p className="text-sm font-bold text-white">{action.under_review_evidence_count}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Still Submitted</p>
                <p className="text-sm font-bold text-white">{action.submitted_evidence_count}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Revision Items Outstanding</p>
                <p className="text-sm font-bold text-white">{action.revision_required_evidence_count + action.unresolved_revision_draft_count}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            style={{ background: 'rgba(52,180,120,0.15)', borderColor: 'rgba(52,180,120,0.4)', color: '#34B478' }}
            onClick={() => onVerifyAction(action.id)}
            disabled={busy}
            aria-label="Verify this action"
          >
            {verifying ? (
              <><Clock size={14} className="animate-spin" /> Verifying…</>
            ) : (
              <><ShieldCheck size={14} /> Verify Action</>
            )}
          </button>
        </div>
      )}

      {/* Read-only indicator */}
      <div className="flex items-center gap-2 mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <Eye size={12} /> Read-only review view
        {isResubmitted && submittedEvidence.length > 0 && (
          <span className="ml-2" style={{ color: 'rgba(28,116,134,0.6)' }}>Ready to Resume Review</span>
        )}
      </div>

      {/* Processing status */}
      {resuming && (
        <p className="text-xs text-center mt-3" style={{ color: 'rgba(255,255,255,0.5)' }} role="status" aria-live="polite">
          Resuming review…
        </p>
      )}
    </div>
  );
}
