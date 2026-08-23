import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const mobile = await readFile(new URL('../src/components/layout/MobileFlowNav.tsx', import.meta.url), 'utf8')
const navbar = await readFile(new URL('../src/components/layout/Navbar.tsx', import.meta.url), 'utf8')
const search = await readFile(new URL('../src/app/search/page.tsx', import.meta.url), 'utf8')

assert.match(mobile, /href:\s*['"]\/catalogue\?type=beat#beatstore['"],\s*label:\s*['"]Beats['"]/, 'mobile primary nav must give Beats the permanent slot')
assert.doesNotMatch(mobile, /label:\s*['"]Market['"]/, 'Marketplace must not consume a permanent mobile tab')
assert.match(mobile, /useSearchParams/, 'mobile nav must distinguish the beat catalogue from normal Discover routes')

assert.match(navbar, /href:\s*['"]\/marketplace['"],\s*label:\s*['"]Marketplace['"]/, 'desktop/mobile menu must retain a direct Marketplace route')
assert.doesNotMatch(navbar, /href:\s*['"]\/shop['"],\s*label:\s*['"]BVS Studio Services['"]/, 'navigation must not present /shop as a competing services destination')

assert.match(search, /Marketplace/, 'Discover must visibly surface Marketplace')
assert.match(search, /href="\/marketplace"/, 'Discover Marketplace gateway must route into the unified Marketplace')
assert.match(search, /Studios & engineers/, 'Discover must explain Marketplace through provider intent')
assert.match(search, /Mixing & mastering/, 'Discover must expose service intent without creating another section')

console.log('marketplace navigation contract: ok')
