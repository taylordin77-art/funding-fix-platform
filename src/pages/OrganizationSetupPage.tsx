import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, ChevronRight, CheckCircle, Loader2, AlertCircle,
  Link2, Search, Star, Calendar, ArrowRight, BarChart2, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';
import type { Organization, OrganizationMember, PillarScore } from '../lib/types';
import {
  ORGANIZATION_STAGES, NONPROFIT_STATUSES, ORG_ROLE_LABELS,
} from '../lib/types';

const BRAND = { teal: '#1C7486', gold: '#D4A843', black: '#0A0A0A' };

const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-white/30 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/25';
const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
};
const selectStyle = { ...inputStyle, appearance: 'none' as const };
const labelCls = 'block text-sm font-medium mb-1.5 text-white/65';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

interface AnonAssessment {
  id: string;
  email: string;
  full_name: string;
  organization_name: string;
  total_score: number;
  max_score: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface ClaimedAssessmentResult {
  assessment: AnonAssessment;
  pillarScores: PillarScore[];
}

type PagePhase = 'create' | 'created' | 'claim';

export default function OrganizationSetupPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<PagePhase>('create');
  const [org, setOrg] = useState<Organization | null>(null);
  const [myMember, setMyMember] = useState<OrganizationMember | null>(null);

  // Org form state
  const [form, setForm] = useState({
    organization_name: '',
    legal_name: '',
    ein: '',
    mission: '',
    vision: '',
    website: '',
    cause_area: '',
    primary_population: '',
    service_area: '',
    city: '',
    state: '',
    annual_budget: '',
    annual_revenue: '',
    staff_count: '',
    board_member_count: '',
    organization_stage: '',
    nonprofit_status: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Claim state
  const [anonAssessments, setAnonAssessments] = useState<AnonAssessment[]>([]);
  const [loadingAnon, setLoadingAnon] = useState(false);
  const [manualId, setManualId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimed, setClaimed] = useState<ClaimedAssessmentResult | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?next=/organization/setup');
    }
  }, [authLoading, user, navigate]);

  // Check if user already has an org
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .eq('membership_status', 'active')
        .limit(1)
        .maybeSingle();

      if (memberRows) {
        const orgData = (memberRows as { organizations: Organization } & OrganizationMember).organizations;
        setOrg(orgData);
        setMyMember(memberRows as OrganizationMember);
        setPhase('created');
      }
    })();
  }, [user]);

  // Load anonymous assessments when entering claim phase
  useEffect(() => {
    if (phase !== 'claim' || !profile || !org) return;
    setLoadingAnon(true);
    (async () => {
      const { data } = await supabase
        .from('assessments')
        .select('id,email,full_name,organization_name,total_score,max_score,status,created_at,completed_at')
        .is('user_id', null)
        .is('organization_id', null)
        .ilike('email', profile.email)
        .order('created_at', { ascending: false });
      setAnonAssessments((data as AnonAssessment[]) || []);
      setLoadingAnon(false);
    })();
  }, [phase, profile, org]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.black }}>
        <Loader2 size={28} className="animate-spin" style={{ color: BRAND.teal }} />
      </div>
    );
  }

  if (!user || !profile) return null;

  // ── Create org ──────────────────────────────────────────────────────
  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const { data, error } = await supabase.rpc('create_user_organization', {
        p_organization_name:   form.organization_name,
        p_legal_name:          form.legal_name   || null,
        p_ein:                 form.ein          || null,
        p_mission:             form.mission      || null,
        p_vision:              form.vision       || null,
        p_website:             form.website      || null,
        p_cause_area:          form.cause_area   || null,
        p_primary_population:  form.primary_population || null,
        p_service_area:        form.service_area || null,
        p_city:                form.city         || null,
        p_state:               form.state        || null,
        p_annual_budget:       form.annual_budget   ? parseFloat(form.annual_budget)   : null,
        p_annual_revenue:      form.annual_revenue  ? parseFloat(form.annual_revenue)  : null,
        p_staff_count:         form.staff_count      ? parseInt(form.staff_count)       : null,
        p_board_member_count:  form.board_member_count ? parseInt(form.board_member_count) : null,
        p_organization_stage:  form.organization_stage  || null,
        p_nonprofit_status:    form.nonprofit_status    || null,
      });
      if (error) {
        setCreateError(error.message.replace(/^.*P\d{4}: /, ''));
        return;
      }
      setOrg(data as Organization);
      // Fetch the member record the trigger just created
      const { data: memData } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', (data as Organization).id)
        .eq('user_id', user.id)
        .maybeSingle();
      setMyMember(memData as OrganizationMember);
      setPhase('created');
    } finally {
      setCreating(false);
    }
  }

  // ── Claim assessment ────────────────────────────────────────────────
  async function handleClaim() {
    if (!org) return;
    const targetId = selectedAssessmentId || manualId.trim();
    if (!targetId) {
      setClaimError('Please select or enter an assessment ID.');
      return;
    }
    setClaiming(true);
    setClaimError('');
    try {
      const { data, error } = await supabase.rpc('claim_anonymous_assessment', {
        p_assessment_id:   targetId,
        p_organization_id: org.id,
      });
      if (error) {
        setClaimError(error.message.replace(/^.*P\d{4}: /, ''));
        return;
      }
      const claimedAssessment = data as AnonAssessment;
      // Fetch pillar scores that were just created
      const { data: scores } = await supabase
        .from('pillar_scores')
        .select('*')
        .eq('assessment_id', claimedAssessment.id)
        .order('pillar_name');
      setClaimed({ assessment: claimedAssessment, pillarScores: (scores as PillarScore[]) || [] });
      // Remove from the anonymous list
      setAnonAssessments(prev => prev.filter(a => a.id !== claimedAssessment.id));
      setSelectedAssessmentId('');
      setManualId('');
    } finally {
      setClaiming(false);
    }
  }

  // ── Pillar colour helper ─────────────────────────────────────────────
  function ratingColor(rating: string) {
    if (rating === 'Strong') return BRAND.teal;
    if (rating === 'Developing') return '#59A2B3';
    if (rating === 'Needs Attention') return BRAND.gold;
    return '#E57373';
  }

  const PILLAR_ORDER = ['Clarity','Structure','Health','Impact','Funding','Transformation'];

  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: BRAND.black, backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(28,116,134,0.08) 0%, transparent 70%)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <AnimatedSection direction="up">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: BRAND.teal + '20', border: `1px solid ${BRAND.teal}30` }}>
              <Building2 size={22} style={{ color: BRAND.teal }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Organization Setup</h1>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Register your nonprofit and connect your fundability assessment
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* Breadcrumb stepper */}
        <AnimatedSection direction="up" delay={40}>
          <div className="flex items-center gap-3 mb-8">
            {[
              { key: 'create',  label: 'Create Organization' },
              { key: 'created', label: 'Organization Created' },
              { key: 'claim',   label: 'Connect Assessment' },
            ].map((step, i, arr) => {
              const done = (phase === 'created' && step.key === 'create') || (phase === 'claim' && step.key !== 'claim');
              const active = phase === step.key;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={done
                        ? { backgroundColor: BRAND.teal, color: '#fff' }
                        : active
                          ? { backgroundColor: BRAND.teal + '20', border: `2px solid ${BRAND.teal}`, color: BRAND.teal }
                          : { border: '2px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.3)' }
                      }
                    >
                      {done ? <CheckCircle size={13} /> : i + 1}
                    </div>
                    <span className="text-xs font-medium hidden sm:inline" style={{ color: active ? '#fff' : done ? BRAND.teal : 'rgba(255,255,255,0.3)' }}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        </AnimatedSection>

        {/* ── PHASE: CREATE ── */}
        {phase === 'create' && (
          <AnimatedSection direction="up" delay={60}>
            <div className="card-premium p-8">
              <h2 className="text-lg font-bold text-white mb-1">Register Your Organization</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Only Organization Name is required. All other fields can be completed later.
              </p>

              {createError && (
                <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5 text-sm" style={{ backgroundColor: 'rgba(229,115,115,0.1)', border: '1px solid rgba(229,115,115,0.25)', color: '#E57373' }}>
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateOrg} className="space-y-5">
                {/* Required */}
                <div>
                  <label className={labelCls}>Organization Name <span style={{ color: BRAND.gold }}>*</span></label>
                  <input
                    type="text"
                    value={form.organization_name}
                    onChange={e => setForm(p => ({ ...p, organization_name: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="Your nonprofit's operating name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Legal Name</label>
                    <input type="text" value={form.legal_name} onChange={e => setForm(p => ({ ...p, legal_name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="As registered with the IRS" />
                  </div>
                  <div>
                    <label className={labelCls}>EIN (Tax ID)</label>
                    <input type="text" value={form.ein} onChange={e => setForm(p => ({ ...p, ein: e.target.value }))} className={inputCls} style={inputStyle} placeholder="XX-XXXXXXX" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Mission</label>
                  <textarea value={form.mission} onChange={e => setForm(p => ({ ...p, mission: e.target.value }))} rows={3} className={`${inputCls} resize-none`} style={inputStyle} placeholder="What is your organization's core mission?" />
                </div>

                <div>
                  <label className={labelCls}>Vision</label>
                  <textarea value={form.vision} onChange={e => setForm(p => ({ ...p, vision: e.target.value }))} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="What future does your organization work toward?" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Website</label>
                    <input type="url" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} className={inputCls} style={inputStyle} placeholder="https://" />
                  </div>
                  <div>
                    <label className={labelCls}>Cause Area</label>
                    <input type="text" value={form.cause_area} onChange={e => setForm(p => ({ ...p, cause_area: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Youth Development, Housing" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Primary Population Served</label>
                    <input type="text" value={form.primary_population} onChange={e => setForm(p => ({ ...p, primary_population: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Youth ages 12–18" />
                  </div>
                  <div>
                    <label className={labelCls}>Service Area</label>
                    <input type="text" value={form.service_area} onChange={e => setForm(p => ({ ...p, service_area: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Chicago South Side" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>City</label>
                    <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls} style={inputStyle} placeholder="City" />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={`${inputCls} cursor-pointer`} style={selectStyle}>
                      <option value="" style={{ backgroundColor: '#141414' }}>— State —</option>
                      {US_STATES.map(s => <option key={s} value={s} style={{ backgroundColor: '#141414' }}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Annual Budget ($)</label>
                    <input type="number" min="0" value={form.annual_budget} onChange={e => setForm(p => ({ ...p, annual_budget: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Annual Revenue ($)</label>
                    <input type="number" min="0" value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Staff Count</label>
                    <input type="number" min="0" value={form.staff_count} onChange={e => setForm(p => ({ ...p, staff_count: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Board Member Count</label>
                    <input type="number" min="0" value={form.board_member_count} onChange={e => setForm(p => ({ ...p, board_member_count: e.target.value }))} className={inputCls} style={inputStyle} placeholder="0" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Organization Stage</label>
                    <select value={form.organization_stage} onChange={e => setForm(p => ({ ...p, organization_stage: e.target.value }))} className={`${inputCls} cursor-pointer`} style={selectStyle}>
                      <option value="" style={{ backgroundColor: '#141414' }}>Select stage</option>
                      {ORGANIZATION_STAGES.map(s => (
                        <option key={s.value} value={s.value} style={{ backgroundColor: '#141414' }}>{s.label}</option>
                      ))}
                    </select>
                    {form.organization_stage && (
                      <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {ORGANIZATION_STAGES.find(s => s.value === form.organization_stage)?.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Nonprofit Status</label>
                    <select value={form.nonprofit_status} onChange={e => setForm(p => ({ ...p, nonprofit_status: e.target.value }))} className={`${inputCls} cursor-pointer`} style={selectStyle}>
                      <option value="" style={{ backgroundColor: '#141414' }}>Select status</option>
                      {NONPROFIT_STATUSES.map(s => (
                        <option key={s.value} value={s.value} style={{ backgroundColor: '#141414' }}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={creating || !form.organization_name.trim()} className="btn-primary disabled:opacity-50">
                    {creating ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />}
                    {creating ? 'Creating...' : 'Create Organization'}
                  </button>
                </div>
              </form>
            </div>
          </AnimatedSection>
        )}

        {/* ── PHASE: CREATED ── */}
        {phase === 'created' && org && (
          <div className="space-y-5">
            <AnimatedSection direction="up" delay={60}>
              <div className="card-premium p-8">
                {/* Success banner */}
                <div className="flex items-start gap-4 mb-6 p-4 rounded-xl" style={{ backgroundColor: BRAND.teal + '12', border: `1px solid ${BRAND.teal}25` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BRAND.teal }}>
                    <CheckCircle size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">Organization Created</h2>
                    <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      Your organization has been registered and you have been assigned as Owner.
                    </p>
                  </div>
                </div>

                {/* Org summary */}
                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Organization</div>
                      <div className="font-semibold text-white text-sm leading-tight">{org.organization_name}</div>
                    </div>
                    <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Your Role</div>
                      <div className="font-semibold text-sm" style={{ color: BRAND.teal }}>
                        {myMember ? ORG_ROLE_LABELS[myMember.organization_role] : 'Owner'}
                      </div>
                    </div>
                    {org.organization_stage && (
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Stage</div>
                        <div className="font-semibold text-white text-sm capitalize">{org.organization_stage}</div>
                      </div>
                    )}
                    {org.nonprofit_status && (
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Status</div>
                        <div className="font-semibold text-white text-sm">
                          {NONPROFIT_STATUSES.find(s => s.value === org.nonprofit_status)?.label.split(' — ')[0] || org.nonprofit_status}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setPhase('claim')}
                  className="btn-gold w-full justify-center"
                >
                  <Link2 size={15} />
                  Connect an Existing Assessment
                </button>
              </div>
            </AnimatedSection>

            {/* Claimed assessment result */}
            {claimed && (
              <AnimatedSection direction="up" delay={80}>
                <div className="card-premium p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.teal + '20' }}>
                      <CheckCircle size={16} style={{ color: BRAND.teal }} />
                    </div>
                    <h3 className="font-bold text-white">Assessment Connected</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-2xl font-bold" style={{ color: BRAND.teal }}>{claimed.assessment.total_score}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>out of {claimed.assessment.max_score}</div>
                      <div className="text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Total Score</div>
                    </div>
                    <div className="p-3 rounded-xl text-center col-span-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Organization</div>
                      <div className="font-semibold text-white text-sm leading-tight">{claimed.assessment.organization_name || org.organization_name}</div>
                      <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(claimed.assessment.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {claimed.pillarScores.length > 0 && (
                    <div className="space-y-2 mb-5">
                      <h4 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <BarChart2 size={11} className="inline mr-1.5" />Pillar Scores
                      </h4>
                      {PILLAR_ORDER.map(pillar => {
                        const ps = claimed.pillarScores.find(s => s.pillar_name === pillar);
                        if (!ps) return null;
                        const pct = ps.percentage_score * 100;
                        return (
                          <div key={pillar}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{pillar}</span>
                              <span className="font-semibold" style={{ color: ratingColor(ps.rating) }}>
                                {ps.raw_score}/{ps.maximum_score} — {ps.rating}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: ratingColor(ps.rating) }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Link
                    to={`/results/${claimed.assessment.id}`}
                    className="btn-primary w-full justify-center"
                  >
                    <ArrowRight size={15} />
                    View Full Results
                  </Link>
                </div>
              </AnimatedSection>
            )}
          </div>
        )}

        {/* ── PHASE: CLAIM ── */}
        {phase === 'claim' && org && (
          <AnimatedSection direction="up" delay={60}>
            <div className="space-y-5">
              {/* Org context pill */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: BRAND.teal + '10', border: `1px solid ${BRAND.teal}20` }}>
                <Building2 size={14} style={{ color: BRAND.teal }} />
                <span className="text-sm font-medium text-white">Connecting to:</span>
                <span className="text-sm font-bold" style={{ color: BRAND.teal }}>{org.organization_name}</span>
              </div>

              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-5">
                  <Link2 size={18} style={{ color: BRAND.teal }} />
                  <h2 className="text-lg font-bold text-white">Connect an Existing Assessment</h2>
                </div>

                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Select a previously completed assessment or enter its ID directly. Only assessments submitted with your email address (<span className="font-medium text-white">{profile.email}</span>) can be connected.
                </p>

                {claimError && (
                  <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5 text-sm" style={{ backgroundColor: 'rgba(229,115,115,0.1)', border: '1px solid rgba(229,115,115,0.25)', color: '#E57373' }}>
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{claimError}</span>
                  </div>
                )}

                {/* Available assessments */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Search size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                      Assessments Matching Your Email
                    </h3>
                    {loadingAnon && <Loader2 size={14} className="animate-spin" style={{ color: BRAND.teal }} />}
                  </div>

                  {!loadingAnon && anonAssessments.length === 0 && (
                    <div className="p-4 rounded-xl text-sm text-center" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                      No unconnected assessments found for {profile.email}
                    </div>
                  )}

                  <div className="space-y-2">
                    {anonAssessments.map(a => {
                      const pct = Math.round((a.total_score / a.max_score) * 100);
                      const isSelected = selectedAssessmentId === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAssessmentId(isSelected ? '' : a.id)}
                          className="w-full text-left p-4 rounded-xl transition-all"
                          style={isSelected
                            ? { backgroundColor: BRAND.teal + '15', border: `2px solid ${BRAND.teal}` }
                            : { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
                          }
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Star size={13} style={{ color: isSelected ? BRAND.teal : 'rgba(255,255,255,0.25)' }} />
                              <span className="text-sm font-semibold text-white">{a.organization_name || '(No org name)'}</span>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: a.status === 'completed' ? BRAND.teal + '20' : 'rgba(255,255,255,0.05)', color: a.status === 'completed' ? BRAND.teal : 'rgba(255,255,255,0.4)' }}>
                              {a.status === 'completed' ? 'Completed' : 'In Progress'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(a.created_at).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <BarChart2 size={11} />
                              Score: <span className="font-semibold ml-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{a.total_score}/{a.max_score} ({pct}%)</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Manual ID entry */}
                <div className="mb-6">
                  <label className={labelCls}>Or Enter Assessment ID Manually</label>
                  <input
                    type="text"
                    value={manualId}
                    onChange={e => { setManualId(e.target.value); setSelectedAssessmentId(''); }}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClaim}
                    disabled={claiming || (!selectedAssessmentId && !manualId.trim())}
                    className="btn-gold flex-1 justify-center disabled:opacity-50"
                  >
                    {claiming ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                    {claiming ? 'Connecting...' : 'Connect Assessment to Organization'}
                  </button>
                  <button
                    onClick={() => { setPhase('created'); setClaimError(''); }}
                    className="btn-ghost"
                  >
                    Back
                  </button>
                </div>
              </div>

              {/* Claimed result in claim phase */}
              {claimed && (
                <div className="card-premium p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle size={18} style={{ color: BRAND.teal }} />
                    <h3 className="font-bold text-white">Assessment Connected Successfully</h3>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: BRAND.teal }}>{claimed.assessment.total_score}</div>
                      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>/ {claimed.assessment.max_score}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{claimed.assessment.organization_name || org.organization_name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(claimed.assessment.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Link to={`/results/${claimed.assessment.id}`} className="ml-auto btn-primary text-sm py-1.5">
                      <ArrowRight size={14} />
                      View Results
                    </Link>
                  </div>
                  {claimed.pillarScores.length > 0 && (
                    <div className="space-y-1.5">
                      {PILLAR_ORDER.map(pillar => {
                        const ps = claimed.pillarScores.find(s => s.pillar_name === pillar);
                        if (!ps) return null;
                        return (
                          <div key={pillar} className="flex items-center gap-3">
                            <span className="text-xs w-28 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }}>{pillar}</span>
                            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                              <div className="h-full rounded-full" style={{ width: `${ps.percentage_score * 100}%`, backgroundColor: ratingColor(ps.rating) }} />
                            </div>
                            <span className="text-xs font-semibold w-16 text-right" style={{ color: ratingColor(ps.rating) }}>{ps.raw_score}/25</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => { setClaimed(null); setPhase('created'); }}
                    className="mt-4 text-xs flex items-center gap-1.5 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = BRAND.teal)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                  >
                    <RefreshCw size={11} />
                    Connect another assessment
                  </button>
                </div>
              )}
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
