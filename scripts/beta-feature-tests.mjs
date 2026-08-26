import assert from "node:assert/strict";
import {
  betaFeatureConfig,
  betaFeatureDetails,
} from "../src/lib/beta-features.ts";

const prod = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://bvsradio.com",
};

{
  const config = betaFeatureConfig(prod);
  assert.equal(config.marketplacePublic, false);
  assert.equal(config.creatorMarketplace, false);
  assert.equal(config.serviceOrders, false);
  assert.equal(config.liveBroadcast, false);
  assert.equal(config.testPayments, false);
  assert.equal(config.productionLocked, true);
}

{
  const config = betaFeatureConfig({
    ...prod,
    BVS_FEATURE_TEST_PAYMENTS: "true",
  });
  assert.equal(
    config.testPayments,
    false,
    "payment tests must not activate on production even with explicit flag",
  );
}

{
  const config = betaFeatureConfig({
    NODE_ENV: "production",
    BVS_APP_VARIANT: "beta",
    NEXT_PUBLIC_SITE_URL: "https://bvsradio-beta.vercel.app",
  });
  assert.equal(config.marketplacePublic, true);
  assert.equal(config.creatorMarketplace, true);
  assert.equal(config.serviceOrders, true);
  assert.equal(config.liveBroadcast, true);
  assert.equal(
    config.testPayments,
    false,
    "beta/staging still requires explicit payment test flag",
  );
}

{
  const config = betaFeatureConfig({
    NODE_ENV: "production",
    BVS_APP_VARIANT: "staging",
    BVS_FEATURE_TEST_PAYMENTS: "true",
  });
  assert.equal(config.testPayments, true);
}

{
  const details = betaFeatureDetails({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    BVS_FEATURE_MARKETPLACE_PUBLIC: "false",
  });
  assert.equal(details.flags.marketplacePublic.raw, "false");
  assert.equal(details.flags.marketplacePublic.effective, false);
}

console.log("beta feature tests passed");
