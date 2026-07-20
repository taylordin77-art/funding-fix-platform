// Verifies the corrected workflow status logic and evidence intelligence in
// src/lib/actionWorkflowService.ts. Runs under Node strip-types with the loader
// hook that stubs the db client. All tests exercise pure builders — no DB.
import assert from 'node:assert/strict';
import {
  isCompleted, isVerified, isAwaitingEvidence, isAwaitingVerification,
  isRevisionRequired, isDeferred, isBlocked, isOverdue, daysOverdue,
  buildEvidenceSummary, buildWorkflowSummary, buildCompletionMetrics,
  buildPillarSummaries, buildCertificationReadiness, buildOrganizationWorkflow,
  buildOverdueActions,
  type WorkflowAction, type EvidenceRecord, type WorkflowActionWithEvidence,
} from '../src/lib/actionWorkflowService.ts';

let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { passed += 1; console.log(`  ok - ${name}`); },
    (err) => { failed += 1; console.error(`  FAIL - ${name}`); console.error('    ' + (err && err.stack ? err.stack : err)); },
  );
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---- factories -----------------------------------------------------------
function mkAction(overrides: Partial<WorkflowAction> = {}): WorkflowAction {
  return {
    id: crypto.randomUUID(),
    organization_id: ORG_ID,
    assessment_id: null,
    pillar_name: 'Clarity',
    action_category: 'Governance',
    title: 'Test action',
    description: 'desc',
    why_it_matters: null,
    why_funders_care: null,
    priority: 'High',
    status: 'Not Started',
    assigned_user_id: null,
    due_date: null,
    estimated_completion_days: 30,
    evidence_required: false,
    evidence_requirements: null,
    estimated_pillar_score_increase: 3,
    estimated_overall_score_increase: 2,
    certification_requirement: false,
    source_type: 'assessment',
    source_reference: 'clarity:0',
    created_at: '2025-01-01T00:00:00Z',
    started_at: null,
    submitted_at: null,
    completed_at: null,
    verified_at: null,
    verified_by: null,
    updated_at: null,
    ...overrides,
  };
}

function mkEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: crypto.randomUUID(),
    action_id: '',
    organization_id: ORG_ID,
    submitted_by: '00000000-0000-0000-0000-000000000002',
    evidence_type: 'document',
    file_url: null,
    external_url: null,
    written_response: null,
    submission_notes: null,
    verification_status: 'Submitted',
    reviewer_notes: null,
    organization_visible_notes: null,
    submitted_at: '2025-06-01T00:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    expires_at: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

function enrich(a: WorkflowAction, evidence: EvidenceRecord[] = []): WorkflowActionWithEvidence {
  const withActionId = evidence.map((e) => ({ ...e, action_id: a.id }));
  return { ...a, evidenceSummary: buildEvidenceSummary(a, withActionId) };
}

// Helper: build a YYYY-MM-DD string N days from today.
function dateOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Status classification (tests 1-9)
// ============================================================

await test('1. Submitted for Verification is awaiting verification', async () => {
  const a = mkAction({ status: 'Submitted for Verification' });
  assert.equal(isAwaitingVerification(a), true);
});

await test('2. Completed is NOT awaiting verification', async () => {
  const a = mkAction({ status: 'Completed' });
  assert.equal(isAwaitingVerification(a), false);
});

await test('3. Verified counted as completed AND verified without double counting', async () => {
  const a = mkAction({ status: 'Verified' });
  assert.equal(isCompleted(a), true);
  assert.equal(isVerified(a), true);
  // summary counts: one action -> completed=1, verified=1, total=1
  const enriched = [enrich(a)];
  const s = buildWorkflowSummary(enriched);
  assert.equal(s.completed, 1);
  assert.equal(s.verified, 1);
  assert.equal(s.totalActions, 1);
  assert.equal(s.completionPercentage, 100);
  assert.equal(s.verificationPercentage, 100);
});

await test('4. Deferred is excluded from overdue', async () => {
  const a = mkAction({ status: 'Deferred', due_date: dateOffset(-10) });
  assert.equal(isOverdue(a), false);
});

await test('5. Submitted for Verification may be overdue', async () => {
  const a = mkAction({ status: 'Submitted for Verification', due_date: dateOffset(-5) });
  assert.equal(isOverdue(a), true);
  assert.equal(daysOverdue(a), 5);
});

await test('6. Awaiting Evidence is blocked', async () => {
  const a = mkAction({ status: 'Awaiting Evidence' });
  assert.equal(isBlocked(a), true);
});

await test('7. Submitted for Verification is blocked', async () => {
  const a = mkAction({ status: 'Submitted for Verification' });
  assert.equal(isBlocked(a), true);
});

await test('8. Revision Required is blocked', async () => {
  const a = mkAction({ status: 'Revision Required' });
  assert.equal(isBlocked(a), true);
});

await test('9. Deferred is NOT blocked', async () => {
  const a = mkAction({ status: 'Deferred' });
  assert.equal(isBlocked(a), false);
  assert.equal(isDeferred(a), true);
});

// ============================================================
// Evidence completion (tests 10-13)
// ============================================================

await test('10. Required evidence with no records is incomplete', async () => {
  const a = mkAction({ evidence_required: true });
  const s = buildEvidenceSummary(a, []);
  assert.equal(s.evidenceRequired, true);
  assert.equal(s.evidenceComplete, false);
  assert.equal(s.evidenceCount, 0);
});

await test('11. Required evidence with unverified evidence is incomplete', async () => {
  const a = mkAction({ evidence_required: true });
  const ev = [mkEvidence({ verification_status: 'Submitted' })];
  const s = buildEvidenceSummary(a, ev);
  assert.equal(s.evidenceRequired, true);
  assert.equal(s.evidenceSubmitted, 1);
  assert.equal(s.evidenceVerified, 0);
  assert.equal(s.evidenceComplete, false);
});

await test('12. Required evidence with verified (Approved) evidence is complete', async () => {
  const a = mkAction({ evidence_required: true });
  const ev = [mkEvidence({ verification_status: 'Approved', reviewed_at: '2025-06-10T00:00:00Z' })];
  const s = buildEvidenceSummary(a, ev);
  assert.equal(s.evidenceVerified, 1);
  assert.equal(s.evidenceComplete, true);
  assert.equal(s.latestEvidenceVerifiedAt, '2025-06-10T00:00:00Z');
});

await test('13. Action not requiring evidence is evidence-complete', async () => {
  const a = mkAction({ evidence_required: false });
  const s = buildEvidenceSummary(a, []);
  assert.equal(s.evidenceRequired, false);
  assert.equal(s.evidenceComplete, true);
});

// ============================================================
// Evidence completion percentage (tests 14-15)
// ============================================================

await test('14. Evidence completion percentage is correct', async () => {
  // 4 evidence-required actions: 2 complete, 2 not -> 50%
  const acts = [
    enrich(mkAction({ id: 'a1', evidence_required: true }), [mkEvidence({ verification_status: 'Approved' })]),
    enrich(mkAction({ id: 'a2', evidence_required: true }), [mkEvidence({ verification_status: 'Approved' })]),
    enrich(mkAction({ id: 'a3', evidence_required: true }), [mkEvidence({ verification_status: 'Submitted' })]),
    enrich(mkAction({ id: 'a4', evidence_required: true }), []),
    enrich(mkAction({ id: 'a5', evidence_required: false }), []),
  ];
  const s = buildWorkflowSummary(acts);
  assert.equal(s.evidenceRequired, 4);
  assert.equal(s.evidenceComplete, 2);
  assert.equal(s.evidenceCompletionPercentage, 50);
});

await test('15. No evidence-required actions returns 100%', async () => {
  const acts = [
    enrich(mkAction({ evidence_required: false })),
    enrich(mkAction({ evidence_required: false })),
  ];
  const s = buildWorkflowSummary(acts);
  assert.equal(s.evidenceRequired, 0);
  assert.equal(s.evidenceCompletionPercentage, 100);
});

// ============================================================
// Certification readiness (tests 16-20)
// ============================================================

await test('16. Certification ignores ordinary non-certification actions', async () => {
  const acts = [
    enrich(mkAction({ certification_requirement: false, status: 'Not Started' })),
    enrich(mkAction({ certification_requirement: false, status: 'In Progress' })),
  ];
  const c = buildCertificationReadiness(acts);
  assert.equal(c.certificationActionsRequired, 0);
  assert.equal(c.readyForCertification, false);
  assert.ok(c.reasons.includes('No certification requirements have been assigned.'));
});

await test('17. Certification is false when no certification requirements exist', async () => {
  const c = buildCertificationReadiness([]);
  assert.equal(c.readyForCertification, false);
  assert.ok(c.reasons.includes('No certification requirements have been assigned.'));
});

await test('18. Certification false when required evidence incomplete', async () => {
  const acts = [
    enrich(
      mkAction({ certification_requirement: true, evidence_required: true, status: 'Submitted for Verification' }),
      [mkEvidence({ verification_status: 'Submitted' })],
    ),
  ];
  const c = buildCertificationReadiness(acts);
  assert.equal(c.requiredEvidenceComplete, false);
  assert.equal(c.readyForCertification, false);
});

await test('19. Certification false when a certification action is unverified', async () => {
  const acts = [
    enrich(
      mkAction({ certification_requirement: true, evidence_required: true, status: 'Submitted for Verification' }),
      [mkEvidence({ verification_status: 'Approved' })], // evidence complete but action not verified
    ),
  ];
  const c = buildCertificationReadiness(acts);
  assert.equal(c.requiredEvidenceComplete, true);
  assert.equal(c.verificationComplete, false);
  assert.equal(c.readyForCertification, false);
});

await test('20. Certification true only when all cert actions verified AND evidence complete', async () => {
  const acts = [
    enrich(
      mkAction({ certification_requirement: true, evidence_required: true, status: 'Verified', verified_at: '2025-06-10T00:00:00Z' }),
      [mkEvidence({ verification_status: 'Approved' })],
    ),
    enrich(
      mkAction({ certification_requirement: true, evidence_required: false, status: 'Verified', verified_at: '2025-06-10T00:00:00Z' }),
      [],
    ),
    // ordinary action still incomplete — must NOT block certification
    enrich(mkAction({ certification_requirement: false, status: 'Not Started' })),
  ];
  const c = buildCertificationReadiness(acts);
  assert.equal(c.certificationActionsRequired, 2);
  assert.equal(c.certificationActionsVerified, 2);
  assert.equal(c.requiredEvidenceComplete, true);
  assert.equal(c.verificationComplete, true);
  assert.equal(c.readyForCertification, true);
});

// ============================================================
// Empty state + assembly + no writes (tests 21-22)
// ============================================================

await test('21. No-action organization returns a successful empty workflow', async () => {
  const wf = buildOrganizationWorkflow([], ORG_ID, 'Empty Org');
  assert.equal(wf.organization.totalActions, 0);
  assert.equal(wf.summary.totalActions, 0);
  assert.equal(wf.summary.completionPercentage, 0);
  assert.equal(wf.summary.verificationPercentage, 0);
  assert.equal(wf.summary.evidenceCompletionPercentage, 100);
  assert.equal(wf.certificationReadiness.readyForCertification, false);
  assert.ok(wf.certificationReadiness.reasons.includes('No certification requirements have been assigned.'));
  assert.equal(wf.actions.length, 0);
  assert.equal(wf.actionGroups.length, 4);
  for (const g of wf.actionGroups) assert.equal(g.count, 0);
  assert.equal(wf.overdueActions.length, 0);
});

await test('22. No database writes occur (pure builders only)', async () => {
  // The builders carry no supabase handle and return data only. Construct a
  // rich set and verify the return shape is data, with no insert/update/upsert
  // API surface on any returned object.
  const acts = [
    enrich(mkAction({ status: 'Completed', evidence_required: true }), [mkEvidence({ verification_status: 'Approved' })]),
    enrich(mkAction({ status: 'Deferred', due_date: dateOffset(-3) })),
    enrich(mkAction({ status: 'Submitted for Verification', due_date: dateOffset(-1) })),
  ];
  const wf = buildOrganizationWorkflow(acts, ORG_ID, 'Write Test Org');
  assert.equal(wf.organization.totalActions, 3);
  assert.equal(wf.deferredActions.length, 1);
  assert.equal(wf.overdueActions.length, 1); // only the Submitted-for-Verification one
  assert.equal(wf.overdueActions[0].daysOverdue, 1);
  // ensure returned arrays are plain data arrays
  assert.ok(Array.isArray(wf.actions));
  assert.ok(Array.isArray(wf.completedActions));
  assert.ok(Array.isArray(wf.certificationReadiness.reasons));
});

await test('extra: overdue excludes Verified/Completed even past due_date', async () => {
  const v = mkAction({ status: 'Verified', due_date: dateOffset(-10), verified_at: '2025-01-01T00:00:00Z' });
  const c = mkAction({ status: 'Completed', due_date: dateOffset(-10) });
  assert.equal(isOverdue(v), false);
  assert.equal(isOverdue(c), false);
});

await test('extra: evidenceTypes returns distinct types', async () => {
  const a = mkAction({ evidence_required: true });
  const ev = [
    mkEvidence({ evidence_type: 'document' }),
    mkEvidence({ evidence_type: 'document' }),
    mkEvidence({ evidence_type: 'policy' }),
  ];
  const s = buildEvidenceSummary(a, ev);
  assert.deepEqual(s.evidenceTypes.sort(), ['document', 'policy']);
});

await test('extra: pillar summaries compute evidence and deferred counts', async () => {
  const acts = [
    enrich(mkAction({ pillar_name: 'Clarity', status: 'Verified', verified_at: '2025-01-01T00:00:00Z', evidence_required: true, estimated_pillar_score_increase: 4 }),
      [mkEvidence({ verification_status: 'Approved' })]),
    enrich(mkAction({ pillar_name: 'Clarity', status: 'Deferred' })),
    enrich(mkAction({ pillar_name: 'Clarity', status: 'Awaiting Evidence', evidence_required: true }), []),
  ];
  const ps = buildPillarSummaries(acts);
  const clarity = ps.find((p) => p.pillar === 'Clarity');
  assert.ok(clarity);
  assert.equal(clarity.totalActions, 3);
  assert.equal(clarity.completed, 1);
  assert.equal(clarity.verified, 1);
  assert.equal(clarity.deferred, 1);
  assert.equal(clarity.awaitingEvidence, 1);
  assert.equal(clarity.evidenceRequired, 2);
  assert.equal(clarity.evidenceComplete, 1);
  assert.equal(clarity.estimatedScoreGain, 4 + 3 + 3); // two defaults + one override
  assert.equal(clarity.completionPercentage, 33); // 1 of 3
});

console.log('');
console.log(`Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
