import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { staffCopilotToolRegistry, isAllowedStaffCopilotTool } from '../src/lib/staff-copilot/registry.ts'
import { sanitizeCopilotValue } from '../src/lib/staff-copilot/sanitize.ts'
import { stubToolPlan } from '../src/lib/staff-copilot/stub.ts'
import { staffAccessStatus } from '../src/lib/staff-copilot/types.ts'

assert.equal(staffAccessStatus(false, false), 401, 'signed-out users must be denied')
assert.equal(staffAccessStatus(true, false), 403, 'authenticated non-staff must be denied')
assert.equal(staffAccessStatus(true, true), 200, 'active staff may proceed')

const names = staffCopilotToolRegistry.map((tool) => tool.name)
assert.equal(names.length, 10, 'Phase 1 must expose exactly ten read tools')
for (const name of names) assert.equal(isAllowedStaffCopilotTool(name), true)
for (const forbidden of ['shell.exec', 'sql.query', 'deploy.vercel', 'live.force', 'refund.create', 'payout.execute']) {
  assert.equal(isAllowedStaffCopilotTool(forbidden), false, `${forbidden} must never be allowlisted`)
}

const sanitized = sanitizeCopilotValue({
  stream_key: 'evt_abc?sk=secret-value',
  nested: { Authorization: 'Bearer abc.def.ghi', provider: 'sk_live_SUPERSECRET' },
  text: 'connect https://ingest.example/live?sk=secret and Bearer token-value',
})
assert.equal(sanitized.stream_key, '[REDACTED]')
assert.equal(sanitized.nested.Authorization, '[REDACTED]')
assert.equal(String(sanitized.nested.provider).includes('SUPERSECRET'), false)
assert.equal(String(sanitized.text).includes('secret'), false)
assert.equal(String(sanitized.text).includes('token-value'), false)

const livePlan = stubToolPlan('What live shows are ARMED or LIVE?')
assert.equal(livePlan[0]?.name, 'live.listBroadcasts', 'stub must route live/OBS/HLS intent to live reads')

const orderMissing = stubToolPlan('Look up an order for me')
assert.equal(orderMissing[0]?.name, 'commerce.lookupOrder')
assert.deepEqual(orderMissing[0]?.args, {}, 'stub must not invent an order identifier')
const orderWithEmail = stubToolPlan('Stripe order for test@example.com')
assert.deepEqual(orderWithEmail[0]?.args, { email: 'test@example.com' })

const toolsSource = await readFile(new URL('../src/lib/staff-copilot/tools.ts', import.meta.url), 'utf8')
assert.match(toolsSource, /if \(!reference && !email\).*Order reference or customer email is required/s, 'order tool must deny missing identifiers')
assert.doesNotMatch(toolsSource, /child_process|execSync|spawn\(|\brpc\/.*sql|vercel deploy|force[_-]?live/i, 'read tool implementation must not contain shell/sql/deploy/force-live capabilities')
assert.doesNotMatch(toolsSource, /reconciliation_error/, 'raw reconciliation errors must never be selected for copilot output')

console.log('staff copilot tests passed')
