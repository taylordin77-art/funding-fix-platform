import { Activity, Calendar } from 'lucide-react';
import { AnimatedSection, AnimatedCounter } from '../AnimatedSection';
import type { DashboardLatestAssessment } from '../../lib/dashboardService';

interface HealthSummaryCardProps {
  assessment: DashboardLatestAssessment;
}

function formatCompletedDate(value: string | null): string {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function HealthSummaryCard({ assessment }: HealthSummaryCardProps) {
  const pct = assessment.overall_percentage;
  const pctInt = pct != null ? Math.round(pct * 100) : null;
  const statusLabel = assessment.status
    ? assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)
    : 'Completed';

  return (
    <AnimatedSection direction="up" delay={40}>
      <div className="card-premium p-7 h-full">
        <div className="flex items-center gap-2 mb-5">
          <Activity size={16} style={{ color: '#1C7486' }} />
          <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Overall Organizational Health
          </h2>
        </div>

        <div className="flex items-end gap-2 mb-5">
          {pctInt != null ? (
            <>
              <AnimatedCounter
                target={pctInt}
                suffix="%"
                className="text-gradient-teal"
              />
            </>
          ) : (
            <span className="heading-display text-white/40">—</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="badge-teal">{statusLabel}</span>
          <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Calendar size={13} />
            Assessment completed {formatCompletedDate(assessment.completed_at)}
          </span>
        </div>
      </div>
    </AnimatedSection>
  );
}
