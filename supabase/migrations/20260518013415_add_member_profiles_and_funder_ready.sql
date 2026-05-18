/*
  # Member Profiles and Funder Ready Feature

  1. Adds member profile fields to profiles table
     - mission_statement, focus_area, geographic_location, population_served
     - annual_budget_range, current_programs, funding_needs
     - profile_visibility enum (public/members_only/private)
     - funder_ready, funder_ready_approved, funder_ready_score, is_featured
  2. Creates funder_access_requests table
  3. Updates membership tier type reference
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'mission_statement') THEN
    ALTER TABLE profiles ADD COLUMN mission_statement text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'focus_area') THEN
    ALTER TABLE profiles ADD COLUMN focus_area text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'geographic_location') THEN
    ALTER TABLE profiles ADD COLUMN geographic_location text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'population_served') THEN
    ALTER TABLE profiles ADD COLUMN population_served text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'annual_budget_range') THEN
    ALTER TABLE profiles ADD COLUMN annual_budget_range text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_programs') THEN
    ALTER TABLE profiles ADD COLUMN current_programs text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'funding_needs') THEN
    ALTER TABLE profiles ADD COLUMN funding_needs text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_visibility') THEN
    ALTER TABLE profiles ADD COLUMN profile_visibility text DEFAULT 'private';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'funder_ready') THEN
    ALTER TABLE profiles ADD COLUMN funder_ready boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'funder_ready_approved') THEN
    ALTER TABLE profiles ADD COLUMN funder_ready_approved boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'funder_ready_score') THEN
    ALTER TABLE profiles ADD COLUMN funder_ready_score integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_featured') THEN
    ALTER TABLE profiles ADD COLUMN is_featured boolean DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS funder_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  organization_name text NOT NULL,
  funding_focus_areas text NOT NULL DEFAULT '',
  email text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE funder_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit funder access request"
  ON funder_access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view funder access requests"
  ON funder_access_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
