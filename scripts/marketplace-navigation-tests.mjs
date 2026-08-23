import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const mobile = await readFile(new URL('../src/components/layout/MobileFlowNav.tsx', import.meta.url), 'utf8')
const navbar = await readFile(new URL('../src/components/layout/Navbar.tsx', import.meta.url), 'utf8')
const search = await readFile(new URL('../src/app/search/page.tsx', import.meta.url), 'utf8')
const home = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

assert.match(mobile, /href:\s*['"]\/catalogue\?type=beat#beatstore['"],[\s\S]*?label:\s*['"]Beats['"]/, 'mobile primary nav must give Beats the permanent slot')
assert.doesNotMatch(mobile, /label:\s*['"]Market['"]/, 'Marketplace must not consume a permanent mobile tab')
assert.match(mobile, /useSearchParams/, 'mobile nav must distinguish the beat catalogue from normal Discover routes')
assert.match(mobile, /pathname\.startsWith\(['"]\/catalogue['"]\)[\s\S]*?!beatCatalogue/, 'music catalogue must remain under Discover rather than falsely activating Beats')

assert.match(navbar, /href:\s*['"]\/marketplace['"]/, 'the menu must retain a direct Marketplace route')
assert.match(search, /label:\s*['"]Services['"],\s*value:\s*['"]service['"]/, 'Discover must keep services as a first-class filter')
assert.match(search, /\/marketplace\?listing=/, 'published creator services in Discover must open the unified Marketplace flow')
assert.match(home, /MarketplaceSpotlight/, 'Home must keep Marketplace as a prominent destination outside the mobile dock')
assert.match(home, /href="\/marketplace"/, 'Home must keep a direct Marketplace entry point')

console.log('marketplace navigation contract: ok')
