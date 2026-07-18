import { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Building2, FileText, Globe, MapPin, Users, DollarSign, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';
import { supabase } from '../lib/supabase';

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

function str(val: string): string | null {
  const t = val.trim();
  return t === '' ? null : t;
}

function num(val: string): number | null {
  const t = val.trim();
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 mb-5 pb-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}
      >
        <Icon size={15} style={{ color: BRAND.teal }} />
      </div>
      <span
        className="text-sm font-semibold uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function OrganizationSetupPage() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [rpcError, setRpcError] = useState('');
  const [createdOrgName, setCreatedOrgName] = useState<string | null>(null);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0A0A0A' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${BRAND.teal} transparent transparent transparent` }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  function set(field: keyof FormState) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError('');
    setRpcError('');

    if (!form.organization_name.trim()) {
      setFieldError('Organization name is required.');
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const { data, error } = await supabase.rpc('create_user_organization', {
        p_organization_name: form.organization_name.trim(),
        p_legal_name: str(form.legal_name),
        p_ein: str(form.ein),
        p_mission: str(form.mission),
        p_vision: str(form.vision),
        p_website: str(form.website),
        p_cause_area: str(form.cause_area),
        p_primary_population: str(form.primary_population),
        p_service_area: str(form.service_area),
        p_city: str(form.city),
        p_state: str(form.state),
        p_annual_budget: num(form.annual_budget),
        p_annual_revenue: num(form.annual_revenue),
        p_staff_count: num(form.staff_count),
        p_board_member_count: num(form.board_member_count),
        p_organization_stage: str(form.organization_stage),
        p_nonprofit_status: str(form.nonprofit_status),
      });

      if (error) {
        console.error('[create_user_organization]', error);
        if (error.code === 'P0005') {
          setRpcError(
            'An organization with this name and EIN already exists in your account.'
          );
        } else {
          setRpcError(
            'We could not create your organization. Please review the information and try again.'
          );
        }
        return;
      }

      const orgName =
        (data as { organization_name?: string } | null)?.organization_name ??
        form.organization_name.trim();
      setCreatedOrgName(orgName);
    } catch (err) {
      console.error('[create_user_organization] network error', err);
      setRpcError(
        'We could not create your organization. Please review the information and try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  const isSuccess = createdOrgName !== null;

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
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '60px' }}
            >
              Create the organization profile that will power your C-SHIFT assessment
              results, action plan, evidence tracking, and progress history.
            </p>
          </div>
        </AnimatedSection>

        {/* ── Success panel (replaces form area) ── */}
        {isSuccess ? (
          <AnimatedSection direction="up">
            <div
              className="card-premium p-8 mb-6"
              style={{ border: '1px solid rgba(28,116,134,0.35)' }}
            >
              <div className="flex items-start gap-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(28,116,134,0.18)' }}
                >
                  <CheckCircle size={28} style={{ color: BRAND.teal }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Organization Created
                  </h2>
                  <p
                    className="text-base font-semibold mb-3"
                    style={{ color: BRAND.teal }}
                  >
                    {createdOrgName}
                  </p>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: 'rgba(28,116,134,0.12)',
                      border: '1px solid rgba(28,116,134,0.25)',
                      color: BRAND.teal,
                    }}
                  >
                    Your organization role: Owner
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        ) : (
          /* ── Form ── */
          <AnimatedSection direction="up" delay={40}>
            <form onSubmit={handleSubmit} noValidate>
              <div className="card-premium p-8 mb-6 space-y-8">

                {/* Identity */}
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
                        onChange={e => {
                          setFieldError('');
                          set('organization_name')(e);
                        }}
                        className={inputCls}
                        style={
                          fieldError
                            ? { ...inputStyle, border: '1px solid rgba(239,68,68,0.6)' }
                            : inputStyle
                        }
                        placeholder="Your nonprofit's operating name"
                        required
                        aria-required="true"
                        aria-describedby={fieldError ? 'org-name-error' : undefined}
                        disabled={saving}
                      />
                      {fieldError && (
                        <p
                          id="org-name-error"
                          className="mt-1.5 text-xs flex items-center gap-1.5"
                          style={{ color: '#F87171' }}
                          role="alert"
                        >
                          <AlertCircle size={12} />
                          {fieldError}
                        </p>
                      )}
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
                          disabled={saving}
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
                          disabled={saving}
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
                          disabled={saving}
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
                          disabled={saving}
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

                {/* Mission & Vision */}
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
                        disabled={saving}
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
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Web & Location */}
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
                        disabled={saving}
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
                          disabled={saving}
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
                          disabled={saving}
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
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Cause & Population */}
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
                        disabled={saving}
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
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Capacity */}
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
                        disabled={saving}
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
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                {/* Financials */}
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
                        disabled={saving}
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
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Required field note */}
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <span style={{ color: BRAND.gold }}>*</span> Required field
              </p>

              {/* RPC error */}
              {rpcError && (
                <div
                  className="rounded-xl px-4 py-3 mb-5 text-sm flex items-start gap-2.5"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#F87171',
                  }}
                  role="alert"
                >
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {rpcError}
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => history.back()}
                  className="btn-ghost text-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary disabled:opacity-60"
                  disabled={saving}
                  aria-busy={saving}
                >
                  <Building2 size={15} />
                  {saving ? 'Creating Organization...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </AnimatedSection>
        )}

        {/* Assessment claim section */}
        <AnimatedSection direction="up" delay={80}>
          <div className="card-premium p-7 mt-8">
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: 'rgba(212,168,67,0.12)',
                  border: '1px solid rgba(212,168,67,0.2)',
                }}
              >
                <FileText size={17} style={{ color: BRAND.gold }} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-white mb-2">
                  Already Completed an Assessment?
                </h2>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  After your organization is created, you will be able to connect an
                  eligible assessment completed with the same email address.
                </p>
                {isSuccess && (
                  <>
                    <button
                      type="button"
                      disabled
                      className="btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <LinkIcon size={14} />
                      Connect an Existing Assessment
                    </button>
                    <p
                      className="mt-2.5 text-xs"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      Assessment connection will be activated in the next development step.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </AnimatedSection>

      </div>
    </div>
  );
}
