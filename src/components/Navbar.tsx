import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843', white: '#FFFFFF' };

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: 'Assessment', href: '/assessment' },
    { label: 'Workshops', href: '/workshop' },
    { label: 'Resources', href: '/resources' },
    { label: 'Community', href: '/community' },
    { label: 'Events', href: '/events' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Blog', href: '/blog' },
    { label: 'Funder Ready', href: '/funder-ready' },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/');
    setUserMenuOpen(false);
  }

  const navStyle: React.CSSProperties = scrolled
    ? { background: 'rgba(13,18,19,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
    : { background: 'rgba(13,18,19,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <nav
      className="sticky top-0 z-50 transition-all duration-300"
      style={navStyle}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0">
            <img src="/CSBrandLogo2.png" alt="ClarityShift Impact Group" className="h-9 w-auto object-contain" />
            <div className="hidden sm:block">
              <div className="font-bold text-white text-sm leading-tight tracking-wide">Funding Fix</div>
              <div className="text-xs leading-tight" style={{ color: BRAND.gold }}>Powered by ClarityShift Impact Group</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map(link => {
              const active = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 relative group"
                  style={{ color: active ? BRAND.gold : 'rgba(255,255,255,0.72)' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = BRAND.gold; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.72)'; }}
                >
                  {link.label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ backgroundColor: BRAND.gold }} />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Auth Area */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', color: BRAND.white, background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND.teal }}>
                    {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block max-w-[120px] truncate text-white/80">
                    {profile?.full_name || 'Account'}
                  </span>
                  <ChevronDown size={14} className="text-white/50" style={{ transition: 'transform 0.2s ease', transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl shadow-2xl border py-1 z-50" style={{ backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.1)' }}>
                    {profile?.role === 'admin' && (
                      <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors">
                        <LayoutDashboard size={15} /> Admin Dashboard
                      </Link>
                    )}
                    {(profile?.membership_tier === 'premium' || profile?.membership_tier === 'white_glove' || profile?.role === 'client') && (
                      <Link to="/portal" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors">
                        <LayoutDashboard size={15} /> Client Portal
                      </Link>
                    )}
                    <Link to="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors">
                      <User size={15} /> My Account
                    </Link>
                    <hr className="my-1 border-white/10" />
                    <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors w-full text-left">
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="hidden sm:block text-sm font-medium px-3 py-2 rounded-md transition-colors text-white/70 hover:text-white">
                  Sign In
                </Link>
                <Link to="/assessment" className="text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-90" style={{ backgroundColor: BRAND.teal, color: BRAND.white }}>
                  Free Assessment
                </Link>
              </div>
            )}

            <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 rounded-md text-white/70 hover:text-white hover:bg-white/5">
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden border-t px-4 py-3 space-y-1" style={{ backgroundColor: '#0f0f0f', borderColor: 'rgba(255,255,255,0.06)' }}>
          {navLinks.map(link => {
            const active = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ color: active ? BRAND.gold : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(212,168,67,0.08)' : 'transparent' }}
              >
                {link.label}
              </Link>
            );
          })}
          {!user && (
            <Link to="/login" onClick={() => setIsOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-white/70">
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
