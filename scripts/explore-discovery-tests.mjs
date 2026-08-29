import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [search, layout, mobileCss, details, flags, order, artistApi, producerApi, artistsPage, producersPage, iosShell, catalogueLayout, catalogueJump, cataloguePage, beatstoreServer, catalogueListings] = await Promise.all([
  read('src/app/search/page.tsx'),
  read('src/app/search/layout.tsx'),
  read('src/app/search/explore-mobile.css'),
  read('src/components/ExploreItemDetails.tsx'),
  read('src/lib/feature-flags.ts'),
  read('src/lib/fair-discovery-order.ts'),
  read('src/app/api/artists/route.ts'),
  read('src/app/api/producers/route.ts'),
  read('src/app/music/artists/page.tsx'),
  read('src/app/music/producers/page.tsx'),
  read('src/app/app/[surface]/page.tsx'),
  read('src/app/catalogue/layout.tsx'),
  read('src/components/CatalogueDeepLinkJump.tsx'),
  read('src/app/catalogue/page.tsx'),
  read('src/lib/beatstore-server.ts'),
  read('src/lib/catalogue-listings.ts'),
])

assert.match(search, /ExploreItemDetails/, 'Explore must ship contextual item details')
assert.match(search, /Fresh/, 'Explore keeps Fresh mode')
assert.match(search, /On BVS/, 'Explore keeps rotation mode')
assert.match(search, /Creators/, 'Explore keeps creator mode')
assert.match(search, /Beats & Tools/, 'Explore keeps beat and service discovery mode')
assert.match(search, /Shows & Stories/, 'Explore keeps culture mode')
assert.match(search, /\/api\/catalogue\/listings/, 'Explore uses live catalogue listings')
assert.match(search, /\/api\/artists/, 'Explore uses published artists')
assert.match(search, /\/api\/producers/, 'Explore uses published producers')
assert.match(search, /\/api\/beats/, 'Explore uses live beats')
assert.match(search, /\/api\/releases\/public/, 'Explore uses published releases')
assert.match(search, /\/api\/marketplace/, 'Explore includes creator services')
assert.match(layout, /explore-mobile\.css/, 'Explore mobile treatment must be loaded')
assert.match(layout, /className="explore-route"/, 'Explore mobile CSS must be scoped to the route')
assert.match(mobileCss, /@media \(max-width: 639px\)/, 'Explore keeps dedicated mobile rules')
assert.match(details, /role="dialog"/, 'Explore details must remain accessible dialog UI')
assert.match(details, /Play release|Preview beat|Play on BVS/, 'Explore details keep listening actions')
assert.match(flags, /NEXT_PUBLIC_BVS_EXPLORE_MODES !== "0"/, 'Explore v2 must be live by default with an emergency kill switch')

assert.match(order, /Africa\/Harare/, 'fair discovery rotation must use the BVS day')
assert.match(order, /sort\(\(a, b\) => a\.id\.localeCompare\(b\.id\)\)/, 'fair rotation must start from a stable canonical order')
assert.match(order, /scope.*day/s, 'fair rotation must vary by surface and day')
assert.match(order, /fairCreatorDailyOrder/, 'marketplace discovery must expose creator-aware fair rotation')
assert.match(order, /while \(remaining > 0\)[\s\S]*for \(const creator of creators\)/, 'creator-aware ordering must round-robin creators')
for (const source of [artistApi, producerApi, artistsPage, producersPage]) {
  assert.match(source, /fairDailyOrder/, 'artist and producer discovery surfaces must use fair daily rotation')
}
assert.match(artistApi, /Cache-Control.*no-store/s, 'artist API must not freeze a prior daily order in cache')
assert.match(producerApi, /Cache-Control.*no-store/s, 'producer API must not freeze a prior daily order in cache')

assert.match(beatstoreServer, /fairCreatorDailyOrder/, 'public BeatStore browse must use creator-aware fair ordering')
assert.match(beatstoreServer, /catalogue-beatstore/, 'BeatStore fairness must use its own daily rotation scope')
assert.match(beatstoreServer, /producer_user_id/, 'BeatStore fairness must group results by producer ownership')
assert.match(beatstoreServer, /listBeatsForProducer[\s\S]*order=created_at\.desc/, 'producer management must remain newest-first')
assert.match(catalogueListings, /fairCreatorDailyOrder/, 'public music catalogue must use artist-aware fair ordering')
assert.match(catalogueListings, /catalogue-music/, 'music fairness must use its own daily rotation scope')
assert.match(catalogueListings, /\(listing\) => listing\.artist/, 'music fairness must group public listings by artist')

assert.match(catalogueLayout, /CatalogueDeepLinkJump/, 'Catalogue must mount the filtered deep-link resolver')
assert.match(catalogueJump, /window\.location\.hash/, 'Catalogue deep links must honor the requested hash target')
assert.match(catalogueJump, /MutationObserver/, 'Catalogue deep links must wait for filtered content to render when necessary')
assert.match(catalogueJump, /scrollIntoView/, 'Catalogue deep links must jump to the rendered target')
assert.match(cataloguePage, /id="beatstore"/, 'Catalogue must retain a BeatStore hash target')
assert.match(cataloguePage, /searchParams\.get\("q"\)/, 'Catalogue must derive the visible filtered item from the q query parameter')

assert.doesNotMatch(iosShell, /ExploreItemDetails|@\/app\/search|src\/app\/search|CatalogueDeepLinkJump/, 'web discovery/deep-link changes must not leak into the locked iOS shell')

console.log('Explore v2 + fair creator/marketplace rotation + catalogue deep-link assertions passed.')
