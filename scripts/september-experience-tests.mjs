import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const home = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8')
const pulse = await readFile(new URL('../src/components/flow/BvsPulse.tsx', import.meta.url), 'utf8')
const footer = await readFile(new URL('../src/components/layout/Footer.tsx', import.meta.url), 'utf8')
const shop = await readFile(new URL('../src/app/shop/page.tsx', import.meta.url), 'utf8')

assert.match(layout, /t==='light'\|\|t==='dark'\?t:'dark'/, 'September shell should default new visitors to dark while preserving explicit theme preference')
assert.match(home, /<HomeListenPanel \/>/, 'home must keep the real BVS station player entry surface')
assert.match(home, /<PublishedArtistsShelf limit=\{6\} \/>/, 'home must keep real published artist discovery')
assert.match(home, /<PublishedAlbumsShelf \/>/, 'home must keep real published release discovery')
assert.match(home, /<HomeBeatRail \/>/, 'home must keep the real BeatStore discovery rail')
assert.match(home, /flowV2Flags\.pulse \? <BvsPulse \/>/, 'home must keep Pulse connected through the existing feature flag')
assert.match(home, /getPublicProgrammes\(\)/, 'show cards must come from the BVS programme source')

for (const label of ['Listen', 'Discover', 'Work', 'Keep']) {
  assert.match(home, new RegExp(`label: "${label}"`), `home must expose the ${label} intent`)
}

assert.match(home, /\/marketplace\/wolfbridges-studio/, 'WolfBridges should be surfaced as a Marketplace provider, not a parallel studio system')
assert.match(home, /\/marketplace\/bvs-studio-services/, 'official BVS services should be surfaced inside Marketplace')
assert.doesNotMatch(home, /href="\/shop"/, 'September home must not send users to a competing shop surface')
assert.match(shop, /redirect\("\/marketplace\/bvs-studio-services"\)/, 'legacy shop URL must remain a compatibility redirect into Marketplace')
assert.doesNotMatch(footer, /href="\/shop"/, 'footer must not advertise a second services system')
assert.match(footer, /href="\/marketplace"/, 'footer must expose the unified Marketplace')

assert.match(pulse, /items\.slice\(0, 6\)/, 'home Pulse should remain compact instead of overwhelming the session flow')
assert.match(pulse, /scope=following/, 'Pulse must retain follow-aware personalization')
assert.match(pulse, /private listener activity stays private/, 'Pulse must keep the privacy boundary visible')

console.log('September experience architecture contract: ok')
