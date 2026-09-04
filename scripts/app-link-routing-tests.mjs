import assert from "node:assert/strict";

const { appRouteForNativeUrl } = await import("../src/lib/app-link-routing.ts");

assert.equal(appRouteForNativeUrl("/app/ios/rooms/abc?from=push", "android"), "/app/android/rooms/abc?from=push");
assert.equal(appRouteForNativeUrl("https://bvsradio.com/app/android/library#offline", "ios"), "/app/ios/library#offline");
assert.equal(appRouteForNativeUrl("https://www.bvsradio.com/radio?track=1", "ios"), "/app/ios?track=1");
assert.equal(appRouteForNativeUrl("/community/rooms/123", "android"), "/app/android/rooms/123");
assert.equal(appRouteForNativeUrl("bvsradio://marketplace/orders", "ios"), "/app/ios/studio/orders");
assert.equal(appRouteForNativeUrl("bvsradio://marketplace", "ios"), "/app/ios/marketplace");
assert.equal(appRouteForNativeUrl("/marketplace/wolfbridges-studio?service=record-mix-master-own-beat", "ios"), "/app/ios/marketplace?service=record-mix-master-own-beat&provider=wolfbridges-studio");
assert.equal(appRouteForNativeUrl("/marketplace/wolfbridges-studio/book?service=record-mix-master-own-beat", "android"), "/app/android/marketplace?service=record-mix-master-own-beat&provider=wolfbridges-studio&book=1");
assert.equal(appRouteForNativeUrl("/shop", "ios"), "/app/ios/marketplace?provider=bvs-studio-services");
assert.equal(appRouteForNativeUrl("/creator/marketplace", "ios"), "/app/ios/studio/marketplace");
assert.equal(appRouteForNativeUrl("bvsradio://radio", "android"), "/app/android");
assert.equal(appRouteForNativeUrl("/account", "ios"), "/app/ios/account");
assert.equal(appRouteForNativeUrl("/notifications", "ios"), "/app/ios/notifications");
assert.equal(appRouteForNativeUrl("/contact?topic=privacy", "ios"), null);
assert.equal(appRouteForNativeUrl("/privacy", "ios"), null);
assert.equal(appRouteForNativeUrl("/terms", "android"), null);
assert.equal(appRouteForNativeUrl("/search?q=zim&type=beat", "android"), "/app/android/explore?q=zim&type=beat");
assert.equal(appRouteForNativeUrl("/upload", "ios"), "/app/ios/studio/release");
assert.equal(appRouteForNativeUrl("/distribution", "ios"), "/app/ios/studio/release");
assert.equal(appRouteForNativeUrl("/artist/wolf-bridges", "android"), "/app/android/creator/wolf-bridges");
assert.equal(appRouteForNativeUrl("/shows/harare-after-dark", "ios"), "/app/ios/show/harare-after-dark");
assert.equal(appRouteForNativeUrl("/artist/premium", "ios"), "/app/ios/studio/money");
assert.equal(appRouteForNativeUrl("https://evil.example/app/ios/library", "ios"), null);
assert.equal(appRouteForNativeUrl("javascript:alert(1)", "android"), null);
assert.equal(appRouteForNativeUrl("", "ios"), null);

console.log("Native app-link routing checks passed");
