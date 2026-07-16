/*
  ═══════════════════════════════════════════════════════════════════════════
  C-SHIFT NOS — Phase 2: Organization Onboarding + Assessment Claim Service Layer
  Migration: 20260716220843_nos_phase2_org_onboarding_and_claim

  Parts:
  1. assessment_claim_history table + RLS
  2. create_user_organization RPC
  3. claim_anonymous_assessment RPC
  4. Grant execute permissions to authenticated role
  ═══════════════════════════════════════════════════════════════════════════
*/

-- ════════════════════════════════════════════════════════════════════════
-- PART 1: assessment_claim_history
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.assessment_claim_history (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id            uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  claimed_by               uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  claim_status             text NOT NULL DEFAULT 'claimed'
                             CHECK (claim_status IN ('claimed','rejected','reversed')),
  previous_user_id         uuid,
  previous_organization_id uuid,
  claim_notes              text,
  claimed_at               timestamptz DEFAULT now()
);

ALTER TABLE public.assessment_claim_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_claim_history_assessment_id   ON public.assessment_claim_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_claim_history_organization_id ON public.assessment_claim_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_claim_history_claimed_by      ON public.assessment_claim_history(claimed_by);

CREATE POLICY "claim_history_select_member"
  ON public.assessment_claim_history FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    OR public.is_cshift_admin()
  );

-- Only C-SHIFT admins can reverse a claim
CREATE POLICY "claim_history_insert_cshift_or_self"
  ON public.assessment_claim_history FOR INSERT TO authenticated
  WITH CHECK (
    claimed_by = auth.uid()
    OR public.is_cshift_admin()
  );

CREATE POLICY "claim_history_update_cshift"
  ON public.assessment_claim_history FOR UPDATE TO authenticated
  USING (public.is_cshift_admin())
  WITH CHECK (public.is_cshift_admin());

-- ════════════════════════════════════════════════════════════════════════
-- PART 2: create_user_organization RPC
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_user_organization(
  p_organization_name    text,
  p_legal_name           text    DEFAULT NULL,
  p_ein                  text    DEFAULT NULL,
  p_mission              text    DEFAULT NULL,
  p_vision               text    DEFAULT NULL,
  p_website              text    DEFAULT NULL,
  p_cause_area           text    DEFAULT NULL,
  p_primary_population   text    DEFAULT NULL,
  p_service_area         text    DEFAULT NULL,
  p_city                 text    DEFAULT NULL,
  p_state                text    DEFAULT NULL,
  p_annual_budget        numeric DEFAULT NULL,
  p_annual_revenue       numeric DEFAULT NULL,
  p_staff_count          integer DEFAULT NULL,
  p_board_member_count   integer DEFAULT NULL,
  p_organization_stage   text    DEFAULT NULL,
  p_nonprofit_status     text    DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id    uuid;
  v_profile_id uuid;
  v_org        public.organizations;
  v_norm_name  text;
  v_norm_ein   text;
BEGIN
  -- 1. Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate required field
  IF trim(coalesce(p_organization_name, '')) = '' THEN
    RAISE EXCEPTION 'organization_name is required' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validate organization_stage
  IF p_organization_stage IS NOT NULL AND p_organization_stage NOT IN (
    'startup','emerging','developing','established','scaling'
  ) THEN
    RAISE EXCEPTION 'Invalid organization_stage: %', p_organization_stage USING ERRCODE = 'P0003';
  END IF;

  -- 4. Validate nonprofit_status
  IF p_nonprofit_status IS NOT NULL AND p_nonprofit_status NOT IN (
    'planning','incorporated','exemption_pending','tax_exempt','fiscally_sponsored','other'
  ) THEN
    RAISE EXCEPTION 'Invalid nonprofit_status: %', p_nonprofit_status USING ERRCODE = 'P0004';
  END IF;

  -- 5. Find profile record (may be null for users who signed up without a profile row)
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  -- 6. Duplicate guard: same normalized name + same EIN by the same user
  v_norm_name := lower(regexp_replace(trim(p_organization_name), '\s+', ' ', 'g'));
  v_norm_ein  := lower(regexp_replace(coalesce(trim(p_ein), ''), '[^0-9]', '', 'g'));

  IF EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.organization_members om
      ON om.organization_id = o.id
      AND om.user_id = v_user_id
      AND om.organization_role = 'owner'
      AND om.membership_status = 'active'
    WHERE lower(regexp_replace(trim(o.organization_name), '\s+', ' ', 'g')) = v_norm_name
      AND (
        v_norm_ein = '' -- No EIN provided — name-only duplicate check
        OR lower(regexp_replace(coalesce(trim(o.ein), ''), '[^0-9]', '', 'g')) = v_norm_ein
      )
  ) THEN
    RAISE EXCEPTION 'You already own an organization with this name. To create a different organization, use a unique name.' USING ERRCODE = 'P0005';
  END IF;

  -- 7. Create the organization (trigger auto-enrolls owner in organization_members)
  INSERT INTO public.organizations (
    organization_name,
    legal_name,
    ein,
    mission,
    vision,
    website,
    cause_area,
    primary_population,
    service_area,
    city,
    state,
    annual_budget,
    annual_revenue,
    staff_count,
    board_member_count,
    organization_stage,
    nonprofit_status,
    owner_user_id,
    profile_id
  ) VALUES (
    p_organization_name,
    p_legal_name,
    p_ein,
    p_mission,
    p_vision,
    p_website,
    p_cause_area,
    p_primary_population,
    p_service_area,
    p_city,
    p_state,
    p_annual_budget,
    p_annual_revenue,
    p_staff_count,
    p_board_member_count,
    p_organization_stage,
    p_nonprofit_status,
    v_user_id,
    v_profile_id
  )
  RETURNING * INTO v_org;

  RETURN v_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_organization(
  text, text, text, text, text, text, text, text, text, text,
  text, numeric, numeric, integer, integer, text, text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_user_organization(
  text, text, text, text, text, text, text, text, text, text,
  text, numeric, numeric, integer, integer, text, text
) FROM anon;

-- ════════════════════════════════════════════════════════════════════════
-- PART 3: claim_anonymous_assessment RPC
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.claim_anonymous_assessment(
  p_assessment_id  uuid,
  p_organization_id uuid
)
RETURNS public.assessments
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id       uuid;
  v_user_email    text;
  v_assessment    public.assessments;
  v_pillar        RECORD;
  v_raw           numeric;
  v_pct           numeric;
  v_prev_raw      numeric;
  v_pillar_count  integer;
BEGIN
  -- 1. Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Get the authenticated user's email from profiles
  SELECT lower(trim(email)) INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0006';
  END IF;

  -- 3. Confirm caller is an active owner/ED/admin of the org
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = v_user_id
      AND membership_status = 'active'
      AND organization_role IN ('owner','executive_director','administrator')
  ) THEN
    -- Record the rejected attempt before raising
    INSERT INTO public.assessment_claim_history (
      assessment_id, organization_id, claimed_by,
      claim_status, claim_notes
    ) VALUES (
      p_assessment_id, p_organization_id, v_user_id,
      'rejected',
      'Rejected: caller is not an active owner/ED/admin of the organization'
    );
    RAISE EXCEPTION 'You must be an owner, executive director, or administrator of this organization to claim an assessment.' USING ERRCODE = 'P0007';
  END IF;

  -- 4. Load the assessment
  SELECT * INTO v_assessment
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF NOT FOUND THEN
    INSERT INTO public.assessment_claim_history (
      assessment_id, organization_id, claimed_by,
      claim_status, claim_notes
    ) VALUES (
      p_assessment_id, p_organization_id, v_user_id,
      'rejected', 'Rejected: assessment not found'
    );
    RAISE EXCEPTION 'Assessment not found' USING ERRCODE = 'P0008';
  END IF;

  -- 5. Confirm assessment is anonymous (user_id IS NULL, organization_id IS NULL)
  IF v_assessment.user_id IS NOT NULL OR v_assessment.organization_id IS NOT NULL THEN
    INSERT INTO public.assessment_claim_history (
      assessment_id, organization_id, claimed_by,
      claim_status, previous_user_id, previous_organization_id,
      claim_notes
    ) VALUES (
      p_assessment_id, p_organization_id, v_user_id,
      'rejected',
      v_assessment.user_id, v_assessment.organization_id,
      'Rejected: assessment is already connected to a user or organization'
    );
    RAISE EXCEPTION 'This assessment is already connected to a user or organization and cannot be claimed.' USING ERRCODE = 'P0009';
  END IF;

  -- 6. Email must match (case-insensitive)
  IF lower(trim(v_assessment.email)) <> v_user_email THEN
    INSERT INTO public.assessment_claim_history (
      assessment_id, organization_id, claimed_by,
      claim_status, claim_notes
    ) VALUES (
      p_assessment_id, p_organization_id, v_user_id,
      'rejected',
      'Rejected: assessment email does not match authenticated user email'
    );
    RAISE EXCEPTION 'The email address on this assessment does not match your account email.' USING ERRCODE = 'P0010';
  END IF;

  -- 7. Claim the assessment
  UPDATE public.assessments
  SET
    user_id         = v_user_id,
    organization_id = p_organization_id,
    completed_by    = v_user_id
  WHERE id = p_assessment_id
  RETURNING * INTO v_assessment;

  -- 8. If completed, create pillar score records exactly once (idempotent check)
  IF v_assessment.status = 'completed' THEN
    SELECT COUNT(*) INTO v_pillar_count
    FROM public.pillar_scores
    WHERE assessment_id = p_assessment_id;

    IF v_pillar_count = 0 THEN
      -- Insert all six pillar scores
      FOR v_pillar IN
        SELECT
          unnest(ARRAY['Clarity','Structure','Health','Impact','Funding','Transformation']) AS name,
          unnest(ARRAY[
            v_assessment.clarity_score,
            v_assessment.structure_score,
            v_assessment.health_score,
            v_assessment.impact_score,
            v_assessment.funding_score,
            v_assessment.transformation_score
          ])::numeric AS raw_score
      LOOP
        v_raw := v_pillar.raw_score;
        v_pct := v_raw / 25.0;

        -- Look up previous score from any prior assessment linked to this org
        v_prev_raw := NULL;
        IF v_assessment.previous_assessment_id IS NOT NULL THEN
          SELECT raw_score INTO v_prev_raw
          FROM public.pillar_scores
          WHERE assessment_id = v_assessment.previous_assessment_id
            AND pillar_name   = v_pillar.name
          LIMIT 1;
        END IF;

        INSERT INTO public.pillar_scores (
          organization_id, assessment_id, pillar_name,
          raw_score, maximum_score, percentage_score, rating,
          previous_score, score_change, score_source, calculated_at
        ) VALUES (
          p_organization_id, p_assessment_id, v_pillar.name,
          v_raw, 25, v_pct,
          public.derive_pillar_rating(v_pct),
          v_prev_raw,
          COALESCE(v_raw - v_prev_raw, 0),
          'assessment', now()
        );
      END LOOP;

      -- Set overall_percentage on the assessment if not already set
      IF v_assessment.overall_percentage IS NULL THEN
        UPDATE public.assessments
          SET overall_percentage = (v_assessment.total_score::numeric / NULLIF(v_assessment.max_score, 0)::numeric)
        WHERE id = p_assessment_id
        RETURNING * INTO v_assessment;
      END IF;
    END IF;
    -- v_pillar_count > 0 means scores already exist — skip, idempotent
  END IF;

  -- 9. Record successful claim
  INSERT INTO public.assessment_claim_history (
    assessment_id, organization_id, claimed_by,
    claim_status, previous_user_id, previous_organization_id,
    claim_notes
  ) VALUES (
    p_assessment_id, p_organization_id, v_user_id,
    'claimed', NULL, NULL,
    'Assessment successfully claimed and linked to organization'
  );

  RETURN v_assessment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_anonymous_assessment(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_anonymous_assessment(uuid, uuid) FROM anon;
