import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmCreatePlanModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  assessmentLabel: string;
}

/**
 * Accessible confirmation modal for action-plan creation. Focus-trapped,
 * Escape to close, click-outside to cancel. Styled to match the dark
 * executive Action Center language. No second modal design system exists in
 * the app, so this is the single confirmation pattern for this flow.
 */
export function ConfirmCreatePlanModal({
  open, onCancel, onConfirm, disabled, assessmentLabel,
}: ConfirmCreatePlanModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the confirm action shortly after mount.
    const t = window.setTimeout(() => confirmRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!disabled) onCancel();
      }
      // Basic focus trap: keep Tab within the two buttons.
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!disabled) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-create-plan-title"
      aria-describedby="confirm-create-plan-body"
    >
      <div
        className="card-premium p-7 max-w-md w-full"
        style={{ background: '#141414' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.25)' }}
        >
          <AlertCircle size={20} style={{ color: '#1C7486' }} />
        </div>

        <h2 id="confirm-create-plan-title" className="heading-lg text-white mb-3">
          Create This Action Plan?
        </h2>
        <p id="confirm-create-plan-body" className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          C-SHIFT will turn this completed assessment into a prioritized organizational action plan.
          The same assessment cannot be used to create another plan.
        </p>

        {assessmentLabel && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-xs"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Selected assessment: </span>
            {assessmentLabel}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel action plan creation"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={disabled}
            aria-label="Create the action plan"
          >
            Create Action Plan
          </button>
        </div>
      </div>
    </div>
  );
}
