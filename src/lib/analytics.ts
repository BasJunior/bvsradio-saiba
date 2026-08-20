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

export function trackEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsAllowed()) return
  const body = JSON.stringify({ event, properties, sessionId: sessionId(), path: window.location.pathname })
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }))
    return
  }
  void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
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
