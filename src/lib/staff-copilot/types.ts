export type StaffCopilotToolName =
  | 'qa.snapshot'
  | 'editorial.queueSummary'
  | 'live.listBroadcasts'
  | 'live.recentEvents'
  | 'commerce.lookupOrder'
  | 'membership.lookup'
  | 'creator.lookup'
  | 'uploads.recentFailures'
  | 'schema.version'
  | 'docs.help'

export type StaffCopilotCitation = {
  type: 'table' | 'route' | 'config' | 'docs'
  name: string
  detail?: string
}

export type StaffCopilotSuggestedLink = { href: string; label: string }

export type StaffCopilotToolTrace = {
  tool: string
  status: 'ok' | 'denied' | 'error' | 'unavailable'
  ms: number
}

export type StaffCopilotToolResult = {
  tool: StaffCopilotToolName
  status: 'ok' | 'denied' | 'error' | 'unavailable'
  data: unknown
  citations: StaffCopilotCitation[]
  suggestedLinks?: StaffCopilotSuggestedLink[]
}

export type StaffCopilotMessage = {
  id?: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  tool_trace?: StaffCopilotToolTrace[] | null
  citations?: StaffCopilotCitation[] | null
  created_at?: string
}

export type StaffCopilotResponse = {
  threadId: string
  reply: string
  citations: StaffCopilotCitation[]
  suggestedLinks: StaffCopilotSuggestedLink[]
  toolTrace: StaffCopilotToolTrace[]
  mode: 'staff_copilot'
  engine: 'stub' | 'model'
}

export function staffAccessStatus(hasBearer: boolean, identityPresent: boolean): 200 | 401 | 403 {
  if (!hasBearer) return 401
  return identityPresent ? 200 : 403
}
