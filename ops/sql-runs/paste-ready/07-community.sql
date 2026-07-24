-- ============================================================
-- BVS pack 07-community
-- Source: supabase-community-chat.sql
-- Project: rdwwyolrxahimcgpkzzy
-- Paste entire file into SQL Editor → Run
-- ============================================================

-- BVS community and premium live broadcast chat.
-- Safe to rerun in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.community_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'cancelled')),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  broadcast_key TEXT NOT NULL DEFAULT 'bvs-live' CHECK (char_length(broadcast_key) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.live_chat_messages(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'unsafe', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, message_id)
);

CREATE INDEX IF NOT EXISTS live_chat_messages_feed_idx
  ON public.live_chat_messages(broadcast_key, created_at DESC) WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS live_chat_messages_rate_idx
  ON public.live_chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_reports_status_idx
  ON public.community_reports(status, created_at DESC);

ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own membership" ON public.community_memberships;
CREATE POLICY "Users read own membership" ON public.community_memberships
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed in users read visible chat" ON public.live_chat_messages;
CREATE POLICY "Signed in users read visible chat" ON public.live_chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL AND (status = 'visible' OR auth.uid() = user_id));

DROP POLICY IF EXISTS "Premium members post live chat" ON public.live_chat_messages;
CREATE POLICY "Premium members post live chat" ON public.live_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM public.community_memberships membership
        WHERE membership.user_id = auth.uid()
          AND membership.tier = 'premium'
          AND membership.status = 'active'
          AND (membership.expires_at IS NULL OR membership.expires_at > NOW())
      ) OR EXISTS (
        SELECT 1 FROM public.editorial_staff staff
        WHERE staff.user_id = auth.uid() AND staff.active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Users create own reports" ON public.community_reports;
CREATE POLICY "Users create own reports" ON public.community_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Users read own reports" ON public.community_reports;
CREATE POLICY "Users read own reports" ON public.community_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Membership changes and moderation intentionally have no client-side policies.
-- Use the service role from trusted server/admin routes only.

-- Test premium grant (replace UUID, then remove when billing automation is connected):
-- INSERT INTO public.community_memberships (user_id, tier, status, starts_at)
-- VALUES ('USER_UUID', 'premium', 'active', NOW())
-- ON CONFLICT (user_id) DO UPDATE SET tier = 'premium', status = 'active', starts_at = NOW(), expires_at = NULL;
