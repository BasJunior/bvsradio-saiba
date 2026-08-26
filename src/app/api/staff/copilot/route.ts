import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'
import { staffCopilotToolRegistry } from '@/lib/staff-copilot/registry'
import { runStaffCopilot, collectCopilotGrounding } from '@/lib/staff-copilot/run'
import { sanitizeCopilotText, sanitizeCopilotValue, safeClientContext } from '@/lib/staff-copilot/sanitize'
import { executeStaffCopilotTool } from '@/lib/staff-copilot/tools'
import { appendCopilotMessage, auditCopilot, countRecentCopilotRequests, createCopilotThread, getCopilotThreadMessages } from '@/lib/staff-copilot/store'
import { staffAccessStatus, type StaffCopilotToolName } from '@/lib/staff-copilot/types'

export const runtime = 'nodejs'

function authError(hasBearer: boolean) {
  const status = staffAccessStatus(hasBearer, false)
  return NextResponse.json({ error: status === 401 ? 'Sign in required.' : 'Active BVS staff access is required.' }, { status })
}

async function ownsThread(userId: string, threadId: string): Promise<boolean> {
  try {
    const response = await fetch(editorialUrl(`staff_copilot_threads?id=eq.${encodeURIComponent(threadId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`), { headers: serviceHeaders, cache: 'no-store' })
    if (!response.ok) return false
    const rows = await response.json() as Array<{ id: string }>
    return Boolean(rows[0])
  } catch { return false }
}

export async function GET(request: Request) {
  const hasBearer = Boolean(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
  const identity = await editorialIdentity(request)
  if (!identity) return authError(hasBearer)
  const url = new URL(request.url)
  if (url.searchParams.get('tools') === '1') {
    return NextResponse.json({ mode: 'staff_copilot', tools: staffCopilotToolRegistry })
  }
  const threadId = String(url.searchParams.get('threadId') || '').trim()
  if (!threadId) return NextResponse.json({ error: 'threadId is required.' }, { status: 400 })
  const messages = await getCopilotThreadMessages(identity.user.id, threadId)
  if (messages === null) return NextResponse.json({ error: 'Copilot storage is unavailable.' }, { status: 503 })
  if (!(await ownsThread(identity.user.id, threadId))) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })
  return NextResponse.json({ threadId, messages, mode: 'staff_copilot' })
}

export async function POST(request: Request) {
  const hasBearer = Boolean(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
  const identity = await editorialIdentity(request)
  if (!identity) return authError(hasBearer)

  let body: { message?: unknown; threadId?: unknown; clientContext?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const message = sanitizeCopilotText(body.message, 2000).trim()
  if (!message) return NextResponse.json({ error: 'message is required.' }, { status: 400 })
  if (String(body.message || '').length > 2000) return NextResponse.json({ error: 'Message must be 2000 characters or fewer.' }, { status: 400 })

  const recent = await countRecentCopilotRequests(identity.user.id, 10)
  if (recent === null) return NextResponse.json({ error: 'Copilot storage is unavailable.' }, { status: 503 })
  if (recent >= 20) {
    await auditCopilot({ userId: identity.user.id, action: 'rate_limit_denied', status: 'denied', details: { windowMinutes: 10, limit: 20 } })
    return NextResponse.json({ error: 'Rate limit reached. Try again later.' }, { status: 429 })
  }

  let threadId = String(body.threadId || '').trim()
  if (threadId && !(await ownsThread(identity.user.id, threadId))) return NextResponse.json({ error: 'Thread not found.' }, { status: 400 })
  if (!threadId) {
    threadId = (await createCopilotThread(identity.user.id, message.slice(0, 80))) || ''
    if (!threadId) return NextResponse.json({ error: 'Copilot storage is unavailable.' }, { status: 503 })
  }

  const clientContext = safeClientContext(body.clientContext)
  await auditCopilot({ userId: identity.user.id, threadId, action: 'request', status: 'ok', details: { clientContext, messageLength: message.length } })
  await appendCopilotMessage({ threadId, userId: identity.user.id, role: 'user', content: message })
  const history = (await getCopilotThreadMessages(identity.user.id, threadId)) || []
  const trace: Array<{ tool: string; status: 'ok' | 'denied' | 'error' | 'unavailable'; ms: number }> = []

  try {
    const run = await runStaffCopilot({
      message,
      history: history.slice(0, -1),
      execute: async (name: StaffCopilotToolName, args: Record<string, unknown>) => {
        const started = Date.now()
        let result
        try {
          result = await executeStaffCopilotTool(name, sanitizeCopilotValue(args))
        } catch {
          result = { tool: name, status: 'error' as const, data: { error: 'Read tool failed safely.' }, citations: [] }
        }
        const ms = Date.now() - started
        trace.push({ tool: name, status: result.status, ms })
        await auditCopilot({ userId: identity.user.id, threadId, action: result.status === 'denied' ? 'tool_denied' : 'tool_call', tool: name, status: result.status, details: { ms, args: sanitizeCopilotValue(args) } })
        return result
      },
    })
    const grounded = collectCopilotGrounding(run.results)
    const reply = sanitizeCopilotText(run.reply, 6000)
    await appendCopilotMessage({ threadId, userId: identity.user.id, role: 'assistant', content: reply, toolTrace: trace, citations: grounded.citations })
    return NextResponse.json({ threadId, reply, citations: grounded.citations, suggestedLinks: grounded.links, toolTrace: trace, mode: 'staff_copilot', engine: run.engine })
  } catch {
    await auditCopilot({ userId: identity.user.id, threadId, action: 'request_failed', status: 'error', details: { error: 'staff_copilot_internal_error' } })
    return NextResponse.json({ error: 'Ops Copilot could not complete that request.' }, { status: 500 })
  }
}
