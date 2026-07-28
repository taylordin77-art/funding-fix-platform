import { useEffect, useRef, useState } from 'react';
import { Loader2, Link as LinkIcon, FileText, StickyNote } from 'lucide-react';
import { EVIDENCE_TYPE_OPTIONS, EVIDENCE_TYPE_LABELS } from '../../lib/actionEvidenceService';
import type { EvidenceType, EvidenceRecord } from '../../lib/actionWorkflowService';

interface EvidenceDraftFormProps {
  open: boolean;
  /** When editing an existing draft, pass its initial values. */
  initialEvidence?: EvidenceRecord | null;
  disabled?: boolean;
  onCancel: () => void;
  onSave: (values: {
    evidenceType: EvidenceType;
    externalUrl: string | null;
    writtenResponse: string | null;
    submissionNotes: string | null;
  }) => void;
}

export function EvidenceDraftForm({
  open, initialEvidence, disabled, onCancel, onSave,
}: EvidenceDraftFormProps) {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('document');
  const [externalUrl, setExternalUrl] = useState('');
  const [writtenResponse, setWrittenResponse] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [touched, setTouched] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (initialEvidence) {
      setEvidenceType(initialEvidence.evidence_type);
      setExternalUrl(initialEvidence.external_url ?? '');
      setWrittenResponse(initialEvidence.written_response ?? '');
      setSubmissionNote(initialEvidence.submission_notes ?? '');
    } else {
      setEvidenceType('document');
      setExternalUrl('');
      setWrittenResponse('');
      setSubmissionNote('');
    }
    setTouched(false);
  }, [open, initialEvidence]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => saveRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) { e.preventDefault(); onCancel(); }
      if (e.key === 'Tab') {
        const focusables = [cancelRef.current, saveRef.current].filter(Boolean) as HTMLButtonElement[];
        if (focusables.length === 0) return;
        const first = focusables[0]; const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onCancel, disabled]);

  if (!open) return null;

  const isEditMode = !!initialEvidence;
  const requiresUrl = evidenceType === 'website_link';
  const requiresWritten = evidenceType === 'written_response';
  const showUrlField = requiresUrl || evidenceType !== 'written_response';
  const showWrittenField = !requiresUrl;

  const trimmedUrl = externalUrl.trim();
  const trimmedWritten = writtenResponse.trim();
  const trimmedNotes = submissionNote.trim();

  const urlError = touched && requiresUrl && trimmedUrl === '' ? 'A web address is required for this evidence type.' : '';
  const writtenError = touched && requiresWritten && trimmedWritten === '' ? 'A written response is required for this evidence type.' : '';
  const contentError = touched && !requiresUrl && !requiresWritten && trimmedUrl === '' && trimmedWritten === '' && trimmedNotes === ''
    ? 'Provide at least one piece of evidence content.' : '';

  const canSave = !disabled && !urlError && !writtenError && !contentError &&
    (requiresUrl ? trimmedUrl !== '' : true) &&
    (requiresWritten ? trimmedWritten !== '' : true);

  const handleSave = () => {
    setTouched(true);
    if (!canSave) return;
    onSave({
      evidenceType,
      externalUrl: trimmedUrl || null,
      writtenResponse: trimmedWritten || null,
      submissionNotes: trimmedNotes || null,
    });
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      role="form"
      aria-label={isEditMode ? 'Edit evidence draft' : 'Add evidence draft'}
    >
      {/* Evidence Type */}
      <div className="mb-4">
        <label htmlFor="evidence-type" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Evidence Type <span style={{ color: '#E0656B' }}>*</span>
        </label>
        <select
          id="evidence-type"
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
          disabled={disabled}
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {EVIDENCE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#141414' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* External URL */}
      {showUrlField && (
        <div className="mb-4">
          <label htmlFor="evidence-url" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <LinkIcon size={11} className="inline mr-1" />
            {requiresUrl ? 'Website Link' : 'External Document Link'}
            {requiresUrl && <span style={{ color: '#E0656B' }}> *</span>}
          </label>
          <input
            id="evidence-url"
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            disabled={disabled}
            placeholder="https://"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${urlError ? 'rgba(224,101,107,0.4)' : 'rgba(255,255,255,0.12)'}` }}
            aria-invalid={!!urlError}
            aria-describedby={urlError ? 'evidence-url-error' : undefined}
          />
          {urlError && (
            <p id="evidence-url-error" className="text-xs mt-1.5" style={{ color: '#E0656B' }} role="alert">{urlError}</p>
          )}
          {!requiresUrl && (
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Secure file uploads will be available in a later release. You may provide a secure external document link for now.
            </p>
          )}
        </div>
      )}

      {/* Written Response */}
      {showWrittenField && (
        <div className="mb-4">
          <label htmlFor="evidence-written" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <FileText size={11} className="inline mr-1" />
            Written Response
            {requiresWritten && <span style={{ color: '#E0656B' }}> *</span>}
          </label>
          <textarea
            id="evidence-written"
            value={writtenResponse}
            onChange={(e) => setWrittenResponse(e.target.value)}
            disabled={disabled}
            rows={4}
            placeholder="Describe the evidence..."
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white resize-y"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${writtenError ? 'rgba(224,101,107,0.4)' : 'rgba(255,255,255,0.12)'}` }}
            aria-invalid={!!writtenError}
            aria-describedby={writtenError ? 'evidence-written-error' : undefined}
          />
          {writtenError && (
            <p id="evidence-written-error" className="text-xs mt-1.5" style={{ color: '#E0656B' }} role="alert">{writtenError}</p>
          )}
        </div>
      )}

      {/* Submission Notes */}
      <div className="mb-5">
        <label htmlFor="evidence-notes" className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <StickyNote size={11} className="inline mr-1" />
          Submission Notes <span style={{ color: 'rgba(255,255,255,0.35)' }}>(optional)</span>
        </label>
        <textarea
          id="evidence-notes"
          value={submissionNote}
          onChange={(e) => setSubmissionNote(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Add any context for reviewers..."
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white resize-y"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
      </div>

      {contentError && (
        <p className="text-xs mb-4" style={{ color: '#E0656B' }} role="alert">{contentError}</p>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          className="btn-ghost"
          onClick={onCancel}
          disabled={disabled}
          aria-label="Cancel"
        >
          Cancel
        </button>
        <button
          ref={saveRef}
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={!canSave}
          aria-label={isEditMode ? 'Update the evidence draft' : 'Save the evidence draft'}
        >
          {disabled ? (
            <><Loader2 size={14} className="animate-spin" /> Saving Draft…</>
          ) : isEditMode ? (
            <><FileText size={14} /> Update Draft</>
          ) : (
            <><FileText size={14} /> Save Draft</>
          )}
        </button>
      </div>
    </div>
  );
}

export { EVIDENCE_TYPE_LABELS };
