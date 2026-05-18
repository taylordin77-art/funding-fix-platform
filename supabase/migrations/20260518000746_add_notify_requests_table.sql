/*
  # Add notify_requests table

  Captures email signups for coming-soon workshops.

  1. New Tables
    - `notify_requests`: email and workshop_id for notification opt-ins
  2. Security
    - RLS enabled with insert-only policy for anonymous and authenticated users
*/

CREATE TABLE IF NOT EXISTS notify_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  workshop_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notify_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a notify request"
  ON notify_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
