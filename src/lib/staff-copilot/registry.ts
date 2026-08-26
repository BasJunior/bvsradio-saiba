import type { StaffCopilotToolName } from './types'

export const staffCopilotToolRegistry: Array<{
  name: StaffCopilotToolName
  description: string
  inputHint: string
}> = [
  { name: 'qa.snapshot', description: 'Read beta runtime, feature flags, deployment/schema hints and QA health.', inputHint: 'No arguments required.' },
  { name: 'editorial.queueSummary', description: 'Read capped pending editorial queues for tracks, beats, releases and creator/profile work.', inputHint: 'Optional limit, max 20.' },
  { name: 'live.listBroadcasts', description: 'Read BVS Live broadcasts and safe ingest/playback health without stream keys.', inputHint: 'Optional status and limit.' },
  { name: 'live.recentEvents', description: 'Read sanitized recent stream events.', inputHint: 'Optional broadcastId and limit.' },
  { name: 'commerce.lookupOrder', description: 'Look up an order by reference or customer email.', inputHint: 'Requires reference or email.' },
  { name: 'membership.lookup', description: 'Look up creator/listener membership state by email, username or UUID.', inputHint: 'Requires identifier.' },
  { name: 'creator.lookup', description: 'Look up a creator profile and aggregate content/listing counts.', inputHint: 'Requires username, public name or UUID.' },
  { name: 'uploads.recentFailures', description: 'Read recent failed/blocked media-processing and upload verification rows.', inputHint: 'Optional limit.' },
  { name: 'schema.version', description: 'Read expected beta schema packs and applied schema-pack records.', inputHint: 'No arguments required.' },
  { name: 'docs.help', description: 'Return the static internal route map and copilot boundaries.', inputHint: 'Optional topic.' },
]

const names = new Set(staffCopilotToolRegistry.map((tool) => tool.name))

export function isAllowedStaffCopilotTool(value: string): value is StaffCopilotToolName {
  return names.has(value as StaffCopilotToolName)
}

export const forbiddenStaffCopilotCapabilities = [
  'shell', 'exec', 'sql', 'deploy', 'force_live', 'approve', 'reject', 'publish',
  'refund', 'payout', 'rotate_key', 'vault', 'password_hash', 'recovery_token',
] as const
