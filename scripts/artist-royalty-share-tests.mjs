import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ARTIST_ROYALTY_SHARE_POLICIES,
  PREMIUM_UNLOCK_CONSECUTIVE_MONTHS,
  ROYALTY_SHARE_SCOPE_EXCLUSIONS,
  effectiveRoyaltySharePolicy,
  premiumUnlocksInstantRoyaltyShare,
  royaltySharePolicyForPlan,
} from "../src/lib/artist-royalty-share.ts";
import {
  PREMIUM_CATALOG,
  PREMIUM_TIERS,
  entitlementsForPlan,
  premiumPricingCopy,
} from "../src/lib/premium-catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const premiumPage = readFileSync(path.join(root, "src/app/premium/page.tsx"), "utf8");
const catalogApi = readFileSync(path.join(root, "src/app/api/premium/catalog/route.ts"), "utf8");

assert.equal(PREMIUM_UNLOCK_CONSECUTIVE_MONTHS, 3);

assert.deepEqual(
  {
    launchArtist: ARTIST_ROYALTY_SHARE_POLICIES.artist_free.artistShareBps,
    launchBvs: ARTIST_ROYALTY_SHARE_POLICIES.artist_free.bvsShareBps,
    instantArtist: ARTIST_ROYALTY_SHARE_POLICIES.artist_instant.artistShareBps,
    instantBvs: ARTIST_ROYALTY_SHARE_POLICIES.artist_instant.bvsShareBps,
    premiumArtist: ARTIST_ROYALTY_SHARE_POLICIES.artist_standard.artistShareBps,
    premiumBvs: ARTIST_ROYALTY_SHARE_POLICIES.artist_standard.bvsShareBps,
    foundingArtist: ARTIST_ROYALTY_SHARE_POLICIES.artist_founding.artistShareBps,
    foundingBvs: ARTIST_ROYALTY_SHARE_POLICIES.artist_founding.bvsShareBps,
  },
  {
    launchArtist: 8000,
    launchBvs: 2000,
    instantArtist: 9000,
    instantBvs: 1000,
    premiumArtist: 10000,
    premiumBvs: 0,
    foundingArtist: 10000,
    foundingBvs: 0,
  },
);

assert.equal(royaltySharePolicyForPlan("instant").bvsShareBps, 1000);
assert.equal(royaltySharePolicyForPlan("premium").bvsShareBps, 0);
assert.equal(premiumUnlocksInstantRoyaltyShare({ consecutivePremiumMonths: 2 }), false);
assert.equal(premiumUnlocksInstantRoyaltyShare({ consecutivePremiumMonths: 3 }), true);
assert.equal(
  effectiveRoyaltySharePolicy({ releasePlanId: "artist_instant", consecutivePremiumMonths: 2 }).bvsShareBps,
  1000,
);
assert.equal(
  effectiveRoyaltySharePolicy({ releasePlanId: "artist_instant", consecutivePremiumMonths: 3 }).bvsShareBps,
  0,
);
assert.equal(
  effectiveRoyaltySharePolicy({ releasePlanId: "artist_free", consecutivePremiumMonths: 3 }).artistShareBps,
  10000,
);

const instantEntitlements = entitlementsForPlan("artist_instant");
assert.equal(instantEntitlements.artist_master_royalty_share_bps, 9000);
assert.equal(instantEntitlements.bvs_master_royalty_share_bps, 1000);
assert.equal(instantEntitlements.premium_unlock_consecutive_months, 3);

const premiumEntitlements = entitlementsForPlan("artist_standard");
assert.equal(premiumEntitlements.artist_master_royalty_share_bps, 10000);
assert.equal(premiumEntitlements.bvs_master_royalty_share_bps, 0);

const instantPlan = PREMIUM_CATALOG.find((plan) => plan.id === "artist_instant");
assert.ok(instantPlan?.includes.some((line) => line.includes("Artist keeps 90% / BVS 10%")));
assert.ok(instantPlan?.includes.some((line) => line.includes("3 consecutive Premium months")));

const premiumTier = PREMIUM_TIERS.find((tier) => tier.id === "standard");
assert.ok(premiumTier?.notes.some((line) => line.includes("Artist keeps 100% / BVS 0%")));

assert.ok(premiumPricingCopy().distributionNote.includes("90/10"));
assert.ok(premiumPricingCopy().distributionNote.includes("3 consecutive Premium months"));
assert.ok(premiumPage.includes("Pay less upfront, or keep 100% on Premium"));
assert.ok(catalogApi.includes("artistRoyaltyShare"));

for (const excluded of ["ZIMURA", "BeatStore", "Studio-service"]) {
  assert.ok(
    ROYALTY_SHARE_SCOPE_EXCLUSIONS.some((line) => line.includes(excluded)),
    `missing exclusion ${excluded}`,
  );
}

console.log("artist royalty share tests passed");
