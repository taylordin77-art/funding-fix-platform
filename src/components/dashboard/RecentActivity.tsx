import { History } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';
import type { DashboardScoreHistoryEntry } from '../../lib/dashboardService';

interface RecentActivityProps {
  entries: DashboardScoreHistoryEntry[];
}

function formatRecordedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <AnimatedSection direction="up" delay={100}>
      <div className="card-premium p-7">
        <div className="flex items-center gap-2 mb-5">
          <History size={16} style={{ color: '#1C7486' }} />
          <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Recent Activity
          </h2>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No recent activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry, i) => {
              const change = entry.score_change ?? 0;
              const changeColor = change > 0 ? '#1C7486' : change < 0 ? '#E0656B' : 'rgba(255,255,255,0.4)';
              const changeLabel = change > 0 ? `+${change}` : `${change}`;
              return (
                <li
                  key={i}
                  className="flex items-start justify-between gap-4 py-3"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.pillar_name && (
                        <span className="badge-teal" style={{ padding: '0.15rem 0.6rem' }}>
                          {entry.pillar_name}
                        </span>
                      )}
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {entry.score_type}
                      </span>
                    </div>
                    <p className="text-sm text-white/75 leading-snug">{entry.change_reason}</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {formatRecordedAt(entry.recorded_at)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold" style={{ color: changeColor }}>{changeLabel}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      score {Math.round(entry.new_score * 100) / 100}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AnimatedSection>
  );
}
