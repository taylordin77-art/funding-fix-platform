import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TYPE_MESSAGES: Record<string, { heading: string; sub: string; next: { label: string; href: string; internal: boolean }[] }> = {
  core_monthly: {
    heading: 'Welcome to Core!',
    sub: 'Your Core membership is now active. You have full access to the assessment, resource library, workshop, and community.',
    next: [
      { label: 'Take the Full Assessment', href: '/assessment', internal: true },
      { label: 'Browse the Resource Library', href: '/resources', internal: true },
    ],
  },
  core_annual: {
    heading: 'Welcome to Core!',
    sub: 'Your annual Core membership is active. Enjoy 12 months of full platform access.',
    next: [
      { label: 'Take the Full Assessment', href: '/assessment', internal: true },
      { label: 'Browse the Resource Library', href: '/resources', internal: true },
    ],
  },
  premium_monthly: {
    heading: 'Welcome to Premium!',
    sub: 'Your Premium membership is active. You now have access to the client portal, group coaching, and priority support.',
    next: [
      { label: 'Open Client Portal', href: '/portal', internal: true },
      { label: 'Book Your First Session', href: 'https://calendly.com/taylordin77/new-meeting-1', internal: false },
    ],
  },
  premium_annual: {
    heading: 'Welcome to Premium!',
    sub: 'Your annual Premium membership is active. Enjoy a full year of premium access.',
    next: [
      { label: 'Open Client Portal', href: '/portal', internal: true },
      { label: 'Book Your First Session', href: 'https://calendly.com/taylordin77/new-meeting-1', internal: false },
    ],
  },
  workshop: {
    heading: "You're Registered!",
    sub: 'Your workshop registration is confirmed. Check your email for the Zoom link, workbook download, and session details.',
    next: [
      { label: 'Access Workshop Materials', href: '/workshop', internal: true },
      { label: 'Join the Community', href: '/community', internal: true },
    ],
  },
};

const DEFAULT_MSG = {
  heading: 'Payment Successful!',
  sub: 'Your payment was processed successfully. Check your email for confirmation.',
  next: [{ label: 'Go to Dashboard', href: '/', internal: true }],
};

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuth();
  const type = searchParams.get('type') || '';
  const msg = TYPE_MESSAGES[type] || DEFAULT_MSG;
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await refreshProfile();
      setRefreshed(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [refreshProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="card-premium p-10 text-center max-w-lg w-full">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}>
          <CheckCircle size={36} style={{ color: '#1C7486' }} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{msg.heading}</h1>
        <p className="leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>{msg.sub}</p>

        <div className="space-y-3 mb-8">
          {msg.next.map(item =>
            item.internal ? (
              <Link
                key={item.href}
                to={item.href}
                className="btn-primary w-full justify-center"
              >
                {item.label}
                <ArrowRight size={15} />
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost w-full justify-center"
              >
                <Calendar size={15} />
                {item.label}
              </a>
            )
          )}
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          A confirmation email has been sent to your address. Questions?{' '}
          <a href="mailto:info@clarityshiftimpactgroup.com" className="underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Contact us
          </a>
        </p>

        {!refreshed && (
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Updating your account...</p>
        )}
      </div>
    </div>
  );
}
