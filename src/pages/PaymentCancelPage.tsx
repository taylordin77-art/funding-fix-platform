import { Link, useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, MessageSquare } from 'lucide-react';

export default function PaymentCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="card-premium p-10 text-center max-w-md w-full">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <XCircle size={36} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Payment Cancelled</h1>
        <p className="leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
          No charge was made. You can return and try again whenever you're ready.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-primary w-full justify-center"
          >
            <ArrowLeft size={15} />
            Go Back
          </button>
          <Link to="/pricing" className="btn-ghost w-full justify-center">
            View Pricing Plans
          </Link>
        </div>

        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Have questions before purchasing?</p>
          <a
            href="https://calendly.com/taylordin77/new-meeting-1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: '#1C7486' }}
          >
            <MessageSquare size={13} />
            Book a free strategy call
          </a>
        </div>
      </div>
    </div>
  );
}
