import { NextResponse } from 'next/server'
import type { DiscoveryItem } from '@/lib/discovery'
import type { LibrarySection } from '@/lib/library'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const sections: LibrarySection[] = ['favourites', 'follows', 'history']

type LibraryPayload = {
  operation: 'merge' | 'set'
  libraries?: Partial<Record<LibrarySection, DiscoveryItem[]>>
  section?: LibrarySection
  item?: DiscoveryItem
  saved?: boolean
}

async function authenticatedUser(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) return null
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  return response.ok ? response.json() : null
}

function serviceHeaders(prefer?: string) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...(prefer ? { Prefer: prefer } : {}),
  }
}

async function fetchLibrary(userId: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_library_items?user_id=eq.${userId}&select=section,item&order=updated_at.desc`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Library storage is not ready')
  const rows = await response.json() as Array<{ section: LibrarySection; item: DiscoveryItem }>
  return sections.reduce<Record<LibrarySection, DiscoveryItem[]>>((result, section) => {
    result[section] = rows.filter((row) => row.section === section).map((row) => row.item).slice(0, section === 'history' ? 30 : 200)
    return result
  }, { favourites: [], follows: [], history: [] })
}

export async function POST(req: Request) {
  const user = await authenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const payload = await req.json() as LibraryPayload
    if (payload.operation === 'merge') {
      const rows = sections.flatMap((section) => (payload.libraries?.[section] || []).map((item) => ({
        user_id: user.id,
        section,
        item_id: item.id,
        item,
        updated_at: new Date().toISOString(),
      })))
      if (rows.length) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_library_items?on_conflict=user_id,section,item_id`, {
          method: 'POST',
          headers: serviceHeaders('resolution=merge-duplicates,return=minimal'),
          body: JSON.stringify(rows),
        })
        if (!response.ok) throw new Error('Library merge failed')
      }
    } else if (payload.operation === 'set' && payload.section && payload.item) {
      if (!sections.includes(payload.section)) return NextResponse.json({ error: 'Invalid library section' }, { status: 400 })
      if (payload.saved) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_library_items?on_conflict=user_id,section,item_id`, {
          method: 'POST',
          headers: serviceHeaders('resolution=merge-duplicates,return=minimal'),
          body: JSON.stringify({ user_id: user.id, section: payload.section, item_id: payload.item.id, item: payload.item, updated_at: new Date().toISOString() }),
        })
        if (!response.ok) throw new Error('Library update failed')
      } else {
        const itemId = encodeURIComponent(payload.item.id)
        const response = await fetch(`${SUPABASE_URL}/rest/v1/user_library_items?user_id=eq.${user.id}&section=eq.${payload.section}&item_id=eq.${itemId}`, {
          method: 'DELETE',
          headers: serviceHeaders(),
        })
        if (!response.ok) throw new Error('Library update failed')
      }
    } else {
      return NextResponse.json({ error: 'Invalid library operation' }, { status: 400 })
    }

    return NextResponse.json({ libraries: await fetchLibrary(user.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Library sync failed' }, { status: 503 })
  }
}
