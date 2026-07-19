import { supabase } from './supabase';

const PILLAR_ORDER = ['Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transformation'] as const;

const BLOCKED_STATUSES = ['Awaiting Evidence', 'Revision Required'] as const;

export type DashboardPillarName =
  | 'Clarity'
  | 'Structure'
  | 'Health'
  | 'Impact'
  | 'Funding'
  | 'Transformation';

export type DashboardErrorCode = 'NOT_AUTHENTICATED' | 'NO_ORGANIZATION' | 'UNEXPECTED_ERROR';

export interface DashboardError {
  code: DashboardErrorCode;
  message: string;
}

export interface DashboardOrganization {
  id: string;
  organization_name: string;
}

export interface DashboardLatestAssessment {
  id: string;
  completed_at: string | null;
  total_score: number;
  overall_percentage: number | null;
  status: string;
}

export interface DashboardPillarScore {
  pillar_name: DashboardPillarName;
  raw_score: number;
  percentage_score: number;
  rating: string | null;
  score_change: number | null;
}

export interface DashboardActionCounts {
  total: number;
  not_started: number;
  in_progress: number;
  completed: number;
  blocked: number;
}

export interface DashboardScoreHistoryEntry {
  pillar_name: DashboardPillarName | null;
  score_type: 'overall' | 'pillar' | 'fundability';
  new_score: number;
  score_change: number;
  recorded_at: string;
  change_reason: string;
}

export interface OrganizationDashboard {
  organization: DashboardOrganization;
  latest_assessment: DashboardLatestAssessment | null;
  pillar_scores: DashboardPillarScore[];
  action_counts: DashboardActionCounts;
  recent_activity: DashboardScoreHistoryEntry[];
}

export type OrganizationDashboardResult =
  | { ok: true; data: OrganizationDashboard }
  | { ok: false; error: DashboardError };

type MembershipRow = {
  organization_id: string;
  organization_role: string;
  joined_at: string;
  organizations: { id: string; organization_name: string } | null;
};

type LatestAssessmentRow = {
  id: string;
  completed_at: string | null;
  total_score: number | null;
  overall_percentage: number | null;
  status: string | null;
  pillar_scores: DashboardPillarScore[] | null;
};

type ActionStatusRow = {
  status: string;
};

type ScoreHistoryRow = {
  pillar_name: DashboardPillarName | null;
  score_type: 'overall' | 'pillar' | 'fundability';
  new_score: number | null;
  score_change: number | null;
  recorded_at: string;
  change_reason: string;
};

const EMPTY_ACTION_COUNTS: DashboardActionCounts = {
  total: 0,
  not_started: 0,
  in_progress: 0,
  completed: 0,
  blocked: 0,
};

function pillarRank(name: string): number {
  const idx = PILLAR_ORDER.indexOf(name as (typeof PILLAR_ORDER)[number]);
  return idx === -1 ? PILLAR_ORDER.length : idx;
}

function sortPillarScores(rows: DashboardPillarScore[] | null): DashboardPillarScore[] {
  if (!rows || rows.length === 0) return [];
  return [...rows].sort((a, b) => pillarRank(a.pillar_name) - pillarRank(b.pillar_name));
}

function countActions(rows: ActionStatusRow[] | null): DashboardActionCounts {
  if (!rows || rows.length === 0) return EMPTY_ACTION_COUNTS;
  const counts: DashboardActionCounts = { ...EMPTY_ACTION_COUNTS, total: rows.length };
  for (const row of rows) {
    if (row.status === 'Not Started') counts.not_started += 1;
    else if (row.status === 'In Progress') counts.in_progress += 1;
    else if (row.status === 'Completed') counts.completed += 1;
    else if (BLOCKED_STATUSES.includes(row.status as (typeof BLOCKED_STATUSES)[number])) counts.blocked += 1;
  }
  return counts;
}

function toHistoryEntries(rows: ScoreHistoryRow[] | null): DashboardScoreHistoryEntry[] {
  if (!rows || rows.length === 0) return [];
  return rows.map((row) => ({
    pillar_name: row.pillar_name,
    score_type: row.score_type,
    new_score: row.new_score ?? 0,
    score_change: row.score_change ?? 0,
    recorded_at: row.recorded_at,
    change_reason: row.change_reason,
  }));
}

export async function getOrganizationDashboard(): Promise<OrganizationDashboardResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'You must be signed in to view the dashboard.' },
    };
  }

  const { data: membership, error: membershipError } = (await supabase
    .from('organization_members')
    .select(
      'organization_id, organization_role, joined_at, organizations!inner(id, organization_name)'
    )
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()) as { data: MembershipRow | null; error: { code?: string; message?: string } | null };

  if (membershipError) {
    return {
      ok: false,
      error: { code: 'UNEXPECTED_ERROR', message: 'Unable to load organization membership.' },
    };
  }
  if (!membership || !membership.organizations) {
    return {
      ok: false,
      error: { code: 'NO_ORGANIZATION', message: 'No active organization found for this account.' },
    };
  }

  const organization: DashboardOrganization = {
    id: membership.organizations.id,
    organization_name: membership.organizations.organization_name,
  };
  const orgId = organization.id;

  const [latestResult, actionsResult, historyResult] = await Promise.all([
    supabase
      .from('assessments')
      .select(
        'id, completed_at, total_score, overall_percentage, status, pillar_scores(pillar_name, raw_score, percentage_score, rating, score_change)'
      )
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{ data: LatestAssessmentRow | null; error: { message?: string } | null }>,
    supabase
      .from('organization_actions')
      .select('status')
      .eq('organization_id', orgId) as Promise<{ data: ActionStatusRow[] | null; error: { message?: string } | null }>,
    supabase
      .from('score_history')
      .select('pillar_name, score_type, new_score, score_change, recorded_at, change_reason')
      .eq('organization_id', orgId)
      .order('recorded_at', { ascending: false })
      .limit(5) as Promise<{ data: ScoreHistoryRow[] | null; error: { message?: string } | null }>,
  ]);

  if (latestResult.error || actionsResult.error || historyResult.error) {
    const detail =
      latestResult.error?.message || actionsResult.error?.message || historyResult.error?.message || 'Unknown error';
    return {
      ok: false,
      error: { code: 'UNEXPECTED_ERROR', message: `Dashboard read failed: ${detail}` },
    };
  }

  const latest = latestResult.data;
  const dashboard: OrganizationDashboard = {
    organization,
    latest_assessment: latest
      ? {
          id: latest.id,
          completed_at: latest.completed_at,
          total_score: latest.total_score ?? 0,
          overall_percentage: latest.overall_percentage,
          status: latest.status ?? 'completed',
        }
      : null,
    pillar_scores: latest ? sortPillarScores(latest.pillar_scores) : [],
    action_counts: countActions(actionsResult.data),
    recent_activity: toHistoryEntries(historyResult.data),
  };

  return { ok: true, data: dashboard };
}
