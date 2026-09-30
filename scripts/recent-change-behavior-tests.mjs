import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, imports = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, {
    exports, require(name) {
      if (name === 'server-only') return {}
      if (name in imports) return imports[name]
      throw new Error(`Unexpected dependency: ${name}`)
    }, console, URL, AbortSignal, process: { env: {} }, ...globals,
  }, { filename: path })
  return exports
}
const fixtureTrack = {
  id: '12345678-1234-1234-1234-123456789012', title: 'Chiraq Drillaz', artist: 'BasJunior',
  collection: 'BVS', source: 'track', description: '', genre: 'Rap', artwork: '/logo.png',
}
const graph = load('src/lib/ask-bvs-flow.ts', {
  '@/lib/catalogue-curated-tracks': { curatedCatalogueTracks: [] },
  '@/lib/catalogue-listings': { listCatalogueMusicListings: async () => ({ listings: [fixtureTrack] }) },
  '@/lib/artist-content': { getPublishedArtists: async () => [{ id: 'creator-1', name: 'BasJunior', username: 'basjunior', role: 'Artist', genres: [], bio: '' }], getPublishedProducers: async () => [] },
  '@/lib/public-releases': { getPublicReleases: async () => [{ id: 'release-1', title: 'BVS', artist: 'BasJunior', releaseType: 'album', tracks: [{ title: 'Chiraq Drillaz' }], publishedAt: '2026-09-28' }] },
  '@/lib/media-url': { mediaUrlForStoredValue: value => value },
  '@/lib/public-name': { producerPublicName: row => row.username || '' },
})
const track = await graph.answerAskBvs('Who made Chiraq Drillaz?')
assert.equal(track.reason, 'credit_not_verified')
assert.match(track.reply, /don’t have a verified producer credit/)
assert.equal(track.objects[0].title, 'Chiraq Drillaz')
assert.equal('mediaSrc' in track.objects[0], false, 'Discovery must route through existing rights-checked pages')
const release = await graph.answerAskBvs('Which album is Chiraq Drillaz on?')
assert.equal(release.reason, 'release_relationship')
assert.equal(release.objects[1].title, 'BVS')
const fresh = await graph.answerAskBvs('What’s new on BVS?')
assert.equal(fresh.objects[0].id, 'release-1', 'Fresh discovery must work when Pulse is disabled')
for (const href of ['//evil.example', '/\\evil.example', '/\n/evil.example']) {
  const history = await graph.answerAskBvs('What have I been listening to?', { history: [{ id: 'x', kind: 'track', title: 'Test', href }] })
  assert.match(history.objects[0].route, /^\/catalogue\?q=/)
}
const nextResponse = { NextResponse: { json: (body, options) => ({ body, options }) } }
const chat = load('src/app/api/chat/route.ts', {
  'next/server': nextResponse,
  ai: { generateText: async () => { throw new Error('AI must not be needed for catalogue discovery') } },
  '@/lib/ask-bvs-flow': graph,
})
assert.equal((await chat.POST({ json: async () => ({ message: '' }) })).options.status, 400)
assert.equal((await chat.POST({ json: async () => ({ message: 'Who made Chiraq Drillaz?' }) })).body.reason, 'credit_not_verified')
assert.match((await chat.POST({ json: async () => ({ message: 'Open Lyrics Pad' }) })).body.reply, /private writing space/)
const stamp = '2026-09-30T00:00:00Z'
const event = (name, attempt, version = 'v2', properties = {}) => ({ event_name: name, session_id: 'session-a', created_at: stamp, properties: { attempt_id: attempt, proof_version: version, track_id: fixtureTrack.id, ...properties } })
const events = [event('playback_media_requested', 'a'), event('playback_media_requested', 'b'), event('playback_first_audio', 'a', 'v2', { startup_ms: 120 }), event('playback_continue_60s', 'a'), event('playback_error', 'b', 'v2', { stage: 'start' }), event('playback_error', 'old', 'v1', { stage: 'start' })]
const analytics = load('src/app/api/admin/editorial/analytics/route.ts', {
  'next/server': nextResponse,
  '@/lib/editorial-server': { editorialIdentity: async () => ({ role: 'founder' }), editorialUrl: path => `https://fixture/${path}`, serviceHeaders: {} },
}, { fetch: async url => ({ ok: true, json: async () => url.includes('/analytics_events?') ? events : url.includes('/tracks?') ? [{ ...fixtureTrack, artist_name: 'BasJunior' }] : [] }) })
const proof = (await analytics.GET({ url: 'https://fixture/api/analytics' })).body.reliability.proof
assert.equal(proof.attempts, 2)
assert.equal(proof.errorAttempts, 1, 'v2 failures must be counted; legacy v1 failures must be excluded')
assert.equal(proof.unrecoveredFailureRate, 50)
assert.equal(proof.continuedAttempts, 1)
assert.equal(proof.continuedRate, 50)
// Validate every proof emitter, rather than finding just one version tag in the file.
const player = readFileSync('src/components/StationPlayer.tsx', 'utf8')
for (const name of ['playback_first_audio', 'playback_10s', 'playback_continue_60s', 'playback_recovered', 'playback_skip']) {
  const body = player.slice(player.indexOf(`trackEvent("${name}"`)).split('});')[0]
  assert.match(body, /proof_version: "v2"/, `${name} must join the same cohort`)
}
console.log('Recent-change behavior tests passed: catalogue, credits, release relationships, fresh discovery, private history links, chat fallback and v2 playback reporting.')
