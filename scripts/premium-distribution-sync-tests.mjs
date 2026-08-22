import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const billing = await readFile(new URL("../src/lib/premium-billing.ts", import.meta.url), "utf8");

assert.ok(
  billing.includes("&is_public=eq.true&editorial_status=eq.approved&"),
  "Premium distribution sync must use a valid PostgREST is_public filter",
);
assert.ok(
  !billing.includes("&is_public.eq.true&"),
  "Malformed PostgREST is_public filter must not return",
);
assert.ok(
  billing.includes("if (published === null) return { ok: false, created: 0, upgraded: 0 };"),
  "Published-release lookup failures must fail closed",
);
assert.ok(
  billing.includes("if (existing === null) return { ok: false, created: 0, upgraded: 0 };"),
  "Existing distribution-job lookup failures must fail closed to avoid duplicate jobs",
);

const pathSource = await readFile(new URL("../src/lib/distribution-path.ts", import.meta.url), "utf8");
assert.ok(pathSource.includes('case "eligible":'));
assert.ok(pathSource.includes('case "submitted":'));
assert.ok(pathSource.includes('case "live_on_dsp":'));
assert.ok(
  pathSource.includes("Artist-facing copy must not name the aggregator brand."),
  "Private partner naming boundary must remain explicit",
);

console.log("premium distribution sync contract: ok");
