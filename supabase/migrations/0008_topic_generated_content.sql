ALTER TABLE public.summaries
  ADD COLUMN topic_id uuid
  REFERENCES public.document_topics(id)
  ON DELETE CASCADE;

ALTER TABLE public.summaries
  DROP CONSTRAINT IF EXISTS summaries_document_locale_key;

CREATE UNIQUE INDEX summaries_document_locale_uidx
ON public.summaries(document_id, locale)
WHERE topic_id IS NULL;

CREATE UNIQUE INDEX summaries_topic_locale_uidx
ON public.summaries(topic_id, locale)
WHERE topic_id IS NOT NULL;

CREATE INDEX summaries_user_document_topic_locale_idx
ON public.summaries(user_id, document_id, topic_id, locale);

ALTER TABLE public.ai_generation_events
  ADD COLUMN topic_id uuid
  REFERENCES public.document_topics(id)
  ON DELETE SET NULL,
  ADD COLUMN topic_scope_id uuid;

DROP INDEX IF EXISTS public.ai_generation_events_generation_identity_idx;

CREATE INDEX ai_generation_events_generation_identity_idx
ON public.ai_generation_events(
  user_id,
  document_id,
  topic_scope_id,
  kind,
  locale,
  status,
  reserved_until
);

DROP FUNCTION IF EXISTS public.save_summary_version(uuid, text, text, jsonb, text);

CREATE FUNCTION public.save_summary_version(
  p_document_id uuid,
  p_locale text,
  p_title text,
  p_content jsonb,
  p_model text,
  p_topic_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_summary_id uuid;
  v_source_text text;
  v_topic_source_hash text;
  v_topic_ranges jsonb;
  v_computed_hash text;
  v_range jsonb;
  v_start_value numeric;
  v_end_value numeric;
  v_previous_end numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;

  SELECT extracted_text
  INTO v_source_text
  FROM public.documents
  WHERE id = p_document_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' OR jsonb_typeof(p_content) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_SUMMARY' USING ERRCODE = '22023';
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

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(
      p_document_id::text
      || ':summary:'
      || COALESCE(p_topic_id::text, 'document')
      || ':'
      || p_locale
    )
  );

  IF p_topic_id IS NULL THEN
    INSERT INTO public.summaries (
      document_id,
      topic_id,
      user_id,
      title,
      content,
      model,
      locale
    )
    VALUES (
      p_document_id,
      NULL,
      v_user_id,
      btrim(p_title),
      p_content,
      p_model,
      p_locale
    )
    ON CONFLICT (document_id, locale) WHERE topic_id IS NULL DO UPDATE
    SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      model = EXCLUDED.model,
      updated_at = now()
    RETURNING id INTO v_summary_id;
  ELSE
    INSERT INTO public.summaries (
      document_id,
      topic_id,
      user_id,
      title,
      content,
      model,
      locale
    )
    VALUES (
      p_document_id,
      p_topic_id,
      v_user_id,
      btrim(p_title),
      p_content,
      p_model,
      p_locale
    )
    ON CONFLICT (topic_id, locale) WHERE topic_id IS NOT NULL DO UPDATE
    SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      model = EXCLUDED.model,
      updated_at = now()
    RETURNING id INTO v_summary_id;
  END IF;

  RETURN v_summary_id;
END;
$$;

DROP FUNCTION IF EXISTS public.reserve_ai_generation(text, uuid, text);

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
  IF p_topic_id IS NOT NULL AND p_kind <> 'summary' THEN
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

REVOKE ALL ON FUNCTION public.save_summary_version(uuid, text, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_summary_version(uuid, text, text, jsonb, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_summary_version(uuid, text, text, jsonb, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(text, uuid, text, uuid) TO authenticated;
