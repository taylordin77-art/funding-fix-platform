import { useState } from 'react';
import { Calendar, Users, DollarSign, CheckCircle, ArrowRight, Sparkles, Crown, Star } from 'lucide-react';
import { AnimatedSection } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843' };

interface RegistrationForm {
  full_name: string;
  email: string;
  organization_name: string;
  phone: string;
  challenge_description: string;
  desired_outcome: string;
  years_operating: string;
  annual_budget: string;
}

const emptyForm: RegistrationForm = {
  full_name: '', email: '', organization_name: '', phone: '',
  challenge_description: '', desired_outcome: '', years_operating: '', annual_budget: '',
};

type ModalType = 'summit' | 'twenty_in_twenty' | 'insight_grant' | 'hot_seat_sponsorship' | null;

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
  borderRadius: '12px',
};

function Modal({ type, onClose }: { type: ModalType; onClose: () => void }) {
  const [form, setForm] = useState<RegistrationForm>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summitTier, setSummitTier] = useState<'general' | 'vip' | 'premier'>('general');

  if (!type) return null;

  const isSummit = type === 'summit';
  const isApplication = type === 'twenty_in_twenty' || type === 'insight_grant';
  const isSponsorship = type === 'hot_seat_sponsorship';

  const SUMMIT_TIERS = [
    { id: 'general' as const, name: 'General Admission', price: 97, description: 'Full summit access, all sessions, and digital resources.', icon: Star, color: BRAND.teal },
    { id: 'vip' as const, name: 'VIP Experience', price: 150, description: "Everything in General Admission plus a branded VIP bag containing a leader's journal, branded pen, six pillar bookmark, lanyard, branded notepad, and a resource card.", icon: Sparkles, color: '#2E8B57' },
    { id: 'premier' as const, name: 'Premier Experience', price: 197, description: 'Everything in VIP plus pre-event breakfast with featured leaders, an intimate morning panel and Q&A session, and access to the exclusive Beyond the Summit post-session.', icon: Crown, color: BRAND.gold },
  ];

  const titles: Record<NonNullable<ModalType>, string> = {
    summit: 'Mission to Money Summit Registration',
    twenty_in_twenty: '20 in 20 Nonprofits on the Move Application',
    insight_grant: 'Insight Grant Application',
    hot_seat_sponsorship: 'Making Missions Make Cents Hot Seat Sponsorship',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-8" style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}>
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}>
              <CheckCircle size={28} style={{ color: BRAND.teal }} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {isApplication ? 'Application Submitted!' : isSponsorship ? 'Sponsorship Inquiry Received!' : 'Registration Submitted!'}
            </h3>
            <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {isApplication ? 'Thank you for applying. We will review your application and be in touch soon.'
                : isSponsorship ? 'Thank you for your interest. Our team will contact you within 2 business days.'
                : 'Thank you. Check your email for confirmation and next steps.'}
            </p>
            <button onClick={onClose} className="btn-primary">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">{titles[type]}</h3>
                {isApplication && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: BRAND.gold, border: '1px solid rgba(212,168,67,0.2)' }}>
                    <DollarSign size={11} /> $20 Application Fee
                  </div>
                )}
                {isSponsorship && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: BRAND.gold, border: '1px solid rgba(212,168,67,0.2)' }}>
                    <Sparkles size={11} /> $1,000 Total Sponsorship
                  </div>
                )}
              </div>
              <button onClick={onClose} className="text-2xl font-light leading-none transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>&times;</button>
            </div>

            {isSummit && (
              <div className="mb-6 space-y-3">
                <h4 className="font-semibold text-white text-sm">Select Your Ticket Tier</h4>
                {SUMMIT_TIERS.map(tier => {
                  const Icon = tier.icon;
                  const isSelected = summitTier === tier.id;
                  return (
                    <button key={tier.id} onClick={() => setSummitTier(tier.id)} className="w-full text-left p-4 rounded-xl transition-all" style={isSelected ? { border: `2px solid ${tier.color}`, backgroundColor: tier.color + '12' } : { border: '2px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: tier.color }}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white text-sm">{tier.name}</span>
                            <span className="font-bold text-lg" style={{ color: tier.color }}>${tier.price}</span>
                          </div>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{tier.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { placeholder: 'Full Name *', required: true, type: 'text', field: 'full_name' },
                { placeholder: 'Email Address *', required: true, type: 'email', field: 'email' },
                { placeholder: 'Organization Name *', required: true, type: 'text', field: 'organization_name' },
              ].map(f => (
                <input key={f.field} type={f.type} placeholder={f.placeholder} required={f.required} value={form[f.field as keyof RegistrationForm]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 outline-none" style={inputStyle} />
              ))}
              {!isSummit && (
                <input type="tel" placeholder="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} />
              )}
              {isApplication && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Years Operating" value={form.years_operating} onChange={e => setForm(p => ({ ...p, years_operating: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} />
                    <input type="text" placeholder="Annual Budget" value={form.annual_budget} onChange={e => setForm(p => ({ ...p, annual_budget: e.target.value }))} className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} />
                  </div>
                  <textarea placeholder="Describe your organization's greatest funding challenge..." value={form.challenge_description} onChange={e => setForm(p => ({ ...p, challenge_description: e.target.value }))} rows={3} required className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none resize-none" style={inputStyle} />
                  <textarea placeholder="What outcome are you hoping to achieve?" value={form.desired_outcome} onChange={e => setForm(p => ({ ...p, desired_outcome: e.target.value }))} rows={3} required className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none resize-none" style={inputStyle} />
                  <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', color: BRAND.gold }}>
                    A $20 application fee is required to submit. You will be directed to payment after submission.
                  </div>
                </>
              )}
              {isSponsorship && (
                <textarea placeholder="Tell us about your organization and why you are interested in this sponsorship opportunity..." value={form.challenge_description} onChange={e => setForm(p => ({ ...p, challenge_description: e.target.value }))} rows={4} required className="w-full px-4 py-2.5 text-sm placeholder:text-white/30 outline-none resize-none" style={inputStyle} />
              )}
              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-60">
                {submitting ? 'Submitting...' : isSummit ? `Register: $${SUMMIT_TIERS.find(t => t.id === summitTier)?.price}` : isApplication ? 'Submit Application' : 'Submit Inquiry'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>

      {/* ═══ HERO — Dark + teal ═══ */}
      <section className="relative overflow-hidden section-padding" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,116,134,0.18) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="orb" style={{ width: 500, height: 500, background: 'rgba(28,116,134,0.1)', top: '-15%', right: '-5%', animationDuration: '24s' }} />
          <div className="orb" style={{ width: 350, height: 350, background: 'rgba(212,168,67,0.07)', bottom: '-10%', left: '-5%', animationDuration: '30s', animationDelay: '-8s' }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-xs font-semibold glass-teal">
              <Calendar size={12} style={{ color: BRAND.teal }} />
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Events and Programs</span>
            </div>
            <h1 className="heading-xl text-white mb-4">Events and Programs</h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Summits, grant opportunities, and signature programs designed to accelerate your organization's funding readiness.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ MISSION TO MONEY SUMMIT — Warm White ═══ */}
      <section className="section-warm section-padding">
        <div className="max-w-5xl mx-auto px-4">
          <AnimatedSection direction="up">
            <div className="card-light overflow-hidden">
              <div className="px-8 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white" style={{ backgroundColor: BRAND.teal }}>
                <Calendar size={13} /> Summit
              </div>
              <div className="p-8">
                <h2 className="heading-lg mb-3" style={{ color: '#0D1213' }}>Mission to Money Summit</h2>
                <p className="leading-relaxed mb-8 text-lg" style={{ color: '#4B5563' }}>
                  The flagship event bringing together nonprofit leaders for a full day of funding strategy, expert panels, and actionable frameworks. Three ticket tiers available to fit your experience level and goals.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {[
                    { icon: Star, name: 'General Admission', price: '$97', desc: 'Full summit access, all sessions, and digital resources.', color: BRAND.teal },
                    { icon: Sparkles, name: 'VIP Experience', price: '$150', desc: 'Everything in General Admission plus a branded VIP bag.', color: '#2E8B57' },
                    { icon: Crown, name: 'Premier Experience', price: '$197', desc: 'Everything in VIP plus pre-event breakfast, intimate morning panel, and the Beyond the Summit post-session.', color: BRAND.gold },
                  ].map(tier => {
                    const Icon = tier.icon;
                    return (
                      <div key={tier.name} className="p-5 rounded-2xl" style={{ border: `1px solid ${tier.color}25`, backgroundColor: tier.color + '07' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: tier.color }}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-sm" style={{ color: '#0D1213' }}>{tier.name}</div>
                            <div className="font-bold text-lg" style={{ color: tier.color }}>{tier.price}</div>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: '#4B5563' }}>{tier.desc}</p>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setModal('summit')} className="btn-primary">
                  Register for the Summit <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ HOT SEAT SPONSORSHIP — Deep Black + Gold ═══ */}
      <section className="section-dark section-padding relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 80% 50%, rgba(212,168,67,0.12) 0%, transparent 60%)' }}>
        <div className="relative max-w-5xl mx-auto px-4">
          <AnimatedSection direction="up">
            <div className="card-gold overflow-hidden">
              <div className="px-6 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ backgroundColor: BRAND.gold, color: '#0A0A0A' }}>
                <Sparkles size={13} /> Founding Sponsorship Opportunity: Extremely Limited Spots
              </div>
              <div className="p-8">
                <h2 className="heading-lg text-white mb-2">Making Missions Make Cents Hot Seat Sponsorship</h2>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-3xl font-bold" style={{ color: BRAND.gold }}>$1,000</span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>total sponsorship</span>
                </div>
                <p className="leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  A one-time founding sponsorship opportunity for organizations that want to be featured in a live Hot Seat funding review. Your sponsorship includes $500 in cash and $500 in capacity building and funding strategy services.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {['Live Hot Seat feature session', '$500 cash sponsorship', '$500 in services', 'Recorded session access', 'Framework review', 'Community visibility'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      <CheckCircle size={14} style={{ color: BRAND.gold }} /> {f}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <a href="https://calendly.com/taylordin77/new-meeting" target="_blank" rel="noopener noreferrer" className="btn-gold">
                    Apply for Sponsorship <ArrowRight size={16} />
                  </a>
                  <div className="flex items-center gap-1.5 text-xs self-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <Users size={12} /> Spots are extremely limited
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ 20 IN 20 + INSIGHT GRANT — White ═══ */}
      <section className="section-white section-padding">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 20 in 20 */}
            <AnimatedSection direction="left">
              <div className="card-light overflow-hidden h-full">
                <div className="px-8 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white" style={{ backgroundColor: '#2E8B57' }}>
                  <Star size={13} /> Program
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h2 className="text-xl font-bold" style={{ color: '#0D1213' }}>20 in 20 Nonprofits on the Move</h2>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: BRAND.gold, border: '1px solid rgba(212,168,67,0.2)' }}>
                      <DollarSign size={11} /> $20 Application Fee
                    </div>
                  </div>
                  <p className="leading-relaxed mb-4 text-sm" style={{ color: '#4B5563' }}>
                    A selective program recognizing and supporting 20 high-potential nonprofits positioned for significant growth. Selected organizations receive resources, visibility, coaching, and community support.
                  </p>
                  <div className="flex items-start gap-3 mb-5 p-3 rounded-xl" style={{ backgroundColor: 'rgba(212,168,67,0.07)', border: '1px solid rgba(212,168,67,0.15)' }}>
                    <DollarSign size={16} className="flex-shrink-0 mt-0.5" style={{ color: BRAND.gold }} />
                    <div>
                      <div className="font-semibold text-sm" style={{ color: '#0D1213' }}>Application Fee: $20</div>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>The application fee supports the review process and is non-refundable.</p>
                    </div>
                  </div>
                  <button onClick={() => setModal('twenty_in_twenty')} className="btn-primary">
                    Apply Now <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </AnimatedSection>

            {/* Insight Grant */}
            <AnimatedSection direction="right" delay={60}>
              <div className="card-light overflow-hidden h-full">
                <div className="px-8 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white" style={{ backgroundColor: BRAND.teal }}>
                  <Sparkles size={13} /> Grant
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h2 className="text-xl font-bold" style={{ color: '#0D1213' }}>Insight Grant</h2>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: BRAND.gold, border: '1px solid rgba(212,168,67,0.2)' }}>
                      <DollarSign size={11} /> $20 Application Fee
                    </div>
                  </div>
                  <p className="leading-relaxed mb-4 text-sm" style={{ color: '#4B5563' }}>
                    Awarded to emerging nonprofits demonstrating strong mission clarity, community need, and a commitment to building sustainable funding systems. Applications are reviewed on a rolling basis.
                  </p>
                  <div className="flex items-start gap-3 mb-5 p-3 rounded-xl" style={{ backgroundColor: 'rgba(212,168,67,0.07)', border: '1px solid rgba(212,168,67,0.15)' }}>
                    <DollarSign size={16} className="flex-shrink-0 mt-0.5" style={{ color: BRAND.gold }} />
                    <div>
                      <div className="font-semibold text-sm" style={{ color: '#0D1213' }}>Application Fee: $20</div>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>The application fee supports the grant review process and is non-refundable.</p>
                    </div>
                  </div>
                  <button onClick={() => setModal('insight_grant')} className="btn-primary">
                    Apply for the Grant <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Contact */}
          <AnimatedSection direction="up" delay={100} className="mt-8">
            <div className="card-light p-8 text-center">
              <h2 className="text-xl font-bold mb-3" style={{ color: '#0D1213' }}>Questions About Our Programs?</h2>
              <p className="mb-6" style={{ color: '#4B5563' }}>Our team is happy to help you find the right program for your organization.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="mailto:info@clarityshiftimpactgroup.com" className="btn-primary text-sm">Email Us</a>
                <a href="https://calendly.com/taylordin77/new-meeting-1" target="_blank" rel="noopener noreferrer" className="btn-gold text-sm">
                  Book a Strategy Call <ArrowRight size={15} />
                </a>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Modal type={modal} onClose={() => setModal(null)} />
    </div>
  );
}
