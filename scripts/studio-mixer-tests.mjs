import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const env = { BVS_STUDIO_MIXER: 'off' }
let membership = { status: 200, userId: 'member', allowed: true }
const source = fs.readFileSync('src/lib/studio-mixer-access.ts', 'utf8')
const exports = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports,
  process: { env },
  require: name => {
    if (name === 'server-only') return {}
    if (name === '@/lib/premium-ai') return { premiumAiAccess: async () => membership }
    throw Error(name)
  },
})

const request = new Request('https://local/api/creator/song-workspaces/id', { headers: { Authorization: 'Bearer test' } })
const check = async (level, status, reason, allowed) => {
  const result = await exports.studioMixerAccess(request, level)
  assert.equal(result.status, status)
  assert.equal(result.reason, reason)
  assert.equal(result.allowed, allowed)
  return result
}

await check('edit', 404, 'hidden', false)
env.BVS_STUDIO_MIXER = 'testers'
env.BVS_STUDIO_MIXER_TESTERS = 'another-user'
await check('edit', 404, 'hidden', false)
env.BVS_STUDIO_MIXER_TESTERS = 'another-user, member '
assert.equal(exports.studioMixerPresentation(await check('edit', 200, 'premium', true)), 'available')
env.BVS_STUDIO_MIXER = 'premium'
membership = { status: 401, userId: null, allowed: false }
await check('edit', 401, 'sign_in', false)
membership = { status: 503, userId: 'member', allowed: false }
await check('edit', 503, 'unavailable', false)
for (const scenario of ['free', 'expired', 'shell', 'premium-instant-only']) {
  membership = { status: 403, userId: 'member', allowed: false }
  assert.equal(exports.studioMixerPresentation(await check('edit', 403, 'upgrade', false)), 'upgrade', scenario)
  assert.equal(exports.studioMixerPresentation(await check('read', 200, 'read_only', true)), 'hidden', scenario)
}
membership = { status: 200, userId: 'member', allowed: true }
await check('read', 200, 'premium', true)
await check('edit', 200, 'premium', true)

const route = fs.readFileSync('src/app/api/creator/song-workspaces/[id]/route.ts', 'utf8')
let ownWorkspace = null
let entitlement = null
const routeExports = {}
vm.runInNewContext(ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: routeExports,
  Promise,
  require: name => {
    if (name === 'next/server') return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } }
    if (name === '@/lib/studio-mixer-access') return exports
    if (name === '@/lib/song-workspaces-server') return {
      songWorkspacesConfigured: () => true,
      songWorkspaceUser: async () => ({ id: 'member' }),
      getOwnSongWorkspace: async (userId, id) => userId === 'member' && id === 'own-id' ? ownWorkspace : null,
      findBeatEntitlement: async () => entitlement,
      presentSongWorkspace: async row => ({ id: row.id, songTitle: 'Song' }),
    }
    throw Error(name)
  },
})
const getWorkspace = id => routeExports.GET(request, { params: Promise.resolve({ id }) })
assert.equal((await getWorkspace('another-users-id')).status, 404)
ownWorkspace = { id: 'own-id', order_reference: 'order', beat_id: 'beat' }
assert.equal((await getWorkspace('own-id')).status, 403, 'a workspace still needs its beat entitlement')
entitlement = { beat: {} }
assert.equal((await getWorkspace('own-id')).body.workspace.mixer, 'available')
membership = { status: 403, userId: 'member', allowed: false }
assert.equal((await getWorkspace('own-id')).body.workspace.mixer, 'upgrade')
env.BVS_STUDIO_MIXER = 'off'
assert.equal((await getWorkspace('own-id')).body.workspace.mixer, 'hidden')
console.log('Studio Mixer Phase 0 gate passed: rollout, tester allowlist, paid edit, read-only lapsed access, and owner-scoped workspace response.')
