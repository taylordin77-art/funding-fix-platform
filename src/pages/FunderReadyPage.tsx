import { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Users, DollarSign, CheckCircle, ArrowRight, Shield, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, FunderAccessRequest } from '../lib/types';
import { AnimatedSection } from '../components/AnimatedSection';
import { FunderReadyBadge } from '../components/GlassPanelComponents';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843' };

const FOCUS_AREAS = [
  'Youth Development', 'Education', 'Health and Wellness', 'Housing', 'Food Security',
  'Environmental Justice', 'Economic Development', 'Arts and Culture', 'Veterans Services',
  'Mental Health', 'Criminal Justice Reform', 'Immigrant Services', 'Senior Services', 'Other',
];

const BUDGET_RANGES = ['Under $100K', '$100K to $500K', '$500K to $1M', '$1M to $5M', 'Over $5M'];

type FunderForm = Omit<FunderAccessRequest, 'id' | 'status' | 'created_at'>;
const emptyFunderForm: FunderForm = { full_name: '', organization_name: '', funding_focus_areas: '', email: '' };

interface FunderReadyOrg extends Pick<Profile, 'id' | 'organization_name' | 'mission_statement' | 'focus_area' | 'geographic_location' | 'population_served' | 'annual_budget_range' | 'is_featured'> {}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
  borderRadius: '12px',
};

const lightInputStyle = {
  background: 'rgba(0,0,0,0.04)',
  border: '1px solid rgba(0,0,0,0.1)',
  color: '#0D1213',
  outline: 'none',
  borderRadius: '12px',
};

export default function FunderReadyPage() {
  const [orgs, setOrgs] = useState<FunderReadyOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFocus, setFilterFocus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [showFunderForm, setShowFunderForm] = useState(false);
  const [funderForm, setFunderForm] = useState<FunderForm>(emptyFunderForm);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, organization_name, mission_statement, focus_area, geographic_location, population_served, annual_budget_range, is_featured')
        .eq('funder_ready_approved', true)
        .eq('profile_visibility', 'public')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      setOrgs((data as FunderReadyOrg[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = orgs.filter(org => {
    const q = search.toLowerCase();
    const matchSearch = !q || (org.organization_name?.toLowerCase().includes(q) || org.mission_statement?.toLowerCase().includes(q) || org.focus_area?.toLowerCase().includes(q) || org.geographic_location?.toLowerCase().includes(q));
    const matchFocus = !filterFocus || org.focus_area === filterFocus;
    const matchLocation = !filterLocation || org.geographic_location?.toLowerCase().includes(filterLocation.toLowerCase());
    const matchBudget = !filterBudget || org.annual_budget_range === filterBudget;
    return matchSearch && matchFocus && matchLocation && matchBudget;
  });

  async function handleFunderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);
    const { error } = await supabase.from('funder_access_requests').insert(funderForm);
    if (error) {
      setFormError('Submission failed. Please try again.');
    } else {
      setFormSubmitted(true);
    }
    setFormSubmitting(false);
  }

  const hasFilters = search || filterFocus || filterLocation || filterBudget;
  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' as const };

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>

      {/* ═══ HERO — Dark + teal ═══ */}
      <section className="relative overflow-hidden section-padding" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,116,134,0.2) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="orb" style={{ width: 500, height: 500, background: 'rgba(28,116,134,0.1)', top: '-15%', left: '-5%', animationDuration: '24s' }} />
          <div className="orb" style={{ width: 350, height: 350, background: 'rgba(212,168,67,0.07)', bottom: '-10%', right: '-5%', animationDuration: '30s', animationDelay: '-8s' }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(28,116,134,0.2)', border: '1px solid rgba(28,116,134,0.3)' }}>
              <Shield size={32} style={{ color: BRAND.teal }} />
            </div>
            <p className="section-label justify-center">Verified Directory</p>
            <h1 className="heading-xl text-white mb-4">Funder Ready Organizations</h1>
            <p className="text-lg max-w-2xl mx-auto mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Every organization listed here has earned the Funder Ready Verified badge by completing the full Fundability Framework and achieving a fundability score of 120 or higher.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: BRAND.gold }}>
              <CheckCircle size={14} />
              Verified and Admin Approved
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ SEARCH + DIRECTORY — Warm White ═══ */}
      <section className="section-warm section-padding">
        <div className="max-w-6xl mx-auto px-4">
          {/* Search and Filters */}
          <AnimatedSection direction="up" className="mb-8">
            <div className="card-light p-5">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.3)' }} />
                  <input
                    type="text"
                    placeholder="Search organizations..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm placeholder:text-black/30 focus:ring-2 focus:ring-teal-500/30 transition-all"
                    style={lightInputStyle}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.3)' }} />
                    <select value={filterFocus} onChange={e => setFilterFocus(e.target.value)} className="pl-8 pr-8 py-2.5 rounded-xl text-sm cursor-pointer" style={{ ...lightInputStyle, cursor: 'pointer', appearance: 'none' as const }}>
                      <option value="">Focus Area</option>
                      {FOCUS_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.3)' }} />
                    <input type="text" placeholder="Location" value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="pl-8 pr-4 py-2.5 rounded-xl text-sm placeholder:text-black/30 w-32" style={lightInputStyle} />
                  </div>
                  <div className="relative">
                    <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.3)' }} />
                    <select value={filterBudget} onChange={e => setFilterBudget(e.target.value)} className="pl-8 pr-8 py-2.5 rounded-xl text-sm cursor-pointer" style={{ ...lightInputStyle, cursor: 'pointer', appearance: 'none' as const }}>
                      <option value="">Budget Size</option>
                      {BUDGET_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {hasFilters && (
                    <button onClick={() => { setSearch(''); setFilterFocus(''); setFilterLocation(''); setFilterBudget(''); }} className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm transition-all" style={{ border: '1px solid rgba(0,0,0,0.1)', color: '#4B5563' }}>
                      <X size={13} /> Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 text-xs" style={{ color: '#6B7280' }}>
                {loading ? 'Loading...' : `${filtered.length} verified organization${filtered.length !== 1 ? 's' : ''} found`}
              </div>
            </div>
          </AnimatedSection>

          {/* Directory Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="card-light p-6 animate-pulse">
                  <div className="h-4 rounded w-2/3 mb-3" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
                  <div className="h-3 rounded w-full mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
                  <div className="h-3 rounded w-4/5" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Shield size={48} className="mx-auto mb-4" style={{ color: 'rgba(0,0,0,0.1)' }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#9CA3AF' }}>No organizations found</h3>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((org, idx) => (
                <AnimatedSection key={org.id} direction="up" delay={idx * 40}>
                  <div className="card-light p-6 flex flex-col h-full" style={org.is_featured ? { borderColor: BRAND.gold + '50', boxShadow: `0 0 20px ${BRAND.gold}10` } : {}}>
                    {org.is_featured && (
                      <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: BRAND.gold }}>
                        <Shield size={11} /> Featured
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-base mb-2" style={{ color: '#0D1213' }}>{org.organization_name || 'Organization'}</h3>
                      {org.mission_statement && (
                        <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: '#4B5563' }}>{org.mission_statement}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {org.focus_area && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: BRAND.teal + '12', color: BRAND.teal }}>
                            {org.focus_area}
                          </span>
                        )}
                        {org.geographic_location && (
                          <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: '#6B7280' }}>
                            <MapPin size={10} /> {org.geographic_location}
                          </span>
                        )}
                        {org.population_served && (
                          <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: '#6B7280' }}>
                            <Users size={10} /> {org.population_served}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                      <FunderReadyBadge size="sm" />
                      {org.annual_budget_range && (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>{org.annual_budget_range}</span>
                      )}
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ FUNDER CTA — Solid Teal ═══ */}
      <section className="section-teal section-padding relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Shield size={24} className="text-white" />
            </div>
            <h2 className="heading-xl text-white mb-4">Looking for Mission-Driven Organizations to Fund?</h2>
            <p className="text-lg leading-relaxed max-w-2xl mx-auto mb-8" style={{ color: 'rgba(255,255,255,0.78)' }}>
              Are you a foundation, corporate partner, or individual donor looking for mission-driven organizations to fund, sponsor, or partner with? Connect with our verified Funder Ready organizations.
            </p>
            <button onClick={() => setShowFunderForm(true)} className="btn-gold">
              Request Funder Access <ArrowRight size={18} />
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* Funder Access Modal */}
      {showFunderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl max-w-md w-full p-8" style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}>
            {formSubmitted ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}>
                  <CheckCircle size={28} style={{ color: BRAND.teal }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Request Received!</h3>
                <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Thank you for your interest. Our team will be in touch within 2 business days.</p>
                <button onClick={() => { setShowFunderForm(false); setFormSubmitted(false); setFunderForm(emptyFunderForm); }} className="btn-primary">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Request Funder Access</h3>
                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Connect with verified Funder Ready organizations.</p>
                  </div>
                  <button onClick={() => setShowFunderForm(false)} className="text-2xl font-light leading-none" style={{ color: 'rgba(255,255,255,0.4)' }}>&times;</button>
                </div>
                <form onSubmit={handleFunderSubmit} className="space-y-3">
                  <input type="text" placeholder="Your Full Name *" required value={funderForm.full_name} onChange={e => setFunderForm(p => ({ ...p, full_name: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 outline-none" style={inputStyle} />
                  <input type="text" placeholder="Organization or Foundation Name *" required value={funderForm.organization_name} onChange={e => setFunderForm(p => ({ ...p, organization_name: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} />
                  <input type="email" placeholder="Email Address *" required value={funderForm.email} onChange={e => setFunderForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} />
                  <textarea placeholder="Funding focus areas (e.g. education, youth development, housing) *" required value={funderForm.funding_focus_areas} onChange={e => setFunderForm(p => ({ ...p, funding_focus_areas: e.target.value }))} rows={3} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none resize-none" style={inputStyle} />
                  {formError && <p className="text-xs" style={{ color: BRAND.gold }}>{formError}</p>}
                  <button type="submit" disabled={formSubmitting} className="btn-primary w-full justify-center disabled:opacity-60">
                    {formSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Your request is reviewed by the team within 2 business days.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
