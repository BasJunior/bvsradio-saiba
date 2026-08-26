import 'server-only'
import { staffCopilotToolRegistry, isAllowedStaffCopilotTool } from './registry'
import { STAFF_COPILOT_SYSTEM_PROMPT } from './prompt'
import { sanitizeCopilotText, sanitizeCopilotValue } from './sanitize'
import type { StaffCopilotCitation, StaffCopilotMessage, StaffCopilotSuggestedLink, StaffCopilotToolName, StaffCopilotToolResult } from './types'

export type CopilotExecutor = (name: StaffCopilotToolName, args: Record<string, unknown>) => Promise<StaffCopilotToolResult>

type RunResult = { reply: string; results: StaffCopilotToolResult[]; engine: 'stub' | 'model' }

function emailFrom(text: string) { return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '' }
function uuidFrom(text: string) { return text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] || '' }
function quotedFrom(text: string) { return text.match(/[`"']([^`"']{2,120})[`"']/)?.[1] || '' }
function after(text: string, pattern: RegExp) { return text.match(pattern)?.[1]?.trim() || '' }

export function stubToolPlan(message: string): Array<{ name: StaffCopilotToolName; args: Record<string, unknown> }> {
  const q = message.toLowerCase()
  const plan: Array<{ name: StaffCopilotToolName; args: Record<string, unknown> }> = []
  if (/(live|obs|hls|broadcast|armed|publisher)/.test(q)) {
    plan.push({ name: 'live.listBroadcasts', args: {} })
    if (/(event|disconnect|unpublish|hook|recent)/.test(q)) plan.push({ name: 'live.recentEvents', args: {} })
  }
  if (/(queue|pending|submission|review backlog)/.test(q)) plan.push({ name: 'editorial.queueSummary', args: {} })
  if (/(order|paynow|stripe|payment)/.test(q)) {
    const email = emailFrom(message)
    const reference = after(message, /(?:reference|ref|order)\s*[:#-]?\s*([A-Za-z0-9_-]{5,80})/i) || quotedFrom(message)
    plan.push({ name: 'commerce.lookupOrder', args: email ? { email } : reference ? { reference } : {} })
  }
  if (/(membership|premium plan|subscription)/.test(q)) {
    const identifier = emailFrom(message) || uuidFrom(message) || after(message, /(?:username|user|member|membership)\s*[:#-]?\s*@?([A-Za-z0-9._-]{2,120})/i) || quotedFrom(message)
    plan.push({ name: 'membership.lookup', args: identifier ? { identifier } : {} })
  }
  if (/(creator lookup|artist lookup|producer lookup|creator profile)/.test(q)) {
    const identifier = uuidFrom(message) || after(message, /(?:creator|artist|producer|username)\s*[:#-]?\s*@?([A-Za-z0-9._-]{2,120})/i) || quotedFrom(message)
    plan.push({ name: 'creator.lookup', args: identifier ? { identifier } : {} })
  }
  if (/(upload|processing).*(fail|blocked|quarantine)|fail.*upload/.test(q)) plan.push({ name: 'uploads.recentFailures', args: {} })
  if (/(schema|migration|pack version)/.test(q)) plan.push({ name: 'schema.version', args: {} })
  if (/(qa|health|deploy|runtime|feature flag)/.test(q)) plan.push({ name: 'qa.snapshot', args: {} })
  if (/(help|what can you|route map|where do i)/.test(q)) plan.push({ name: 'docs.help', args: {} })
  const seen = new Set<string>()
  return plan.filter((item) => !seen.has(item.name) && seen.add(item.name)).slice(0, 4)
}

function resultData(result: StaffCopilotToolResult): Record<string, unknown> {
  return result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : {}
}

function stubReply(results: StaffCopilotToolResult[]): string {
  if (!results.length) return 'I can read beta QA, editorial queues, BVS Live state, orders, memberships, creators, upload failures and schema status. Tell me which operational fact you want checked.'
  const parts: string[] = []
  for (const result of results) {
    const data = resultData(result)
    if (result.status === 'denied') {
      parts.push(String(data.error || `I need a required identifier before I can run ${result.tool}.`))
      continue
    }
    if (result.status === 'unavailable') {
      parts.push(`${result.tool} is not available in the current beta schema/runtime.`)
      continue
    }
    if (result.tool === 'live.listBroadcasts') {
      const rows = Array.isArray(data.broadcasts) ? data.broadcasts as Array<Record<string, unknown>> : []
      const armed = rows.filter((row) => row.status === 'armed').length
      const live = rows.filter((row) => row.status === 'live').length
      const signal = rows.filter((row) => row.status === 'signal_detected').length
      const lines = rows.filter((row) => ['armed', 'live', 'signal_detected', 'signal_lost'].includes(String(row.status))).slice(0, 8).map((row) => `${row.title || row.id}: ${String(row.status).toUpperCase()} · viewers ${row.viewer_count ?? 0} · HLS ${row.hls_available ? 'ready' : 'not ready'}`)
      parts.push(`BVS Live: ${armed} ARMED, ${signal} SIGNAL_DETECTED and ${live} LIVE.${lines.length ? `\n${lines.join('\n')}` : ''}`)
    } else if (result.tool === 'editorial.queueSummary') {
      const count = (key: string) => Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0
      parts.push(`Editorial queue sample: ${count('tracks')} tracks, ${count('beats')} beats, ${count('releases')} releases, ${count('profiles')} profile-name reviews and ${count('roleApplications')} role applications (each list is capped).`)
    } else if (result.tool === 'commerce.lookupOrder') {
      const orders = Array.isArray(data.orders) ? data.orders as Array<Record<string, unknown>> : []
      if (!orders.length) parts.push('No matching order was found in beta.')
      else parts.push(orders.slice(0, 5).map((row) => `Order ${row.reference}: ${row.status} · ${row.currency || 'usd'} ${row.total ?? '?'} · ${row.payment_method || 'payment method unknown'}`).join('\n'))
    } else if (result.tool === 'membership.lookup') {
      const memberships = Array.isArray(data.memberships) ? data.memberships as Array<Record<string, unknown>> : []
      parts.push(data.found === false ? 'No matching beta user was found.' : memberships.length ? memberships.map((row) => `${row.plan_id}: ${row.status}${row.billing_interval ? ` · ${row.billing_interval}` : ''}`).join('\n') : 'User found, but no membership rows were found.')
    } else if (result.tool === 'creator.lookup') {
      const profile = data.profile as Record<string, unknown> | undefined
      const counts = data.counts as Record<string, unknown> | undefined
      parts.push(data.found === false ? 'No matching creator was found.' : `${profile?.creator_public_name || profile?.producer_public_name || profile?.display_name || profile?.username || 'Creator'} · tracks ${counts?.tracks ?? 'not tracked'} · beats ${counts?.beats ?? 'not tracked'} · releases ${counts?.releases ?? 'not tracked'} · listings ${counts?.marketplaceListings ?? 'not tracked'}.`)
    } else if (result.tool === 'qa.snapshot') {
      parts.push(`Beta QA runtime: ${data.runtime || 'unknown'}; production locked=${String(data.productionLocked)}. Deployment SHA: ${(data.deployment as Record<string, unknown> | undefined)?.gitSha || 'not reported'}.`)
    } else if (result.tool === 'uploads.recentFailures') {
      const a = Array.isArray(data.mediaProcessing) ? data.mediaProcessing.length : 0
      const b = Array.isArray(data.marketplaceUploads) ? data.marketplaceUploads.length : 0
      parts.push(`Recent failure sample: ${a} media-processing rows and ${b} marketplace upload-verification rows.`)
    } else if (result.tool === 'schema.version') {
      const applied = Array.isArray(data.applied) ? data.applied : []
      parts.push(`Beta schema: ${applied.length} recent applied pack records returned; env version ${data.envVersion || 'not reported'}.`)
    } else if (result.tool === 'live.recentEvents') {
      const events = Array.isArray(data.events) ? data.events : []
      parts.push(`Returned ${events.length} recent sanitized live events.`)
    } else if (result.tool === 'docs.help') {
      parts.push('Ops Copilot is read-only. Use Beta QA for environment health, Editorial for review queues, Finance for order/payment review, and Creator Studio Broadcast for creator-side live preparation.')
    }
  }
  return sanitizeCopilotText(parts.join('\n\n'), 6000)
}

function dedupeResults(results: StaffCopilotToolResult[]) {
  const citations: StaffCopilotCitation[] = []
  const links: StaffCopilotSuggestedLink[] = []
  const seenC = new Set<string>(), seenL = new Set<string>()
  for (const result of results) {
    for (const c of result.citations || []) { const k = `${c.type}:${c.name}`; if (!seenC.has(k)) { seenC.add(k); citations.push(c) } }
    for (const l of result.suggestedLinks || []) { if (!seenL.has(l.href)) { seenL.add(l.href); links.push(l) } }
  }
  return { citations, links }
}

export function collectCopilotGrounding(results: StaffCopilotToolResult[]) { return dedupeResults(results) }

async function runStub(message: string, execute: CopilotExecutor): Promise<RunResult> {
  const plan = stubToolPlan(message)
  const results: StaffCopilotToolResult[] = []
  for (const item of plan) results.push(await execute(item.name, item.args))
  return { reply: stubReply(results), results, engine: 'stub' }
}

type OpenAIMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_call_id?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }

async function callModel(messages: OpenAIMessage[], toolsEnabled: boolean) {
  const key = process.env.BVS_STAFF_COPILOT_PROVIDER_KEY || process.env.OPENAI_API_KEY || ''
  const model = process.env.BVS_STAFF_COPILOT_MODEL || ''
  if (!key || !model) throw new Error('MODEL_UNAVAILABLE')
  const body: Record<string, unknown> = { model, messages, temperature: 0.1 }
  if (toolsEnabled) body.tools = staffCopilotToolRegistry.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: { type: 'object', additionalProperties: true } } }))
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  })
  if (!response.ok) throw new Error('MODEL_UNAVAILABLE')
  const payload = await response.json() as { choices?: Array<{ message?: OpenAIMessage }> }
  const message = payload.choices?.[0]?.message
  if (!message) throw new Error('MODEL_UNAVAILABLE')
  return message
}

async function runModel(message: string, history: StaffCopilotMessage[], execute: CopilotExecutor): Promise<RunResult> {
  const messages: OpenAIMessage[] = [{ role: 'system', content: STAFF_COPILOT_SYSTEM_PROMPT }]
  for (const item of history.slice(-12)) if (item.role === 'user' || item.role === 'assistant') messages.push({ role: item.role, content: sanitizeCopilotText(item.content, 4000) })
  messages.push({ role: 'user', content: sanitizeCopilotText(message, 2000) })
  const results: StaffCopilotToolResult[] = []
  let toolCalls = 0
  for (let round = 0; round < 2; round++) {
    const assistant = await callModel(messages, true)
    messages.push(assistant)
    const calls = assistant.tool_calls || []
    if (!calls.length) return { reply: sanitizeCopilotText(assistant.content || stubReply(results), 6000), results, engine: 'model' }
    for (const call of calls) {
      if (toolCalls >= 4) break
      const rawName = call.function.name
      if (!isAllowedStaffCopilotTool(rawName)) {
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ status: 'denied', error: 'Tool is not allowlisted.' }) })
        toolCalls++
        continue
      }
      let args: Record<string, unknown> = {}
      try { const parsed = JSON.parse(call.function.arguments || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed } catch { /* invalid args become empty */ }
      const result = await execute(rawName, sanitizeCopilotValue(args))
      results.push(result); toolCalls++
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(sanitizeCopilotValue({ status: result.status, data: result.data })) })
    }
  }
  const final = await callModel(messages, false)
  return { reply: sanitizeCopilotText(final.content || stubReply(results), 6000), results, engine: 'model' }
}

export async function runStaffCopilot(input: { message: string; history?: StaffCopilotMessage[]; execute: CopilotExecutor }): Promise<RunResult> {
  const stub = process.env.BVS_STAFF_COPILOT_STUB === '1' || !(process.env.BVS_STAFF_COPILOT_MODEL && (process.env.BVS_STAFF_COPILOT_PROVIDER_KEY || process.env.OPENAI_API_KEY))
  if (stub) return runStub(input.message, input.execute)
  try { return await runModel(input.message, input.history || [], input.execute) } catch { return runStub(input.message, input.execute) }
}
