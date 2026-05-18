import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Tag, ArrowRight, BookOpen, Award, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AnimatedSection } from '../components/AnimatedSection';

const BRAND = { teal: '#1C7486', black: '#0D1213', gold: '#D4A843', white: '#FFFFFF' };

export const BLOG_CATEGORIES = [
  'Grant Strategy', 'Board Development', 'Funding Readiness', 'Program Design',
  'Compliance', 'Community Impact', 'Organizational Health',
];

interface BlogPost {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string;
  category: string;
  featured_image_url: string;
  published_at: string;
  author_id: string;
  profiles?: { organization_name: string };
}

export function CategoryBadge({ category, light = false }: { category: string; light?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={light
        ? { backgroundColor: 'rgba(28,116,134,0.1)', color: BRAND.teal, border: '1px solid rgba(28,116,134,0.15)' }
        : { backgroundColor: BRAND.teal + '20', color: BRAND.teal }
      }
    >
      <Tag size={10} /> {category}
    </span>
  );
}

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const href = `/blog/${post.slug || post.id}`;
  const orgName = post.profiles?.organization_name || 'Funding Fix Member';
  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  if (featured) {
    return (
      <Link to={href} className="group block card-premium overflow-hidden hover:border-teal-500/30 transition-all">
        <div className="img-zoom relative" style={{ height: 200, backgroundColor: 'rgba(28,116,134,0.1)' }}>
          {post.featured_image_url ? (
            <img src={post.featured_image_url} alt={post.title} loading="lazy" className="w-full h-full object-cover opacity-75" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={40} style={{ color: 'rgba(28,116,134,0.3)' }} />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-20" style={{ background: 'linear-gradient(to top, rgba(20,20,20,0.9), transparent)' }} />
        </div>
        <div className="p-6">
          <CategoryBadge category={post.category} />
          <h2 className="text-base font-bold mt-3 mb-2 text-white leading-snug line-clamp-2 group-hover:text-teal-400 transition-colors">{post.title}</h2>
          {post.excerpt && <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{post.excerpt}</p>}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{orgName}</div>
              <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Calendar size={10} /> {date}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: BRAND.teal }}>
              Read More <ChevronRight size={13} />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="group flex gap-4 card-premium p-4 hover:border-teal-500/20 transition-all">
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: 'rgba(28,116,134,0.1)' }}>
        {post.featured_image_url ? (
          <img src={post.featured_image_url} alt={post.title} loading="lazy" className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={20} style={{ color: 'rgba(28,116,134,0.35)' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <CategoryBadge category={post.category} />
        <h3 className="font-bold text-white text-sm mt-1.5 mb-1 group-hover:opacity-75 transition-opacity leading-snug line-clamp-2">{post.title}</h3>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{orgName}</span>
          <span>·</span>
          <span>{date}</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, featured_image_url, published_at, author_id, profiles(organization_name)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts((data as unknown as BlogPost[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = activeCategory ? posts.filter(p => p.category === activeCategory) : posts;
  const featured = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.black }}>

      {/* ═══ HERO — Dark + teal ═══ */}
      <section className="relative overflow-hidden section-padding" style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,116,134,0.18) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="orb" style={{ width: 500, height: 500, background: 'rgba(28,116,134,0.1)', top: '-15%', right: '-5%', animationDuration: '24s' }} />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <AnimatedSection direction="up">
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full text-sm font-medium glass-teal">
              <BookOpen size={13} style={{ color: BRAND.teal }} />
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>The Knowledge Hub</span>
            </div>
            <h1 className="heading-xl text-white mb-4">Insights for Nonprofit Leaders</h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Strategies, frameworks, and real experiences from the Funding Fix community. Written by nonprofit leaders, for nonprofit leaders.
            </p>

            {/* Category filter buttons — no separate teal section */}
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              <button
                onClick={() => setActiveCategory('')}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                style={!activeCategory
                  ? { backgroundColor: '#1C7486', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(28,116,134,0.4)' }
                  : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                All Posts
              </button>
              {BLOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                  style={activeCategory === cat
                    ? { backgroundColor: '#1C7486', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(28,116,134,0.4)' }
                    : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══ MAIN CONTENT — Dark ═══ */}
      <section className="section-dark section-padding">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Posts */}
            <div className="lg:col-span-2 space-y-8">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="card-premium h-64 animate-pulse" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="card-premium p-16 text-center">
                  <BookOpen size={40} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <p style={{ color: 'rgba(255,255,255,0.35)' }}>No posts yet in this category. Check back soon.</p>
                </div>
              ) : (
                <>
                  {featured.length > 0 && (
                    <AnimatedSection direction="up">
                      <h2 className="text-base font-bold text-white mb-4">Recent Posts</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {featured.slice(0, 2).map(post => <PostCard key={post.id} post={post} featured />)}
                      </div>
                      {featured[2] && <div className="mt-4"><PostCard post={featured[2]} featured /></div>}
                    </AnimatedSection>
                  )}
                  {rest.length > 0 && (
                    <AnimatedSection direction="up" delay={60}>
                      <h2 className="text-base font-bold text-white mb-4">All Posts</h2>
                      <div className="space-y-3">
                        {rest.map(post => <PostCard key={post.id} post={post} />)}
                      </div>
                    </AnimatedSection>
                  )}
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <AnimatedSection direction="up" delay={80}>
                <div className="card-gold p-6">
                  <BookOpen size={22} className="mb-3" style={{ color: BRAND.gold }} />
                  <h3 className="font-bold text-lg text-white mb-2">Are you a member?</h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Share your expertise with the community. Submit a post and your voice could reach thousands of nonprofit leaders.
                  </p>
                  {user ? (
                    <Link to="/blog/submit" className="btn-gold w-full justify-center">
                      Start Writing <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <Link to="/login" className="btn-gold w-full justify-center">
                      Sign In to Write <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              </AnimatedSection>

            </div>
          </div>

          {/* Award Section */}
          <AnimatedSection direction="up" delay={60} className="mt-16">
            <div className="card-gold rounded-2xl overflow-hidden">
              <div className="p-8 md:p-10">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 icon-3d" style={{ backgroundColor: BRAND.gold }}>
                    <Award size={28} style={{ color: '#0D1213' }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.gold }}>Annual Recognition</div>
                    <h2 className="heading-lg text-white mb-3">Annual Member Contribution Award</h2>
                    <p className="leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      Each year we recognize one outstanding member contributor whose writing has strengthened the community and advanced the mission of nonprofit sustainability. The winner receives a sponsorship package that includes cash support toward an organizational event, capacity building and funding strategy services, and professional event planning support.
                    </p>
                    <Link to="/blog/award" className="btn-gold">
                      Learn More About the Award <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
