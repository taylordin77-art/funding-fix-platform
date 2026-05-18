import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Calendar, MessageSquare, Download, Lock, Send, BarChart3, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Assessment, ClientDocument, ClientSession, ClientMessage, PILLARS } from '../lib/types';
import { AnimatedSection } from '../components/AnimatedSection';

type Tab = 'overview' | 'documents' | 'sessions' | 'messages';

export default function ClientPortalPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const hasAccess = profile && (
    profile.membership_tier === 'premium' ||
    profile.membership_tier === 'white_glove' ||
    profile.role === 'client' ||
    profile.role === 'admin'
  );

  useEffect(() => {
    if (!user || !hasAccess) { setLoading(false); return; }
    Promise.all([
      supabase.from('assessments').select('*').eq('user_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }),
      supabase.from('client_documents').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      supabase.from('client_sessions').select('*').eq('client_id', user.id).order('scheduled_at', { ascending: true }),
      supabase.from('client_messages').select('*').eq('client_id', user.id).order('created_at', { ascending: true }),
    ]).then(([a, d, s, m]) => {
      setAssessments(a.data || []);
      setDocuments(d.data || []);
      setSessions(s.data || []);
      setMessages(m.data || []);
      setLoading(false);
    });
  }, [user, hasAccess]);

  async function sendMessage() {
    if (!user || !newMessage.trim()) return;
    setSending(true);
    const { data } = await supabase.from('client_messages').insert({
      client_id: user.id,
      sender_id: user.id,
      content: newMessage.trim(),
    }).select().single();
    if (data) setMessages(prev => [...prev, data]);
    setNewMessage('');
    setSending(false);
  }

  const cardStyle = { backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem' };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="card-premium p-10 text-center max-w-md">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <Lock size={24} style={{ color: 'rgba(255,255,255,0.35)' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Client Portal</h2>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>Sign in to access your C-SHIFT client portal.</p>
          <Link to="/login" state={{ from: '/portal' }} className="btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="card-premium p-10 text-center max-w-md">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(28,116,134,0.12)' }}>
            <Lock size={24} style={{ color: '#1C7486' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Premium Access Required</h2>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>The Client Portal is available to Premium and White Glove members. Upgrade to unlock full portal access.</p>
          <Link to="/pricing" className="btn-primary">View Plans</Link>
        </div>
      </div>
    );
  }

  const latestAssessment = assessments[0];

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { id: 'sessions', label: `Sessions (${sessions.filter(s => s.status === 'scheduled').length})`, icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 py-6">
          <AnimatedSection direction="up">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Client Portal</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Welcome back, {profile?.full_name || 'Client'}</p>
                {profile?.organization_name && <p className="text-sm font-medium mt-0.5" style={{ color: '#1C7486' }}>{profile.organization_name}</p>}
              </div>
              <a
                href="https://calendly.com/taylordin77/new-meeting-1"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm"
              >
                <Calendar size={14} />
                Book a Session
              </a>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6 overflow-x-auto">
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                    style={tab === t.id
                      ? { backgroundColor: '#1C7486', color: '#FFFFFF' }
                      : { color: 'rgba(255,255,255,0.45)' }
                    }
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </AnimatedSection>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading your portal...</div>
        ) : (
          <>
            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {latestAssessment ? (
                  <AnimatedSection direction="up">
                    <div className="card-premium p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Your Fundability Score</h2>
                        <Link to={`/results/${latestAssessment.id}`} className="text-sm font-medium" style={{ color: '#1C7486' }}>
                          View full report
                        </Link>
                      </div>
                      <div className="flex items-center gap-6 mb-6">
                        <div className="text-center">
                          <div className="text-5xl font-bold" style={{ color: '#1C7486' }}>{latestAssessment.total_score}</div>
                          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>/ 150</div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Overall Fundability</div>
                          <div className="h-3 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full" style={{ width: `${(latestAssessment.total_score / 150) * 100}%`, backgroundColor: '#1C7486' }} />
                          </div>
                          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            Assessed {new Date(latestAssessment.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {PILLARS.map(p => {
                          const score = latestAssessment[`${p.key}_score` as keyof Assessment] as number;
                          return (
                            <div key={p.key}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{p.label}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{score}/25</span>
                              </div>
                              <div className="h-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                                <div className="h-full rounded-full" style={{ width: `${(score / 25) * 100}%`, backgroundColor: p.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </AnimatedSection>
                ) : (
                  <AnimatedSection direction="up">
                    <div className="card-premium p-8 text-center">
                      <BarChart3 size={40} className="mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
                      <h3 className="font-semibold text-white mb-2">No Assessment Yet</h3>
                      <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Complete the Fundability Assessment to see your scores here.</p>
                      <Link to="/assessment" className="btn-primary">Take Assessment</Link>
                    </div>
                  </AnimatedSection>
                )}

                {/* Quick Links */}
                <AnimatedSection direction="up" delay={60}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: FileText, label: 'Your Documents', sub: `${documents.length} files`, onClick: () => setTab('documents') },
                      { icon: Calendar, label: 'Upcoming Sessions', sub: `${sessions.filter(s => s.status === 'scheduled').length} scheduled`, onClick: () => setTab('sessions') },
                      { icon: MessageSquare, label: 'Messages', sub: `${messages.length} messages`, onClick: () => setTab('messages') },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <button key={item.label} onClick={item.onClick} className="card-premium p-5 text-left transition-all">
                          <Icon size={20} className="mb-3" style={{ color: '#1C7486' }} />
                          <div className="font-semibold text-white text-sm">{item.label}</div>
                          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </AnimatedSection>

                {/* Book Session */}
                <AnimatedSection direction="up" delay={80}>
                  <div className="card-premium p-8 text-center">
                    <Calendar size={30} className="mx-auto mb-3" style={{ color: '#1C7486' }} />
                    <h3 className="font-bold text-white mb-2">Schedule Your Next Session</h3>
                    <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>Book a capacity building and funding strategy session directly with your C-SHIFT funding strategist.</p>
                    <a
                      href="https://calendly.com/taylordin77/new-meeting-1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      Open Booking Calendar
                    </a>
                  </div>
                </AnimatedSection>
              </div>
            )}

            {/* Documents */}
            {tab === 'documents' && (
              <AnimatedSection direction="up">
                <div className="card-premium p-8">
                  <h2 className="text-xl font-bold text-white mb-6">Your Documents</h2>
                  {documents.length === 0 ? (
                    <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <FileText size={40} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                      <p>No documents yet. C-SHIFT will upload your deliverables here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl transition-all" style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}>
                              <FileText size={15} style={{ color: '#1C7486' }} />
                            </div>
                            <div>
                              <div className="font-medium text-white text-sm">{doc.title}</div>
                              {doc.description && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{doc.description}</div>}
                              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#1C7486' }}>
                              <Download size={12} />
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AnimatedSection>
            )}

            {/* Sessions */}
            {tab === 'sessions' && (
              <AnimatedSection direction="up">
                <div className="card-premium p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Sessions and Calls</h2>
                    <a
                      href="https://calendly.com/taylordin77/new-meeting-1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-sm"
                    >
                      <Calendar size={13} />
                      Book New
                    </a>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <Calendar size={40} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                      <p>No sessions scheduled yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sessions.map(session => (
                        <div key={session.id} className="p-5 rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={
                                  session.status === 'scheduled' ? { backgroundColor: 'rgba(28,116,134,0.15)', color: '#1C7486' } :
                                  session.status === 'completed' ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgba(34,197,94,0.9)' } :
                                  { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
                                }>
                                  {session.status}
                                </span>
                              </div>
                              <h3 className="font-semibold text-white">{session.title}</h3>
                              <div className="flex items-center gap-1 text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                <Clock size={12} />
                                {new Date(session.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                {' at '}
                                {new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {' · '}{session.duration_minutes} min
                              </div>
                              {session.description && <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{session.description}</p>}
                            </div>
                            {session.zoom_link && session.status === 'scheduled' && (
                              <a
                                href={session.zoom_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                                style={{ backgroundColor: '#1C7486' }}
                              >
                                Join Zoom
                              </a>
                            )}
                            {session.status === 'completed' && <CheckCircle size={18} style={{ color: 'rgba(34,197,94,0.8)' }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AnimatedSection>
            )}

            {/* Messages */}
            {tab === 'messages' && (
              <AnimatedSection direction="up">
                <div className="card-premium flex flex-col" style={{ height: '600px' }}>
                  <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h2 className="text-lg font-bold text-white">Messages</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Direct messages with your C-SHIFT funding strategist</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        No messages yet. Send a message to your funding strategist below.
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isMe = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className="max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm"
                              style={isMe
                                ? { backgroundColor: '#1C7486', color: '#FFFFFF' }
                                : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)' }
                              }
                            >
                              {msg.content}
                              <div className="text-xs mt-1" style={{ color: isMe ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}>
                                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFFFFF', outline: 'none' }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={sending || !newMessage.trim()}
                        className="flex items-center justify-center w-10 h-10 rounded-xl text-white disabled:opacity-40 transition-all flex-shrink-0"
                        style={{ backgroundColor: '#1C7486' }}
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
