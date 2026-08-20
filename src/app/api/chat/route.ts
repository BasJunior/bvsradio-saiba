import { NextResponse } from 'next/server'
import { answerAskBvs, type AskBvsClientContext } from '@/lib/ask-bvs-flow'

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
