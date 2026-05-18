import { useState, useEffect } from 'react';
import { Search, Download, ExternalLink, Lock, FileText, BookOpen, Video, Wrench, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Resource, PILLARS, Pillar } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';

const RESOURCE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  document: FileText,
  template: FileText,
  guide: BookOpen,
  video: Video,
  tool: Wrench,
};

const TIER_ORDER = { free: 0, founding_member: 1, premium: 2, white_glove: 3 };

function canAccess(userTier: string | undefined, minTier: string): boolean {
  const userLevel = TIER_ORDER[userTier as keyof typeof TIER_ORDER] ?? -1;
  const minLevel = TIER_ORDER[minTier as keyof typeof TIER_ORDER] ?? 0;
  return userLevel >= minLevel;
}

export default function ResourcesPage() {
  const { profile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPillar, setFilterPillar] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    supabase
      .from('resources')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setResources(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = resources.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchPillar = filterPillar === 'all' || r.pillar === filterPillar;
    const matchType = filterType === 'all' || r.resource_type === filterType;
    return matchSearch && matchPillar && matchType;
  });

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    outline: 'none',
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <div className="relative overflow-hidden py-16" style={{ background: 'linear-gradient(135deg, #F7F6F3 0%, rgba(28,116,134,0.06) 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(28,116,134,0.07) 0%, transparent 70%)' }} />
        <div className="relative max-w-6xl mx-auto px-4">
          <AnimatedSection direction="up">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#1C7486' }}>Members Only</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#0D1213' }}>Resource Library</h1>
            <p className="text-base max-w-2xl" style={{ color: '#4B5563' }}>
              Templates, guides, and tools to strengthen every Fundability Framework pillar.
            </p>
          </AnimatedSection>

          {/* Search and Filters */}
          <AnimatedSection direction="up" delay={80}>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(0,0,0,0.3)' }} />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/30 transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#0D1213', outline: 'none' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={15} style={{ color: 'rgba(0,0,0,0.3)' }} />
                <select
                  value={filterPillar}
                  onChange={e => setFilterPillar(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/30 transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#0D1213', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="all">All Pillars</option>
                  {PILLARS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                  <option value="general">General</option>
                </select>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/30 transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#0D1213', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="all">All Types</option>
                  <option value="template">Templates</option>
                  <option value="guide">Guides</option>
                  <option value="document">Documents</option>
                  <option value="video">Videos</option>
                  <option value="tool">Tools</option>
                </select>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Access banners */}
        {!profile && (
          <AnimatedSection direction="up">
            <div className="card-light p-5 mb-8 flex items-start gap-4" style={{ borderColor: 'rgba(28,116,134,0.2)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(28,116,134,0.1)' }}>
                <Lock size={16} style={{ color: '#1C7486' }} />
              </div>
              <div>
                <h3 className="font-bold mb-1" style={{ color: '#0D1213' }}>Sign In to Access Resources</h3>
                <p className="text-sm mb-3" style={{ color: '#6B7280' }}>Create a free account or sign in to access available resources.</p>
                <div className="flex gap-3">
                  <Link to="/login" className="btn-primary text-sm py-2 px-4">Sign In</Link>
                  <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid rgba(0,0,0,0.15)', color: '#374151', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}>Create Account</Link>
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}

        {profile?.membership_tier === 'free' && (
          <AnimatedSection direction="up">
            <div className="card-light p-5 mb-8 flex items-start gap-4" style={{ borderColor: 'rgba(212,168,67,0.3)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(212,168,67,0.1)' }}>
                <Lock size={16} style={{ color: '#D4A843' }} />
              </div>
              <div>
                <h3 className="font-bold mb-1" style={{ color: '#0D1213' }}>Upgrade to Access the Full Library</h3>
                <p className="text-sm mb-3" style={{ color: '#6B7280' }}>Founding members and above have access to all resources and tools.</p>
                <Link to="/pricing" className="btn-gold text-sm py-2 px-4">View Plans</Link>
              </div>
            </div>
          </AnimatedSection>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="w-9 h-9 rounded-full animate-spin mx-auto mb-4" style={{ border: '3px solid rgba(28,116,134,0.15)', borderTopColor: '#1C7486' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Loading resources...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#9CA3AF' }}>
            No resources match your filters. Try adjusting your search.
          </div>
        ) : (
          <>
            <div className="text-xs mb-5 font-medium" style={{ color: '#9CA3AF' }}>
              {filtered.length} resource{filtered.length !== 1 ? 's' : ''} found
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((resource, idx) => {
                const Icon = RESOURCE_ICONS[resource.resource_type] || FileText;
                const accessible = profile ? canAccess(profile.membership_tier, resource.min_tier) : resource.min_tier === 'free';
                const pillarInfo = PILLARS.find(p => p.key === resource.pillar);
                const color = pillarInfo?.color || '#1C7486';

                return (
                  <AnimatedSection key={resource.id} direction="up" delay={idx * 40}>
                    <div
                      className="card-light p-6 flex flex-col h-full"
                      style={{ opacity: !accessible ? 0.7 : 1 }}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 icon-3d"
                          style={{ backgroundColor: color }}
                        >
                          <Icon size={18} style={{ color: '#FFFFFF' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm leading-tight" style={{ color: '#0D1213' }}>{resource.title}</h3>
                            {!accessible && <Lock size={13} style={{ color: '#9CA3AF', flexShrink: 0 }} className="mt-0.5" />}
                          </div>
                          {resource.pillar && resource.pillar !== 'general' && (
                            <span
                              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
                              style={{ backgroundColor: color + '15', color }}
                            >
                              {resource.pillar.charAt(0).toUpperCase() + resource.pillar.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: '#4B5563' }}>
                        {resource.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs capitalize font-medium" style={{ color: '#9CA3AF' }}>{resource.resource_type}</span>
                        {accessible ? (
                          resource.file_url || resource.external_url ? (
                            <a
                              href={resource.file_url || resource.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                              style={{ backgroundColor: color }}
                            >
                              {resource.file_url ? <Download size={12} /> : <ExternalLink size={12} />}
                              {resource.file_url ? 'Download' : 'View'}
                            </a>
                          ) : (
                            <span
                              className="text-xs px-3 py-1.5 rounded-lg font-medium"
                              style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: '#9CA3AF' }}
                            >
                              Coming soon
                            </span>
                          )
                        ) : (
                          <Link
                            to="/pricing"
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                            style={{ backgroundColor: '#1C7486' }}
                          >
                            <Lock size={12} />
                            Upgrade
                          </Link>
                        )}
                      </div>
                    </div>
                  </AnimatedSection>
                );
              })}
            </div>
          </>
        )}

        {/* Browse by Pillar */}
        <AnimatedSection direction="up" delay={100}>
          <div className="mt-12 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            {/* Gold header card */}
            <div className="p-6 pb-5" style={{ background: 'linear-gradient(135deg, #D4A843 0%, #E8C876 100%)', boxShadow: '0 4px 20px rgba(212,168,67,0.35)' }}>
              <h2 className="text-xl font-extrabold" style={{ color: '#0D1213' }}>Browse by Pillar</h2>
              <p className="text-sm font-medium mt-1" style={{ color: 'rgba(13,18,19,0.65)' }}>Select a pillar to filter resources to that area of focus</p>
            </div>
            {/* Pillar tiles on white */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {PILLARS.map(p => {
                  const isActive = filterPillar === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setFilterPillar(isActive ? 'all' : p.key)}
                      className="p-4 rounded-xl text-center transition-all duration-200 hover:scale-105"
                      style={isActive
                        ? { backgroundColor: p.color, border: `2px solid ${p.color}`, boxShadow: `0 6px 20px ${p.color}40` }
                        : { border: '2px solid rgba(0,0,0,0.08)', background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
                      }
                    >
                      {/* Letter tile — always teal background */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-base mx-auto mb-2 icon-3d"
                        style={{ backgroundColor: '#1C7486' }}
                      >
                        {p.label[0]}
                      </div>
                      <div className="text-xs font-bold" style={{ color: isActive ? '#FFFFFF' : '#0D1213' }}>
                        {p.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
