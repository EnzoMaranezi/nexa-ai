CREATE TABLE IF NOT EXISTS public.ai_generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  kind text NOT NULL CHECK (kind IN ('summary', 'questions', 'practice_questions')),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed')),
  reserved_until timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS ai_generation_events_user_day_count_idx
ON public.ai_generation_events(user_id, usage_date, status, reserved_until);

CREATE INDEX IF NOT EXISTS ai_generation_events_user_day_created_idx
ON public.ai_generation_events(user_id, usage_date, created_at DESC);

ALTER TABLE public.ai_generation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_generation_events FROM anon;
REVOKE ALL ON public.ai_generation_events FROM authenticated;
GRANT ALL ON public.ai_generation_events TO service_role;

DROP POLICY IF EXISTS "Users can read their own AI generation events" ON public.ai_generation_events;

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

  IF p_kind NOT IN ('summary', 'questions', 'practice_questions') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_GENERATION_KIND' USING ERRCODE = '22023';
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

CREATE OR REPLACE FUNCTION public.finish_ai_generation(
  p_reservation_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF p_status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'UNSUPPORTED_AI_GENERATION_STATUS' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_generation_events
  SET
    status = p_status,
    completed_at = now()
  WHERE id = p_reservation_id
    AND user_id = v_user_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'AI_GENERATION_RESERVATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_generation_usage_today()
RETURNS TABLE(used_count integer, limit_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_usage_date date := ((now() AT TIME ZONE 'UTC')::date);
  v_limit integer := 20;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::integer AS used_count,
    v_limit AS limit_count
  FROM public.ai_generation_events
  WHERE user_id = v_user_id
    AND usage_date = v_usage_date
    AND (
      status = 'succeeded'
      OR (status = 'reserved' AND reserved_until > now())
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_ai_generation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ai_generation_usage_today() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_ai_generation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_generation_usage_today() TO authenticated;
