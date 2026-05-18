/*
  # Blog, Community Rooms, and Award Feature

  1. New Tables
    - `blog_posts`: Member-submitted and admin-approved blog posts
      - title, slug, body, excerpt, category, featured_image_url
      - author_id (profiles), status (draft/pending/published/rejected)
      - published_at, admin_notes
    - `blog_categories`: Static lookup (seeded)
    - `boardroom_guests`: Scheduled guest appearances in the Funding Boardroom
      - guest_name, title, topic, scheduled_at, guest_type, is_active
    - `boardroom_threads`: Threads tied to guest appearances or general boardroom
    - `boardroom_posts`: Posts within boardroom threads
    - `award_nominations`: Member nominations for Annual Contribution Award
    - `award_votes`: Member votes for the award

  2. Community table additions
    - Add room field to community_threads ('general' | 'boardroom')
    - Add weekly_prompt table for Monday prompts

  3. Security: RLS on all tables
*/

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  slug text UNIQUE,
  excerpt text DEFAULT '',
  body text DEFAULT '',
  category text DEFAULT 'Grant Strategy',
  featured_image_url text DEFAULT '',
  status text DEFAULT 'pending',
  admin_notes text DEFAULT '',
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published blog posts"
  ON blog_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Authors can read own posts"
  ON blog_posts FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Admins can read all blog posts"
  ON blog_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated members can submit posts"
  ON blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own draft or pending posts"
  ON blog_posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() AND status IN ('draft', 'pending'))
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Admins can update any blog post"
  ON blog_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Weekly prompts
CREATE TABLE IF NOT EXISTS weekly_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  week_of date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active weekly prompts"
  ON weekly_prompts FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage weekly prompts"
  ON weekly_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Add room column to community_threads if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_threads' AND column_name = 'room'
  ) THEN
    ALTER TABLE community_threads ADD COLUMN room text DEFAULT 'general';
  END IF;
END $$;

-- Boardroom Guests
CREATE TABLE IF NOT EXISTS boardroom_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL DEFAULT '',
  guest_title text DEFAULT '',
  topic text DEFAULT '',
  guest_type text DEFAULT 'C-SHIFT Funding Strategist',
  scheduled_at timestamptz,
  is_active boolean DEFAULT true,
  thread_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boardroom_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members can view boardroom guests"
  ON boardroom_guests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND membership_tier IN ('premium', 'white_glove')
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage boardroom guests"
  ON boardroom_guests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Award Nominations
CREATE TABLE IF NOT EXISTS award_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nominator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  nominee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  award_year integer DEFAULT EXTRACT(YEAR FROM now())::integer,
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (nominator_id, nominee_id, award_year)
);

ALTER TABLE award_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can nominate"
  ON award_nominations FOR INSERT
  TO authenticated
  WITH CHECK (nominator_id = auth.uid());

CREATE POLICY "Members can read nominations"
  ON award_nominations FOR SELECT
  TO authenticated
  USING (true);

-- Award Votes
CREATE TABLE IF NOT EXISTS award_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  nominee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  award_year integer DEFAULT EXTRACT(YEAR FROM now())::integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (voter_id, award_year)
);

ALTER TABLE award_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can vote once per year"
  ON award_votes FOR INSERT
  TO authenticated
  WITH CHECK (voter_id = auth.uid());

CREATE POLICY "Members can read votes"
  ON award_votes FOR SELECT
  TO authenticated
  USING (true);

-- Boardroom question submissions
CREATE TABLE IF NOT EXISTS boardroom_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES boardroom_guests(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  is_answered boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boardroom_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Premium members can submit boardroom questions"
  ON boardroom_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND membership_tier IN ('premium', 'white_glove')
    )
  );

CREATE POLICY "Premium members can read boardroom questions"
  ON boardroom_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (membership_tier IN ('premium', 'white_glove') OR role = 'admin')
    )
  );
