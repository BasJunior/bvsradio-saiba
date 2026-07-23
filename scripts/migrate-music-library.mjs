import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const files = [
  'bvs-radio-robert-gabriel-mugabe-international-airport.mp3',
  'bvs-radio-slide-mix.mp3',
  'bvs-brx-never-ending-mix.mp3',
  'bvs-radio-starve.mp3',
  'bvs-radio-ab2c-mix.mp3',
  'bvs-radio-nerve-mix.mp3',
  'bvs-radio-on-the-moon-mix.mp3',
  'bvs-whills-brx-deep.mp3',
  'bvs-brx-uptown-wins.mp3',
  'bvs-radio-having-fun.mp3',
  'bvs-brx-want-sumo.mp3',
  'bvs-party-tarpy-mix.mp3',
  'bvs-radio-sad-addict-mix.mp3',
  'calm-beast-mahendere-master.mp3',
]

function env(raw) {
  return Object.fromEntries(raw.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const at = line.indexOf('='); let value = line.slice(at + 1)
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1)
    return [line.slice(0, at), value]
  }))
}
function title(file) {
  return file.replace(/\.[^.]+$/, '').replace(/^\d+\.\s*/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

let config = process.env
if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
  const envFile = process.env.BVS_MIGRATION_ENV_FILE || path.join(root, '.env.vercel.production')
  config = { ...process.env, ...env(await fs.readFile(envFile, 'utf8')) }
}
const url = config.NEXT_PUBLIC_SUPABASE_URL
const key = config.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase production credentials unavailable')
const auth = { apikey: key, Authorization: `Bearer ${key}` }

for (const bucket of [{ id: 'bvsradio-audio', public: true }, { id: 'show-episodes', public: false }]) {
  const create = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: bucket.id, name: bucket.id, public: bucket.public }),
  })
  const createBody = create.ok ? '' : await create.text()
  if (!create.ok && create.status !== 409 && !createBody.includes('"statusCode":"409"')) throw new Error(`Bucket ${bucket.id}: ${createBody}`)
}

const owners = await fetch(`${url}/rest/v1/profiles?role=in.(admin,artist)&select=id,role&limit=20`, { headers: auth })
if (!owners.ok) throw new Error(await owners.text())
const profiles = await owners.json(); const owner = profiles.find(p => p.role === 'admin') || profiles[0]
if (!owner) throw new Error('Admin or artist profile required')

let count = 0
for (const file of files) {
  const object = `archive/${encodeURIComponent(file).replace(/%/g, '_')}`
  const fileUrl = `${url}/storage/v1/object/public/bvsradio-audio/${object}`
  const lookup = await fetch(`${url}/rest/v1/tracks?file_url=eq.${encodeURIComponent(fileUrl)}&select=id&limit=1`, { headers: auth })
  if (!lookup.ok) throw new Error(await lookup.text())
  const existing = await lookup.json()
  if (!existing.length) {
    const upload = await fetch(`${url}/storage/v1/object/bvsradio-audio/${object}`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' },
      body: await fs.readFile(path.join(root, 'public', 'music', file)),
    })
    if (!upload.ok) throw new Error(`Upload ${file}: ${await upload.text()}`)
  }
  const payload = { user_id: owner.id, title: title(file), artist_name: 'BVS archive', genre: 'BVS archive',
    description: 'Preserved BVS Radio archive recording.', file_url: fileUrl,
    artwork_url: '/music/Bvs-3000x3000%202.png', is_public: true, is_featured: false,
    editorial_status: 'approved', in_rotation: true, rotation_added_at: new Date().toISOString(),
    reviewed_by: owner.id, reviewed_at: new Date().toISOString() }
  const save = await fetch(existing.length ? `${url}/rest/v1/tracks?id=eq.${existing[0].id}` : `${url}/rest/v1/tracks`, {
    method: existing.length ? 'PATCH' : 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
  if (!save.ok) throw new Error(`Save ${file}: ${await save.text()}`)
  process.stdout.write(`Migrated ${++count}/${files.length}: ${file}\n`)
}
process.stdout.write(`Archive migration complete: ${count} tracks\n`)
