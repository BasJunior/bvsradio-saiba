import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import {
  extractStreamSecret,
  parseSrsHookBody,
  validPublicId,
  type SrsHookAction,
  type SrsHookPayload,
} from '@/lib/bvs-live-protocol'

const REJECT_LIMIT = 30
const REJECT_WINDOW_MS = 60_000

type RejectReason =
  | 'bad_hook'
  | 'bad_app'
  | 'bad_stream'
  | 'bad_secret'
  | 'unknown_stream'
  | 'inactive_key'
  | 'not_ready'
  | 'window'
  | 'no_event'
  | 'event_blocked'

type ShowStreamRow = {
  id: string
  event_id: string
  public_id: string
  playback_id: string
  stream_key_hash: string
  key_active: boolean
  revoked_at: string | null
  status: string
  valid_from: string | null
  valid_until: string | null
}

type ShowEventRow = {
  id: string
  status: string
}

type RejectBucket = { count: number; resetAt: number }

const rejectBuckets = new Map<string, RejectBucket>()

function hookResponse(allow: boolean, status = 200) {
  return new Response(allow ? '0' : '1', {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

function timingSafeStringEqual(candidate: string, expected: string) {
  if (!candidate || !expected) return false
  return timingSafeEqual(digest(candidate), digest(expected))
}

function suppliedHookToken(request: Request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ''
  const alias = request.headers.get('x-bvs-live-hook')?.trim() || ''
  return { bearer, alias }
}

function hookIsAuthenticated(request: Request) {
  const expected = (process.env.BVS_LIVE_HOOK_SECRET || '').trim()
  if (!expected) return false
  const { bearer, alias } = suppliedHookToken(request)
  return timingSafeStringEqual(bearer, expected) || timingSafeStringEqual(alias, expected)
}

function logHook(outcome: 'accepted' | 'rejected' | 'ignored' | 'error', payload?: SrsHookPayload | null, reason?: string) {
  // Deliberately never log Authorization, param, tcUrl, or the stream secret.
  const safe = {
    scope: 'bvs_live_srs',
    action: payload?.action || 'unknown',
    public_id: validPublicId(payload?.stream || '') ? payload?.stream : undefined,
    outcome,
    reason,
  }
  if (outcome === 'error') console.error(safe)
  else if (outcome === 'rejected') console.warn(safe)
  else console.info(safe)
}

function rejectLimited(ip: string) {
  if (!ip) return false
  const now = Date.now()
  const bucket = rejectBuckets.get(ip)
  if (!bucket || now >= bucket.resetAt) {
    rejectBuckets.set(ip, { count: 0, resetAt: now + REJECT_WINDOW_MS })
    return false
  }
  return bucket.count >= REJECT_LIMIT
}

function noteReject(ip: string) {
  if (!ip) return
  const now = Date.now()
  const bucket = rejectBuckets.get(ip)
  if (!bucket || now >= bucket.resetAt) {
    rejectBuckets.set(ip, { count: 1, resetAt: now + REJECT_WINDOW_MS })
    return
  }
  bucket.count += 1
}

function serviceConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('BVS_LIVE_DB_CONFIG')
  return { url, key }
}

async function serviceRequest(path: string, init?: RequestInit) {
  const { url, key } = serviceConfig()
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

async function serviceJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await serviceRequest(path, init)
  if (!response.ok) throw new Error('BVS_LIVE_DB')
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function loadStream(publicId: string): Promise<ShowStreamRow | null> {
  const select = 'id,event_id,public_id,playback_id,stream_key_hash,key_active,revoked_at,status,valid_from,valid_until'
  const data = await serviceJson(
    `show_streams?public_id=eq.${encodeURIComponent(publicId)}&select=${select}&limit=1`,
  )
  return Array.isArray(data) && data.length ? (data[0] as ShowStreamRow) : null
}

async function loadEvent(eventId: string): Promise<ShowEventRow | null> {
  const data = await serviceJson(
    `show_events?id=eq.${encodeURIComponent(eventId)}&select=id,status&limit=1`,
  )
  return Array.isArray(data) && data.length ? (data[0] as ShowEventRow) : null
}

async function insertPublishRejected(streamId: string, reason: RejectReason) {
  try {
    await serviceRequest('show_stream_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        stream_id: streamId,
        type: 'publish_rejected',
        metadata: { reason },
      }),
    }).then((response) => {
      if (!response.ok) throw new Error('BVS_LIVE_DB')
    })
  } catch {
    // Rejection logging is useful but must never turn a rejection into an allow.
    logHook('error', null, 'reject_audit_failed')
  }
}

function validHexHash(value: string) {
  return /^[a-f0-9]{64}$/.test(value)
}

function streamSecretMatches(secret: string, storedHash: string) {
  const pepper = process.env.BVS_LIVE_KEY_PEPPER || ''
  if (!pepper || !validHexHash(storedHash)) throw new Error('BVS_LIVE_KEY_CONFIG')
  const calculated = createHmac('sha256', pepper).update(secret).digest('hex')
  return timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(storedHash, 'hex'))
}

function playbackUrl(playbackId: string) {
  const origin = (process.env.BVS_LIVE_PLAYBACK_ORIGIN || 'https://stream-beta.bvsradio.com').replace(/\/$/, '')
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:') throw new Error('BVS_LIVE_PLAYBACK_CONFIG')
  return `${origin}/live/${encodeURIComponent(playbackId)}/index.m3u8`
}

function insideWindow(stream: ShowStreamRow, now = Date.now()) {
  if (stream.valid_from) {
    const from = Date.parse(stream.valid_from)
    if (!Number.isFinite(from) || now < from) return false
  }
  if (stream.valid_until) {
    const until = Date.parse(stream.valid_until)
    if (!Number.isFinite(until) || now > until) return false
  }
  return true
}

function mapRpcReject(value: string): RejectReason {
  if (
    value === 'unknown_stream' ||
    value === 'inactive_key' ||
    value === 'not_ready' ||
    value === 'window' ||
    value === 'no_event' ||
    value === 'event_blocked'
  ) return value
  return 'not_ready'
}

async function rejectPublish(payload: SrsHookPayload, reason: RejectReason, stream?: ShowStreamRow | null) {
  noteReject(payload.ip)
  if (stream) await insertPublishRejected(stream.id, reason)
  logHook('rejected', payload, reason)
  return hookResponse(false)
}

async function markPublished(stream: ShowStreamRow, payload: SrsHookPayload, url: string) {
  const data = await serviceJson('rpc/bvs_live_mark_published', {
    method: 'POST',
    body: JSON.stringify({
      p_stream_id: stream.id,
      p_client_id: payload.clientId,
      p_server_id: payload.serverId || null,
      p_playback_url: url,
    }),
  })
  return typeof data === 'string' ? data : ''
}

async function markUnpublished(stream: ShowStreamRow, payload: SrsHookPayload) {
  const data = await serviceJson('rpc/bvs_live_mark_unpublished', {
    method: 'POST',
    body: JSON.stringify({ p_stream_id: stream.id, p_client_id: payload.clientId }),
  })
  return typeof data === 'string' ? data : ''
}

async function handlePublish(payload: SrsHookPayload) {
  if (payload.action !== 'on_publish') return rejectPublish(payload, 'bad_app')
  if (payload.app !== 'live') return rejectPublish(payload, 'bad_app')
  if (!validPublicId(payload.stream) || !payload.clientId) return rejectPublish(payload, 'bad_stream')
  if (rejectLimited(payload.ip)) {
    logHook('rejected', payload, 'rate_limited')
    return hookResponse(false)
  }

  const secret = extractStreamSecret(payload.param)
  if (!secret) return rejectPublish(payload, 'bad_secret')

  const stream = await loadStream(payload.stream)
  if (!stream) return rejectPublish(payload, 'unknown_stream')
  if (!stream.key_active || stream.revoked_at) return rejectPublish(payload, 'inactive_key', stream)

  let matches = false
  try {
    matches = streamSecretMatches(secret, stream.stream_key_hash)
  } catch {
    logHook('error', payload, 'key_config')
    return hookResponse(false, 503)
  }
  if (!matches) return rejectPublish(payload, 'bad_secret', stream)
  if (stream.status !== 'ready' && stream.status !== 'live') return rejectPublish(payload, 'not_ready', stream)
  if (!insideWindow(stream)) return rejectPublish(payload, 'window', stream)

  const event = await loadEvent(stream.event_id)
  if (!event) return rejectPublish(payload, 'no_event', stream)
  if (event.status === 'cancelled' || event.status === 'archived' || event.status === 'ended') {
    return rejectPublish(payload, 'event_blocked', stream)
  }
  if (event.status !== 'scheduled' && event.status !== 'live') {
    return rejectPublish(payload, 'event_blocked', stream)
  }

  const url = playbackUrl(stream.playback_id)
  const result = await markPublished(stream, payload, url)
  if (result !== 'accepted') return rejectPublish(payload, mapRpcReject(result), stream)

  logHook('accepted', payload)
  return hookResponse(true)
}

async function handleUnpublish(payload: SrsHookPayload) {
  if (payload.action !== 'on_unpublish' || payload.app !== 'live') {
    logHook('rejected', payload, 'bad_app')
    return hookResponse(false)
  }
  if (!validPublicId(payload.stream) || !payload.clientId) {
    logHook('rejected', payload, 'bad_stream')
    return hookResponse(false)
  }

  const stream = await loadStream(payload.stream)
  if (!stream) {
    logHook('ignored', payload, 'unknown_stream')
    return hookResponse(true)
  }
  if (stream.status === 'ended' || stream.status === 'archived' || stream.status === 'processing') {
    logHook('ignored', payload, 'already_terminal')
    return hookResponse(true)
  }

  const result = await markUnpublished(stream, payload)
  if (result !== 'ended' && result !== 'noop' && result !== 'stale') {
    logHook('error', payload, 'unpublish_transition')
    return hookResponse(false, 503)
  }

  logHook(result === 'stale' ? 'ignored' : 'accepted', payload, result)
  return hookResponse(true)
}

export async function handleSrsHook(request: Request, expectedAction: SrsHookAction) {
  if (!hookIsAuthenticated(request)) {
    logHook('rejected', null, 'bad_hook')
    return hookResponse(false)
  }

  const contentLength = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    logHook('rejected', null, 'body_too_large')
    return hookResponse(false)
  }

  const payload = await parseSrsHookBody(request)
  if (!payload || payload.action !== expectedAction) {
    logHook('rejected', payload, 'bad_app')
    return hookResponse(false)
  }

  try {
    return expectedAction === 'on_publish' ? await handlePublish(payload) : await handleUnpublish(payload)
  } catch {
    // Fail closed without exposing DB/config internals to SRS or the browser.
    logHook('error', payload, 'internal')
    return hookResponse(false, 503)
  }
}
