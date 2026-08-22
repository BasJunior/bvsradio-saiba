import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const route = await readFile(new URL('../src/app/api/admin/editorial/route.ts', import.meta.url), 'utf8')

assert.match(
  route,
  /async function requiredJson\(path: string\)[\s\S]*?if \(!response\.ok\) throw new Error\('MIGRATION'\)[\s\S]*?return response\.json\(\)/,
  'core editorial reads must have a fail-closed requiredJson helper',
)

assert.match(
  route,
  /async function loadBeatsSection\(\)[\s\S]*?requiredJson\('beats\?select=\*,beat_licence_options\(\*\)&order=updated_at\.desc&limit=100'\)/,
  'BeatStore queue must fail closed when the primary beats read fails',
)

assert.match(
  route,
  /async function loadReleasesSection\(\)[\s\S]*?requiredJson\('releases\?select=\*&order=created_at\.desc&limit=100'\)/,
  'release queue must fail closed when the primary releases read fails',
)

assert.match(
  route,
  /async function loadReleasesSection\(\)[\s\S]*?requiredJson\('release_tracks\?select=\*&order=position\.asc&limit=500'\)/,
  'release membership must fail closed instead of rendering an incomplete release queue',
)

assert.match(
  route,
  /async function loadReleasesSection\(\)[\s\S]*?requiredJson\('tracks\?release_id=not\.is\.null&select=id,in_rotation,isrc,spotify_url&limit=1000'\)/,
  'release catalogue state must fail closed instead of silently losing rotation/ISRC context',
)

assert.match(
  route,
  /async function optionalJson\(path: string\)[\s\S]*?if \(!response\.ok\) return \[\]/,
  'supporting optional reads should preserve graceful empty fallback',
)

assert.match(
  route,
  /optionalJson\('beat_review_messages\?select=\*&order=created_at\.asc&limit=500'\)/,
  'beat review messages remain optional supporting context',
)

assert.match(
  route,
  /optionalJson\('known_isrc_map\?select=isrc,title,artist_name,upc,spotify_album_url,source&order=title\.asc&limit=2000'\)/,
  'known ISRC enrichment remains optional supporting context',
)

console.log('editorial fail-closed contract: ok')
