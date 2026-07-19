import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';
import type { DashboardPillarScore } from '../../lib/dashboardService';

interface PillarCardProps {
  pillar: DashboardPillarScore;
  index: number;
}

const RATING_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  'Strong':          { color: '#1C7486', bg: 'rgba(28,116,134,0.12)',  border: 'rgba(28,116,134,0.35)' },
  'Developing':      { color: '#D4A843', bg: 'rgba(212,168,67,0.12)',  border: 'rgba(212,168,67,0.35)' },
  'Needs Attention': { color: '#E8C876', bg: 'rgba(232,200,118,0.12)', border: 'rgba(232,200,118,0.35)' },
  'Critical Gap':    { color: '#E0656B', bg: 'rgba(224,101,107,0.12)', border: 'rgba(224,101,107,0.35)' },
};

export function PillarCard({ pillar, index }: PillarCardProps) {
  const pctInt = Math.round(pillar.percentage_score * 100);
  const change = pillar.score_change ?? 0;
  const ratingStyle = RATING_STYLES[pillar.rating ?? ''] ?? {
    color: 'rgba(255,255,255,0.6)',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
  };

  const changeIcon = change > 0 ? <TrendingUp size={13} /> : change < 0 ? <TrendingDown size={13} /> : <Minus size={13} />;
  const changeColor = change > 0 ? '#1C7486' : change < 0 ? '#E0656B' : 'rgba(255,255,255,0.4)';
  const changeLabel = change > 0 ? `+${change}` : `${change}`;

  return (
    <AnimatedSection direction="up" delay={60 + index * 60}>
      <div className="card-premium p-6 h-full">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{pillar.pillar_name}</h3>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: ratingStyle.color, backgroundColor: ratingStyle.bg, border: `1px solid ${ratingStyle.border}` }}
          >
            {pillar.rating ?? '—'}
          </span>
        </div>

        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-4xl font-bold text-white">{pctInt}</span>
          <span className="text-xl font-semibold text-white/50">%</span>
        </div>

        <div className="progress-bar mb-4">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(Math.max(pctInt, 0), 100)}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: changeColor }}>
          {changeIcon}
          <span>{changeLabel} from previous</span>
        </div>
      </div>
    </AnimatedSection>
  );
}
