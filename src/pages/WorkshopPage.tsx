import { useState } from 'react';
import { CheckCircle, Clock, Users, Video, Star, Bell, Lock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { redirectToCheckout } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { AnimatedSection } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843' };

interface Workshop {
  id: string;
  title: string;
  description: string;
  free: boolean;
  status: 'available' | 'coming_soon';
  standardPrice?: number;
  premiumPrice?: number;
  duration?: string;
  image?: string;
}

const WORKSHOP_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1400&q=95',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1400&q=95',
];

const workshops: Workshop[] = [
  { id: 'how-to-get-grants', title: 'How to Get Grants', description: 'Understand what funders actually look for and how to position your organization to win.', free: true, status: 'available', duration: '90 min', image: WORKSHOP_IMAGES[0] },
  { id: 'board-member-alignment', title: 'Board Member Alignment', description: 'Build a board that shows up, leads well, and strengthens your funding credibility.', free: false, status: 'coming_soon', standardPrice: 39.99, premiumPrice: 79, image: WORKSHOP_IMAGES[1] },
  { id: 'volunteers-that-last', title: 'Volunteers That Last', description: 'Create volunteer systems that retain people and multiply your organizational capacity.', free: false, status: 'coming_soon', standardPrice: 29.99, premiumPrice: 79, image: WORKSHOP_IMAGES[2] },
  { id: 'sponsor-deck', title: 'Making a Sponsor Deck That Converts', description: 'Design a sponsorship proposal that corporate partners actually say yes to.', free: false, status: 'coming_soon', standardPrice: 49.99, premiumPrice: 79, image: WORKSHOP_IMAGES[3] },
  { id: 'corporate-relationships', title: 'How to Determine if a Corporate Relationship is Right for You', description: 'Evaluate corporate partnership opportunities so you pursue the right ones and protect your mission.', free: false, status: 'coming_soon', standardPrice: 39.99, premiumPrice: 79, image: WORKSHOP_IMAGES[4] },
  { id: 'stop-self-funding', title: 'How to Stop Self-Funding Your Nonprofit', description: 'Break the cycle of personal investment and build sustainable organizational revenue.', free: false, status: 'coming_soon', standardPrice: 49.99, premiumPrice: 79, image: WORKSHOP_IMAGES[5] },
  { id: 'fundraisers-that-work', title: 'Fundraisers That Actually Raise Funds', description: 'Design fundraising events and campaigns that generate real revenue, not just activity.', free: false, status: 'coming_soon', standardPrice: 59.99, premiumPrice: 79, image: WORKSHOP_IMAGES[6] },
  { id: 'crowdfunding', title: 'How to Properly Crowdfund', description: 'Launch crowdfunding campaigns that resonate with donors and convert attention into dollars.', free: false, status: 'coming_soon', standardPrice: 39.99, premiumPrice: 79, image: WORKSHOP_IMAGES[7] },
];

type AccessLevel = 'standard' | 'premium_access';

function WorkshopCard({ workshop, index }: { workshop: Workshop; index: number }) {
  const { user, profile } = useAuth();
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notified, setNotified] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [registering, setRegistering] = useState<AccessLevel | null>(null);
  const [registerError, setRegisterError] = useState('');
  const [showFreeForm, setShowFreeForm] = useState(false);
  const [freeForm, setFreeForm] = useState({ full_name: profile?.full_name || '', email: profile?.email || '', organization_name: profile?.organization_name || '' });
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeRegistered, setFreeRegistered] = useState(false);

  async function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('notify_requests').insert({ email: notifyEmail, workshop_id: workshop.id }).catch(() => {});
    setNotified(true);
  }

  async function handleFreeRegister(e: React.FormEvent) {
    e.preventDefault();
    setFreeLoading(true);
    await supabase.from('workshop_registrations').insert({ user_id: user?.id ?? null, email: freeForm.email, full_name: freeForm.full_name, organization_name: freeForm.organization_name, payment_status: 'paid', amount_paid: 0 }).catch(() => {});
    setFreeRegistered(true);
    setFreeLoading(false);
  }

  async function handlePaidRegister(access: AccessLevel) {
    setRegisterError('');
    setRegistering(access);
    const priceKey = access === 'standard' ? 'workshop_standard' : 'workshop_premium_access';
    try {
      await redirectToCheckout({ priceKey: priceKey as import('../lib/stripe').PriceKey, customerEmail: profile?.email || user?.email, userId: user?.id, metadata: { workshopId: workshop.id, workshopTitle: workshop.title, accessLevel: access } });
    } catch (e: unknown) {
      setRegisterError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setRegistering(null);
    }
  }

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF', borderRadius: '12px' };

  if (workshop.free) {
    return (
      <AnimatedSection delay={index * 80} direction="up">
        <div className="card-premium overflow-hidden h-full" style={{ border: `1px solid rgba(28,116,134,0.4)` }}>
          <div className="img-zoom relative" style={{ height: 200 }}>
            <img src={workshop.image} alt={workshop.title} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(20,20,20,0.85) 100%)' }} />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: BRAND.gold, color: '#0A0A0A' }}>Free</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(28,116,134,0.85)', color: '#FFFFFF' }}>Available Now</span>
            </div>
            {workshop.duration && (
              <div className="absolute bottom-4 right-4 flex items-center gap-1 text-xs text-white/60 glass px-2 py-1 rounded-full">
                <Clock size={11} /> {workshop.duration}
              </div>
            )}
          </div>
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-2">{workshop.title}</h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>{workshop.description}</p>

            {freeRegistered ? (
              <div className="flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(28,116,134,0.15)', color: '#1C7486' }}>
                <CheckCircle size={15} /> Registered. Check your email for access details.
              </div>
            ) : showFreeForm ? (
              <form onSubmit={handleFreeRegister} className="space-y-2">
                <input type="text" placeholder="Full Name" value={freeForm.full_name} onChange={e => setFreeForm(p => ({ ...p, full_name: e.target.value }))} className="w-full px-3 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} required />
                <input type="email" placeholder="Email Address" value={freeForm.email} onChange={e => setFreeForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} required />
                <input type="text" placeholder="Organization Name" value={freeForm.organization_name} onChange={e => setFreeForm(p => ({ ...p, organization_name: e.target.value }))} className="w-full px-3 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} required />
                <button type="submit" disabled={freeLoading} className="w-full btn-primary justify-center disabled:opacity-70">
                  {freeLoading ? 'Registering...' : 'Register for Free'}
                </button>
                <button type="button" onClick={() => setShowFreeForm(false)} className="w-full text-xs py-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Cancel</button>
              </form>
            ) : (
              <button onClick={() => setShowFreeForm(true)} className="w-full btn-primary justify-center">
                Register for Free
              </button>
            )}

            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Premium Access at $79 includes:</p>
              <ul className="space-y-1 mb-3">
                {['Full playback access', 'Submit questions for personal answers', 'Pre-session guide delivered before the workshop'].map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <CheckCircle size={10} style={{ color: '#1C7486' }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => handlePaidRegister('premium_access')} disabled={registering === 'premium_access'} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ border: '1px solid rgba(28,116,134,0.4)', color: '#1C7486', background: 'rgba(28,116,134,0.08)' }}>
                {registering === 'premium_access' ? <><Loader2 size={13} className="animate-spin" /> Redirecting...</> : 'Upgrade to Premium Access ($79)'}
              </button>
              {registerError && <p className="text-xs mt-2" style={{ color: '#D4A843' }}>{registerError}</p>}
            </div>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection delay={index * 80} direction="up">
      <div className="card-premium overflow-hidden h-full">
        <div className="img-zoom relative" style={{ height: 160 }}>
          <img src={workshop.image} alt={workshop.title} className="w-full h-full object-cover" loading="lazy" style={{ filter: 'brightness(0.55)' }} />
          <div className="absolute top-3 left-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>Coming Soon</span>
          </div>
          {workshop.standardPrice && (
            <div className="absolute bottom-3 right-3 text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>from ${workshop.standardPrice}</div>
          )}
        </div>
        <div className="p-6">
          <h3 className="text-base font-bold text-white mb-2">{workshop.title}</h3>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{workshop.description}</p>

          {workshop.standardPrice && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="font-bold text-white text-sm">${workshop.standardPrice}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Standard Access</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(28,116,134,0.08)', border: '1px solid rgba(28,116,134,0.2)' }}>
                <div className="font-bold text-sm" style={{ color: '#1C7486' }}>${workshop.premiumPrice}</div>
                <div className="text-xs font-medium mt-0.5" style={{ color: '#1C7486' }}>Premium Access</div>
              </div>
            </div>
          )}

          {notified ? (
            <div className="flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(28,116,134,0.15)', color: '#1C7486' }}>
              <CheckCircle size={14} /> You are on the notify list.
            </div>
          ) : showNotify ? (
            <form onSubmit={handleNotify} className="flex gap-2">
              <input type="email" placeholder="your@email.com" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} className="flex-1 px-3 py-2.5 text-sm placeholder:text-white/30 outline-none" style={inputStyle} required />
              <button type="submit" className="btn-primary px-4 py-2.5 text-sm">Notify</button>
            </form>
          ) : (
            <button onClick={() => setShowNotify(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', background: 'transparent' }}>
              <Bell size={13} /> Notify Me When Available
            </button>
          )}
        </div>
      </div>
    </AnimatedSection>
  );
}

export default function WorkshopPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    { q: 'Are these workshops live or recorded?', a: 'All workshops are delivered live with a recording made available to all registered attendees. Standard Access includes playback for 90 days. Premium Access includes playback, the ability to submit questions that will be personally answered, and a pre-session guide delivered before the workshop.' },
    { q: 'What is a pre-session guide?', a: 'The pre-session guide is a preparation resource delivered to Premium Access attendees before the workshop. It includes key concepts, reflection questions, and actions to take so you get the most out of each session.' },
    { q: 'Who teaches the workshops?', a: 'All workshops are led by funding strategists with direct experience working with nonprofits across all sectors.' },
    { q: 'Can I get a refund?', a: 'Full refunds are available up to 48 hours before the live session. After that, we can transfer your registration to a future workshop on the same topic.' },
    { q: 'How do I access a workshop I purchased?', a: 'After registration, you will receive login details via email. All your purchased workshops are accessible from your account dashboard.' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>

      {/* ═══ HERO — Dark + teal ═══ */}
      <section className="relative overflow-hidden section-padding" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,116,134,0.18) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="orb" style={{ width: 500, height: 500, background: 'rgba(28,116,134,0.12)', top: '-15%', left: '-5%', animationDuration: '22s' }} />
          <div className="orb" style={{ width: 350, height: 350, background: 'rgba(212,168,67,0.07)', bottom: '-10%', right: '-5%', animationDuration: '28s', animationDelay: '-8s' }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 glass-gold">
              <Star size={13} style={{ color: BRAND.gold }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>Standalone Workshops, On Your Schedule</span>
            </div>
            <h1 className="heading-xl text-white mb-4">Funding Fix Workshops</h1>
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Individual workshops built around the topics nonprofit leaders need most. Start with our free workshop and add more as you grow.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {[{ icon: Video, label: 'Live with Playback' }, { icon: Users, label: 'Small Group Format' }, { icon: Star, label: 'Funding Strategists' }, { icon: Lock, label: 'Premium Access Available' }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2"><Icon size={14} />{label}</div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ ACCESS TIERS — Solid Teal ═══ */}
      <section className="section-teal relative" style={{ padding: '3rem 0' }}>
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-lg font-bold text-white mb-5 text-center">Two Ways to Access Every Workshop</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="card-teal p-5">
              <div className="font-bold text-white mb-1 text-sm">Standard Access: $19.99 to $59.99</div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Live session attendance plus 90-day playback access.</p>
            </div>
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(212,168,67,0.18)', border: '1px solid rgba(212,168,67,0.35)' }}>
              <div className="font-bold mb-1 text-sm" style={{ color: BRAND.gold }}>Premium Access: $79</div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>Everything in Standard plus question submission for personal answers and a pre-session guide delivered before the workshop.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WORKSHOPS GRID — Warm White ═══ */}
      <section className="section-warm section-padding">
        <div className="max-w-5xl mx-auto px-4">
          <AnimatedSection direction="up" className="mb-10">
            <p className="section-label" style={{ color: BRAND.teal }}>Workshop Catalog</p>
            <h2 className="heading-lg mb-2" style={{ color: '#0D1213' }}>All Workshops</h2>
            <p className="text-base" style={{ color: '#4B5563' }}>The first workshop is always free. Register below to get started.</p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {workshops.map((workshop, i) => (
              <WorkshopCard key={workshop.id} workshop={workshop} index={i} />
            ))}
          </div>

          {/* FAQ */}
          <AnimatedSection direction="up">
            <div className="card-light p-8">
              <h2 className="heading-lg mb-6" style={{ color: '#0D1213' }}>Frequently Asked Questions</h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left transition-all"
                      style={{ background: expandedFaq === i ? 'rgba(28,116,134,0.06)' : 'transparent' }}
                    >
                      <span className="font-medium text-sm" style={{ color: '#0D1213' }}>{faq.q}</span>
                      {expandedFaq === i
                        ? <ChevronUp size={16} style={{ color: '#6B7280' }} />
                        : <ChevronDown size={16} style={{ color: '#6B7280' }} />}
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-4 text-sm leading-relaxed" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', color: '#4B5563' }}>
                        <div className="pt-3">{faq.a}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
