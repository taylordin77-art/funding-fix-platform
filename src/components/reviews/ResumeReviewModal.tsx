import { useEffect, useRef } from 'react';
import { Play, Clock, ShieldCheck, FileCheck2 } from 'lucide-react';
import { EVIDENCE_TYPE_LABELS } from '../../lib/actionEvidenceService';
import type { EvidenceType } from '../../lib/actionWorkflowService';

interface ResumeReviewModalProps {
  open: boolean;
  organizationName: string;
  actionTitle: string;
  actionPillar: string;
  selectedEvidenceCount: number;
  selectedEvidenceTypes: EvidenceType[];
  hasRevisionInstructions: boolean;
  certificationRequired: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResumeReviewModal({
  open,
  organizationName,
  actionTitle,
  actionPillar,
  selectedEvidenceCount,
  selectedEvidenceTypes,
  hasRevisionInstructions,
  certificationRequired,
  disabled,
  onCancel,
  onConfirm,
}: ResumeReviewModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (!disabled) onCancel(); }
      if (e.key === 'Tab') {
        const focusables = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        if (focusables.length === 0) return;
        const first = focusables[0]; const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onCancel, disabled]);

  if (!open) return null;

  const uniqueTypes = [...new Set(selectedEvidenceTypes)];
  const typeLabels = uniqueTypes.map((t) => EVIDENCE_TYPE_LABELS[t] ?? t);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!disabled) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-title"
      aria-describedby="resume-body"
    >
      <div
        className="card-premium p-7 max-w-lg w-full"
        style={{ background: '#141414' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.25)' }}
        >
          <Play size={20} style={{ color: '#1C7486' }} />
        </div>

        <h2 id="resume-title" className="heading-lg text-white mb-3">
          Resume Review of Revised Evidence?
        </h2>
        <p id="resume-body" className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          The selected evidence will move to Under Review and remain assigned to you.
        </p>

        {/* Action summary */}
        <div
          className="rounded-xl px-4 py-3 mb-4 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {organizationName}
          </p>
          <p className="text-sm font-semibold text-white leading-snug">{actionTitle}</p>
          <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="badge-teal" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>{actionPillar}</span>
            {certificationRequired && (
              <span className="badge-gold inline-flex items-center gap-1" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
                <ShieldCheck size={11} /> Certification
              </span>
            )}
          </div>
        </div>

        {/* Evidence summary */}
        <div
          className="rounded-xl px-4 py-3 mb-4"
          style={{ background: 'rgba(28,116,134,0.06)', border: '1px solid rgba(28,116,134,0.2)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1C7486' }}>
            <FileCheck2 size={11} className="inline mr-1" /> {selectedEvidenceCount} Evidence {selectedEvidenceCount === 1 ? 'Item' : 'Items'} Selected
          </p>
          {typeLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {typeLabels.map((label, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          {hasRevisionInstructions && (
            <p className="text-xs mt-2" style={{ color: 'rgba(212,168,67,0.7)' }}>
              Includes evidence with prior revision instructions.
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel resume review"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={disabled}
            aria-label="Resume review of selected evidence"
          >
            {disabled ? (
              <><Clock size={16} className="animate-spin" /> Resuming…</>
            ) : (
              <><Play size={16} /> Resume Review</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
