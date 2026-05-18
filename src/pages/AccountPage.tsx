import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building, Phone, Save, LogOut, Shield, CheckCircle, Download, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';
import { FunderReadyBadge } from '../components/GlassPanelComponents';

const BRAND = { teal: '#1C7486', black: '#0A0A0A', gold: '#D4A843', white: '#FFFFFF' };

const FOCUS_AREAS = [
  'Youth Development', 'Education', 'Health and Wellness', 'Housing', 'Food Security',
  'Environmental Justice', 'Economic Development', 'Arts and Culture', 'Veterans Services',
  'Mental Health', 'Criminal Justice Reform', 'Immigrant Services', 'Senior Services', 'Other',
];

const BUDGET_RANGES = ['Under $100K', '$100K to $500K', '$500K to $1M', '$1M to $5M', 'Over $5M'];

type Tab = 'account' | 'profile' | 'funder_ready';

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
};

export default function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('account');
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    organization_name: profile?.organization_name || '',
    phone: profile?.phone || '',
    bio: profile?.bio || '',
  });
  const [profileForm, setProfileForm] = useState({
    mission_statement: profile?.mission_statement || '',
    focus_area: profile?.focus_area || '',
    geographic_location: profile?.geographic_location || '',
    population_served: profile?.population_served || '',
    annual_budget_range: profile?.annual_budget_range || '',
    current_programs: profile?.current_programs || '',
    funding_needs: profile?.funding_needs || '',
    profile_visibility: (profile?.profile_visibility as string) || 'private',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user || !profile) {
    navigate('/login');
    return null;
  }

  const funderReady = profile.funder_ready_approved;
  const funderScore = profile.funder_ready_score || 0;
  const qualifies = funderScore >= 120;

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: form.full_name,
      organization_name: form.organization_name,
      phone: form.phone,
      bio: form.bio,
      updated_at: new Date().toISOString(),
    }).eq('id', user!.id);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('profiles').update({
      ...profileForm,
      updated_at: new Date().toISOString(),
    }).eq('id', user!.id);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const TIER_LABELS: Record<string, string> = {
    free: 'Free',
    founding_member: 'Founding Member',
    premium: 'Premium',
    white_glove: 'White Glove Engagement',
  };

  const visibilityOptions = [
    { value: 'public', label: 'Public', icon: Eye, desc: 'Visible in the Funder Ready directory' },
    { value: 'members_only', label: 'Members Only', icon: Lock, desc: 'Visible to registered members only' },
    { value: 'private', label: 'Private', icon: EyeOff, desc: 'Only visible to you and admins' },
  ];

  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all';

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <AnimatedSection direction="up">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: BRAND.teal }}>
              {profile.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{profile.full_name || 'My Account'}</h1>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{profile.email}</div>
            </div>
            {funderReady && (
              <div className="ml-auto">
                <FunderReadyBadge size="md" />
              </div>
            )}
          </div>
        </AnimatedSection>

        {/* Membership Banner */}
        <AnimatedSection direction="up" delay={40}>
          <div className="card-premium p-5 mb-6 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Current Plan</div>
              <div className="text-lg font-bold" style={{ color: BRAND.teal }}>
                {TIER_LABELS[profile.membership_tier] || 'Free'}
              </div>
            </div>
            {profile.membership_tier === 'free' && (
              <button
                onClick={() => navigate('/pricing')}
                className="btn-primary text-sm"
              >
                Upgrade
              </button>
            )}
          </div>
        </AnimatedSection>

        {/* Tabs */}
        <AnimatedSection direction="up" delay={60}>
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { id: 'account' as Tab, label: 'Account' },
              { id: 'profile' as Tab, label: 'Organization Profile' },
              { id: 'funder_ready' as Tab, label: 'Funder Ready Status' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={tab === t.id
                  ? { backgroundColor: '#1C7486', color: '#FFFFFF' }
                  : { color: 'rgba(255,255,255,0.45)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </AnimatedSection>

        {saved && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.25)', color: '#1C7486' }}>
            <CheckCircle size={14} />
            Changes saved successfully.
          </div>
        )}

        {/* Account Tab */}
        {tab === 'account' && (
          <AnimatedSection direction="up">
            <div className="card-premium p-8">
              <h2 className="font-bold text-white mb-6 text-lg">Account Information</h2>
              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <User size={12} className="inline mr-1.5" />Full Name
                  </label>
                  <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Email</label>
                  <input type="email" value={profile.email} disabled className={inputCls} style={{ ...inputStyle, opacity: 0.4, cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Building size={12} className="inline mr-1.5" />Organization Name
                  </label>
                  <input type="text" value={form.organization_name} onChange={e => setForm(p => ({ ...p, organization_name: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Phone size={12} className="inline mr-1.5" />Phone
                  </label>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>About Your Organization</label>
                  <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={4} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Brief description of your organization..." />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button type="button" onClick={handleSignOut} className="flex items-center gap-2 text-sm transition-colors" style={{ color: 'rgba(255,100,100,0.8)' }}>
                    <LogOut size={14} />
                    Sign Out
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </AnimatedSection>
        )}

        {/* Organization Profile Tab */}
        {tab === 'profile' && (
          <AnimatedSection direction="up">
            <div className="card-premium p-8">
              <h2 className="font-bold text-white mb-2 text-lg">Organization Profile</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>This information is displayed on your public profile and the Funder Ready Directory if your status is approved.</p>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Mission Statement</label>
                  <textarea value={profileForm.mission_statement} onChange={e => setProfileForm(p => ({ ...p, mission_statement: e.target.value }))} rows={3} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Describe your organization's mission..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Focus Area</label>
                    <select value={profileForm.focus_area} onChange={e => setProfileForm(p => ({ ...p, focus_area: e.target.value }))} className={`${inputCls} cursor-pointer`} style={{ ...inputStyle, appearance: 'none' as const }}>
                      <option value="" style={{ backgroundColor: '#141414' }}>Select focus area</option>
                      {FOCUS_AREAS.map(a => <option key={a} value={a} style={{ backgroundColor: '#141414' }}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Geographic Location</label>
                    <input type="text" value={profileForm.geographic_location} onChange={e => setProfileForm(p => ({ ...p, geographic_location: e.target.value }))} className={inputCls} style={inputStyle} placeholder="City, State or Region" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Population Served</label>
                    <input type="text" value={profileForm.population_served} onChange={e => setProfileForm(p => ({ ...p, population_served: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Youth ages 12-18" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Annual Budget Range</label>
                    <select value={profileForm.annual_budget_range} onChange={e => setProfileForm(p => ({ ...p, annual_budget_range: e.target.value }))} className={`${inputCls} cursor-pointer`} style={{ ...inputStyle, appearance: 'none' as const }}>
                      <option value="" style={{ backgroundColor: '#141414' }}>Select range</option>
                      {BUDGET_RANGES.map(r => <option key={r} value={r} style={{ backgroundColor: '#141414' }}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Current Programs</label>
                  <textarea value={profileForm.current_programs} onChange={e => setProfileForm(p => ({ ...p, current_programs: e.target.value }))} rows={3} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Describe your current programs and services..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Funding Needs</label>
                  <textarea value={profileForm.funding_needs} onChange={e => setProfileForm(p => ({ ...p, funding_needs: e.target.value }))} rows={3} className={`${inputCls} resize-none`} style={inputStyle} placeholder="What funding opportunities are you seeking?" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>Profile Visibility</label>
                  <div className="grid grid-cols-3 gap-3">
                    {visibilityOptions.map(opt => {
                      const Icon = opt.icon;
                      const selected = profileForm.profile_visibility === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProfileForm(p => ({ ...p, profile_visibility: opt.value }))}
                          className="p-4 rounded-xl text-left transition-all"
                          style={selected
                            ? { border: `2px solid ${BRAND.teal}`, backgroundColor: BRAND.teal + '12' }
                            : { border: '2px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }
                          }
                        >
                          <Icon size={15} className="mb-2" style={{ color: selected ? BRAND.teal : 'rgba(255,255,255,0.3)' }} />
                          <div className="font-semibold text-xs text-white">{opt.label}</div>
                          <div className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                    <Save size={14} />
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </AnimatedSection>
        )}

        {/* Funder Ready Tab */}
        {tab === 'funder_ready' && (
          <div className="space-y-5">
            {funderReady ? (
              <AnimatedSection direction="up">
                <div className="card-gold p-8 text-center">
                  <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BRAND.teal}, #0a3d4a)` }}>
                    <Shield size={36} style={{ color: BRAND.gold }} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">C-SHIFT Funder Ready Verified</h2>
                  <p className="text-sm leading-relaxed mb-6 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Your organization has completed the C-SHIFT framework and earned Funder Ready Verified status. You may display this badge on your website and materials.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => { const link = document.createElement('a'); link.href = '/CSHIFTBrandLogo.png'; link.download = 'FunderReady-Badge.png'; link.click(); }}
                      className="btn-gold"
                    >
                      <Download size={15} />
                      Download Badge
                    </button>
                    <button onClick={() => navigate('/funder-ready')} className="btn-ghost">
                      <Eye size={15} />
                      View Directory Listing
                    </button>
                  </div>
                </div>
              </AnimatedSection>
            ) : (
              <AnimatedSection direction="up">
                <div className="card-premium p-8">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.teal + '18' }}>
                      <Shield size={26} style={{ color: BRAND.teal }} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white mb-2">Earn Your Funder Ready Badge</h2>
                      <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        Complete all six C-SHIFT pillars and reach a fundability score of 120 out of 150 to qualify for C-SHIFT Funder Ready Verified status. Once you qualify, the C-SHIFT admin team reviews and approves your status before the badge is officially awarded.
                      </p>
                      <div className="mb-5">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Your Fundability Score</span>
                          <span className="font-bold" style={{ color: funderScore >= 120 ? BRAND.teal : BRAND.gold }}>
                            {funderScore} / 150
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min((funderScore / 150) * 100, 100)}%`,
                              backgroundColor: funderScore >= 120 ? BRAND.teal : BRAND.gold,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          <span>0</span>
                          <span style={{ color: BRAND.teal }}>120 Required</span>
                          <span>150</span>
                        </div>
                      </div>
                      {qualifies && !funderReady && (
                        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(28,116,134,0.1)', border: '1px solid rgba(28,116,134,0.2)', color: '#1C7486' }}>
                          You qualify! Your score meets the requirement. The C-SHIFT admin team is reviewing your status for approval.
                        </div>
                      )}
                      {!qualifies && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button onClick={() => navigate('/assessment')} className="btn-primary">
                            Take the Assessment
                          </button>
                          <button onClick={() => navigate('/resources')} className="btn-ghost">
                            Browse Resources
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            )}

            <AnimatedSection direction="up" delay={60}>
              <div className="card-premium p-6">
                <h3 className="font-semibold text-white mb-4">Requirements for Funder Ready Status</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Complete all 6 C-SHIFT pillar assessments', done: funderScore > 0 },
                    { label: 'Achieve a fundability score of 120 or higher out of 150', done: qualifies },
                    { label: 'Complete your organization profile', done: !!(profile.mission_statement && profile.focus_area) },
                    { label: 'Admin review and approval', done: !!funderReady },
                  ].map((req, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={req.done
                          ? { backgroundColor: BRAND.teal }
                          : { border: '2px solid rgba(255,255,255,0.15)' }
                        }
                      >
                        {req.done && <CheckCircle size={13} className="text-white" />}
                      </div>
                      <span className="text-sm" style={{ color: req.done ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)' }}>{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
        )}
      </div>
    </div>
  );
}
