import assert from "node:assert/strict";
import {
  PRODUCER_BILLING_POLICY_VERSION,
  normalizeProducerInterval,
  normalizeProducerPlanId,
  producerBillingGuard,
  producerPlanEntitlements,
  producerPremiumPriceUsd,
} from "../src/lib/producer-billing.ts";
import { entitlementsForPlan } from "../src/lib/premium-catalog.ts";
import { marketplaceCommissionBps } from "../src/lib/marketplace-economics.ts";

assert.equal(PRODUCER_BILLING_POLICY_VERSION, "2026-08-08-v1");
assert.equal(normalizeProducerPlanId("plus"), "producer_plus");
assert.equal(normalizeProducerPlanId("producer_pro"), "producer_pro");
assert.equal(normalizeProducerInterval("annual"), "month");
assert.equal(normalizeProducerInterval("year"), "year");
assert.equal(producerPremiumPriceUsd("producer_plus", "month"), 5);
assert.equal(producerPremiumPriceUsd("producer_plus", "year"), 50);
assert.equal(producerPremiumPriceUsd("producer_pro", "month"), 10);
assert.equal(producerPremiumPriceUsd("producer_pro", "year"), 100);

for (const planId of ["producer_plus", "producer_pro"]) {
  assert.deepEqual(producerPlanEntitlements(planId), entitlementsForPlan(planId));
}
assert.deepEqual(producerPlanEntitlements("creator_complete"), entitlementsForPlan("producer_pro"));
assert.deepEqual(entitlementsForPlan("producer_free"), {
  beatstore_tier: "free",
  beat_live_limit: 25,
  marketplace_commission_bps: 1500,
  licence_template_limit: 1,
});
assert.equal(marketplaceCommissionBps({ productType: "beat", unitAmount: 29, sellerPlanId: "producer_free" }), 1500);
assert.equal(marketplaceCommissionBps({ productType: "beat", unitAmount: 29, sellerPlanId: "producer_plus" }), 800);
assert.equal(marketplaceCommissionBps({ productType: "beat", unitAmount: 29, sellerPlanId: "producer_pro" }), 300);

const safe = {
  BVS_ENABLE_BETA_PRODUCER_STRIPE: "1",
  BVS_ENV_LANE: "staging",
  NEXT_PUBLIC_SITE_URL: "https://bvsradio-beta.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://beta.example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service",
  STRIPE_SECRET_KEY: "sk_test_example",
};
assert.deepEqual(producerBillingGuard(safe), { ok: true });
assert.equal(producerBillingGuard({ ...safe, BVS_ENABLE_BETA_PRODUCER_STRIPE: "0" }).reason, "flag_off");
assert.equal(producerBillingGuard({ ...safe, BVS_ENV_LANE: "production" }).reason, "not_beta");
assert.equal(producerBillingGuard({ ...safe, STRIPE_SECRET_KEY: "sk_live_forbidden" }).reason, "stripe_not_test");

console.log("producer money-loop contract: ok");
