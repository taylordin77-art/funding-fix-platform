import { Link } from 'react-router-dom';
import { Mail, Phone, Globe, Calendar } from 'lucide-react';

const BRAND = { teal: '#1C7486', gold: '#D4A843' };

export default function Footer() {
  const pillars = ['Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transformation'];

  return (
    <footer style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">

          {/* Brand + Contact */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <img src="/CSBrandLogo2.png" alt="Funding Fix" className="h-7 w-auto object-contain" />
            </div>
            <div className="font-extrabold text-sm leading-tight mb-0.5" style={{ color: '#0D1213' }}>Funding Fix</div>
            <div className="text-xs font-semibold mb-3" style={{ color: BRAND.gold }}>Powered by ClarityShift</div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: '#4B5563' }}>
              Your Funding Problems. Fixed. The all-in-one platform for nonprofit funding readiness.
            </p>
            <div className="space-y-1.5">
              <a href="mailto:info@clarityshiftimpactgroup.com" className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                <Mail size={12} style={{ color: BRAND.gold, flexShrink: 0 }} />
                <span className="truncate">info@clarityshiftimpactgroup.com</span>
              </a>
              <a href="tel:8883815240" className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                <Phone size={12} style={{ color: BRAND.gold }} />
                888-381-5240
              </a>
              <a href="https://cshift.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                <Globe size={12} style={{ color: BRAND.gold }} />
                cshift.org
              </a>
              <a href="https://calendly.com/taylordin77/new-meeting-1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                <Calendar size={12} style={{ color: BRAND.gold }} />
                Book a Strategy Call
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest mb-4" style={{ color: '#0D1213' }}>Platform</h4>
            <ul className="space-y-2">
              {[
                { label: 'Free Assessment', href: '/assessment' },
                { label: 'Workshops', href: '/workshop' },
                { label: 'Resource Library', href: '/resources' },
                { label: 'Community', href: '/community' },
                { label: 'Events and Programs', href: '/events' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Funder Ready Directory', href: '/funder-ready' },
              ].map(link => (
                <li key={link.href}>
                  <Link to={link.href} className="text-xs font-medium transition-colors" style={{ color: '#4B5563' }}
                    onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Framework */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest mb-4" style={{ color: '#0D1213' }}>Fundability Framework</h4>
            <ul className="space-y-2">
              {pillars.map(p => (
                <li key={p} className="text-xs font-medium" style={{ color: '#4B5563' }}>{p}</li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest mb-4" style={{ color: '#0D1213' }}>Account</h4>
            <ul className="space-y-2">
              {[
                { label: 'Sign In', href: '/login' },
                { label: 'Create Account', href: '/register' },
                { label: 'Client Portal', href: '/portal' },
                { label: 'My Profile', href: '/account' },
              ].map(link => (
                <li key={link.href}>
                  <Link to={link.href} className="text-xs font-medium transition-colors" style={{ color: '#4B5563' }}
                    onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)} onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                to="/assessment"
                className="inline-block text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90"
                style={{ backgroundColor: BRAND.teal, color: '#FFFFFF' }}
              >
                Take Free Assessment
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', backgroundColor: '#F7F6F3' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
            &copy; {new Date().getFullYear()} ClarityShift Impact Group, Inc. All rights reserved.
          </p>
          <p className="text-sm font-semibold" style={{ color: BRAND.gold }}>
            Strengthening Organizations That Strengthen Communities
          </p>
        </div>
      </div>
    </footer>
  );
}
