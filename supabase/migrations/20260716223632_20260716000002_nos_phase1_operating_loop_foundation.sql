/*
  ═══════════════════════════════════════════════════════════════════════════════
  C-SHIFT NOS — Phase 1: Operating Loop Foundation
  Migration: 20260716000002_nos_phase1_operating_loop_foundation

  Pre-flight verified:
  - No new table name conflicts with existing 22 tables
  - assessments.user_id → profiles(id) nullable (anon assessments preserved)
  - assessments.status CHECK: ('in_progress','completed') — not touched
  - Admin identified by profiles.role = 'admin'
  - 0 existing profile or assessment rows — pure additive changes only

  Parts:
  1.  organizations
  2.  organization_members
  3.  assessments extensions
  4.  pillar_scores
  5.  organization_actions
  6.  action_evidence
  7.  score_history
  8.  action_history
  9.  RLS on all new tables
  10. Functions / triggers
  ═══════════════════════════════════════════════════════════════════════════════
*/

-- ════════════════════════════════════════════════════════════════════════
-- SHARED: updated_at trigger function (reused across all new tables)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- PART 1: organizations
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name   text NOT NULL,
  legal_name          text,
  ein                 text,
  mission             text,
  vision              text,
  website             text,
  logo_url            text,
  cause_area          text,
  primary_population  text,
  service_area        text,
  city                text,
  state               text,
  annual_budget       numeric,
  annual_revenue      numeric,
  staff_count         integer,
  board_member_count  integer,
  organization_stage  text CHECK (organization_stage IN ('startup','emerging','developing','established','scaling')),
  nonprofit_status    text CHECK (nonprofit_status IN ('planning','incorporated','exemption_pending','tax_exempt','fiscally_sponsored','other')),
  owner_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- PART 2: organization_members
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.organization_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_role   text NOT NULL DEFAULT 'viewer'
                        CHECK (organization_role IN ('owner','executive_director','administrator','staff','board_member','consultant','viewer')),
  membership_status   text NOT NULL DEFAULT 'active'
                        CHECK (membership_status IN ('invited','active','suspended','removed')),
  invited_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at           timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Auto-enroll creator as active owner when an organization is inserted
CREATE OR REPLACE FUNCTION public.add_organization_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO public.organization_members (
      organization_id, user_id, organization_role, membership_status, joined_at
    ) VALUES (
      NEW.id, NEW.owner_user_id, 'owner', 'active', now()
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_organization_owner
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.add_organization_owner();

-- ════════════════════════════════════════════════════════════════════════
-- PART 3: extend assessments (additive columns only)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS organization_id         uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assessment_version      text,
  ADD COLUMN IF NOT EXISTS assessment_type         text DEFAULT 'fundability',
  ADD COLUMN IF NOT EXISTS overall_percentage      numeric,
  ADD COLUMN IF NOT EXISTS completed_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_assessment_id  uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_action_plan     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_status         text DEFAULT 'not_reviewed'
                                                     CHECK (reviewed_status IN ('not_reviewed','under_review','reviewed','requires_follow_up')),
  ADD COLUMN IF NOT EXISTS reviewed_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at             timestamptz;

CREATE INDEX IF NOT EXISTS idx_assessments_organization_id ON public.assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessments_reviewed_status ON public.assessments(reviewed_status);

-- ════════════════════════════════════════════════════════════════════════
-- PART 4: pillar_scores
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.pillar_scores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id    uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  pillar_name      text NOT NULL
                     CHECK (pillar_name IN ('Clarity','Structure','Health','Impact','Funding','Transformation')),
  raw_score        numeric NOT NULL,
  maximum_score    numeric NOT NULL DEFAULT 25,
  percentage_score numeric NOT NULL,
  rating           text CHECK (rating IN ('Strong','Developing','Needs Attention','Critical Gap')),
  previous_score   numeric,
  score_change     numeric DEFAULT 0,
  score_source     text NOT NULL DEFAULT 'assessment'
                     CHECK (score_source IN ('assessment','verified_action','administrative_adjustment','reassessment')),
  calculated_at    timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pillar_scores_organization_id ON public.pillar_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_pillar_scores_assessment_id  ON public.pillar_scores(assessment_id);

-- Derive the pillar rating from a percentage (matches existing app thresholds)
CREATE OR REPLACE FUNCTION public.derive_pillar_rating(pct numeric)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF pct >= 0.8  THEN RETURN 'Strong';
  ELSIF pct >= 0.6 THEN RETURN 'Developing';
  ELSIF pct >= 0.4 THEN RETURN 'Needs Attention';
  ELSE RETURN 'Critical Gap';
  END IF;
END;
$$;

-- After an authenticated assessment completes, create/refresh pillar_scores
CREATE OR REPLACE FUNCTION public.create_pillar_scores_after_assessment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id   uuid;
  v_prev_id  uuid;
  v_pillar   RECORD;
  v_raw      numeric;
  v_pct      numeric;
  v_prev_raw numeric;
BEGIN
  -- Only fire for completed assessments linked to an organization
  IF NEW.status <> 'completed' OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only fire on transition to completed
  IF OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_org_id  := NEW.organization_id;
  v_prev_id := NEW.previous_assessment_id;

  -- Iterate all six pillars
  FOR v_pillar IN
    SELECT unnest(ARRAY['Clarity','Structure','Health','Impact','Funding','Transformation']) AS name,
           unnest(ARRAY[
             NEW.clarity_score, NEW.structure_score, NEW.health_score,
             NEW.impact_score,  NEW.funding_score,   NEW.transformation_score
           ])::numeric AS raw_score
  LOOP
    v_raw := v_pillar.raw_score;
    v_pct := v_raw / 25.0;
    v_prev_raw := NULL;

    -- Look up previous score if a prior assessment exists
    IF v_prev_id IS NOT NULL THEN
      SELECT raw_score INTO v_prev_raw
      FROM public.pillar_scores
      WHERE assessment_id = v_prev_id
        AND pillar_name   = v_pillar.name
      LIMIT 1;
    END IF;

    INSERT INTO public.pillar_scores (
      organization_id, assessment_id, pillar_name,
      raw_score, maximum_score, percentage_score, rating,
      previous_score, score_change, score_source, calculated_at
    ) VALUES (
      v_org_id, NEW.id, v_pillar.name,
      v_raw, 25, v_pct,
      public.derive_pillar_rating(v_pct),
      v_prev_raw,
      COALESCE(v_raw - v_prev_raw, 0),
      'assessment', now()
    );
  END LOOP;

  -- Compute overall_percentage on the assessment row
  UPDATE public.assessments
    SET overall_percentage = (NEW.total_score::numeric / NULLIF(NEW.max_score, 0)::numeric)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_pillar_scores
  AFTER UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.create_pillar_scores_after_assessment();

-- ════════════════════════════════════════════════════════════════════════
-- PART 5: organization_actions
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.organization_actions (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id                   uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  pillar_name                     text NOT NULL
                                    CHECK (pillar_name IN ('Clarity','Structure','Health','Impact','Funding','Transformation')),
  action_category                 text,
  title                           text NOT NULL,
  description                     text NOT NULL,
  why_it_matters                  text,
  why_funders_care                text,
  priority                        text NOT NULL
                                    CHECK (priority IN ('Critical','High','Moderate','Low')),
  status                          text NOT NULL DEFAULT 'Not Started'
                                    CHECK (status IN (
                                      'Not Started','In Progress','Awaiting Evidence',
                                      'Submitted for Verification','Revision Required',
                                      'Verified','Completed','Deferred'
                                    )),
  assigned_user_id                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date                        date,
  estimated_completion_days       integer,
  evidence_required               boolean DEFAULT true,
  evidence_requirements           text,
  estimated_pillar_score_increase numeric DEFAULT 0,
  estimated_overall_score_increase numeric DEFAULT 0,
  certification_requirement       boolean DEFAULT false,
  source_type                     text
                                    CHECK (source_type IN (
                                      'assessment','reviewer','ai_recommendation',
                                      'certification','organization_created'
                                    )),
  source_reference                text,
  created_at                      timestamptz DEFAULT now(),
  started_at                      timestamptz,
  submitted_at                    timestamptz,
  completed_at                    timestamptz,
  verified_at                     timestamptz,
  verified_by                     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at                      timestamptz DEFAULT now()
);

CREATE TRIGGER trg_organization_actions_updated_at
  BEFORE UPDATE ON public.organization_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_actions_organization_id ON public.organization_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_actions_assessment_id   ON public.organization_actions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_org_actions_status          ON public.organization_actions(status);
CREATE INDEX IF NOT EXISTS idx_org_actions_pillar_name     ON public.organization_actions(pillar_name);
CREATE INDEX IF NOT EXISTS idx_org_actions_priority        ON public.organization_actions(priority);

-- ════════════════════════════════════════════════════════════════════════
-- PART 6: action_evidence
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.action_evidence (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id                  uuid NOT NULL REFERENCES public.organization_actions(id) ON DELETE CASCADE,
  organization_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  submitted_by               uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  evidence_type              text NOT NULL
                               CHECK (evidence_type IN (
                                 'document','image','website_link','written_response',
                                 'completed_form','meeting_record','policy','budget',
                                 'board_roster','board_matrix','strategic_plan','logic_model',
                                 'outcome_report','financial_report','filing_confirmation',
                                 'workshop_completion','other'
                               )),
  file_url                   text,
  external_url               text,
  written_response           text,
  submission_notes           text,
  verification_status        text NOT NULL DEFAULT 'Draft'
                               CHECK (verification_status IN (
                                 'Draft','Submitted','Under Review',
                                 'Additional Information Required',
                                 'Approved','Rejected','Expired'
                               )),
  reviewer_notes             text,
  organization_visible_notes text,
  submitted_at               timestamptz,
  reviewed_at                timestamptz,
  reviewed_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at                 timestamptz,
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

CREATE TRIGGER trg_action_evidence_updated_at
  BEFORE UPDATE ON public.action_evidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_action_evidence_action_id         ON public.action_evidence(action_id);
CREATE INDEX IF NOT EXISTS idx_action_evidence_organization_id   ON public.action_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_action_evidence_verification_status ON public.action_evidence(verification_status);

-- ════════════════════════════════════════════════════════════════════════
-- PART 7: score_history
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.score_history (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assessment_id          uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  pillar_name            text CHECK (pillar_name IN ('Clarity','Structure','Health','Impact','Funding','Transformation')),
  previous_score         numeric NOT NULL DEFAULT 0,
  new_score              numeric NOT NULL,
  score_change           numeric NOT NULL,
  score_type             text NOT NULL
                           CHECK (score_type IN ('overall','pillar','fundability')),
  change_reason          text NOT NULL,
  related_action_id      uuid REFERENCES public.organization_actions(id) ON DELETE SET NULL,
  changed_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_record_id uuid REFERENCES public.action_evidence(id) ON DELETE SET NULL,
  recorded_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_history_organization_id ON public.score_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_score_history_assessment_id   ON public.score_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_score_history_recorded_at     ON public.score_history(recorded_at);

-- Record score history automatically when pillar_scores rows are inserted
CREATE OR REPLACE FUNCTION public.record_pillar_score_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.score_history (
    organization_id, assessment_id, pillar_name,
    previous_score, new_score, score_change,
    score_type, change_reason, changed_by, recorded_at
  ) VALUES (
    NEW.organization_id, NEW.assessment_id, NEW.pillar_name,
    COALESCE(NEW.previous_score, 0), NEW.raw_score, COALESCE(NEW.score_change, 0),
    'pillar',
    'Assessment completed — ' || NEW.pillar_name || ' pillar scored via ' || NEW.score_source,
    NULL, -- system-generated; no user attribution for assessment triggers
    now()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_pillar_score_history
  AFTER INSERT ON public.pillar_scores
  FOR EACH ROW EXECUTE FUNCTION public.record_pillar_score_history();

-- ════════════════════════════════════════════════════════════════════════
-- PART 8: action_history
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE public.action_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id        uuid NOT NULL REFERENCES public.organization_actions(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status  text,
  new_status       text NOT NULL,
  change_notes     text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_history_action_id        ON public.action_history(action_id);
CREATE INDEX IF NOT EXISTS idx_action_history_organization_id  ON public.action_history(organization_id);

-- Auto-record action status changes
CREATE OR REPLACE FUNCTION public.record_action_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.action_history (
      action_id, organization_id, changed_by,
      previous_status, new_status, change_notes
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.verified_by,
      OLD.status, NEW.status, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_action_status_change
  AFTER UPDATE ON public.organization_actions
  FOR EACH ROW EXECUTE FUNCTION public.record_action_status_change();

-- ════════════════════════════════════════════════════════════════════════
-- PART 9: RLS
-- ════════════════════════════════════════════════════════════════════════

-- Helper: is the calling user an active member of the given organization?
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND membership_status = 'active'
  );
$$;

-- Helper: does the calling user have an owner or administrator role?
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND membership_status = 'active'
      AND organization_role IN ('owner','executive_director','administrator')
  );
$$;

-- Helper: is the calling user a C-SHIFT platform admin?
CREATE OR REPLACE FUNCTION public.is_cshift_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ─── organizations ───────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_member"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id) OR public.is_cshift_admin());

CREATE POLICY "org_insert_owner"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "org_update_admin"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id) OR public.is_cshift_admin())
  WITH CHECK (public.is_org_admin(id) OR public.is_cshift_admin());

CREATE POLICY "org_delete_cshift"
  ON public.organizations FOR DELETE TO authenticated
  USING (public.is_cshift_admin());

-- ─── organization_members ────────────────────────────────────────────
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgmem_select_member"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id)
    OR public.is_cshift_admin()
  );

CREATE POLICY "orgmem_insert_admin"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id) OR public.is_cshift_admin()
    -- Allow the trigger (SECURITY DEFINER) to auto-insert the owner
    OR (user_id = auth.uid() AND organization_role = 'owner')
  );

CREATE POLICY "orgmem_update_admin"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id) OR public.is_cshift_admin())
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_cshift_admin());

CREATE POLICY "orgmem_delete_admin"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id) OR public.is_cshift_admin());

-- ─── pillar_scores ───────────────────────────────────────────────────
ALTER TABLE public.pillar_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select_member"
  ON public.pillar_scores FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_cshift_admin());

-- Only system triggers and C-SHIFT admins write pillar_scores
CREATE POLICY "ps_insert_cshift"
  ON public.pillar_scores FOR INSERT TO authenticated
  WITH CHECK (public.is_cshift_admin());

CREATE POLICY "ps_update_cshift"
  ON public.pillar_scores FOR UPDATE TO authenticated
  USING (public.is_cshift_admin())
  WITH CHECK (public.is_cshift_admin());

-- ─── organization_actions ────────────────────────────────────────────
ALTER TABLE public.organization_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_select_member"
  ON public.organization_actions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_cshift_admin());

CREATE POLICY "action_insert_admin"
  ON public.organization_actions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_cshift_admin());

CREATE POLICY "action_update_member"
  ON public.organization_actions FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_cshift_admin())
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_cshift_admin());

CREATE POLICY "action_delete_admin"
  ON public.organization_actions FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id) OR public.is_cshift_admin());

-- ─── action_evidence ─────────────────────────────────────────────────
ALTER TABLE public.action_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_select_member"
  ON public.action_evidence FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_cshift_admin());

CREATE POLICY "evidence_insert_member"
  ON public.action_evidence FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND submitted_by = auth.uid()
  );

-- Only org admins can edit their own evidence; C-SHIFT can edit any
CREATE POLICY "evidence_update_admin_or_cshift"
  ON public.action_evidence FOR UPDATE TO authenticated
  USING (
    (submitted_by = auth.uid() AND public.is_org_member(organization_id)
      AND verification_status IN ('Draft','Additional Information Required'))
    OR public.is_cshift_admin()
  )
  WITH CHECK (
    (submitted_by = auth.uid() AND public.is_org_member(organization_id)
      AND verification_status IN ('Draft','Additional Information Required'))
    OR public.is_cshift_admin()
  );

CREATE POLICY "evidence_delete_draft_owner"
  ON public.action_evidence FOR DELETE TO authenticated
  USING (
    (submitted_by = auth.uid() AND verification_status = 'Draft')
    OR public.is_cshift_admin()
  );

-- ─── score_history ───────────────────────────────────────────────────
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sh_select_member"
  ON public.score_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_cshift_admin());

-- Score history is append-only; only system triggers and C-SHIFT write it
CREATE POLICY "sh_insert_cshift"
  ON public.score_history FOR INSERT TO authenticated
  WITH CHECK (public.is_cshift_admin());

-- ─── action_history ──────────────────────────────────────────────────
ALTER TABLE public.action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ah_select_member"
  ON public.action_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_cshift_admin());

-- Action history is append-only; written only by trigger
CREATE POLICY "ah_insert_cshift"
  ON public.action_history FOR INSERT TO authenticated
  WITH CHECK (public.is_cshift_admin());

-- ════════════════════════════════════════════════════════════════════════
-- ADDITIVE RLS on assessments:
-- Allow org members to read their org's assessments in addition to
-- the existing "user owns it" and "anon can read by id" policies.
-- ════════════════════════════════════════════════════════════════════════
CREATE POLICY "assessments_org_member_select"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    OR public.is_cshift_admin()
  );

-- Allow org members to link an assessment to their org
-- (for claiming an anonymous assessment after sign-in)
CREATE POLICY "assessments_org_member_update_link"
  ON public.assessments FOR UPDATE TO authenticated
  USING (
    -- User must own the assessment OR be linking an anon one they submitted
    auth.uid() = user_id
    OR (user_id IS NULL AND email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  )
  WITH CHECK (
    -- Can only set organization_id to an org they admin
    public.is_org_admin(organization_id)
    OR public.is_cshift_admin()
    OR organization_id IS NULL
  );
