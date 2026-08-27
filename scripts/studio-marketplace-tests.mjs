import assert from "node:assert/strict";
import fs from "node:fs";
import {
  haversineKm,
  roundPublicCoordinate,
  seededStudioDiscovery,
  studioSlotLocalDate,
  studioSlotMatches,
  studioSlotMinutes,
} from "../src/lib/studio-marketplace.ts";

assert.equal(seededStudioDiscovery.length >= 1, true, "beta must retain at least one seeded studio discovery record");
assert.equal(seededStudioDiscovery[0].reviewCount, 0, "seeded studios must not invent previous-client reviews");
assert.equal(seededStudioDiscovery[0].rating, null, "seeded studios must not invent star ratings");

assert.equal(roundPublicCoordinate(-17.82523, "city"), -17.83, "city pins must be coarse");
assert.equal(roundPublicCoordinate(31.03351, "neighborhood"), 31.034, "neighborhood pins must be rounded");
assert.equal(roundPublicCoordinate(31.033512, "exact"), 31.03351, "exact pins retain useful map precision");

const distance = haversineKm(-17.825, 31.033, -17.83, 31.04);
assert.equal(distance > 0 && distance < 2, true, "nearby studio distance should be plausible");

const slot = { startsAt: "2026-08-28T08:00:00.000Z", endsAt: "2026-08-28T10:00:00.000Z", timezone: "Africa/Harare" };
assert.equal(studioSlotMinutes(slot), 120, "session-length search must use published slot duration");
assert.equal(studioSlotLocalDate(slot), "2026-08-28", "studio date search must respect the slot timezone");
assert.equal(studioSlotMatches(slot, "2026-08-28", 120), true, "matching slot should satisfy exact date and minimum duration");
assert.equal(studioSlotMatches(slot, "2026-08-28", 180), false, "short slots must not be presented as longer availability");

const sql = fs.readFileSync("supabase-marketplace-studio-discovery-beta.sql", "utf8");
assert.match(sql, /marketplace_studio_profiles enable row level security/i);
assert.match(sql, /marketplace_studio_reviews enable row level security/i);
assert.match(sql, /revoke all on public\.marketplace_studio_profiles from anon, authenticated/i);
assert.match(sql, /revoke all on public\.marketplace_studio_reviews from anon, authenticated/i);
assert.match(sql, /unique \(booking_request_id\)/i, "one verified booking must produce at most one review");

const reviewRoute = fs.readFileSync("src/app/api/marketplace/studios/reviews/route.ts", "utf8");
assert.match(reviewRoute, /status=eq\.confirmed/, "reviews must come from confirmed bookings");
assert.match(reviewRoute, /Date\.parse\(endedAt\) >= Date\.now\(\)/, "reviews must wait until session end");
assert.doesNotMatch(reviewRoute, /reviewerLabel:.*customer/i, "public review output must not expose booking identity");

const studiosRoute = fs.readFileSync("src/app/api/marketplace/studios/route.ts", "utf8");
assert.match(studiosRoute, /roundPublicCoordinate/, "public studio API must round map coordinates");
assert.match(studiosRoute, /approved Marketplace studio role/i, "studio profile writes must require approved studio role");
assert.match(studiosRoute, /ends_at,timezone/, "studio discovery must use real slot end-times and timezones");
assert.match(studiosRoute, /availableSlots/, "public studio discovery should expose bounded real future slots for filtering");
assert.match(studiosRoute, /galleryList\(body\.gallery\)/, "studio gallery writes must be sanitized server-side");
assert.match(studiosRoute, /launchChecklist/, "studio owner onboarding must be grounded in real launch readiness");

const bookingRoute = fs.readFileSync("src/app/api/marketplace/bookings/route.ts", "utf8");
assert.match(bookingRoute, /authoritativeService\(providerKey, serviceRef, packageIndex\)/, "package selection must be resolved server-side");
assert.match(bookingRoute, /selectedPackage\.priceUsd/, "server must use published package price");
const bookingPage = fs.readFileSync("src/app/marketplace/[slug]/book/page.tsx", "utf8");
assert.match(bookingPage, /packageIndex: selectedPackage \? packageIndex : undefined/, "booking request must carry package selection only, not a browser price");

const discoveryPage = fs.readFileSync("src/app/marketplace/studios/page.tsx", "utf8");
assert.match(discoveryPage, /dateQuery/, "studio discovery must offer date filtering");
assert.match(discoveryPage, /sessionMinutes/, "studio discovery must offer session-length filtering");
assert.match(discoveryPage, /studioSlotMatches/, "date and duration filters must use published slots");
assert.match(discoveryPage, /scrollIntoView\(\{ behavior: "smooth"/, "map selection should smoothly synchronize to the studio card");

const map = fs.readFileSync("src/components/StudioDiscoveryMap.tsx", "utf8");
assert.match(map, /tile\.openstreetmap\.org/, "beta studio map must use real street-map tiles");
assert.match(map, /OpenStreetMap contributors/, "street-map attribution must remain visible");

const navbar = fs.readFileSync("src/components/layout/Navbar.tsx", "utf8");
assert.doesNotMatch(navbar, /href="\/admin\/copilot"/, "Ops Copilot must not appear in the global header or mobile nav");
const editorialHome = fs.readFileSync("src/app/editorial/page.tsx", "utf8");
assert.match(editorialHome, /href="\/admin\/copilot"/, "Ops Copilot must remain available from Editorial Home");

const detailPage = fs.readFileSync("src/app/marketplace/studios/[slug]/page.tsx", "utf8");
assert.match(detailPage, /soundQuality/, "verified studio review form must capture sound quality");
assert.match(detailPage, /communication/, "verified studio review form must capture communication");
assert.match(detailPage, /valueRating/, "verified studio review form must capture value rating");

const availabilityDesk = fs.readFileSync("src/components/MarketplaceAvailabilityDesk.tsx", "utf8");
assert.match(availabilityDesk, /completedBookings/, "provider booking desk must derive completed confirmed sessions");
assert.match(availabilityDesk, /review eligible/i, "completed studio sessions must explain review eligibility");

const quickBeatCreate = fs.readFileSync("src/components/QuickBeatCreate.tsx", "utf8");
assert.match(quickBeatCreate, /BeatPackUploadForm/, "Studio sell-a-beat flow must expose beat pack upload");
assert.match(quickBeatCreate, /Beat pack \/ EP/, "Studio beat mode switch must include pack/EP creation");
assert.match(quickBeatCreate, /loginNext="\/creator\/studio\/create\/beat"/, "pack sign-in must return creators to the Studio beat flow");

console.log("studio marketplace tests passed");
