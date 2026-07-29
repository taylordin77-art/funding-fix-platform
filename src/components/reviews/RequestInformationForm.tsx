import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Lock, AlertCircle } from 'lucide-react';

export interface RequestInformationFormValues {
  organizationVisibleNotes: string;
  reviewerNotes: string;
}

interface RequestInformationFormProps {
  open: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onContinue: (values: RequestInformationFormValues) => void;
}

export function RequestInformationForm({
  open,
  disabled,
  onCancel,
  onContinue,
}: RequestInformationFormProps) {
  const [orgNotes, setOrgNotes] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [orgNotesTouched, setOrgNotesTouched] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setOrgNotes('');
    setReviewerNotes('');
    setOrgNotesTouched(false);
  }, [open]);

  if (!open) return null;

  const orgNotesTrimmed = orgNotes.trim();
  const orgNotesError = orgNotesTouched && orgNotesTrimmed === '';
  const canContinue = orgNotesTrimmed !== '' && !disabled;

  const handleContinue = () => {
    if (!canContinue) {
      setOrgNotesTouched(true);
      return;
    }
    onContinue({
      organizationVisibleNotes: orgNotes,
      reviewerNotes: reviewerNotes.trim(),
    });
  };

  return (
    <div className="space-y-5">
      {/* Organization-visible instructions */}
      <div>
        <label
          htmlFor="org-visible-notes"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
          style={{ color: '#D4A843' }}
        >
          <MessageSquare size={12} /> Organization Instructions
        </label>
        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
          These instructions will be visible to the organization.
        </p>
        <textarea
          id="org-visible-notes"
          value={orgNotes}
          onChange={(e) => setOrgNotes(e.target.value)}
          onBlur={() => setOrgNotesTouched(true)}
          disabled={disabled}
          rows={4}
          maxLength={10000}
          className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed resize-y"
          style={{
            background: 'rgba(212,168,67,0.04)',
            border: orgNotesError ? '1px solid #E0656B' : '1px solid rgba(212,168,67,0.2)',
            color: 'rgba(255,255,255,0.9)',
          }}
          placeholder="What does the organization need to provide or correct?"
          aria-label="Organization-visible revision instructions"
          aria-invalid={orgNotesError}
          aria-describedby={orgNotesError ? 'org-notes-error' : undefined}
        />
        {orgNotesError && (
          <p id="org-notes-error" className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#E0656B' }} role="alert">
            <AlertCircle size={11} /> Provide clear instructions explaining what the organization needs to revise.
          </p>
        )}
      </div>

      {/* Internal reviewer notes */}
      <div>
        <label
          htmlFor="reviewer-notes"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <Lock size={12} /> Internal Reviewer Notes
        </label>
        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
          These notes are visible only to C-SHIFT reviewers.
        </p>
        <textarea
          id="reviewer-notes"
          value={reviewerNotes}
          onChange={(e) => setReviewerNotes(e.target.value)}
          disabled={disabled}
          rows={3}
          maxLength={10000}
          className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed resize-y"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)',
          }}
          placeholder="Optional internal reasoning, risk concerns, or follow-up context"
          aria-label="Internal reviewer notes (not visible to organization)"
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          className="btn-ghost"
          onClick={onCancel}
          disabled={disabled}
          aria-label="Cancel request for additional information"
        >
          Cancel
        </button>
        <button
          ref={continueRef}
          type="button"
          className="btn-primary"
          onClick={handleContinue}
          disabled={!canContinue}
          aria-label="Continue to confirmation"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
