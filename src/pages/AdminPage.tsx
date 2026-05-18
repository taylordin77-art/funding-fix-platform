import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, FileText, Calendar, Bell, Download, Send,
  ChevronRight, AlertCircle, CheckCircle, Clock, TrendingUp, BookOpen, X, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Assessment, Profile, WorkshopRegistration, HotSeatApplication } from '../lib/types';

type AdminTab = 'overview' | 'assessments' | 'clients' | 'workshops' | 'announcements' | 'applications' | 'blog';

interface BlogPostAdmin {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  status: string;
  created_at: string;
  published_at: string | null;
  profiles?: { organization_name: string };
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  outline: 'none',
};

export default function AdminPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [workshopRegs, setWorkshopRegs] = useState<WorkshopRegistration[]>([]);
  const [applications, setApplications] = useState<HotSeatApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPostAdmin[]>([]);
  const [blogStatusFilter, setBlogStatusFilter] = useState<'pending' | 'published' | 'rejected'>('pending');
  const [announcement, setAnnouncement] = useState({ title: '', content: '' });
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login', { state: { from: '/admin' } }); return; }
    if (profile && profile.role !== 'admin') { navigate('/'); return; }
  }, [user, profile, navigate]);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    Promise.all([
      supabase.from('assessments').select('*').eq('status', 'completed').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('workshop_registrations').select('*').order('created_at', { ascending: false }),
      supabase.from('hot_seat_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('blog_posts').select('id, title, excerpt, category, status, created_at, published_at, profiles(organization_name)').order('created_at', { ascending: false }),
    ]).then(([a, c, w, apps, blog]) => {
      setAssessments(a.data || []);
      setClients(c.data || []);
      setWorkshopRegs(w.data || []);
      setApplications(apps.data || []);
      setBlogPosts((blog.data || []) as unknown as BlogPostAdmin[]);
      setLoading(false);
    });
  }, [profile]);

  async function postAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !announcement.title || !announcement.content) return;
    setPostingAnnouncement(true);
    await supabase.from('announcements').insert({
      title: announcement.title,
      content: announcement.content,
      author_id: user.id,
      is_published: true,
    });
    setAnnouncement({ title: '', content: '' });
    setAnnouncementSuccess(true);
    setTimeout(() => setAnnouncementSuccess(false), 3000);
    setPostingAnnouncement(false);
  }

  async function exportAssessments() {
    const headers = ['ID', 'Name', 'Email', 'Organization', 'Total', 'Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transformation', 'Date'];
    const rows = assessments.map(a => [
      a.id, a.full_name, a.email, a.organization_name,
      a.total_score, a.clarity_score, a.structure_score, a.health_score,
      a.impact_score, a.funding_score, a.transformation_score,
      new Date(a.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assessments.csv';
    a.click();
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto mb-3" style={{ color: 'rgba(255,80,80,0.6)' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Access denied. Admin only.</p>
          <Link to="/" className="mt-4 inline-block text-sm" style={{ color: '#1C7486' }}>Go home</Link>
        </div>
      </div>
    );
  }

  async function updateBlogStatus(postId: string, newStatus: 'published' | 'rejected') {
    const update: Record<string, string> = { status: newStatus };
    if (newStatus === 'published') update.published_at = new Date().toISOString();
    await supabase.from('blog_posts').update(update).eq('id', postId);
    setBlogPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus, published_at: newStatus === 'published' ? new Date().toISOString() : p.published_at } : p));
  }

  const avgScore = assessments.length > 0 ? Math.round(assessments.reduce((s, a) => s + a.total_score, 0) / assessments.length) : 0;
  const paidWorkshops = workshopRegs.filter(w => w.payment_status === 'paid').length;
  const activeClients = clients.filter(c => c.membership_tier !== 'free').length;
  const pendingBlogCount = blogPosts.filter(p => p.status === 'pending').length;

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'assessments', label: `Assessments (${assessments.length})`, icon: FileText },
    { id: 'clients', label: `Members (${clients.length})`, icon: Users },
    { id: 'workshops', label: `Workshops (${workshopRegs.length})`, icon: Calendar },
    { id: 'applications', label: `Applications (${applications.length})`, icon: Clock },
    { id: 'blog', label: `Blog${pendingBlogCount > 0 ? ` (${pendingBlogCount} pending)` : ''}`, icon: BookOpen },
    { id: 'announcements', label: 'Announcements', icon: Bell },
  ];

  const cellStyle = { color: 'rgba(255,255,255,0.55)', padding: '0.75rem 1rem', whiteSpace: 'nowrap' as const };
  const headStyle = { color: 'rgba(255,255,255,0.35)', padding: '0.75rem 1rem', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Funding Fix by ClarityShift Impact Group</p>
            </div>
            <button
              onClick={exportAssessments}
              className="btn-ghost text-sm"
            >
              <Download size={14} />
              Export Data
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 overflow-x-auto pb-1">
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading...</div>
        ) : (
          <>
            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Assessments', value: assessments.length, icon: FileText, color: '#1C7486' },
                    { label: 'Avg. Score', value: `${avgScore}/150`, icon: TrendingUp, color: '#1C7486' },
                    { label: 'Paid Workshop Regs', value: paidWorkshops, icon: Calendar, color: '#D4A843' },
                    { label: 'Active Members', value: activeClients, icon: Users, color: '#1C7486' },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="card-premium p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: stat.color + '20' }}>
                            <Icon size={16} style={{ color: stat.color }} />
                          </div>
                          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{stat.label}</span>
                        </div>
                        <div className="text-3xl font-bold text-white">{stat.value}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent Assessments */}
                <div className="card-premium p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white">Recent Assessments</h2>
                    <button onClick={() => setTab('assessments')} className="text-sm font-medium flex items-center gap-1" style={{ color: '#1C7486' }}>
                      View all <ChevronRight size={13} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {assessments.slice(0, 5).map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div className="font-medium text-white text-sm">{a.full_name || 'Anonymous'}</div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{a.organization_name} · {new Date(a.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold" style={{ color: '#1C7486' }}>{a.total_score}</div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>/150</div>
                          <Link to={`/results/${a.id}`} className="text-xs font-medium px-2 py-1 rounded-lg ml-2 transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
                            View
                          </Link>
                        </div>
                      </div>
                    ))}
                    {assessments.length === 0 && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No assessments yet.</p>}
                  </div>
                </div>

                {/* Pending Applications Alert */}
                {applications.filter(a => a.status === 'pending').length > 0 && (
                  <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(212,168,67,0.07)', border: '1px solid rgba(212,168,67,0.2)' }}>
                    <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#D4A843' }}>
                      <AlertCircle size={17} />
                      Pending Applications ({applications.filter(a => a.status === 'pending').length})
                    </h2>
                    <div className="space-y-2">
                      {applications.filter(a => a.status === 'pending').slice(0, 3).map(app => (
                        <div key={app.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                          <div>
                            <div className="font-medium text-white text-sm">{app.full_name}</div>
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{app.organization_name}</div>
                          </div>
                          <button onClick={() => setTab('applications')} className="text-xs font-medium" style={{ color: '#D4A843' }}>
                            Review
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assessments */}
            {tab === 'assessments' && (
              <div className="card-premium overflow-hidden">
                <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h2 className="font-bold text-white">All Assessments</h2>
                  <button onClick={exportAssessments} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <tr>
                        {['Name', 'Organization', 'Email', 'Score', 'Clarity', 'Structure', 'Health', 'Impact', 'Funding', 'Transform.', 'Date', ''].map(h => (
                          <th key={h} className="text-left" style={headStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.map(a => (
                        <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ ...cellStyle, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{a.full_name || 'N/A'}</td>
                          <td style={{ ...cellStyle, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.organization_name}</td>
                          <td style={{ ...cellStyle, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</td>
                          <td style={{ ...cellStyle, color: '#1C7486', fontWeight: 700 }}>{a.total_score}</td>
                          <td style={cellStyle}>{a.clarity_score}</td>
                          <td style={cellStyle}>{a.structure_score}</td>
                          <td style={cellStyle}>{a.health_score}</td>
                          <td style={cellStyle}>{a.impact_score}</td>
                          <td style={cellStyle}>{a.funding_score}</td>
                          <td style={cellStyle}>{a.transformation_score}</td>
                          <td style={{ ...cellStyle, color: 'rgba(255,255,255,0.3)' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <Link to={`/results/${a.id}`} className="text-xs font-medium text-white px-2 py-1 rounded-lg" style={{ backgroundColor: '#1C7486' }}>
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {assessments.length === 0 && (
                    <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>No assessments yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* Members */}
            {tab === 'clients' && (
              <div className="card-premium overflow-hidden">
                <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h2 className="font-bold text-white">All Members</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <tr>
                        {['Name', 'Email', 'Organization', 'Tier', 'Role', 'Joined', ''].map(h => (
                          <th key={h} className="text-left" style={headStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ ...cellStyle, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{c.full_name || 'N/A'}</td>
                          <td style={{ ...cellStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</td>
                          <td style={{ ...cellStyle, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.organization_name || 'N/A'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={
                              c.membership_tier === 'white_glove' ? { backgroundColor: 'rgba(212,168,67,0.15)', color: '#D4A843' } :
                              c.membership_tier === 'premium' ? { backgroundColor: 'rgba(28,116,134,0.15)', color: '#1C7486' } :
                              c.membership_tier === 'founding_member' ? { backgroundColor: 'rgba(28,116,134,0.1)', color: '#1C7486' } :
                              { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
                            }>
                              {c.membership_tier}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={
                              c.role === 'admin' ? { backgroundColor: 'rgba(255,80,80,0.12)', color: 'rgba(255,120,120,0.9)' } :
                              c.role === 'client' ? { backgroundColor: 'rgba(28,116,134,0.12)', color: '#1C7486' } :
                              { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
                            }>
                              {c.role}
                            </span>
                          </td>
                          <td style={{ ...cellStyle, color: 'rgba(255,255,255,0.3)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <button className="text-xs font-medium px-2 py-1 rounded-lg transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}>
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Workshop Registrations */}
            {tab === 'workshops' && (
              <div className="card-premium overflow-hidden">
                <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h2 className="font-bold text-white">Workshop Registrations</h2>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {paidWorkshops} paid · {workshopRegs.filter(w => w.payment_status === 'pending').length} pending
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <tr>
                        {['Name', 'Email', 'Organization', 'Payment', 'Amount', 'Registered'].map(h => (
                          <th key={h} className="text-left" style={headStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {workshopRegs.map(w => (
                        <tr key={w.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ ...cellStyle, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{w.full_name}</td>
                          <td style={cellStyle}>{w.email}</td>
                          <td style={cellStyle}>{w.organization_name}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={
                              w.payment_status === 'paid' ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgba(34,197,94,0.9)' } :
                              w.payment_status === 'failed' ? { backgroundColor: 'rgba(255,80,80,0.12)', color: 'rgba(255,120,120,0.9)' } :
                              { backgroundColor: 'rgba(212,168,67,0.12)', color: '#D4A843' }
                            }>
                              {w.payment_status}
                            </span>
                          </td>
                          <td style={cellStyle}>${(w.amount_paid / 100).toFixed(2)}</td>
                          <td style={{ ...cellStyle, color: 'rgba(255,255,255,0.3)' }}>{new Date(w.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {workshopRegs.length === 0 && (
                    <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>No workshop registrations yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* Applications */}
            {tab === 'applications' && (
              <div className="card-premium p-6">
                <h2 className="font-bold text-white mb-6">Program and Grant Applications</h2>
                {applications.length === 0 ? (
                  <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.35)' }}>No applications yet.</div>
                ) : (
                  <div className="space-y-4">
                    {applications.map(app => (
                      <div key={app.id} className="rounded-xl p-5" style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={
                                app.status === 'approved' ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgba(34,197,94,0.9)' } :
                                app.status === 'declined' ? { backgroundColor: 'rgba(255,80,80,0.12)', color: 'rgba(255,120,120,0.9)' } :
                                app.status === 'completed' ? { backgroundColor: 'rgba(28,116,134,0.15)', color: '#1C7486' } :
                                { backgroundColor: 'rgba(212,168,67,0.12)', color: '#D4A843' }
                              }>
                                {app.status}
                              </span>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(app.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-semibold text-white">{app.full_name}</h3>
                            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{app.organization_name} · {app.email}</div>
                            <div className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                              <strong className="text-white">Challenge:</strong> {app.challenge_description}
                            </div>
                            <div className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                              <strong className="text-white">Desired outcome:</strong> {app.desired_outcome}
                            </div>
                            {(app.years_operating || app.annual_budget) && (
                              <div className="flex gap-4 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                {app.years_operating && <span>Years operating: {app.years_operating}</span>}
                                {app.annual_budget && <span>Annual budget: {app.annual_budget}</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => supabase.from('hot_seat_applications').update({ status: 'approved' }).eq('id', app.id).then(() => setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'approved' } : a)))}
                              className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                              style={{ backgroundColor: 'rgba(34,197,94,0.8)' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => supabase.from('hot_seat_applications').update({ status: 'declined' }).eq('id', app.id).then(() => setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'declined' } : a)))}
                              className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                              style={{ backgroundColor: 'rgba(255,80,80,0.7)' }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Blog Moderation */}
            {tab === 'blog' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="font-bold text-white text-lg">Blog Post Moderation</h2>
                  <div className="flex gap-2">
                    {(['pending', 'published', 'rejected'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setBlogStatusFilter(s)}
                        className="px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize"
                        style={blogStatusFilter === s
                          ? { backgroundColor: '#1C7486', color: '#FFFFFF' }
                          : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }
                        }
                      >
                        {s} ({blogPosts.filter(p => p.status === s).length})
                      </button>
                    ))}
                  </div>
                </div>

                {blogPosts.filter(p => p.status === blogStatusFilter).length === 0 ? (
                  <div className="card-premium text-center py-16">
                    <BookOpen size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                    <p style={{ color: 'rgba(255,255,255,0.35)' }}>No {blogStatusFilter} posts.</p>
                  </div>
                ) : (
                  blogPosts.filter(p => p.status === blogStatusFilter).map(post => {
                    const org = post.profiles?.organization_name || 'Unknown Organization';
                    return (
                      <div key={post.id} className="card-premium p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(28,116,134,0.15)', color: '#1C7486' }}>
                                {post.category}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={
                                post.status === 'published' ? { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgba(34,197,94,0.9)' } :
                                post.status === 'rejected' ? { backgroundColor: 'rgba(255,80,80,0.12)', color: 'rgba(255,120,120,0.9)' } :
                                { backgroundColor: 'rgba(212,168,67,0.12)', color: '#D4A843' }
                              }>
                                {post.status}
                              </span>
                            </div>
                            <h3 className="font-bold text-white text-base leading-snug">{post.title}</h3>
                            <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{org} · {new Date(post.created_at).toLocaleDateString()}</div>
                            {post.excerpt && (
                              <p className="text-sm mt-2 leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{post.excerpt}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              to={`/blog/${post.id}`}
                              target="_blank"
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-all"
                              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
                            >
                              <Eye size={12} />
                              Preview
                            </Link>
                            {post.status !== 'published' && (
                              <button
                                onClick={() => updateBlogStatus(post.id, 'published')}
                                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                                style={{ backgroundColor: 'rgba(34,197,94,0.8)' }}
                              >
                                <CheckCircle size={12} />
                                Publish
                              </button>
                            )}
                            {post.status !== 'rejected' && (
                              <button
                                onClick={() => updateBlogStatus(post.id, 'rejected')}
                                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                                style={{ backgroundColor: 'rgba(255,80,80,0.7)' }}
                              >
                                <X size={12} />
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Announcements */}
            {tab === 'announcements' && (
              <div className="max-w-2xl">
                <div className="card-premium p-8">
                  <h2 className="font-bold text-white mb-2">Post Community Announcement</h2>
                  <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>Announcements are visible to all founding members and above in the Community section.</p>
                  {announcementSuccess && (
                    <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(28,116,134,0.1)', border: '1px solid rgba(28,116,134,0.2)', color: '#1C7486' }}>
                      <CheckCircle size={14} />
                      Announcement posted successfully!
                    </div>
                  )}
                  <form onSubmit={postAnnouncement} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Title</label>
                      <input
                        type="text"
                        value={announcement.title}
                        onChange={e => setAnnouncement(p => ({ ...p, title: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all"
                        style={inputStyle}
                        placeholder="Announcement title"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Content</label>
                      <textarea
                        value={announcement.content}
                        onChange={e => setAnnouncement(p => ({ ...p, content: e.target.value }))}
                        rows={5}
                        className="w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 resize-none transition-all"
                        style={inputStyle}
                        placeholder="Write your announcement here..."
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={postingAnnouncement}
                      className="btn-primary disabled:opacity-60"
                    >
                      <Send size={14} />
                      {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
