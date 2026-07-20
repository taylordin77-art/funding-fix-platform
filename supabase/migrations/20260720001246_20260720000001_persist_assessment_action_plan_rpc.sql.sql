/*
# Persist Assessment Action Plan RPC

## Purpose
Adds a single SECURITY DEFINER RPC `persist_assessment_action_plan` that
atomically converts a validated, client-built proposed action plan into
persisted rows in `organization_actions`. This is the persistence layer for
the C-SHIFT Action Generation Engine.

## Approach
- ADDITIVE ONLY. No tables, columns, indexes, triggers, or RLS policies are
  created, altered, or dropped. The RPC reuses the existing
  `organization_actions`, `assessments`, `assessment_answers`, and
  `organization_members` tables and the existing `is_org_admin()` /
  `is_cshift_admin()` helper functions.
- The 30 action templates live in TypeScript (`src/lib/actionTemplates.ts`).
  The client (`actionPlanService.generateProposedActionPlan`) builds the
  proposed actions; this RPC only validates and persists them.
- SECURITY DEFINER + `SET search_path = public` so the function runs with
  elevated privileges and a stable schema path. Callable only by
  `authenticated` users via the existing `organization_actions` INSERT RLS,
  but the function performs its own explicit authorization checks before any
  write and is the sole writer in this flow.

## Authorization (checked in order, inside the RPC)
1. `auth.uid()` IS NOT NULL  -> else 'NOT_AUTHENTICATED'
2. Assessment exists for `p_assessment_id` -> else 'ASSESSMENT_NOT_FOUND'
3. `assessments.status = 'completed'` -> else 'ASSESSMENT_NOT_COMPLETED'
4. `assessments.organization_id IS NOT NULL` -> else 'ASSESSMENT_NOT_LINKED'
5. Caller is an active org admin (`is_org_admin`) OR C-SHIFT admin
   (`is_cshift_admin`). Regular members and other-org admins are rejected
   with 'NOT_AUTHORIZED'.

## Idempotency
- `assessments.created_action_plan = true` -> 'ACTION_PLAN_ALREADY_CREATED'
  (primary guard; assessment stays marked).
- Existing `organization_actions` rows with
  `assessment_id = p_assessment_id AND source_type = 'assessment'` ->
  'DUPLICATE_ACTIONS_EXIST'. No silent return of existing rows.

## Input validation (`p_actions` jsonb)
- Must be a JSON array, non-empty, length <= 30.
- Each element must contain all required fields (see `required_fields`).
- Per-action field-level validation:
  - `assessmentId = p_assessment_id`
  - `organizationId = assessment.organization_id`
  - `pillar` in the six Title-Case values
  - `questionIndex` integer 0..4
  - `answerScore` integer 1..3
  - `estimatedCompletionDays` > 0
  - `priority` in (Critical, High, Moderate)  -- Low NOT allowed here
  - `sourceReference` non-empty, matches `<lowercase-pillar>:<questionIndex>`,
    and its lowercase pillar maps to the Title-Case `pillar`.
- Duplicate `sourceReference` values inside the array -> 'DUPLICATE_ACTIONS'.
  (Distinct from the existing-rows idempotency check.)

## Database source verification (do not trust client scores)
For every proposed action, require a matching `assessment_answers` row where
`assessment_id = p_assessment_id AND pillar = <lowercase from sourceReference>
AND question_index = questionIndex AND score = answerScore AND score <= 3`.
Any mismatch -> 'ACTION_MISMATCH'.

## Completeness validation (prevent omitting weak answers)
- Compute `weak_count` = number of `assessment_answers` rows for this
  assessment with `score <= 3`.
- Require `jsonb_array_length(p_actions) = weak_count`.
- Require every weak answer's `<pillar>:<question_index>` to appear in the
  proposed actions' `sourceReference` set.
- If `weak_count = 0` -> 'NO_ACTION_PLAN_REQUIRED' (and do NOT flip
  `created_action_plan`).

## Insert mapping (organization_actions)
organization_id <- assessment.organization_id
assessment_id   <- p_assessment_id
pillar_name     <- pillar
action_category <- actionCategory
title           <- title
description     <- description
why_it_matters  <- whyItMatters
why_funders_care<- whyFundersCare
priority        <- priority
status          <- 'Not Started'  (constant)
assigned_user_id<- NULL
due_date        <- NULL
estimated_completion_days <- estimatedCompletionDays
evidence_required<- TRUE
evidence_requirements <- evidenceRequirements
estimated_pillar_score_increase <- estimatedPillarScoreIncrease
estimated_overall_score_increase<- estimatedOverallScoreIncrease
certification_requirement <- FALSE
source_type     <- 'assessment'  (constant)
source_reference<- sourceReference
Timestamps (created_at, updated_at) use database defaults.
started_at / submitted_at / completed_at / verified_at / verified_by are NOT
populated.

## Transaction behavior
The function body is a single PL/pgSQL block. Any `RAISE EXCEPTION` aborts
the implicit transaction, so NO actions are inserted and
`created_action_plan` is NOT flipped. On success, all inserts AND the
`created_action_plan = true` update commit together.

## Return
Returns the inserted `organization_actions` rows (full row shape via
`SELECT ... FROM organization_actions WHERE id = ANY(inserted_ids)`).

## Error codes (raised as P0001 with a fixed leading token for client mapping)
NOT_AUTHENTICATED | ASSESSMENT_NOT_FOUND | ASSESSMENT_NOT_COMPLETED |
ASSESSMENT_NOT_LINKED | NOT_AUTHORIZED | ACTION_PLAN_ALREADY_CREATED |
DUPLICATE_ACTIONS_EXIST | INVALID_ACTION_PLAN | INVALID_ACTION_FIELD |
ACTION_MISMATCH | DUPLICATE_ACTIONS | INCOMPLETE_ACTION_PLAN |
NO_ACTION_PLAN_REQUIRED
The TypeScript service maps the leading token to safe application codes and
logs the full DB message internally.
*/

CREATE OR REPLACE FUNCTION public.persist_assessment_action_plan(
  p_assessment_id uuid,
  p_actions jsonb
) RETURNS SETOF public.organization_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_assessment  record;
  v_org_id      uuid;
  v_count       integer;
  v_action      jsonb;
  v_idx         integer := 0;
  v_pillar      text;
  v_qidx        integer;
  v_score       integer;
  v_src_pillar  text;
  v_src_qidx    text;
  v_srcref      text;
  v_weak_count  integer;
  v_missing_ref text;
  v_dup_ref     text;
  v_answer_hit  integer;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_required_fields text[] := ARRAY[
    'templateId','assessmentId','organizationId','pillar','questionIndex',
    'questionText','answerScore','title','description','whyItMatters',
    'whyFundersCare','evidenceRequirements','estimatedCompletionDays',
    'priority','actionCategory','sourceReference',
    'estimatedPillarScoreIncrease','estimatedOverallScoreIncrease'
  ];
  v_allowed_pillars text[] := ARRAY['Clarity','Structure','Health','Impact','Funding','Transformation'];
  v_allowed_priorities text[] := ARRAY['Critical','High','Moderate'];
  v_pillar_lower_map jsonb := '{"Clarity":"clarity","Structure":"structure","Health":"health","Impact":"impact","Funding":"funding","Transformation":"transformation"}'::jsonb;
BEGIN
  -- 1. Authentication
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: You must be signed in to persist an action plan.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Load assessment (bypasses RLS via SECURITY DEFINER; explicit auth below)
  SELECT id, organization_id, status, created_action_plan
    INTO v_assessment
    FROM public.assessments
    WHERE id = p_assessment_id
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSESSMENT_NOT_FOUND: The assessment could not be found.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Completed + organization-linked
  IF v_assessment.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'ASSESSMENT_NOT_COMPLETED: Actions can only be persisted for completed assessments.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_assessment.organization_id IS NULL THEN
    RAISE EXCEPTION 'ASSESSMENT_NOT_LINKED: This assessment is not linked to an organization.'
      USING ERRCODE = 'P0001';
  END IF;

  v_org_id := v_assessment.organization_id;

  -- 4. Authorization: org admin OR C-SHIFT admin only
  IF NOT (public.is_org_admin(v_org_id) OR public.is_cshift_admin()) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Only organization admins or C-SHIFT platform admins may persist an action plan.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Idempotency: primary guard
  IF v_assessment.created_action_plan IS TRUE THEN
    RAISE EXCEPTION 'ACTION_PLAN_ALREADY_CREATED: An action plan has already been created for this assessment.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Idempotency: existing assessment-sourced actions
  SELECT count(*) INTO v_count
    FROM public.organization_actions
    WHERE assessment_id = p_assessment_id
      AND source_type = 'assessment';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIONS_EXIST: Assessment actions already exist for this assessment.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Top-level input validation
  IF p_actions IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACTION_PLAN: Action payload is missing.'
      USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_actions) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ACTION_PLAN: Action payload must be a JSON array.'
      USING ERRCODE = 'P0001';
  END IF;
  v_count := jsonb_array_length(p_actions);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'INVALID_ACTION_PLAN: Action payload is empty.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_count > 30 THEN
    RAISE EXCEPTION 'INVALID_ACTION_PLAN: Action payload exceeds 30 actions.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Completeness: weak answer count from the database (do not trust client)
  SELECT count(*) INTO v_weak_count
    FROM public.assessment_answers
    WHERE assessment_id = p_assessment_id
      AND score <= 3;
  IF v_weak_count = 0 THEN
    RAISE EXCEPTION 'NO_ACTION_PLAN_REQUIRED: This assessment has no weak answers; no action plan is required.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_weak_count <> v_count THEN
    RAISE EXCEPTION 'INCOMPLETE_ACTION_PLAN: Action count (%) does not match the weak-answer count (%).',
      v_count, v_weak_count
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Per-action validation + database source verification.
  --    Any failure aborts the whole transaction (no partial writes).
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    v_idx := v_idx + 1;

    -- 9a. Required fields present
    FOR i IN 1..array_length(v_required_fields, 1) LOOP
      IF NOT (v_action ? v_required_fields[i]) THEN
        RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % is missing field "%".',
          v_idx, v_required_fields[i]
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    -- 9b. Cross-record: assessmentId matches
    IF (v_action ->> 'assessmentId')::text <> p_assessment_id::text THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % assessmentId does not match the assessment.',
        v_idx USING ERRCODE = 'P0001';
    END IF;

    -- 9c. Cross-record: organizationId matches the assessment org
    IF (v_action ->> 'organizationId')::text <> v_org_id::text THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % organizationId does not match the assessment organization.',
        v_idx USING ERRCODE = 'P0001';
    END IF;

    -- 9d. pillar must be one of the six Title-Case values
    v_pillar := v_action ->> 'pillar';
    IF NOT (v_pillar = ANY(v_allowed_pillars)) THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % has an invalid pillar "%".',
        v_idx, v_pillar USING ERRCODE = 'P0001';
    END IF;

    -- 9e. questionIndex integer 0..4
    BEGIN
      v_qidx := (v_action ->> 'questionIndex')::integer;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % questionIndex is not an integer.',
        v_idx USING ERRCODE = 'P0001';
    END;
    IF v_qidx IS NULL OR v_qidx < 0 OR v_qidx > 4 THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % questionIndex must be between 0 and 4.',
        v_idx USING ERRCODE = 'P0001';
    END IF;

    -- 9f. answerScore integer 1..3
    BEGIN
      v_score := (v_action ->> 'answerScore')::integer;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % answerScore is not an integer.',
        v_idx USING ERRCODE = 'P0001';
    END;
    IF v_score IS NULL OR v_score < 1 OR v_score > 3 THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % answerScore must be between 1 and 3.',
        v_idx USING ERRCODE = 'P0001';
    END IF;

    -- 9g. estimatedCompletionDays > 0
    BEGIN
      IF (v_action ->> 'estimatedCompletionDays')::numeric <= 0 THEN
        RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % estimatedCompletionDays must be greater than 0.',
          v_idx USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % estimatedCompletionDays is not numeric.',
        v_idx USING ERRCODE = 'P0001';
    END;

    -- 9h. priority in allowed set (Low excluded for this generator)
    IF NOT ((v_action ->> 'priority') = ANY(v_allowed_priorities)) THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % has an invalid or disallowed priority "%".',
        v_idx, (v_action ->> 'priority') USING ERRCODE = 'P0001';
    END IF;

    -- 9i. sourceReference: non-empty, format <lowercase-pillar>:<idx>, pillar
    --     must map to the Title-Case pillar
    v_srcref := v_action ->> 'sourceReference';
    IF v_srcref IS NULL OR v_srcref = '' THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % sourceReference is empty.',
        v_idx USING ERRCODE = 'P0001';
    END IF;
    IF NOT (v_srcref ~ '^(clarity|structure|health|impact|funding|transformation):[0-9]+$') THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % sourceReference "%" has an invalid format.',
        v_idx, v_srcref USING ERRCODE = 'P0001';
    END IF;
    v_src_pillar := split_part(v_srcref, ':', 1);
    v_src_qidx   := split_part(v_srcref, ':', 2);
    IF (v_src_qidx)::integer <> v_qidx THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % sourceReference questionIndex does not match questionIndex.',
        v_idx USING ERRCODE = 'P0001';
    END IF;
    IF (v_pillar_lower_map ->> v_pillar) IS DISTINCT FROM v_src_pillar THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % sourceReference pillar "%" does not match pillar "%".',
        v_idx, v_src_pillar, v_pillar USING ERRCODE = 'P0001';
    END IF;

    -- 9j. Database source verification: matching weak answer exists with this score
    SELECT count(*) INTO v_answer_hit
      FROM public.assessment_answers
      WHERE assessment_id = p_assessment_id
        AND pillar = v_src_pillar
        AND question_index = v_qidx
        AND score = v_score
        AND score <= 3;
    IF v_answer_hit = 0 THEN
      RAISE EXCEPTION 'ACTION_MISMATCH: Action % does not match a weak assessment answer (pillar=%, idx=%, score=%).',
        v_idx, v_src_pillar, v_qidx, v_score USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 10. Duplicate sourceReference inside the payload
  WITH refs AS (
    SELECT a ->> 'sourceReference' AS ref
      FROM jsonb_array_elements(p_actions) AS a
  )
  SELECT r.ref INTO v_dup_ref
    FROM refs r
    GROUP BY r.ref
    HAVING count(*) > 1
    LIMIT 1;
  IF v_dup_ref IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIONS: Duplicate sourceReference "%" in the action payload.',
      v_dup_ref USING ERRCODE = 'P0001';
  END IF;

  -- 11. Completeness: every weak answer has a matching sourceReference
  WITH refs AS (
    SELECT a ->> 'sourceReference' AS ref
      FROM jsonb_array_elements(p_actions) AS a
  ),
  weak_refs AS (
    SELECT aa.pillar || ':' || aa.question_index AS ref
      FROM public.assessment_answers aa
      WHERE aa.assessment_id = p_assessment_id
        AND aa.score <= 3
  )
  SELECT wr.ref INTO v_missing_ref
    FROM weak_refs wr
    LEFT JOIN refs r ON r.ref = wr.ref
    WHERE r.ref IS NULL
    LIMIT 1;
  IF v_missing_ref IS NOT NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_ACTION_PLAN: Weak answer "%" is not represented in the action payload.',
      v_missing_ref USING ERRCODE = 'P0001';
  END IF;

  -- 12. Insert all actions. Any failure rolls back the whole transaction.
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    INSERT INTO public.organization_actions (
      organization_id, assessment_id, pillar_name, action_category,
      title, description, why_it_matters, why_funders_care,
      priority, status, assigned_user_id, due_date,
      estimated_completion_days, evidence_required, evidence_requirements,
      estimated_pillar_score_increase, estimated_overall_score_increase,
      certification_requirement, source_type, source_reference
    ) VALUES (
      v_org_id,
      p_assessment_id,
      v_action ->> 'pillar',
      v_action ->> 'actionCategory',
      v_action ->> 'title',
      v_action ->> 'description',
      v_action ->> 'whyItMatters',
      v_action ->> 'whyFundersCare',
      v_action ->> 'priority',
      'Not Started',
      NULL,
      NULL,
      (v_action ->> 'estimatedCompletionDays')::integer,
      TRUE,
      v_action ->> 'evidenceRequirements',
      (v_action ->> 'estimatedPillarScoreIncrease')::numeric,
      (v_action ->> 'estimatedOverallScoreIncrease')::numeric,
      FALSE,
      'assessment',
      v_action ->> 'sourceReference'
    )
    RETURNING id INTO v_inserted_ids[array_length(v_inserted_ids, 1) + 1];
  END LOOP;

  -- 13. Mark the assessment's action plan as created (same transaction)
  UPDATE public.assessments
    SET created_action_plan = TRUE
    WHERE id = p_assessment_id;

  -- 14. Return the inserted rows
  RETURN QUERY SELECT * FROM public.organization_actions
    WHERE id = ANY(v_inserted_ids)
    ORDER BY array_position(v_inserted_ids, id);
END;
$function$;

-- Revoke any default EXECUTE from PUBLIC and grant only to authenticated users.
REVOKE ALL ON FUNCTION public.persist_assessment_action_plan(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_assessment_action_plan(uuid, jsonb) TO authenticated;
