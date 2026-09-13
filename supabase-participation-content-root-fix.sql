-- BVS participation follow-up: every content discussion needs one synthetic root
-- so first-level comments can use the same reply transaction as post threads.
-- Apply after supabase-participation.sql through the normal migration workflow.

CREATE OR REPLACE FUNCTION public.ensure_participation_content_thread(
  p_object_kind TEXT,
  p_object_id TEXT,
  p_object_title TEXT,
  p_object_href TEXT,
  p_object_owner UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread UUID;
  v_root UUID;
BEGIN
  IF p_object_kind NOT IN ('track', 'release', 'beat') THEN
    RAISE EXCEPTION 'invalid object kind';
  END IF;

  SELECT id INTO v_thread
  FROM public.participation_threads
  WHERE thread_type = 'content'
    AND object_kind = p_object_kind
    AND object_id = p_object_id
    AND status <> 'deleted'
  LIMIT 1;

  IF v_thread IS NULL THEN
    INSERT INTO public.participation_threads(
      thread_type, object_kind, object_id, object_title, object_href,
      object_owner_user_id, status, created_at, updated_at
    ) VALUES (
      'content', p_object_kind, p_object_id, p_object_title, p_object_href,
      p_object_owner, 'published', NOW(), NOW()
    )
    ON CONFLICT (object_kind, object_id)
      WHERE thread_type = 'content' AND status <> 'deleted'
    DO UPDATE SET
      object_title = EXCLUDED.object_title,
      object_href = EXCLUDED.object_href,
      object_owner_user_id = EXCLUDED.object_owner_user_id,
      updated_at = NOW()
    RETURNING id INTO v_thread;
  ELSE
    UPDATE public.participation_threads
    SET object_title = p_object_title,
        object_href = p_object_href,
        object_owner_user_id = p_object_owner,
        updated_at = NOW()
    WHERE id = v_thread;
  END IF;

  SELECT id INTO v_root
  FROM public.participation_messages
  WHERE thread_id = v_thread
    AND message_kind = 'root'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_root IS NULL THEN
    INSERT INTO public.participation_messages(
      thread_id, author_user_id, message_kind, reply_to_id, body,
      status, client_key, created_at, updated_at
    ) VALUES (
      v_thread, NULL, 'root', NULL,
      LEFT('Discussion: ' || COALESCE(NULLIF(TRIM(p_object_title), ''), 'BVS content'), 1000),
      'published', 'content-root:' || v_thread::TEXT, NOW(), NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_participation_content_thread(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_participation_content_thread(TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
