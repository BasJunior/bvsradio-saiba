export const analyticsEvents = [
  "player_start",
  "listening_duration",
  "search_no_results",
  "search_result_open",
  "search_to_play",
  "search_to_beat_preview",
  "search_to_creator",
  "explore_rail_open",
  "explore_mode_change",
  "beat_licence_view",
  "track_save",
  "beat_save",
  "playlist_created",
  "playlist_track_added",
  "engagement_action_open",
  "upload_complete",
  "checkout_started",
  "checkout_redirect",
  "checkout_complete",
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
  "small_basket_nudge_shown",
  "playback_error",
  "payment_error",
  "queue_play_now",
  "queue_play_next",
  "queue_add",
  "flow_object_open",
  "flow_object_play",
  "flow_relationship_open",
  "flow_back_restore",
  "flow_action_sheet_open",
  "stream_qualified_30s",
  "creator_follow",
  "creator_unfollow",
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
  return captureFirstTouchAttribution()
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

function playbackAttemptId(event: AnalyticsEvent) {
  if (typeof window === "undefined") return undefined
  try {
    if (event === "player_start") {
      const value = crypto.randomUUID()
      window.sessionStorage.setItem(PLAY_ATTEMPT_KEY, value)
      return value
    }
    if (event === "playback_error") {
      let value = window.sessionStorage.getItem(PLAY_ATTEMPT_KEY)
      if (!value) {
        value = crypto.randomUUID()
        window.sessionStorage.setItem(PLAY_ATTEMPT_KEY, value)
      }
      return value
    }
  } catch {
    return undefined
  }
  return undefined
}

export function analyticsAllowed() {
  if (typeof navigator === "undefined") return false
  return navigator.doNotTrack !== "1" && window.localStorage.getItem("bvs.analytics.disabled") !== "1"
}

function milestoneKey(event: AnalyticsEvent) {
  return `bvs.analytics.milestone.${event}.v1`
}

function sendEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  const attemptId = playbackAttemptId(event)
  const nextProperties = attemptId ? { ...properties, attempt_id: attemptId } : properties
  const body = JSON.stringify({
    event,
    properties: nextProperties,
    sessionId: sessionId(),
    visitorId: visitorId(),
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
    // Analytics must never block product use.
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
