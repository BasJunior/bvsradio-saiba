import assert from 'node:assert/strict'
import fs from 'node:fs'

const catalogue = fs.readFileSync('src/app/catalogue/page.tsx', 'utf8')
const editorial = fs.readFileSync('src/app/api/admin/editorial/route.ts', 'utf8')

// Production catalogue may show Trending only when real play/score data exists.
assert.match(catalogue, /rankCollections\(activeCollectionCards, trendingScores, "trending"\)/)
assert.match(catalogue, /\(collection\.score \|\| 0\) > 0 \|\| \(collection\.plays \|\| 0\) > 0/)
assert.match(catalogue, /trendingCards\.length > 0/)
assert.match(catalogue, /Trending on BVS/)
assert.match(catalogue, /No editorial placement is used to manufacture the order\./)
assert.doesNotMatch(catalogue, /const \[shelfMode, setShelfMode\]/)
assert.doesNotMatch(catalogue, /const \[shelvesExpanded, setShelvesExpanded\]/)
assert.doesNotMatch(catalogue, />Featured</)
assert.doesNotMatch(catalogue, />New</)
assert.doesNotMatch(catalogue, /Catalogue shelves/)

// Do not accidentally pull later beta catalogue/player concepts into this production slice.
assert.doesNotMatch(catalogue, /originFilter/)
assert.doesNotMatch(catalogue, /listingSource/)
assert.doesNotMatch(catalogue, /UniversalPlayerPresentation/)
assert.doesNotMatch(catalogue, /@\/lib\/bvs-playback/)

// Core editorial queues fail closed instead of silently appearing empty.
assert.match(editorial, /async function requiredJson\(path: string\)/)
assert.match(editorial, /if \(!response\.ok\) throw new Error\('MIGRATION'\)/)
assert.match(editorial, /requiredJson\('beats\?select=\*,beat_licence_options\(\*\)&order=updated_at\.desc&limit=100'\)/)
assert.match(editorial, /requiredJson\('releases\?select=\*&order=created_at\.desc&limit=100'\)/)
assert.match(editorial, /requiredJson\('release_tracks\?select=\*&order=position\.asc&limit=500'\)/)
assert.match(editorial, /requiredJson\('tracks\?release_id=not\.is\.null&select=id,in_rotation,isrc,spotify_url&limit=1000'\)/)

// Supporting/optional metadata remains optional; this hardening is intentionally narrow.
assert.match(editorial, /optionalJson\('known_isrc_map\?select=isrc,title,artist_name,upc,spotify_album_url,source&order=title\.asc&limit=2000'\)/)
assert.match(editorial, /optionalJson\('release_contributors\?select=\*&order=created_at\.asc&limit=1000'\)/)

console.log('production trending + editorial safe boundary: ok')
