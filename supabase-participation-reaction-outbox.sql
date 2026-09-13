-- Durable participation reaction state + outbox event.
-- Apply after supabase-participation.sql through the normal migration workflow.

CREATE OR REPLACE FUNCTION public.set_participation_reaction(
  p_actor UUID,
  p_thread UUID,
  p_reaction TEXT,
  p_active BOOLEAN
)
RETURNS TABLE (active BOOLEAN, event_id UUID, changed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed BOOLEAN := FALSE;
  v_event UUID := NULL;
  v_event_type TEXT;
  v_rows INTEGER := 0;
BEGIN
  IF p_actor IS NULL OR p_thread IS NULL THEN
    RAISE EXCEPTION 'actor and thread are required';
  END IF;
  IF p_reaction NOT IN ('like', 'repost') THEN
    RAISE EXCEPTION 'invalid reaction';
  END IF;

  PERFORM 1
  FROM public.participation_threads
  WHERE id = p_thread AND status IN ('published', 'locked');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'thread unavailable';
  END IF;

  IF p_active THEN
    INSERT INTO public.participation_reactions(user_id, thread_id, reaction, created_at)
    VALUES (p_actor, p_thread, p_reaction, NOW())
    ON CONFLICT (user_id, thread_id, reaction) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_changed := v_rows > 0;

    IF v_changed THEN
      v_event_type := CASE WHEN p_reaction = 'like' THEN 'thread_liked' ELSE 'thread_reposted' END;
      INSERT INTO public.participation_domain_events(
        source_key, event_type, actor_user_id, thread_id, occurred_at, payload
      ) VALUES (
        'reaction:' || gen_random_uuid()::TEXT,
        v_event_type,
        p_actor,
        p_thread,
        NOW(),
        jsonb_build_object('reaction', p_reaction)
      ) RETURNING id INTO v_event;
    END IF;
  ELSE
    DELETE FROM public.participation_reactions
    WHERE user_id = p_actor AND thread_id = p_thread AND reaction = p_reaction;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_changed := v_rows > 0;
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.participation_reactions
      WHERE user_id = p_actor AND thread_id = p_thread AND reaction = p_reaction
    ),
    v_event,
    v_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.set_participation_reaction(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_participation_reaction(UUID, UUID, TEXT, BOOLEAN) TO service_role;
