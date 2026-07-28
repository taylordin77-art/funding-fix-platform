import { useEffect, useRef } from 'react';
import { FileCheck2, ShieldCheck, Clock } from 'lucide-react';

interface RequestEvidenceModalProps {
  open: boolean;
  actionTitle: string;
  actionPillar: string;
  evidenceRequirements: string | null;
  estimatedDays: number | null;
  certificationRequired: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for the In Progress -> Awaiting Evidence transition.
 * Focus-trapped, Escape to close, returns focus to the trigger on close.
 * Displays the actual persisted evidence requirements (never generated).
 */
export function RequestEvidenceModal({
  open,
  actionTitle,
  actionPillar,
  evidenceRequirements,
  estimatedDays,
  certificationRequired,
  disabled,
  onCancel,
  onConfirm,
}: RequestEvidenceModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const t = window.setTimeout(() => confirmRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!disabled) onCancel();
      }
      if (e.key === 'Tab') {
        const focusables = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onCancel, disabled]);

  if (!open) return null;

  const requirementsText = evidenceRequirements?.trim() || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!disabled) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-evidence-title"
      aria-describedby="request-evidence-body"
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
          <FileCheck2 size={20} style={{ color: '#D4A843' }} />
        </div>

        <h2 id="request-evidence-title" className="heading-lg text-white mb-3">
          Move This Action to Evidence Collection?
        </h2>
        <p id="request-evidence-body" className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          This action will move to Awaiting Evidence. Your organization will need to provide the
          listed documentation or proof before it can be submitted for verification.
        </p>

        {/* Action summary */}
        <div
          className="rounded-xl px-4 py-3 mb-4 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-sm font-semibold text-white leading-snug">{actionTitle}</p>
          <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="badge-teal" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
              {actionPillar}
            </span>
            {estimatedDays != null && (
              <span className="flex items-center gap-1">
                <Clock size={11} style={{ color: '#1C7486' }} /> {estimatedDays} days est.
              </span>
            )}
            {certificationRequired && (
              <span className="badge-gold inline-flex items-center gap-1" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
                <ShieldCheck size={11} /> Certification
              </span>
            )}
          </div>
        </div>

        {/* Evidence requirements (actual persisted text, not generated) */}
        {requirementsText ? (
          <div
            className="rounded-xl px-4 py-3 mb-6"
            style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D4A843' }}>
              Evidence Required
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {requirementsText}
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl px-4 py-3 mb-6"
            style={{ background: 'rgba(224,101,107,0.06)', border: '1px solid rgba(224,101,107,0.2)' }}
          >
            <p className="text-sm" style={{ color: '#E0656B' }}>
              Evidence requirements have not been defined.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel moving the action to evidence collection"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={disabled || !requirementsText}
            aria-label="Move the action to Awaiting Evidence"
          >
            <FileCheck2 size={16} /> Move to Awaiting Evidence
          </button>
        </div>
      </div>
    </div>
  );
}
