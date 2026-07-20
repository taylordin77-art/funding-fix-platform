import { useEffect, useRef } from 'react';
import { Play, Clock } from 'lucide-react';

interface StartActionModalProps {
  open: boolean;
  actionTitle: string;
  actionPillar: string;
  estimatedDays: number | null;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for the Start Action transition. Focus-trapped,
 * Escape to close, returns focus to the trigger on close. Styled to match
 * the existing ConfirmCreatePlanModal pattern.
 */
export function StartActionModal({
  open, actionTitle, actionPillar, estimatedDays, disabled, onCancel, onConfirm,
}: StartActionModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (!disabled) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-action-title"
      aria-describedby="start-action-body"
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
          <Play size={20} style={{ color: '#1C7486' }} />
        </div>

        <h2 id="start-action-title" className="heading-lg text-white mb-3">
          Start This Action?
        </h2>
        <p id="start-action-body" className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
          This action will move to In Progress and become part of your organization's active work.
        </p>

        {/* Action summary */}
        <div
          className="rounded-xl px-4 py-3 mb-6 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-sm font-semibold text-white leading-snug">{actionTitle}</p>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="badge-teal" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
              {actionPillar}
            </span>
            {estimatedDays != null && (
              <span className="flex items-center gap-1">
                <Clock size={11} style={{ color: '#1C7486' }} /> {estimatedDays} days est.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={disabled}
            aria-label="Cancel starting the action"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={disabled}
            aria-label="Start the action"
          >
            <Play size={16} /> Start Action
          </button>
        </div>
      </div>
    </div>
  );
}
