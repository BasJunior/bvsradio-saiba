-- BVS participation, notification and digest core.
-- First-release schema from the 2026-09-13 implementation pack.
-- Safe to rerun. Apply through the normal Supabase migration workflow only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Threads, messages and canonical content discussions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.participation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_type TEXT NOT NULL CHECK (thread_type IN ('post', 'content')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  intent TEXT CHECK (intent IS NULL OR intent IN ('update', 'question', 'collaboration')),
  object_kind TEXT CHECK (object_kind IS NULL OR object_kind IN ('track', 'release', 'beat')),
  object_id TEXT CHECK (object_id IS NULL OR char_length(object_id) BETWEEN 1 AND 240),
  object_title TEXT CHECK (object_title IS NULL OR char_length(object_title) <= 300),
  object_href TEXT CHECK (object_href IS NULL OR char_length(object_href) <= 700),
  object_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attachment_kind TEXT CHECK (attachment_kind IS NULL OR attachment_kind IN ('track', 'release', 'beat')),
  attachment_id TEXT CHECK (attachment_id IS NULL OR char_length(attachment_id) BETWEEN 1 AND 240),
  attachment_title TEXT CHECK (attachment_title IS NULL OR char_length(attachment_title) <= 300),
  attachment_href TEXT CHECK (attachment_href IS NULL OR char_length(attachment_href) <= 700),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'review', 'hidden', 'locked', 'deleted')),
  moderation_reason TEXT CHECK (moderation_reason IS NULL OR char_length(moderation_reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (
    (thread_type = 'post' AND author_user_id IS NOT NULL AND intent IS NOT NULL)
    OR (thread_type = 'content' AND object_kind IS NOT NULL AND object_id IS NOT NULL)
  ),
  CHECK (attachment_kind IS NULL OR (attachment_id IS NOT NULL AND attachment_title IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS participation_threads_content_unique_idx
  ON public.participation_threads(object_kind, object_id)
  WHERE thread_type = 'content' AND status <> 'deleted';
CREATE INDEX IF NOT EXISTS participation_threads_feed_idx
  ON public.participation_threads(created_at DESC, id DESC)
  WHERE thread_type = 'post' AND status = 'published';
CREATE INDEX IF NOT EXISTS participation_threads_author_idx
  ON public.participation_threads(author_user_id, created_at DESC)
  WHERE author_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.participation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.participation_threads(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_kind TEXT NOT NULL CHECK (message_kind IN ('root', 'reply')),
  reply_to_id UUID REFERENCES public.participation_messages(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'review', 'hidden', 'deleted')),
  client_key TEXT NOT NULL CHECK (char_length(client_key) BETWEEN 8 AND 160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CHECK ((message_kind = 'reply' AND reply_to_id IS NOT NULL AND char_length(body) <= 500) OR message_kind = 'root')
);

CREATE UNIQUE INDEX IF NOT EXISTS participation_messages_author_client_unique_idx
  ON public.participation_messages(author_user_id, client_key)
  WHERE author_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS participation_messages_one_root_idx
  ON public.participation_messages(thread_id)
  WHERE message_kind = 'root' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS participation_messages_thread_order_idx
  ON public.participation_messages(thread_id, created_at ASC, id ASC)
  WHERE status IN ('published', 'deleted');
CREATE INDEX IF NOT EXISTS participation_messages_author_idx
  ON public.participation_messages(author_user_id, created_at DESC)
  WHERE author_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.participation_mentions (
  message_id UUID NOT NULL REFERENCES public.participation_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, mentioned_user_id)
);
CREATE INDEX IF NOT EXISTS participation_mentions_user_idx
  ON public.participation_mentions(mentioned_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.participation_thread_subscriptions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.participation_threads(id) ON DELETE CASCADE,
  watch_all_replies BOOLEAN NOT NULL DEFAULT FALSE,
  muted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id)
);

CREATE TABLE IF NOT EXISTS public.participation_reactions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.participation_threads(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'repost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, thread_id, reaction)
);
CREATE INDEX IF NOT EXISTS participation_reactions_thread_idx
  ON public.participation_reactions(thread_id, reaction, created_at DESC);

-- ---------------------------------------------------------------------------
-- Community-rules agreement, blocks, reports and moderation audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.participation_rule_agreements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rules_version TEXT NOT NULL CHECK (char_length(rules_version) BETWEEN 1 AND 80),
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, rules_version)
);

CREATE TABLE IF NOT EXISTS public.participation_blocks (
  blocker_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);
CREATE INDEX IF NOT EXISTS participation_blocks_reverse_idx
  ON public.participation_blocks(blocked_user_id, blocker_user_id);

CREATE TABLE IF NOT EXISTS public.participation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.participation_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.participation_messages(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('harassment', 'spam', 'harmful_content', 'rights_concern', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  review_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (thread_id IS NOT NULL OR message_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS participation_reports_message_unique_idx
  ON public.participation_reports(reporter_user_id, message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS participation_reports_queue_idx
  ON public.participation_reports(status, created_at ASC);

CREATE TABLE IF NOT EXISTS public.participation_moderation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('hide', 'restore', 'lock', 'unlock', 'delete', 'resolve_report', 'dismiss_report')),
  thread_id UUID REFERENCES public.participation_threads(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.participation_messages(id) ON DELETE SET NULL,
  report_id UUID REFERENCES public.participation_reports(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS participation_moderation_audit_created_idx
  ON public.participation_moderation_audit(created_at DESC);

-- Atomic counters for concurrency-safe user/IP rate-limit windows.
CREATE TABLE IF NOT EXISTS public.participation_rate_limits (
  subject_key TEXT NOT NULL CHECK (char_length(subject_key) BETWEEN 1 AND 160),
  bucket TEXT NOT NULL CHECK (char_length(bucket) BETWEEN 1 AND 80),
  window_start TIMESTAMPTZ NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subject_key, bucket, window_start)
);

-- ---------------------------------------------------------------------------
-- Durable domain outbox, per-recipient inbox and channel delivery ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.participation_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE CHECK (char_length(source_key) BETWEEN 8 AND 220),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'post_created', 'message_replied', 'message_mentioned', 'thread_liked', 'thread_reposted',
    'creator_followed', 'thread_reported', 'thread_moderated', 'activation_nudge'
  )),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES public.participation_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.participation_messages(id) ON DELETE CASCADE,
  object_kind TEXT CHECK (object_kind IS NULL OR object_kind IN ('track', 'release', 'beat', 'creator', 'story', 'show', 'product', 'service')),
  object_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fanout_status TEXT NOT NULL DEFAULT 'pending' CHECK (fanout_status IN ('pending', 'processing', 'complete', 'failed')),
  fanout_checkpoint TEXT,
  processed_at TIMESTAMPTZ,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS participation_domain_events_pending_idx
  ON public.participation_domain_events(occurred_at ASC)
  WHERE fanout_status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS public.participation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.participation_domain_events(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('reply', 'mention', 'like', 'repost', 'follow', 'community', 'moderation')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  detail TEXT NOT NULL CHECK (char_length(detail) BETWEEN 1 AND 500),
  target_href TEXT NOT NULL CHECK (char_length(target_href) BETWEEN 1 AND 700),
  thread_id UUID REFERENCES public.participation_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.participation_messages(id) ON DELETE SET NULL,
  seen_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipient_user_id, event_id)
);
CREATE INDEX IF NOT EXISTS participation_notifications_inbox_idx
  ON public.participation_notifications(recipient_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS participation_notifications_unread_idx
  ON public.participation_notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.participation_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.participation_notifications(id) ON DELETE CASCADE,
  pulse_run_id UUID,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push', 'telegram', 'email')),
  destination_key TEXT NOT NULL CHECK (char_length(destination_key) BETWEEN 1 AND 300),
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
  app_identity TEXT,
  environment TEXT CHECK (environment IS NULL OR environment IN ('sandbox', 'production')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'suppressed', 'ambiguous', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_until TIMESTAMPTZ,
  provider_receipt TEXT,
  error_class TEXT,
  last_error TEXT,
  dedupe_key TEXT NOT NULL UNIQUE CHECK (char_length(dedupe_key) BETWEEN 8 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS participation_deliveries_queue_idx
  ON public.participation_deliveries(status, scheduled_at ASC)
  WHERE status IN ('queued', 'failed', 'ambiguous');

CREATE TABLE IF NOT EXISTS public.participation_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inbox_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  external_community_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  digest_time TIME NOT NULL DEFAULT TIME '18:00',
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) BETWEEN 1 AND 80),
  quiet_start TIME,
  quiet_end TIME,
  settings_version TEXT NOT NULL DEFAULT 'participation-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.participation_pulse_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('owner_pulse', 'user_digest')),
  recipient_key TEXT NOT NULL CHECK (char_length(recipient_key) BETWEEN 1 AND 180),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL CHECK (char_length(timezone) BETWEEN 1 AND 80),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'preview', 'sent', 'skipped', 'failed', 'ambiguous')),
  checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_receipt TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_type, recipient_key, local_date)
);
CREATE INDEX IF NOT EXISTS participation_pulse_runs_state_idx
  ON public.participation_pulse_runs(state, local_date DESC);

-- ---------------------------------------------------------------------------
-- Row-level security: public content is readable, mutations stay server-mediated.
-- ---------------------------------------------------------------------------

ALTER TABLE public.participation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_thread_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_rule_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_moderation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_pulse_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published participation threads" ON public.participation_threads;
CREATE POLICY "Public reads published participation threads" ON public.participation_threads
  FOR SELECT USING (status IN ('published', 'locked'));
DROP POLICY IF EXISTS "Public reads visible participation messages" ON public.participation_messages;
CREATE POLICY "Public reads visible participation messages" ON public.participation_messages
  FOR SELECT USING (status IN ('published', 'deleted'));
DROP POLICY IF EXISTS "Public reads participation reaction counts" ON public.participation_reactions;
CREATE POLICY "Public reads participation reaction counts" ON public.participation_reactions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users read own thread subscriptions" ON public.participation_thread_subscriptions;
CREATE POLICY "Users read own thread subscriptions" ON public.participation_thread_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own rule agreements" ON public.participation_rule_agreements;
CREATE POLICY "Users read own rule agreements" ON public.participation_rule_agreements
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own blocks" ON public.participation_blocks;
CREATE POLICY "Users read own blocks" ON public.participation_blocks
  FOR SELECT USING (auth.uid() = blocker_user_id);
DROP POLICY IF EXISTS "Users read own reports" ON public.participation_reports;
CREATE POLICY "Users read own reports" ON public.participation_reports
  FOR SELECT USING (auth.uid() = reporter_user_id);
DROP POLICY IF EXISTS "Users read own participation notifications" ON public.participation_notifications;
CREATE POLICY "Users read own participation notifications" ON public.participation_notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);
DROP POLICY IF EXISTS "Users read own participation preferences" ON public.participation_preferences;
CREATE POLICY "Users read own participation preferences" ON public.participation_preferences
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own digest runs" ON public.participation_pulse_runs;
CREATE POLICY "Users read own digest runs" ON public.participation_pulse_runs
  FOR SELECT USING (auth.uid() = recipient_user_id AND run_type = 'user_digest');

-- No direct client INSERT/UPDATE/DELETE policies are created for new participation
-- objects. Trusted bearer-auth API routes resolve the caller and public targets,
-- then use the service role. Recipient/read/preference mutations also remain narrow
-- server operations so clients cannot rewrite recipients or event payloads.

-- ---------------------------------------------------------------------------
-- Concurrency-safe rate limiting.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_participation_rate_limit(
  p_subject_key TEXT,
  p_bucket TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, used INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_used INTEGER;
BEGIN
  IF p_window_seconds < 1 OR p_limit < 1 OR char_length(p_subject_key) < 1 OR char_length(p_bucket) < 1 THEN
    RAISE EXCEPTION 'invalid rate limit input';
  END IF;
  v_window_start := to_timestamp(floor(extract(epoch FROM NOW()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.participation_rate_limits(subject_key, bucket, window_start, counter, updated_at)
  VALUES (p_subject_key, p_bucket, v_window_start, 1, NOW())
  ON CONFLICT (subject_key, bucket, window_start)
  DO UPDATE SET counter = public.participation_rate_limits.counter + 1, updated_at = NOW()
  RETURNING counter INTO v_used;
  RETURN QUERY SELECT
    v_used <= p_limit,
    v_used,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => p_window_seconds) - NOW())))::INTEGER);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_participation_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_participation_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic thread/message/outbox mutations. These are service-role only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_participation_post(
  p_actor UUID,
  p_intent TEXT,
  p_body TEXT,
  p_client_key TEXT,
  p_attachment_kind TEXT DEFAULT NULL,
  p_attachment_id TEXT DEFAULT NULL,
  p_attachment_title TEXT DEFAULT NULL,
  p_attachment_href TEXT DEFAULT NULL,
  p_mention_user_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (thread_id UUID, message_id UUID, event_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread UUID;
  v_message UUID;
  v_event UUID;
  v_created TIMESTAMPTZ;
  v_existing RECORD;
  v_mention UUID;
BEGIN
  IF p_intent NOT IN ('update', 'question', 'collaboration') THEN RAISE EXCEPTION 'invalid intent'; END IF;
  IF char_length(p_body) < 1 OR char_length(p_body) > 1000 THEN RAISE EXCEPTION 'invalid body'; END IF;
  IF COALESCE(array_length(p_mention_user_ids, 1), 0) > 5 THEN RAISE EXCEPTION 'too many mentions'; END IF;

  SELECT m.thread_id, m.id, m.created_at INTO v_existing
  FROM public.participation_messages m
  WHERE m.author_user_id = p_actor AND m.client_key = p_client_key
  LIMIT 1;
  IF FOUND THEN
    SELECT e.id INTO v_event FROM public.participation_domain_events e
    WHERE e.source_key = 'post:' || v_existing.id::TEXT LIMIT 1;
    RETURN QUERY SELECT v_existing.thread_id, v_existing.id, v_event, v_existing.created_at;
    RETURN;
  END IF;

  INSERT INTO public.participation_threads(
    thread_type, author_user_id, intent,
    attachment_kind, attachment_id, attachment_title, attachment_href,
    status, created_at, updated_at
  ) VALUES (
    'post', p_actor, p_intent,
    p_attachment_kind, p_attachment_id, p_attachment_title, p_attachment_href,
    'published', NOW(), NOW()
  ) RETURNING id INTO v_thread;

  INSERT INTO public.participation_messages(thread_id, author_user_id, message_kind, body, status, client_key)
  VALUES (v_thread, p_actor, 'root', p_body, 'published', p_client_key)
  RETURNING id, participation_messages.created_at INTO v_message, v_created;

  FOREACH v_mention IN ARRAY COALESCE(p_mention_user_ids, ARRAY[]::UUID[]) LOOP
    IF v_mention <> p_actor THEN
      INSERT INTO public.participation_mentions(message_id, mentioned_user_id)
      VALUES (v_message, v_mention) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO public.participation_domain_events(
    source_key, event_type, actor_user_id, thread_id, message_id, occurred_at,
    payload
  ) VALUES (
    'post:' || v_message::TEXT, 'post_created', p_actor, v_thread, v_message, v_created,
    jsonb_build_object('intent', p_intent)
  ) RETURNING id INTO v_event;

  RETURN QUERY SELECT v_thread, v_message, v_event, v_created;
EXCEPTION WHEN unique_violation THEN
  SELECT m.thread_id, m.id, m.created_at INTO v_existing
  FROM public.participation_messages m
  WHERE m.author_user_id = p_actor AND m.client_key = p_client_key LIMIT 1;
  SELECT e.id INTO v_event FROM public.participation_domain_events e
  WHERE e.source_key = 'post:' || v_existing.id::TEXT LIMIT 1;
  RETURN QUERY SELECT v_existing.thread_id, v_existing.id, v_event, v_existing.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.create_participation_post(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_participation_post(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]) TO service_role;

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
DECLARE v_thread UUID;
BEGIN
  IF p_object_kind NOT IN ('track', 'release', 'beat') THEN RAISE EXCEPTION 'invalid object kind'; END IF;
  SELECT id INTO v_thread FROM public.participation_threads
  WHERE thread_type = 'content' AND object_kind = p_object_kind AND object_id = p_object_id AND status <> 'deleted'
  LIMIT 1;
  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;
  INSERT INTO public.participation_threads(
    thread_type, object_kind, object_id, object_title, object_href, object_owner_user_id, status
  ) VALUES ('content', p_object_kind, p_object_id, p_object_title, p_object_href, p_object_owner, 'published')
  ON CONFLICT (object_kind, object_id) WHERE thread_type = 'content' AND status <> 'deleted'
  DO UPDATE SET object_title = EXCLUDED.object_title, object_href = EXCLUDED.object_href,
    object_owner_user_id = EXCLUDED.object_owner_user_id, updated_at = NOW()
  RETURNING id INTO v_thread;
  RETURN v_thread;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_participation_content_thread(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_participation_content_thread(TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

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
  v_existing RECORD;
  v_mention UUID;
BEGIN
  IF char_length(p_body) < 1 OR char_length(p_body) > 500 THEN RAISE EXCEPTION 'invalid body'; END IF;
  IF COALESCE(array_length(p_mention_user_ids, 1), 0) > 5 THEN RAISE EXCEPTION 'too many mentions'; END IF;
  PERFORM 1 FROM public.participation_threads WHERE id = p_thread AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'thread unavailable'; END IF;
  SELECT thread_id INTO v_parent_thread FROM public.participation_messages
  WHERE id = p_reply_to AND status IN ('published', 'deleted');
  IF v_parent_thread IS NULL OR v_parent_thread <> p_thread THEN RAISE EXCEPTION 'reply parent mismatch'; END IF;

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
  ) VALUES (p_thread, p_actor, 'reply', p_reply_to, p_body, 'published', p_client_key)
  RETURNING id, participation_messages.created_at INTO v_message, v_created;

  FOREACH v_mention IN ARRAY COALESCE(p_mention_user_ids, ARRAY[]::UUID[]) LOOP
    IF v_mention <> p_actor THEN
      INSERT INTO public.participation_mentions(message_id, mentioned_user_id)
      VALUES (v_message, v_mention) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO public.participation_domain_events(
    source_key, event_type, actor_user_id, thread_id, message_id, occurred_at,
    payload
  ) VALUES (
    'reply:' || v_message::TEXT, 'message_replied', p_actor, p_thread, v_message, v_created,
    jsonb_build_object('reply_to_id', p_reply_to)
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

-- Summaries used by feed cards and content Discussion entry points.
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
    (SELECT COUNT(*) FROM public.participation_messages m WHERE m.thread_id = t.id AND m.message_kind = 'reply' AND m.status = 'published'),
    EXISTS (SELECT 1 FROM public.participation_reactions r WHERE r.thread_id = t.id AND r.reaction = 'like' AND r.user_id = p_viewer),
    EXISTS (SELECT 1 FROM public.participation_reactions r WHERE r.thread_id = t.id AND r.reaction = 'repost' AND r.user_id = p_viewer)
  FROM public.participation_threads t
  WHERE t.id = ANY(p_thread_ids) AND t.status IN ('published', 'locked');
$$;
REVOKE ALL ON FUNCTION public.participation_thread_summary(UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.participation_thread_summary(UUID[], UUID) TO anon, authenticated, service_role;

COMMENT ON TABLE public.participation_threads IS
  'Canonical BVS public conversation threads. Content threads are unique per eligible public object.';
COMMENT ON TABLE public.participation_domain_events IS
  'Immutable durable outbox events. Network delivery is never performed inside the content transaction.';
COMMENT ON TABLE public.participation_notifications IS
  'Durable account-specific inbox state; replaces unscoped browser-only seen timestamps for participation events.';
