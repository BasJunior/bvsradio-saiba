import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [
  catalogue,
  artistsShelf,
  albumsShelf,
  producersShelf,
  artistPage,
  albumPage,
  artistsDir,
  producersDir,
  artworkTile,
  portraitTile,
  collageTile,
  shelf,
  search,
] = await Promise.all([
  read('src/app/catalogue/page.tsx'),
  read('src/components/PublishedArtistsShelf.tsx'),
  read('src/components/PublishedAlbumsShelf.tsx'),
  read('src/components/PublishedProducersShelf.tsx'),
  read('src/app/artist/[slug]/page.tsx'),
  read('src/app/album/[slug]/page.tsx'),
  read('src/app/music/artists/page.tsx'),
  read('src/app/music/producers/page.tsx'),
  read('src/components/discovery/ArtworkPlayTile.tsx'),
  read('src/components/discovery/ArtistPortraitTile.tsx'),
  read('src/components/discovery/CollectionCollageTile.tsx'),
  read('src/components/discovery/DiscoveryShelf.tsx'),
  read('src/app/search/page.tsx'),
])

assert.match(shelf, /bvs-discovery-shelf/, 'discovery shelves must be horizontally browsable')
assert.match(shelf, /overflow-x-auto/, 'discovery shelves must scroll sideways without leaving the page')
assert.match(artworkTile, /title="Play in site player"/, 'play must sit on artwork')
assert.match(artworkTile, /commerceLabel/, 'buy/license must stay beneath the cover')
assert.match(portraitTile, /rounded-full/, 'artist portraits must be circular')
assert.match(collageTile, /Curated by/, 'collections must name a curator when present')
assert.match(collageTile, /itemCount/, 'collections must surface an item count')

assert.match(catalogue, /ArtworkPlayTile/, 'catalogue listings must be artwork-led')
assert.match(catalogue, /CollectionCollageTile/, 'catalogue must browse collections as artwork shelves')
assert.match(catalogue, /License/, 'beat commerce must stay labelled as License')
assert.match(catalogue, /Buy/, 'music commerce must stay labelled as Buy')
assert.doesNotMatch(catalogue, /overflow-hidden rounded-2xl border border-white\/10 bg-bg-card\/45/, 'catalogue covers must not sit in boxed cards')

assert.match(artistsShelf, /ArtistPortraitTile/, 'home/catalogue artist row must use circular portraits')
assert.match(albumsShelf, /ArtworkPlayTile/, 'release shelf must keep square covers with play')
assert.match(producersShelf, /ArtistPortraitTile/, 'producer row must use circular portraits')
assert.match(producersShelf, /License crate/, 'producer shelf must separate licensing from the portrait')

assert.match(artistPage, /Genre tags/, 'artist destinations must expose genre tags')
assert.match(artistPage, /aspect-\[4\/5\]/, 'artist pages must be photography-led')
assert.match(albumPage, /Tracklist/, 'release pages must keep a tracklist')
assert.match(albumPage, /Credits/, 'release pages must surface credits')
assert.match(albumPage, /Digital/, 'release pages must describe the format')
assert.match(albumPage, /Buy or license on BVS/, 'release pages must keep a support path under the artwork')

assert.match(artistsDir, /rounded-full/, 'artist directory portraits must be circular')
assert.match(producersDir, /rounded-full/, 'producer directory portraits must be circular')
assert.match(search, /rounded-full/, 'explore must use circular portraits for artists and producers')
assert.match(search, /scroll-mt-28/, 'explore heading must clear the sticky navigation')

console.log('discovery scene assertions passed.')
