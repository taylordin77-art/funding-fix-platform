-- Fix RLS policies that had WITH CHECK (true) — replace with meaningful constraints
-- All anonymous insert policies are preserved in intent (public forms work),
-- but now enforce field presence and ownership boundaries.

-- ════════════════════════════════════════════════
-- assessments: anon INSERT
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anonymous can insert assessments" ON assessments;
CREATE POLICY "Anonymous can insert assessments"
  ON assessments FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND email IS NOT NULL
    AND email <> ''
  );

-- assessments: anon UPDATE
-- Restrict to rows where user_id IS NULL (anon-owned rows only)
DROP POLICY IF EXISTS "Anonymous can update assessments" ON assessments;
CREATE POLICY "Anonymous can update assessments"
  ON assessments FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- ════════════════════════════════════════════════
-- assessment_answers: anon INSERT
-- Answers must belong to an assessment that itself has no user_id (anon-owned)
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anon can insert answers" ON assessment_answers;
CREATE POLICY "Anon can insert answers"
  ON assessment_answers FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_id
        AND a.user_id IS NULL
    )
  );

-- ════════════════════════════════════════════════
-- event_registrations: anon INSERT
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anon can insert event registrations" ON event_registrations;
CREATE POLICY "Anon can insert event registrations"
  ON event_registrations FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND email IS NOT NULL AND email <> ''
    AND full_name IS NOT NULL AND full_name <> ''
  );

-- ════════════════════════════════════════════════
-- funder_access_requests: anon + authenticated INSERT
-- Required fields must be non-empty
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can submit funder access request" ON funder_access_requests;
CREATE POLICY "Anyone can submit funder access request"
  ON funder_access_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL AND full_name <> ''
    AND organization_name IS NOT NULL AND organization_name <> ''
    AND email IS NOT NULL AND email <> ''
  );

-- ════════════════════════════════════════════════
-- hot_seat_applications: anon INSERT
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anon can insert applications" ON hot_seat_applications;
CREATE POLICY "Anon can insert applications"
  ON hot_seat_applications FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND email IS NOT NULL AND email <> ''
    AND full_name IS NOT NULL AND full_name <> ''
    AND organization_name IS NOT NULL AND organization_name <> ''
    AND challenge_description IS NOT NULL AND challenge_description <> ''
  );

-- ════════════════════════════════════════════════
-- notify_requests: anon + authenticated INSERT
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can submit a notify request" ON notify_requests;
CREATE POLICY "Anyone can submit a notify request"
  ON notify_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND email <> ''
    AND workshop_id IS NOT NULL AND workshop_id <> ''
  );

-- ════════════════════════════════════════════════
-- workshop_registrations: anon INSERT
-- ════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anon can insert workshop registrations" ON workshop_registrations;
CREATE POLICY "Anon can insert workshop registrations"
  ON workshop_registrations FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND email IS NOT NULL AND email <> ''
    AND full_name IS NOT NULL AND full_name <> ''
  );
