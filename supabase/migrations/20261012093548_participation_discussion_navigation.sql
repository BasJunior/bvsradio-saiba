CREATE FUNCTION public.participation_discussion_page(p_thread UUID, p_viewer UUID DEFAULT NULL, p_sort TEXT DEFAULT 'oldest', p_limit INTEGER DEFAULT 40, p_cursor JSONB DEFAULT NULL, p_focus UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
WITH RECURSIVE visible AS (
  SELECT m.*, (SELECT COUNT(*) FROM public.participation_message_likes l WHERE l.message_id=m.id) AS like_count,
    EXISTS(SELECT 1 FROM public.participation_message_likes l WHERE l.message_id=m.id AND l.user_id=p_viewer) AS viewer_liked
  FROM public.participation_messages m
  WHERE m.thread_id=p_thread AND m.status IN ('published','deleted')
    AND NOT EXISTS(SELECT 1 FROM public.participation_blocks b WHERE
      (b.blocker_user_id=p_viewer AND b.blocked_user_id=m.author_user_id) OR
      (b.blocked_user_id=p_viewer AND b.blocker_user_id=m.author_user_id))
), ordered AS (
  SELECT v.* FROM visible v WHERE v.message_kind <> 'root' AND (
    p_cursor IS NULL OR CASE WHEN p_sort='oldest' THEN (v.created_at,v.id)>((p_cursor->>'at')::TIMESTAMPTZ,(p_cursor->>'id')::UUID)
      WHEN p_sort='top' THEN v.like_count<(p_cursor->>'likes')::BIGINT OR (v.like_count=(p_cursor->>'likes')::BIGINT AND (v.created_at,v.id)<((p_cursor->>'at')::TIMESTAMPTZ,(p_cursor->>'id')::UUID))
      ELSE (v.created_at,v.id)<((p_cursor->>'at')::TIMESTAMPTZ,(p_cursor->>'id')::UUID) END)
  ORDER BY CASE WHEN p_sort='top' THEN v.like_count END DESC,
    CASE WHEN p_sort='oldest' THEN v.created_at END ASC,
    CASE WHEN p_sort<>'oldest' THEN v.created_at END DESC,
    CASE WHEN p_sort='oldest' THEN v.id END ASC,
    CASE WHEN p_sort<>'oldest' THEN v.id END DESC
  LIMIT LEAST(100,GREATEST(1,p_limit))+1
), page AS (
  SELECT * FROM ordered LIMIT LEAST(100,GREATEST(1,p_limit))
), focus_chain AS (
  SELECT v.id,v.reply_to_id,ARRAY[v.id] AS visited FROM visible v WHERE v.id=p_focus
  UNION ALL SELECT v.id,v.reply_to_id,f.visited||v.id FROM visible v JOIN focus_chain f ON v.id=f.reply_to_id
    WHERE NOT v.id=ANY(f.visited) AND cardinality(f.visited)<32
), selected AS (
  SELECT id FROM page UNION SELECT id FROM visible WHERE message_kind='root' UNION SELECT id FROM focus_chain
), last_item AS (
  SELECT * FROM page ORDER BY CASE WHEN p_sort='top' THEN like_count END ASC,
    CASE WHEN p_sort='oldest' THEN created_at END DESC,
    CASE WHEN p_sort<>'oldest' THEN created_at END ASC,
    CASE WHEN p_sort='oldest' THEN id END DESC,
    CASE WHEN p_sort<>'oldest' THEN id END ASC LIMIT 1
)
SELECT jsonb_build_object('messages',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY
    CASE WHEN v.message_kind='root' THEN 0 ELSE 1 END,
    CASE WHEN p_sort='top' THEN v.like_count END DESC,
    CASE WHEN p_sort='oldest' THEN v.created_at END ASC,
    CASE WHEN p_sort<>'oldest' THEN v.created_at END DESC,v.id)
  FROM visible v JOIN selected s ON s.id=v.id),'[]'::JSONB),
  'next_cursor',CASE WHEN (SELECT COUNT(*) FROM ordered)>LEAST(100,GREATEST(1,p_limit)) THEN
    (SELECT jsonb_build_object('at',created_at,'id',id,'likes',like_count) FROM last_item) ELSE NULL END);
$$;
REVOKE ALL ON FUNCTION public.participation_discussion_page(UUID,UUID,TEXT,INTEGER,JSONB,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.participation_discussion_page(UUID,UUID,TEXT,INTEGER,JSONB,UUID) TO service_role;

ALTER TABLE public.participation_domain_events DROP CONSTRAINT participation_domain_events_event_type_check;
ALTER TABLE public.participation_domain_events ADD CONSTRAINT participation_domain_events_event_type_check CHECK(event_type IN (
  'post_created','message_replied','message_mentioned','thread_liked','thread_reposted','creator_followed','thread_reported','thread_moderated','activation_nudge','message_liked'));
ALTER TABLE public.participation_notifications ADD COLUMN group_key TEXT UNIQUE;

-- The application verifies identity; this trusted RPC also checks live target,
-- blocks and serializes mutations before creating an idempotent outbox event.
CREATE OR REPLACE FUNCTION public.set_participation_message_like(p_actor UUID,p_thread UUID,p_message UUID,p_active BOOLEAN)
RETURNS TABLE(message_id UUID,like_count BIGINT,viewer_liked BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_author UUID; v_owner UUID; v_changed INTEGER;
BEGIN
  IF p_actor IS NULL OR p_active IS NULL THEN RETURN; END IF;
  SELECT m.author_user_id,CASE WHEN t.thread_type='post' THEN t.author_user_id ELSE t.object_owner_user_id END
    INTO v_author,v_owner FROM public.participation_messages m JOIN public.participation_threads t ON t.id=m.thread_id
    WHERE m.id=p_message AND m.thread_id=p_thread AND m.status='published' AND m.message_kind IN ('comment','reply') AND t.status IN ('published','locked') FOR SHARE OF m,t;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.participation_blocks b WHERE
    (b.blocker_user_id=p_actor AND b.blocked_user_id IN(v_author,v_owner)) OR
    (b.blocked_user_id=p_actor AND b.blocker_user_id IN(v_author,v_owner))) THEN RETURN; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::TEXT||':'||p_message::TEXT,0));
  IF p_active THEN
    INSERT INTO public.participation_message_likes(user_id,message_id) VALUES(p_actor,p_message)
      ON CONFLICT ON CONSTRAINT participation_message_likes_pkey DO NOTHING;
    GET DIAGNOSTICS v_changed=ROW_COUNT;
    IF v_changed=1 AND v_author IS NOT NULL AND v_author<>p_actor THEN
      INSERT INTO public.participation_domain_events(source_key,event_type,actor_user_id,thread_id,message_id,payload)
        VALUES('comment-like:'||gen_random_uuid()::TEXT,'message_liked',p_actor,p_thread,p_message,jsonb_build_object('owner_user_id',v_author));
    END IF;
  ELSE
    DELETE FROM public.participation_message_likes l WHERE l.user_id=p_actor AND l.message_id=p_message;
  END IF;
  RETURN QUERY SELECT s.message_id,s.like_count,s.viewer_liked FROM public.participation_message_like_summary(ARRAY[p_message],p_actor) s;
END;
$$;

CREATE FUNCTION public.group_participation_comment_like(p_event UUID,p_actor_name TEXT)
RETURNS SETOF public.participation_notifications LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.participation_domain_events; m public.participation_messages; v_owner UUID; v_count BIGINT; v_key TEXT; v_start TIMESTAMPTZ; v_title TEXT;
BEGIN
  SELECT * INTO e FROM public.participation_domain_events WHERE id=p_event AND event_type='message_liked';
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO m FROM public.participation_messages WHERE id=e.message_id AND thread_id=e.thread_id AND status='published';
  IF NOT FOUND OR m.author_user_id IS NULL OR m.author_user_id=e.actor_user_id THEN RETURN; END IF;
  v_owner=m.author_user_id;
  IF NOT EXISTS(SELECT 1 FROM public.participation_message_likes l WHERE l.message_id=m.id AND l.user_id=e.actor_user_id)
    OR EXISTS(SELECT 1 FROM public.participation_blocks b WHERE
      (b.blocker_user_id=v_owner AND b.blocked_user_id=e.actor_user_id) OR (b.blocked_user_id=v_owner AND b.blocker_user_id=e.actor_user_id))
    OR EXISTS(SELECT 1 FROM public.participation_thread_subscriptions s WHERE s.user_id=v_owner AND s.thread_id=e.thread_id AND s.muted_at IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.participation_preferences p WHERE p.user_id=v_owner AND NOT p.inbox_enabled)
    OR NOT EXISTS(SELECT 1 FROM public.participation_threads t WHERE t.id=e.thread_id AND t.status IN('published','locked')) THEN RETURN; END IF;
  v_start=date_trunc('hour',e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_key='comment-like:'||v_owner::TEXT||':'||m.id::TEXT||':'||extract(epoch FROM v_start)::BIGINT::TEXT;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
  SELECT COUNT(*) INTO v_count FROM public.participation_message_likes l WHERE l.message_id=m.id AND l.user_id<>v_owner
    AND l.created_at>=v_start AND l.created_at<v_start+INTERVAL '1 hour'
    AND NOT EXISTS(SELECT 1 FROM public.participation_blocks b WHERE
      (b.blocker_user_id=v_owner AND b.blocked_user_id=l.user_id) OR (b.blocked_user_id=v_owner AND b.blocker_user_id=l.user_id));
  IF v_count=0 THEN RETURN; END IF;
  v_title=CASE WHEN v_count=1 THEN LEFT(p_actor_name,100)||' liked your comment' ELSE v_count::TEXT||' people liked your comment' END;
  INSERT INTO public.participation_notifications AS n(recipient_user_id,event_id,category,title,detail,target_href,thread_id,message_id,created_at,group_key)
    VALUES(v_owner,e.id,'like',v_title,LEFT(m.body,220),'/participation/thread/'||e.thread_id::TEXT||'#reply-'||m.id::TEXT,e.thread_id,m.id,e.occurred_at,v_key)
    ON CONFLICT(group_key) DO UPDATE SET title=EXCLUDED.title,detail=EXCLUDED.detail,event_id=EXCLUDED.event_id,
      created_at=GREATEST(n.created_at,EXCLUDED.created_at),seen_at=NULL,read_at=NULL
      WHERE n.event_id<>EXCLUDED.event_id;
  RETURN QUERY SELECT * FROM public.participation_notifications WHERE group_key=v_key;
END;
$$;
REVOKE ALL ON FUNCTION public.group_participation_comment_like(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.group_participation_comment_like(UUID,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
