-- vNext analytics behavior schema alignment
-- Applied to the isolated vNext Supabase project only before production promotion.

ALTER TABLE public.analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_event_name_check;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_name_check CHECK (event_name IN (
    'player_start',
    'listening_duration',
    'search_no_results',
    'search_result_open',
    'search_to_play',
    'search_to_beat_preview',
    'search_to_creator',
    'explore_rail_open',
    'beat_licence_view',
    'track_save',
    'upload_complete',
    'checkout_started',
    'checkout_redirect',
    'checkout_complete',
    'small_basket_nudge_shown',
    'playback_error',
    'playback_recovery',
    'payment_error',
    'queue_play_now',
    'queue_play_next',
    'queue_add',
    'flow_object_open',
    'flow_relationship_open',
    'flow_back_restore',
    'flow_action_sheet_open',
    'stream_qualified_30s',
    'your_bvs_open',
    'continue_listening_open',
    'creator_follow',
    'creator_unfollow',
    'pulse_impression',
    'pulse_item_open',
    'scene_trail_open',
    'scene_trail_resume',
    'scene_trail_clear',
    'now_playing_context_open',
    'now_playing_relationship_open',
    'explore_mode_change',
    'show_follow',
    'show_room_enter',
    'show_room_30s',
    'show_room_5m',
    'show_room_exit',
    'show_replay_start',
    'tv_mode_enter',
    'tv_companion_qr_shown',
    'creator_activity_open',
    'contextual_commerce_open',
    'signup_started',
    'signup_completed',
    'account_confirmed',
    'first_listen',
    'first_qualified_listen',
    'first_save',
    'first_follow',
    'return_session'
  ));

ALTER TABLE public.analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_source_check;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_source_check CHECK (source IN ('web', 'ios', 'android', 'server'));
