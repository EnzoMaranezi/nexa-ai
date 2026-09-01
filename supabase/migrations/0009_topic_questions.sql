ALTER TABLE public.question_sets
  ADD COLUMN topic_id uuid
  REFERENCES public.document_topics(id)
  ON DELETE SET NULL,
  ADD COLUMN topic_scope_id uuid;

DROP INDEX IF EXISTS public.question_sets_current_document_locale_uidx;

CREATE UNIQUE INDEX question_sets_current_document_locale_uidx
ON public.question_sets(document_id, locale)
WHERE kind = 'standard'
  AND superseded_at IS NULL
  AND topic_scope_id IS NULL;

CREATE UNIQUE INDEX question_sets_current_topic_locale_uidx
ON public.question_sets(document_id, topic_scope_id, locale)
WHERE kind = 'standard'
  AND superseded_at IS NULL
  AND topic_scope_id IS NOT NULL;

CREATE INDEX question_sets_user_document_topic_locale_kind_idx
ON public.question_sets(
  user_id,
  document_id,
  topic_scope_id,
  locale,
  kind,
  created_at DESC
);

DROP FUNCTION IF EXISTS public.create_question_set_version(uuid, text, text, text, jsonb, uuid);

CREATE FUNCTION public.create_question_set_version(
  p_document_id uuid,
  p_locale text,
  p_kind text,
  p_model text,
  p_questions jsonb,
  p_source_question_set_id uuid DEFAULT NULL,
  p_topic_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_source_text text;
  v_topic_source_hash text;
  v_topic_ranges jsonb;
  v_computed_hash text;
  v_range jsonb;
  v_start_value numeric;
  v_end_value numeric;
  v_previous_end numeric;
  v_source_locale text;
  v_source_topic_id uuid;
  v_source_topic_scope_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('standard', 'practice') THEN
    RAISE EXCEPTION 'UNSUPPORTED_QUESTION_SET_KIND' USING ERRCODE = '22023';
  END IF;

  SELECT extracted_text
  INTO v_source_text
  FROM public.documents
  WHERE id = p_document_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'INVALID_QUESTIONS' USING ERRCODE = '22023';
  END IF;

  IF p_topic_id IS NOT NULL THEN
    SELECT source_hash, source_ranges
    INTO v_topic_source_hash, v_topic_ranges
    FROM public.document_topics
    WHERE id = p_topic_id
      AND document_id = p_document_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TOPIC_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_source_text IS NULL OR btrim(v_source_text) = '' THEN
      RAISE EXCEPTION 'TOPIC_SOURCE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    v_computed_hash := encode(
      extensions.digest(convert_to(v_source_text, 'UTF8'), 'sha256'),
      'hex'
    );
    IF v_computed_hash <> v_topic_source_hash THEN
      RAISE EXCEPTION 'STALE_TOPIC_SOURCE' USING ERRCODE = 'P0001';
    END IF;
    IF jsonb_typeof(v_topic_ranges) <> 'array'
      OR jsonb_array_length(v_topic_ranges) = 0 THEN
      RAISE EXCEPTION 'INVALID_TOPIC_SOURCE_RANGE' USING ERRCODE = '22023';
    END IF;

    v_previous_end := NULL;
    FOR v_range IN SELECT value FROM jsonb_array_elements(v_topic_ranges)
    LOOP
      IF jsonb_typeof(v_range) <> 'object'
        OR jsonb_typeof(v_range->'start') <> 'number'
        OR jsonb_typeof(v_range->'end') <> 'number'
        OR COALESCE(v_range->>'start', '') !~ '^[0-9]+$'
        OR COALESCE(v_range->>'end', '') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'INVALID_TOPIC_SOURCE_RANGE' USING ERRCODE = '22023';
      END IF;

      v_start_value := (v_range->>'start')::numeric;
      v_end_value := (v_range->>'end')::numeric;
      IF v_start_value < 0
        OR v_end_value <= v_start_value
        OR v_end_value > char_length(v_source_text)::numeric
        OR (v_previous_end IS NOT NULL AND v_start_value < v_previous_end) THEN
        RAISE EXCEPTION 'INVALID_TOPIC_SOURCE_RANGE' USING ERRCODE = '22023';
      END IF;
      v_previous_end := v_end_value;
    END LOOP;
  END IF;

  IF p_kind = 'standard' AND p_source_question_set_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_QUESTION_SET_SOURCE' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'practice' THEN
    SELECT locale, topic_id, topic_scope_id
    INTO v_source_locale, v_source_topic_id, v_source_topic_scope_id
    FROM public.question_sets
    WHERE id = p_source_question_set_id
      AND user_id = v_user_id
      AND document_id = p_document_id
      AND kind = 'standard';

    IF v_source_locale IS NULL THEN
      RAISE EXCEPTION 'QUESTION_SET_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_source_locale = 'und' OR v_source_locale <> p_locale THEN
      RAISE EXCEPTION 'QUESTION_SET_LOCALE_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF v_source_topic_scope_id IS DISTINCT FROM p_topic_id THEN
      RAISE EXCEPTION 'QUESTION_SET_TOPIC_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF p_topic_id IS NOT NULL AND v_source_topic_id IS DISTINCT FROM p_topic_id THEN
      RAISE EXCEPTION 'TOPIC_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(
      p_document_id::text
      || ':'
      || COALESCE(p_topic_id::text, 'document')
      || ':'
      || p_kind
      || ':'
      || p_locale
    )
  );

  IF p_kind = 'standard' THEN
    UPDATE public.question_sets
    SET superseded_at = now()
    WHERE document_id = p_document_id
      AND user_id = v_user_id
      AND topic_scope_id IS NOT DISTINCT FROM p_topic_id
      AND locale = p_locale
      AND kind = 'standard'
      AND superseded_at IS NULL;
  END IF;

  INSERT INTO public.question_sets (
    document_id,
    user_id,
    questions,
    model,
    locale,
    kind,
    source_question_set_id,
    topic_id,
    topic_scope_id
  )
  VALUES (
    p_document_id,
    v_user_id,
    p_questions,
    p_model,
    p_locale,
    p_kind,
    p_source_question_set_id,
    p_topic_id,
    p_topic_id
  )
  RETURNING id INTO v_set_id;

  RETURN v_set_id;
END;
$$;

DROP FUNCTION IF EXISTS public.reserve_ai_generation(text, uuid, text, uuid);

CREATE FUNCTION public.reserve_ai_generation(
  p_kind text,
  p_document_id uuid,
  p_locale text,
  p_topic_id uuid DEFAULT NULL
)
RETURNS TABLE(reservation_id uuid, used_count integer, limit_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_usage_date date := ((now() AT TIME ZONE 'UTC')::date);
  v_limit integer := 20;
  v_used integer;
  v_reservation_id uuid;
  v_source_text text;
  v_topic_source_hash text;
  v_computed_hash text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_kind NOT IN ('summary', 'questions', 'practice_questions', 'flashcards', 'topic_discovery') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_GENERATION_KIND' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'topic_discovery' THEN
    IF p_locale <> 'und' OR p_topic_id IS NOT NULL THEN
      RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
    END IF;
  ELSIF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;
  IF p_topic_id IS NOT NULL
    AND p_kind NOT IN ('summary', 'questions', 'practice_questions') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_TOPIC_SCOPE' USING ERRCODE = '22023';
  END IF;

  SELECT extracted_text
  INTO v_source_text
  FROM public.documents
  WHERE id = p_document_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF p_topic_id IS NOT NULL THEN
    SELECT source_hash
    INTO v_topic_source_hash
    FROM public.document_topics
    WHERE id = p_topic_id
      AND document_id = p_document_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TOPIC_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_source_text IS NULL OR btrim(v_source_text) = '' THEN
      RAISE EXCEPTION 'TOPIC_SOURCE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    v_computed_hash := encode(
      extensions.digest(convert_to(v_source_text, 'UTF8'), 'sha256'),
      'hex'
    );
    IF v_computed_hash <> v_topic_source_hash THEN
      RAISE EXCEPTION 'STALE_TOPIC_SOURCE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(v_usage_date::text));
  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(
      p_document_id::text
      || ':'
      || COALESCE(p_topic_id::text, 'document')
      || ':'
      || p_kind
      || ':'
      || p_locale
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.ai_generation_events
    WHERE user_id = v_user_id
      AND document_id = p_document_id
      AND topic_scope_id IS NOT DISTINCT FROM p_topic_id
      AND kind = p_kind
      AND locale = p_locale
      AND status = 'reserved'
      AND reserved_until > now()
  ) THEN
    RAISE EXCEPTION 'AI_GENERATION_IN_PROGRESS' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer
  INTO v_used
  FROM public.ai_generation_events
  WHERE user_id = v_user_id
    AND usage_date = v_usage_date
    AND (
      status = 'succeeded'
      OR (status = 'reserved' AND reserved_until > now())
    );

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'AI_DAILY_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_generation_events (
    user_id,
    usage_date,
    kind,
    document_id,
    topic_id,
    topic_scope_id,
    locale,
    status,
    reserved_until
  )
  VALUES (
    v_user_id,
    v_usage_date,
    p_kind,
    p_document_id,
    p_topic_id,
    p_topic_id,
    p_locale,
    'reserved',
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT v_reservation_id, v_used + 1, v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.create_question_set_version(uuid, text, text, text, jsonb, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_question_set_version(uuid, text, text, text, jsonb, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_question_set_version(uuid, text, text, text, jsonb, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(text, uuid, text, uuid) TO authenticated;
