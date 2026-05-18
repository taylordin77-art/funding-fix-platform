import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BLOG_CATEGORIES } from './BlogPage';

const BRAND = { teal: '#1C7486', black: '#0A0A0A', gold: '#D4A843', white: '#FFFFFF' };

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function BlogSubmitPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    body: '',
    category: BLOG_CATEGORIES[0],
    featured_image_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    outline: 'none',
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
        <div>
          <BookOpen size={48} className="mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>You need to be signed in to submit a blog post.</p>
          <Link to="/login" className="btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSubmitting(true);
    const slug = slugify(form.title) + '-' + Date.now().toString(36);
    const { error: dbErr } = await supabase.from('blog_posts').insert({
      author_id: user!.id,
      title: form.title.trim(),
      slug,
      excerpt: form.excerpt.trim(),
      body: form.body.trim(),
      category: form.category,
      featured_image_url: form.featured_image_url.trim(),
      status: 'pending',
    });
    if (dbErr) {
      setError('Submission failed. Please try again.');
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-teal-500/30 transition-all';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm transition-colors mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <ArrowLeft size={14} />
          Back to Blog
        </Link>

        {submitted ? (
          <div className="card-premium p-12 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: 'rgba(28,116,134,0.15)' }}>
              <CheckCircle size={32} style={{ color: BRAND.teal }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Post Submitted!</h2>
            <p className="leading-relaxed max-w-md mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Your post has been submitted for review. The C-SHIFT team will review it and publish it once approved.
            </p>
            <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>You will be notified when your post goes live.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/blog" className="btn-primary">Back to Blog</Link>
              <button
                onClick={() => { setSubmitted(false); setForm({ title: '', excerpt: '', body: '', category: BLOG_CATEGORIES[0], featured_image_url: '' }); }}
                className="btn-ghost"
              >
                Write Another Post
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Submit a Blog Post</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)' }}>Share your expertise with the C-SHIFT community. All posts are reviewed by the admin team before publishing.</p>
            </div>

            <div className="card-premium p-8">
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(28,116,134,0.08)', border: '1px solid rgba(28,116,134,0.15)' }}>
                <BookOpen size={17} style={{ color: BRAND.teal }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: BRAND.teal }}>Your post will be published under your organization name</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Displaying as: {profile.organization_name || 'Your Organization'}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Post Title *</label>
                  <input
                    type="text"
                    placeholder="Enter your post title..."
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className={`${inputCls} cursor-pointer`}
                    style={{ ...inputStyle, appearance: 'none' as const }}
                  >
                    {BLOG_CATEGORIES.map(cat => (
                      <option key={cat} value={cat} style={{ backgroundColor: '#141414' }}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Excerpt (short summary)</label>
                  <textarea
                    placeholder="Write a 1-2 sentence summary of your post..."
                    value={form.excerpt}
                    onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))}
                    rows={2}
                    className={`${inputCls} resize-none`}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Post Content *</label>
                  <textarea
                    placeholder="Write your full post here. Share your experience, insights, and actionable advice for other nonprofit leaders..."
                    value={form.body}
                    onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                    rows={16}
                    className={`${inputCls} resize-none font-[inherit]`}
                    style={inputStyle}
                    required
                  />
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{form.body.length} characters</div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Featured Image URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.featured_image_url}
                    onChange={e => setForm(p => ({ ...p, featured_image_url: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  />
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Paste a direct URL to an image. The image must be publicly accessible.</p>
                </div>

                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', color: '#D4A843' }}>
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    By submitting, you confirm this is original content and agree to our community guidelines.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary disabled:opacity-60"
                  >
                    {submitting ? (
                      <><Loader2 size={15} className="animate-spin" /> Submitting...</>
                    ) : 'Submit for Review'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
