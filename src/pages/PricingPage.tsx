import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Star, ArrowRight, Phone, Mail, Loader2, Sparkles, Crown, Zap } from 'lucide-react';
import { redirectToCheckout, PriceKey } from '../lib/stripe';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843' };

const tiers = [
  {
    id: 'free',
    name: 'Explorer',
    icon: Zap,
    monthlyPrice: 0,
    futurePrice: null as string | null,
    description: 'Start your funding readiness journey with our Fundability Snapshot.',
    badge: null as string | null,
    badgeColor: null as string | null,
    features: [
      'Fundability Snapshot Assessment (30 questions)',
      'Overall Fundability Score',
      'Pillar Score Overview',
      'Results emailed to you',
      'Basic Resource Access',
    ],
    cta: 'Take Free Assessment',
    href: '/assessment',
    priceKey: null as PriceKey | null,
    monthlyKey: null as PriceKey | null,
    external: false,
    accentColor: 'rgba(255,255,255,0.5)',
    isPopular: false,
    isGold: false,
  },
  {
    id: 'founding_member',
    name: 'Founding Member',
    icon: Sparkles,
    monthlyPrice: 24.99,
    futurePrice: '$39.99/mo after founding period closes',
    description: 'Full assessment, coaching, and funding strategist access at founding member rates.',
    badge: 'Limited Spots',
    badgeColor: BRAND.teal,
    features: [
      'Full 6-Pillar Assessment',
      'Automated Results Report with Recommendations',
      'Resource Library Access',
      'Community Access',
      '1 Monthly Group Coaching Session',
      '1 Monthly 1-on-1 Session with a Funding Strategist',
    ],
    cta: 'Become a Founding Member',
    href: null,
    priceKey: 'founding_member_monthly' as PriceKey,
    monthlyKey: 'founding_member_monthly' as PriceKey,
    external: false,
    accentColor: BRAND.teal,
    isPopular: false,
    isGold: false,
  },
  {
    id: 'growth_member',
    name: 'Growth Member',
    icon: Star,
    monthlyPrice: 59.99,
    futurePrice: '$79.99/mo after founding period closes',
    description: 'Everything in Founding Member plus client portal, priority support, and advanced access.',
    badge: 'Most Popular',
    badgeColor: BRAND.gold,
    features: [
      'Everything in Founding Member',
      'Client Portal Access',
      'Priority Email Support',
      'Progress Tracking Dashboard',
      'Additional Monthly Resources',
      'Advanced Workshop Access',
      '2 Monthly 1-on-1 Sessions',
    ],
    cta: 'Join as Growth Member',
    href: null,
    priceKey: 'premium_monthly' as PriceKey,
    monthlyKey: 'premium_monthly' as PriceKey,
    external: false,
    accentColor: BRAND.gold,
    isPopular: true,
    isGold: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Crown,
    monthlyPrice: 97.99,
    futurePrice: '$119.99/mo after founding period closes',
    description: 'Everything in Growth Member plus dedicated support and full platform access.',
    badge: 'High Value',
    badgeColor: BRAND.teal,
    features: [
      'Everything in Growth Member',
      'Dedicated Support Channel',
      'Full Workshop Library Access',
      'Monthly Funding Strategy Review',
      'Grant Readiness Checklist',
      'Priority Access to New Features',
      'Unlimited 1-on-1 Sessions',
    ],
    cta: 'Go Premium',
    href: null,
    priceKey: 'premium_annual' as PriceKey,
    monthlyKey: 'premium_annual' as PriceKey,
    external: false,
    accentColor: BRAND.teal,
    isPopular: false,
    isGold: false,
  },
  {
    id: 'white_glove',
    name: 'White Glove',
    icon: Crown,
    monthlyPrice: null,
    futurePrice: null,
    description: 'A 6-month funding strategist-led engagement where an expert works alongside you every step of the way.',
    badge: 'Elite',
    badgeColor: BRAND.gold,
    features: [
      'Full Platform Access',
      'Dedicated Funding Strategist',
      'Custom Funding Strategy Development',
      'Grant Writing Support',
      'Board and Program Development',
      'Corporate Partnership Strategy',
      'Full Fundability Framework Implementation',
    ],
    note: 'This is not a done-for-you service. It is a strategist-led engagement where you do the work with expert guidance alongside you throughout.',
    cta: 'Apply Now',
    href: 'https://calendly.com/taylordin77/new-meeting',
    priceKey: null as PriceKey | null,
    monthlyKey: null as PriceKey | null,
    external: true,
    accentColor: BRAND.gold,
    isPopular: false,
    isGold: true,
  },
];

const NOTE_PRICE = '$2,500 for 6 months';

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const { user, profile } = useAuth();

  async function handleCheckout(tier: typeof tiers[number]) {
    if (!tier.monthlyKey) return;
    setCheckoutError('');
    setLoadingTier(tier.id);
    try {
      await redirectToCheckout({
        priceKey: tier.monthlyKey,
        customerEmail: profile?.email || user?.email,
        userId: user?.id,
      });
    } catch (e: unknown) {
      setCheckoutError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  }

  const TIER_ID_MAP: Record<string, string> = {
    founding_member: 'founding_member',
    growth_member: 'premium',
    premium: 'premium',
  };

  function isCurrentPlan(tierId: string): boolean {
    if (!profile) return false;
    return TIER_ID_MAP[tierId] === profile.membership_tier || tierId === profile.membership_tier;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>

      {/* ═══ HERO — Dark + teal ═══ */}
      <section className="relative overflow-hidden section-padding" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,116,134,0.18) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="orb" style={{ width: 500, height: 500, background: 'rgba(28,116,134,0.1)', top: '-15%', right: '-5%', animationDuration: '24s' }} />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <p className="section-label justify-center">Membership Plans</p>
            <h1 className="heading-xl text-white mb-4">Choose Your Path to Fundable</h1>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>Start free. Scale as you grow. Every tier includes the Fundability Framework.</p>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ PRICING CARDS — Dark ═══ */}
      <section className="section-padding" style={{ paddingTop: '2rem' }}>
        <div className="max-w-7xl mx-auto px-4">
          {checkoutError && (
            <div className="max-w-xl mx-auto mb-6 rounded-xl px-5 py-3 text-sm" style={{ backgroundColor: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', color: 'rgba(255,120,120,1)' }}>
              {checkoutError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
            {tiers.map((tier, idx) => {
              const Icon = tier.icon;
              const isPopular = tier.isPopular;
              const isGold = tier.isGold;
              return (
                <AnimatedSection key={tier.id} direction="up" delay={idx * 60}>
                  <div
                    className="flex flex-col relative overflow-hidden h-full"
                    style={{
                      backgroundColor: '#141414',
                      borderRadius: '1rem',
                      border: isPopular
                        ? `2px solid ${BRAND.gold}`
                        : isGold
                        ? `2px solid ${BRAND.gold}40`
                        : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isPopular ? `0 0 30px rgba(212,168,67,0.15)` : 'none',
                    }}
                  >
                    {tier.badge && (
                      <div
                        className="text-xs font-bold uppercase tracking-wider text-center py-2 flex items-center justify-center gap-1.5"
                        style={{
                          backgroundColor: isGold ? BRAND.gold + '20' : isPopular ? BRAND.gold : tier.accentColor,
                          color: isGold ? BRAND.gold : isPopular ? '#0A0A0A' : '#FFFFFF',
                        }}
                      >
                        <Icon size={11} />
                        {tier.badge}
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: tier.accentColor + '20' }}>
                            <Icon size={14} style={{ color: tier.accentColor }} />
                          </div>
                          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: tier.accentColor }}>{tier.name}</div>
                        </div>
                        {tier.monthlyPrice !== null ? (
                          <div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold text-white">${tier.monthlyPrice === 0 ? '0' : tier.monthlyPrice.toFixed(2)}</span>
                              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>/month</span>
                            </div>
                            {tier.futurePrice && (
                              <div className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.3)' }}>{tier.futurePrice}</div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-3xl font-bold text-white">{NOTE_PRICE}</div>
                          </div>
                        )}
                        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{tier.description}</p>
                        {(tier as { note?: string }).note && (
                          <p className="text-xs px-3 py-2 mt-2 leading-relaxed rounded-lg" style={{ backgroundColor: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.15)', color: 'rgba(212,168,67,0.9)' }}>
                            {(tier as { note?: string }).note}
                          </p>
                        )}
                      </div>

                      <ul className="space-y-2 flex-1 mb-5">
                        {tier.features.map(f => (
                          <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            <CheckCircle size={12} className="mt-0.5 flex-shrink-0" style={{ color: tier.accentColor }} />
                            {f}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto space-y-2">
                        {isCurrentPlan(tier.id) && (
                          <div className="flex items-center justify-center gap-2 w-full text-xs font-semibold py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                            <CheckCircle size={12} />
                            Current Plan
                          </div>
                        )}

                        {tier.id === 'free' && (
                          <Link
                            to="/assessment"
                            className="flex items-center justify-center gap-2 w-full text-xs font-bold py-3 rounded-xl border-2 transition-all"
                            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
                          >
                            {tier.cta} <ArrowRight size={13} />
                          </Link>
                        )}

                        {tier.id === 'white_glove' && (
                          <a
                            href={tier.href!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-gold flex items-center justify-center text-sm w-full"
                          >
                            {tier.cta} <ArrowRight size={13} />
                          </a>
                        )}

                        {(tier.id === 'founding_member' || tier.id === 'growth_member' || tier.id === 'premium') && !isCurrentPlan(tier.id) && (
                          <button
                            onClick={() => handleCheckout(tier)}
                            disabled={loadingTier === tier.id}
                            className={`w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed text-sm py-3 px-4 rounded-xl font-bold transition-all flex items-center gap-2 ${isPopular ? 'btn-gold' : 'btn-primary'}`}
                          >
                            {loadingTier === tier.id ? (
                              <><Loader2 size={13} className="animate-spin" />Redirecting...</>
                            ) : (
                              <>{tier.cta}<ArrowRight size={13} /></>
                            )}
                          </button>
                        )}

                        {!user && (tier.id === 'founding_member' || tier.id === 'growth_member' || tier.id === 'premium') && (
                          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            <Link to="/register" className="underline" style={{ color: 'rgba(255,255,255,0.5)' }}>Create an account</Link> to purchase
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FAQ + CONTACT — Warm White ═══ */}
      <section className="section-warm section-padding">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AnimatedSection direction="up">
              <div className="card-light p-8 h-full">
                <p className="section-label" style={{ color: BRAND.teal }}>FAQ</p>
                <h2 className="heading-lg mb-6" style={{ color: '#0D1213' }}>Frequently Asked Questions</h2>
                <div className="space-y-5">
                  {[
                    { q: 'Can I start for free?', a: 'Absolutely. The Explorer tier gives full access to the Fundability Snapshot assessment with no credit card required.' },
                    { q: 'What happens when the founding period closes?', a: 'Founding Members lock in their rate for 12 months. After that, pricing transitions to the standard rates listed. Founding members are grandfathered in at a discounted rate going forward.' },
                    { q: 'Can I upgrade or cancel anytime?', a: 'Yes. You can change your plan at any time from your account settings. Upgrades take effect immediately.' },
                    { q: 'What makes the White Glove Engagement different?', a: 'This is a hands-on, strategist-led engagement. You work directly with a funding strategist over six months to implement the full Fundability Framework in your organization.' },
                    { q: 'Is there a nonprofit discount?', a: 'All pricing is designed specifically for nonprofits. Contact us if you need a scholarship consideration.' },
                  ].map((faq, i) => (
                    <div key={i} className="pb-5 last:pb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                      <div className="font-semibold mb-1.5" style={{ color: '#0D1213' }}>{faq.q}</div>
                      <div className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{faq.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="up" delay={80}>
              <div className="card-light p-8 h-full flex flex-col">
                <p className="section-label" style={{ color: BRAND.teal }}>Get Help</p>
                <h2 className="heading-lg mb-3" style={{ color: '#0D1213' }}>Still Have Questions?</h2>
                <p className="mb-6" style={{ color: '#4B5563' }}>Our team is here to help you find the right plan for your organization.</p>
                <div className="space-y-3">
                  <a
                    href="https://calendly.com/taylordin77/new-meeting-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl transition-all hover:bg-gray-50"
                    style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: BRAND.teal }}>
                      <Phone size={17} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: '#0D1213' }}>Book a Free Strategy Call</div>
                      <div className="text-xs" style={{ color: '#6B7280' }}>30 minutes, no commitment</div>
                    </div>
                    <ArrowRight size={15} className="ml-auto" style={{ color: '#9CA3AF' }} />
                  </a>
                  <a
                    href="mailto:info@clarityshiftimpactgroup.com"
                    className="flex items-center gap-3 p-4 rounded-xl transition-all hover:bg-gray-50"
                    style={{ border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: BRAND.teal }}>
                      <Mail size={17} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: '#0D1213' }}>Email Us</div>
                      <div className="text-xs" style={{ color: '#6B7280' }}>info@clarityshiftimpactgroup.com</div>
                    </div>
                    <ArrowRight size={15} className="ml-auto" style={{ color: '#9CA3AF' }} />
                  </a>
                </div>

                <div className="mt-auto pt-6">
                  <div className="p-5 rounded-xl" style={{ backgroundColor: 'rgba(28,116,134,0.06)', border: '1px solid rgba(28,116,134,0.15)' }}>
                    <div className="font-semibold mb-1" style={{ color: '#0D1213' }}>30-Day Money-Back Guarantee</div>
                    <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                      Not satisfied within the first 30 days? We will refund you in full, no questions asked.
                    </p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </div>
  );
}
