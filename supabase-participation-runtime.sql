-- Runtime RPCs layered on supabase-participation.sql.
-- Apply after the core participation migration.

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
  v_owner UUID;
  v_created TIMESTAMPTZ;
  v_inserted INTEGER := 0;
  v_deleted INTEGER := 0;
  v_event UUID;
  v_event_type TEXT;
  v_source TEXT;
BEGIN
  IF p_reaction NOT IN ('like', 'repost') THEN RAISE EXCEPTION 'invalid reaction'; END IF;
  SELECT COALESCE(author_user_id, object_owner_user_id) INTO v_owner
  FROM public.participation_threads
  WHERE id = p_thread AND status IN ('published', 'locked');
  IF NOT FOUND THEN RAISE EXCEPTION 'thread unavailable'; END IF;

  IF p_active THEN
    INSERT INTO public.participation_reactions(user_id, thread_id, reaction, created_at)
    VALUES (p_actor, p_thread, p_reaction, NOW())
    ON CONFLICT (user_id, thread_id, reaction) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    SELECT created_at INTO v_created FROM public.participation_reactions
    WHERE user_id = p_actor AND thread_id = p_thread AND reaction = p_reaction;
    IF v_inserted > 0 THEN
      v_event_type := CASE WHEN p_reaction = 'like' THEN 'thread_liked' ELSE 'thread_reposted' END;
      v_source := 'reaction:' || p_reaction || ':' || p_actor::TEXT || ':' || p_thread::TEXT || ':' || floor(extract(epoch FROM v_created) * 1000)::BIGINT::TEXT;
      INSERT INTO public.participation_domain_events(
        source_key, event_type, actor_user_id, thread_id, occurred_at, payload
      ) VALUES (
        v_source, v_event_type, p_actor, p_thread, v_created,
        jsonb_build_object('reaction', p_reaction, 'owner_user_id', v_owner)
      ) RETURNING id INTO v_event;
    END IF;
    RETURN QUERY SELECT TRUE, v_event, v_inserted > 0;
    RETURN;
  END IF;

  DELETE FROM public.participation_reactions
  WHERE user_id = p_actor AND thread_id = p_thread AND reaction = p_reaction;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN QUERY SELECT FALSE, NULL::UUID, v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_participation_reaction(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_participation_reaction(UUID, UUID, TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_participation_notifications_read(
  p_recipient UUID,
  p_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_cutoff TIMESTAMPTZ DEFAULT NULL,
  p_mark_read BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  IF COALESCE(array_length(p_ids, 1), 0) > 0 THEN
    UPDATE public.participation_notifications
    SET seen_at = COALESCE(seen_at, NOW()),
        read_at = CASE WHEN p_mark_read THEN COALESCE(read_at, NOW()) ELSE read_at END
    WHERE recipient_user_id = p_recipient AND id = ANY(p_ids);
  ELSIF p_cutoff IS NOT NULL THEN
    UPDATE public.participation_notifications
    SET seen_at = COALESCE(seen_at, NOW()),
        read_at = CASE WHEN p_mark_read THEN COALESCE(read_at, NOW()) ELSE read_at END
    WHERE recipient_user_id = p_recipient AND created_at <= p_cutoff;
  ELSE
    RETURN 0;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_participation_notifications_read(UUID, UUID[], TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_participation_notifications_read(UUID, UUID[], TIMESTAMPTZ, BOOLEAN) TO service_role;
