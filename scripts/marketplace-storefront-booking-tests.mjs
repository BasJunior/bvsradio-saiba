import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function optionalRead(url) {
  try {
    return await readFile(url, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

const storefronts = await readFile(new URL("../src/lib/marketplace-storefronts.ts", import.meta.url), "utf8");
const marketplace = await readFile(new URL("../src/app/marketplace/page.tsx", import.meta.url), "utf8");
const store = await readFile(new URL("../src/app/marketplace/[slug]/page.tsx", import.meta.url), "utf8");
const bookingPage = await readFile(new URL("../src/app/marketplace/[slug]/book/page.tsx", import.meta.url), "utf8");
const bookingApi = await readFile(new URL("../src/app/api/marketplace/bookings/route.ts", import.meta.url), "utf8");
const availabilityApi = await readFile(new URL("../src/app/api/marketplace/availability/route.ts", import.meta.url), "utf8");
const sellerApi = await readFile(new URL("../src/app/api/marketplace/route.ts", import.meta.url), "utf8");
const commerceLedger = await readFile(new URL("../src/lib/commerce-ledger.ts", import.meta.url), "utf8");
const availabilityDesk = await readFile(new URL("../src/components/MarketplaceAvailabilityDesk.tsx", import.meta.url), "utf8");
const providerMap = await readFile(new URL("../src/components/MarketplaceProviderMap.tsx", import.meta.url), "utf8");
const shop = await readFile(new URL("../src/app/shop/page.tsx", import.meta.url), "utf8");
const sql = await optionalRead(new URL("../supabase-marketplace-booking.sql", import.meta.url));

assert.match(storefronts, /slug: 'wolfbridges-studio'/, "WolfBridges must have one canonical storefront slug");
assert.match(storefronts, /slug === 'wolf-bridges'[\s\S]*?'wolfbridges-studio'/, "Wolf Bridges profile identity must claim the existing WolfBridges Studio slug");
assert.match(storefronts, /slug: canonicalMarketplaceStorefrontSlug\(displayName\)/, "Live Wolf profile must resolve through the canonical storefront mapper");
assert.match(storefronts, /location: 'Madokero, Harare'/, "WolfBridges location must match the supplied reference");
assert.match(storefronts, /heroImage: '\/images\/marketplace\/wolfbridges-studio\.jpg'/, "WolfBridges must use the supplied studio crop");
assert.match(storefronts, /id: 'record-mix-master-own-beat'[\s\S]*?priceUsd: 30/, "$30 own-beat recording/mix/master package must remain exact");
assert.match(storefronts, /id: 'record-beat-mix-master'[\s\S]*?priceUsd: 80/, "$80 beat + recording + mix/master package must remain exact");
assert.match(storefronts, /id: 'beat-lease-mp3'[\s\S]*?priceUsd: 30/, "$30 MP3 beat lease must remain exact");
assert.match(storefronts, /id: 'beat-lease-mp3-wav'[\s\S]*?priceUsd: 50/, "$50 MP3 + WAV beat lease must remain exact");
assert.match(storefronts, /policyNotes: \['No custom beats\.', 'No beat remakes\.'\]/, "WolfBridges no-custom/remake policy must stay visible");

assert.match(storefronts, /slug: 'uptown-music'/, "Up-Town Music must have one canonical storefront slug");
assert.match(storefronts, /location: 'Borrowdale, Harare'/, "Up-Town Music must publish Borrowdale, Harare");
assert.match(providerMap, /includes\("borrowdale"\)\) return \{ lat: -17\.7573, lng: 31\.1081 \}/, "Borrowdale must have its own approximate area pin");
assert.match(providerMap, /typeof explicitLat === "number"[\s\S]*?typeof explicitLng === "number"/, "Missing or null coordinates must use area coordinates rather than zero");
assert.match(storefronts, /'up-town-music'[\s\S]*?'uptownmusicent'[\s\S]*?return 'uptown-music'/, "Up-Town Music account names must claim the existing storefront");
assert.match(storefronts, /id: 'recording-session'[\s\S]*?priceUsd: 60/, "$60 per hour recording must match the Up-Town price list");
assert.match(storefronts, /id: 'mix-and-master'[\s\S]*?priceUsd: 100/, "$100 mix and master must match the Up-Town price list");
assert.match(storefronts, /id: 'beat-lease',[\s\S]*?priceUsd: 50/, "$50 beat lease must match the Up-Town price list");
assert.match(storefronts, /id: 'exclusive-beat-production'[\s\S]*?priceUsd: 200/, "$200 exclusive beat must match the Up-Town price list");
assert.match(storefronts, /id: 'full-production'[\s\S]*?priceUsd: 500/, "$500 full production must match the Up-Town price list");
const uptownSeed = storefronts.slice(storefronts.indexOf("slug: 'uptown-music'"), storefronts.indexOf("slug: 'bvs-studio-services'"));
assert.equal((uptownSeed.match(/bookingMode: 'calendar'/g) || []).length, 5, "All five Up-Town Music offers must expose provider-published availability and booking");
assert.doesNotMatch(uptownSeed, /bookingMode: '(enquiry|checkout)'/, "Unlinked Up-Town offers must use calendar requests, not checkout or Compare providers");
assert.match(store, /See availability &amp; book/, "The storefront must show the booking CTA");
assert.match(bookingPage, /has not published any open booking times yet/, "Up-Town bookings must never invent times when there are no published slots");
assert.match(storefronts, /if \(!provider \|\| !service \|\| service\.bookingMode === 'enquiry'\) return null/, "Enquiry-only services must not resolve to a payable checkout item");
assert.doesNotMatch(uptownSeed, /\+?\d{9,}|@[a-z0-9_.]+|instagram|whatsapp/i, "Up-Town Music must not publish off-platform contact details; sales communication stays on BVS");

assert.match(storefronts, /export function marketplaceStorefronts\(/, "Marketplace must expose one provider-store resolver");
assert.match(marketplace, /\.filter\(\(provider\) => provider\.services\.length > 0\)/, "Stores with no offers must not be listed in the directory");
assert.match(storefronts, /const claim = live\.find\(\(item\) => seed\.ownerAccountId[\s\S]*?item\.sellerUserId === seed\.ownerAccountId/, "Seeded stores must use an explicit account identity where reserved");
assert.match(storefronts, /ownerAccountId: '307acddd-440c-4941-a876-ac87eccc6871'/, "Uptown must be reserved for its BVS account, not a mutable display name");
assert.match(storefronts, /sourceSeedId: profile\.user_id === '307acddd-440c-4941-a876-ac87eccc6871'/, "An edited owner listing must supersede its corresponding seeded offer");
assert.match(storefronts, /headline: claim\.headline \|\| seed\.headline[\s\S]*?location: claim\.location \|\| seed\.location/, "Editorial-approved profile changes must appear on the seeded storefront");
assert.match(availabilityApi, /reservedStore\?\.slug \|\| providerStorefrontSlug/, "Approved Uptown owner availability must retain the canonical provider key");
assert.match(storefronts, /services: mergeServices\(seed\.services, claim\.services\)/, "Uploaded services must merge under the claimed provider store");
assert.match(marketplace, /marketplaceStorefronts\(data\.profiles \|\| \[\], data\.listings \|\| \[\]\)/, "Marketplace home must render the merged provider model");
assert.match(store, /marketplaceStorefronts\(data\.profiles \|\| \[\], data\.listings \|\| \[\]\)/, "Provider detail must render the merged provider model");
assert.match(bookingPage, /marketplaceStorefronts\(marketplace\.profiles \|\| \[\], marketplace\.listings \|\| \[\]\)/, "Booking must resolve the same merged provider model");
assert.match(marketplace, /Open Wolf Studio/, "Marketplace must expose the requested Open Wolf Studio CTA");
assert.match(shop, /redirect\("\/marketplace\/bvs-studio-services"\)/, "Legacy BVS services route must resolve inside Marketplace");
assert.match(marketplace, /MarketplaceProviderMap providers=\{matchingStorefronts\}/, "Marketplace home must show the provider map");
assert.match(store, /MarketplaceProviderMap providers=\{\[provider\]\} compact/, "Physical provider stores must retain the map");
assert.match(providerMap, /tile\.openstreetmap\.org/, "Provider map must use the dark themed OSM tile map (beta style)");
assert.match(providerMap, /grayscale invert saturate/, "Provider map must keep the dark inverted tile treatment");
assert.match(providerMap, /Open in Maps/, "Provider map must still offer external maps deep-link");
assert.match(providerMap, /google\.com\/maps\/search/, "Open in Maps must deep-link to a real maps search");
assert.match(providerMap, /Remote\|online\|virtual\|worldwide\|global/i, "Remote providers must not receive a fake physical map pin");
assert.match(providerMap, /approximate area/, "Public pins must remain area-level, not door addresses");

assert.match(bookingApi, /marketplace_provider_slots\?provider_key=eq\./, "Public calendar must read provider-published slots");
assert.match(bookingApi, /status=eq\.available/, "Public calendar must expose only available slots");
assert.match(bookingApi, /starts_at=gt\./, "Public calendar must expose only future slots");
assert.match(bookingApi, /rpc\/request_marketplace_booking/, "Booking request must use the atomic database RPC");
assert.match(bookingApi, /reservedStore\?\.slug \|\| storefrontSlug/, "Owner-published service bookings must keep the Uptown canonical slug even after account renames");
assert.match(bookingPage, /has not published any open booking times yet/, "Empty calendars must not invent availability");
assert.match(bookingPage, /Only time slots published by the provider appear here/, "Booking UI must explain real provider availability");

if (sql) {
  assert.match(sql, /create or replace function public\.publish_marketplace_slot/, "Slot publication must be transactional");
  assert.match(sql, /pg_advisory_xact_lock/, "Concurrent provider slot publication must serialize per storefront");
  assert.match(sql, /MARKETPLACE_SLOT_OVERLAP/, "Overlapping active slots must be rejected");
  assert.match(sql, /tstzrange\(s\.starts_at, s\.ends_at, '\[\)'\) && tstzrange/, "Overlap detection must use half-open time ranges");
  assert.match(sql, /create or replace function public\.request_marketplace_booking[\s\S]*?for update;/, "Booking must lock the selected slot");
  assert.match(sql, /set status = 'held'/, "A requested booking must immediately remove the slot from public availability");
  assert.match(sql, /create or replace function public\.respond_marketplace_booking/, "Providers must have an atomic response path");
  assert.match(sql, /set status = 'confirmed'[\s\S]*?set status = 'booked'/, "Confirming must confirm the request and book the slot");
  assert.match(sql, /set status = 'declined'[\s\S]*?case when starts_at > now\(\) then 'available' else 'blocked' end/, "Declining must release a future slot safely");
}

assert.match(availabilityApi, /wolf-bridges[\s\S]*?wolfbridges-studio/, "Wolf availability must publish under the existing studio provider key");
assert.match(availabilityApi, /p_owner_user_id: provider\.identity\.user\.id/, "Provider booking actions must be scoped to the authenticated owner");
assert.match(availabilityApi, /action === "respond_booking"/, "Provider API must support booking responses");
assert.match(sellerApi, /reusableMarketplacePath\(path, currentPath, identity\.user\.id\)/, "Transferred listing files may only be grandfathered when the stored path is unchanged");
assert.match(sellerApi, /safeMarketplacePath\(listing\.artwork_path\)/, "Seller desk may preview a safe transferred artwork path after ownership transfer");
assert.match(commerceLedger, /marketplace-service:wolfbridges-studio:record-mix-master-own-beat[\s\S]*?wolf-bridges/, "Wolf seeded studio checkout must resolve Wolf as seller");
assert.match(commerceLedger, /marketplace-service:wolfbridges-studio:beat-lease-mp3-wav[\s\S]*?wolf-bridges/, "Wolf seeded beat lease checkout must resolve Wolf as seller");
assert.match(availabilityDesk, /Confirm booking/, "Provider desk must expose booking confirmation");
assert.match(availabilityDesk, /Decline/, "Provider desk must expose booking decline");
assert.doesNotMatch(availabilityDesk, /Math\.random|generateSlots|mockSlots|fakeSlots/i, "Provider desk must not synthesize fake availability");

console.log("marketplace storefront + booking contract: ok");