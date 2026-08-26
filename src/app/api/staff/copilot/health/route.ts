import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { sanitizeCopilotValue } from '@/lib/staff-copilot/sanitize'

export const runtime = 'nodejs'

async function count(path: string): Promise<number | null> {
  try {
    const response = await fetch(editorialUrl(path), { headers: { ...serviceHeaders, Prefer: 'count=exact' }, cache: 'no-store' })
    if (!response.ok) return null
    const total = Number((response.headers.get('content-range') || '').split('/').pop())
    return Number.isFinite(total) ? total : null
  } catch { return null }
}

async function lastError() {
  try {
    const response = await fetch(editorialUrl('staff_copilot_audit?status=eq.error&select=action,tool,status,details,created_at&order=created_at.desc&limit=1'), { headers: serviceHeaders, cache: 'no-store' })
    if (!response.ok) return null
    const rows = await response.json()
    return sanitizeCopilotValue(rows?.[0] || null)
  } catch { return null }
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Active BVS staff access is required.' }, { status: 403 })
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [threads, messages, auditRows, audit24h, error] = await Promise.all([
    count('staff_copilot_threads?select=id'),
    count('staff_copilot_messages?select=id'),
    count('staff_copilot_audit?select=id'),
    count(`staff_copilot_audit?created_at=gte.${encodeURIComponent(since)}&select=id`),
    lastError(),
  ])
  const keyPresent = Boolean(process.env.BVS_STAFF_COPILOT_PROVIDER_KEY || process.env.OPENAI_API_KEY)
  const modelPresent = Boolean(process.env.BVS_STAFF_COPILOT_MODEL)
  const stubForced = process.env.BVS_STAFF_COPILOT_STUB === '1'
  return NextResponse.json({
    routeMounted: true,
    tablesPresent: { threads: threads !== null, messages: messages !== null, audit: auditRows !== null },
    mode: stubForced || !keyPresent || !modelPresent ? 'stub' : 'model',
    auditCount24h: audit24h,
    lastSanitizedError: error,
  })
}
