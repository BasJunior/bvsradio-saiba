-- Native push storage was present only in beta. Apply to the canonical live database.
-- All access goes through authenticated BVS server routes; device tokens are private.
CREATE TABLE IF NOT EXISTS public.app_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token text NOT NULL UNIQUE CHECK (char_length(device_token) BETWEEN 12 AND 300),
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  app_variant text NOT NULL DEFAULT 'vnext' CHECK (app_variant IN ('vnext','beta','production')),
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_push_devices_user_enabled_idx ON public.app_push_devices(user_id) WHERE enabled;
CREATE TABLE IF NOT EXISTS public.app_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  releases boolean NOT NULL DEFAULT true,
  shows boolean NOT NULL DEFAULT true,
  creator_work boolean NOT NULL DEFAULT true,
  orders boolean NOT NULL DEFAULT true,
  community boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_push_devices, public.app_notification_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_push_devices, public.app_notification_preferences TO service_role;
