import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Building2, FileText, Globe, MapPin, Users, DollarSign, Info, ClipboardList, CheckCircle2, Link2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AnimatedSection } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', gold: '#D4A843' };

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
};

const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all';

const labelCls = 'block text-sm font-medium mb-1.5';
const labelStyle = { color: 'rgba(255,255,255,0.65)' };

const STAGE_OPTIONS = [
  { value: '', label: 'Select stage' },
  { value: 'startup', label: 'Startup' },
  { value: 'emerging', label: 'Emerging' },
  { value: 'developing', label: 'Developing' },
  { value: 'established', label: 'Established' },
  { value: 'scaling', label: 'Scaling' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Select status' },
  { value: 'planning', label: 'Planning' },
  { value: 'incorporated', label: 'Incorporated' },
  { value: 'exemption_pending', label: 'Exemption Pending' },
  { value: 'tax_exempt', label: 'Tax Exempt' },
  { value: 'fiscally_sponsored', label: 'Fiscally Sponsored' },
  { value: 'other', label: 'Other' },
];

interface FormState {
  organization_name: string;
  legal_name: string;
  ein: string;
  mission: string;
  vision: string;
  website: string;
  cause_area: string;
  primary_population: string;
  service_area: string;
  city: string;
  state: string;
  annual_budget: string;
  annual_revenue: string;
  staff_count: string;
  board_member_count: string;
  organization_stage: string;
  nonprofit_status: string;
}

type CreatedOrganization = {
  id: string;
  organization_name: string;
  owner_user_id?: string | null;
  created_at?: string | null;
};

type EligibleAssessment = {
  id: string;
  organization_name: string | null;
  total_score: number | null;
  status: string | null;
  created_at: string;
  email: string | null;
};

type ClaimedAssessment = {
  id: string;
  total_score: number | null;
  status: string | null;
  organization_id: string;
  user_id: string;
};

const INITIAL_FORM: FormState = {
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
};

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}
      >
        <Icon size={15} style={{ color: BRAND.teal }} />
      </div>
      <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
    </div>
  );
}

export default function OrganizationSetupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrganizationName, setCreatedOrganizationName] = useState('');
  const [createdOrganizationId, setCreatedOrganizationId] = useState('');
  const [stubMessage, setStubMessage] = useState(false);
  const [eligibleAssessments, setEligibleAssessments] = useState<EligibleAssessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assessmentLoadError, setAssessmentLoadError] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [claimingAssessment, setClaimingAssessment] = useState(false);
  const [assessmentClaimError, setAssessmentClaimError] = useState('');
  const [claimedAssessmentId, setClaimedAssessmentId] = useState('');
  const [claimedAssessmentScore, setClaimedAssessmentScore] = useState<number | null>(null);
  const [claimedAssessmentStatus, setClaimedAssessmentStatus] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${BRAND.teal} transparent transparent transparent` }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function toText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  function toNumber(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  function toSelect(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  async function loadEligibleAssessments() {
    const rawEmail = (user?.email ?? '').trim().toLowerCase();
    if (rawEmail === '') {
      setAssessmentLoadError('We could not verify the email address for your account.');
      setEligibleAssessments([]);
      setSelectedAssessmentId('');
      setLoadingAssessments(false);
      return;
    }

    setLoadingAssessments(true);
    setAssessmentLoadError('');
    setEligibleAssessments([]);
    setSelectedAssessmentId('');

    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('id, organization_name, total_score, status, created_at, email')
        .is('user_id', null)
        .is('organization_id', null)
        .ilike('email', rawEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data as EligibleAssessment[]) ?? [];
      setSelectedAssessmentId('');
      setEligibleAssessments(rows);
    } catch (err) {
      console.error('loadEligibleAssessments failed:', err);
      setAssessmentLoadError('We could not load your eligible assessments. Please try again.');
      setEligibleAssessments([]);
      setSelectedAssessmentId('');
    } finally {
      setLoadingAssessments(false);
    }
  }

  async function handleClaimAssessment() {
    setAssessmentClaimError('');
    if (claimingAssessment) return;
    if (!selectedAssessmentId) {
      setAssessmentClaimError('Select an assessment before continuing.');
      return;
    }
    if (!createdOrganizationId) {
      setAssessmentClaimError('We could not identify the organization. Please refresh the page and try again.');
      return;
    }
    setClaimingAssessment(true);
    try {
      const { data, error } = await supabase.rpc('claim_anonymous_assessment', {
        p_assessment_id: selectedAssessmentId,
        p_organization_id: createdOrganizationId,
      });
      if (error) throw error;
      const claimed = data as ClaimedAssessment | null;
      if (!claimed || !claimed.id || !claimed.organization_id || !claimed.user_id) {
        console.error('claim_anonymous_assessment returned invalid data:', data);
        throw new Error('Assessment claim returned no valid row.');
      }
      setClaimedAssessmentId(claimed.id);
      setClaimedAssessmentScore(claimed.total_score);
      setClaimedAssessmentStatus(claimed.status ?? 'Unknown');
      setAssessmentClaimError('');
    } catch (err) {
      console.error('claim_anonymous_assessment failed:', err);
      const code = (err as { code?: string } | null)?.code;
      let message = 'We could not connect the assessment. Please try again.';
      if (code === 'P0009') {
        message = 'This assessment has already been connected to an organization.';
      } else if (code === 'P0010') {
        message = 'This assessment was completed with a different email address.';
      } else if (code === 'P0007') {
        message = 'You do not have permission to connect assessments to this organization.';
      }
      setAssessmentClaimError(message);
    } finally {
      setClaimingAssessment(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedName = form.organization_name.trim();
    if (trimmedName === '') {
      setSubmitError('Please enter an organization name to continue.');
      return;
    }

    setSubmitError('');
    setSaving(true);

    try {
      const { data, error } = await supabase.rpc('create_user_organization', {
        p_organization_name: trimmedName,
        p_legal_name: toText(form.legal_name),
        p_ein: toText(form.ein),
        p_mission: toText(form.mission),
        p_vision: toText(form.vision),
        p_website: toText(form.website),
        p_cause_area: toText(form.cause_area),
        p_primary_population: toText(form.primary_population),
        p_service_area: toText(form.service_area),
        p_city: toText(form.city),
        p_state: toText(form.state),
        p_annual_budget: toNumber(form.annual_budget),
        p_annual_revenue: toNumber(form.annual_revenue),
        p_staff_count: toNumber(form.staff_count),
        p_board_member_count: toNumber(form.board_member_count),
        p_organization_stage: toSelect(form.organization_stage),
        p_nonprofit_status: toSelect(form.nonprofit_status),
      });

      if (error) throw error;

      const org = data as CreatedOrganization | null;
      if (!org || !org.id || !org.organization_name) {
        console.error('create_user_organization returned invalid data:', data);
        throw new Error('Organization creation returned no valid row.');
      }
      setCreatedOrganizationId(org.id);
      setCreatedOrganizationName(org.organization_name);
      setStubMessage(true);
      loadEligibleAssessments();
    } catch (err) {
      console.error('create_user_organization failed:', err);
      const code = (err as { code?: string } | null)?.code;
      setSubmitError(
        code === 'P0005'
          ? 'An organization with this name and EIN already exists in your account.'
          : 'We could not create your organization. Please review the information and try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  const canClaim =
    selectedAssessmentId !== '' &&
    createdOrganizationId !== '' &&
    !claimingAssessment &&
    claimedAssessmentId === '';

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <AnimatedSection direction="up">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(28,116,134,0.18)' }}
              >
                <Building2 size={22} style={{ color: BRAND.teal }} />
              </div>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: BRAND.teal }}
                >
                  Organization Setup
                </div>
                <h1 className="text-2xl font-bold text-white leading-tight">
                  Set Up Your Organization
                </h1>
              </div>
            </div>
            <p className="text-sm leading-relaxed ml-15" style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '60px' }}>
              Create the organization profile that will power your C-SHIFT assessment results, action plan, evidence tracking, and progress history.
            </p>
          </div>
        </AnimatedSection>

        {/* Main form */}
        <AnimatedSection direction="up" delay={40}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="card-premium p-8 mb-6 space-y-8">

              {/* ── Identity ── */}
              <div>
                <SectionHeading icon={Building2} label="Organization Identity" />
                <div className="space-y-4">
                  <div>
                    <label htmlFor="org-name" className={labelCls} style={labelStyle}>
                      Organization Name
                      <span className="ml-1" style={{ color: BRAND.gold }} aria-hidden="true">*</span>
                    </label>
                    <input
                      id="org-name"
                      type="text"
                      value={form.organization_name}
                      onChange={set('organization_name')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="Your nonprofit's operating name"
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="legal-name" className={labelCls} style={labelStyle}>
                        Legal Name
                      </label>
                      <input
                        id="legal-name"
                        type="text"
                        value={form.legal_name}
                        onChange={set('legal_name')}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="Registered legal name"
                      />
                    </div>
                    <div>
                      <label htmlFor="ein" className={labelCls} style={labelStyle}>
                        EIN
                      </label>
                      <input
                        id="ein"
                        type="text"
                        value={form.ein}
                        onChange={set('ein')}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="XX-XXXXXXX"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="org-stage" className={labelCls} style={labelStyle}>
                        Organization Stage
                      </label>
                      <select
                        id="org-stage"
                        value={form.organization_stage}
                        onChange={set('organization_stage')}
                        className={`${inputCls} cursor-pointer`}
                        style={{ ...inputStyle, appearance: 'none' as const }}
                      >
                        {STAGE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value} style={{ backgroundColor: '#141414' }}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="nonprofit-status" className={labelCls} style={labelStyle}>
                        Nonprofit Status
                      </label>
                      <select
                        id="nonprofit-status"
                        value={form.nonprofit_status}
                        onChange={set('nonprofit_status')}
                        className={`${inputCls} cursor-pointer`}
                        style={{ ...inputStyle, appearance: 'none' as const }}
                      >
                        {STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value} style={{ backgroundColor: '#141414' }}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Mission & Vision ── */}
              <div>
                <SectionHeading icon={FileText} label="Mission & Vision" />
                <div className="space-y-4">
                  <div>
                    <label htmlFor="mission" className={labelCls} style={labelStyle}>
                      Mission
                    </label>
                    <textarea
                      id="mission"
                      value={form.mission}
                      onChange={set('mission')}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      placeholder="What is your organization's purpose?"
                    />
                  </div>
                  <div>
                    <label htmlFor="vision" className={labelCls} style={labelStyle}>
                      Vision
                    </label>
                    <textarea
                      id="vision"
                      value={form.vision}
                      onChange={set('vision')}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      placeholder="What future does your organization seek to create?"
                    />
                  </div>
                </div>
              </div>

              {/* ── Web & Location ── */}
              <div>
                <SectionHeading icon={Globe} label="Web & Location" />
                <div className="space-y-4">
                  <div>
                    <label htmlFor="website" className={labelCls} style={labelStyle}>
                      Website
                    </label>
                    <input
                      id="website"
                      type="url"
                      value={form.website}
                      onChange={set('website')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="https://yourorg.org"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="city" className={labelCls} style={labelStyle}>
                        City
                      </label>
                      <input
                        id="city"
                        type="text"
                        value={form.city}
                        onChange={set('city')}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className={labelCls} style={labelStyle}>
                        State
                      </label>
                      <input
                        id="state"
                        type="text"
                        value={form.state}
                        onChange={set('state')}
                        className={inputCls}
                        style={inputStyle}
                        placeholder="State"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="service-area" className={labelCls} style={labelStyle}>
                      Service Area
                    </label>
                    <input
                      id="service-area"
                      type="text"
                      value={form.service_area}
                      onChange={set('service_area')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="Geographic area where you deliver services"
                    />
                  </div>
                </div>
              </div>

              {/* ── Population & Cause ── */}
              <div>
                <SectionHeading icon={MapPin} label="Cause & Population" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cause-area" className={labelCls} style={labelStyle}>
                      Cause Area
                    </label>
                    <input
                      id="cause-area"
                      type="text"
                      value={form.cause_area}
                      onChange={set('cause_area')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="e.g. Youth Development"
                    />
                  </div>
                  <div>
                    <label htmlFor="primary-population" className={labelCls} style={labelStyle}>
                      Primary Population
                    </label>
                    <input
                      id="primary-population"
                      type="text"
                      value={form.primary_population}
                      onChange={set('primary_population')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="Who you primarily serve"
                    />
                  </div>
                </div>
              </div>

              {/* ── Capacity ── */}
              <div>
                <SectionHeading icon={Users} label="Organizational Capacity" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="staff-count" className={labelCls} style={labelStyle}>
                      Staff Count
                    </label>
                    <input
                      id="staff-count"
                      type="number"
                      min="0"
                      value={form.staff_count}
                      onChange={set('staff_count')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="board-member-count" className={labelCls} style={labelStyle}>
                      Board Member Count
                    </label>
                    <input
                      id="board-member-count"
                      type="number"
                      min="0"
                      value={form.board_member_count}
                      onChange={set('board_member_count')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* ── Financials ── */}
              <div>
                <SectionHeading icon={DollarSign} label="Financials" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="annual-budget" className={labelCls} style={labelStyle}>
                      Annual Budget
                    </label>
                    <input
                      id="annual-budget"
                      type="number"
                      min="0"
                      value={form.annual_budget}
                      onChange={set('annual_budget')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="annual-revenue" className={labelCls} style={labelStyle}>
                      Annual Revenue
                    </label>
                    <input
                      id="annual-revenue"
                      type="number"
                      min="0"
                      value={form.annual_revenue}
                      onChange={set('annual_revenue')}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Required field note */}
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span style={{ color: BRAND.gold }}>*</span> Required field
            </p>

            {/* Success message */}
            {stubMessage && createdOrganizationName && (
              <div
                className="rounded-xl px-4 py-3 mb-5 text-sm flex items-start gap-2.5"
                style={{
                  backgroundColor: 'rgba(28,116,134,0.1)',
                  border: '1px solid rgba(28,116,134,0.25)',
                  color: BRAND.teal,
                }}
                role="status"
              >
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Organization Created</div>
                  <div className="mt-0.5 text-white/80">{createdOrganizationName}</div>
                  <div className="mt-0.5">Your organization role: Owner</div>
                </div>
              </div>
            )}

            {/* Inline error */}
            {submitError && (
              <div
                className="rounded-xl px-4 py-3 mb-5 text-sm flex items-start gap-2.5"
                style={{
                  backgroundColor: 'rgba(212,168,67,0.08)',
                  border: '1px solid rgba(212,168,67,0.25)',
                  color: BRAND.gold,
                }}
                role="alert"
              >
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                aria-busy={saving}
              >
                <Building2 size={15} />
                {saving ? 'Creating Organization...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </AnimatedSection>

        {/* Assessment claim section */}
        <AnimatedSection direction="up" delay={80}>
          <div className="card-premium p-7 mt-8">
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.2)' }}
              >
                <FileText size={17} style={{ color: BRAND.gold }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white mb-2">
                  Already Completed an Assessment?
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  After your organization is created, you will be able to connect an eligible assessment completed with the same email address.
                </p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Eligible assessments (only after organization creation succeeds) */}
        {stubMessage && createdOrganizationId && (
          <AnimatedSection direction="up" delay={100}>
            <div className="card-premium p-7 mt-6">
              <div className="flex items-start gap-4 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: 'rgba(28,116,134,0.14)', border: '1px solid rgba(28,116,134,0.22)' }}
                >
                  <ClipboardList size={17} style={{ color: BRAND.teal }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white mb-1">
                    Eligible Assessments
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Assessments completed with your email address that are not yet connected to an organization.
                  </p>
                </div>
              </div>

              {loadingAssessments && (
                <div
                  className="rounded-xl px-4 py-3 text-sm flex items-center gap-2.5"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.65)',
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${BRAND.teal} transparent transparent transparent` }} />
                  Checking for eligible assessments...
                </div>
              )}

              {!loadingAssessments && assessmentLoadError && (
                <div
                  className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5"
                  style={{
                    backgroundColor: 'rgba(212,168,67,0.08)',
                    border: '1px solid rgba(212,168,67,0.25)',
                    color: BRAND.gold,
                  }}
                  role="alert"
                >
                  <Info size={15} className="flex-shrink-0 mt-0.5" />
                  {assessmentLoadError}
                </div>
              )}

              {!loadingAssessments && !assessmentLoadError && eligibleAssessments.length === 0 && (
                <div className="rounded-xl p-5 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    No eligible assessments were found for your email address.
                  </p>
                  <Link
                    to="/assessment"
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <FileText size={15} />
                    Complete a New Assessment
                  </Link>
                </div>
              )}

              {!loadingAssessments && !assessmentLoadError && eligibleAssessments.length > 0 && !claimedAssessmentId && (
                <fieldset className="space-y-3 m-0 p-0 border-0">
                  <legend className="sr-only">Select an eligible assessment to connect</legend>
                  {eligibleAssessments.map(a => {
                    const selected = selectedAssessmentId === a.id;
                    const inputId = `eligible-assessment-${a.id}`;
                    return (
                      <label
                        key={a.id}
                        htmlFor={inputId}
                        className="block rounded-xl p-4 cursor-pointer transition-all"
                        style={{
                          backgroundColor: selected ? 'rgba(28,116,134,0.12)' : 'rgba(255,255,255,0.03)',
                          border: selected
                            ? '1px solid rgba(28,116,134,0.6)'
                            : '1px solid rgba(255,255,255,0.08)',
                          boxShadow: selected ? '0 0 0 1px rgba(28,116,134,0.4)' : 'none',
                        }}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="eligible-assessment"
                          value={a.id}
                          checked={selected}
                          onChange={() => setSelectedAssessmentId(a.id)}
                          className="sr-only"
                          aria-describedby={`${inputId}-selected-badge`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                              aria-hidden="true"
                              style={{
                                border: selected ? '5px solid #1C7486' : '2px solid rgba(255,255,255,0.3)',
                                backgroundColor: 'transparent',
                              }}
                            />
                            <span className="text-sm font-semibold text-white truncate">
                              {a.organization_name && a.organization_name.trim() !== ''
                                ? a.organization_name
                                : 'Unnamed Organization'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {selected && (
                              <span
                                id={`${inputId}-selected-badge`}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: 'rgba(28,116,134,0.2)', color: BRAND.teal }}
                              >
                                <CheckCircle2 size={12} aria-hidden="true" />
                                Selected
                              </span>
                            )}
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                              {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Score:</span>{' '}
                            {a.total_score !== null && a.total_score !== undefined ? a.total_score : 'Not available'}
                          </div>
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Status:</span>{' '}
                            {a.status && a.status.trim() !== '' ? a.status : 'Unknown'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </fieldset>
              )}

              {!loadingAssessments && !assessmentLoadError && eligibleAssessments.length > 0 && claimedAssessmentId && (
                <div
                  className="mt-5 rounded-xl p-5"
                  style={{
                    backgroundColor: 'rgba(28,116,134,0.1)',
                    border: '1px solid rgba(28,116,134,0.3)',
                  }}
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={18} style={{ color: BRAND.teal }} />
                    <h3 className="text-base font-bold text-white">Assessment Connected</h3>
                  </div>
                  <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Your assessment is now connected to {createdOrganizationName}.
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total Score:</span>{' '}
                      {claimedAssessmentScore !== null && claimedAssessmentScore !== undefined ? claimedAssessmentScore : 'Not available'}
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Status:</span>{' '}
                      {claimedAssessmentStatus}
                    </div>
                  </div>
                  <Link
                    to={`/results/${claimedAssessmentId}`}
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <FileText size={15} />
                    View Assessment Results
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              {!loadingAssessments && !assessmentLoadError && eligibleAssessments.length > 0 && !claimedAssessmentId && (
                <div className="mt-5">
                  <p
                    className="text-sm flex items-center gap-2"
                    style={{ color: selectedAssessmentId ? BRAND.teal : 'rgba(255,255,255,0.5)' }}
                    aria-live="polite"
                  >
                    {selectedAssessmentId
                      ? 'Assessment selected and ready to connect.'
                      : 'Select one assessment to continue.'}
                  </p>

                  {assessmentClaimError && (
                    <div
                      className="rounded-xl px-4 py-3 mt-3 text-sm flex items-start gap-2.5"
                      style={{
                        backgroundColor: 'rgba(212,168,67,0.08)',
                        border: '1px solid rgba(212,168,67,0.25)',
                        color: BRAND.gold,
                      }}
                      role="alert"
                    >
                      <Info size={15} className="flex-shrink-0 mt-0.5" />
                      {assessmentClaimError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleClaimAssessment}
                    disabled={!canClaim}
                    aria-busy={claimingAssessment}
                    className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                  >
                    <Link2 size={15} />
                    {claimingAssessment ? 'Connecting Assessment...' : 'Connect Assessment to Organization'}
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
