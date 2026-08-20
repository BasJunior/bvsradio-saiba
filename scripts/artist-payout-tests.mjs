import assert from "node:assert/strict";
import { validatePayoutRequest } from "../src/lib/artist-payouts.ts";

assert.deepEqual(validatePayoutRequest({ available: 30, minimum: 25 }), { ok: true, amount: 30 });
assert.deepEqual(validatePayoutRequest({ available: 70, minimum: 25, requested: 40 }), { ok: true, amount: 40 });
assert.equal(validatePayoutRequest({ available: 20, minimum: 25 }).code, "PAYOUT_BELOW_MINIMUM");
assert.equal(validatePayoutRequest({ available: 30, minimum: 25, requested: 31 }).code, "PAYOUT_EXCEEDS_AVAILABLE");
assert.equal(validatePayoutRequest({ available: 80, minimum: 25, hasOpenRequest: true }).code, "PAYOUT_ALREADY_OPEN");
assert.equal(validatePayoutRequest({ available: 80, minimum: 25, requested: Number.NaN }).code, "PAYOUT_AMOUNT_INVALID");

console.log("artist payout policy tests passed");
