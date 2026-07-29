import { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, FileCheck2, ShieldCheck, Clock, Inbox, Send, AlertCircle, MessageSquare, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { WorkflowActionWithEvidence } from '../../lib/actionWorkflowService';
import { EVIDENCE_TYPE_LABELS, type OrganizationEvidenceRecord } from '../../lib/actionEvidenceService';
import { EvidenceDraftForm } from './EvidenceDraftForm';
import type { EvidenceType } from '../../lib/actionWorkflowService';

interface EvidenceWorkspaceModalProps {
  open: boolean;
  action: WorkflowActionWithEvidence | null;
  evidence: OrganizationEvidenceRecord[];
  loadingEvidence: boolean;
  saving: boolean;
  submitting: boolean;
  canManageEvidence: boolean;
  onClose: () => void;
  onAddDraft: (values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => void;
  onUpdateDraft: (evidenceId: string, values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => void;
  onRequestSubmit: (actionId: string, selectedEvidenceIds: string[]) => void;
  /** Revise a returned evidence record (Additional Information Required -> Draft) */
  onReviseEvidence?: (evidenceId: string, values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => void;
  /** Create a supplemental Draft during Revision Required */
  onAddSupplementalDraft?: (values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => void;
  /** Resubmit revised evidence (Draft -> Submitted, action -> Submitted for Verification) */
  onResubmitEvidence?: (actionId: string, selectedEvidenceIds: string[]) => void;
  resubmitting?: boolean;
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

type FormMode = 'create' | 'edit' | 'revise' | 'supplement';

export function EvidenceWorkspaceModal({
  open, action, evidence, loadingEvidence, saving, submitting, canManageEvidence,
  onClose, onAddDraft, onUpdateDraft, onRequestSubmit,
  onReviseEvidence, onAddSupplementalDraft, onResubmitEvidence, resubmitting,
}: EvidenceWorkspaceModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingDraft, setEditingDraft] = useState<OrganizationEvidenceRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !submitting && !resubmitting) { e.preventDefault(); handleClose(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, saving, submitting, resubmitting]);

  useEffect(() => {
    if (!open) { setShowForm(false); setFormMode('create'); setEditingDraft(null); setSelectedIds(new Set()); }
  }, [open]);

  if (!open || !action) return null;

  const isAwaitingEvidence = action.status === 'Awaiting Evidence';
  const isSubmitted = action.status === 'Submitted for Verification';
  const isRevisionRequired = action.status === 'Revision Required';
  const busy = saving || submitting || resubmitting;

  const handleClose = () => {
    if (busy) return;
    setShowForm(false);
    setEditingDraft(null);
    onClose();
  };

  const handleAddClick = () => {
    setEditingDraft(null);
    setFormMode(isRevisionRequired ? 'supplement' : 'create');
    setShowForm(true);
  };

  const handleEditClick = (ev: OrganizationEvidenceRecord) => {
    setEditingDraft(ev);
    setFormMode('edit');
    setShowForm(true);
  };

  const handleReviseClick = (ev: OrganizationEvidenceRecord) => {
    setEditingDraft(ev);
    setFormMode('revise');
    setShowForm(true);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingDraft(null);
  };

  const handleFormSave = (values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => {
    if (formMode === 'revise' && editingDraft && onReviseEvidence) {
      onReviseEvidence(editingDraft.id, values);
    } else if (formMode === 'supplement' && onAddSupplementalDraft) {
      onAddSupplementalDraft(values);
    } else if (editingDraft) {
      onUpdateDraft(editingDraft.id, values);
    } else {
      onAddDraft(values);
    }
  };

  // Auto-close form when saving completes
  useEffect(() => {
    if (!saving && showForm) {
      const t = window.setTimeout(() => { setShowForm(false); setEditingDraft(null); }, 100);
      return () => window.clearTimeout(t);
    }
  }, [saving]);

  const toggleSelect = (id: string) => {
    if (busy) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmitClick = () => {
    if (busy || selectedIds.size === 0) return;
    if (isRevisionRequired && onResubmitEvidence) {
      onResubmitEvidence(action.id, [...selectedIds]);
    } else {
      onRequestSubmit(action.id, [...selectedIds]);
    }
  };

  const reqsText = action.evidence_requirements?.trim() || '';
  const draftEvidence = evidence.filter((e) => e.verification_status === 'Draft');
  const returnedEvidence = evidence.filter((e) => e.verification_status === 'Additional Information Required');
  const submittedCount = evidence.filter((e) => e.verification_status === 'Submitted' || e.verification_status === 'Under Review').length;
  const approvedCount = evidence.filter((e) => e.verification_status === 'Approved').length;
  const selectedCount = selectedIds.size;

  // Revision readiness
  const returnedTotal = returnedEvidence.length;
  const returnedRevisedToDraft = evidence.filter((e) => e.organization_visible_notes !== null && e.verification_status === 'Draft').length;
  const returnedStillOutstanding = returnedEvidence.length;
  const supplementalDrafts = evidence.filter((e) => e.organization_visible_notes === null && e.verification_status === 'Draft');
  const allReturnedRevised = returnedStillOutstanding === 0;
  const allReturnedDraftsSelected = returnedEvidence.length === 0 && evidence.filter((e) => e.organization_visible_notes !== null && e.verification_status === 'Draft').every((e) => selectedIds.has(e.id));
  const canResubmit = isRevisionRequired && allReturnedRevised && allReturnedDraftsSelected && selectedCount > 0 && !busy;

  const formReviewerInstructions = formMode === 'revise' && editingDraft?.organization_visible_notes
    ? editingDraft.organization_visible_notes
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-workspace-title"
    >
      <div
        className="card-premium p-7 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: '#141414' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)' }}
            >
              <FileCheck2 size={20} style={{ color: '#D4A843' }} />
            </div>
            <div>
              <h2 id="evidence-workspace-title" className="heading-lg text-white mb-1">Evidence Workspace</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-teal" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>{action.pillar_name}</span>
                {action.certification_requirement === true && (
                  <span className="badge-gold inline-flex items-center gap-1" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
                    <ShieldCheck size={11} /> Certification
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            disabled={busy}
            aria-label="Close evidence workspace"
            className="flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action title */}
        <p className="text-sm font-semibold text-white mb-4 leading-snug">{action.title}</p>

        {/* Evidence requirements */}
        {reqsText ? (
          <div
            className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4A843' }}>Evidence Requirements</p>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>{reqsText}</p>
          </div>
        ) : (
          <div
            className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(224,101,107,0.06)', border: '1px solid rgba(224,101,107,0.2)' }}
          >
            <p className="text-sm" style={{ color: '#E0656B' }}>Evidence requirements have not been defined.</p>
          </div>
        )}

        {/* Summary counts */}
        <div className="flex items-center gap-4 mb-5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span>{draftEvidence.length} Draft{draftEvidence.length !== 1 ? 's' : ''}</span>
          {submittedCount > 0 && <span>{submittedCount} Submitted</span>}
          {approvedCount > 0 && <span style={{ color: '#34B478' }}>{approvedCount} Approved</span>}
          {isSubmitted && <span style={{ color: '#2592A8' }}>Action Submitted for Verification</span>}
          {isRevisionRequired && <span style={{ color: '#D4A843' }}>{returnedStillOutstanding} awaiting revision</span>}
        </div>

        {/* Evidence form (add/edit/revise/supplement) */}
        {showForm && canManageEvidence && (
          <EvidenceDraftForm
            open={showForm}
            mode={formMode}
            initialEvidence={editingDraft}
            reviewerInstructions={formReviewerInstructions}
            disabled={saving}
            onCancel={handleFormCancel}
            onSave={handleFormSave}
          />
        )}

        {/* Revision Required banner */}
        {isRevisionRequired && !showForm && (
          <div
            className="rounded-xl px-4 py-4 mb-5"
            style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.25)' }}
          >
            <div className="flex items-start gap-3 mb-3">
              <MessageSquare size={18} style={{ color: '#D4A843', flexShrink: 0, marginTop: 1 }} />
              <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: '#D4A843' }}>Additional Information Required</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  The C-SHIFT reviewer has requested additional information or corrections for some of your evidence. Please review the revision instructions, edit the returned evidence, and resubmit when ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Evidence list */}
        {!showForm && (
          <>
            {loadingEvidence ? (
              <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <p className="text-sm">Loading evidence…</p>
              </div>
            ) : evidence.length === 0 ? (
              <div className="text-center py-10">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Inbox size={22} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">No Evidence Has Been Added</h3>
                <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Add documentation, links, written responses, or other proof that meets this action's evidence requirements.
                </p>
                {canManageEvidence && isAwaitingEvidence && (
                  <button type="button" className="btn-primary" onClick={handleAddClick}>
                    <Plus size={14} /> Add Evidence
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                {evidence.map((ev) => {
                  const badge = STATUS_BADGE[ev.verification_status] ?? STATUS_BADGE.Draft;
                  const isDraft = ev.verification_status === 'Draft';
                  const isRevision = ev.verification_status === 'Additional Information Required';
                  const isSelected = selectedIds.has(ev.id);
                  const canSelectForSubmit = isDraft && isAwaitingEvidence && canManageEvidence && !busy;
                  const canSelectForResubmit = isDraft && isRevisionRequired && canManageEvidence && !busy;
                  const canSelect = canSelectForSubmit || canSelectForResubmit;
                  const canRevise = isRevision && canManageEvidence && isRevisionRequired && !busy;
                  const canEditDraft = isDraft && canManageEvidence && isAwaitingEvidence && !busy;
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: isSelected ? 'rgba(28,116,134,0.06)' : 'rgba(255,255,255,0.03)',
                        border: isSelected ? '1px solid rgba(28,116,134,0.25)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {canSelect && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(ev.id)}
                              disabled={busy}
                              className="mt-1 flex-shrink-0"
                              style={{ accentColor: '#1C7486', width: 16, height: 16 }}
                              aria-label={`Select ${EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type} for ${isRevisionRequired ? 'resubmission' : 'submission'}`}
                            />
                          )}
                          <div className="flex-1 min-w-0">
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
                                <a href={ev.external_url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#1C7486' }}>
                                  {ev.external_url}
                                </a>
                              </p>
                            )}
                            {ev.written_response && (
                              <p className="text-xs mb-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{ev.written_response}</p>
                            )}
                            {ev.submission_notes && (
                              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Notes: {ev.submission_notes}</p>
                            )}
                            {/* Organization-visible revision instructions */}
                            {isRevision && ev.organization_visible_notes && (
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
                            {/* Show preserved instructions on revised Drafts too */}
                            {isDraft && isRevisionRequired && ev.organization_visible_notes && (
                              <div
                                className="mt-2 rounded-lg px-3 py-2"
                                style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.1)' }}
                              >
                                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(212,168,67,0.7)' }}>
                                  <MessageSquare size={10} className="inline mr-1" /> Original Revision Instructions
                                </p>
                                <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                  {ev.organization_visible_notes}
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(ev.created_at)}</span>
                              <span>Updated {formatDate(ev.updated_at)}</span>
                              {ev.submitted_at && <span>Submitted {formatDate(ev.submitted_at)}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Edit Draft (Awaiting Evidence) */}
                        {canEditDraft && (
                          <button
                            type="button"
                            className="btn-ghost flex-shrink-0"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => handleEditClick(ev)}
                            disabled={busy}
                            aria-label={`Edit ${EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type} draft`}
                          >
                            <Pencil size={12} /> Edit
                          </button>
                        )}
                        {/* Revise returned evidence (Revision Required) */}
                        {canRevise && (
                          <button
                            type="button"
                            className="btn-ghost flex-shrink-0"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#D4A843', borderColor: 'rgba(212,168,67,0.3)' }}
                            onClick={() => handleReviseClick(ev)}
                            disabled={busy}
                            aria-label={`Revise ${EVIDENCE_TYPE_LABELS[ev.evidence_type] ?? ev.evidence_type} evidence`}
                          >
                            <RotateCcw size={12} /> Revise
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Add Evidence / Add Supplemental */}
                {canManageEvidence && (isAwaitingEvidence || isRevisionRequired) && (
                  <button type="button" className="btn-primary w-full" onClick={handleAddClick} disabled={busy}>
                    <Plus size={14} /> {isRevisionRequired ? 'Add Supplemental Evidence' : 'Add Evidence'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Revision readiness panel */}
        {isRevisionRequired && !showForm && canManageEvidence && (
          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ background: allReturnedRevised ? 'rgba(52,180,120,0.04)' : 'rgba(212,168,67,0.06)', border: `1px solid ${allReturnedRevised ? 'rgba(52,180,120,0.15)' : 'rgba(212,168,67,0.2)'}` }}
          >
            <div className="flex items-start gap-3 mb-3">
              {allReturnedRevised ? (
                <CheckCircle2 size={16} style={{ color: '#34B478', marginTop: 1, flexShrink: 0 }} />
              ) : (
                <AlertCircle size={16} style={{ color: '#D4A843', marginTop: 1, flexShrink: 0 }} />
              )}
              <div className="flex-1">
                <p className="text-xs leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {allReturnedRevised
                    ? 'All requested revisions have been addressed. Review the selected evidence before resubmitting.'
                    : 'Complete every requested revision before resubmitting this action.'}
                </p>
                <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span>{returnedTotal} returned</span>
                  <span>{returnedRevisedToDraft} revised to Draft</span>
                  <span style={{ color: returnedStillOutstanding > 0 ? '#D4A843' : 'rgba(255,255,255,0.5)' }}>{returnedStillOutstanding} awaiting revision</span>
                  {supplementalDrafts.length > 0 && <span>{supplementalDrafts.length} supplemental</span>}
                  <span>{selectedCount} selected for resubmission</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'rgba(28,116,134,0.15)', borderColor: 'rgba(28,116,134,0.4)', color: '#2592A8' }}
                onClick={handleSubmitClick}
                disabled={!canResubmit}
                aria-label="Resubmit revised evidence to reviewer"
              >
                {resubmitting ? (
                  <><Clock size={14} className="animate-spin" /> Submitting…</>
                ) : (
                  <><Send size={14} /> Resubmit Evidence</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Original submission readiness panel (Awaiting Evidence) */}
        {isAwaitingEvidence && draftEvidence.length > 0 && !showForm && canManageEvidence && (
          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ background: 'rgba(28,116,134,0.04)', border: '1px solid rgba(28,116,134,0.15)' }}
          >
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle size={16} style={{ color: '#1C7486', marginTop: 1, flexShrink: 0 }} />
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Review the selected evidence carefully. Once submitted, these records cannot be edited while they are under review.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
              </span>
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'rgba(28,116,134,0.15)', borderColor: 'rgba(28,116,134,0.4)', color: '#2592A8' }}
                onClick={handleSubmitClick}
                disabled={busy || selectedCount === 0}
                aria-label="Submit selected evidence for verification"
              >
                {submitting ? (
                  <><Clock size={14} className="animate-spin" /> Submitting…</>
                ) : (
                  <><Send size={14} /> Submit Evidence</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Status feedback */}
        {saving && (
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }} role="status" aria-live="polite">
            {formMode === 'revise' ? 'Saving Revision…' : formMode === 'supplement' ? 'Saving Supplemental Draft…' : 'Saving Draft…'}
          </p>
        )}
        {submitting && (
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }} role="status" aria-live="polite">
            Submitting evidence for verification…
          </p>
        )}
        {resubmitting && (
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }} role="status" aria-live="polite">
            Resubmitting revised evidence…
          </p>
        )}
      </div>
    </div>
  );
}
