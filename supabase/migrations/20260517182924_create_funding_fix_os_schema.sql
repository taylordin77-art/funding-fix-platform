/*
  # The Funding Fix OS by C-SHIFT - Full Schema

  1. New Tables
    - `profiles` - Extended user profiles with role and membership tier
    - `assessments` - Fundability assessments with pillar scores
    - `assessment_answers` - Individual question answers per assessment
    - `resources` - Resource library items organized by pillar
    - `workshop_registrations` - Workshop registration records
    - `community_threads` - Community discussion threads
    - `community_replies` - Replies to community threads
    - `announcements` - Admin announcements for community
    - `client_documents` - Documents uploaded by C-SHIFT for clients
    - `client_sessions` - Scheduled sessions for consulting clients
    - `client_messages` - Direct messages/notes for client portal
    - `events` - Events and programs (Summit, grants, etc.)
    - `event_registrations` - Event registration records
    - `hot_seat_applications` - Workshop hot seat applications

  2. Security
    - RLS enabled on all tables
    - Role-based access (admin, client, member, free)
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  organization_name text DEFAULT '',
  role text DEFAULT 'free' CHECK (role IN ('free', 'member', 'client', 'admin')),
  membership_tier text DEFAULT 'free' CHECK (membership_tier IN ('free', 'core', 'premium', 'done_for_you')),
  phone text DEFAULT '',
  bio text DEFAULT '',
  stripe_customer_id text DEFAULT '',
  stripe_subscription_id text DEFAULT '',
  subscription_status text DEFAULT 'inactive',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Allow profile insert on signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  organization_name text DEFAULT '',
  total_score integer DEFAULT 0,
  max_score integer DEFAULT 150,
  clarity_score integer DEFAULT 0,
  structure_score integer DEFAULT 0,
  health_score integer DEFAULT 0,
  impact_score integer DEFAULT 0,
  funding_score integer DEFAULT 0,
  transformation_score integer DEFAULT 0,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  results_emailed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments"
  ON assessments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments"
  ON assessments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments"
  ON assessments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all assessments"
  ON assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Allow anonymous users to create assessments (free access)
CREATE POLICY "Anonymous can insert assessments"
  ON assessments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can select their assessment by id"
  ON assessments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can update assessments"
  ON assessments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Assessment Answers
CREATE TABLE IF NOT EXISTS assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  pillar text NOT NULL CHECK (pillar IN ('clarity', 'structure', 'health', 'impact', 'funding', 'transformation')),
  question_index integer NOT NULL,
  question_text text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assessment owner can view answers"
  ON assessment_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.user_id = auth.uid())
  );

CREATE POLICY "Assessment owner can insert answers"
  ON assessment_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM assessments a WHERE a.id = assessment_id AND a.user_id = auth.uid())
  );

CREATE POLICY "Admin can view all answers"
  ON assessment_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Anon can insert answers"
  ON assessment_answers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can select answers"
  ON assessment_answers FOR SELECT
  TO anon
  USING (true);

-- Resources Library
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  pillar text CHECK (pillar IN ('clarity', 'structure', 'health', 'impact', 'funding', 'transformation', 'general')),
  resource_type text DEFAULT 'document' CHECK (resource_type IN ('document', 'template', 'guide', 'video', 'tool')),
  file_url text DEFAULT '',
  external_url text DEFAULT '',
  min_tier text DEFAULT 'core' CHECK (min_tier IN ('free', 'core', 'premium', 'done_for_you')),
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view published resources by tier"
  ON resources FOR SELECT
  TO authenticated
  USING (
    is_published = true AND (
      min_tier = 'free' OR
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
          (min_tier = 'core' AND p.membership_tier IN ('core', 'premium', 'done_for_you')) OR
          (min_tier = 'premium' AND p.membership_tier IN ('premium', 'done_for_you')) OR
          (min_tier = 'done_for_you' AND p.membership_tier = 'done_for_you') OR
          p.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admins can manage resources"
  ON resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins can update resources"
  ON resources FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Workshop Registrations
CREATE TABLE IF NOT EXISTS workshop_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  organization_name text DEFAULT '',
  phone text DEFAULT '',
  stripe_payment_intent_id text DEFAULT '',
  stripe_session_id text DEFAULT '',
  amount_paid integer DEFAULT 0,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  workshop_date text DEFAULT '',
  confirmation_sent boolean DEFAULT false,
  materials_sent boolean DEFAULT false,
  zoom_link_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workshop_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own registrations"
  ON workshop_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own registrations"
  ON workshop_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all registrations"
  ON workshop_registrations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update registrations"
  ON workshop_registrations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Anon can insert workshop registrations"
  ON workshop_registrations FOR INSERT
  TO anon
  WITH CHECK (true);

-- Community Threads
CREATE TABLE IF NOT EXISTS community_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  pillar text CHECK (pillar IN ('clarity', 'structure', 'health', 'impact', 'funding', 'transformation', 'general')),
  is_pinned boolean DEFAULT false,
  reply_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE community_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view community threads"
  ON community_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.membership_tier IN ('core', 'premium', 'done_for_you') OR p.role = 'admin')
  );

CREATE POLICY "Members can create threads"
  ON community_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.membership_tier IN ('core', 'premium', 'done_for_you') OR p.role = 'admin'))
  );

CREATE POLICY "Authors can update own threads"
  ON community_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Admins can manage all threads"
  ON community_threads FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Community Replies
CREATE TABLE IF NOT EXISTS community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES community_threads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view replies"
  ON community_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.membership_tier IN ('core', 'premium', 'done_for_you') OR p.role = 'admin'))
  );

CREATE POLICY "Members can create replies"
  ON community_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.membership_tier IN ('core', 'premium', 'done_for_you') OR p.role = 'admin'))
  );

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    is_published = true AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.membership_tier IN ('core', 'premium', 'done_for_you') OR p.role = 'admin'))
  );

CREATE POLICY "Admins can manage announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Client Documents
CREATE TABLE IF NOT EXISTS client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES profiles(id),
  title text NOT NULL,
  description text DEFAULT '',
  file_url text NOT NULL,
  file_type text DEFAULT '',
  pillar text CHECK (pillar IN ('clarity', 'structure', 'health', 'impact', 'funding', 'transformation', 'general')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own documents"
  ON client_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Admins can manage client documents"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can view all documents"
  ON client_documents FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update documents"
  ON client_documents FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Client Sessions
CREATE TABLE IF NOT EXISTS client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  zoom_link text DEFAULT '',
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own sessions"
  ON client_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Admins can manage sessions"
  ON client_sessions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can view all sessions"
  ON client_sessions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update sessions"
  ON client_sessions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Client Messages
CREATE TABLE IF NOT EXISTS client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own messages"
  ON client_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = sender_id);

CREATE POLICY "Clients can send messages"
  ON client_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can view all messages"
  ON client_messages FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can send messages"
  ON client_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Clients can mark messages read"
  ON client_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_type text DEFAULT 'general' CHECK (event_type IN ('summit', 'workshop', 'grant', 'program', 'general')),
  event_date timestamptz,
  registration_deadline timestamptz,
  max_attendees integer,
  current_attendees integer DEFAULT 0,
  price_cents integer DEFAULT 0,
  is_published boolean DEFAULT true,
  registration_url text DEFAULT '',
  location text DEFAULT '',
  is_virtual boolean DEFAULT true,
  zoom_link text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published events"
  ON events FOR SELECT
  TO authenticated
  USING (is_published = true);

CREATE POLICY "Anon can view published events"
  ON events FOR SELECT
  TO anon
  USING (is_published = true);

CREATE POLICY "Admins can manage events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Event Registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  organization_name text DEFAULT '',
  phone text DEFAULT '',
  stripe_session_id text DEFAULT '',
  payment_status text DEFAULT 'pending',
  additional_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event registrations"
  ON event_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert event registrations"
  ON event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anon can insert event registrations"
  ON event_registrations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Admins can view all event registrations"
  ON event_registrations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Hot Seat Applications
CREATE TABLE IF NOT EXISTS hot_seat_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  organization_name text NOT NULL,
  challenge_description text NOT NULL,
  desired_outcome text NOT NULL,
  years_operating text DEFAULT '',
  annual_budget text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'completed')),
  admin_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hot_seat_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
  ON hot_seat_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON hot_seat_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anon can insert applications"
  ON hot_seat_applications FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Admins can manage applications"
  ON hot_seat_applications FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update applications"
  ON hot_seat_applications FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_assessment_id ON assessment_answers(assessment_id);
CREATE INDEX IF NOT EXISTS idx_resources_pillar ON resources(pillar);
CREATE INDEX IF NOT EXISTS idx_community_threads_pillar ON community_threads(pillar);
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_client_id ON client_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_client_id ON client_messages(client_id);
