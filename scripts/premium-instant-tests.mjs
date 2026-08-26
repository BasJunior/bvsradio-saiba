import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import {
  PREMIUM_CATALOG,
  PREMIUM_TIERS,
  defaultPremiumMonthlyUsd,
  entitlementsForPlan,
  planHasPaidCheckout,
  premiumPricingCopy,
} from "../src/lib/premium-catalog.ts";
import { marketplaceCommissionBps } from "../src/lib/marketplace-economics.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const billingSource = readFileSync(path.join(root, "src/lib/premium-billing.ts"), "utf8");

const instantPlan = PREMIUM_CATALOG.find((plan) => plan.id === "artist_instant");
assert.ok(instantPlan, "artist_instant must exist in premium catalog");
assert.equal(instantPlan.monthlyUsd, 5.99);
assert.equal(instantPlan.yearlyUsd, 60);
assert.equal(instantPlan.featured, true);
assert.equal(planHasPaidCheckout(instantPlan), true);
assert.ok(
  instantPlan.includes.some((line) => line.includes("25 active distributed tracks")),
  "Instant must use active catalogue language",
);
assert.ok(
  !instantPlan.includes.some((line) => /25 .*per month/i.test(line)),
  "Instant must not advertise 25 uploads per month",
);

const standardPlan = PREMIUM_CATALOG.find((plan) => plan.id === "artist_standard");
assert.ok(standardPlan);
assert.equal(standardPlan.monthlyUsd, 12);
assert.ok(standardPlan.includes.some((line) => line.includes("Unlimited active distributed catalogue")));

const foundingPlan = PREMIUM_CATALOG.find((plan) => plan.id === "artist_founding");
assert.ok(foundingPlan);
assert.equal(foundingPlan.monthlyUsd, 9);
assert.ok(foundingPlan.summary.toLowerCase().includes("grandfathered"));

assert.equal(PREMIUM_TIERS[0].id, "instant");
assert.equal(defaultPremiumMonthlyUsd(), 5.99);
assert.equal(premiumPricingCopy().headline, "From US$5.99/month");

assert.ok(billingSource.includes('export type ArtistPremiumPlanId = "artist_instant" | "artist_founding" | "artist_standard"'));
assert.ok(billingSource.includes('v === "instant" || v === "starter" || v === "artist_instant"'));
assert.ok(billingSource.includes('if (planId === "artist_instant") return interval === "year" ? 60 : 5.99;'));

assert.deepEqual(
  {
    artist_distributed_track_limit: entitlementsForPlan("artist_instant").artist_distributed_track_limit,
    artist_monthly_release_submission_limit:
      entitlementsForPlan("artist_instant").artist_monthly_release_submission_limit,
  },
  {
    artist_distributed_track_limit: 25,
    artist_monthly_release_submission_limit: 1,
  },
);
assert.equal(entitlementsForPlan("artist_standard").artist_distributed_track_limit, null);
assert.equal(entitlementsForPlan("artist_standard").artist_monthly_release_submission_limit, null);

assert.ok(billingSource.includes('let planId: ArtistPremiumPlanId = "artist_instant";'));
assert.ok(billingSource.includes('sku.includes("instant") || sku.includes("starter")'));
assert.equal(
  marketplaceCommissionBps({ productType: "single", unitAmount: 2, sellerPlanId: "artist_instant" }),
  1500,
);

console.log("premium instant tests passed");
