import { useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { ActionCard } from './ActionCard';
import type {
  ActionGroup,
  WorkflowActionWithEvidence,
  ActionPriority,
} from '../../lib/actionWorkflowService';

interface PriorityQueueProps {
  groups: ActionGroup[];
}

const PRIORITY_ACCENT: Record<ActionPriority, string> = {
  Critical: '#E0656B',
  High: '#D4A843',
  Moderate: '#1C7486',
  Low: 'rgba(255,255,255,0.4)',
};

export function PriorityQueue({ groups }: PriorityQueueProps) {
  const [collapsed, setCollapsed] = useState<Set<ActionPriority>>(new Set());

  const toggle = (p: ActionPriority) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const visibleGroups = groups.filter((g) => g.count > 0);

  if (visibleGroups.length === 0) {
    return (
      <div className="card-premium p-12 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Inbox size={22} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
        <h3 className="heading-lg text-white mb-2">No actions match your filters</h3>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Adjust the filters above to see more actions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => {
        const isCollapsed = collapsed.has(group.priority);
        const accent = PRIORITY_ACCENT[group.priority];
        return (
          <section key={group.priority}>
            <button
              type="button"
              onClick={() => toggle(group.priority)}
              className="w-full flex items-center justify-between gap-3 mb-3 group"
              aria-expanded={!isCollapsed}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-1.5 h-6 rounded-full"
                  style={{ background: accent }}
                />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  {group.priority}
                </h2>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
                >
                  {group.count}
                </span>
              </div>
              <ChevronDown
                size={18}
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                  transition: 'transform 0.3s ease',
                }}
              />
            </button>

            {!isCollapsed && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {group.actions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Re-export for the page's filtered-group builder
export type { WorkflowActionWithEvidence };
