import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, CheckCircle, User, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PILLARS, ASSESSMENT_QUESTIONS, Pillar } from '../lib/types';
import { AnimatedSection } from '../components/AnimatedSection';

type Step = 'intro' | 'info' | Pillar | 'submitting';
const PILLAR_KEYS: Pillar[] = ['clarity', 'structure', 'health', 'impact', 'funding', 'transformation'];

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [userInfo, setUserInfo] = useState({ full_name: '', email: '', organization_name: '' });
  const [answers, setAnswers] = useState<Record<Pillar, number[]>>({
    clarity: [0, 0, 0, 0, 0], structure: [0, 0, 0, 0, 0], health: [0, 0, 0, 0, 0],
    impact: [0, 0, 0, 0, 0], funding: [0, 0, 0, 0, 0], transformation: [0, 0, 0, 0, 0],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentPillarIndex = PILLAR_KEYS.indexOf(step as Pillar);
  const currentPillar = PILLARS.find(p => p.key === step);

  function setAnswer(pillar: Pillar, qIdx: number, score: number) {
    setAnswers(prev => ({ ...prev, [pillar]: prev[pillar].map((v, i) => (i === qIdx ? score : v)) }));
  }

  function canAdvancePillar() {
    if (step === 'intro' || step === 'submitting') return true;
    if (step === 'info') return userInfo.full_name.trim() !== '' && userInfo.email.trim() !== '' && userInfo.organization_name.trim() !== '';
    return answers[step as Pillar].every(a => a > 0);
  }

  function handleNext() {
    setError('');
    if (step === 'intro') { setStep('info'); return; }
    if (step === 'info') {
      if (!canAdvancePillar()) { setError('Please fill in all fields.'); return; }
      setStep('clarity'); return;
    }
    if (!canAdvancePillar()) { setError('Please answer all questions before continuing.'); return; }
    const idx = currentPillarIndex;
    if (idx < PILLAR_KEYS.length - 1) setStep(PILLAR_KEYS[idx + 1]);
    else handleSubmit();
  }

  function handleBack() {
    setError('');
    if (step === 'info') { setStep('intro'); return; }
    if (step === 'clarity') { setStep('info'); return; }
    const idx = currentPillarIndex;
    if (idx > 0) setStep(PILLAR_KEYS[idx - 1]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setStep('submitting');
    try {
      const pillarScores = PILLAR_KEYS.reduce((acc, key) => {
        acc[`${key}_score`] = answers[key].reduce((s, v) => s + v, 0);
        return acc;
      }, {} as Record<string, number>);
      const total = Object.values(pillarScores).reduce((s, v) => s + v, 0);
      const { data: assessment, error: aErr } = await supabase
        .from('assessments')
        .insert({ email: userInfo.email, full_name: userInfo.full_name, organization_name: userInfo.organization_name, total_score: total, ...pillarScores, status: 'completed', completed_at: new Date().toISOString() })
        .select().single();
      if (aErr || !assessment) throw new Error(aErr?.message || 'Failed to save assessment');
      const answerRows = PILLAR_KEYS.flatMap(pillar =>
        ASSESSMENT_QUESTIONS[pillar].map((q, i) => ({ assessment_id: assessment.id, pillar, question_index: i, question_text: q, score: answers[pillar][i] }))
      );
      await supabase.from('assessment_answers').insert(answerRows);
      navigate(`/results/${assessment.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setStep(PILLAR_KEYS[PILLAR_KEYS.length - 1]);
      setSubmitting(false);
    }
  }

  const progress = step === 'intro' ? 0 : step === 'info' ? 10 : step === 'submitting' ? 100 : Math.round(((currentPillarIndex + 1) / PILLAR_KEYS.length) * 90) + 10;

  const inputStyle = {
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.12)',
    color: '#0D1213',
    outline: 'none',
    transition: 'all 0.2s ease',
    borderRadius: '12px',
  };
  const inputCls = 'w-full px-4 py-3.5 text-sm placeholder:text-black/30 focus:ring-2 focus:ring-teal-500/30';

  return (
    <div className="min-h-screen section-white relative overflow-hidden">
      {/* Progress Header */}
      <div className="sticky top-0 z-20" style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-base font-bold" style={{ color: '#0D1213' }}>Nonprofit Fundability Assessment</h1>
              <p className="text-xs" style={{ color: '#6B7280' }}>6 Pillars · 30 Questions · ~10 Minutes</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold" style={{ color: '#1C7486' }}>{progress}%</span>
              <div className="text-xs" style={{ color: '#6B7280' }}>Complete</div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          {step !== 'intro' && step !== 'info' && step !== 'submitting' && (
            <div className="flex gap-1.5 mt-3">
              {PILLAR_KEYS.map((k, i) => {
                const pi = PILLARS.find(p => p.key === k)!;
                const isActive = k === step;
                const isDone = i < currentPillarIndex;
                return (
                  <div key={k} className="flex items-center gap-1.5 flex-1">
                    <div
                      className="h-1.5 w-full rounded-full transition-all duration-500"
                      style={{ backgroundColor: (isActive || isDone) ? pi.color : 'rgba(0,0,0,0.08)' }}
                    />
                    {isActive && (
                      <span className="text-xs font-medium hidden sm:block whitespace-nowrap" style={{ color: pi.color }}>{pi.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* INTRO */}
        {step === 'intro' && (
          <AnimatedSection direction="up">
            <div className="card-light overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ height: 220, position: 'relative', overflow: 'hidden' }}>
                <img
                  src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80"
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.7 }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(255,255,255,0.95) 100%)' }} />
                <div className="absolute bottom-6 left-8 right-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ background: 'rgba(28,116,134,0.12)', border: '1px solid rgba(28,116,134,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-xs font-medium" style={{ color: '#1C7486' }}>Free Assessment</span>
                  </div>
                </div>
              </div>
              <div className="p-8 sm:p-10">
                <h2 className="heading-lg mb-3" style={{ color: '#0D1213' }}>Nonprofit Fundability Assessment</h2>
                <p className="leading-relaxed mb-8 text-base" style={{ color: '#4B5563' }}>
                  Discover exactly where your organization stands across the six Fundability Framework pillars and get a customized action plan to close your funding gaps.
                </p>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { label: '30 Questions', sub: 'Across 6 pillars' },
                    { label: '~10 Minutes', sub: 'To complete' },
                    { label: 'Free Report', sub: 'Emailed instantly' },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(28,116,134,0.06)', border: '1px solid rgba(28,116,134,0.12)' }}>
                      <div className="font-bold text-sm" style={{ color: '#0D1213' }}>{item.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5 mb-8">
                  {[
                    'Your overall Fundability Score (out of 150)',
                    'Individual scores across all 6 Fundability Framework pillars',
                    'Color-coded ratings and gap analysis',
                    'Tailored recommendations for each pillar',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2.5 text-sm" style={{ color: '#374151' }}>
                      <CheckCircle size={15} style={{ color: '#1C7486', flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                </div>
                <button onClick={handleNext} className="btn-gold text-base px-8 py-4 w-full sm:w-auto justify-center">
                  Start Free Assessment
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* INFO */}
        {step === 'info' && (
          <AnimatedSection direction="up">
            <div className="card-light overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(135deg, rgba(28,116,134,0.06) 0%, transparent 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1C7486' }}>
                    <User size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: '#0D1213' }}>Tell Us About Yourself</h2>
                    <p className="text-xs" style={{ color: '#6B7280' }}>Your results will be emailed to you instantly</p>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>Full Name *</label>
                  <input type="text" value={userInfo.full_name} onChange={e => setUserInfo(p => ({ ...p, full_name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>Email Address *</label>
                  <input type="email" value={userInfo.email} onChange={e => setUserInfo(p => ({ ...p, email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="jane@yourorg.org" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>Organization Name *</label>
                  <div className="relative">
                    <Building size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.3)' }} />
                    <input type="text" value={userInfo.organization_name} onChange={e => setUserInfo(p => ({ ...p, organization_name: e.target.value }))} className={inputCls} style={{ ...inputStyle, paddingLeft: '2.75rem' }} placeholder="Your Nonprofit Organization" />
                  </div>
                </div>
                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#DC2626' }}>
                    {error}
                  </div>
                )}
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* PILLAR QUESTIONS */}
        {PILLAR_KEYS.includes(step as Pillar) && currentPillar && (
          <AnimatedSection direction="up">
            <div className="card-light overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: `linear-gradient(135deg, ${currentPillar.color}0d 0%, transparent 100%)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: currentPillar.color }}>
                    {currentPillar.label[0]}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Pillar {currentPillarIndex + 1} of 6</div>
                    <h2 className="text-xl font-bold" style={{ color: '#0D1213' }}>{currentPillar.label}</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{currentPillar.description}</p>
                  </div>
                </div>
                {/* Answered indicator */}
                <div className="flex gap-1.5 mt-4">
                  {answers[step as Pillar].map((a, i) => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300" style={{ backgroundColor: a > 0 ? currentPillar.color : 'rgba(0,0,0,0.08)' }} />
                  ))}
                </div>
              </div>
              <div className="p-8 space-y-10">
                {ASSESSMENT_QUESTIONS[step as Pillar].map((question, i) => (
                  <AnimatedSection key={i} delay={i * 60} direction="up">
                    <div>
                      <p className="font-medium mb-5 leading-relaxed" style={{ color: '#1F2937' }}>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2 flex-shrink-0" style={{ backgroundColor: currentPillar.color, color: '#fff' }}>{i + 1}</span>
                        {question}
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(score => {
                          const labels = ['', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always'];
                          const isSelected = answers[step as Pillar][i] === score;
                          return (
                            <button
                              key={score}
                              onClick={() => setAnswer(step as Pillar, i, score)}
                              className="flex flex-col items-center gap-1.5 px-2 py-3.5 rounded-xl transition-all duration-200 hover:scale-105"
                              style={isSelected
                                ? { backgroundColor: currentPillar.color, border: `2px solid ${currentPillar.color}`, color: '#FFFFFF', boxShadow: `0 4px 20px ${currentPillar.color}40` }
                                : { background: 'rgba(0,0,0,0.03)', border: '2px solid rgba(0,0,0,0.08)', color: '#374151' }}
                            >
                              <span className="font-bold text-lg">{score}</span>
                              <span className="text-xs font-medium">{labels[score]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
              {error && (
                <div className="px-8 pb-4">
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#DC2626' }}>
                    {error}
                  </div>
                </div>
              )}
            </div>
          </AnimatedSection>
        )}

        {/* SUBMITTING */}
        {step === 'submitting' && (
          <AnimatedSection direction="up">
            <div className="card-light p-16 text-center" style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              <div className="w-20 h-20 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(28,116,134,0.1), rgba(212,168,67,0.06))', border: '1px solid rgba(28,116,134,0.2)' }}>
                <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid rgba(28,116,134,0.15)', borderTopColor: '#1C7486' }} />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: '#0D1213' }}>Calculating Your Score...</h2>
              <p style={{ color: '#6B7280' }}>Please wait while we analyze your responses across all six pillars.</p>
              <div className="mt-8 flex justify-center gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#1C7486', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Navigation */}
        {step !== 'submitting' && (
          <div className="flex items-center justify-between mt-6">
            {step !== 'intro' ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-xl transition-all"
                style={{ color: '#374151', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.03)' }}
              >
                <ChevronLeft size={18} /> Back
              </button>
            ) : <div />}
            <button onClick={handleNext} disabled={submitting} className="btn-primary disabled:opacity-50">
              {step === PILLAR_KEYS[PILLAR_KEYS.length - 1] ? 'Submit and Get My Score' : step === 'info' ? 'Start Assessment' : 'Next Pillar'}
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
