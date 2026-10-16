import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { trendingIdentity, trendingRpc } from '@/lib/trending-server'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function POST(request: Request) {
  // Restrict browser writes to same-origin; native clients may omit Origin.
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 })
  let body: { kind?: string; trackId?: string; playId?: string; listenedSeconds?: number }
  try { body = await request.json() } catch { return new NextResponse(null, { status: 400 }) }
  if (!body || !['start', 'listen', 'complete', 'save', 'share'].includes(body.kind || '') || !uuid.test(body.trackId || '') || (['start', 'listen', 'complete'].includes(body.kind!) && !uuid.test(body.playId || '')) || (body.listenedSeconds !== undefined && (!Number.isFinite(body.listenedSeconds) || body.listenedSeconds < 0 || body.listenedSeconds > 86400))) return new NextResponse(null, { status: 400 })
  try {
    const identity = await trendingIdentity(request)
    const supabase = await createServerSupabaseClient()
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    const { data } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()
    await trendingRpc('bvs_trending_event', { p_kind: body.kind, p_track: body.trackId, p_play: body.playId || null, p_seconds: Math.floor(body.listenedSeconds || 0), p_device: identity.device, p_network: identity.network, p_user: data.user?.is_anonymous ? null : data.user?.id || null })
    return new NextResponse(null, { status: 204 })
  } catch { return new NextResponse(null, { status: 503 }) }
}
