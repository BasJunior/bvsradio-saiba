import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [storefronts, storefrontPage, ledger, migration] = await Promise.all([
  read('src/lib/marketplace-storefronts.ts'),
  read('src/app/marketplace/[slug]/page.tsx'),
  read('src/lib/commerce-ledger.ts'),
  read('supabase-marketplace-commerce-types.sql'),
])

assert.match(storefronts, /id: 'beat-lease-mp3'[\s\S]*?bookingMode: 'checkout'/, 'Wolf MP3 lease must go to checkout')
assert.match(storefronts, /id: 'beat-lease-mp3-wav'[\s\S]*?bookingMode: 'checkout'/, 'Wolf MP3 + WAV lease must go to checkout')
assert.match(storefronts, /officialBvsServices\.map[\s\S]*?bookingMode: 'checkout' as const/, 'official BVS service packages must use checkout')
assert.match(storefronts, /seededMarketplaceServiceRef/, 'seeded storefront services need stable authoritative checkout references')
assert.match(storefronts, /resolveSeededMarketplaceService/, 'server checkout must be able to resolve seeded service prices')

assert.match(storefrontPage, /writeCartLines\(\[line\]\)/, 'service checkout must isolate one provider job per cart')
assert.match(storefrontPage, /router\.push\("\/checkout"\)/, 'storefront offers must continue into BVS checkout')
assert.match(storefrontPage, /`marketplace:\$\{seededMarketplaceServiceRef/, 'seeded offers must use server-resolvable marketplace service ids')
assert.match(storefrontPage, /Checkout \{pkg\.name\}/, 'tiered seeded services must expose exact-package checkout buttons')
assert.match(storefrontPage, /See availability &amp; book/, 'calendar services must keep real availability before checkout')
assert.doesNotMatch(storefrontPage, /contact\?subject=/, 'current provider offers must not fall back to contact instead of commerce')

assert.match(ledger, /resolveSeededMarketplaceService/, 'commerce ledger must resolve seeded marketplace services authoritatively')
assert.match(ledger, /id\.startsWith\("marketplace:"\)/, 'commerce ledger must recognize seeded marketplace service ids')
assert.match(ledger, /unitAmount = seededService\.priceUsd/, 'browser prices must not be authoritative for seeded services')
assert.match(ledger, /sku = `marketplace-service:\$\{seededRef\}`/, 'seeded services need stable commerce ledger SKUs')

assert.match(migration, /'creator_product'::text/, 'commerce constraint must allow creator products')
assert.match(migration, /'creator_service'::text/, 'commerce constraint must allow creator services')

console.log('marketplace checkout flow contract: ok')
