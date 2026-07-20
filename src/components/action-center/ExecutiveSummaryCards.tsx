import {
  ListTodo, Flame, AlertTriangle, FileCheck2, BadgeCheck, ShieldCheck, TrendingUp,
} from 'lucide-react';
import { AnimatedSection, AnimatedCounter } from '../AnimatedSection';
import type { OrganizationWorkflow } from '../../lib/actionWorkflowService';

interface ExecutiveSummaryCardsProps {
  workflow: OrganizationWorkflow;
}

interface CardDef {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  border: string;
}

export function ExecutiveSummaryCards({ workflow }: ExecutiveSummaryCardsProps) {
  const { summary, certificationReadiness } = workflow;
  const remaining = summary.totalActions - summary.completed;
  const certPct =
    certificationReadiness.certificationActionsRequired === 0
      ? 0
      : Math.round(
          (certificationReadiness.certificationActionsVerified /
            certificationReadiness.certificationActionsRequired) *
            100,
        );
  const scoreGain = workflow.pillarSummaries.reduce((s, p) => s + p.estimatedScoreGain, 0);

  const cards: CardDef[] = [
    {
      label: 'Actions Remaining',
      value: remaining,
      icon: <ListTodo size={16} />,
      accent: '#1C7486', bg: 'rgba(28,116,134,0.1)', border: 'rgba(28,116,134,0.2)',
    },
    {
      label: 'Critical Actions',
      value: workflow.actionGroups.find((g) => g.priority === 'Critical')?.count ?? 0,
      icon: <Flame size={16} />,
      accent: '#E0656B', bg: 'rgba(224,101,107,0.1)', border: 'rgba(224,101,107,0.2)',
    },
    {
      label: 'Overdue',
      value: summary.overdue,
      icon: <AlertTriangle size={16} />,
      accent: summary.overdue > 0 ? '#E0656B' : 'rgba(255,255,255,0.4)',
      bg: 'rgba(224,101,107,0.08)', border: 'rgba(224,101,107,0.15)',
    },
    {
      label: 'Evidence Pending',
      value: summary.awaitingEvidence,
      icon: <FileCheck2 size={16} />,
      accent: '#D4A843', bg: 'rgba(212,168,67,0.1)', border: 'rgba(212,168,67,0.2)',
    },
    {
      label: 'Verification Pending',
      value: summary.awaitingVerification,
      icon: <BadgeCheck size={16} />,
      accent: '#2592A8', bg: 'rgba(28,116,134,0.12)', border: 'rgba(28,116,134,0.22)',
    },
    {
      label: 'Certification %',
      value: certPct,
      suffix: '%',
      icon: <ShieldCheck size={16} />,
      accent: '#D4A843', bg: 'rgba(212,168,67,0.1)', border: 'rgba(212,168,67,0.2)',
    },
    {
      label: 'Est. Score Gain',
      value: scoreGain,
      icon: <TrendingUp size={16} />,
      accent: '#1C7486', bg: 'rgba(28,116,134,0.1)', border: 'rgba(28,116,134,0.2)',
    },
  ];

  return (
    <AnimatedSection direction="up" delay={40}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="card-premium p-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.accent }}
            >
              {c.icon}
            </div>
            <div className="text-2xl font-bold text-white leading-none mb-1.5">
              <AnimatedCounter target={c.value} suffix={c.suffix ?? ''} />
            </div>
            <div
              className="text-[0.6875rem] font-semibold uppercase tracking-wider leading-tight"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              {c.label}
            </div>
          </div>
        ))}
      </div>
    </AnimatedSection>
  );
}
