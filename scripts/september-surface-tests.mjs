import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [layout, home, pulse, mobile, footer, creatorLayout, shop, storefronts] = await Promise.all([
  read('src/app/layout.tsx'),
  read('src/app/page.tsx'),
  read('src/components/flow/BvsPulse.tsx'),
  read('src/components/layout/MobileFlowNav.tsx'),
  read('src/components/layout/Footer.tsx'),
  read('src/app/creator/layout.tsx'),
  read('src/app/shop/page.tsx'),
  read('src/lib/marketplace-storefronts.ts'),
])

assert.match(layout, /const v=t==='light'\|\|t==='dark'\?t:'dark'/, 'new visitors must default to the dark September surface')

assert.match(home, /<HomeListenPanel\s*\/>/, 'the home session must expose the real BVS player above the fold')
assert.match(home, /<BvsIntentRail\s*\/>/, 'home must connect Listen, Discover, Work and Keep')
assert.match(home, /<MarketplaceSpotlight\s*\/>/, 'provider storefronts must be first-class on the home surface')
assert.match(home, /href="\/creator\/studio"/, 'Creator Studio must remain part of the same BVS journey')
assert.doesNotMatch(home, /href="\/shop"/, 'home must not revive the legacy parallel services destination')

assert.match(pulse, /variant="compact-row"/, 'Pulse must stay compact instead of competing with the music hierarchy')
assert.match(pulse, /items\.slice\(0, 6\)/, 'home Pulse must remain a high-signal subset')
assert.match(pulse, /\/api\/pulse\?scope=following/, 'Pulse must keep real follow-aware activity data')

assert.match(mobile, /href: "\/radio", label: "Listen"/, 'mobile navigation must expose the Listen intent')
assert.match(mobile, /href: "\/search", label: "Discover"/, 'mobile navigation must expose the Discover intent')
assert.match(mobile, /href: "\/marketplace", label: "Market"/, 'mobile navigation must route services through Marketplace')
assert.match(mobile, /href: "\/library", label: "Library"/, 'mobile navigation must preserve the Keep/Library intent')

assert.doesNotMatch(footer, /href="\/shop"/, 'footer must not present BVS Studio Services as a separate shop')
assert.match(footer, /href="\/marketplace\/wolfbridges-studio"/, 'WolfBridges must remain a provider storefront')
assert.match(footer, /href="\/marketplace\/bvs-studio-services"/, 'official BVS services must remain a Marketplace provider')

assert.match(creatorLayout, /data-bvs-surface="creator-workspace"/, 'Creator routes must share the September workspace visual shell')
assert.match(shop, /redirect\("\/marketplace\/bvs-studio-services"\)/, 'legacy shop traffic must land on the unified Marketplace provider')

assert.match(storefronts, /slug: 'wolfbridges-studio'/, 'WolfBridges seeded storefront must remain available')
assert.match(storefronts, /marketplaceStorefronts\(/, 'real approved providers must continue to merge with seeded storefronts')

console.log('September BVS surface contract: ok')
