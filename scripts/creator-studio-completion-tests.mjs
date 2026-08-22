import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [studio, money] = await Promise.all([
  readFile(new URL("../src/app/creator/studio/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/StudioMoneySummary.tsx", import.meta.url), "utf8"),
]);

assert.match(studio, /StudioMoneySummary/);
assert.match(studio, /id="money-desk"/);
assert.match(studio, /Wallet & settlement summary/);
assert.match(studio, /href: "#money-desk"/);
assert.match(studio, /href="#money-desk"/);

assert.match(money, /fetch\("\/api\/artist\/wallet"/);
assert.match(money, /lifetimeGrossSales/);
assert.match(money, /bvsPlatformFees/);
assert.match(money, /processorFees/);
assert.match(money, /netAfterRefunds/);
assert.match(money, /seller_plan_id/);
assert.match(money, /platform_fee_bps/);
assert.match(money, /frozen on each settlement/);
assert.match(money, /Full wallet & payouts/);

assert.doesNotMatch(money, /POST|PATCH|DELETE/);
assert.doesNotMatch(studio, /BVS_ENABLE_BETA_PRODUCER_STRIPE/);

console.log("creator studio completion contract: ok");
