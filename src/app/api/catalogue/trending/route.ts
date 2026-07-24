import { NextResponse } from 'next/server'
import {
  matchCollectionName,
  normalizeCollectionKey,
  type CollectionCard,
} from '@/lib/catalogue-trending'

export const dynamic = 'force-dynamic'

type ScoreBucket = { score: number; plays: number }

function emptyBucket(): ScoreBucket {
  return { score: 0, plays: 0 }
}

function add(map: Record<string, ScoreBucket>, name: string, plays: number, weight = 1) {
  const key = normalizeCollectionKey(name)
  if (!key) return
  const cur = map[key] || emptyBucket()
  const p = Math.max(0, Number(plays) || 0)
  cur.plays += p
  cur.score += p * weight
  map[key] = cur
}

/**
 * GET /api/catalogue/trending
 * Body optional JSON cards via query is not used — client sends card names.
 * Query: ?names=Albums,BVS%20Archive,...
 */
export async function GET(request: Request) {
  try {
    const urlObj = new URL(request.url)
    const namesParam = urlObj.searchParams.get('names') || ''
    const cardNames = namesParam
      .split(',')
      .map((s) => decodeURIComponent(s.trim()))
      .filter(Boolean)
      .slice(0, 40)

    const fallbackCards: CollectionCard[] = cardNames.map((name) => ({
      name,
      detail: '',
      img: '',
    }))

    const scores: Record<string, ScoreBucket> = {}
    for (const c of fallbackCards) {
      scores[normalizeCollectionKey(c.name)] = emptyBucket()
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (supabaseUrl && key && cardNames.length) {
      const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      }

      // 1) Track play_count rolled up by collection-ish fields
      try {
        const tracksRes = await fetch(
          `${supabaseUrl}/rest/v1/tracks?select=title,artist_name,genre,play_count,is_public,editorial_status&play_count=gt.0&order=play_count.desc&limit=500`,
          { headers, cache: 'no-store' },
        )
        if (tracksRes.ok) {
          const rows = (await tracksRes.json()) as Array<{
            title?: string
            artist_name?: string
            genre?: string
            play_count?: number
          }>
          for (const row of rows) {
            const blob = [row.title, row.artist_name, row.genre].filter(Boolean).join(' · ')
            const matched = matchCollectionName(blob, cardNames)
            if (matched) add(scores, matched, Number(row.play_count || 0), 1)
          }
        }
      } catch {
        // keep empty scores
      }

      // 2) Recent player_start analytics (7d) with collection / title props
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const analyticsRes = await fetch(
          `${supabaseUrl}/rest/v1/analytics_events?event_name=eq.player_start&created_at=gte.${encodeURIComponent(since)}&select=properties,created_at&order=created_at.desc&limit=2000`,
          { headers, cache: 'no-store' },
        )
        if (analyticsRes.ok) {
          const rows = (await analyticsRes.json()) as Array<{ properties?: Record<string, unknown> }>
          for (const row of rows) {
            const props = row.properties || {}
            const candidates = [
              props.collection,
              props.project,
              props.title,
              props.track_title,
            ]
              .map((v) => String(v || ''))
              .filter(Boolean)
            let matched: string | null = null
            for (const c of candidates) {
              matched = matchCollectionName(c, cardNames)
              if (matched) break
            }
            if (matched) add(scores, matched, 1, 1.5)
          }
        }
      } catch {
        // optional
      }

      // 3) Checkout completes → strong commerce signal
      try {
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        const checkoutRes = await fetch(
          `${supabaseUrl}/rest/v1/analytics_events?event_name=eq.checkout_complete&created_at=gte.${encodeURIComponent(since)}&select=properties&limit=500`,
          { headers, cache: 'no-store' },
        )
        if (checkoutRes.ok) {
          const rows = (await checkoutRes.json()) as Array<{ properties?: Record<string, unknown> }>
          for (const row of rows) {
            const props = row.properties || {}
            const blob = [props.collection, props.item, props.title, props.product].map((v) => String(v || '')).join(' ')
            const matched = matchCollectionName(blob, cardNames)
            if (matched) add(scores, matched, 1, 10)
          }
        }
      } catch {
        // optional
      }
    }

    // Stable public shape
    const byName = Object.fromEntries(
      cardNames.map((name) => {
        const key = normalizeCollectionKey(name)
        const bucket = scores[key] || emptyBucket()
        return [
          name,
          {
            score: Math.round(bucket.score * 10) / 10,
            plays: Math.round(bucket.plays),
          },
        ]
      }),
    )

    return NextResponse.json({
      ok: true,
      window: '7d',
      scores: byName,
      generatedAt: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ ok: false, scores: {}, error: 'trending_unavailable' }, { status: 200 })
  }
}
