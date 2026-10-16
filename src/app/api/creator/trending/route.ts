import { NextResponse } from 'next/server'
import { creatorIdentity, creatorHeaders, creatorUrl } from '@/lib/creator-server'
import { readTrending } from '@/lib/trending-server'
export async function GET(request: Request) {
  const identity = await creatorIdentity(request)
  if (!identity) return new NextResponse(null, { status: 401 })
  try {
    const [now, week] = await Promise.all([readTrending('now'), readTrending('week')])
    const ids = [...new Set([...now.entries, ...week.entries].map(row => row.id))]
    if (!ids.length) return NextResponse.json({ boards: [] }, { headers: { 'Cache-Control': 'no-store' } })
    const response = await fetch(creatorUrl(`tracks?user_id=eq.${identity.user.id}&id=in.(${ids.join(',')})&select=id`), { headers: creatorHeaders, cache: 'no-store' })
    if (!response.ok) throw new Error('Unavailable')
    const owned = new Set((await response.json() as Array<{ id: string }>).map(row => row.id))
    return NextResponse.json({ boards: [now, week].map(board => ({ ...board, entries: board.entries.filter(row => owned.has(row.id)) })) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return new NextResponse(null, { status: 503 }) }
}
