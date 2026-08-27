export const analyticsEvents = [
  "player_start",
  "listening_duration",
  "search_no_results",
  "search_result_open",
  "search_to_play",
  "search_to_beat_preview",
  "search_to_creator",
  "explore_rail_open",
  "beat_licence_view",
  "track_save",
  "upload_complete",
  "checkout_started",
  "checkout_redirect",
  "checkout_complete",
  "premium_viewed",
  "plan_recommended",
  "upgrade_prompt_seen",
  "checkout_abandoned",
  "subscription_started",
  "first_premium_feature_used",
  "cancel_started",
  "cancelled",
  "reactivated",
  "trial_started",
  "trial_activated_feature",
  "trial_ended",
  "referral_credit_offered",
  "small_basket_nudge_shown",
  "playback_error",
  "payment_error",
  "queue_play_now",
  "queue_play_next",
  "queue_add",
  "flow_object_open",
  "flow_relationship_open",
  "flow_back_restore",
  "flow_action_sheet_open",
  "stream_qualified_30s",
  "your_bvs_open",
  "continue_listening_open",
  "creator_follow",
  "creator_unfollow",
  "pulse_impression",
  "pulse_item_open",
  "scene_trail_open",
  "scene_trail_resume",
  "scene_trail_clear",
  "now_playing_context_open",
  "now_playing_relationship_open",
  "explore_mode_change",
  "show_follow",
  "show_room_enter",
  "show_room_30s",
  "show_room_5m",
  "show_room_exit",
  "show_replay_start",
  "tv_mode_enter",
  "tv_companion_qr_shown",
  "creator_activity_open",
  "contextual_commerce_open",
  "studio_open",
  "create_intent_selected",
  "create_form_started",
  "create_submission_complete",
  "beat_view",
  "licence_selected",
  "payment_confirmed",
  "lyrics_pad_open",
  "lyrics_first_save",
  "lyrics_return_session",
  "prepare_release",
  "release_submitted",
] as const

export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type AnalyticsProperties = Record<string, string | number | boolean | null>

function sessionId() {
  if (typeof window === "undefined") return undefined
  const key = "bvs.analytics.session"
  let value = window.sessionStorage.getItem(key)
  if (!value) {
    value = crypto.randomUUID()
    window.sessionStorage.setItem(key, value)
  }
  return value
}

export function analyticsAllowed() {
  if (typeof navigator === "undefined") return false
  return navigator.doNotTrack !== "1" && window.localStorage.getItem("bvs.analytics.disabled") !== "1"
}

function sendEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsAllowed()) return
  const body = JSON.stringify({ event, properties, sessionId: sessionId(), path: window.location.pathname })
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }))
    return
  }
  void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
}

export function trackEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  sendEvent(event, properties)

  // Catalogue already emits player_start for every preview. Treat a beat preview as
  // an engaged beat view so we measure real listening interest rather than card impressions.
  if (event === "player_start" && properties.content_type === "beat") {
    sendEvent("beat_view", {
      ...(typeof properties.track_id === "string" || typeof properties.track_id === "number"
        ? { beat_id: properties.track_id }
        : {}),
      ...(typeof properties.source === "string" ? { source: properties.source } : {}),
    })
  }

  // Existing upload completion is the canonical creator submit signal. Derive the
  // sprint funnel events here so older upload surfaces keep working without duplicate
  // analytics wiring in every form.
  if (event === "upload_complete") {
    sendEvent("create_submission_complete", {
      content_type: typeof properties.song_workspace === "boolean" && properties.song_workspace ? "release_from_song_workspace" : "creator_upload",
      ...(typeof properties.release_type === "string" ? { release_type: properties.release_type } : {}),
      ...(typeof properties.track_count === "number" ? { track_count: properties.track_count } : {}),
    })
    if (properties.song_workspace === true) {
      sendEvent("release_submitted", {
        source: "song_workspace",
        ...(typeof properties.release_type === "string" ? { release_type: properties.release_type } : {}),
        ...(typeof properties.track_count === "number" ? { track_count: properties.track_count } : {}),
      })
    }
  }
}

export function trackEventOnce(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
  key: string = event,
  scope: "session" | "local" = "session",
) {
  if (typeof window === "undefined" || !analyticsAllowed()) return
  const storage = scope === "local" ? window.localStorage : window.sessionStorage
  const storageKey = `bvs.analytics.once.${event}.${key}`
  if (storage.getItem(storageKey) === "1") return
  storage.setItem(storageKey, "1")
  sendEvent(event, properties)
}

export function listeningBucket(seconds: number) {
  if (seconds < 15) return 0
  if (seconds < 30) return 15
  if (seconds < 60) return 30
  if (seconds < 180) return 60
  if (seconds < 300) return 180
  if (seconds < 600) return 300
  return 600
}
