import { useEffect, useRef } from 'react';
import { ShieldCheck, Clock, MessageSquare } from 'lucide-react';
import { EVIDENCE_TYPE_LABELS } from '../../lib/actionEvidenceService';
import type { EvidenceType } from '../../lib/actionWorkflowService';

interface RequestInformationModalProps {
  open: boolean;
  organizationName: string;
  actionTitle: string;
  actionPillar: string;
  selectedEvidenceCount: number;
  selectedEvidenceTypes: EvidenceType[];
  organizationVisibleNotes: string;
  certificationRequired: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RequestInformationModal({
  open,
  organizationName,
  actionTitle,
  actionPillar,
  selectedEvidenceCount,
  selectedEvidenceTypes,
  organizationVisibleNotes,
  certificationRequired,
  disabled,
  onCancel,
  onConfirm,
}: RequestInformationModalProps) {
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
      aria-labelledby="request-info-title"
      aria-describedby="request-info-body"
    >
      <div
        className="card-premium p-7 max-w-lg w-full"
        style={{ background: '#141414' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)' }}
        >
          <MessageSquare size={20} style={{ color: '#D4A843' }} />
        </div>

        <h2 id="request-info-title" className="heading-lg text-white mb-3">
          Request Additional Information?
        </h2>
        <p id="request-info-body" className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          The selected evidence will be returned to the organization with revision instructions. The action will move to Revision Required.
        </p>

        {/* Action summary */}
        <div
          className="rounded-xl px-4 py-3 mb-4 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{organizationName}</p>
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

        {/* Selected evidence summary */}
        <div
          className="rounded-xl px-4 py-3 mb-4"
          style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4A843' }}>
            {selectedEvidenceCount} Evidence {selectedEvidenceCount === 1 ? 'Item' : 'Items'} Selected
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
        </div>

        {/* Organization-visible instructions preview */}
        <div
          className="rounded-xl px-4 py-3 mb-6"
          style={{ background: 'rgba(28,116,134,0.04)', border: '1px solid rgba(28,116,134,0.15)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1C7486' }}>
            Organization Instructions
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {organizationVisibleNotes}
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel revision request"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={disabled}
            aria-label="Send revision request to organization"
          >
            {disabled ? (
              <><Clock size={16} className="animate-spin" /> Sending…</>
            ) : (
              <><MessageSquare size={16} /> Send Revision Request</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
