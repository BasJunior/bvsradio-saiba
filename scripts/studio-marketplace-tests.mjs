import assert from "node:assert/strict";
import fs from "node:fs";
import {
  haversineKm,
  roundPublicCoordinate,
  seededStudioDiscovery,
} from "../src/lib/studio-marketplace.ts";

assert.equal(seededStudioDiscovery.length >= 1, true, "beta must retain at least one seeded studio discovery record");
assert.equal(seededStudioDiscovery[0].reviewCount, 0, "seeded studios must not invent previous-client reviews");
assert.equal(seededStudioDiscovery[0].rating, null, "seeded studios must not invent star ratings");

assert.equal(roundPublicCoordinate(-17.82523, "city"), -17.83, "city pins must be coarse");
assert.equal(roundPublicCoordinate(31.03351, "neighborhood"), 31.034, "neighborhood pins must be rounded");
assert.equal(roundPublicCoordinate(31.033512, "exact"), 31.03351, "exact pins retain useful map precision");

const distance = haversineKm(-17.825, 31.033, -17.83, 31.04);
assert.equal(distance > 0 && distance < 2, true, "nearby studio distance should be plausible");

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

const bookingRoute = fs.readFileSync("src/app/api/marketplace/bookings/route.ts", "utf8");
assert.match(bookingRoute, /authoritativeService\(providerKey, serviceRef, packageIndex\)/, "package selection must be resolved server-side");
assert.match(bookingRoute, /selectedPackage\.priceUsd/, "server must use published package price");
const bookingPage = fs.readFileSync("src/app/marketplace/[slug]/book/page.tsx", "utf8");
assert.match(bookingPage, /packageIndex: selectedPackage \? packageIndex : undefined/, "booking request must carry package selection only, not a browser price");

console.log("studio marketplace tests passed");
