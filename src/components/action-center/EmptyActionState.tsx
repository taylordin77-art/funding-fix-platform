import { ClipboardList } from 'lucide-react';

interface EmptyActionStateProps {
  organizationName?: string;
}

export function EmptyActionState({ organizationName }: EmptyActionStateProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-lg mx-auto px-4 text-center">
        {/* Large illustration */}
        <div className="relative mx-auto mb-8" style={{ width: '120px', height: '120px' }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(28,116,134,0.06)', filter: 'blur(40px)' }}
          />
          <div
            className="relative w-full h-full rounded-3xl flex items-center justify-center"
            style={{
              background: 'rgba(28,116,134,0.08)',
              border: '1px solid rgba(28,116,134,0.2)',
            }}
          >
            <ClipboardList size={48} style={{ color: '#1C7486' }} />
          </div>
        </div>

        <h1 className="heading-lg text-white mb-4">No Action Plan Exists</h1>
        <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {organizationName
            ? `${organizationName} does not have an action plan yet. `
            : ''}
          Generate an action plan from your completed assessment to begin improving your organization.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" className="btn-primary">
            <ClipboardList size={16} /> Create Action Plan
          </button>
          <button type="button" className="btn-ghost">
            Take Assessment
          </button>
        </div>
      </div>
    </div>
  );
}
