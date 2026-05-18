import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Download, ArrowRight, CheckCircle, AlertTriangle, XCircle, TrendingUp, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Assessment, PILLARS, Pillar } from '../lib/types';
import { AnimatedSection } from '../components/AnimatedSection';
import { ScoreRing } from '../components/GlassPanelComponents';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843', white: '#FFFFFF' };

function getScoreRating(score: number, max: number): { label: string; color: string; bg: string; icon: React.ReactNode } {
  const pct = score / max;
  if (pct >= 0.8) return { label: 'Strong', color: '#1C7486', bg: 'rgba(28,116,134,0.15)', icon: <CheckCircle size={14} /> };
  if (pct >= 0.6) return { label: 'Developing', color: '#D4A843', bg: 'rgba(212,168,67,0.15)', icon: <TrendingUp size={14} /> };
  if (pct >= 0.4) return { label: 'Needs Attention', color: '#D4A843', bg: 'rgba(212,168,67,0.1)', icon: <AlertTriangle size={14} /> };
  return { label: 'Critical Gap', color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.08)', icon: <XCircle size={14} /> };
}

function getTotalRating(score: number): { label: string; color: string; description: string } {
  const pct = score / 150;
  if (pct >= 0.8) return { label: 'Grant-Ready', color: '#1C7486', description: 'Your organization demonstrates strong fundability across all pillars. Focus on maintaining excellence and pursuing stretch opportunities.' };
  if (pct >= 0.6) return { label: 'Developing', color: '#D4A843', description: 'You have a solid foundation with clear areas for improvement. Targeted work in your lower-scoring pillars will significantly increase your fundability.' };
  if (pct >= 0.4) return { label: 'Building Foundation', color: '#D4A843', description: 'Your organization is in the process of building funding readiness. Several critical gaps need attention before major grant applications.' };
  return { label: 'Early Stage', color: 'rgba(255,255,255,0.7)', description: 'Your organization has significant work to do to become grant-ready. This is normal for newer organizations. The Fundability Framework will guide your journey.' };
}

const PILLAR_RECOMMENDATIONS: Record<Pillar, { high: string; mid: string; low: string }> = {
  clarity: {
    high: 'Your mission clarity is a major strength. Document your theory of change in grant applications and use it to anchor all funder communications.',
    mid: 'Strengthen your mission statement and document your theory of change. Schedule a board retreat to align on organizational direction and long-term vision.',
    low: 'Clarity is your most urgent priority. Work with your board to craft a compelling, concise mission statement and develop a written theory of change before approaching any funders.',
  },
  structure: {
    high: 'Your governance structure is solid. Ensure your board composition continues to reflect your community and refresh your policies annually.',
    mid: 'Review and update your bylaws. Formalize key policies (conflict of interest, financial controls) and clarify board roles and term limits.',
    low: 'Structural gaps will prevent most funders from awarding grants. Prioritize your legal compliance, update bylaws, and build a functioning board before applying for grants.',
  },
  health: {
    high: 'Strong financial health is a major competitive advantage. Maintain your reserve fund, continue diversifying revenue, and document your financial practices for funders.',
    mid: 'Build your operating reserve to at least 3 months of expenses. Develop a revenue diversification strategy and ensure monthly financial reporting to your board.',
    low: 'Financial health issues are a red flag for funders. Work with a capacity building and funding strategy specialist to stabilize your budget, build reserves, and diversify income before applying for grants.',
  },
  impact: {
    high: 'Your impact measurement is compelling. Continue refining your data storytelling and use both quantitative data and stories to make your case to funders.',
    mid: 'Formalize your data collection and create a simple outcomes tracking system. Develop 2 to 3 key performance indicators per program that align with funder priorities.',
    low: "Funders want proof of impact. Develop a basic data collection system, identify your key outcomes, and begin gathering evidence of your program's effectiveness immediately.",
  },
  funding: {
    high: 'Your funding strategy is well-developed. Continue cultivating funder relationships, track your grant calendar carefully, and build out your individual donor program.',
    mid: 'Develop a written fundraising plan and grant calendar. Research 10 to 15 funders aligned with your mission and begin building those relationships before submitting applications.',
    low: 'A lack of funding strategy explains most funding challenges. Start with a basic grant research process, build a list of aligned funders, and invest in grant writing capacity.',
  },
  transformation: {
    high: 'Your capacity for transformation is a significant strength. Document your organizational learning processes and use them to attract capacity-building grants.',
    mid: 'Develop a succession plan for key roles and invest in leadership development. Explore capacity-building grant opportunities to strengthen your organizational infrastructure.',
    low: "Organizational transformation requires intentional investment. Prioritize board and staff development, build partnerships, and consider capacity building and funding strategy services to accelerate your growth.",
  },
};

function getRecommendation(pillar: Pillar, score: number): string {
  const pct = score / 25;
  if (pct >= 0.7) return PILLAR_RECOMMENDATIONS[pillar].high;
  if (pct >= 0.45) return PILLAR_RECOMMENDATIONS[pillar].mid;
  return PILLAR_RECOMMENDATIONS[pillar].low;
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase.from('assessments').select('*').eq('id', id).maybeSingle().then(({ data, error: e }) => {
      if (e || !data) setError('Results not found.');
      else setAssessment(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen section-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full animate-spin mx-auto mb-4" style={{ border: '3px solid rgba(28,116,134,0.3)', borderTopColor: '#1C7486' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen section-black flex items-center justify-center">
        <div className="card-premium p-10 text-center max-w-md">
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>{error || 'Results not found.'}</p>
          <Link to="/assessment" className="btn-primary">Take Assessment</Link>
        </div>
      </div>
    );
  }

  const totalRating = getTotalRating(assessment.total_score);
  const pillarData = PILLARS.map(p => ({ ...p, score: assessment[`${p.key}_score` as keyof Assessment] as number, max: 25 }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="orb" style={{ width: 700, height: 700, background: 'rgba(28,116,134,0.08)', top: '-20%', left: '-10%', animationDuration: '28s' }} />
        <div className="orb" style={{ width: 500, height: 500, background: 'rgba(212,168,67,0.06)', bottom: '-10%', right: '-10%', animationDuration: '32s', animationDelay: '-10s' }} />
      </div>

      {/* ═══ HERO SCORE — Dark + teal ═══ */}
      <section className="relative overflow-hidden section-padding" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,116,134,0.18) 0%, transparent 70%)' }}>
        <div className="relative max-w-5xl mx-auto px-4">
          <AnimatedSection direction="up" className="text-center mb-12">
            <div className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {assessment.organization_name}
            </div>
            <h1 className="heading-xl text-white mb-2">Your Fundability Assessment Results</h1>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>Based on the Fundability Framework</p>
          </AnimatedSection>

          <AnimatedSection direction="up" delay={100} className="flex justify-center mb-12">
            <div className="card-premium p-10 text-center max-w-xs w-full relative overflow-hidden">
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 100% 60% at 50% 0%, ${totalRating.color}12, transparent 70%)` }} />
              <div className="relative">
                <ScoreRing score={assessment.total_score} max={150} size={180} color={totalRating.color} label="out of 150" />
                <div
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold"
                  style={{ backgroundColor: totalRating.color + '20', color: totalRating.color, border: `1px solid ${totalRating.color}30` }}
                >
                  <Star size={13} fill="currentColor" />
                  {totalRating.label}
                </div>
                <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {totalRating.description}
                </p>
              </div>
            </div>
          </AnimatedSection>

          {/* Quick pillar overview */}
          <AnimatedSection direction="up" delay={150}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {pillarData.map(p => {
                const rating = getScoreRating(p.score, p.max);
                return (
                  <div key={p.key} className="card-premium p-4 text-center">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mx-auto mb-2" style={{ backgroundColor: p.color }}>
                      {p.label[0]}
                    </div>
                    <div className="text-lg font-bold" style={{ color: rating.color }}>{p.score}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>/ {p.max}</div>
                    <div className="text-xs font-medium mt-1 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.label}</div>
                  </div>
                );
              })}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ PILLAR BREAKDOWN — Warm White ═══ */}
      <section className="section-warm section-padding">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection direction="up">
            <p className="section-label" style={{ color: BRAND.teal }}>Detailed Results</p>
            <h2 className="heading-lg mb-8" style={{ color: '#0D1213' }}>Pillar by Pillar Breakdown</h2>
            <div className="space-y-5">
              {pillarData.map(p => {
                const rating = getScoreRating(p.score, p.max);
                return (
                  <div key={p.key} className="card-light p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: p.color }}>
                          {p.label[0]}
                        </div>
                        <span className="font-bold text-lg" style={{ color: '#0D1213' }}>{p.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: rating.bg, color: rating.color }}>
                          {rating.icon}
                          {rating.label}
                        </div>
                        <span className="text-sm font-bold" style={{ color: '#374151' }}>{p.score} / {p.max}</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(p.score / p.max) * 100}%`, background: `linear-gradient(90deg, ${p.color}, ${p.color}CC)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ RECOMMENDATIONS — Dark + gold ═══ */}
      <section className="section-dark-gold section-padding relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 80% 50%, rgba(212,168,67,0.1) 0%, transparent 60%)' }}>
        <div className="relative max-w-4xl mx-auto px-4">
          <AnimatedSection direction="up">
            <p className="section-label">Action Plan</p>
            <h2 className="heading-lg text-white mb-8">Your Personalized Recommendations</h2>
            <div className="space-y-4">
              {pillarData.sort((a, b) => a.score - b.score).map(p => {
                const rating = getScoreRating(p.score, p.max);
                const rec = getRecommendation(p.key, p.score);
                return (
                  <AnimatedSection key={p.key} direction="up">
                    <div className="card-premium p-6" style={{ borderLeft: `3px solid ${p.color}` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>
                          {p.label[0]}
                        </div>
                        <span className="font-bold text-white">{p.label}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: rating.bg, color: rating.color }}>
                          {rating.label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{rec}</p>
                    </div>
                  </AnimatedSection>
                );
              })}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ NEXT STEPS — White ═══ */}
      <section className="section-white section-padding">
        <div className="max-w-4xl mx-auto px-4">
          <AnimatedSection direction="up" className="text-center mb-10">
            <h2 className="heading-lg mb-2" style={{ color: '#0D1213' }}>Your Next Steps</h2>
            <p style={{ color: '#4B5563' }}>Turn your results into action with these resources.</p>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { step: '1', title: 'Access the Resource Library', desc: 'Download templates, guides, and tools mapped to your lowest-scoring pillars.', href: '/resources', internal: true, color: BRAND.teal },
              { step: '2', title: 'Join a Workshop', desc: 'Our workshops walk you through fixing every gap identified in your assessment.', href: '/workshop', internal: true, color: BRAND.teal },
              { step: '3', title: 'Book a Free Strategy Call', desc: 'Talk with a funding strategist about your results and get a custom action plan.', href: 'https://calendly.com/taylordin77/new-meeting', internal: false, color: BRAND.gold },
            ].map(item => (
              <AnimatedSection key={item.step} direction="up" delay={parseInt(item.step) * 80}>
                <div className="card-light p-6 h-full flex flex-col">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mb-4 flex-shrink-0" style={{ backgroundColor: item.color }}>
                    {item.step}
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: '#0D1213' }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: '#6B7280' }}>{item.desc}</p>
                  {item.internal ? (
                    <Link to={item.href} className="flex items-center gap-1 text-sm font-semibold" style={{ color: item.color }}>
                      Learn more <ArrowRight size={13} />
                    </Link>
                  ) : (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-semibold" style={{ color: item.color }}>
                      Book now <ArrowRight size={13} />
                    </a>
                  )}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA — Solid Teal ═══ */}
      <section className="section-teal section-padding relative overflow-hidden">
        <div className="absolute inset-0 opacity-8" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <Calendar size={40} className="mx-auto mb-6" style={{ color: 'rgba(255,255,255,0.6)' }} />
            <h2 className="heading-xl text-white mb-4">Book Your Free Strategy Call</h2>
            <p className="text-lg mb-10 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Ready to turn your results into action? Book a free 30-minute strategy call with a funding strategist and get a personalized plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://calendly.com/taylordin77/new-meeting" target="_blank" rel="noopener noreferrer" className="btn-gold">
                <Calendar size={16} />
                Book Free Strategy Call
              </a>
              <Link to="/pricing" className="btn-ghost">
                View Membership Plans <ArrowRight size={16} />
              </Link>
            </div>
            <button className="mt-6 inline-flex items-center gap-2 text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Download size={13} />
              Download PDF Report
            </button>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
