import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  extractStreamSecret,
  parseSrsHookBody,
  validPublicId,
} from '../src/lib/bvs-live-protocol.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

assert.equal(validPublicId('evt_abcdefgh'), true)
assert.equal(validPublicId('evt_1234567890abcdef'), true)
assert.equal(validPublicId('evt_short'), false)
assert.equal(validPublicId('evt_abcdefgh.secret'), false)

const secret = '0123456789abcdef0123456789abcdef'
assert.equal(extractStreamSecret(`?sk=${secret}`), secret)
assert.equal(extractStreamSecret(`sk=${secret}`), secret)
assert.equal(extractStreamSecret(`sk=${secret}&sk=${secret}`), null)
assert.equal(extractStreamSecret('sk=not-hex'), null)

const form = await parseSrsHookBody(new Request('https://beta.invalid/hook', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    action: 'on_publish',
    client_id: 'client-1',
    ip: '127.0.0.1',
    app: 'live',
    stream: 'evt_abcdefgh',
    param: `?sk=${secret}`,
    server_id: 'srs-1',
  }),
}))
assert.equal(form?.stream, 'evt_abcdefgh')
assert.equal(form?.param, `?sk=${secret}`)

const json = await parseSrsHookBody(new Request('https://beta.invalid/hook', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'on_unpublish',
    client_id: 42,
    app: 'live',
    stream: 'evt_abcdefgh',
    param: '',
  }),
}))
assert.equal(json?.action, 'on_unpublish')
assert.equal(json?.clientId, '42')

const [server, publishRoute, unpublishRoute, showVideo, schema, pkg] = await Promise.all([
  read('src/lib/bvs-live-server.ts'),
  read('src/app/api/live/srs/on-publish/route.ts'),
  read('src/app/api/live/srs/on-unpublish/route.ts'),
  read('src/components/ShowVideo.tsx'),
  read('supabase-bvs-live-phase1.sql'),
  read('package.json'),
])

assert.match(server, /BVS_LIVE_HOOK_SECRET/)
assert.match(server, /timingSafeEqual/)
assert.match(server, /BVS_LIVE_KEY_PEPPER/)
assert.match(server, /createHmac\('sha256'/)
assert.match(server, /SUPABASE_SERVICE_ROLE_KEY/)
assert.match(server, /BVS_LIVE_PLAYBACK_ORIGIN/)
assert.doesNotMatch(server, /creator_id/)
assert.doesNotMatch(server, /console\.(?:log|info|warn|error)\([^\n]*(?:param|authorization|secret)/i)

assert.match(publishRoute, /export async function POST/)
assert.match(unpublishRoute, /export async function POST/)
assert.doesNotMatch(publishRoute, /export async function GET/)
assert.doesNotMatch(unpublishRoute, /export async function GET/)

assert.match(showVideo, /import Hls from 'hls\.js'/)
assert.match(showVideo, /canPlayType\('application\/vnd\.apple\.mpegurl'\)/)
assert.match(showVideo, /Hls\.isSupported\(\)/)
assert.doesNotMatch(showVideo, /videojs-contrib-hls|video-js/i)

assert.match(schema, /create table if not exists public\.show_streams/)
assert.match(schema, /create table if not exists public\.show_stream_events/)
assert.match(schema, /active_client_id/)
assert.match(schema, /stale_unpublish_ignored/)
assert.match(schema, /status <> 'live'/)
assert.match(schema, /enable row level security/)
assert.match(schema, /revoke all on table public\.show_streams, public\.show_stream_events from public, anon, authenticated/)
assert.match(schema, /grant execute on function public\.bvs_live_mark_published/)
assert.match(schema, /grant execute on function public\.bvs_live_mark_unpublished/)

const packageJson = JSON.parse(pkg)
assert.equal(packageJson.dependencies['hls.js'], '1.6.14')
assert.equal(packageJson.scripts['test:bvs-live-phase1'], 'node --experimental-strip-types scripts/bvs-live-phase1-tests.mjs')

console.log('BVS Live Phase 1 contract tests passed')
