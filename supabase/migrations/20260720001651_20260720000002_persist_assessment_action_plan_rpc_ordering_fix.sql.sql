/*
# Persist Assessment Action Plan RPC — ordering fix

## Purpose
Re-creates persist_assessment_action_plan with corrected validation order so
that an assessment with zero weak answers returns NO_ACTION_PLAN_REQUIRED
even when the client passes an empty array. Previously the empty-array check
fired first and returned INVALID_ACTION_PLAN, which was incorrect per spec
for the zero-weak-answers case.

## Changes
- DROP + CREATE OR REPLACE of persist_assessment_action_plan (same signature,
  same SECURITY DEFINER + SET search_path = public).
- Re-ordering ONLY: the weak-answer count is computed first; if it is 0,
  NO_ACTION_PLAN_REQUIRED is raised (and created_action_plan is NOT flipped)
  regardless of the payload. The empty-payload and >30 checks remain but now
  run after the zero-weak check.
- Re-grants EXECUTE to authenticated and revokes from PUBLIC.
- No tables, columns, indexes, triggers, or RLS policies are touched.
*/

DROP FUNCTION IF EXISTS public.persist_assessment_action_plan(uuid, jsonb);

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

  -- 2. Load assessment
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

  -- 7. Completeness: weak answer count from the database (do not trust client).
  --    Checked BEFORE the empty-array check so a zero-weak assessment returns
  --    NO_ACTION_PLAN_REQUIRED regardless of the payload.
  SELECT count(*) INTO v_weak_count
    FROM public.assessment_answers
    WHERE assessment_id = p_assessment_id
      AND score <= 3;
  IF v_weak_count = 0 THEN
    RAISE EXCEPTION 'NO_ACTION_PLAN_REQUIRED: This assessment has no weak answers; no action plan is required.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Top-level input validation
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
  IF v_weak_count <> v_count THEN
    RAISE EXCEPTION 'INCOMPLETE_ACTION_PLAN: Action count (%) does not match the weak-answer count (%).',
      v_count, v_weak_count
      USING ERRCODE = 'P0001';
  END IF;

  -- 9. Per-action validation + database source verification.
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    v_idx := v_idx + 1;

    FOR i IN 1..array_length(v_required_fields, 1) LOOP
      IF NOT (v_action ? v_required_fields[i]) THEN
        RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % is missing field "%".',
          v_idx, v_required_fields[i]
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    IF (v_action ->> 'assessmentId')::text <> p_assessment_id::text THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % assessmentId does not match the assessment.',
        v_idx USING ERRCODE = 'P0001';
    END IF;

    IF (v_action ->> 'organizationId')::text <> v_org_id::text THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % organizationId does not match the assessment organization.',
        v_idx USING ERRCODE = 'P0001';
    END IF;

    v_pillar := v_action ->> 'pillar';
    IF NOT (v_pillar = ANY(v_allowed_pillars)) THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % has an invalid pillar "%".',
        v_idx, v_pillar USING ERRCODE = 'P0001';
    END IF;

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

    BEGIN
      IF (v_action ->> 'estimatedCompletionDays')::numeric <= 0 THEN
        RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % estimatedCompletionDays must be greater than 0.',
          v_idx USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % estimatedCompletionDays is not numeric.',
        v_idx USING ERRCODE = 'P0001';
    END;

    IF NOT ((v_action ->> 'priority') = ANY(v_allowed_priorities)) THEN
      RAISE EXCEPTION 'INVALID_ACTION_FIELD: Action % has an invalid or disallowed priority "%".',
        v_idx, (v_action ->> 'priority') USING ERRCODE = 'P0001';
    END IF;

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

  -- 12. Insert all actions.
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    INSERT INTO public.organization_actions (
      organization_id, assessment_id, pillar_name, action_category,
      title, description, why_it_matters, why_funders_care,
      priority, status, assigned_user_id, due_date,
      estimated_completion_days, evidence_required, evidence_requirements,
      estimated_pillar_score_increase, estimated_overall_score_increase,
      certification_requirement, source_type, source_reference
    ) VALUES (
      v_org_id, p_assessment_id, v_action ->> 'pillar', v_action ->> 'actionCategory',
      v_action ->> 'title', v_action ->> 'description',
      v_action ->> 'whyItMatters', v_action ->> 'whyFundersCare',
      v_action ->> 'priority', 'Not Started', NULL, NULL,
      (v_action ->> 'estimatedCompletionDays')::integer, TRUE, v_action ->> 'evidenceRequirements',
      (v_action ->> 'estimatedPillarScoreIncrease')::numeric,
      (v_action ->> 'estimatedOverallScoreIncrease')::numeric,
      FALSE, 'assessment', v_action ->> 'sourceReference'
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

REVOKE ALL ON FUNCTION public.persist_assessment_action_plan(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_assessment_action_plan(uuid, jsonb) TO authenticated;
