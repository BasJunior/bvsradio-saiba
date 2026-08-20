import { NextResponse } from 'next/server'
import { answerAskBvs, type AskBvsClientContext, type AskBvsObject } from '@/lib/ask-bvs-flow'

export const runtime = 'nodejs'

function cleanClientItem(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const title = typeof row.title === 'string' ? row.title.trim().slice(0, 160) : ''
  if (!title) return null
  return {
    id: typeof row.id === 'string' ? row.id.slice(0, 160) : undefined,
    kind: typeof row.kind === 'string' ? row.kind.slice(0, 32) : undefined,
    title,
    subtitle: typeof row.subtitle === 'string' ? row.subtitle.trim().slice(0, 180) : undefined,
    href: typeof row.href === 'string' && row.href.startsWith('/') ? row.href.slice(0, 500) : undefined,
  }
}

function cleanContext(value: unknown): AskBvsClientContext {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  const cleanList = (key: 'history' | 'recent' | 'follows') => {
    const rows = Array.isArray(input[key]) ? input[key] : []
    return rows.slice(0, 8).map(cleanClientItem).filter(Boolean)
  }
  return {
    history: cleanList('history'),
    recent: cleanList('recent'),
    follows: cleanList('follows'),
  }
}

function asksForFollowUpdates(message: string) {
  const q = message.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return /(new|latest|happening|recent).*(follow|following)|(?:follow|following).*(new|latest|happening|recent)|creators i follow|people i follow/.test(q)
}

function uniqueObjects(objects: AskBvsObject[]) {
  const seen = new Set<string>()
  return objects.filter((object) => {
    const key = `${object.kind}:${object.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function POST(request: Request) {
  let message = ''
  let context: AskBvsClientContext = {}

  try {
    const body = (await request.json()) as { message?: unknown; context?: unknown }
    message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : ''
    context = cleanContext(body.context)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  try {
    if (asksForFollowUpdates(message)) {
      const follows = (context.follows || []).filter((item) => item.title).slice(0, 5)
      if (!follows.length) {
        return NextResponse.json({
          reply: 'You are not following any creators on this device yet. Follow a creator and Ask BVS can bring their newest published activity back to you.',
          objects: [],
          links: [{ label: 'Explore creators', href: '/search?mode=creators' }, { label: 'Your BVS', href: '/library' }],
          mode: 'flow',
          reason: 'follow_updates_empty',
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
      }

      const answers = await Promise.all(
        follows.map((follow) => answerAskBvs(`What's new from ${follow.title}?`, context)),
      )
      const objects = uniqueObjects(answers.flatMap((answer) => answer.objects || [])).slice(0, 6)
      if (objects.length) {
        return NextResponse.json({
          reply: 'Here’s the newest published BVS activity I could match from creators you follow.',
          objects,
          links: [{ label: 'Your BVS', href: '/library' }],
          mode: 'flow',
          reason: 'follow_updates',
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
      }
    }

    const answer = await answerAskBvs(message, context)
    return NextResponse.json(answer, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('Ask BVS Flow resolver failed', error instanceof Error ? error.message : error)
    return NextResponse.json({
      reply: 'Ask BVS could not read the live BVS graph right now. Explore still works while I reconnect.',
      objects: [],
      links: [{ label: 'Explore BVS', href: '/search' }, { label: 'Listen live', href: '/radio' }],
      mode: 'guide',
    }, { status: 200 })
  }
}
