import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getOrganizationWorkflow, type OrganizationWorkflow } from '../lib/actionWorkflowService';
import { ActionCenterHeader } from '../components/action-center/ActionCenterHeader';
import { ExecutiveSummaryCards } from '../components/action-center/ExecutiveSummaryCards';
import { ActionFilters, type ActionFilterState, type SortOption } from '../components/action-center/ActionFilters';
import { PriorityQueue } from '../components/action-center/PriorityQueue';
import { ProgressSidebar } from '../components/action-center/ProgressSidebar';
import { EmptyActionState } from '../components/action-center/EmptyActionState';
import { LoadingState } from '../components/action-center/LoadingState';
import type {
  WorkflowActionWithEvidence,
  ActionPriority,
  ActionGroup,
} from '../lib/actionWorkflowService';

const PRIORITY_RANK: Record<ActionPriority, number> = { Critical: 1, High: 2, Moderate: 3, Low: 4 };

const DEFAULT_FILTERS: ActionFilterState = {
  pillar: 'all',
  priority: 'all',
  status: 'all',
  certificationRequired: 'all',
  evidenceRequired: 'all',
  search: '',
  sort: 'priority',
};

function dueSoonDays(action: WorkflowActionWithEvidence): number | null {
  if (!action.due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(action.due_date + 'T00:00:00');
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

function isOverdueAction(a: WorkflowActionWithEvidence): boolean {
  if (!a.due_date) return false;
  if (a.status === 'Completed' || a.status === 'Verified' || a.status === 'Deferred') return false;
  return (dueSoonDays(a) ?? 0) < 0;
}

function sortActionsForGroup(actions: WorkflowActionWithEvidence[], sort: SortOption): WorkflowActionWithEvidence[] {
  if (sort === 'newest') {
    return [...actions].sort((a, b) => {
      const ac = a.created_at ?? '';
      const bc = b.created_at ?? '';
      return bc < ac ? -1 : bc > ac ? 1 : 0;
    });
  }
  // priority + dueDate both sort: overdue first, then due soon, then newest.
  return [...actions].sort((a, b) => {
    const ao = isOverdueAction(a) ? 0 : 1;
    const bo = isOverdueAction(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const ad = dueSoonDays(a);
    const bd = dueSoonDays(b);
    if (ad != null && bd != null && ad !== bd) return ad - bd;
    if (ad != null && bd == null) return -1;
    if (ad == null && bd != null) return 1;
    if (sort === 'priority') {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
    }
    const ac = a.created_at ?? '';
    const bc = b.created_at ?? '';
    return bc < ac ? -1 : bc > ac ? 1 : 0;
  });
}

function buildFilteredGroups(
  actions: WorkflowActionWithEvidence[],
  filters: ActionFilterState,
): ActionGroup[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = actions.filter((a) => {
    if (filters.pillar !== 'all' && a.pillar_name !== filters.pillar) return false;
    if (filters.priority !== 'all' && a.priority !== filters.priority) return false;
    if (filters.status !== 'all' && a.status !== filters.status) return false;
    if (filters.certificationRequired !== 'all' && (a.certification_requirement === true) !== filters.certificationRequired) return false;
    if (filters.evidenceRequired !== 'all' && (a.evidence_required === true) !== filters.evidenceRequired) return false;
    if (q) {
      const hay = `${a.title} ${a.description} ${a.why_it_matters ?? ''} ${a.action_category ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const order: ActionPriority[] = ['Critical', 'High', 'Moderate', 'Low'];
  return order.map((priority) => {
    const list = filtered.filter((a) => a.priority === priority);
    return { priority, actions: sortActionsForGroup(list, filters.sort), count: list.length };
  });
}

export default function ActionCenterPage() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; code: string; message: string }
    | { status: 'ready'; data: OrganizationWorkflow }
  >({ status: 'loading' });

  const [filters, setFilters] = useState<ActionFilterState>(DEFAULT_FILTERS);

  const load = () => {
    setState({ status: 'loading' });
    let cancelled = false;
    (async () => {
      const result = await getOrganizationWorkflow();
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: 'error', code: result.error.code, message: result.error.message });
      } else {
        setState({ status: 'ready', data: result.data });
      }
    })();
    return () => { cancelled = true; };
  };

  useEffect(() => load(), []);

  if (state.status === 'loading') return <LoadingState />;

  if (state.status === 'error') {
    return (
      <div className="min-h-screen py-16 flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="max-w-md mx-auto px-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(224,101,107,0.1)', border: '1px solid rgba(224,101,107,0.25)' }}
          >
            <AlertTriangle size={22} style={{ color: '#E0656B' }} />
          </div>
          <h1 className="heading-lg text-white mb-3">Unable to load the Action Center</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{state.message}</p>
          <button type="button" className="btn-primary" onClick={load}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const { data } = state;

  if (data.organization.totalActions === 0) {
    return <EmptyActionState organizationName={data.organization.organizationName} />;
  }

  const filteredGroups = useMemo(
    () => buildFilteredGroups(data.actions, filters),
    [data.actions, filters],
  );

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto px-4">
        <ActionCenterHeader
          organization={data.organization}
          summary={data.summary}
          certification={data.certificationReadiness}
        />

        <ExecutiveSummaryCards workflow={data} />

        <div className="mb-8">
          <ActionFilters filters={filters} onChange={setFilters} />
        </div>

        {/* Desktop: queue 70% / sidebar 30%. Mobile: sidebar then queue. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="order-2 lg:order-1">
            <PriorityQueue groups={filteredGroups} />
          </div>
          <div className="order-1 lg:order-2">
            <ProgressSidebar workflow={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
