import { Building2 } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';
import type { DashboardOrganization } from '../../lib/dashboardService';

interface DashboardHeaderProps {
  organization: DashboardOrganization;
}

export function DashboardHeader({ organization }: DashboardHeaderProps) {
  return (
    <AnimatedSection direction="up">
      <div className="mb-8">
        <div className="section-label">
          <Building2 size={14} />
          Organization Dashboard
        </div>
        <h1 className="heading-xl text-white">{organization.organization_name}</h1>
        <div className="divider-teal" />
      </div>
    </AnimatedSection>
  );
}
