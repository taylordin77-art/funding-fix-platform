import { Building2, Calendar, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AnimatedSection } from '../AnimatedSection';
import type {
  OrganizationSummary,
  WorkflowSummary,
  CertificationReadiness,
} from '../../lib/actionWorkflowService';

interface ActionCenterHeaderProps {
  organization: OrganizationSummary;
  summary: WorkflowSummary;
  certification: CertificationReadiness;
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function certStatusLabel(c: CertificationReadiness): { label: string; color: string } {
  if (c.certificationActionsRequired === 0) {
    return { label: 'No cert requirements', color: 'rgba(255,255,255,0.4)' };
  }
  if (c.readyForCertification) return { label: 'Certification Ready', color: '#34B478' };
  if (c.requiredEvidenceComplete && c.verificationComplete) {
    return { label: 'Certification Ready', color: '#34B478' };
  }
  return { label: `${c.remainingActions} cert actions remaining`, color: '#D4A843' };
}

export function ActionCenterHeader({ organization, summary, certification }: ActionCenterHeaderProps) {
  const cert = certStatusLabel(certification);

  return (
    <AnimatedSection direction="up">
      <div className="mb-8">
        <div className="section-label">
          <Building2 size={14} />
          Action Center
        </div>
        <h1 className="heading-xl text-white">{organization.organizationName}</h1>
        <div className="divider-teal" />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Calendar size={14} style={{ color: '#1C7486' }} />
            {todayLabel()}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} style={{ color: '#1C7486' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Completion:</span>
            <span className="font-bold text-white">{summary.completionPercentage}%</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck size={14} style={{ color: cert.color }} />
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Certification:</span>
            <span className="font-bold" style={{ color: cert.color }}>{cert.label}</span>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
