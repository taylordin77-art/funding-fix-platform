import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, FileCheck2, UserCheck, Loader2, AlertCircle, ChevronRight, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getReviewQueue, getReviewAction, type ReviewQueueItem, type ReviewActionDetail } from '../lib/reviewQueueService';
import { claimActionForReview, requestAdditionalInformation, resumeActionReview, type ClaimActionForReviewErrorCode, type RequestAdditionalInformationErrorCode, type ResumeActionReviewErrorCode } from '../lib/actionMutationService';
import type { EvidenceType } from '../lib/actionWorkflowService';
import { ClaimReviewModal } from '../components/reviews/ClaimReviewModal';
import { ReviewActionPanel } from '../components/reviews/ReviewActionPanel';
import { RequestInformationModal } from '../components/reviews/RequestInformationModal';
import { ResumeReviewModal } from '../components/reviews/ResumeReviewModal';

type QueueState =
  | { phase: 'loading' }
  | { phase: 'ready'; items: ReviewQueueItem[] }
  | { phase: 'error'; message: string };

type ClaimState =
  | { phase: 'idle' }
  | { phase: 'confirming'; item: ReviewQueueItem }
  | { phase: 'claiming'; item: ReviewQueueItem }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string; reloadQueue: boolean };

type DetailState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; action: ReviewActionDetail }
  | { phase: 'error'; message: string };

type RequestState =
  | { phase: 'idle' }
  | { phase: 'confirming'; action: ReviewActionDetail; evidenceIds: string[]; orgNotes: string; reviewerNotes: string }
  | { phase: 'processing'; action: ReviewActionDetail; evidenceIds: string[]; orgNotes: string; reviewerNotes: string }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string; reloadAction: boolean };

type ResumeState =
  | { phase: 'idle' }
  | { phase: 'confirming'; action: ReviewActionDetail; evidenceIds: string[] }
  | { phase: 'processing'; action: ReviewActionDetail; evidenceIds: string[] }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string; reloadAction: boolean };

const CLAIM_MESSAGES: Record<ClaimActionForReviewErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This review action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to claim reviews.',
  ACTION_NOT_SUBMITTED: 'This action has not been submitted for verification.',
  ACTION_ALREADY_CLAIMED: 'This action has already been claimed by another reviewer.',
  ACTION_ALREADY_CLAIMED_BY_YOU: 'You have already claimed this action.',
  NO_SUBMITTED_EVIDENCE: 'This action does not contain submitted evidence to review.',
  EVIDENCE_PACKAGE_INCONSISTENT: 'The submitted evidence package is in an inconsistent review state.',
  INVALID_ACTION_STATUS: 'This action cannot be claimed from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid workflow state and cannot be claimed.',
  UNEXPECTED_ERROR: 'We could not claim this review. Please try again.',
};

const REQUEST_MESSAGES: Record<RequestAdditionalInformationErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This review action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to make this review decision.',
  ACTION_NOT_SUBMITTED: 'This action has not been submitted for review.',
  REVIEW_NOT_CLAIMED: 'This action has not been claimed for review.',
  REVIEW_NOT_OWNED: 'You are not the assigned reviewer for this action.',
  ACTION_ALREADY_RETURNED_FOR_REVISION: 'This action has already been returned to the organization for revision.',
  NO_EVIDENCE_SELECTED: 'Select at least one Under Review evidence record.',
  EVIDENCE_NOT_FOUND: 'One or more selected evidence records could not be found.',
  EVIDENCE_ACTION_MISMATCH: 'One or more selected evidence records do not belong to this action.',
  EVIDENCE_ORGANIZATION_MISMATCH: 'One or more selected evidence records do not belong to this organization.',
  EVIDENCE_NOT_UNDER_REVIEW: 'One or more selected evidence records are no longer Under Review.',
  EVIDENCE_REVIEWER_MISMATCH: 'One or more selected evidence records are assigned to another reviewer.',
  ORGANIZATION_NOTES_REQUIRED: 'Provide clear instructions explaining what the organization needs to revise.',
  INVALID_ACTION_STATUS: 'This action cannot be returned for revision from its current status.',
  ACTION_STATE_INCONSISTENT: 'This review has an invalid workflow state and could not be updated.',
  UNEXPECTED_ERROR: 'We could not request additional information. Please try again.',
};

const STALE_STATE_CODES: RequestAdditionalInformationErrorCode[] = [
  'ACTION_ALREADY_RETURNED_FOR_REVISION',
  'EVIDENCE_NOT_UNDER_REVIEW',
  'EVIDENCE_REVIEWER_MISMATCH',
  'REVIEW_NOT_OWNED',
];

const RESUME_MESSAGES: Record<ResumeActionReviewErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  ACTION_NOT_FOUND: 'This review action could not be found.',
  NOT_AUTHORIZED: 'You do not have permission to resume this review.',
  ACTION_NOT_SUBMITTED: 'This action has not been submitted for verification.',
  ACTION_NOT_RESUBMITTED: 'This action does not contain revised evidence ready for review.',
  REVIEW_NOT_CLAIMED: 'This action has not been claimed for review.',
  REVIEW_NOT_OWNED: 'You are not the assigned reviewer for this action.',
  NO_EVIDENCE_SELECTED: 'Select at least one submitted evidence record.',
  EVIDENCE_NOT_FOUND: 'One or more selected evidence records could not be found.',
  EVIDENCE_ACTION_MISMATCH: 'One or more selected evidence records do not belong to this action.',
  EVIDENCE_ORGANIZATION_MISMATCH: 'One or more selected evidence records do not belong to this organization.',
  EVIDENCE_NOT_RESUMABLE: 'One or more selected evidence records can no longer be resumed.',
  EVIDENCE_REVIEW_STATE_INCONSISTENT: 'One or more evidence records have an invalid review state.',
  INVALID_ACTION_STATUS: 'This action cannot resume review from its current status.',
  ACTION_STATE_INCONSISTENT: 'This action has an invalid review state and could not be updated.',
  UNEXPECTED_ERROR: 'We could not resume this review. Please try again.',
};

const RESUME_STALE_CODES: ResumeActionReviewErrorCode[] = [
  'EVIDENCE_NOT_RESUMABLE',
  'EVIDENCE_REVIEW_STATE_INCONSISTENT',
  'REVIEW_NOT_OWNED',
  'ACTION_NOT_RESUBMITTED',
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const [isReviewer, setIsReviewer] = useState<boolean | null>(null);
  const [queueState, setQueueState] = useState<QueueState>({ phase: 'loading' });
  const [claimState, setClaimState] = useState<ClaimState>({ phase: 'idle' });
  const [detailState, setDetailState] = useState<DetailState>({ phase: 'idle' });
  const [requestState, setRequestState] = useState<RequestState>({ phase: 'idle' });
  const [resumeState, setResumeState] = useState<ResumeState>({ phase: 'idle' });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Check reviewer authorization
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsReviewer(false); return; }
      setCurrentUserId(user.id);
      const { data: profile } = (await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()) as { data: { role: string } | null };
      setIsReviewer(profile?.role === 'admin');
    })();
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueState({ phase: 'loading' });
    const result = await getReviewQueue();
    if (result.ok) {
      setQueueState({ phase: 'ready', items: result.items });
    } else {
      setQueueState({ phase: 'error', message: result.error.message });
    }
  }, []);

  useEffect(() => {
    if (isReviewer === true) loadQueue();
  }, [isReviewer, loadQueue]);

  const reloadDetail = useCallback(async (actionId: string) => {
    const result = await getReviewAction(actionId);
    if (result.ok) {
      setDetailState({ phase: 'ready', action: result.action });
    } else {
      setDetailState({ phase: 'error', message: 'Unable to reload this review action.' });
    }
  }, []);

  const handleClaimClick = useCallback((item: ReviewQueueItem) => {
    setClaimState({ phase: 'confirming', item });
  }, []);

  const handleClaimConfirm = useCallback(async () => {
    if (claimState.phase !== 'confirming') return;
    const item = claimState.item;
    setClaimState({ phase: 'claiming', item });

    const result = await claimActionForReview(item.id);

    if (result.ok) {
      setClaimState({ phase: 'success', message: `Review claimed successfully. ${result.evidenceCount} submitted evidence item(s) are now Under Review.` });
      await loadQueue();
      return;
    }

    const code = result.error.code;
    if (code === 'ACTION_ALREADY_CLAIMED' || code === 'ACTION_ALREADY_CLAIMED_BY_YOU') {
      setClaimState({ phase: 'error', message: CLAIM_MESSAGES[code], reloadQueue: true });
      await loadQueue();
      return;
    }

    setClaimState({ phase: 'error', message: CLAIM_MESSAGES[code], reloadQueue: false });
  }, [claimState, loadQueue]);

  const closeClaimModal = useCallback(() => {
    if (claimState.phase === 'claiming') return;
    setClaimState({ phase: 'idle' });
  }, [claimState.phase]);

  const handleViewDetail = useCallback(async (actionId: string) => {
    setDetailState({ phase: 'loading' });
    const result = await getReviewAction(actionId);
    if (result.ok) {
      setDetailState({ phase: 'ready', action: result.action });
    } else {
      setDetailState({ phase: 'error', message: 'Unable to load this review action.' });
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailState({ phase: 'idle' });
  }, []);

  // Request Additional Information workflow
  const handleRequestInformation = useCallback(async (_actionId: string, evidenceIds: string[], orgNotes: string, reviewerNotes: string) => {
    if (!detailState || detailState.phase !== 'ready') return;
    setRequestState({ phase: 'confirming', action: detailState.action, evidenceIds, orgNotes, reviewerNotes });
  }, [detailState]);

  const handleRequestConfirm = useCallback(async () => {
    if (requestState.phase !== 'confirming') return;
    const { action, evidenceIds, orgNotes, reviewerNotes } = requestState;
    setRequestState({ phase: 'processing', action, evidenceIds, orgNotes, reviewerNotes });

    const result = await requestAdditionalInformation({
      actionId: action.id,
      evidenceIds,
      organizationVisibleNotes: orgNotes,
      reviewerNotes: reviewerNotes || null,
    });

    if (result.ok) {
      setRequestState({ phase: 'success', message: `Additional information requested. ${result.evidenceCount} evidence item(s) were returned to the organization for revision.` });
      await loadQueue();
      await reloadDetail(action.id);
      return;
    }

    const code = result.error.code;
    if (STALE_STATE_CODES.includes(code)) {
      setRequestState({ phase: 'error', message: REQUEST_MESSAGES[code], reloadAction: true });
      await loadQueue();
      await reloadDetail(action.id);
      return;
    }

    setRequestState({ phase: 'error', message: REQUEST_MESSAGES[code], reloadAction: false });
  }, [requestState, loadQueue, reloadDetail]);

  const closeRequestModal = useCallback(() => {
    if (requestState.phase === 'processing') return;
    setRequestState({ phase: 'idle' });
  }, [requestState.phase]);

  // Resume Review workflow
  const handleResumeReview = useCallback(async (_actionId: string, evidenceIds: string[]) => {
    if (detailState.phase !== 'ready') return;
    setResumeState({ phase: 'confirming', action: detailState.action, evidenceIds });
  }, [detailState]);

  const handleResumeConfirm = useCallback(async () => {
    if (resumeState.phase !== 'confirming') return;
    const { action, evidenceIds } = resumeState;
    setResumeState({ phase: 'processing', action, evidenceIds });

    const result = await resumeActionReview({ actionId: action.id, evidenceIds });

    if (result.ok) {
      setResumeState({ phase: 'success', message: `Review resumed. ${result.evidenceCount} revised evidence item(s) are now Under Review.` });
      await loadQueue();
      await reloadDetail(action.id);
      return;
    }

    const code = result.error.code;
    if (RESUME_STALE_CODES.includes(code)) {
      setResumeState({ phase: 'error', message: RESUME_MESSAGES[code], reloadAction: true });
      await loadQueue();
      await reloadDetail(action.id);
      return;
    }

    setResumeState({ phase: 'error', message: RESUME_MESSAGES[code], reloadAction: false });
  }, [resumeState, loadQueue, reloadDetail]);

  const closeResumeModal = useCallback(() => {
    if (resumeState.phase === 'processing') return;
    setResumeState({ phase: 'idle' });
  }, [resumeState.phase]);

  // Access denied state
  if (isReviewer === false) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(224,101,107,0.08)', border: '1px solid rgba(224,101,107,0.2)' }}
          >
            <ShieldCheck size={26} style={{ color: '#E0656B' }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Access Denied</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            You do not have permission to access the review queue.
          </p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isReviewer === null) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Loader2 size={24} className="animate-spin mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    );
  }

  const items = queueState.phase === 'ready' ? queueState.items : [];
  const available = items.filter((i) => i.review_claimed_by === null && i.status === 'Submitted for Verification');
  const myReviews = items.filter((i) => i.review_claimed_by === currentUserId);
  const otherReviews = items.filter((i) => i.review_claimed_by !== null && i.review_claimed_by !== currentUserId);

  // Request modal props
  const requestModalOpen = requestState.phase === 'confirming' || requestState.phase === 'processing';
  const requestModalAction = requestModalOpen ? requestState.action : null;
  const requestModalEvidenceIds = requestModalOpen ? requestState.evidenceIds : [];
  const requestModalOrgNotes = requestModalOpen ? requestState.orgNotes : '';
  const requestModalEvidenceTypes: EvidenceType[] = requestModalAction
    ? requestModalEvidenceIds
        .map((id) => requestModalAction.evidence.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined)
        .map((e) => e.evidence_type)
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.25)' }}
        >
          <FileCheck2 size={20} style={{ color: '#1C7486' }} />
        </div>
        <div>
          <h1 className="heading-lg text-white">Review Queue</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Actions submitted for verification</p>
        </div>
      </div>

      {/* Claim success banner */}
      {claimState.phase === 'success' && (
        <div
          className="card-premium p-4 mb-6 flex items-center justify-between gap-4"
          style={{ borderColor: 'rgba(52,180,120,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <UserCheck size={18} style={{ color: '#34B478' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{claimState.message}</p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setClaimState({ phase: 'idle' })}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Claim error banner */}
      {claimState.phase === 'error' && (
        <div
          className="card-premium p-4 mb-6 flex items-start justify-between gap-4"
          style={{ borderColor: 'rgba(224,101,107,0.3)' }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: '#E0656B', marginTop: 2 }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{claimState.message}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss error"
            className="flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onClick={() => setClaimState({ phase: 'idle' })}
          >
            ×
          </button>
        </div>
      )}

      {/* Request success banner */}
      {requestState.phase === 'success' && (
        <div
          className="card-premium p-4 mb-6 flex items-center justify-between gap-4"
          style={{ borderColor: 'rgba(212,168,67,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <UserCheck size={18} style={{ color: '#D4A843' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{requestState.message}</p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setRequestState({ phase: 'idle' })}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Request error banner */}
      {requestState.phase === 'error' && (
        <div
          className="card-premium p-4 mb-6 flex items-start justify-between gap-4"
          style={{ borderColor: 'rgba(224,101,107,0.3)' }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: '#E0656B', marginTop: 2 }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{requestState.message}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss error"
            className="flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onClick={() => setRequestState({ phase: 'idle' })}
          >
            ×
          </button>
        </div>
      )}

      {/* Queue loading */}
      {queueState.phase === 'loading' && (
        <div className="text-center py-16">
          <Loader2 size={24} className="animate-spin mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      )}

      {/* Queue error */}
      {queueState.phase === 'error' && (
        <div className="text-center py-16">
          <AlertCircle size={24} className="mx-auto mb-3" style={{ color: '#E0656B' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{queueState.message}</p>
          <button className="btn-ghost mt-4" onClick={loadQueue}>Retry</button>
        </div>
      )}

      {/* Queue content */}
      {queueState.phase === 'ready' && (
        <>
          {items.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Inbox size={22} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">No Reviews Pending</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                There are no actions submitted for verification at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {available.length > 0 && (
                <ReviewGroup
                  title="Available for Review"
                  items={available}
                  currentUserId={currentUserId}
                  onClaim={handleClaimClick}
                  onView={handleViewDetail}
                />
              )}
              {myReviews.length > 0 && (
                <ReviewGroup
                  title="My Active Reviews"
                  items={myReviews}
                  currentUserId={currentUserId}
                  onClaim={handleClaimClick}
                  onView={handleViewDetail}
                />
              )}
              {otherReviews.length > 0 && (
                <ReviewGroup
                  title="Claimed by Another Reviewer"
                  items={otherReviews}
                  currentUserId={currentUserId}
                  onClaim={handleClaimClick}
                  onView={handleViewDetail}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Claim confirmation modal */}
      <ClaimReviewModal
        open={claimState.phase === 'confirming' || claimState.phase === 'claiming'}
        organizationName={claimState.phase === 'confirming' || claimState.phase === 'claiming' ? claimState.item.organization_name : ''}
        actionTitle={claimState.phase === 'confirming' || claimState.phase === 'claiming' ? claimState.item.title : ''}
        actionPillar={claimState.phase === 'confirming' || claimState.phase === 'claiming' ? claimState.item.pillar_name : ''}
        submittedEvidenceCount={claimState.phase === 'confirming' || claimState.phase === 'claiming' ? claimState.item.submitted_evidence_count : 0}
        certificationRequired={claimState.phase === 'confirming' || claimState.phase === 'claiming' ? claimState.item.certification_requirement === true : false}
        evidenceRequirements={claimState.phase === 'confirming' || claimState.phase === 'claiming' ? claimState.item.evidence_requirements : null}
        disabled={claimState.phase === 'claiming'}
        onCancel={closeClaimModal}
        onConfirm={handleClaimConfirm}
      />

      {/* Request Information confirmation modal */}
      <RequestInformationModal
        open={requestModalOpen}
        organizationName={requestModalAction?.organization_name ?? ''}
        actionTitle={requestModalAction?.title ?? ''}
        actionPillar={requestModalAction?.pillar_name ?? ''}
        selectedEvidenceCount={requestModalEvidenceIds.length}
        selectedEvidenceTypes={requestModalEvidenceTypes}
        organizationVisibleNotes={requestModalOrgNotes}
        certificationRequired={requestModalAction?.certification_requirement === true}
        disabled={requestState.phase === 'processing'}
        onCancel={closeRequestModal}
        onConfirm={handleRequestConfirm}
      />

      {/* Detail modal */}
      {detailState.phase === 'ready' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeDetail}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end mb-3">
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close review detail"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                className="text-sm"
              >
                Close ×
              </button>
            </div>
            <ReviewActionPanel
              action={detailState.action}
              currentUserId={currentUserId}
              onRequestInformation={handleRequestInformation}
              onResumeReview={handleResumeReview}
              processing={requestState.phase === 'processing'}
              resuming={resumeState.phase === 'processing'}
            />
          </div>
        </div>
      )}
      {/* Resume Review confirmation modal */}
      <ResumeReviewModal
        open={resumeState.phase === 'confirming' || resumeState.phase === 'processing'}
        organizationName={resumeState.phase === 'confirming' || resumeState.phase === 'processing' ? resumeState.action.organization_name : ''}
        actionTitle={resumeState.phase === 'confirming' || resumeState.phase === 'processing' ? resumeState.action.title : ''}
        actionPillar={resumeState.phase === 'confirming' || resumeState.phase === 'processing' ? resumeState.action.pillar_name : ''}
        selectedEvidenceCount={resumeState.phase === 'confirming' || resumeState.phase === 'processing' ? resumeState.evidenceIds.length : 0}
        selectedEvidenceTypes={resumeState.phase === 'confirming' || resumeState.phase === 'processing'
          ? resumeState.evidenceIds
              .map((id) => resumeState.action.evidence.find((e) => e.id === id))
              .filter((e): e is NonNullable<typeof e> => e !== undefined)
              .map((e) => e.evidence_type)
          : []}
        hasRevisionInstructions={resumeState.phase === 'confirming' || resumeState.phase === 'processing'
          ? resumeState.evidenceIds.some((id) => {
              const ev = resumeState.action.evidence.find((e) => e.id === id);
              return ev?.organization_visible_notes !== null && ev?.organization_visible_notes !== undefined;
            })
          : false}
        certificationRequired={resumeState.phase === 'confirming' || resumeState.phase === 'processing' ? resumeState.action.certification_requirement === true : false}
        disabled={resumeState.phase === 'processing'}
        onCancel={closeResumeModal}
        onConfirm={handleResumeConfirm}
      />
    </div>
  );
}

interface ReviewGroupProps {
  title: string;
  items: ReviewQueueItem[];
  currentUserId: string | null;
  onClaim: (item: ReviewQueueItem) => void;
  onView: (actionId: string) => void;
}

function ReviewGroup({ title, items, currentUserId, onClaim, onView }: ReviewGroupProps) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {title} ({items.length})
      </h2>
      <div className="space-y-3">
        {items.map((item) => {
          const isMine = item.review_claimed_by === currentUserId;
          const isOther = item.review_claimed_by !== null && item.review_claimed_by !== currentUserId;
          const isRevision = item.status === 'Revision Required';
          const hasSubmitted = item.submitted_evidence_count > 0;
          const hasUnderReview = item.under_review_evidence_count > 0;
          const isResubmitted = item.status === 'Submitted for Verification' && isMine && hasSubmitted && !hasUnderReview;
          const isPartiallyResumed = item.status === 'Submitted for Verification' && isMine && hasSubmitted && hasUnderReview;
          const isReviewInProgress = item.status === 'Submitted for Verification' && isMine && !hasSubmitted && hasUnderReview;
          return (
            <div
              key={item.id}
              className="card-premium p-4"
              style={{ background: '#141414' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {item.organization_name}
                  </p>
                  <p className="text-sm font-semibold text-white mb-2 leading-snug">{item.title}</p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="badge-teal" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>{item.pillar_name}</span>
                    {item.certification_requirement === true && (
                      <span className="badge-gold inline-flex items-center gap-1" style={{ padding: '0.15rem 0.5rem', fontSize: '0.625rem' }}>
                        <ShieldCheck size={11} /> Cert
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {item.under_review_evidence_count + item.revision_required_evidence_count} evidence
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(item.submitted_at)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isMine && !isRevision && !isResubmitted && !isPartiallyResumed && !isReviewInProgress && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(52,180,120,0.12)', color: '#34B478' }}>
                      Review In Progress
                    </span>
                  )}
                  {isMine && isRevision && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}>
                      Waiting for Organization Revision
                    </span>
                  )}
                  {isMine && isResubmitted && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(28,116,134,0.12)', color: '#2592A8' }}>
                      Revised Evidence Submitted
                    </span>
                  )}
                  {isMine && isPartiallyResumed && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}>
                      Review Partially Resumed
                    </span>
                  )}
                  {isMine && isReviewInProgress && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(52,180,120,0.12)', color: '#34B478' }}>
                      Review In Progress
                    </span>
                  )}
                  {isOther && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                      Claimed by Another Reviewer
                    </span>
                  )}
                  {!isMine && !isOther && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
                      onClick={() => onClaim(item)}
                      aria-label={`Claim ${item.title} for review`}
                    >
                      <UserCheck size={14} /> Claim Review
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
                    onClick={() => onView(item.id)}
                    aria-label={`View ${item.title} evidence`}
                  >
                    <ChevronRight size={14} /> View
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
