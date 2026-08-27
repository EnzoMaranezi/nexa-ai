CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.document_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (title = btrim(title) AND char_length(title) BETWEEN 3 AND 160),
  description text NOT NULL CHECK (
    description = btrim(description)
    AND char_length(description) BETWEEN 20 AND 600
  ),
  source_ranges jsonb NOT NULL CHECK (
    jsonb_typeof(source_ranges) = 'array'
    AND jsonb_array_length(source_ranges) > 0
  ),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  position integer NOT NULL CHECK (position > 0),
  discovery_model text CHECK (
    discovery_model IS NULL
    OR (discovery_model = btrim(discovery_model) AND char_length(discovery_model) BETWEEN 1 AND 200)
  ),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (document_id, position)
);

CREATE INDEX document_topics_user_document_position_idx
ON public.document_topics(user_id, document_id, position);

CREATE TRIGGER update_document_topics_updated_at
BEFORE UPDATE ON public.document_topics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.document_topics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.document_topics FROM PUBLIC;
REVOKE ALL ON TABLE public.document_topics FROM anon;
REVOKE ALL ON TABLE public.document_topics FROM authenticated;
GRANT SELECT ON TABLE public.document_topics TO authenticated;

CREATE POLICY "Users can read their own document topics"
ON public.document_topics FOR SELECT TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.ai_generation_events
  DROP CONSTRAINT IF EXISTS ai_generation_events_kind_check;

ALTER TABLE public.ai_generation_events
  ADD CONSTRAINT ai_generation_events_kind_check
  CHECK (kind IN ('summary', 'questions', 'practice_questions', 'flashcards', 'topic_discovery'));

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(
  p_kind text,
  p_document_id uuid,
  p_locale text
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_kind NOT IN ('summary', 'questions', 'practice_questions', 'flashcards', 'topic_discovery') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_GENERATION_KIND' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'topic_discovery' THEN
    IF p_locale <> 'und' THEN
      RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
    END IF;
  ELSIF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;
  IF p_document_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.documents
    WHERE id = p_document_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(v_usage_date::text));
  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_document_id::text || ':' || p_kind || ':' || p_locale)
  );

  IF EXISTS (
    SELECT 1
    FROM public.ai_generation_events
    WHERE user_id = v_user_id
      AND document_id = p_document_id
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
    locale,
    status,
    reserved_until
  )
  VALUES (
    v_user_id,
    v_usage_date,
    p_kind,
    p_document_id,
    p_locale,
    'reserved',
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT v_reservation_id, v_used + 1, v_limit;
END;
$$;

CREATE FUNCTION public.create_document_topics(
  p_document_id uuid,
  p_source_hash text,
  p_discovery_model text,
  p_topics jsonb
)
RETURNS SETOF public.document_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source_text text;
  v_computed_hash text;
  v_existing_topics jsonb;
  v_existing_count bigint;
  v_existing_distinct_positions bigint;
  v_existing_distinct_hashes bigint;
  v_existing_invalid_owners bigint;
  v_existing_min_position integer;
  v_existing_max_position integer;
  v_existing_hash text;
  v_reuse_existing boolean := false;
  v_topic jsonb;
  v_range jsonb;
  v_seen_range jsonb;
  v_title text;
  v_description text;
  v_normalized_title text;
  v_normalized_titles text[] := ARRAY[]::text[];
  v_ranges jsonb;
  v_position integer;
  v_position_value numeric;
  v_start integer;
  v_end integer;
  v_start_value numeric;
  v_end_value numeric;
  v_previous_end integer;
  v_grounded_chars integer;
  v_topic_grounded_chars integer;
  v_total_grounded_chars integer;
  v_total_range_count integer := 0;
  v_seen_ranges jsonb := '[]'::jsonb;
  v_max_ranges_per_topic constant integer := 256;
  v_max_ranges_total constant integer := 512;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT extracted_text
  INTO v_source_text
  FROM public.documents
  WHERE id = p_document_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_source_text IS NULL OR btrim(v_source_text) = '' THEN
    RAISE EXCEPTION 'TOPIC_SOURCE_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_source_hash IS NULL OR p_source_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_TOPIC_SOURCE_HASH' USING ERRCODE = '22023';
  END IF;

  v_computed_hash := encode(
    extensions.digest(convert_to(v_source_text, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_computed_hash <> p_source_hash THEN
    RAISE EXCEPTION 'STALE_TOPIC_SOURCE' USING ERRCODE = 'P0001';
  END IF;
  IF p_discovery_model IS NOT NULL AND (
    p_discovery_model <> btrim(p_discovery_model)
    OR char_length(p_discovery_model) NOT BETWEEN 1 AND 200
  ) THEN
    RAISE EXCEPTION 'INVALID_TOPIC_MODEL' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_document_id::text || ':document_topics')
  );

  SELECT
    count(*),
    count(DISTINCT position),
    count(DISTINCT source_hash),
    count(*) FILTER (WHERE user_id <> v_user_id),
    min(position),
    max(position),
    min(source_hash)
  INTO
    v_existing_count,
    v_existing_distinct_positions,
    v_existing_distinct_hashes,
    v_existing_invalid_owners,
    v_existing_min_position,
    v_existing_max_position,
    v_existing_hash
  FROM public.document_topics
  WHERE document_id = p_document_id;

  IF v_existing_count > 0 THEN
    IF v_existing_count NOT BETWEEN 3 AND 12
      OR v_existing_distinct_positions <> v_existing_count
      OR v_existing_min_position <> 1
      OR v_existing_max_position <> v_existing_count
      OR v_existing_invalid_owners <> 0
      OR v_existing_distinct_hashes <> 1 THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;
    IF v_existing_hash <> v_computed_hash THEN
      RAISE EXCEPTION 'STALE_TOPIC_SOURCE' USING ERRCODE = 'P0001';
    END IF;
    SELECT jsonb_agg(
      jsonb_build_object(
        'title', title,
        'description', description,
        'source_ranges', source_ranges,
        'position', position
      )
      ORDER BY position
    )
    INTO v_existing_topics
    FROM public.document_topics
    WHERE document_id = p_document_id;
    p_topics := v_existing_topics;
    v_reuse_existing := true;
  END IF;

  IF p_topics IS NULL OR jsonb_typeof(p_topics) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_topics) NOT BETWEEN 3 AND 12 THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
  END IF;

  v_total_grounded_chars := char_length(
    regexp_replace(v_source_text, '[[:space:]]', '', 'g')
  );
  v_grounded_chars := 0;

  FOR v_topic, v_position IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(p_topics) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(v_topic) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;

    v_title := btrim(v_topic->>'title');
    v_description := btrim(v_topic->>'description');
    v_ranges := v_topic->'source_ranges';

    IF v_title IS NULL OR char_length(v_title) NOT BETWEEN 3 AND 160
      OR v_description IS NULL OR char_length(v_description) NOT BETWEEN 20 AND 600
      OR jsonb_typeof(v_ranges) <> 'array' THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_ranges) NOT BETWEEN 1 AND v_max_ranges_per_topic THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;
    v_total_range_count := v_total_range_count + jsonb_array_length(v_ranges);
    IF v_total_range_count > v_max_ranges_total THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_topic->'position') <> 'number'
      OR COALESCE(v_topic->>'position', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;
    v_position_value := (v_topic->>'position')::numeric;
    IF v_position_value NOT BETWEEN 1 AND 12
      OR v_position_value <> v_position::numeric THEN
      RAISE EXCEPTION 'INVALID_DOCUMENT_TOPICS' USING ERRCODE = '22023';
    END IF;

    v_normalized_title := lower(regexp_replace(v_title, '[^[:alnum:]]', '', 'g'));
    IF v_normalized_title = ANY(v_normalized_titles) THEN
      RAISE EXCEPTION 'DUPLICATE_DOCUMENT_TOPIC' USING ERRCODE = '22023';
    END IF;
    v_normalized_titles := array_append(v_normalized_titles, v_normalized_title);

    v_previous_end := NULL;
    v_topic_grounded_chars := 0;
    FOR v_range IN SELECT value FROM jsonb_array_elements(v_ranges)
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
        OR (v_previous_end IS NOT NULL AND v_start_value < v_previous_end::numeric) THEN
        RAISE EXCEPTION 'INVALID_TOPIC_SOURCE_RANGE' USING ERRCODE = '22023';
      END IF;
      v_start := v_start_value::integer;
      v_end := v_end_value::integer;

      FOR v_seen_range IN SELECT value FROM jsonb_array_elements(v_seen_ranges)
      LOOP
        IF v_start < (v_seen_range->>'end')::integer
          AND v_end > (v_seen_range->>'start')::integer THEN
          RAISE EXCEPTION 'OVERLAPPING_DOCUMENT_TOPICS' USING ERRCODE = '22023';
        END IF;
      END LOOP;

      v_topic_grounded_chars := v_topic_grounded_chars + char_length(
        regexp_replace(
          substring(v_source_text FROM v_start + 1 FOR v_end - v_start),
          '[[:space:]]',
          '',
          'g'
        )
      );
      v_seen_ranges := v_seen_ranges || jsonb_build_array(
        jsonb_build_object('start', v_start, 'end', v_end)
      );
      v_previous_end := v_end;
    END LOOP;

    IF v_topic_grounded_chars < 80 THEN
      RAISE EXCEPTION 'TOPIC_SOURCE_TOO_SHORT' USING ERRCODE = '22023';
    END IF;
    IF v_total_grounded_chars >= 1000
      AND v_topic_grounded_chars::numeric / v_total_grounded_chars::numeric > 0.85 THEN
      RAISE EXCEPTION 'TOPIC_SOURCE_TOO_BROAD' USING ERRCODE = '22023';
    END IF;
    v_grounded_chars := v_grounded_chars + v_topic_grounded_chars;
  END LOOP;

  IF v_total_grounded_chars = 0
    OR v_grounded_chars::numeric / v_total_grounded_chars::numeric < 0.80 THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOPIC_SOURCE_COVERAGE' USING ERRCODE = '22023';
  END IF;

  IF v_reuse_existing THEN
    RETURN QUERY
    SELECT topic.*
    FROM public.document_topics AS topic
    WHERE topic.document_id = p_document_id
      AND topic.user_id = v_user_id
    ORDER BY topic.position;
    RETURN;
  END IF;

  FOR v_topic, v_position IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(p_topics) WITH ORDINALITY
  LOOP
    INSERT INTO public.document_topics (
      user_id,
      document_id,
      title,
      description,
      source_ranges,
      source_hash,
      position,
      discovery_model
    )
    VALUES (
      v_user_id,
      p_document_id,
      btrim(v_topic->>'title'),
      btrim(v_topic->>'description'),
      v_topic->'source_ranges',
      v_computed_hash,
      v_position,
      p_discovery_model
    );
  END LOOP;

  RETURN QUERY
  SELECT topic.*
  FROM public.document_topics AS topic
  WHERE topic.document_id = p_document_id
    AND topic.user_id = v_user_id
  ORDER BY topic.position;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(text, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_document_topics(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_document_topics(uuid, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_document_topics(uuid, text, text, jsonb) TO authenticated;
