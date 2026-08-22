import assert from 'node:assert/strict'
import fs from 'node:fs'

const discovery = fs.readFileSync('src/lib/discovery.ts', 'utf8')
const details = fs.readFileSync('src/components/ExploreItemDetails.tsx', 'utf8')
const search = fs.readFileSync('src/app/search/page.tsx', 'utf8')
const library = fs.readFileSync('src/app/library/page.tsx', 'utf8')
const api = fs.readFileSync('src/app/api/library/route.ts', 'utf8')

assert.match(
  discovery,
  /export type DiscoveryKind =[^\n]*'track'[^\n]*'artist'[^\n]*'show'[^\n]*'beat'[^\n]*'release'/,
  'DiscoveryItem must support saved beats and releases',
)

assert.match(details, /function canonicalLibraryId\(/, 'Detail sheet must canonicalize Library ids')
assert.match(
  details,
  /id:\s*canonicalLibraryId\(detail\.kind,\s*detail\.id\)/,
  'Detail sheet must store the same prefixed id used by Explore cards',
)
assert.match(details, /kind:\s*detail\.kind/, 'Detail sheet must preserve track/beat/release kind in Library')
assert.doesNotMatch(
  details,
  /detail\.kind === 'track'\s*\?\s*<LibraryAction/,
  'Save must not remain track-only in the detail sheet',
)

assert.match(
  search,
  /\.\.\.releases\.map\(item\s*=>\s*\{[\s\S]*?detail:\s*\{[\s\S]*?kind:\s*'release'/,
  'Published releases must expose Explore details so they can be saved',
)

assert.match(
  library,
  /Save tracks, beats and releases you want to find again\./,
  'Library Saved empty-state copy must describe the supported saved objects',
)

assert.match(api, /const sections: LibrarySection\[\] = \['favourites', 'follows', 'history'\]/)
assert.match(api, /item_id:\s*item\.id/)

console.log('discovery library save contract: ok')
