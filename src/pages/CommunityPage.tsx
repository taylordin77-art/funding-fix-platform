import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Pin, Plus, Bell, Lock, Users,
  ChevronRight, Calendar, Send, Loader2, CheckCircle,
  BookOpen, Mic, Archive
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CommunityThread, Announcement, PILLARS } from '../lib/types';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843', white: '#FFFFFF' };

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
  borderRadius: '0.75rem',
  padding: '0.625rem 1rem',
  fontSize: '0.875rem',
  width: '100%',
};

interface WeeklyPrompt { id: string; prompt: string; created_at: string; }
interface BoardroomGuest {
  id: string;
  guest_name: string;
  guest_type: string;
  topic: string;
  scheduled_at: string;
  bio?: string;
  is_past: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function GuestTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    funder: { label: 'Funder', bg: BRAND.gold + '20', color: BRAND.gold },
    expert: { label: 'Expert', bg: BRAND.teal + '18', color: BRAND.teal },
    peer: { label: 'Peer Leader', bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
    strategist: { label: 'Funding Strategist', bg: BRAND.teal + '18', color: BRAND.teal },
  };
  const info = map[type] || { label: type, bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: info.bg, color: info.color }}>
      {info.label}
    </span>
  );
}

function BoardroomLocked() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: BRAND.teal + '15' }}>
        <Lock size={28} style={{ color: BRAND.teal }} />
      </div>
      <h3 className="text-2xl font-bold text-white mb-3">The Funding Boardroom</h3>
      <p className="leading-relaxed mb-2 max-w-md" style={{ color: 'rgba(255,255,255,0.6)' }}>
        The Funding Boardroom is where strategy happens. Premium and White Glove members get direct access to funders, capacity building experts, and funding strategists in live, focused conversations.
      </p>
      <p className="text-sm max-w-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Submit questions in advance, engage in live conversation, and access the full archive of past sessions.
      </p>
      <Link to="/pricing" className="btn-primary">
        Upgrade My Membership
        <ChevronRight size={16} />
      </Link>
      <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Available on Premium and White Glove plans</p>
    </div>
  );
}

function BoardroomRoom({ userId }: { userId: string }) {
  const [tab, setTab] = useState<'live' | 'schedule' | 'archive'>('schedule');
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [guests, setGuests] = useState<BoardroomGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState('');
  const [posting, setPosting] = useState(false);
  const [questionInputs, setQuestionInputs] = useState<Record<string, string>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});
  const [submittingQ, setSubmittingQ] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      supabase
        .from('community_threads')
        .select('*, profiles(organization_name)')
        .eq('room', 'boardroom')
        .order('created_at', { ascending: false }),
      supabase
        .from('boardroom_guests')
        .select('*')
        .order('scheduled_at', { ascending: true }),
    ]).then(([tRes, gRes]) => {
      setThreads((tRes.data || []) as unknown as CommunityThread[]);
      setGuests((gRes.data || []) as BoardroomGuest[]);
      setLoading(false);
    });
  }, []);

  async function handlePostMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setPosting(true);
    const { data } = await supabase
      .from('community_threads')
      .insert({ author_id: userId, title: newMsg.trim(), content: newMsg.trim(), pillar: 'boardroom', room: 'boardroom' })
      .select('*, profiles(organization_name)')
      .single();
    if (data) setThreads(prev => [data as unknown as CommunityThread, ...prev]);
    setNewMsg('');
    setPosting(false);
  }

  async function handleSubmitQuestion(guestId: string) {
    const q = questionInputs[guestId]?.trim();
    if (!q) return;
    setSubmittingQ(p => ({ ...p, [guestId]: true }));
    await supabase.from('boardroom_questions').insert({ guest_id: guestId, author_id: userId, question: q });
    setSubmittedQuestions(p => ({ ...p, [guestId]: true }));
    setSubmittingQ(p => ({ ...p, [guestId]: false }));
  }

  const upcomingGuests = guests.filter(g => !g.is_past);
  const pastGuests = guests.filter(g => g.is_past);

  const subTabActive: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.08)', color: BRAND.teal };
  const subTabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.4)' };

  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {([
          { key: 'schedule', label: 'Guest Schedule', icon: Calendar },
          { key: 'live', label: 'Live Conversation', icon: Mic },
          { key: 'archive', label: 'Archive', icon: Archive },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === key ? subTabActive : subTabInactive}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin" size={24} style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
      ) : tab === 'schedule' ? (
        <div className="space-y-5">
          {upcomingGuests.length === 0 && pastGuests.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Calendar size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
              <p>No guests scheduled yet. Check back soon.</p>
            </div>
          ) : (
            <>
              {upcomingGuests.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Upcoming Sessions</div>
                  <div className="space-y-4">
                    {upcomingGuests.map(guest => (
                      <div key={guest.id} className="card-premium p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div>
                            <GuestTypeBadge type={guest.guest_type} />
                            <h3 className="font-bold text-white text-lg mt-2">{guest.guest_name}</h3>
                            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{guest.topic}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xs flex items-center gap-1 justify-end" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              <Calendar size={11} />
                              {formatDate(guest.scheduled_at)}
                            </div>
                          </div>
                        </div>
                        {guest.bio && <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>{guest.bio}</p>}
                        <div className="pt-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Submit Your Question in Advance</div>
                          {submittedQuestions[guest.id] ? (
                            <div className="flex items-center gap-2 text-sm" style={{ color: BRAND.teal }}>
                              <CheckCircle size={15} />
                              Question submitted. We will review it before the session.
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="What would you like to ask?"
                                value={questionInputs[guest.id] || ''}
                                onChange={e => setQuestionInputs(p => ({ ...p, [guest.id]: e.target.value }))}
                                style={{ ...inputStyle, flex: 1 }}
                              />
                              <button
                                onClick={() => handleSubmitQuestion(guest.id)}
                                disabled={submittingQ[guest.id]}
                                className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                                style={{ backgroundColor: BRAND.teal }}
                              >
                                {submittingQ[guest.id] ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                Submit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pastGuests.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Past Sessions</div>
                  <div className="space-y-3">
                    {pastGuests.map(guest => (
                      <div key={guest.id} className="card-premium p-4" style={{ opacity: 0.6 }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <GuestTypeBadge type={guest.guest_type} />
                            <div className="font-semibold text-white mt-1.5">{guest.guest_name}</div>
                            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{guest.topic}</div>
                          </div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatDate(guest.scheduled_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : tab === 'live' ? (
        <div>
          <div className="mb-5">
            <form onSubmit={handlePostMessage} className="flex gap-3">
              <input
                type="text"
                placeholder="Share a thought, ask a question, or contribute to the discussion..."
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="submit"
                disabled={posting || !newMsg.trim()}
                className="flex items-center gap-1.5 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ backgroundColor: BRAND.teal }}
              >
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Post
              </button>
            </form>
          </div>
          {threads.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Mic size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
              <p>No messages yet. Be the first to contribute to the conversation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map(t => {
                const org = (t.profiles as { organization_name: string } | undefined)?.organization_name || 'C-SHIFT Member';
                return (
                  <div key={t.id} className="card-premium p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: BRAND.teal }}>
                        {org[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">{org}</span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{timeAgo(t.created_at)}</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{t.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {pastGuests.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Archive size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
              <p>No archived sessions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Recordings and session notes from past Funding Boardroom sessions.</p>
              {pastGuests.map(guest => (
                <div key={guest.id} className="card-premium p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <GuestTypeBadge type={guest.guest_type} />
                      <h3 className="font-bold text-white mt-2">{guest.guest_name}</h3>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{guest.topic}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatDate(guest.scheduled_at)}</p>
                    </div>
                    <div className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>Archived</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GeneralRoomWrapper({ userId }: { userId: string }) {
  const [showNewThread, setShowNewThread] = useState(false);
  return (
    <>
      <button id="new-thread-trigger" className="hidden" onClick={() => setShowNewThread(true)} />
      <GeneralRoomInner userId={userId} showNewThread={showNewThread} setShowNewThread={setShowNewThread} />
    </>
  );
}

function GeneralRoomInner({ userId, showNewThread, setShowNewThread }: { userId: string; showNewThread: boolean; setShowNewThread: (v: boolean) => void }) {
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [weeklyPrompt, setWeeklyPrompt] = useState<WeeklyPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPillar, setFilterPillar] = useState('all');
  const [newThread, setNewThread] = useState({ title: '', content: '', pillar: 'general' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from('community_threads')
        .select('*, profiles(organization_name)')
        .eq('room', 'general')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('weekly_prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([tRes, aRes, pRes]) => {
      setThreads((tRes.data || []) as unknown as CommunityThread[]);
      setAnnouncements((aRes.data || []) as unknown as Announcement[]);
      if (pRes.data) setWeeklyPrompt(pRes.data as WeeklyPrompt);
      setLoading(false);
    });
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newThread.title.trim() || !newThread.content.trim()) return;
    setPosting(true);
    const { data } = await supabase
      .from('community_threads')
      .insert({ author_id: userId, title: newThread.title.trim(), content: newThread.content.trim(), pillar: newThread.pillar, room: 'general' })
      .select('*, profiles(organization_name)')
      .single();
    if (data) {
      setThreads(prev => [data as unknown as CommunityThread, ...prev]);
      setNewThread({ title: '', content: '', pillar: 'general' });
      setShowNewThread(false);
    }
    setPosting(false);
  }

  const filtered = filterPillar === 'all' ? threads : threads.filter(t => t.pillar === filterPillar);
  const filterActive: React.CSSProperties = { backgroundColor: BRAND.teal, color: BRAND.white };
  const filterInactive: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        {weeklyPrompt && (
          <div className="card-gold p-5">
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.gold }}>Weekly Prompt</div>
            <p className="text-white font-semibold leading-relaxed">{weeklyPrompt.prompt}</p>
            <button
              onClick={() => { setShowNewThread(true); setNewThread(p => ({ ...p, title: weeklyPrompt.prompt.slice(0, 60) })); }}
              className="btn-gold mt-3 text-sm"
            >
              Respond to This Prompt
            </button>
          </div>
        )}

        {showNewThread && (
          <div className="card-premium p-6">
            <h3 className="font-bold text-white mb-4">Start a New Thread</h3>
            <form onSubmit={handlePost} className="space-y-3">
              <input
                type="text"
                placeholder="Thread title..."
                value={newThread.title}
                onChange={e => setNewThread(p => ({ ...p, title: e.target.value }))}
                style={inputStyle}
                required
              />
              <select
                value={newThread.pillar}
                onChange={e => setNewThread(p => ({ ...p, pillar: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
              >
                <option value="general" style={{ backgroundColor: '#141414' }}>General</option>
                {PILLARS.map(p => <option key={p.key} value={p.key} style={{ backgroundColor: '#141414' }}>{p.label}</option>)}
              </select>
              <textarea
                placeholder="Share your question, insight, or resource..."
                value={newThread.content}
                onChange={e => setNewThread(p => ({ ...p, content: e.target.value }))}
                rows={4}
                style={{ ...inputStyle, resize: 'none' }}
                required
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowNewThread(false)} className="text-sm px-4 py-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Cancel</button>
                <button
                  type="submit"
                  disabled={posting}
                  className="btn-primary text-sm disabled:opacity-70"
                >
                  {posting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {posting ? 'Posting...' : 'Post Thread'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterPillar('all')}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={filterPillar === 'all' ? filterActive : filterInactive}
          >
            All Topics
          </button>
          {PILLARS.map(p => (
            <button
              key={p.key}
              onClick={() => setFilterPillar(filterPillar === p.key ? 'all' : p.key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={filterPillar === p.key ? filterActive : filterInactive}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" size={24} style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 card-premium">
            <MessageSquare size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
            <p style={{ color: 'rgba(255,255,255,0.35)' }}>No threads yet. Start the conversation.</p>
          </div>
        ) : (
          filtered.map(thread => {
            const pillarInfo = PILLARS.find(p => p.key === thread.pillar);
            const color = pillarInfo?.color || BRAND.teal;
            const org = (thread.profiles as { organization_name: string } | undefined)?.organization_name || 'C-SHIFT Member';
            return (
              <div key={thread.id} className="card-premium p-5 cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {thread.is_pinned && <Pin size={13} style={{ color: BRAND.gold }} className="flex-shrink-0" />}
                      {thread.pillar && thread.pillar !== 'general' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '18', color }}>
                          {pillarInfo?.label || thread.pillar}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white leading-snug">{thread.title}</h3>
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{thread.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span className="font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{org}</span>
                      <span>{timeAgo(thread.created_at)}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        {thread.reply_count} replies
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-6">
        {announcements.length > 0 && (
          <div className="card-premium p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={16} style={{ color: BRAND.teal }} />
              <h3 className="font-semibold text-white">Announcements</h3>
            </div>
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className="border-l-2 pl-3" style={{ borderColor: BRAND.teal }}>
                  <div className="font-medium text-sm text-white">{a.title}</div>
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.content}</p>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{timeAgo(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-premium p-5">
          <h3 className="font-semibold text-white mb-4">Topics by Pillar</h3>
          <div className="space-y-1.5">
            {PILLARS.map(p => (
              <button
                key={p.key}
                onClick={() => setFilterPillar(filterPillar === p.key ? 'all' : p.key)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl transition-colors text-left"
                style={{ '--hover-bg': 'rgba(255,255,255,0.04)' } as React.CSSProperties}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>
                    {p.label[0]}
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{p.label}</span>
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {threads.filter(t => t.pillar === p.key).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card-premium p-5">
          <h3 className="font-semibold text-white mb-3 text-sm">Community Guidelines</h3>
          <ul className="space-y-1.5">
            {['Be respectful and supportive', 'Share resources generously', 'Ask questions freely', 'No promotional content', 'Protect member confidentiality'].map(g => (
              <li key={g} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.gold }} />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const { user, profile } = useAuth();
  const [room, setRoom] = useState<'general' | 'boardroom'>('general');

  const isMember = profile && (
    profile.membership_tier === 'founding_member' ||
    profile.membership_tier === 'premium' ||
    profile.membership_tier === 'white_glove' ||
    profile.role === 'admin'
  );

  const hasBoardroomAccess = profile && (
    profile.membership_tier === 'premium' ||
    profile.membership_tier === 'white_glove' ||
    profile.role === 'admin'
  );

  if (!user) {
    return (
      <div className="min-h-screen section-dark flex items-center justify-center px-4" style={{ backgroundImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(28,116,134,0.12) 0%, transparent 70%)' }}>
        <div className="card-premium p-10 text-center max-w-md w-full">
          <Users size={40} className="mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <h2 className="text-2xl font-bold text-white mb-3">Members-Only Community</h2>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>Join the C-SHIFT community to connect with other nonprofit leaders, ask questions, and share insights.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="btn-primary">Sign In</Link>
            <Link to="/register" className="btn-ghost">Create Account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="min-h-screen section-dark flex items-center justify-center px-4" style={{ backgroundImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(28,116,134,0.12) 0%, transparent 70%)' }}>
        <div className="card-premium p-10 text-center max-w-md w-full">
          <Lock size={40} className="mx-auto mb-4" style={{ color: BRAND.teal }} />
          <h2 className="text-2xl font-bold text-white mb-3">Upgrade to Join the Community</h2>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>The C-SHIFT community is available to Founding Member and above. Upgrade your plan to connect with fellow nonprofit leaders.</p>
          <Link to="/pricing" className="btn-primary">
            View Plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0D1213 0%, rgba(28,116,134,0.12) 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="orb" style={{ width: 400, height: 400, background: 'rgba(28,116,134,0.1)', top: '-20%', right: '-5%', animationDuration: '24s' }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="section-label">Community</p>
              <h1 className="heading-xl text-white">Funding Fix Community</h1>
              <p className="text-base mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Connect, learn, and grow with fellow nonprofit leaders.</p>
            </div>
            {room === 'general' && (
              <button
                onClick={() => {
                  const el = document.getElementById('new-thread-trigger');
                  if (el) el.click();
                }}
                className="btn-primary text-sm"
              >
                <Plus size={16} />
                New Thread
              </button>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setRoom('general')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={room === 'general'
                ? { backgroundColor: BRAND.teal, color: BRAND.white }
                : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            >
              <Users size={15} />
              General Community
            </button>
            <button
              onClick={() => setRoom('boardroom')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={room === 'boardroom'
                ? { backgroundColor: BRAND.gold, color: BRAND.black }
                : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            >
              {!hasBoardroomAccess && <Lock size={13} />}
              <BookOpen size={15} />
              Funding Boardroom
              {!hasBoardroomAccess && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: BRAND.gold + '30', color: BRAND.gold }}>Premium</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {room === 'general' ? (
          <GeneralRoomWrapper userId={user.id} />
        ) : hasBoardroomAccess ? (
          <BoardroomRoom userId={user.id} />
        ) : (
          <BoardroomLocked />
        )}
      </div>
    </div>
  );
}
