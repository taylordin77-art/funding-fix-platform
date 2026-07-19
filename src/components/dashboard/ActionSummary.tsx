import { CheckSquare, CircleDot, Loader, ShieldAlert, ListChecks } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';
import type { DashboardActionCounts } from '../../lib/dashboardService';

interface ActionSummaryProps {
  counts: DashboardActionCounts;
}

export function ActionSummary({ counts }: ActionSummaryProps) {
  const items = [
    { label: 'Total',       value: counts.total,        icon: <ListChecks size={16} />,    color: '#1C7486' },
    { label: 'Not Started', value: counts.not_started,  icon: <CircleDot size={16} />,     color: 'rgba(255,255,255,0.6)' },
    { label: 'In Progress', value: counts.in_progress,  icon: <Loader size={16} />,        color: '#D4A843' },
    { label: 'Completed',   value: counts.completed,    icon: <CheckSquare size={16} />,   color: '#1C7486' },
    { label: 'Blocked',     value: counts.blocked,      icon: <ShieldAlert size={16} />,   color: '#E0656B' },
  ];

  return (
    <AnimatedSection direction="up" delay={80}>
      <div className="card-premium p-7 h-full">
        <h2 className="text-sm font-semibold tracking-wide uppercase mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Organization Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.map((it) => (
            <div
              key={it.label}
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: it.color }}>
                {it.icon}
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{it.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{it.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}
