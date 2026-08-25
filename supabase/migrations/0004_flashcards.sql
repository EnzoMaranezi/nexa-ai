CREATE TABLE public.flashcard_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_set_id uuid NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
  front text NOT NULL CHECK (char_length(front) BETWEEN 3 AND 240),
  back text NOT NULL CHECK (char_length(back) BETWEEN 3 AND 800),
  position integer NOT NULL CHECK (position > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (flashcard_set_id, position)
);

CREATE INDEX flashcard_sets_user_document_idx ON public.flashcard_sets(user_id, document_id);
CREATE INDEX flashcards_set_position_idx ON public.flashcards(flashcard_set_id, position);

CREATE TRIGGER update_flashcard_sets_updated_at
BEFORE UPDATE ON public.flashcard_sets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.flashcard_sets, public.flashcards FROM PUBLIC;
REVOKE ALL ON public.flashcard_sets, public.flashcards FROM anon;
REVOKE ALL ON public.flashcard_sets, public.flashcards FROM authenticated;
GRANT SELECT ON public.flashcard_sets, public.flashcards TO authenticated;
GRANT ALL ON public.flashcard_sets, public.flashcards TO service_role;

CREATE POLICY "Users can read their own flashcard sets"
ON public.flashcard_sets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can read flashcards in their own sets"
ON public.flashcards FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.flashcard_sets
    WHERE flashcard_sets.id = flashcards.flashcard_set_id
      AND flashcard_sets.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.create_flashcard_set_with_cards(
  p_document_id uuid,
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
  IF NOT EXISTS (SELECT 1 FROM public.documents WHERE id = p_document_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_document_id::text));

  IF jsonb_typeof(p_cards) <> 'array' OR jsonb_array_length(p_cards) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION 'INVALID_FLASHCARDS' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.flashcard_sets (user_id, document_id, model)
  VALUES (v_user_id, p_document_id, p_model)
  ON CONFLICT (document_id) DO NOTHING
  RETURNING id INTO v_set_id;

  IF v_set_id IS NULL THEN
    SELECT id INTO v_set_id FROM public.flashcard_sets
    WHERE document_id = p_document_id AND user_id = v_user_id;
    RETURN v_set_id;
  END IF;

  FOR v_card IN SELECT value FROM jsonb_array_elements(p_cards) LOOP
    v_position := v_position + 1;
    v_front := btrim(v_card->>'front');
    v_back := btrim(v_card->>'back');
    IF v_front IS NULL OR v_back IS NULL OR char_length(v_front) NOT BETWEEN 3 AND 240 OR char_length(v_back) NOT BETWEEN 3 AND 800 THEN
      RAISE EXCEPTION 'INVALID_FLASHCARDS' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.flashcards (flashcard_set_id, front, back, position)
    VALUES (v_set_id, v_front, v_back, v_position);
  END LOOP;
  RETURN v_set_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_flashcard_set_with_cards(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_flashcard_set_with_cards(uuid, text, jsonb) TO authenticated;

ALTER TABLE public.ai_generation_events DROP CONSTRAINT IF EXISTS ai_generation_events_kind_check;
ALTER TABLE public.ai_generation_events ADD CONSTRAINT ai_generation_events_kind_check
CHECK (kind IN ('summary', 'questions', 'practice_questions', 'flashcards'));

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(
  p_kind text,
  p_document_id uuid DEFAULT NULL
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
  v_document_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF p_kind NOT IN ('summary', 'questions', 'practice_questions', 'flashcards') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_GENERATION_KIND' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'flashcards' AND p_document_id IS NULL THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF p_document_id IS NOT NULL THEN
    SELECT user_id
    INTO v_document_owner
    FROM public.documents
    WHERE id = p_document_id;

    IF v_document_owner IS NULL OR v_document_owner <> v_user_id THEN
      RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(v_usage_date::text));

  IF p_kind = 'flashcards' THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_document_id::text));

    IF EXISTS (
      SELECT 1
      FROM public.ai_generation_events
      WHERE user_id = v_user_id
        AND document_id = p_document_id
        AND kind = 'flashcards'
        AND status = 'reserved'
        AND reserved_until > now()
    ) THEN
      RAISE EXCEPTION 'AI_GENERATION_IN_PROGRESS' USING ERRCODE = 'P0001';
    END IF;
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
    status,
    reserved_until
  )
  VALUES (
    v_user_id,
    v_usage_date,
    p_kind,
    p_document_id,
    'reserved',
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT v_reservation_id, v_used + 1, v_limit;
END;
$$;
