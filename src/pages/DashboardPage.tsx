import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, AlertTriangle, ClipboardList } from 'lucide-react';
import { getOrganizationDashboard, type OrganizationDashboardResult } from '../lib/dashboardService';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { HealthSummaryCard } from '../components/dashboard/HealthSummaryCard';
import { PillarCard } from '../components/dashboard/PillarCard';
import { ActionSummary } from '../components/dashboard/ActionSummary';
import { RecentActivity } from '../components/dashboard/RecentActivity';

export default function DashboardPage() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; result: OrganizationDashboardResult }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getOrganizationDashboard();
      if (!cancelled) setState({ status: 'ready', result });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <DashboardSkeleton />;
  }

  const { result } = state;

  if (!result.ok) {
    return (
      <div className="min-h-screen py-16 flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="max-w-md mx-auto px-4 text-center">
          {result.error.code === 'NOT_AUTHENTICATED' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.25)' }}>
                <LogIn size={22} style={{ color: '#1C7486' }} />
              </div>
              <h1 className="heading-lg text-white mb-3">Sign in required</h1>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Please sign in to view your organization dashboard.
              </p>
              <Link to="/login" className="btn-primary">Sign In</Link>
            </>
          )}
          {result.error.code === 'NO_ORGANIZATION' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <AlertTriangle size={22} style={{ color: '#D4A843' }} />
              </div>
              <h1 className="heading-lg text-white mb-3">No organization has been configured.</h1>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Set up your organization to start tracking your operating system.
              </p>
              <Link to="/organization/setup" className="btn-primary">Set Up Organization</Link>
            </>
          )}
          {result.error.code === 'UNEXPECTED_ERROR' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(224,101,107,0.1)', border: '1px solid rgba(224,101,107,0.25)' }}>
                <AlertTriangle size={22} style={{ color: '#E0656B' }} />
              </div>
              <h1 className="heading-lg text-white mb-3">Something went wrong</h1>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>{result.error.message}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto px-4">
        <DashboardHeader organization={data.organization} />

        {!data.latest_assessment ? (
          <div className="card-premium p-10 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.25)' }}>
              <ClipboardList size={22} style={{ color: '#1C7486' }} />
            </div>
            <h2 className="heading-lg text-white mb-3">No completed assessment has been connected yet.</h2>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Complete the C-SHIFT fundability assessment to unlock your pillar scores and dashboard insights.
            </p>
            <Link to="/assessment" className="btn-primary">Take Assessment</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <HealthSummaryCard assessment={data.latest_assessment} />
              <ActionSummary counts={data.action_counts} />
            </div>

            <div className="mb-6">
              <div className="section-label">C-SHIFT Pillars</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.pillar_scores.map((pillar, i) => (
                  <PillarCard key={pillar.pillar_name} pillar={pillar} index={i} />
                ))}
              </div>
            </div>

            <RecentActivity entries={data.recent_activity} />
          </>
        )}
      </div>
    </div>
  );
}
