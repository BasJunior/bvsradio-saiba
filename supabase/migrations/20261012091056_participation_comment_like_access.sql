-- Keep identity verification in the authenticated API boundary.
CREATE OR REPLACE FUNCTION public.set_participation_message_like(p_actor UUID, p_thread UUID, p_message UUID, p_active BOOLEAN)
RETURNS TABLE(message_id UUID, like_count BIGINT, viewer_liked BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_author UUID;
  v_owner UUID;
BEGIN
  -- The BVS API validates the actor's token, confirmation and ban status.
  -- Only service_role can execute this RPC; it has no direct auth.users access.
  IF p_actor IS NULL OR p_active IS NULL THEN RETURN; END IF;

  SELECT m.author_user_id,
    CASE WHEN t.thread_type = 'post' THEN t.author_user_id ELSE t.object_owner_user_id END
  INTO v_author, v_owner
  FROM public.participation_messages m
  JOIN public.participation_threads t ON t.id = m.thread_id
  WHERE m.id = p_message AND m.thread_id = p_thread AND m.status = 'published'
    AND m.message_kind IN ('comment', 'reply') AND t.status IN ('published', 'locked')
  FOR SHARE OF m, t;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.participation_blocks b
    WHERE (b.blocker_user_id = p_actor AND b.blocked_user_id IN (v_author, v_owner))
       OR (b.blocked_user_id = p_actor AND b.blocker_user_id IN (v_author, v_owner))
  ) THEN RETURN; END IF;

  -- Explicit desired state makes retries safe. Serialize opposite states from
  -- the same viewer so concurrent like/unlike requests cannot create duplicates.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::TEXT || ':' || p_message::TEXT, 0));
  IF p_active THEN
    INSERT INTO public.participation_message_likes(user_id, message_id)
    VALUES (p_actor, p_message) ON CONFLICT (user_id, message_id) DO NOTHING;
  ELSE
    DELETE FROM public.participation_message_likes l WHERE l.user_id = p_actor AND l.message_id = p_message;
  END IF;
  RETURN QUERY SELECT s.message_id, s.like_count, s.viewer_liked
    FROM public.participation_message_like_summary(ARRAY[p_message], p_actor) s;
END;
$$;

NOTIFY pgrst, 'reload schema';
