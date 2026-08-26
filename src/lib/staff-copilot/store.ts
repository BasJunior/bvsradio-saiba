import 'server-only'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { sanitizeCopilotText, sanitizeCopilotValue } from './sanitize'
import type { StaffCopilotCitation, StaffCopilotMessage, StaffCopilotToolTrace } from './types'

async function jsonOrNull(response: Response): Promise<unknown> {
  if (!response.ok) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function createCopilotThread(userId: string, title: string): Promise<string | null> {
  const response = await fetch(editorialUrl('staff_copilot_threads'), {
    method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title: sanitizeCopilotText(title, 120) || 'Ops thread' }),
  })
  const rows = await jsonOrNull(response) as Array<{ id?: string }> | null
  return rows?.[0]?.id || null
}

export async function appendCopilotMessage(input: {
  threadId: string
  userId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolTrace?: StaffCopilotToolTrace[]
  citations?: StaffCopilotCitation[]
}): Promise<boolean> {
  const response = await fetch(editorialUrl('staff_copilot_messages'), {
    method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({
      thread_id: input.threadId,
      user_id: input.userId,
      role: input.role,
      content: sanitizeCopilotText(input.content, 12000),
      tool_trace: sanitizeCopilotValue(input.toolTrace || null),
      citations: sanitizeCopilotValue(input.citations || null),
    }),
  })
  return response.ok
}

export async function getCopilotThreadMessages(userId: string, threadId: string): Promise<StaffCopilotMessage[] | null> {
  const response = await fetch(editorialUrl(`staff_copilot_threads?id=eq.${encodeURIComponent(threadId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) return null
  const threads = await response.json() as Array<{ id: string }>
  if (!threads[0]) return []
  const messages = await fetch(editorialUrl(`staff_copilot_messages?thread_id=eq.${encodeURIComponent(threadId)}&select=id,role,content,tool_trace,citations,created_at&order=created_at.asc&limit=100`), { headers: serviceHeaders, cache: 'no-store' })
  if (!messages.ok) return null
  return sanitizeCopilotValue(await messages.json()) as StaffCopilotMessage[]
}

export async function countRecentCopilotRequests(userId: string, minutes = 10): Promise<number | null> {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()
  const response = await fetch(editorialUrl(`staff_copilot_audit?user_id=eq.${encodeURIComponent(userId)}&action=eq.request&created_at=gte.${encodeURIComponent(since)}&select=id`), {
    headers: { ...serviceHeaders, Prefer: 'count=exact' }, cache: 'no-store',
  })
  if (!response.ok) return null
  const range = response.headers.get('content-range') || ''
  const total = Number(range.split('/').pop())
  return Number.isFinite(total) ? total : null
}

export async function auditCopilot(input: {
  userId: string
  threadId?: string | null
  action: string
  tool?: string | null
  status: 'ok' | 'denied' | 'error' | 'unavailable'
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    await fetch(editorialUrl('staff_copilot_audit'), {
      method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: input.userId,
        thread_id: input.threadId || null,
        action: sanitizeCopilotText(input.action, 80),
        tool: input.tool ? sanitizeCopilotText(input.tool, 120) : null,
        status: input.status,
        details: sanitizeCopilotValue(input.details || {}),
      }),
    })
  } catch { /* audit must not leak or crash the route */ }
}
