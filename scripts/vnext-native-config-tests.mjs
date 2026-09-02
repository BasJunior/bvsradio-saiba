import assert from "node:assert/strict";

const original = { ...process.env };
let sequence = 0;
async function config(variant, url, surface = "ios") {
  process.env.BVS_APP_VARIANT = variant;
  process.env.BVS_MOBILE_SURFACE = surface;
  if (url === undefined) delete process.env.BVS_MOBILE_URL;
  else process.env.BVS_MOBILE_URL = url;
  return (await import(`../capacitor.config.ts?test=${++sequence}`)).default;
}
try {
  for (const url of [undefined, "http://vnext.example/app/ios", "https://bvsradio.com/app/ios", "https://www.bvsradio.com/app/ios", "https://bvsradio-beta.vercel.app/app/ios", "https://vnext.example/", "https://vnext.example/app/ios?token=secret", "https://user:secret@vnext.example/app/ios"]) {
    await assert.rejects(config("vnext", url));
  }
  const ios = await config("vnext", "https://vnext.example/app/ios");
  assert.equal(ios.appId, "com.bvsradio.app");
  assert.equal(ios.ios.path, "ios");
  assert.equal(ios.server.url, "https://vnext.example/app/ios");
  assert.deepEqual(ios.server.allowNavigation, ["vnext.example", "https://vnext.example/*"]);
  const android = await config("vnext", "https://vnext.example/app/android", "android");
  assert.equal(android.appId, "com.bvsradio.app");
  const production = await config("production", undefined);
  assert.equal(production.server.url, "https://bvsradio.com/app/ios");
  const beta = await config("beta", "https://bvsradio-beta.vercel.app");
  assert.equal(beta.appId, "com.bvsradio.beta");
  assert.equal(beta.ios.path, "ios-beta");
  await assert.rejects(config("unknown", undefined));
  console.log("vNext native configuration isolation checks passed");
} finally {
  for (const key of ["BVS_APP_VARIANT", "BVS_MOBILE_URL", "BVS_MOBILE_SURFACE"]) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
}
