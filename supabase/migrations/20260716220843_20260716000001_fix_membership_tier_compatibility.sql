/*
  # Membership Tier Compatibility Repair

  Problem: Original schema used 'core' / 'done_for_you' but application code,
  Stripe webhook, and TypeScript types all use 'founding_member' / 'white_glove'.
  The resources table uses 'core' as min_tier for 8 rows.

  Changes (all additive / non-destructive):
  1. Drop old profiles.membership_tier CHECK constraint
  2. Migrate any existing profile rows: core→founding_member, done_for_you→white_glove
  3. Add new CHECK constraint with full canonical set
  4. Migrate resources.min_tier: core→founding_member, done_for_you→white_glove
  5. Add growth_member to the valid set for both columns
  6. Drop old resources.min_tier CHECK and recreate
  7. Recreate all RLS policies that referenced old tier names
*/

-- ══════════════════════════════════════════════════════════
-- STEP 1: Drop old profiles membership_tier CHECK constraint
-- ══════════════════════════════════════════════════════════
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_membership_tier_check;

-- ══════════════════════════════════════════════════════════
-- STEP 2: Migrate existing profile rows (safe even if 0 rows)
-- ══════════════════════════════════════════════════════════
UPDATE profiles SET membership_tier = 'founding_member' WHERE membership_tier = 'core';
UPDATE profiles SET membership_tier = 'white_glove'     WHERE membership_tier = 'done_for_you';

-- ══════════════════════════════════════════════════════════
-- STEP 3: Add new CHECK constraint with canonical tier set
-- ══════════════════════════════════════════════════════════
ALTER TABLE profiles
  ADD CONSTRAINT profiles_membership_tier_check
  CHECK (membership_tier IN ('free', 'founding_member', 'growth_member', 'premium', 'white_glove'));

-- ══════════════════════════════════════════════════════════
-- STEP 4: Migrate resources.min_tier values
-- ══════════════════════════════════════════════════════════
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_min_tier_check;

UPDATE resources SET min_tier = 'founding_member' WHERE min_tier = 'core';
UPDATE resources SET min_tier = 'white_glove'     WHERE min_tier = 'done_for_you';

ALTER TABLE resources
  ADD CONSTRAINT resources_min_tier_check
  CHECK (min_tier IN ('free', 'founding_member', 'growth_member', 'premium', 'white_glove'));

-- ══════════════════════════════════════════════════════════
-- STEP 5: Fix community_threads RLS policies
-- ══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view community threads" ON community_threads;
CREATE POLICY "Members can view community threads"
  ON community_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.membership_tier IN ('founding_member', 'growth_member', 'premium', 'white_glove')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "Members can create threads" ON community_threads;
CREATE POLICY "Members can create threads"
  ON community_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.membership_tier IN ('founding_member', 'growth_member', 'premium', 'white_glove')
          OR p.role = 'admin'
        )
    )
  );

-- ══════════════════════════════════════════════════════════
-- STEP 6: Fix community_replies RLS policies
-- ══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view replies" ON community_replies;
CREATE POLICY "Members can view replies"
  ON community_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.membership_tier IN ('founding_member', 'growth_member', 'premium', 'white_glove')
          OR p.role = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "Members can create replies" ON community_replies;
CREATE POLICY "Members can create replies"
  ON community_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.membership_tier IN ('founding_member', 'growth_member', 'premium', 'white_glove')
          OR p.role = 'admin'
        )
    )
  );

-- ══════════════════════════════════════════════════════════
-- STEP 7: Fix announcements RLS policy
-- ══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view announcements" ON announcements;
CREATE POLICY "Members can view announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.membership_tier IN ('founding_member', 'growth_member', 'premium', 'white_glove')
          OR p.role = 'admin'
        )
    )
  );

-- ══════════════════════════════════════════════════════════
-- STEP 8: Fix resources RLS policy (tier hierarchy)
-- founding_member+ can access founding_member resources
-- growth_member+ can access growth_member resources
-- premium+ can access premium resources
-- white_glove only for white_glove resources
-- ══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view published resources by tier" ON resources;
CREATE POLICY "Members can view published resources by tier"
  ON resources FOR SELECT
  TO authenticated
  USING (
    is_published = true AND (
      min_tier = 'free'
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND (
            p.role = 'admin'
            OR (min_tier = 'founding_member' AND p.membership_tier IN ('founding_member', 'growth_member', 'premium', 'white_glove'))
            OR (min_tier = 'growth_member'   AND p.membership_tier IN ('growth_member', 'premium', 'white_glove'))
            OR (min_tier = 'premium'         AND p.membership_tier IN ('premium', 'white_glove'))
            OR (min_tier = 'white_glove'     AND p.membership_tier = 'white_glove')
          )
      )
    )
  );

-- ══════════════════════════════════════════════════════════
-- STEP 9: Boardroom policies already use new names — verify
-- boardroom_guests and boardroom_questions already reference
-- 'premium' and 'white_glove' which are canonical — no change needed.
-- ══════════════════════════════════════════════════════════
