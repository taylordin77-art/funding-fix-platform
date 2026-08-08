import { useEffect, useRef } from 'react';
import { ShieldCheck, AlertTriangle, Loader2, Building2, FileText, Award } from 'lucide-react';

interface VerifyActionModalProps {
  open: boolean;
  organizationName: string;
  actionTitle: string;
  actionPillar: string;
  approvedEvidenceCount: number;
  certificationRequired: boolean;
  evidenceRequirements: string | null;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function VerifyActionModal({
  open,
  organizationName,
  actionTitle,
  actionPillar,
  approvedEvidenceCount,
  certificationRequired,
  evidenceRequirements,
  disabled,
  onCancel,
  onConfirm,
}: VerifyActionModalProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => confirmRef.current?.focus(), 50);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) {
        e.preventDefault();
        onCancel();
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
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, disabled, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (!disabled && e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-modal-title"
      aria-describedby="verify-modal-body"
    >
      <div
        className="max-w-md w-full rounded-2xl p-6"
        style={{ background: '#141414', border: '1px solid rgba(52,180,120,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(52,180,120,0.1)', border: '1px solid rgba(52,180,120,0.2)' }}
          >
            <ShieldCheck size={18} style={{ color: '#34B478' }} />
          </div>
          <div>
            <h2 id="verify-modal-title" className="text-lg font-bold text-white mb-1">Verify This Action?</h2>
            <p id="verify-modal-body" className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Verifying this action confirms that C-SHIFT has reviewed the supporting evidence and accepted the action as satisfactorily completed.
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <Building2 size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span>{organizationName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <FileText size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span>{actionTitle}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <Award size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span>{actionPillar}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ShieldCheck size={13} style={{ color: '#34B478' }} />
            <span>Approved Evidence: {approvedEvidenceCount}</span>
          </div>
          {certificationRequired && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#D4A843' }}>
              <Award size={13} />
              <span>Certification Required</span>
            </div>
          )}
          {evidenceRequirements && evidenceRequirements.trim() && (
            <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Evidence Requirements
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {evidenceRequirements}
              </p>
            </div>
          )}
        </div>

        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-start gap-2"
          style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}
        >
          <AlertTriangle size={14} style={{ color: '#D4A843', marginTop: 2, flexShrink: 0 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Verification cannot be undone through the current workflow.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost flex-1"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel verification"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary flex-1"
            style={{ background: 'rgba(52,180,120,0.15)', borderColor: 'rgba(52,180,120,0.4)', color: '#34B478' }}
            onClick={onConfirm}
            disabled={disabled}
            aria-label="Verify this action"
          >
            {disabled ? (
              <><Loader2 size={14} className="animate-spin" /> Verifying…</>
            ) : (
              <><ShieldCheck size={14} /> Verify Action</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
