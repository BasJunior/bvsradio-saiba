import assert from "node:assert/strict";
import {
  normalizeServiceBillingInterval,
  parseServicePremiumOrderItem,
  parseServicePremiumPlanId,
  servicePremiumPriceUsd,
  servicePremiumSku,
} from "../src/lib/service-premium-plans.ts";
import { entitlementsForPlan } from "../src/lib/premium-catalog.ts";
import { marketplaceCommissionBps } from "../src/lib/marketplace-economics.ts";

assert.equal(parseServicePremiumPlanId("service_pro"), "service_pro");
assert.equal(parseServicePremiumPlanId("pro"), "service_pro");
assert.equal(parseServicePremiumPlanId("studio"), "studio");
assert.equal(parseServicePremiumPlanId("artist_standard"), null);
assert.equal(normalizeServiceBillingInterval("year"), "year");
assert.equal(normalizeServiceBillingInterval("month"), "month");

assert.equal(servicePremiumPriceUsd("service_pro", "month"), 8);
assert.equal(servicePremiumPriceUsd("service_pro", "year"), 80);
assert.equal(servicePremiumPriceUsd("studio", "month"), 15);
assert.equal(servicePremiumPriceUsd("studio", "year"), 150);
assert.equal(servicePremiumSku("service_pro", "month"), "service-premium:service_pro:month");

assert.deepEqual(
  parseServicePremiumOrderItem([
    {
      type: "service_premium",
      id: "service-premium:studio:year",
      price: 150,
      quantity: 1,
    },
  ]),
  { planId: "studio", interval: "year", amount: 150 },
);

assert.equal(entitlementsForPlan("service_free").marketplace_commission_bps, 1500);
assert.equal(entitlementsForPlan("service_pro").marketplace_commission_bps, 800);
assert.equal(entitlementsForPlan("studio").marketplace_commission_bps, 500);
assert.equal(entitlementsForPlan("service_pro").service_provider_tier, "pro");
assert.equal(entitlementsForPlan("studio").service_provider_tier, "studio");

assert.equal(
  marketplaceCommissionBps({ productType: "creator_service", unitAmount: 100, sellerPlanId: "service_free" }),
  1500,
);
assert.equal(
  marketplaceCommissionBps({ productType: "creator_service", unitAmount: 100, sellerPlanId: "service_pro" }),
  800,
);
assert.equal(
  marketplaceCommissionBps({ productType: "creator_service", unitAmount: 100, sellerPlanId: "studio" }),
  500,
);

console.log("service-premium-tests: ok");
