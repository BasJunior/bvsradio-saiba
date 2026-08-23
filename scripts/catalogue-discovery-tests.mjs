import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const catalogue = await readFile(new URL('../src/app/catalogue/page.tsx', import.meta.url), 'utf8')
const artists = await readFile(new URL('../src/components/PublishedArtistsShelf.tsx', import.meta.url), 'utf8')
const producers = await readFile(new URL('../src/components/PublishedProducersShelf.tsx', import.meta.url), 'utf8')
const releases = await readFile(new URL('../src/components/PublishedAlbumsShelf.tsx', import.meta.url), 'utf8')

assert.doesNotMatch(catalogue, /Catalogue shelves|Hide shelves|Show shelves|shelvesExpanded|setShelfMode/,
  'catalogue must not expose the old expandable shelf UI')
assert.match(catalogue, /Trending on BVS/,
  'catalogue keeps one useful trending discovery signal')
assert.match(catalogue, /rankCollections\(activeCollectionCards, trendingScores, "trending"\)[\s\S]*?\.filter\([\s\S]*?collection\.score[\s\S]*?collection\.plays[\s\S]*?\.slice\(0, 5\)/,
  'trending must be play/score-backed and capped')
assert.match(catalogue, /source: "catalogue_discovery"/,
  'collection discovery analytics must no longer identify itself as a shelf')
assert.match(catalogue, /<PublishedArtistsShelf \/>[\s\S]*?<PublishedAlbumsShelf \/>/,
  'music keeps artist and release discovery without cover shelves')
assert.match(catalogue, /Producer directory[\s\S]*?<PublishedProducersShelf/,
  'beats keeps a compact producer directory')
assert.match(catalogue, /id="browse"/,
  'the main catalogue browse grid remains the primary surface')
assert.match(catalogue, /fetch\("\/api\/catalogue\/shelves"/,
  'existing collection data remains reusable behind the new discovery UI')
assert.match(catalogue, /fetch\(`\/api\/catalogue\/trending\?names=\$\{names\}`/,
  'existing real trending signal remains wired')
assert.match(catalogue, /writeCartLines\(cart/,
  'cart persistence remains intact')
assert.match(catalogue, /new CustomEvent\("bvs:queue"/,
  'player queue integration remains intact')
assert.match(catalogue, /href="\/checkout"/,
  'catalogue commerce still routes to checkout')

assert.match(artists, /Artist directory/,
  'artist discovery is now a directory')
assert.match(artists, /h-12 w-12[\s\S]*?rounded-full/,
  'artist directory uses compact identity rows instead of large cover cards')
assert.match(releases, /Release directory/,
  'release discovery is now a directory')
assert.match(releases, /h-14 w-14/,
  'release directory uses compact rows')
assert.match(producers, /Open crate →/,
  'producer directory preserves the direct filtered-crate action')
assert.match(producers, /grid gap-2 md:grid-cols-2/,
  'producer discovery uses compact directory rows')

console.log('catalogue discovery replacement contract: ok')
