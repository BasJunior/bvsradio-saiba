import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const podfile = read("ios/App/Podfile");
for (const [name, pod] of Object.entries({
  app: "CapacitorApp", network: "CapacitorNetwork", preferences: "CapacitorPreferences",
  "push-notifications": "CapacitorPushNotifications", share: "CapacitorShare",
})) {
  assert.ok(pkg.dependencies[`@capacitor/${name}`], `Missing native dependency: ${name}`);
  assert.ok(podfile.includes(`pod '${pod}'`), `Missing iOS pod: ${pod}`);
}
assert.match(podfile, /disable_input_output_paths => false/);
assert.match(podfile, /new_copy_files_build_phase\('Embed Capacitor Frameworks'\)/);
assert.match(podfile, /CodeSignOnCopy/);
const delegate = read("ios/App/App/AppDelegate.swift");
assert.match(delegate, /registerPluginInstance\(BvsOfflineMediaPlugin\(\)\)/);
assert.match(delegate, /CAPPluginMethod\(name: "playbackSource"/);
assert.match(delegate, /Offline rights need revalidation before playback/);
assert.match(delegate, /capacitorDidRegisterForRemoteNotifications/);
assert.match(delegate, /capacitorDidFailToRegisterForRemoteNotifications/);
assert.match(delegate, /storagePolicy == "app-private"/);
assert.match(delegate, /exportAllowed == false/);
assert.match(delegate, /requiresRevalidation == true/);
assert.match(delegate, /isExcludedFromBackup = true/);
const androidOffline = read("android/app/src/main/java/com/bvsradio/app/BvsOfflineMediaPlugin.java");
assert.match(androidOffline, /void playbackSource\(PluginCall call\)/);
assert.match(androidOffline, /Offline rights need revalidation before playback/);
const offlineBridge = read("src/lib/app-offline-native.ts");
assert.match(offlineBridge, /playbackSource\(options:\{trackId:string\}\)/);
assert.match(offlineBridge, /Capacitor\.convertFileSrc/);
const info = read("ios/App/App/Info.plist");
assert.match(info, /<string>bvsradio<\/string>/);
assert.match(info, /<key>UIFileSharingEnabled<\/key>\s*<false\/>/);
assert.match(info, /<string>audio<\/string>/);
const entitlements = read("ios/App/App/App.entitlements");
assert.match(entitlements, /applinks:bvsradio.com/);
assert.match(entitlements, /\$\(BVS_APNS_ENVIRONMENT\)/);
assert.match(read("ios/App/App/PrivacyInfo.xcprivacy"), /CA92.1/);
const project = read("ios/App/App.xcodeproj/project.pbxproj");
assert.match(project, /BVS_APNS_ENVIRONMENT = development/);
assert.match(project, /BVS_APNS_ENVIRONMENT = production/);
assert.match(project, /CODE_SIGN_ENTITLEMENTS = App\/App.entitlements/);
console.log("vNext native integration contract checks passed (source checks, not device acceptance)");
