import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Tag, ArrowLeft, Share2, Linkedin, Mail, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CategoryBadge } from './BlogPage';

const BRAND = { teal: '#1C7486', black: '#0A0A0A', gold: '#D4A843', white: '#FFFFFF' };

interface FullPost {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string;
  body: string;
  category: string;
  featured_image_url: string;
  published_at: string;
  profiles?: { organization_name: string };
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<FullPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, body, category, featured_image_url, published_at, profiles(organization_name)')
      .eq('status', 'published')
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) setError('Post not found.');
        else setPost(data as unknown as FullPost);
        setLoading(false);
      });
  }, [slug]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = post?.title || '';

  function shareLinkedIn() {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
  }
  function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  }
  function shareEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="w-9 h-9 rounded-full animate-spin" style={{ border: '3px solid rgba(28,116,134,0.2)', borderTopColor: '#1C7486' }} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
        <div>
          <BookOpen size={48} className="mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Post not found.</p>
          <Link to="/blog" className="btn-primary">Back to Blog</Link>
        </div>
      </div>
    );
  }

  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const orgName = post.profiles?.organization_name || 'C-SHIFT Member';

  const shareButtonStyle = {
    padding: '0.5rem',
    borderRadius: '0.75rem',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    transition: 'all 0.2s',
    cursor: 'pointer',
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm transition-colors mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <ArrowLeft size={14} />
            Back to Blog
          </Link>

          <div className="mb-4">
            <CategoryBadge category={post.category} />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-5">{post.title}</h1>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{orgName}</div>
              <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Calendar size={10} />
                {date}
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.03)' }}
              >
                <Share2 size={14} style={{ color: BRAND.teal }} />
                Share
              </button>
              {showShareMenu && (
                <div className="absolute right-0 mt-2 rounded-xl py-1 z-10 w-44" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <button onClick={shareLinkedIn} className="flex items-center gap-3 px-4 py-2.5 text-sm w-full transition-all" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Linkedin size={14} style={{ color: '#0077b5' }} />
                    LinkedIn
                  </button>
                  <button onClick={shareFacebook} className="flex items-center gap-3 px-4 py-2.5 text-sm w-full transition-all" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <BookOpen size={14} style={{ color: BRAND.teal }} />
                    Facebook
                  </button>
                  <button onClick={shareEmail} className="flex items-center gap-3 px-4 py-2.5 text-sm w-full transition-all" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Mail size={14} style={{ color: BRAND.gold }} />
                    Email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {post.featured_image_url && (
          <div className="rounded-2xl overflow-hidden mb-8">
            <img src={post.featured_image_url} alt={post.title} loading="lazy" className="w-full object-cover max-h-80 opacity-85" />
          </div>
        )}

        {post.excerpt && (
          <p className="text-lg leading-relaxed mb-8 pl-4 italic" style={{ color: 'rgba(255,255,255,0.6)', borderLeft: `3px solid ${BRAND.teal}` }}>
            {post.excerpt}
          </p>
        )}

        <div className="leading-relaxed" style={{ lineHeight: '1.85', fontSize: '1.0625rem', color: 'rgba(255,255,255,0.72)' }}>
          {post.body.split('\n').map((para, i) =>
            para.trim() ? <p key={i} className="mb-5">{para}</p> : <div key={i} className="mb-3" />
          )}
        </div>

        {/* Bottom Share */}
        <div className="mt-12 pt-8 flex items-center justify-between flex-wrap gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Written by</div>
            <div className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{orgName}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm mr-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Share:</span>
            <button onClick={shareLinkedIn} style={shareButtonStyle}>
              <Linkedin size={15} style={{ color: '#0077b5' }} />
            </button>
            <button onClick={shareFacebook} style={shareButtonStyle}>
              <BookOpen size={15} style={{ color: BRAND.teal }} />
            </button>
            <button onClick={shareEmail} style={shareButtonStyle}>
              <Mail size={15} style={{ color: BRAND.gold }} />
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/blog" className="btn-primary">
            <ArrowLeft size={14} />
            Back to All Posts
          </Link>
        </div>
      </div>
    </div>
  );
}
