ALTER TABLE public.flashcards
  ADD COLUMN due_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN last_reviewed_at timestamp with time zone,
  ADD COLUMN interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN repetitions integer NOT NULL DEFAULT 0,
  ADD COLUMN ease_factor numeric(3, 2) NOT NULL DEFAULT 2.50,
  ADD CONSTRAINT flashcards_interval_days_check CHECK (interval_days >= 0),
  ADD CONSTRAINT flashcards_repetitions_check CHECK (repetitions >= 0),
  ADD CONSTRAINT flashcards_ease_factor_check CHECK (ease_factor BETWEEN 1.30 AND 3.00);

CREATE INDEX flashcards_set_due_position_idx
ON public.flashcards(flashcard_set_id, due_at, position);

CREATE TABLE public.flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  previous_due_at timestamp with time zone NOT NULL,
  next_due_at timestamp with time zone NOT NULL,
  previous_interval_days integer NOT NULL CHECK (previous_interval_days >= 0),
  next_interval_days integer NOT NULL CHECK (next_interval_days >= 0),
  reviewed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX flashcard_reviews_user_reviewed_idx
ON public.flashcard_reviews(user_id, reviewed_at DESC);

CREATE INDEX flashcard_reviews_card_reviewed_idx
ON public.flashcard_reviews(flashcard_id, reviewed_at DESC);

ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.flashcard_reviews FROM PUBLIC;
REVOKE ALL ON public.flashcard_reviews FROM anon;
REVOKE ALL ON public.flashcard_reviews FROM authenticated;
GRANT SELECT ON public.flashcard_reviews TO authenticated;

CREATE POLICY "Users can read their own flashcard reviews"
ON public.flashcard_reviews FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.review_flashcard(
  p_flashcard_id uuid,
  p_rating text
)
RETURNS TABLE(
  flashcard_id uuid,
  rating text,
  reviewed_at timestamp with time zone,
  next_due_at timestamp with time zone,
  interval_days integer,
  repetitions integer,
  ease_factor numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rating text := lower(btrim(p_rating));
  v_now timestamp with time zone := transaction_timestamp();
  v_flashcard_id uuid;
  v_previous_due_at timestamp with time zone;
  v_previous_interval integer;
  v_previous_repetitions integer;
  v_previous_ease numeric(3, 2);
  v_next_due_at timestamp with time zone;
  v_next_interval integer;
  v_next_repetitions integer;
  v_next_ease numeric(3, 2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF v_rating IS NULL OR v_rating NOT IN ('again', 'hard', 'good', 'easy') THEN
    RAISE EXCEPTION 'UNSUPPORTED_FLASHCARD_RATING' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_flashcard_id::text));

  SELECT
    card.id,
    card.due_at,
    card.interval_days,
    card.repetitions,
    card.ease_factor
  INTO
    v_flashcard_id,
    v_previous_due_at,
    v_previous_interval,
    v_previous_repetitions,
    v_previous_ease
  FROM public.flashcards AS card
  INNER JOIN public.flashcard_sets AS card_set
    ON card_set.id = card.flashcard_set_id
  WHERE card.id = p_flashcard_id
    AND card_set.user_id = v_user_id
  FOR UPDATE OF card;

  IF v_flashcard_id IS NULL THEN
    RAISE EXCEPTION 'FLASHCARD_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_previous_due_at > v_now THEN
    RAISE EXCEPTION 'FLASHCARD_NOT_DUE' USING ERRCODE = 'P0001';
  END IF;

  v_next_interval := v_previous_interval;
  v_next_repetitions := v_previous_repetitions;
  v_next_ease := v_previous_ease;

  CASE v_rating
    WHEN 'again' THEN
      v_next_interval := 0;
      v_next_repetitions := 0;
      v_next_ease := greatest(1.30, v_previous_ease - 0.20);
      v_next_due_at := v_now + interval '10 minutes';
    WHEN 'hard' THEN
      IF v_previous_repetitions = 0 THEN
        v_next_interval := 0;
        v_next_repetitions := 0;
        v_next_due_at := v_now + interval '12 hours';
      ELSE
        v_next_interval := greatest(1, ceil(v_previous_interval * 1.20)::integer);
        v_next_repetitions := v_previous_repetitions + 1;
        v_next_ease := greatest(1.30, v_previous_ease - 0.15);
        v_next_due_at := v_now + make_interval(days => v_next_interval);
      END IF;
    WHEN 'good' THEN
      IF v_previous_repetitions = 0 THEN
        v_next_interval := 1;
      ELSIF v_previous_repetitions = 1 THEN
        v_next_interval := 3;
      ELSE
        v_next_interval := greatest(1, round(v_previous_interval * v_previous_ease)::integer);
      END IF;
      v_next_repetitions := v_previous_repetitions + 1;
      v_next_due_at := v_now + make_interval(days => v_next_interval);
    WHEN 'easy' THEN
      v_next_ease := least(3.00, v_previous_ease + 0.15);
      IF v_previous_repetitions = 0 THEN
        v_next_interval := 3;
      ELSE
        v_next_interval := greatest(1, round(v_previous_interval * v_next_ease * 1.30)::integer);
      END IF;
      v_next_repetitions := v_previous_repetitions + 1;
      v_next_due_at := v_now + make_interval(days => v_next_interval);
  END CASE;

  UPDATE public.flashcards
  SET
    due_at = v_next_due_at,
    last_reviewed_at = v_now,
    interval_days = v_next_interval,
    repetitions = v_next_repetitions,
    ease_factor = v_next_ease
  WHERE id = v_flashcard_id;

  INSERT INTO public.flashcard_reviews (
    user_id,
    flashcard_id,
    rating,
    previous_due_at,
    next_due_at,
    previous_interval_days,
    next_interval_days,
    reviewed_at
  )
  VALUES (
    v_user_id,
    v_flashcard_id,
    v_rating,
    v_previous_due_at,
    v_next_due_at,
    v_previous_interval,
    v_next_interval,
    v_now
  );

  RETURN QUERY
  SELECT
    v_flashcard_id,
    v_rating,
    v_now,
    v_next_due_at,
    v_next_interval,
    v_next_repetitions,
    v_next_ease;
END;
$$;

REVOKE ALL ON FUNCTION public.review_flashcard(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_flashcard(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_flashcard(uuid, text) TO authenticated;
