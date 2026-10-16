import 'server-only'
import { createHmac, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { creatorHeaders, creatorUrl } from '@/lib/creator-server'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import type { TrendingBoard, TrendingWindow } from '@/lib/trending'

export async function trendingRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Trending storage unavailable')
  const response = await fetch(creatorUrl(`rpc/${name}`), { method: 'POST', headers: creatorHeaders, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Trending storage unavailable')
  return response.json() as Promise<T>
}
export async function trendingIdentity(request: Request) {
  const secret = process.env.TRENDING_IDENTITY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Trending unavailable')
  const hash = (text: string) => createHmac('sha256', secret).update(text).digest('hex')
  const jar = await cookies()
  const stored = jar.get('bvs_trending_device')?.value || ''
  const [candidate, signature] = stored.split('.')
  const id = /^[0-9a-f-]{36}$/i.test(candidate || '') && hash(candidate) === signature ? candidate : randomUUID()
  if (id !== candidate) jar.set('bvs_trending_device', `${id}.${hash(id)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 8, path: '/' })
  // Daily rotating network hash: no raw addresses are stored. Never trust client body identity.
  const address = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  return { device: hash(`device:${id}`), network: address ? hash(`network:${new Date().toISOString().slice(0, 10)}:${address}`) : null }
}
export async function readTrending(window: TrendingWindow): Promise<TrendingBoard> {
  type Raw = { generatedAt: string | null; hasPrevious: boolean; entries: Array<{ id: string; title: string; artist: string; file: string; artwork: string; rank: number; previousRank: number | null; reason: string }> }
  const data = await trendingRpc<Raw>('bvs_trending_board', { p_window: window })
  return { ...data, window, entries: data.entries.map(({ file, artwork, ...entry }) => ({ ...entry, src: mediaUrlForStoredValue(file) || '', artwork: mediaUrlForStoredValue(artwork) || undefined })) }
}
