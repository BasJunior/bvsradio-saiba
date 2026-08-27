import assert from 'node:assert/strict'
import fs from 'node:fs'

const server = fs.readFileSync('src/lib/song-workspaces-server.ts', 'utf8')
const collectionRoute = fs.readFileSync('src/app/api/creator/song-workspaces/route.ts', 'utf8')
const itemRoute = fs.readFileSync('src/app/api/creator/song-workspaces/[id]/route.ts', 'utf8')
const releaseForm = fs.readFileSync('src/components/ReleaseSubmitForm.tsx', 'utf8')

// Vercel deliberately excludes root Supabase migration files. When the migration
// snapshot is present (local/CI checkout), assert the database-side invariants too.
if (fs.existsSync('supabase-song-workspaces.sql')) {
  const sql = fs.readFileSync('supabase-song-workspaces.sql', 'utf8')
  assert.match(sql, /alter table public\.song_workspaces enable row level security/i, 'Song Workspace must keep RLS enabled')
  assert.match(sql, /unique \(user_id, order_id, beat_id\)/i, 'one paid beat/order should create at most one workspace per buyer')
  assert.match(sql, /create policy "song workspaces select own"[\s\S]*auth\.uid\(\) = user_id/i, 'browser reads must be owner-only')
  assert.doesNotMatch(sql, /create policy[\s\S]{0,120}for insert/i, 'browser inserts must remain disabled')
  assert.doesNotMatch(sql, /create policy[\s\S]{0,120}for update/i, 'browser updates must remain disabled; writes go through the authenticated BVS API')
  assert.doesNotMatch(sql, /create policy[\s\S]{0,120}for delete/i, 'browser deletes must remain disabled')
  assert.match(sql, /o\.customer_user_id = sw\.user_id/i, 'BVS clearance trigger must verify the order buyer')
  assert.match(sql, /o\.status in \('paid', 'fulfilled'\)/i, 'BVS clearance trigger must verify paid status')
  assert.match(sql, /r\.user_id = sw\.user_id/i, 'BVS clearance trigger must bind the release to the workspace owner')
  assert.match(sql, /BVS_SONG_WORKSPACE:/, 'BVS-issued clearance must use a recognizable server-verifiable marker')
}

assert.match(server, /customer_user_id=eq\.\$\{encodeURIComponent\(userId\)\}/, 'entitlement lookup must bind the order to the signed-in buyer')
assert.match(server, /\['paid', 'fulfilled'\]\.includes\(String\(order\.status\)\)/, 'unpaid orders must never create an entitlement')
assert.match(server, /beatItems\.find\(\(candidate\) => beatIdFromItem\(candidate\) === requestedBeatId\)/, 'requested beat must actually exist in the buyer order')
assert.match(server, /user_id=eq\.\$\{encodeURIComponent\(userId\)\}/, 'workspace reads and writes must be scoped to owner ID')
assert.match(server, /beat\.preview_path/, 'Lyrics Pad playback must use the safe beat preview')
assert.doesNotMatch(server, /signedAudio\(beat\.master_path/, 'Lyrics Pad must not expose the producer private master as workspace playback')

assert.match(collectionRoute, /songWorkspaceUser\(request\)/, 'workspace creation must require an authenticated BVS user')
assert.match(collectionRoute, /findBeatEntitlement\(user\.id, orderReference, beatId\)/, 'workspace creation must verify the paid beat entitlement server-side')
assert.match(collectionRoute, /status: 403/, 'failed entitlement verification must fail closed')

assert.match(itemRoute, /getOwnSongWorkspace\(user\.id, id\)/, 'workspace detail must be owner-scoped')
assert.match(itemRoute, /findBeatEntitlement\(user\.id, row\.order_reference, row\.beat_id\)/, 'workspace access must re-check the paid licence rather than trusting the workspace row alone')
assert.doesNotMatch(itemRoute, /releaseId\?:/, 'browser PATCH payload must not accept a release ID')
assert.match(itemRoute, /'draft', 'ready_to_release'/, 'browser workspace status must be bounded to authoring states')

assert.match(releaseForm, /materialType === 'leased_beat' && autoLicensedBeat/, 'BVS purchased beats should use attached entitlement rather than request duplicate manual proof')
assert.match(releaseForm, /BVS_SONG_WORKSPACE:\$\{songWorkspaceId\}/, 'release evidence must carry the workspace marker to server verification')
assert.match(releaseForm, /setMaterialTypes\(\['leased_beat'\]\)/, 'Song Workspace release must preserve leased-beat declaration')

console.log('song workspace entitlement tests passed')
