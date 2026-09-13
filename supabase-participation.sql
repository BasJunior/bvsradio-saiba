-- BVS participation layer: likes, reposts, comments/replies, mentions and daily pulse.
-- Safe to rerun in the Supabase SQL Editor.
-- Writes are intentionally server-mediated: clients can read public participation
-- and their own preference/read state, while trusted API routes resolve target
-- ownership before creating engagement events.

CREATE TABLE IF NOT EXISTS public.participation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'repost', 'comment', 'reply', 'follow', 'mention')),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('track', 'release', 'creator', 'beat', 'story', 'show', 'product', 'service')),
  target_id TEXT NOT NULL CHECK (char_length(target_id) BETWEEN 1 AND 240),
  target_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_title TEXT NOT NULL CHECK (char_length(target_title) BETWEEN 1 AND 300),
  target_href TEXT CHECK (target_href IS NULL OR char_length(target_href) <= 700),
  parent_event_id UUID REFERENCES public.participation_events(id) ON DELETE SET NULL,
  body TEXT CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 1000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT CHECK (dedupe_key IS NULL OR char_length(dedupe_key) <= 700),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (
    (kind IN ('comment', 'reply', 'mention') AND body IS NOT NULL)
    OR (kind IN ('like', 'repost', 'follow') AND body IS NULL)
  ),
  CHECK ((kind = 'reply' AND parent_event_id IS NOT NULL) OR kind <> 'reply')
);

CREATE UNIQUE INDEX IF NOT EXISTS participation_events_active_dedupe_idx
  ON public.participation_events(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS participation_events_target_idx
  ON public.participation_events(target_kind, target_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS participation_events_owner_idx
  ON public.participation_events(target_owner_user_id, created_at DESC)
  WHERE target_owner_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS participation_events_actor_idx
  ON public.participation_events(actor_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS participation_events_parent_idx
  ON public.participation_events(parent_event_id, created_at ASC)
  WHERE parent_event_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.participation_notification_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.participation_events(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS public.participation_daily_pulse_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) BETWEEN 1 AND 80),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.participation_daily_pulse_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pulse_date DATE NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  push_sent BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pulse_date)
);

ALTER TABLE public.participation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_daily_pulse_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_daily_pulse_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads visible participation" ON public.participation_events;
CREATE POLICY "Public reads visible participation" ON public.participation_events
  FOR SELECT USING (deleted_at IS NULL);

-- Participation writes intentionally have no client-side INSERT/UPDATE/DELETE policy.
-- The trusted app API verifies the bearer token, resolves the public target and its
-- owner on the server, and performs the write with the service role.

DROP POLICY IF EXISTS "Users read own participation notification state" ON public.participation_notification_reads;
CREATE POLICY "Users read own participation notification state" ON public.participation_notification_reads
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own participation notification state" ON public.participation_notification_reads;
CREATE POLICY "Users insert own participation notification state" ON public.participation_notification_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own participation notification state" ON public.participation_notification_reads;
CREATE POLICY "Users update own participation notification state" ON public.participation_notification_reads
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own daily pulse preference" ON public.participation_daily_pulse_preferences;
CREATE POLICY "Users read own daily pulse preference" ON public.participation_daily_pulse_preferences
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own daily pulse preference" ON public.participation_daily_pulse_preferences;
CREATE POLICY "Users insert own daily pulse preference" ON public.participation_daily_pulse_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own daily pulse preference" ON public.participation_daily_pulse_preferences;
CREATE POLICY "Users update own daily pulse preference" ON public.participation_daily_pulse_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own daily pulse deliveries" ON public.participation_daily_pulse_deliveries;
CREATE POLICY "Users read own daily pulse deliveries" ON public.participation_daily_pulse_deliveries
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.participation_summaries(
  target_keys TEXT[],
  viewer UUID DEFAULT NULL
)
RETURNS TABLE (
  target_key TEXT,
  like_count BIGINT,
  repost_count BIGINT,
  comment_count BIGINT,
  viewer_liked BOOLEAN,
  viewer_reposted BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event.target_kind || ':' || event.target_id AS target_key,
    COUNT(*) FILTER (WHERE event.kind = 'like') AS like_count,
    COUNT(*) FILTER (WHERE event.kind = 'repost') AS repost_count,
    COUNT(*) FILTER (WHERE event.kind IN ('comment', 'reply')) AS comment_count,
    COALESCE(BOOL_OR(event.kind = 'like' AND event.actor_user_id = viewer), FALSE) AS viewer_liked,
    COALESCE(BOOL_OR(event.kind = 'repost' AND event.actor_user_id = viewer), FALSE) AS viewer_reposted
  FROM public.participation_events event
  WHERE event.deleted_at IS NULL
    AND (event.target_kind || ':' || event.target_id) = ANY(target_keys)
  GROUP BY event.target_kind, event.target_id;
$$;

REVOKE ALL ON FUNCTION public.participation_summaries(TEXT[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.participation_summaries(TEXT[], UUID) TO anon, authenticated, service_role;

COMMENT ON TABLE public.participation_events IS
  'Canonical BVS engagement event stream. Target ownership is resolved by trusted server routes; never trust a client-supplied author id.';
COMMENT ON TABLE public.participation_daily_pulse_deliveries IS
  'One row per user/day enforces the first-release maximum of one daily participation pulse.';
