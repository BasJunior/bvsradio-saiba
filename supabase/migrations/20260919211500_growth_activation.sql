-- BVS acquisition -> activation -> retention measurement.
-- Stores no email, IP address, payment data, or ad-platform profile data.

CREATE TABLE IF NOT EXISTS public.growth_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'listener',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  ref TEXT,
  first_return_at TIMESTAMPTZ,
  first_listen_at TIMESTAMPTZ,
  first_save_at TIMESTAMPTZ,
  first_follow_at TIMESTAMPTZ,
  first_post_at TIMESTAMPTZ,
  first_submission_at TIMESTAMPTZ,
  first_purchase_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  reengagement_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS growth_members_joined_idx
  ON public.growth_members(joined_at DESC);
CREATE INDEX IF NOT EXISTS growth_members_campaign_idx
  ON public.growth_members(utm_source, utm_campaign, joined_at DESC);
CREATE INDEX IF NOT EXISTS growth_members_activation_idx
  ON public.growth_members(activated_at, joined_at DESC);
CREATE INDEX IF NOT EXISTS growth_members_reengagement_idx
  ON public.growth_members(reengagement_sent_at, joined_at DESC)
  WHERE activated_at IS NULL;

ALTER TABLE public.growth_members ENABLE ROW LEVEL SECURITY;
-- No browser policies. Signup, analytics and growth workers use service-role APIs.

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
  ON public.analytics_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_event_name_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_event_name_check CHECK (event_name IN (
  'player_start', 'listening_duration', 'search_no_results', 'search_result_open',
  'search_to_play', 'search_to_beat_preview', 'search_to_creator',
  'explore_rail_open', 'explore_mode_change', 'beat_licence_view',
  'track_save', 'beat_save', 'playlist_created', 'playlist_track_added', 'playlist_beat_added',
  'engagement_action_open', 'upload_complete', 'checkout_started', 'checkout_redirect',
  'checkout_complete', 'studio_open', 'create_intent_selected', 'create_form_started',
  'create_submission_complete', 'beat_view', 'licence_selected', 'payment_confirmed',
  'lyrics_pad_open', 'lyrics_first_save', 'lyrics_return_session', 'prepare_release',
  'release_submitted', 'small_basket_nudge_shown', 'playback_error', 'payment_error',
  'queue_play_now', 'queue_play_next', 'queue_add', 'flow_object_open', 'flow_object_play',
  'flow_relationship_open', 'flow_back_restore', 'flow_action_sheet_open', 'stream_qualified_30s',
  'creator_follow', 'creator_unfollow', 'signup_started', 'signup_completed', 'account_confirmed',
  'first_listen', 'first_qualified_listen', 'first_save', 'first_follow', 'return_session',
  'first_post', 'activation_hub_open', 'activation_task_open', 'activation_task_complete',
  'activation_completed'
));

-- Lifecycle nudges use the existing durable participation inbox/outbox.
ALTER TABLE public.participation_domain_events DROP CONSTRAINT IF EXISTS participation_domain_events_event_type_check;
ALTER TABLE public.participation_domain_events ADD CONSTRAINT participation_domain_events_event_type_check CHECK (event_type IN (
  'post_created', 'message_replied', 'message_mentioned', 'thread_liked', 'thread_reposted',
  'creator_followed', 'thread_reported', 'thread_moderated', 'activation_nudge'
));
