import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', organization_name: '', password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(form.email, form.password, form.full_name, form.organization_name);
    if (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } else {
      navigate('/assessment');
    }
    setLoading(false);
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    outline: 'none',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <img src="/CSBrandLogo2.png" alt="ClarityShift Impact Group" className="h-10 w-auto object-contain" />
            <div className="text-left">
              <div className="font-bold text-white text-sm">Funding Fix</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Powered by ClarityShift Impact Group</div>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Start your funding readiness journey today</p>
        </div>

        <div className="card-premium p-8">
          {/* Benefits */}
          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: 'rgba(28,116,134,0.08)', border: '1px solid rgba(28,116,134,0.15)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#1C7486' }}>Free account includes</div>
            <div className="space-y-1.5">
              {['Fundability Snapshot Assessment', 'Pillar Score Overview', 'Personalized Results Report'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <CheckCircle size={13} style={{ color: '#1C7486' }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Full Name', type: 'text', field: 'full_name', placeholder: 'Jane Smith' },
              { label: 'Organization Name', type: 'text', field: 'organization_name', placeholder: 'Your Nonprofit' },
              { label: 'Email', type: 'email', field: 'email', placeholder: 'you@yourorg.org' },
            ].map(f => (
              <div key={f.field}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.field as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all"
                  style={inputStyle}
                  placeholder={f.placeholder}
                  required
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all"
                  style={inputStyle}
                  placeholder="Min 6 characters"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Confirm Password</label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all"
                style={inputStyle}
                placeholder="Repeat password"
                required
              />
            </div>

            {error && <p className="text-sm" style={{ color: '#D4A843' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: '#1C7486' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
