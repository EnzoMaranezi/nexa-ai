ALTER TABLE public.summaries
  ADD COLUMN locale text;

UPDATE public.summaries
SET locale = 'und'
WHERE locale IS NULL;

ALTER TABLE public.summaries
  ALTER COLUMN locale SET NOT NULL,
  ADD CONSTRAINT summaries_locale_check CHECK (locale IN ('und', 'en', 'pt-BR')),
  DROP CONSTRAINT IF EXISTS summaries_document_id_key,
  ADD CONSTRAINT summaries_document_locale_key UNIQUE (document_id, locale);

CREATE INDEX summaries_user_document_locale_idx
ON public.summaries(user_id, document_id, locale);

ALTER TABLE public.flashcard_sets
  ADD COLUMN locale text;

UPDATE public.flashcard_sets
SET locale = 'und'
WHERE locale IS NULL;

ALTER TABLE public.flashcard_sets
  ALTER COLUMN locale SET NOT NULL,
  ADD CONSTRAINT flashcard_sets_locale_check CHECK (locale IN ('und', 'en', 'pt-BR')),
  DROP CONSTRAINT IF EXISTS flashcard_sets_document_id_key,
  ADD CONSTRAINT flashcard_sets_document_locale_key UNIQUE (document_id, locale);

CREATE INDEX flashcard_sets_user_document_locale_idx
ON public.flashcard_sets(user_id, document_id, locale);

ALTER TABLE public.question_sets
  ADD COLUMN locale text,
  ADD COLUMN kind text,
  ADD COLUMN source_question_set_id uuid,
  ADD COLUMN superseded_at timestamp with time zone;

UPDATE public.question_sets
SET
  locale = 'und',
  kind = 'legacy'
WHERE locale IS NULL OR kind IS NULL;

ALTER TABLE public.question_sets
  ALTER COLUMN locale SET NOT NULL,
  ALTER COLUMN kind SET NOT NULL,
  ADD CONSTRAINT question_sets_locale_check CHECK (locale IN ('und', 'en', 'pt-BR')),
  ADD CONSTRAINT question_sets_kind_check CHECK (kind IN ('legacy', 'standard', 'practice')),
  ADD CONSTRAINT question_sets_source_question_set_id_fkey
    FOREIGN KEY (source_question_set_id)
    REFERENCES public.question_sets(id)
    ON DELETE SET NULL;

CREATE UNIQUE INDEX question_sets_current_document_locale_uidx
ON public.question_sets(document_id, locale)
WHERE kind = 'standard' AND superseded_at IS NULL;

CREATE INDEX question_sets_user_document_locale_kind_idx
ON public.question_sets(user_id, document_id, locale, kind, created_at DESC);

CREATE INDEX question_sets_source_idx
ON public.question_sets(source_question_set_id)
WHERE source_question_set_id IS NOT NULL;

ALTER TABLE public.ai_generation_events
  ADD COLUMN locale text;

UPDATE public.ai_generation_events
SET locale = 'und'
WHERE locale IS NULL;

ALTER TABLE public.ai_generation_events
  ALTER COLUMN locale SET NOT NULL,
  ADD CONSTRAINT ai_generation_events_locale_check CHECK (locale IN ('und', 'en', 'pt-BR'));

CREATE INDEX ai_generation_events_generation_identity_idx
ON public.ai_generation_events(user_id, document_id, kind, locale, status, reserved_until);

REVOKE ALL ON public.summaries, public.question_sets FROM PUBLIC;
REVOKE ALL ON public.summaries, public.question_sets FROM anon;
REVOKE ALL ON public.summaries, public.question_sets FROM authenticated;
GRANT SELECT ON public.summaries, public.question_sets TO authenticated;

DROP POLICY IF EXISTS "Users can manage their own summaries" ON public.summaries;
CREATE POLICY "Users can read their own summaries"
ON public.summaries FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own question sets" ON public.question_sets;
CREATE POLICY "Users can read their own question sets"
ON public.question_sets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own question sessions" ON public.question_sessions;
CREATE POLICY "Users can manage valid own question sessions"
ON public.question_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.documents AS owned_document
    WHERE owned_document.id = question_sessions.document_id
      AND owned_document.user_id = auth.uid()
  )
  AND (
    question_sessions.question_set_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.question_sets AS owned_set
      WHERE owned_set.id = question_sessions.question_set_id
        AND owned_set.user_id = auth.uid()
        AND owned_set.document_id = question_sessions.document_id
    )
  )
);

CREATE OR REPLACE FUNCTION public.save_summary_version(
  p_document_id uuid,
  p_locale text,
  p_title text,
  p_content jsonb,
  p_model text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_summary_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_document_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' OR jsonb_typeof(p_content) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_SUMMARY' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_document_id::text || ':summary:' || p_locale)
  );

  INSERT INTO public.summaries (document_id, user_id, title, content, model, locale)
  VALUES (p_document_id, v_user_id, btrim(p_title), p_content, p_model, p_locale)
  ON CONFLICT (document_id, locale) DO UPDATE
  SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    model = EXCLUDED.model,
    updated_at = now()
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_question_set_version(
  p_document_id uuid,
  p_locale text,
  p_kind text,
  p_model text,
  p_questions jsonb,
  p_source_question_set_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_source_locale text;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_document_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'INVALID_QUESTIONS' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'standard' AND p_source_question_set_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_QUESTION_SET_SOURCE' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'practice' THEN
    SELECT locale
    INTO v_source_locale
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
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_document_id::text || ':' || p_kind || ':' || p_locale)
  );

  IF p_kind = 'standard' THEN
    UPDATE public.question_sets
    SET superseded_at = now()
    WHERE document_id = p_document_id
      AND user_id = v_user_id
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
    source_question_set_id
  )
  VALUES (
    p_document_id,
    v_user_id,
    p_questions,
    p_model,
    p_locale,
    p_kind,
    p_source_question_set_id
  )
  RETURNING id INTO v_set_id;

  RETURN v_set_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_flashcard_set_with_cards(uuid, text, jsonb);

CREATE FUNCTION public.create_flashcard_set_with_cards(
  p_document_id uuid,
  p_locale text,
  p_model text,
  p_cards jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_card jsonb;
  v_front text;
  v_back text;
  v_position integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_document_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_document_id::text || ':flashcards:' || p_locale)
  );

  IF jsonb_typeof(p_cards) <> 'array' OR jsonb_array_length(p_cards) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION 'INVALID_FLASHCARDS' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.flashcard_sets (user_id, document_id, model, locale)
  VALUES (v_user_id, p_document_id, p_model, p_locale)
  ON CONFLICT (document_id, locale) DO NOTHING
  RETURNING id INTO v_set_id;

  IF v_set_id IS NULL THEN
    SELECT id INTO v_set_id
    FROM public.flashcard_sets
    WHERE document_id = p_document_id
      AND user_id = v_user_id
      AND locale = p_locale;
    RETURN v_set_id;
  END IF;

  FOR v_card IN SELECT value FROM jsonb_array_elements(p_cards) LOOP
    v_position := v_position + 1;
    v_front := btrim(v_card->>'front');
    v_back := btrim(v_card->>'back');
    IF v_front IS NULL OR v_back IS NULL
      OR char_length(v_front) NOT BETWEEN 3 AND 240
      OR char_length(v_back) NOT BETWEEN 3 AND 800 THEN
      RAISE EXCEPTION 'INVALID_FLASHCARDS' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.flashcards (flashcard_set_id, front, back, position)
    VALUES (v_set_id, v_front, v_back, v_position);
  END LOOP;

  RETURN v_set_id;
END;
$$;

DROP FUNCTION IF EXISTS public.reserve_ai_generation(text, uuid);

CREATE FUNCTION public.reserve_ai_generation(
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
  IF p_kind NOT IN ('summary', 'questions', 'practice_questions', 'flashcards') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_GENERATION_KIND' USING ERRCODE = '22023';
  END IF;
  IF p_locale NOT IN ('en', 'pt-BR') THEN
    RAISE EXCEPTION 'UNSUPPORTED_CONTENT_LOCALE' USING ERRCODE = '22023';
  END IF;
  IF p_document_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_document_id AND user_id = v_user_id
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

REVOKE ALL ON FUNCTION public.save_summary_version(uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_summary_version(uuid, text, text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_summary_version(uuid, text, text, jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_question_set_version(uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_question_set_version(uuid, text, text, text, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_question_set_version(uuid, text, text, text, jsonb, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_flashcard_set_with_cards(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_flashcard_set_with_cards(uuid, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_flashcard_set_with_cards(uuid, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(text, uuid, text) TO authenticated;
