-- Runtime RPCs layered on supabase-participation.sql.
-- Apply after the core participation migration.

-- Content discussions have top-level comments without a synthetic root post.
ALTER TABLE public.participation_messages
  DROP CONSTRAINT IF EXISTS participation_messages_message_kind_check;
ALTER TABLE public.participation_messages
  ADD CONSTRAINT participation_messages_message_kind_check
  CHECK (message_kind IN ('root', 'comment', 'reply'));
ALTER TABLE public.participation_messages
  DROP CONSTRAINT IF EXISTS participation_messages_check;
ALTER TABLE public.participation_messages
  ADD CONSTRAINT participation_messages_length_and_parent_check
  CHECK (
    (message_kind = 'root' AND reply_to_id IS NULL AND char_length(body) <= 1000)
    OR (message_kind = 'comment' AND reply_to_id IS NULL AND char_length(body) <= 500)
    OR (message_kind = 'reply' AND reply_to_id IS NOT NULL AND char_length(body) <= 500)
  );

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

-- Override the core reply mutation so content discussions can create a top-level
-- comment (reply_to = null) without inventing a fake post root.
CREATE OR REPLACE FUNCTION public.create_participation_reply(
  p_actor UUID,
  p_thread UUID,
  p_reply_to UUID,
  p_body TEXT,
  p_client_key TEXT,
  p_mention_user_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (message_id UUID, event_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message UUID;
  v_event UUID;
  v_created TIMESTAMPTZ;
  v_parent_thread UUID;
  v_thread_type TEXT;
  v_kind TEXT;
  v_existing RECORD;
  v_mention UUID;
BEGIN
  IF char_length(p_body) < 1 OR char_length(p_body) > 500 THEN RAISE EXCEPTION 'invalid body'; END IF;
  IF COALESCE(array_length(p_mention_user_ids, 1), 0) > 5 THEN RAISE EXCEPTION 'too many mentions'; END IF;
  SELECT thread_type INTO v_thread_type FROM public.participation_threads WHERE id = p_thread AND status = 'published';
  IF v_thread_type IS NULL THEN RAISE EXCEPTION 'thread unavailable'; END IF;

  IF p_reply_to IS NULL THEN
    IF v_thread_type <> 'content' THEN RAISE EXCEPTION 'post replies require a parent'; END IF;
    v_kind := 'comment';
  ELSE
    SELECT thread_id INTO v_parent_thread FROM public.participation_messages
    WHERE id = p_reply_to AND status IN ('published', 'deleted');
    IF v_parent_thread IS NULL OR v_parent_thread <> p_thread THEN RAISE EXCEPTION 'reply parent mismatch'; END IF;
    v_kind := 'reply';
  END IF;

  SELECT m.id, m.created_at INTO v_existing
  FROM public.participation_messages m
  WHERE m.author_user_id = p_actor AND m.client_key = p_client_key LIMIT 1;
  IF FOUND THEN
    SELECT e.id INTO v_event FROM public.participation_domain_events e
    WHERE e.source_key = 'reply:' || v_existing.id::TEXT LIMIT 1;
    RETURN QUERY SELECT v_existing.id, v_event, v_existing.created_at;
    RETURN;
  END IF;

  INSERT INTO public.participation_messages(
    thread_id, author_user_id, message_kind, reply_to_id, body, status, client_key
  ) VALUES (p_thread, p_actor, v_kind, p_reply_to, p_body, 'published', p_client_key)
  RETURNING id, participation_messages.created_at INTO v_message, v_created;

  FOREACH v_mention IN ARRAY COALESCE(p_mention_user_ids, ARRAY[]::UUID[]) LOOP
    IF v_mention <> p_actor THEN
      INSERT INTO public.participation_mentions(message_id, mentioned_user_id)
      VALUES (v_message, v_mention) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO public.participation_domain_events(
    source_key, event_type, actor_user_id, thread_id, message_id, occurred_at, payload
  ) VALUES (
    'reply:' || v_message::TEXT, 'message_replied', p_actor, p_thread, v_message, v_created,
    jsonb_build_object('reply_to_id', p_reply_to, 'message_kind', v_kind)
  ) RETURNING id INTO v_event;

  RETURN QUERY SELECT v_message, v_event, v_created;
EXCEPTION WHEN unique_violation THEN
  SELECT m.id, m.created_at INTO v_existing
  FROM public.participation_messages m
  WHERE m.author_user_id = p_actor AND m.client_key = p_client_key LIMIT 1;
  SELECT e.id INTO v_event FROM public.participation_domain_events e
  WHERE e.source_key = 'reply:' || v_existing.id::TEXT LIMIT 1;
  RETURN QUERY SELECT v_existing.id, v_event, v_existing.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.create_participation_reply(UUID, UUID, UUID, TEXT, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_participation_reply(UUID, UUID, UUID, TEXT, TEXT, UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.participation_thread_summary(
  p_thread_ids UUID[],
  p_viewer UUID DEFAULT NULL
)
RETURNS TABLE (
  thread_id UUID,
  like_count BIGINT,
  repost_count BIGINT,
  reply_count BIGINT,
  viewer_liked BOOLEAN,
  viewer_reposted BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    (SELECT COUNT(*) FROM public.participation_reactions r WHERE r.thread_id = t.id AND r.reaction = 'like'),
    (SELECT COUNT(*) FROM public.participation_reactions r WHERE r.thread_id = t.id AND r.reaction = 'repost'),
    (SELECT COUNT(*) FROM public.participation_messages m WHERE m.thread_id = t.id AND m.message_kind IN ('comment', 'reply') AND m.status = 'published'),
    EXISTS (SELECT 1 FROM public.participation_reactions r WHERE r.thread_id = t.id AND r.reaction = 'like' AND r.user_id = p_viewer),
    EXISTS (SELECT 1 FROM public.participation_reactions r WHERE r.thread_id = t.id AND r.reaction = 'repost' AND r.user_id = p_viewer)
  FROM public.participation_threads t
  WHERE t.id = ANY(p_thread_ids) AND t.status IN ('published', 'locked');
$$;
REVOKE ALL ON FUNCTION public.participation_thread_summary(UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.participation_thread_summary(UUID[], UUID) TO anon, authenticated, service_role;

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
