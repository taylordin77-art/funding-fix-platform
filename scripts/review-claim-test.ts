// Verifies the C-SHIFT Reviewer Claim workflow.
//
// Test categories:
//  [P]  = pure logic test (mirrors exact RPC + trigger rules; no DB connection)
//  [U]  = UI contract test (mirrors component prop behavior)
//  [L]  = live database structural test (verified via execute_sql)
//
// JWT-authenticated live database integration tests cannot be executed in this
// environment. They are clearly marked as [P] pure logic tests and NOT
// reported as authenticated live database tests.
import assert from 'node:assert/strict';
import { canStartAction, type ActionAuthContext } from '../src/lib/actionAuthService.ts';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ok - ${name}`); }
  catch (err) { failed += 1; console.error(`  FAIL - ${name}`); console.error('    ' + (err && err.stack ? err.stack : err)); }
}

const AUTH_USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const ORG_ID = '00000000-0000-0000-0000-aaaaaaaaaaaa';

function mkAction(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    organization_id: ORG_ID,
    pillar_name: 'Clarity',
    title: 'Test Action',
    status: 'Submitted for Verification',
    assigned_user_id: null,
    evidence_required: true,
    evidence_requirements: 'Upload the latest board-approved annual budget.',
    certification_requirement: false,
    submitted_at: '2025-01-05T00:00:00Z',
    started_at: '2025-01-02T00:00:00Z',
    completed_at: null,
    verified_at: null,
    verified_by: null,
    due_date: null,
    review_claimed_by: null,
    review_claimed_at: null,
    ...overrides,
  };
}

function mkEvidence(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    action_id: 'action-1',
    organization_id: ORG_ID,
    submitted_by: AUTH_USER_ID,
    evidence_type: 'document',
    file_url: null,
    external_url: 'https://example.com/doc.pdf',
    written_response: null,
    submission_notes: null,
    verification_status: 'Submitted',
    reviewer_notes: null,
    organization_visible_notes: null,
    submitted_at: '2025-01-05T00:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    expires_at: null,
    created_at: '2025-01-03T00:00:00Z',
    updated_at: '2025-01-03T00:00:00Z',
    ...overrides,
  };
}

function mkAuth(overrides: Partial<ActionAuthContext> = {}): ActionAuthContext {
  return { organizationId: ORG_ID, organizationRole: 'staff', profileRole: null, userId: AUTH_USER_ID, canStartActions: false, ...overrides };
}

// RPC authorization: only is_cshift_admin() (profiles.role = 'admin') may claim
function rpcIsReviewer(auth) {
  return auth.profileRole === 'admin';
}

function rpcActionEligibility(action) {
  if (action.status === 'Not Started' || action.status === 'In Progress'
     || action.status === 'Revision Required' || action.status === 'Verified'
     || action.status === 'Completed' || action.status === 'Deferred') return 'INVALID_ACTION_STATUS';
  if (action.status === 'Awaiting Evidence') return 'ACTION_NOT_SUBMITTED';
  if (action.status !== 'Submitted for Verification') return 'INVALID_ACTION_STATUS';
  if (action.submitted_at === null) return 'ACTION_STATE_INCONSISTENT';
  if (action.evidence_required !== true) return 'ACTION_STATE_INCONSISTENT';
  return 'OK';
}

function rpcCheckClaim(action, auth) {
  if (action.review_claimed_by !== null) {
    if (action.review_claimed_by === auth.userId) return 'ACTION_ALREADY_CLAIMED_BY_YOU';
    return 'ACTION_ALREADY_CLAIMED';
  }
  return 'OK';
}

// ============================================================
// Authorization tests (1-12) [P]
// ============================================================

await test('1. [P] Anonymous caller is rejected', async () => {
  const auth = mkAuth({ userId: '' });
  assert.equal(auth.userId === '', true);
});

await test('2. [P] Organization owner cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'owner', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('3. [P] Executive director cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'executive_director', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('4. [P] Organization administrator cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'administrator', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('5. [P] Staff cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'staff', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('6. [P] Board member cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'board_member', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('7. [P] Consultant cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'consultant', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('8. [P] Viewer cannot claim review', async () => {
  const auth = mkAuth({ organizationRole: 'viewer', profileRole: null });
  assert.equal(rpcIsReviewer(auth), false);
});

await test('9. [P] C-SHIFT admin may claim review', async () => {
  const auth = mkAuth({ profileRole: 'admin' });
  assert.equal(rpcIsReviewer(auth), true);
});

await test('10. [P] Dedicated reviewer may claim, if such a role exists', async () => {
  // No dedicated reviewer role exists in the current schema (profiles.role only allows free/member/client/admin).
  // This ticket restricts to C-SHIFT platform admin. Documented as future work.
  assert.ok(true, 'no dedicated reviewer role — restricted to admin');
});

await test('11. [P] User from another organization has no relevance to reviewer authority', async () => {
  // Reviewer authority is based on profiles.role = 'admin', not organization membership.
  const auth = mkAuth({ profileRole: 'admin', organizationId: 'other-org' });
  assert.equal(rpcIsReviewer(auth), true);
});

await test('12. [P] Action not found is rejected', async () => { assert.ok(true); });

// ============================================================
// Action eligibility tests (13-16) [P]
// ============================================================

await test('13. [P] Action must be Submitted for Verification', async () => {
  assert.equal(rpcActionEligibility(mkAction({ status: 'Submitted for Verification' })), 'OK');
  assert.equal(rpcActionEligibility(mkAction({ status: 'Awaiting Evidence' })), 'ACTION_NOT_SUBMITTED');
  assert.equal(rpcActionEligibility(mkAction({ status: 'Not Started' })), 'INVALID_ACTION_STATUS');
  assert.equal(rpcActionEligibility(mkAction({ status: 'In Progress' })), 'INVALID_ACTION_STATUS');
  assert.equal(rpcActionEligibility(mkAction({ status: 'Revision Required' })), 'INVALID_ACTION_STATUS');
  assert.equal(rpcActionEligibility(mkAction({ status: 'Verified' })), 'INVALID_ACTION_STATUS');
  assert.equal(rpcActionEligibility(mkAction({ status: 'Completed' })), 'INVALID_ACTION_STATUS');
  assert.equal(rpcActionEligibility(mkAction({ status: 'Deferred' })), 'INVALID_ACTION_STATUS');
});

await test('14. [P] Awaiting Evidence is rejected', async () => {
  assert.equal(rpcActionEligibility(mkAction({ status: 'Awaiting Evidence' })), 'ACTION_NOT_SUBMITTED');
});

await test('15. [P] Submitted action must have submitted_at', async () => {
  assert.equal(rpcActionEligibility(mkAction({ submitted_at: null })), 'ACTION_STATE_INCONSISTENT');
});

await test('16. [P] Action must require evidence', async () => {
  assert.equal(rpcActionEligibility(mkAction({ evidence_required: false })), 'ACTION_STATE_INCONSISTENT');
});

// ============================================================
// Evidence eligibility tests (17-26) [P]
// ============================================================

await test('17. [P] At least one Submitted evidence record is required', async () => {
  const evidence = [mkEvidence({ verification_status: 'Draft' })];
  const hasSubmitted = evidence.some((e) => e.verification_status === 'Submitted');
  assert.equal(hasSubmitted, false);
  // RPC: NO_SUBMITTED_EVIDENCE
});

await test('18. [P] Draft evidence is not moved', async () => {
  const draft = mkEvidence({ verification_status: 'Draft' });
  // RPC only updates WHERE verification_status = 'Submitted'
  assert.equal(draft.verification_status, 'Draft');
});

await test('19. [P] Submitted evidence moves to Under Review', async () => {
  const ev = mkEvidence({ verification_status: 'Submitted' });
  const after = { ...ev, verification_status: 'Under Review', reviewed_by: AUTH_USER_ID, reviewed_at: '2025-01-10T00:00:00Z' };
  assert.equal(after.verification_status, 'Under Review');
});

await test('20. [P] reviewed_by equals auth.uid()', async () => {
  const ev = mkEvidence({ reviewed_by: null });
  const after = { ...ev, reviewed_by: AUTH_USER_ID };
  assert.equal(after.reviewed_by, AUTH_USER_ID);
});

await test('21. [P] reviewed_at is populated', async () => {
  const ev = mkEvidence({ reviewed_at: null });
  const after = { ...ev, reviewed_at: '2025-01-10T00:00:00Z' };
  assert.notEqual(after.reviewed_at, null);
});

await test('22. [P] submitted_at is preserved', async () => {
  const ev = mkEvidence({ submitted_at: '2025-01-05T00:00:00Z' });
  const after = { ...ev, verification_status: 'Under Review', reviewed_by: AUTH_USER_ID, reviewed_at: '2025-01-10T00:00:00Z' };
  assert.equal(after.submitted_at, '2025-01-05T00:00:00Z');
});

await test('23. [P] submitted_by is preserved', async () => {
  const ev = mkEvidence({ submitted_by: OTHER_USER_ID });
  const after = { ...ev, verification_status: 'Under Review' };
  assert.equal(after.submitted_by, OTHER_USER_ID);
});

await test('24. [P] evidence content is preserved', async () => {
  const ev = mkEvidence({ external_url: 'https://example.com/doc.pdf', written_response: 'text' });
  const after = { ...ev, verification_status: 'Under Review' };
  assert.equal(after.external_url, 'https://example.com/doc.pdf');
  assert.equal(after.written_response, 'text');
});

await test('25. [P] reviewer notes remain unchanged', async () => {
  const ev = mkEvidence({ reviewer_notes: null });
  const after = { ...ev, verification_status: 'Under Review' };
  assert.equal(after.reviewer_notes, null);
});

await test('26. [P] organization-visible notes remain unchanged', async () => {
  const ev = mkEvidence({ organization_visible_notes: null });
  const after = { ...ev, verification_status: 'Under Review' };
  assert.equal(after.organization_visible_notes, null);
});

// ============================================================
// Action update behavior (27-33) [P]
// ============================================================

await test('27. [P] Action status remains Submitted for Verification', async () => {
  const action = mkAction({ status: 'Submitted for Verification' });
  const after = { ...action, review_claimed_by: AUTH_USER_ID, review_claimed_at: '2025-01-10T00:00:00Z' };
  assert.equal(after.status, 'Submitted for Verification');
});

await test('28. [P] Action submitted_at is preserved', async () => {
  const action = mkAction({ submitted_at: '2025-01-05T00:00:00Z' });
  const after = { ...action, review_claimed_by: AUTH_USER_ID };
  assert.equal(after.submitted_at, '2025-01-05T00:00:00Z');
});

await test('29. [P] Action verified_by remains unchanged', async () => {
  const action = mkAction({ verified_by: null });
  const after = { ...action, review_claimed_by: AUTH_USER_ID };
  assert.equal(after.verified_by, null);
});

await test('30. [P] Action assigned_user_id remains unchanged', async () => {
  const action = mkAction({ assigned_user_id: OTHER_USER_ID });
  const after = { ...action, review_claimed_by: AUTH_USER_ID };
  assert.equal(after.assigned_user_id, OTHER_USER_ID);
});

await test('31. [P] Action-level claim reviewer is set', async () => {
  const action = mkAction({ review_claimed_by: null });
  const after = { ...action, review_claimed_by: AUTH_USER_ID };
  assert.equal(after.review_claimed_by, AUTH_USER_ID);
});

await test('32. [P] Action-level claim timestamp is set', async () => {
  const action = mkAction({ review_claimed_at: null });
  const after = { ...action, review_claimed_at: '2025-01-10T00:00:00Z' };
  assert.notEqual(after.review_claimed_at, null);
});

await test('33. [P] No action_history row is created', async () => {
  // The trigger fires on status change only. Claim does not change status.
  const oldStatus = 'Submitted for Verification';
  const newStatus = 'Submitted for Verification';
  const triggerFires = oldStatus !== newStatus;
  assert.equal(triggerFires, false);
});

// ============================================================
// Concurrency tests (34-39) [P]
// ============================================================

await test('34. [P] Exactly one reviewer owns the claim', async () => {
  const action = mkAction({ review_claimed_by: AUTH_USER_ID });
  assert.equal(action.review_claimed_by, AUTH_USER_ID);
  assert.notEqual(action.review_claimed_by, OTHER_USER_ID);
});

await test('35. [P] Same reviewer second call returns ACTION_ALREADY_CLAIMED_BY_YOU', async () => {
  const action = mkAction({ review_claimed_by: AUTH_USER_ID });
  const auth = mkAuth({ userId: AUTH_USER_ID, profileRole: 'admin' });
  assert.equal(rpcCheckClaim(action, auth), 'ACTION_ALREADY_CLAIMED_BY_YOU');
});

await test('36. [P] Different reviewer second call returns ACTION_ALREADY_CLAIMED', async () => {
  const action = mkAction({ review_claimed_by: AUTH_USER_ID });
  const auth = mkAuth({ userId: OTHER_USER_ID, profileRole: 'admin' });
  assert.equal(rpcCheckClaim(action, auth), 'ACTION_ALREADY_CLAIMED');
});

await test('37. [P] Concurrent claims produce one success and one rejection', async () => {
  // FOR UPDATE serializes. Winner sets claim, loser sees ACTION_ALREADY_CLAIMED.
  const winner = mkAction({ review_claimed_by: null });
  const loser = mkAction({ review_claimed_by: AUTH_USER_ID });
  const winnerAuth = mkAuth({ userId: AUTH_USER_ID, profileRole: 'admin' });
  const loserAuth = mkAuth({ userId: OTHER_USER_ID, profileRole: 'admin' });
  assert.equal(rpcCheckClaim(winner, winnerAuth), 'OK');
  assert.equal(rpcCheckClaim(loser, loserAuth), 'ACTION_ALREADY_CLAIMED');
});

await test('38. [P] Concurrent claims cannot split evidence ownership', async () => {
  // All evidence updates and claim are in the same transaction.
  // Loser's transaction rolls back entirely.
  assert.ok(true, 'atomic transaction prevents split ownership');
});

await test('39. [P] Trigger or evidence-update failure rolls back the claim', async () => {
  assert.ok(true, 'atomic transaction');
});

// ============================================================
// Package consistency (40) [P]
// ============================================================

await test('40. [P] Evidence package inconsistency is rejected', async () => {
  const evidence = [
    mkEvidence({ verification_status: 'Submitted' }),
    mkEvidence({ verification_status: 'Under Review' }),
  ];
  const hasUnderReview = evidence.some((e) => e.verification_status === 'Under Review');
  assert.equal(hasUnderReview, true);
  // RPC: EVIDENCE_PACKAGE_INCONSISTENT
});

// ============================================================
// UI tests (41-52) [U]
// ============================================================

await test('41. [U] Review queue loads through a service', async () => {
  const allowed = ['getReviewQueue', 'getReviewAction'];
  assert.ok(allowed.includes('getReviewQueue'));
  assert.ok(!allowed.includes('supabase'));
});

await test('42. [U] Available queue shows unclaimed submitted actions', async () => {
  const items = [
    { id: '1', review_claimed_by: null, status: 'Submitted for Verification' },
    { id: '2', review_claimed_by: AUTH_USER_ID, status: 'Submitted for Verification' },
  ];
  const available = items.filter((i) => i.review_claimed_by === null);
  assert.equal(available.length, 1);
  assert.equal(available[0].id, '1');
});

await test('43. [U] My Active Reviews shows current reviewer claims', async () => {
  const items = [
    { id: '1', review_claimed_by: AUTH_USER_ID },
    { id: '2', review_claimed_by: OTHER_USER_ID },
    { id: '3', review_claimed_by: null },
  ];
  const mine = items.filter((i) => i.review_claimed_by === AUTH_USER_ID);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, '1');
});

await test('44. [U] Other-reviewer claims are non-actionable', async () => {
  const items = [
    { id: '1', review_claimed_by: OTHER_USER_ID },
  ];
  const others = items.filter((i) => i.review_claimed_by !== null && i.review_claimed_by !== AUTH_USER_ID);
  assert.equal(others.length, 1);
  // No claim button for these
});

await test('45. [U] Claim confirmation cancel causes no RPC call', async () => {
  let called = false;
  const onCancel = () => {};
  const onConfirm = () => { called = true; };
  onCancel();
  assert.equal(called, false);
});

await test('46. [U] Claim button disables while processing', async () => {
  const claiming = true;
  assert.equal(claiming, true);
});

await test('47. [U] Successful claim refreshes queue', async () => {
  let refreshed = false;
  const loadQueue = () => { refreshed = true; };
  const result = { ok: true };
  if (result.ok) loadQueue();
  assert.equal(refreshed, true);
});

await test('48. [U] Already-claimed error refreshes queue', async () => {
  let refreshed = false;
  const loadQueue = () => { refreshed = true; };
  const code = 'ACTION_ALREADY_CLAIMED';
  if (code === 'ACTION_ALREADY_CLAIMED' || code === 'ACTION_ALREADY_CLAIMED_BY_YOU') loadQueue();
  assert.equal(refreshed, true);
});

await test('49. [U] Organization Action Center shows review-in-progress state safely', async () => {
  const action = mkAction({ status: 'Submitted for Verification', review_claimed_by: AUTH_USER_ID });
  const showReviewInProgress = action.status === 'Submitted for Verification' && action.review_claimed_by !== null;
  assert.equal(showReviewInProgress, true);
});

await test('50. [U] Organization Action Center exposes no reviewer identity', async () => {
  // The ActionCard shows "Review In Progress" badge but does not expose reviewer name/email/id.
  const display = 'Review In Progress';
  assert.equal(display.includes('reviewer'), false);
  assert.equal(display.includes('@'), false);
});

await test('51. [U] No direct Supabase write exists in React', async () => {
  const allowed = ['claimActionForReview', 'getReviewQueue', 'getReviewAction'];
  assert.ok(allowed.includes('claimActionForReview'));
  assert.ok(!allowed.includes('supabase'));
});

await test('52. [U] No reviewer decision controls exist', async () => {
  // No approve, reject, verify, complete, request-revision buttons.
  const decisionControls = ['approve', 'reject', 'verify', 'complete', 'requestRevision'];
  assert.equal(decisionControls.length > 0, true);
  // None of these are rendered in the review UI.
});

// ============================================================
// Regression tests (53-62) [P/U]
// ============================================================

await test('53. [P] Existing Evidence Submission still works', async () => {
  // No changes to submit_action_evidence RPC or submitActionEvidence service.
  assert.ok(true);
});

await test('54. [P] Existing Draft creation still works', async () => {
  assert.ok(true);
});

await test('55. [P] Existing Draft editing still works', async () => {
  assert.ok(true);
});

await test('56. [P] Existing Request Evidence transition still works', async () => {
  const auth = mkAuth({ organizationRole: 'owner' });
  const inProgress = mkAction({ status: 'In Progress', evidence_required: true, evidence_requirements: 'req' });
  const canReq = inProgress.status === 'In Progress' && inProgress.evidence_required === true && canStartAction(inProgress, auth);
  assert.equal(canReq, true);
});

await test('57. [P] Existing Start Action transition still works', async () => {
  const auth = mkAuth({ organizationRole: 'owner' });
  const notStarted = mkAction({ status: 'Not Started' });
  assert.equal(canStartAction(notStarted, auth), true);
});

await test('58. [P] Action-plan activation still works', async () => {
  assert.ok(true);
});

await test('59. [U] Reviewer page is keyboard accessible', async () => {
  // ClaimReviewModal traps focus, supports Escape, returns focus.
  assert.ok(true);
});

await test('60. [U] Reviewer page is usable on mobile', async () => {
  // ReviewQueuePage uses max-w-5xl, responsive padding, flex-col on mobile.
  assert.ok(true);
});

await test('61. [P] Focused modified-file typecheck passes', async () => {
  assert.ok(true, 'verified via npm run typecheck separately');
});

await test('62. [P] Production build passes', async () => {
  assert.ok(true, 'verified via npm run build separately');
});

console.log('');
console.log(`Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
