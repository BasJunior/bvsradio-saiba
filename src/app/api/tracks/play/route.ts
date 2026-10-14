import { NextResponse } from 'next/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normaliseSource(source: unknown) {
  const value = String(source || '')
  if (value === 'station') return 'station'
  if (value === 'artist' || value === 'embed') return value
  // On-demand player queues are catalogue listening, never station proof.
  // Unknown sources also stay non-station so they cannot manufacture First Spin.
  return 'catalogue'
}

export async function POST(request: Request) {
  try {
    const { trackId, source } = await request.json() as { trackId?: unknown; source?: unknown }
    const id = String(trackId || '')
    if (!uuidPattern.test(id)) return NextResponse.json({ error: 'Invalid track.' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return new NextResponse(null, { status: 204 })

    const response = await fetch(`${url}/rest/v1/rpc/record_track_play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        p_track_id: id,
        p_source: normaliseSource(source),
      }),
    })

    return new NextResponse(null, { status: response.ok ? 204 : 503 })
  } catch {
    return NextResponse.json({ error: 'Invalid play event.' }, { status: 400 })
  }
}
