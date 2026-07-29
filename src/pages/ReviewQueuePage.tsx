import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, FileCheck2, UserCheck, Loader2, AlertCircle, ChevronRight, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getReviewQueue, type ReviewQueueItem } from '../lib/reviewQueueService';
import { claimActionForReview, type ClaimActionForReviewErrorCode } from '../lib/actionMutationService';
import { ClaimReviewModal } from '../components/reviews/ClaimReviewModal';
import { ReviewActionPanel } from '../components/reviews/ReviewActionPanel';
import type { ReviewActionDetail } from '../lib/reviewQueueService';

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

const SAFE_MESSAGES: Record<ClaimActionForReviewErrorCode, string> = {
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
      setClaimState({ phase: 'error', message: SAFE_MESSAGES[code], reloadQueue: true });
      await loadQueue();
      return;
    }

    setClaimState({ phase: 'error', message: SAFE_MESSAGES[code], reloadQueue: false });
  }, [claimState, loadQueue]);

  const closeClaimModal = useCallback(() => {
    if (claimState.phase === 'claiming') return;
    setClaimState({ phase: 'idle' });
  }, [claimState.phase]);

  const handleViewDetail = useCallback(async (actionId: string) => {
    setDetailState({ phase: 'loading' });
    const { getReviewAction } = await import('../lib/reviewQueueService');
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
  const available = items.filter((i) => i.review_claimed_by === null);
  const myReviews = items.filter((i) => i.review_claimed_by === currentUserId);
  const otherReviews = items.filter((i) => i.review_claimed_by !== null && i.review_claimed_by !== currentUserId);

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

      {/* Success banner */}
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

      {/* Error banner */}
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
              {/* Available for Review */}
              {available.length > 0 && (
                <ReviewGroup
                  title="Available for Review"
                  items={available}
                  currentUserId={currentUserId}
                  onClaim={handleClaimClick}
                  onView={handleViewDetail}
                />
              )}

              {/* My Active Reviews */}
              {myReviews.length > 0 && (
                <ReviewGroup
                  title="My Active Reviews"
                  items={myReviews}
                  currentUserId={currentUserId}
                  onClaim={handleClaimClick}
                  onView={handleViewDetail}
                />
              )}

              {/* Claimed by Another Reviewer */}
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
            <ReviewActionPanel action={detailState.action} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Review Group (section of the queue)
   ============================================================ */

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
                      {item.submitted_evidence_count + item.under_review_evidence_count} evidence
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(item.submitted_at)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {isMine && (
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
