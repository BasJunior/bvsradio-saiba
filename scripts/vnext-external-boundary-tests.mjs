import assert from "node:assert/strict";
import { isExternalLegalOrLicenceUrl } from "../src/lib/app-external-boundary.ts";

assert.equal(isExternalLegalOrLicenceUrl(new URL("https://bvsradio-app-vnext-2026-09.vercel.app/privacy")), true);
assert.equal(isExternalLegalOrLicenceUrl(new URL("https://bvsradio-app-vnext-2026-09.vercel.app/contact")), true);
assert.equal(isExternalLegalOrLicenceUrl(new URL("https://bvsradio.com/terms")), true);
assert.equal(isExternalLegalOrLicenceUrl(new URL("https://bvsradio.com/catalogue?type=beat&q=Heavy#beatstore")), true);
assert.equal(isExternalLegalOrLicenceUrl(new URL("https://bvsradio-app-vnext-2026-09.vercel.app/app/ios/track/abc")), false);
assert.equal(isExternalLegalOrLicenceUrl(new URL("https://bvsradio-app-vnext-2026-09.vercel.app/library")), false);

console.log("vNext external Support/Privacy/licence boundary checks passed");
