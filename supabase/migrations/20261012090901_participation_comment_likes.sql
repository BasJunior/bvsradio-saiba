-- Comment reactions are independent of post reactions. All access stays behind
-- the existing server-side participation visibility and identity checks.
CREATE TABLE public.participation_message_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.participation_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);
CREATE INDEX participation_message_likes_message_idx
  ON public.participation_message_likes(message_id, user_id);
ALTER TABLE public.participation_message_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.participation_message_likes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.participation_message_likes TO service_role;
COMMENT ON TABLE public.participation_message_likes IS
  'Server-mediated comment likes. RLS has no client policies; only aggregate counts and the viewer state are exposed by the BVS API.';

CREATE FUNCTION public.participation_message_like_summary(p_message_ids UUID[], p_viewer UUID DEFAULT NULL)
RETURNS TABLE(message_id UUID, like_count BIGINT, viewer_liked BOOLEAN)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT m.id, COUNT(l.user_id), COALESCE(BOOL_OR(l.user_id = p_viewer), FALSE)
  FROM public.participation_messages m
  JOIN public.participation_threads t ON t.id = m.thread_id
  LEFT JOIN public.participation_message_likes l ON l.message_id = m.id
  WHERE m.id = ANY(p_message_ids) AND m.status = 'published'
    AND m.message_kind IN ('comment', 'reply') AND t.status IN ('published', 'locked')
  GROUP BY m.id;
$$;

CREATE FUNCTION public.set_participation_message_like(p_actor UUID, p_thread UUID, p_message UUID, p_active BOOLEAN)
RETURNS TABLE(message_id UUID, like_count BIGINT, viewer_liked BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_author UUID;
  v_owner UUID;
BEGIN
  IF p_actor IS NULL OR p_active IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_actor AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until <= NOW())
  ) THEN RETURN; END IF;

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

REVOKE ALL ON FUNCTION public.participation_message_like_summary(UUID[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_participation_message_like(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.participation_message_like_summary(UUID[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_participation_message_like(UUID, UUID, UUID, BOOLEAN) TO service_role;
NOTIFY pgrst, 'reload schema';
