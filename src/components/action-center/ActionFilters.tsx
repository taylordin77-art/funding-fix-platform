import { Search, SlidersHorizontal } from 'lucide-react';
import type { ActionPillarName, ActionPriority } from '../../lib/actionWorkflowService';

export type SortOption = 'priority' | 'dueDate' | 'newest';

export interface ActionFilterState {
  pillar: ActionPillarName | 'all';
  priority: ActionPriority | 'all';
  status: string | 'all';
  certificationRequired: boolean | 'all';
  evidenceRequired: boolean | 'all';
  search: string;
  sort: SortOption;
}

interface ActionFiltersProps {
  filters: ActionFilterState;
  onChange: (next: ActionFilterState) => void;
}

const PILLAR_OPTIONS: (ActionPillarName | 'all')[] = [
  'all', 'Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transformation',
];

const PRIORITY_OPTIONS: (ActionPriority | 'all')[] = [
  'all', 'Critical', 'High', 'Moderate', 'Low',
];

const STATUS_OPTIONS: (string | 'all')[] = [
  'all', 'Not Started', 'In Progress', 'Awaiting Evidence',
  'Submitted for Verification', 'Revision Required', 'Verified',
  'Completed', 'Deferred',
];

const TRINARY_OPTIONS = [
  { value: 'all' as const, label: 'Any' },
  { value: true as const, label: 'Yes' },
  { value: false as const, label: 'No' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'newest', label: 'Newest' },
];

const selectClass =
  'px-3 py-2 rounded-xl text-sm font-medium outline-none cursor-pointer ' +
  'bg-white/[0.04] border border-white/10 text-white transition-all ' +
  'hover:border-white/20 focus:border-[#1C7486]/50 focus:shadow-[0_0_0_3px_rgba(28,116,134,0.1)]';

export function ActionFilters({ filters, onChange }: ActionFiltersProps) {
  const update = <K extends keyof ActionFilterState>(key: K, value: ActionFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="card-premium p-4">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal size={15} style={{ color: '#1C7486' }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Filter & Sort
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          />
          <input
            type="text"
            placeholder="Search actions..."
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="input-premium"
            style={{ paddingLeft: '2.5rem', padding: '0.625rem 0.875rem 0.625rem 2.5rem', fontSize: '0.875rem' }}
          />
        </div>

        <select
          value={filters.pillar}
          onChange={(e) => update('pillar', e.target.value as ActionFilterState['pillar'])}
          className={selectClass}
          aria-label="Filter by pillar"
        >
          {PILLAR_OPTIONS.map((p) => (
            <option key={p} value={p} className="bg-[#141414]">
              {p === 'all' ? 'All Pillars' : p}
            </option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => update('priority', e.target.value as ActionFilterState['priority'])}
          className={selectClass}
          aria-label="Filter by priority"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p} className="bg-[#141414]">
              {p === 'all' ? 'All Priorities' : p}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => update('status', e.target.value as ActionFilterState['status'])}
          className={selectClass}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-[#141414]">
              {s === 'all' ? 'All Statuses' : s}
            </option>
          ))}
        </select>

        <select
          value={String(filters.certificationRequired)}
          onChange={(e) =>
            update('certificationRequired', e.target.value === 'all' ? 'all' : e.target.value === 'true')
          }
          className={selectClass}
          aria-label="Filter by certification required"
        >
          {TRINARY_OPTIONS.map((o) => (
            <option key={String(o.value)} value={String(o.value)} className="bg-[#141414]">
              {o.value === 'all' ? 'Cert: Any' : o.value ? 'Cert Required' : 'Cert Not Required'}
            </option>
          ))}
        </select>

        <select
          value={String(filters.evidenceRequired)}
          onChange={(e) =>
            update('evidenceRequired', e.target.value === 'all' ? 'all' : e.target.value === 'true')
          }
          className={selectClass}
          aria-label="Filter by evidence required"
        >
          {TRINARY_OPTIONS.map((o) => (
            <option key={String(o.value)} value={String(o.value)} className="bg-[#141414]">
              {o.value === 'all' ? 'Evidence: Any' : o.value ? 'Evidence Req.' : 'No Evidence'}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => update('sort', e.target.value as SortOption)}
          className={selectClass}
          aria-label="Sort actions"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value} className="bg-[#141414]">
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
