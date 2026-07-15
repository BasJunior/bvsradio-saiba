export const analyticsEvents = [
  "player_start",
  "listening_duration",
  "search_no_results",
  "track_save",
  "upload_complete",
  "checkout_started",
  "checkout_redirect",
  "checkout_complete",
  "playback_error",
  "payment_error",
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
