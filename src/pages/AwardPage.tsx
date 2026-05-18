import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle, Star, Users, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', black: '#0A0A0A', gold: '#D4A843', white: '#FFFFFF' };

interface EligibleMember {
  id: string;
  organization_name: string;
  post_count?: number;
}

interface NominationForm {
  nominee_id: string;
  reason: string;
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
};

export default function AwardPage() {
  const { user, profile } = useAuth();
  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [nominations, setNominations] = useState<{ nominee_id: string; count: number; organization_name: string }[]>([]);
  const [myNomination, setMyNomination] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [form, setForm] = useState<NominationForm>({ nominee_id: '', reason: '' });
  const [nominating, setNominating] = useState(false);
  const [voting, setVoting] = useState(false);
  const [nominationSuccess, setNominationSuccess] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [error, setError] = useState('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function load() {
      const { data: postData } = await supabase
        .from('blog_posts')
        .select('author_id, profiles(id, organization_name)')
        .eq('status', 'published')
        .gte('published_at', `${currentYear}-01-01`);

      if (postData) {
        const counts: Record<string, { id: string; org: string; count: number }> = {};
        (postData as unknown as { author_id: string; profiles: { id: string; organization_name: string } }[]).forEach(p => {
          if (!p.profiles) return;
          const id = p.profiles.id;
          if (!counts[id]) counts[id] = { id, org: p.profiles.organization_name, count: 0 };
          counts[id].count++;
        });
        setEligibleMembers(
          Object.values(counts)
            .filter(m => m.count >= 3)
            .map(m => ({ id: m.id, organization_name: m.org, post_count: m.count }))
        );
      }

      const { data: nomData } = await supabase
        .from('award_nominations')
        .select('nominee_id, profiles!award_nominations_nominee_id_fkey(organization_name)')
        .eq('award_year', currentYear);

      if (nomData) {
        const grouped: Record<string, { count: number; org: string }> = {};
        (nomData as unknown as { nominee_id: string; profiles: { organization_name: string } }[]).forEach(n => {
          if (!grouped[n.nominee_id]) grouped[n.nominee_id] = { count: 0, org: n.profiles?.organization_name || '' };
          grouped[n.nominee_id].count++;
        });
        setNominations(Object.entries(grouped).map(([id, v]) => ({ nominee_id: id, count: v.count, organization_name: v.org })));
      }

      if (user) {
        const { data: myNom } = await supabase
          .from('award_nominations')
          .select('nominee_id')
          .eq('nominator_id', user.id)
          .eq('award_year', currentYear)
          .maybeSingle();
        if (myNom) setMyNomination((myNom as { nominee_id: string }).nominee_id);

        const { data: myVoteData } = await supabase
          .from('award_votes')
          .select('nominee_id')
          .eq('voter_id', user.id)
          .eq('award_year', currentYear)
          .maybeSingle();
        if (myVoteData) setMyVote((myVoteData as { nominee_id: string }).nominee_id);
      }
    }
    load();
  }, [user, currentYear]);

  async function handleNominate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.nominee_id) { setError('Please select a nominee.'); return; }
    setNominating(true);
    const { error: dbErr } = await supabase.from('award_nominations').insert({
      nominator_id: user!.id,
      nominee_id: form.nominee_id,
      award_year: currentYear,
      reason: form.reason,
    });
    if (dbErr) {
      setError(dbErr.message.includes('unique') ? 'You have already submitted a nomination this year.' : 'Nomination failed. Please try again.');
    } else {
      setMyNomination(form.nominee_id);
      setNominationSuccess(true);
    }
    setNominating(false);
  }

  async function handleVote(nomineeId: string) {
    setError('');
    setVoting(true);
    const { error: dbErr } = await supabase.from('award_votes').insert({
      voter_id: user!.id,
      nominee_id: nomineeId,
      award_year: currentYear,
    });
    if (dbErr) {
      setError(dbErr.message.includes('unique') ? 'You have already voted this year.' : 'Vote failed. Please try again.');
    } else {
      setMyVote(nomineeId);
      setVoteSuccess(true);
    }
    setVoting(false);
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Hero */}
      <div className="relative overflow-hidden py-20" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, rgba(212,168,67,0.08) 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(212,168,67,0.06) 0%, transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: BRAND.gold + '18', border: `1px solid ${BRAND.gold}30` }}>
              <Award size={32} style={{ color: BRAND.gold }} />
            </div>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.gold }}>Annual Recognition</div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Annual C-SHIFT Member Contribution Award</h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Honoring the member whose writing and community contribution has most advanced the mission of nonprofit sustainability.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ border: `1px solid ${BRAND.gold}35`, color: BRAND.gold }}>
              <Calendar size={13} />
              Winner announced at the Mission to Money Summit
            </div>
          </AnimatedSection>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">

        {/* About the Award */}
        <AnimatedSection direction="up">
          <div className="card-premium p-8">
            <h2 className="text-2xl font-bold text-white mb-5">About the Award</h2>
            <p className="leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Each year C-SHIFT recognizes one outstanding member contributor whose writing has strengthened the community and advanced the mission of nonprofit sustainability. This award celebrates the leaders who give back to the community through knowledge sharing, encouragement, and practical guidance.
            </p>
            <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              The winner receives a sponsorship package that includes cash support toward an organizational event, C-SHIFT capacity building and funding strategy services, and professional event planning support from the C-SHIFT team. This is our way of investing back into the leaders who invest in this community.
            </p>
          </div>
        </AnimatedSection>

        {/* Prize Package */}
        <AnimatedSection direction="up" delay={40}>
          <div className="card-gold rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Star size={22} style={{ color: BRAND.gold }} />
              The Prize Package
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: 'Event Sponsorship', desc: 'Cash support toward an organizational event of your choosing' },
                { title: 'Capacity Building Services', desc: 'C-SHIFT capacity building and funding strategy services valued for your organization' },
                { title: 'Event Planning Support', desc: 'Professional event planning support from the C-SHIFT team' },
              ].map(item => (
                <div key={item.title} className="rounded-xl p-5" style={{ border: `1px solid ${BRAND.gold}25`, backgroundColor: BRAND.gold + '08' }}>
                  <div className="font-bold mb-2" style={{ color: BRAND.gold }}>{item.title}</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Eligibility */}
        <AnimatedSection direction="up" delay={60}>
          <div className="card-premium p-8">
            <h2 className="text-2xl font-bold text-white mb-5">Eligibility Criteria</h2>
            <div className="space-y-3">
              {[
                'Active member in good standing with a current membership',
                'Published at least three approved blog posts in the current calendar year',
                'Posts must demonstrate value to the nonprofit community',
                'Member must be in good standing with no violations of community guidelines',
              ].map((crit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: BRAND.teal }} />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{crit}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Process */}
        <AnimatedSection direction="up" delay={80}>
          <div className="card-premium p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Nomination and Voting Process</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Nominate', desc: 'Any active member can nominate an eligible peer. One nomination per member per year.' },
                { step: '02', title: 'Vote', desc: 'All active members vote for their favorite contributor. One vote per member per year.' },
                { step: '03', title: 'Announcement', desc: 'The winner is announced live at the annual Mission to Money Summit.' },
              ].map(s => (
                <div key={s.step} className="text-center p-5 rounded-xl" style={{ backgroundColor: 'rgba(28,116,134,0.07)', border: '1px solid rgba(28,116,134,0.12)' }}>
                  <div className="text-3xl font-bold mb-2" style={{ color: `${BRAND.gold}60` }}>{s.step}</div>
                  <div className="font-bold text-white mb-2">{s.title}</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Nominees Leaderboard */}
        {nominations.length > 0 && (
          <AnimatedSection direction="up" delay={100}>
            <div className="card-premium p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Current Nominees</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>{currentYear} nomination standings</p>
              <div className="space-y-3">
                {nominations
                  .sort((a, b) => b.count - a.count)
                  .map((nom, i) => (
                    <div key={nom.nominee_id} className="flex items-center justify-between p-4 rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: i === 0 ? BRAND.gold : BRAND.teal, color: i === 0 ? BRAND.black : '#FFFFFF' }}>
                          {i + 1}
                        </div>
                        <span className="font-medium text-white">{nom.organization_name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{nom.count} nomination{nom.count !== 1 ? 's' : ''}</span>
                        {user && !myVote && (
                          <button
                            onClick={() => handleVote(nom.nominee_id)}
                            disabled={voting || nom.nominee_id === user.id}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40 transition-opacity hover:opacity-80"
                            style={{ backgroundColor: BRAND.teal }}
                          >
                            Vote
                          </button>
                        )}
                        {myVote === nom.nominee_id && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ backgroundColor: BRAND.teal + '18', color: BRAND.teal }}>
                            <CheckCircle size={11} /> Your Vote
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {voteSuccess && (
                <div className="mt-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(28,116,134,0.1)', border: '1px solid rgba(28,116,134,0.2)', color: BRAND.teal }}>
                  <CheckCircle size={14} /> Your vote has been recorded. Thank you!
                </div>
              )}
            </div>
          </AnimatedSection>
        )}

        {/* Nominate */}
        <AnimatedSection direction="up" delay={120}>
          {user ? (
            <div className="card-premium p-8">
              <h2 className="text-2xl font-bold text-white mb-2">Submit a Nomination</h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Nominate an eligible peer for the {currentYear} award. You may submit one nomination per year.
              </p>

              {nominationSuccess || myNomination ? (
                <div className="flex items-center gap-3 rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(28,116,134,0.1)', border: '1px solid rgba(28,116,134,0.2)', color: BRAND.teal }}>
                  <CheckCircle size={18} />
                  <div>
                    <div className="font-semibold">Nomination submitted!</div>
                    <div className="text-sm mt-0.5" style={{ color: 'rgba(28,116,134,0.8)' }}>Thank you for participating in the selection process.</div>
                  </div>
                </div>
              ) : eligibleMembers.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <Users size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <p className="text-sm">No eligible members yet this year. Eligible members are those who have published at least 3 approved posts in {currentYear}.</p>
                </div>
              ) : (
                <form onSubmit={handleNominate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Select Nominee *</label>
                    <select
                      value={form.nominee_id}
                      onChange={e => setForm(p => ({ ...p, nominee_id: e.target.value }))}
                      className={`${inputCls} cursor-pointer`}
                      style={{ ...inputStyle, appearance: 'none' as const }}
                      required
                    >
                      <option value="" style={{ backgroundColor: '#141414' }}>Choose an eligible member...</option>
                      {eligibleMembers
                        .filter(m => m.id !== user.id)
                        .map(m => (
                          <option key={m.id} value={m.id} style={{ backgroundColor: '#141414' }}>
                            {m.organization_name} ({m.post_count} posts)
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Why are you nominating them? *</label>
                    <textarea
                      value={form.reason}
                      onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                      rows={4}
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      placeholder="Tell us how this member has contributed to the community..."
                      required
                    />
                  </div>
                  {error && <div className="text-sm" style={{ color: '#D4A843' }}>{error}</div>}
                  <button
                    type="submit"
                    disabled={nominating}
                    className="btn-primary disabled:opacity-60"
                  >
                    {nominating ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : 'Submit Nomination'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="card-premium p-8 text-center">
              <Award size={40} className="mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
              <h3 className="font-bold text-white mb-2">Sign in to Nominate and Vote</h3>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>Active members can nominate peers and vote for their favorite contributor.</p>
              <Link to="/login" className="btn-primary">
                Sign In
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </AnimatedSection>
      </div>
    </div>
  );
}
