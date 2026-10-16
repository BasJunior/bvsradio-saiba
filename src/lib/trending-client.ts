import { getAnalyticsAccessToken } from '@/lib/analytics'
// Fire-and-forget discovery telemetry. The server owns identity, time and caps.
export function trendingEvent(kind: 'start' | 'listen' | 'complete' | 'save' | 'share', trackId: string, playId?: string, listenedSeconds?: number) {
  if (!/^[0-9a-f-]{36}$/i.test(trackId)) return Promise.resolve()
  const token = getAnalyticsAccessToken()
  return fetch('/api/trending/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ kind, trackId, playId, listenedSeconds }), keepalive: true,
  }).then(() => undefined).catch(() => undefined)
}
// Starts must arrive before the qualification message, including on slow networks.
const starts = new Map<string, Promise<void>>()
export function trendingPlayback(kind: 'start' | 'listen' | 'complete', trackId: string, playId: string, listenedSeconds?: number) {
  if (kind === 'start') {
    if (starts.size > 20) starts.delete(starts.keys().next().value!)
    starts.set(playId, trendingEvent(kind, trackId, playId))
  } else {
    starts.set(playId, (starts.get(playId) || Promise.resolve()).then(() => trendingEvent(kind, trackId, playId, listenedSeconds)))
  }
}
