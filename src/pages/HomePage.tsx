import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Star, ChevronRight, TrendingUp, Shield, BarChart3, Users, Zap, Award, ChevronDown } from 'lucide-react';
import { AnimatedSection, StaggeredGroup, AnimatedCounter } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843', white: '#FFFFFF' };

/* ---- Hero carousel images (abstract/architectural only) ---- */
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2560&q=90',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2560&q=90',
  'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=2560&q=90',
];

const pillars = [
  { letter: 'C', name: 'Clarity', icon: <TrendingUp size={22} />, description: 'Define your mission, vision, and theory of change so funders immediately understand your purpose and impact.' },
  { letter: 'S', name: 'Structure', icon: <Shield size={22} />, description: 'Build the governance foundation including board, bylaws, and policies that give funders confidence in your organization.' },
  { letter: 'H', name: 'Health', icon: <BarChart3 size={22} />, description: 'Demonstrate financial sustainability with diversified revenue, strong reserves, and transparent reporting.' },
  { letter: 'I', name: 'Impact', icon: <Award size={22} />, description: 'Measure, track, and communicate the tangible difference your programs make in your community.' },
  { letter: 'F', name: 'Funding', icon: <Zap size={22} />, description: 'Develop a proactive fundraising strategy with grant writing, donor cultivation, and diversified income streams.' },
  { letter: 'T', name: 'Transformation', icon: <Users size={22} />, description: 'Build capacity for growth, leadership succession, and long-term organizational sustainability.' },
];

const testimonials = [
  { quote: 'We have worked with over 90 founders and nonprofit leaders. Most know their mission. Few know how to build around it. The Fundability Framework is the rare exception. There is an instinct for people built into this work.', name: 'Pravina Pindoria', title: 'Tech Founder and Investor', sub: '90+ companies backed' },
  { quote: 'The team is knowledgeable, insightful, and listened to our organization\'s unique needs. They crafted a plan and materials that were spot on and delivered in record time. 10 out of 10 recommend.', name: 'Elizabeth K. Davis', title: 'Moving Forward Wellness Coaching', sub: '30 years in nonprofit' },
  { quote: 'The attention to detail and the commitment to results is outstanding. We secured two major grants within a month of working the Fundability Framework steps.', name: 'M. Smith', title: 'Nonprofit Leader', sub: '' },
];

const pricingPreview = [
  { name: 'Explorer', price: '$0', desc: 'Free forever', color: 'rgba(255,255,255,0.4)' },
  { name: 'Founding Member', price: '$24.99', desc: '/month', badge: 'Limited', color: BRAND.teal },
  { name: 'Growth Member', price: '$59.99', desc: '/month', badge: 'Popular', color: BRAND.teal },
  { name: 'Premium', price: '$97.99', desc: '/month', color: BRAND.gold },
];

/* ---- 3D Card ---- */
function Card3D({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = ref.current; if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px) scale(1.02)`;
    card.style.boxShadow = `${-x * 20}px ${Math.abs(y) * 20 + 12}px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(28,116,134,0.25)`;
  };
  const onLeave = () => {
    const card = ref.current; if (!card) return;
    card.style.transform = '';
    card.style.boxShadow = '';
  };
  return (
    <div ref={ref} className={`card-3d ${className}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

/* ---- Floating Orbs ---- */
function FloatingOrbs({ isDark = true }: { isDark?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {isDark ? (
        <>
          <div className="orb" style={{ width: 500, height: 500, background: 'rgba(28,116,134,0.15)', top: '-10%', left: '-5%', animationDuration: '22s' }} />
          <div className="orb" style={{ width: 350, height: 350, background: 'rgba(212,168,67,0.08)', top: '40%', right: '-8%', animationDuration: '28s', animationDelay: '-8s' }} />
          <div className="orb" style={{ width: 280, height: 280, background: 'rgba(28,116,134,0.1)', bottom: '-5%', left: '30%', animationDuration: '20s', animationDelay: '-4s' }} />
        </>
      ) : (
        <>
          <div className="orb" style={{ width: 400, height: 400, background: 'rgba(28,116,134,0.06)', top: '-10%', left: '-5%', animationDuration: '22s' }} />
          <div className="orb" style={{ width: 300, height: 300, background: 'rgba(212,168,67,0.05)', bottom: '10%', right: '-5%', animationDuration: '28s', animationDelay: '-8s' }} />
        </>
      )}
    </div>
  );
}

/* ---- Hero Carousel ---- */
function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [parallaxY, setParallaxY] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % HERO_IMAGES.length), 6500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setParallaxY(window.scrollY * 0.35);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {HERO_IMAGES.map((src, i) => (
        <div
          key={src}
          className="hero-slide"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            fetchPriority={i === 0 ? 'high' : 'low'}
            loading={i === 0 ? 'eager' : 'lazy'}
            style={{ transform: `translateY(${parallaxY}px) scale(1.12)`, willChange: 'transform', transformOrigin: 'center center' }}
          />
        </div>
      ))}
      {/* Overlay gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(13,18,19,0.88) 0%, rgba(28,116,134,0.18) 50%, rgba(13,18,19,0.82) 100%)' }} />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48" style={{ background: 'linear-gradient(to top, #0D1213, transparent)' }} />
    </div>
  );
}

/* ---- Parallax section wrapper ---- */
function useParallax(factor = 0.15) {
  const [y, setY] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const onScroll = useCallback(() => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) setY(rect.top * factor);
  }, [factor]);
  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);
  return { ref, y };
}

/* ---- Testimonial Carousel ---- */
function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % testimonials.length), 5500);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="testimonial-card p-8"
            style={{
              position: i === 0 ? 'relative' : 'absolute',
              inset: i === 0 ? undefined : 0,
              opacity: i === active ? 1 : 0,
              transform: i === active ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)',
              pointerEvents: i === active ? 'auto' : 'none',
            }}
          >
            <div className="flex gap-1 mb-4">
              {Array(5).fill(0).map((_, j) => <Star key={j} size={14} fill={BRAND.gold} style={{ color: BRAND.gold }} />)}
            </div>
            <blockquote className="text-base leading-relaxed italic mb-6" style={{ color: 'rgba(255,255,255,0.78)' }}>
              "{t.quote}"
            </blockquote>
            <div className="font-bold text-white">{t.name}</div>
            <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.title}</div>
            {t.sub && <div className="text-xs mt-0.5" style={{ color: BRAND.teal }}>{t.sub}</div>}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-6">
        {testimonials.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} className={`carousel-dot ${i === active ? 'active' : ''}`} aria-label={`Testimonial ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

/* ---- FAQ Accordion ---- */
const FAQ_ITEMS = [
  { q: 'Is the Fundability Assessment really free?', a: 'Yes, completely free. No credit card required. You receive your full score report across all six Fundability Framework pillars instantly after completion.' },
  { q: 'How long does the assessment take?', a: 'Most leaders complete it in under 10 minutes. There are 30 questions spread across six pillars, each taking about 90 seconds.' },
  { q: 'What is the Fundability Framework?', a: 'The Fundability Framework is our proprietary six-pillar system covering Clarity, Structure, Health, Impact, Funding, and Transformation. It is the backbone of every engagement we do at ClarityShift Impact Group and gives organizations a precise roadmap to becoming grant-ready.' },
  { q: 'What happens after I get my score?', a: 'You receive a detailed pillar-by-pillar report with personalized recommendations. You can then access the resource library, enroll in workshops, join the community, or work directly with our funding strategists to close your gaps.' },
  { q: 'Do I need to be a member to take the assessment?', a: 'No. The assessment is open to all nonprofit leaders at no cost. Membership unlocks expanded resources, workshops, community access, and direct strategy support.' },
  { q: 'What is White Glove service?', a: 'White Glove is our most intensive engagement. You receive a dedicated funding strategist, fully done-for-you grant writing and strategy materials, event planning support, and direct access to our senior team for six months.' },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="faq-item" style={{ marginBottom: '0.75rem' }}>
          <button className="faq-trigger" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span>{item.q}</span>
            <ChevronDown size={18} className={`faq-chevron ${open === i ? 'open' : ''}`} />
          </button>
          <div className={`faq-body ${open === i ? 'open' : ''}`}>
            <div className="faq-body-inner">{item.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Score bars preview ---- */
const PILLAR_SCORES = [
  { label: 'Clarity', score: 22, max: 25 },
  { label: 'Structure', score: 19, max: 25 },
  { label: 'Health', score: 18, max: 25 },
  { label: 'Impact', score: 20, max: 25 },
  { label: 'Funding', score: 17, max: 25 },
  { label: 'Transformation', score: 16, max: 25 },
];

export default function HomePage() {
  const { ref: stepRef, y: stepY } = useParallax(0.08);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>

      {/* ═══ HERO — Dark + teal atmosphere ═══ */}
      <section className="relative overflow-hidden" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <HeroCarousel />
        <FloatingOrbs />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-44">
          <div className="hero-text-stagger max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 glass-teal">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: BRAND.gold }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>Powered by ClarityShift Impact Group</span>
            </div>

            <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: BRAND.teal }}>
              Nonprofit Capacity Building Platform
            </p>

            <h1 className="heading-display text-white mb-6">
              Your Funding Problems.<br />
              <span className="gold-shimmer">Fixed.</span>
            </h1>

            <p className="text-xl leading-relaxed mb-10 max-w-2xl" style={{ color: 'rgba(255,255,255,0.68)' }}>
              Funding Fix by ClarityShift Impact Group gives nonprofit leaders the assessment, strategy, and support to become fully fundable.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/assessment" className="btn-gold">
                Take the Free Assessment
                <ArrowRight size={18} />
              </Link>
              <a href="#how-it-works" className="btn-ghost">
                See How It Works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              {['100% Free to Start', 'No Credit Card Required', 'Instant Results'].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle size={14} style={{ color: BRAND.teal }} />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Carousel dots */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
            <div className="scroll-dot" />
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR — Solid Teal ═══ */}
      <section className="section-teal relative overflow-hidden" style={{ padding: '2.5rem 0' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(ellipse 120% 80% at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggeredGroup className="grid grid-cols-2 md:grid-cols-4 gap-0" staggerMs={80}>
            {[
              { value: 500, suffix: '+', label: 'Organizations Served', prefix: '' },
              { value: 6, suffix: '', label: 'Funding Pillars', prefix: '' },
              { value: 94, suffix: '%', label: 'Success Rate', prefix: '' },
              { value: 2, suffix: 'M+', label: 'Grants Supported', prefix: '$' },
            ].map(stat => (
              <div key={stat.label} className="text-center py-4 px-6" style={{ borderRight: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="text-3xl font-bold text-white mb-1">
                  {stat.prefix}<AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>{stat.label}</div>
              </div>
            ))}
          </StaggeredGroup>
        </div>
      </section>

      {/* ═══ FUNDABILITY FRAMEWORK — Warm White ═══ */}
      <section className="section-warm section-padding relative overflow-hidden">
        <FloatingOrbs isDark={false} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" className="text-center mb-16">
            <p className="section-label justify-center" style={{ color: BRAND.teal }}>The Framework</p>
            <h2 className="heading-xl mb-4" style={{ color: '#0D1213' }}>The Fundability Framework</h2>
            <p className="max-w-2xl mx-auto text-lg" style={{ color: '#4B5563' }}>
              Six pillars that transform organizations into grant-ready, funder-confident powerhouses.
            </p>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((pillar, i) => (
              <AnimatedSection key={pillar.name} delay={i * 80} direction="up">
                <Card3D className="card-light h-full p-7">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl flex-shrink-0 icon-3d"
                      style={{ backgroundColor: BRAND.teal }}
                    >
                      {pillar.letter}
                    </div>
                    <div className="pt-1">
                      <div className="flex items-center gap-2 mb-0.5" style={{ color: BRAND.teal }}>
                        {pillar.icon}
                      </div>
                      <h3 className="font-extrabold text-xl leading-tight" style={{ color: '#0D1213' }}>{pillar.name}</h3>
                    </div>
                  </div>
                  <div className="h-px mb-4" style={{ background: 'rgba(0,0,0,0.06)' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{pillar.description}</p>
                </Card3D>
              </AnimatedSection>
            ))}
          </div>
          <AnimatedSection delay={200} className="text-center mt-12">
            <Link to="/assessment" className="btn-primary">
              See How You Score Across All Six Pillars
              <ArrowRight size={18} />
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ HOW IT WORKS — Deep Black + Gold Atmosphere ═══ */}
      <section
        ref={stepRef as React.RefObject<HTMLElement>}
        id="how-it-works"
        className="section-dark section-padding relative overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 80% 50%, rgba(212,168,67,0.12) 0%, transparent 60%)' }}
      >
        <FloatingOrbs />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ transform: `translateY(${stepY}px)`, willChange: 'transform' }}>
          <AnimatedSection direction="up" className="text-center mb-16">
            <p className="section-label justify-center">How It Works</p>
            <h2 className="heading-xl text-white mb-4">Three Steps to Fundable</h2>
            <p className="max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>No guesswork. No wasted time. A clear path from assessment to funded.</p>
          </AnimatedSection>
          <div className="space-y-10">
            {[
              { step: 1, title: 'Take the Assessment', desc: 'Complete our 30-question Fundability Assessment and receive your personalized score instantly. Each of the six Fundability Framework pillars is scored separately so you know exactly where you stand.', img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80' },
              { step: 2, title: 'Get Your Action Plan', desc: 'Receive a detailed, pillar-by-pillar report with prioritized recommendations tailored specifically to your organization. Know which gaps to close first for the fastest funding impact.', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80' },
              { step: 3, title: 'Build and Track Progress', desc: 'Access workshops, a curated resource library, and dedicated funding strategy support to systematically close your gaps, build capacity, and become fully fundable over time.', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80' },
            ].map((s, i) => (
              <AnimatedSection key={s.step} delay={i * 120} direction="up">
                <div className={`flex flex-col lg:flex-row gap-8 items-center ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
                  {/* Image */}
                  <div className="lg:w-1/2 w-full">
                    <div className="img-3d">
                      <img src={s.img} alt={s.title} className="w-full object-cover" style={{ height: 320 }} loading="lazy" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(13,18,19,0.3) 0%, transparent 60%)' }} />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="lg:w-1/2 w-full">
                    <div className="mb-4">
                      <span className="step-number-large" style={{ color: '#1C7486', opacity: 0.9 }}>{String(s.step).padStart(2, '0')}</span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-white mb-4 leading-tight">{s.title}</h3>
                    <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{s.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SCORE PREVIEW — White ═══ */}
      <section className="section-white section-padding relative overflow-hidden">
        <FloatingOrbs isDark={false} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection direction="left">
              <p className="section-label" style={{ color: BRAND.teal }}>Your Score</p>
              <h2 className="heading-xl mb-6" style={{ color: '#0D1213' }}>Know Exactly Where You Stand</h2>
              <p className="leading-relaxed mb-8 text-lg" style={{ color: '#4B5563' }}>
                The Fundability Assessment scores your organization across all six pillars and shows you a precise roadmap to becoming grant-ready.
              </p>
              <div className="divider-teal" />
              <div className="mt-8 grid grid-cols-2 gap-4 mb-8">
                {[
                  { label: 'Organizations assessed', val: '500+' },
                  { label: 'Avg. score improvement', val: '41%' },
                  { label: 'Grants secured', val: '$2M+' },
                  { label: 'Time to results', val: '30 min' },
                ].map(item => (
                  <div key={item.label} className="card-light p-4">
                    <div className="text-2xl font-bold mb-1" style={{ color: BRAND.teal }}>{item.val}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>{item.label}</div>
                  </div>
                ))}
              </div>
              <Link to="/assessment" className="btn-primary">
                Get My Score Now
                <ArrowRight size={18} />
              </Link>
            </AnimatedSection>
            <AnimatedSection direction="right" delay={100}>
              <Card3D className="card-light p-8">
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold mb-1" style={{ color: BRAND.teal }}>112</div>
                  <div className="text-sm" style={{ color: '#6B7280' }}>out of 150</div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.gold }}>Grant Ready</div>
                </div>
                <div className="space-y-4">
                  {PILLAR_SCORES.map(p => (
                    <div key={p.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span style={{ color: '#374151' }}>{p.label}</span>
                        <span style={{ color: BRAND.teal, fontWeight: 600 }}>{p.score}/{p.max}</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.08)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(p.score / p.max) * 100}%`, background: `linear-gradient(90deg, ${BRAND.teal}, ${BRAND.gold})` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card3D>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══ PRICING PREVIEW — Deep Teal gradient ═══ */}
      <section className="section-deep-teal section-padding relative overflow-hidden">
        <FloatingOrbs />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" className="text-center mb-14">
            <p className="section-label justify-center">Membership</p>
            <h2 className="heading-xl text-white mb-3">Choose Your Path to Fundable</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>Start free. Scale as you grow.</p>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {pricingPreview.map((tier, i) => (
              <AnimatedSection key={tier.name} delay={i * 80} direction="up">
                <Card3D className={`card-teal h-full p-6 text-center ${i === 2 ? 'ring-2 ring-offset-0' : ''}`} style={i === 2 ? { '--tw-ring-color': BRAND.gold } as React.CSSProperties : {}}>
                  {tier.badge && (
                    <div className="badge-gold mb-3 mx-auto w-fit">{tier.badge}</div>
                  )}
                  <div className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: i === 3 ? BRAND.gold : 'rgba(255,255,255,0.6)' }}>{tier.name}</div>
                  <div className="flex items-baseline justify-center gap-0.5 mb-1">
                    <span className="text-3xl font-bold text-white">{tier.price}</span>
                    {tier.desc && <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{tier.desc}</span>}
                  </div>
                </Card3D>
              </AnimatedSection>
            ))}
          </div>
          <div className="text-center">
            <Link to="/pricing" className="btn-gold">
              View All Plans
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS — Pure Deep Black ═══ */}
      <section className="section-black section-padding relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 20% 55%, rgba(28,116,134,0.14) 0%, transparent 60%)' }}>
        <FloatingOrbs />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" className="text-center mb-14">
            <p className="section-label justify-center">Social Proof</p>
            <h2 className="heading-xl text-white">What Nonprofit Leaders Are Saying</h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3">
              <AnimatedSection direction="left">
                <TestimonialCarousel />
              </AnimatedSection>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <AnimatedSection direction="right" delay={100}>
                <div className="card-premium p-6">
                  <div className="text-4xl font-bold mb-1" style={{ color: BRAND.gold }}>94%</div>
                  <div className="text-sm text-white/60">of members report measurable funding progress within 90 days</div>
                </div>
              </AnimatedSection>
              <AnimatedSection direction="right" delay={180}>
                <div className="card-premium p-6">
                  <div className="text-4xl font-bold mb-1" style={{ color: BRAND.teal }}>500+</div>
                  <div className="text-sm text-white/60">nonprofit leaders have used the Fundability Framework</div>
                </div>
              </AnimatedSection>
              <AnimatedSection direction="right" delay={260}>
                <div className="card-premium p-6">
                  <div className="text-4xl font-bold mb-1 text-white">$2M+</div>
                  <div className="text-sm text-white/60">in grants supported through the platform</div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ — White ═══ */}
      <section className="section-white section-padding relative overflow-hidden">
        <FloatingOrbs isDark={false} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection direction="up" className="text-center mb-12">
            <p className="section-label justify-center" style={{ color: BRAND.teal }}>Common Questions</p>
            <h2 className="heading-xl mb-4" style={{ color: '#0D1213' }}>Frequently Asked Questions</h2>
            <p style={{ color: '#4B5563' }}>Everything you need to know before you get started.</p>
          </AnimatedSection>
          <AnimatedSection direction="up" delay={80}>
            <FaqAccordion />
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ BOTTOM CTA — Solid Teal ═══ */}
      <section className="section-teal section-padding relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2560&q=60)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.06 }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.gold }} />
              <span className="text-sm font-medium text-white">Free Assessment Available Now</span>
            </div>
            <h2 className="heading-xl text-white mb-6">
              Start Your Journey to Winning Grants Today
            </h2>
            <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Join 500+ nonprofit leaders who have transformed their fundability with the Fundability Framework.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/assessment" className="btn-gold">
                Take the Free Assessment
                <ArrowRight size={20} />
              </Link>
              <Link to="/pricing" className="btn-ghost">
                View Membership Plans
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
