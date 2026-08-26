import type { StaffCopilotToolName } from './types'

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
