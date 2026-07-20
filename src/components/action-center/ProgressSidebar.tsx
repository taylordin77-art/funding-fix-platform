import { CheckCircle2, ShieldCheck, FileCheck2, BarChart3, Layers } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';
import type { OrganizationWorkflow, PillarSummary } from '../../lib/actionWorkflowService';

interface ProgressSidebarProps {
  workflow: OrganizationWorkflow;
}

interface MetricRow {
  label: string;
  pct: number;
  color: string;
}

const STATUS_DISPLAY: { key: keyof typeof STATUS_LABELS; label: string }[] = [
  { key: 'notStarted', label: 'Not Started' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'awaitingEvidence', label: 'Awaiting Evidence' },
  { key: 'awaitingVerification', label: 'Submitted for Verification' },
  { key: 'revisionRequired', label: 'Revision Required' },
  { key: 'verified', label: 'Verified' },
  { key: 'completed', label: 'Completed' },
  { key: 'deferred', label: 'Deferred' },
];
const STATUS_LABELS: Record<string, number> = {};

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function ProgressSidebar({ workflow }: ProgressSidebarProps) {
  const { summary, pillarSummaries, certificationReadiness } = workflow;

  const metrics: MetricRow[] = [
    { label: 'Completion', pct: summary.completionPercentage, color: 'linear-gradient(90deg, #1C7486, #2592A8)' },
    { label: 'Verification', pct: summary.verificationPercentage, color: 'linear-gradient(90deg, #2592A8, #34B478)' },
    { label: 'Evidence', pct: summary.evidenceCompletionPercentage, color: 'linear-gradient(90deg, #D4A843, #E8C876)' },
  ];

  const certPct =
    certificationReadiness.certificationActionsRequired === 0
      ? 0
      : Math.round(
          (certificationReadiness.certificationActionsVerified /
            certificationReadiness.certificationActionsRequired) *
            100,
        );

  const statusCounts: { label: string; count: number }[] = STATUS_DISPLAY.map((s) => ({
    label: s.label,
    count: summary[s.key as keyof typeof summary] as number,
  })).filter((s) => s.count > 0);

  return (
    <AnimatedSection direction="up" delay={120}>
      <div className="space-y-4 lg:sticky lg:top-6">
        {/* Progress metrics */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={15} style={{ color: '#1C7486' }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Progress
            </h3>
          </div>

          <div className="space-y-4">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{m.label}</span>
                  <span className="text-xs font-bold text-white">{m.pct}%</span>
                </div>
                <ProgressBar pct={m.pct} color={m.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Certification */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={15} style={{ color: '#D4A843' }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Certification
            </h3>
          </div>

          <div className="flex items-end justify-between mb-3">
            <span className="text-3xl font-bold text-white leading-none">{certPct}%</span>
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{
                background: certificationReadiness.readyForCertification ? 'rgba(52,180,120,0.12)' : 'rgba(212,168,67,0.12)',
                color: certificationReadiness.readyForCertification ? '#34B478' : '#D4A843',
                border: `1px solid ${certificationReadiness.readyForCertification ? 'rgba(52,180,120,0.25)' : 'rgba(212,168,67,0.25)'}`,
              }}
            >
              {certificationReadiness.certificationActionsRequired === 0
                ? 'None assigned'
                : certificationReadiness.readyForCertification
                  ? 'Ready'
                  : `${certificationReadiness.remainingActions} remaining`}
            </span>
          </div>

          {certificationReadiness.reasons.length > 0 && (
            <ul className="space-y-1.5">
              {certificationReadiness.reasons.slice(0, 2).map((r) => (
                <li key={r} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <span style={{ color: '#D4A843' }}>•</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions by status */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={15} style={{ color: '#1C7486' }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Actions by Status
            </h3>
          </div>
          {statusCounts.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>No actions</p>
          ) : (
            <div className="space-y-2.5">
              {statusCounts.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.label}</span>
                  <span className="text-xs font-bold text-white">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions by pillar */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={15} style={{ color: '#1C7486' }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Actions by Pillar
            </h3>
          </div>
          <div className="space-y-3">
            {pillarSummaries.filter((p) => p.totalActions > 0).map((p: PillarSummary) => (
              <div key={p.pillar}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.pillar}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {p.completed}/{p.totalActions} · +{p.estimatedScoreGain}
                  </span>
                </div>
                <ProgressBar
                  pct={p.completionPercentage}
                  color="linear-gradient(90deg, #1C7486, #D4A843)"
                />
              </div>
            ))}
            {pillarSummaries.every((p) => p.totalActions === 0) && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>No actions</p>
            )}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

export { FileCheck2 };
