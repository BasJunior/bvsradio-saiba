import { NextResponse } from 'next/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
        p_source: ['station', 'catalogue', 'artist', 'embed'].includes(String(source)) ? String(source) : 'station',
      }),
    })

    return new NextResponse(null, { status: response.ok ? 204 : 503 })
  } catch {
    return NextResponse.json({ error: 'Invalid play event.' }, { status: 400 })
  }
}
