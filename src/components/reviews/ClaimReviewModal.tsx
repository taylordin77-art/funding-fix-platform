import { useEffect, useRef } from 'react';
import { ShieldCheck, Clock, UserCheck } from 'lucide-react';

interface ClaimReviewModalProps {
  open: boolean;
  organizationName: string;
  actionTitle: string;
  actionPillar: string;
  submittedEvidenceCount: number;
  certificationRequired: boolean;
  evidenceRequirements: string | null;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClaimReviewModal({
  open,
  organizationName,
  actionTitle,
  actionPillar,
  submittedEvidenceCount,
  certificationRequired,
  evidenceRequirements,
  disabled,
  onCancel,
  onConfirm,
}: ClaimReviewModalProps) {
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

  const reqsText = evidenceRequirements?.trim() || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!disabled) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-review-title"
      aria-describedby="claim-review-body"
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
          <UserCheck size={20} style={{ color: '#1C7486' }} />
        </div>

        <h2 id="claim-review-title" className="heading-lg text-white mb-3">
          Claim This Action for Review?
        </h2>
        <p id="claim-review-body" className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          You will become the assigned C-SHIFT reviewer for this action. Submitted evidence will move to Under Review.
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

        {/* Evidence summary */}
        <div
          className="rounded-xl px-4 py-3 mb-4"
          style={{ background: 'rgba(28,116,134,0.06)', border: '1px solid rgba(28,116,134,0.2)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1C7486' }}>
            {submittedEvidenceCount} Evidence {submittedEvidenceCount === 1 ? 'Item' : 'Items'} to Review
          </p>
        </div>

        {/* Evidence requirements */}
        {reqsText && (
          <div
            className="rounded-xl px-4 py-3 mb-6"
            style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4A843' }}>Evidence Requirements</p>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>{reqsText}</p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel review claim"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={disabled}
            aria-label="Claim this action for review"
          >
            {disabled ? (
              <><Clock size={16} className="animate-spin" /> Claiming…</>
            ) : (
              <><UserCheck size={16} /> Claim Review</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
