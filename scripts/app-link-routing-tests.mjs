import assert from "node:assert/strict";

const { appRouteForNativeUrl } = await import("../src/lib/app-link-routing.ts");

assert.equal(appRouteForNativeUrl("/app/ios/rooms/abc?from=push", "android"), "/app/android/rooms/abc?from=push");
assert.equal(appRouteForNativeUrl("https://bvsradio.com/app/android/library#offline", "ios"), "/app/ios/library#offline");
assert.equal(appRouteForNativeUrl("https://www.bvsradio.com/radio?track=1", "ios"), "/app/ios/radio?track=1");
assert.equal(appRouteForNativeUrl("/community/rooms/123", "android"), "/app/android/rooms");
assert.equal(appRouteForNativeUrl("bvsradio://marketplace/orders", "ios"), "/app/ios/marketplace");
assert.equal(appRouteForNativeUrl("bvsradio://radio", "android"), "/app/android/radio");
assert.equal(appRouteForNativeUrl("https://evil.example/app/ios/library", "ios"), null);
assert.equal(appRouteForNativeUrl("javascript:alert(1)", "android"), null);
assert.equal(appRouteForNativeUrl("", "ios"), null);

console.log("Native app-link routing checks passed");
