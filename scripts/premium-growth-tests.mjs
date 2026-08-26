import assert from "node:assert/strict";
import {
  contextualUpgradePrompts,
  producerCommissionSavings,
  recommendPlan,
} from "../src/lib/premium-growth.ts";

{
  const savings = producerCommissionSavings(184);
  assert.equal(savings.freeFeeUsd, 27.6);
  assert.equal(savings.plusFeeAndSubUsd, 19.72);
  assert.equal(savings.plusSavingsUsd, 7.88);
  assert.equal(savings.proFeeAndSubUsd, 15.52);
  assert.equal(savings.proSavingsUsd, 12.08);
}

{
  const plan = recommendPlan({
    isProducer: true,
    premiumActive: false,
    distributionEnabled: false,
    beatLiveCount: 18,
    beatLiveLimit: 25,
    monthlySalesUsd: 81,
    approvedReleaseCount: 0,
    serviceOrderCount: 0,
    liveBroadcastCount: 0,
  });
  assert.equal(plan.planId, "producer_plus");
}

{
  const plan = recommendPlan({
    isProducer: false,
    premiumActive: false,
    distributionEnabled: false,
    beatLiveCount: 0,
    beatLiveLimit: 25,
    monthlySalesUsd: 0,
    approvedReleaseCount: 1,
    serviceOrderCount: 0,
    liveBroadcastCount: 0,
  });
  assert.equal(plan.planId, "artist_standard");
}

{
  const prompts = contextualUpgradePrompts({
    beatLiveCount: 25,
    beatLiveLimit: 25,
    monthlySalesUsd: 184,
    approvedReleaseCount: 1,
    serviceOrderCount: 1,
    liveBroadcastCount: 1,
  });
  assert.equal(prompts[0].id, "beat_limit");
  assert.ok(prompts.some((prompt) => prompt.id === "fee_savings"));
  assert.equal(prompts.length, 4);
}

console.log("premium growth tests passed");
