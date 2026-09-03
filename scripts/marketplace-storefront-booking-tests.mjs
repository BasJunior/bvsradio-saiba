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
const availabilityDesk = await readFile(new URL("../src/components/MarketplaceAvailabilityDesk.tsx", import.meta.url), "utf8");
const providerMap = await readFile(new URL("../src/components/MarketplaceProviderMap.tsx", import.meta.url), "utf8");
const shop = await readFile(new URL("../src/app/shop/page.tsx", import.meta.url), "utf8");
const sql = await optionalRead(new URL("../supabase-marketplace-booking.sql", import.meta.url));

assert.match(storefronts, /slug: 'wolfbridges-studio'/, "WolfBridges must have one canonical storefront slug");
assert.match(storefronts, /location: 'Madokero, Harare'/, "WolfBridges location must match the supplied reference");
assert.match(storefronts, /heroImage: '\/images\/marketplace\/wolfbridges-studio\.jpg'/, "WolfBridges must use the supplied studio crop");
assert.match(storefronts, /id: 'record-mix-master-own-beat'[\s\S]*?priceUsd: 30/, "$30 own-beat recording/mix/master package must remain exact");
assert.match(storefronts, /id: 'record-beat-mix-master'[\s\S]*?priceUsd: 80/, "$80 beat + recording + mix/master package must remain exact");
assert.match(storefronts, /id: 'beat-lease-mp3'[\s\S]*?priceUsd: 30/, "$30 MP3 beat lease must remain exact");
assert.match(storefronts, /id: 'beat-lease-mp3-wav'[\s\S]*?priceUsd: 50/, "$50 MP3 + WAV beat lease must remain exact");
assert.match(storefronts, /policyNotes: \['No custom beats\.', 'No beat remakes\.'\]/, "WolfBridges no-custom/remake policy must stay visible");

assert.match(storefronts, /export function marketplaceStorefronts\(/, "Marketplace must expose one provider-store resolver");
assert.match(storefronts, /const claim = live\.find\(\(item\) => item\.slug === seed\.slug\)/, "A real provider must be able to claim a seeded storefront");
assert.match(storefronts, /services: mergeServices\(seed\.services, claim\.services\)/, "Uploaded services must merge under the claimed provider store");
assert.match(marketplace, /marketplaceStorefronts\(data\.profiles \|\| \[\], data\.listings \|\| \[\]\)/, "Marketplace home must render the merged provider model");
assert.match(store, /marketplaceStorefronts\(data\.profiles \|\| \[\], data\.listings \|\| \[\]\)/, "Provider detail must render the merged provider model");
assert.match(bookingPage, /marketplaceStorefronts\(marketplace\.profiles \|\| \[\], marketplace\.listings \|\| \[\]\)/, "Booking must resolve the same merged provider model");
assert.match(marketplace, /Open Wolf Studio/, "Marketplace must expose the requested Open Wolf Studio CTA");
assert.match(shop, /redirect\("\/marketplace\/bvs-studio-services"\)/, "Legacy BVS services route must resolve inside Marketplace");
assert.match(marketplace, /MarketplaceProviderMap providers=\{storefronts\}/, "Marketplace home must show the provider map");
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

assert.match(availabilityApi, /p_owner_user_id: provider\.identity\.user\.id/, "Provider booking actions must be scoped to the authenticated owner");
assert.match(availabilityApi, /action === "respond_booking"/, "Provider API must support booking responses");
assert.match(availabilityDesk, /Confirm booking/, "Provider desk must expose booking confirmation");
assert.match(availabilityDesk, /Decline/, "Provider desk must expose booking decline");
assert.doesNotMatch(availabilityDesk, /Math\.random|generateSlots|mockSlots|fakeSlots/i, "Provider desk must not synthesize fake availability");

console.log("marketplace storefront + booking contract: ok");
