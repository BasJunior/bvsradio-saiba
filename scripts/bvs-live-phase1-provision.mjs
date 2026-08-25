import { createHmac, randomBytes } from 'node:crypto'

const PUBLIC_ID_RE = /^evt_[a-z0-9]{8,16}$/
const publicId = process.env.BVS_LIVE_PHASE1_PUBLIC_ID || 'evt_phase1test'
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const pepper = process.env.BVS_LIVE_KEY_PEPPER || ''
const validityHours = Number(process.env.BVS_LIVE_PHASE1_VALID_HOURS || '8')

if (!PUBLIC_ID_RE.test(publicId)) throw new Error('Invalid BVS_LIVE_PHASE1_PUBLIC_ID')
if (!supabaseUrl || !serviceRole) throw new Error('Missing beta Supabase server credentials')
if (!pepper || pepper.length < 32) throw new Error('BVS_LIVE_KEY_PEPPER must be set securely before provisioning')
if (!Number.isFinite(validityHours) || validityHours <= 0 || validityHours > 24) {
  throw new Error('BVS_LIVE_PHASE1_VALID_HOURS must be between 0 and 24')
}

const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  'Content-Type': 'application/json',
}

async function request(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Beta Supabase request failed (${response.status})`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const streams = await request(
  `show_streams?public_id=eq.${encodeURIComponent(publicId)}&select=id,event_id,public_id,playback_id&limit=1`,
)
const stream = Array.isArray(streams) ? streams[0] : null
if (!stream) throw new Error(`No beta show_streams row exists for ${publicId}`)
if (stream.playback_id !== publicId) throw new Error('Phase 1 playback_id must equal public_id')

const secret = randomBytes(32).toString('hex')
const streamKeyHash = createHmac('sha256', pepper).update(secret).digest('hex')
const now = Date.now()
const validFrom = new Date(now - 5 * 60_000).toISOString()
const validUntil = new Date(now + validityHours * 60 * 60_000).toISOString()

await request(`show_events?id=eq.${encodeURIComponent(stream.event_id)}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({
    status: 'scheduled',
    live_video_url: null,
    replay_video_url: null,
    archive_published_at: null,
    updated_at: new Date().toISOString(),
  }),
})

await request(`show_streams?id=eq.${encodeURIComponent(stream.id)}`, {
  method: 'PATCH',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({
    stream_key_hash: streamKeyHash,
    key_active: true,
    revoked_at: null,
    status: 'ready',
    valid_from: validFrom,
    valid_until: validUntil,
    active_client_id: null,
    active_server_id: null,
    live_playback_url: null,
    last_publish_at: null,
    last_unpublish_at: null,
    started_at: null,
    ended_at: null,
    updated_at: new Date().toISOString(),
  }),
})

process.stdout.write([
  '',
  'BVS Live Phase 1 stream is READY on beta.',
  'Keep the following key in the local operator terminal only.',
  'Do not paste it into chat, tickets, screenshots or source control.',
  '',
  'OBS Server: rtmps://ingest-beta.bvsradio.com/live',
  `OBS Stream key (one-time display): ${publicId}?sk=${secret}`,
  `Valid until: ${validUntil}`,
  '',
].join('\n'))
