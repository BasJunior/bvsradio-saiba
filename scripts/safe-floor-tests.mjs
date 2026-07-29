import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const key = "TEST-INTEGRATION-KEY";
const values = { reference: "BVS-123", amount: "12.50", status: "Paid" };
const input = Object.values(values).join("") + key.toLowerCase();
const hash = createHash("sha512").update(input).digest("hex").toUpperCase();

const { verifyPaynowHash, sameMoney } = await import("../src/lib/paynow-security.ts");

assert.equal(verifyPaynowHash({ ...values, hash }, key), true);
assert.equal(verifyPaynowHash({ ...values, amount: "1.00", hash }, key), false);
assert.equal(verifyPaynowHash(values, key), false);
assert.equal(sameMoney("12.50", 12.5), true);
assert.equal(sameMoney("12.49", 12.5), false);
console.log("Safe Floor payment checks passed");
