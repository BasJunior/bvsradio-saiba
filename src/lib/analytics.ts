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
  "playback_recovery",
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
  "signup_started",
  "signup_completed",
  "account_confirmed",
  "first_listen",
  "first_qualified_listen",
  "first_save",
  "first_follow",
  "return_session",
] as const

export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type AnalyticsProperties = Record<string, string | number | boolean | null>
export type Attribution = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "ref", string>>

const ATTRIBUTION_KEY = "bvs.analytics.first_touch.v1"
const VISITOR_KEY = "bvs.analytics.visitor.v1"
const FIRST_SESSION_AT_KEY = "bvs.analytics.first_session_at.v1"
const RETURN_MARK_KEY = "bvs.analytics.return_mark.v1"
const PLAY_ATTEMPT_KEY = "bvs.analytics.play_attempt.v1"

function safeValue(value: string | null) {
  if (!value) return undefined
  const clean = value.trim().slice(0, 80).replace(/[^a-zA-Z0-9._~:@/+-]/g, "-")
  return clean || undefined
}

export function captureFirstTouchAttribution(): Attribution {
  if (typeof window === "undefined") return {}
  try {
    const existing = window.localStorage.getItem(ATTRIBUTION_KEY)
    if (existing) return JSON.parse(existing) as Attribution
    const params = new URLSearchParams(window.location.search)
    const attribution: Attribution = {}
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"] as const) {
      const value = safeValue(params.get(key))
      if (value) attribution[key] = value
    }
    if (Object.keys(attribution).length) window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
    return attribution
  } catch {
    return {}
  }
}

export function getFirstTouchAttribution(): Attribution {
  if (typeof window === "undefined") return {}
  try {
    return captureFirstTouchAttribution()
  } catch {
    return {}
  }
}

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

function visitorId() {
  if (typeof window === "undefined") return undefined
  let value = window.localStorage.getItem(VISITOR_KEY)
  if (!value) {
    value = crypto.randomUUID()
    window.localStorage.setItem(VISITOR_KEY, value)
  }
  return value
}

function playAttemptId(event: AnalyticsEvent, properties: AnalyticsProperties) {
  if (typeof window === "undefined") return undefined
  try {
    if (event === "player_start" || event === "queue_play_now") {
      const id = crypto.randomUUID()
      window.sessionStorage.setItem(PLAY_ATTEMPT_KEY, JSON.stringify({ id, track: properties.track_id || null, at: Date.now() }))
      return id
    }
    const raw = window.sessionStorage.getItem(PLAY_ATTEMPT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; track?: string | null; at?: number }
      const sameTrack = !properties.track_id || !parsed.track || String(properties.track_id) === String(parsed.track)
      if (parsed.id && sameTrack && Date.now() - Number(parsed.at || 0) < 120000) return parsed.id
    }
    if (event === "playback_error") {
      const id = crypto.randomUUID()
      window.sessionStorage.setItem(PLAY_ATTEMPT_KEY, JSON.stringify({ id, track: properties.track_id || null, at: Date.now() }))
      return id
    }
  } catch {
    // grouping is best effort only
  }
  return undefined
}

function enrichPlaybackError(properties: AnalyticsProperties) {
  if (typeof document === "undefined") return properties
  try {
    const media = document.querySelector("audio") as HTMLAudioElement | null
    if (!media) return properties
    let host: string | null = null
    try {
      const src = media.currentSrc || media.src
      host = src ? new URL(src, window.location.origin).host : null
    } catch {
      host = null
    }
    return {
      ...properties,
      media_error_code: properties.media_error_code ?? media.error?.code ?? null,
      network_state: properties.network_state ?? media.networkState,
      ready_state: properties.ready_state ?? media.readyState,
      media_src_host: properties.media_src_host ?? host,
    }
  } catch {
    return properties
  }
}

export function analyticsSurface(): "web" | "ios" | "android" {
  if (typeof window === "undefined") return "web"
  const match = window.location.pathname.match(/^\/app\/(ios|android)(?:\/|$)/)
  return match?.[1] === "ios" || match?.[1] === "android" ? match[1] : "web"
}

export function analyticsAllowed() {
  if (typeof navigator === "undefined") return false
  return navigator.doNotTrack !== "1" && window.localStorage.getItem("bvs.analytics.disabled") !== "1"
}

function milestoneKey(event: AnalyticsEvent) {
  return `bvs.analytics.milestone.${event}.v1`
}

function sendEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  const attempt = playAttemptId(event, properties)
  const enriched = event === "playback_error" ? enrichPlaybackError(properties) : properties
  const finalProperties = attempt ? { ...enriched, play_attempt_id: attempt } : enriched
  const body = JSON.stringify({
    event,
    properties: finalProperties,
    sessionId: sessionId(),
    visitorId: visitorId(),
    surface: analyticsSurface(),
    path: window.location.pathname,
  })
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }))
    return
  }
  void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
}

export function trackMilestone(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsAllowed() || typeof window === "undefined") return false
  try {
    const key = milestoneKey(event)
    if (window.localStorage.getItem(key) === "1") return false
    window.localStorage.setItem(key, "1")
    sendEvent(event, properties)
    return true
  } catch {
    sendEvent(event, properties)
    return true
  }
}

export function trackReturnSessionIfNeeded() {
  if (!analyticsAllowed() || typeof window === "undefined") return
  try {
    const now = Date.now()
    const firstRaw = window.localStorage.getItem(FIRST_SESSION_AT_KEY)
    if (!firstRaw) {
      window.localStorage.setItem(FIRST_SESSION_AT_KEY, String(now))
      return
    }
    const first = Number(firstRaw)
    if (!Number.isFinite(first) || now - first < 18 * 60 * 60 * 1000) return
    const today = new Date().toISOString().slice(0, 10)
    if (window.localStorage.getItem(RETURN_MARK_KEY) === today) return
    window.localStorage.setItem(RETURN_MARK_KEY, today)
    sendEvent("return_session", { days_since_first: Math.max(1, Math.floor((now - first) / 86400000)) })
  } catch {
    // analytics must never block product use
  }
}

export function trackEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsAllowed()) return
  captureFirstTouchAttribution()
  sendEvent(event, properties)

  if (event === "player_start") trackMilestone("first_listen", properties)
  else if (event === "stream_qualified_30s") trackMilestone("first_qualified_listen", properties)
  else if (event === "track_save") trackMilestone("first_save", properties)
  else if (event === "creator_follow") trackMilestone("first_follow", properties)
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
