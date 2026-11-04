import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Review products are staged separately: release configuration, signing and the
// production bundle remain untouched. Start `npm run dev` in another terminal.
const udid = process.argv[2];
if (!udid || !/^[0-9A-F-]{36}$/i.test(udid)) {
  throw new Error("Usage: npm run ios:simulator-review -- <simulator-UDID>");
}
const route = process.argv[3] || "/app/ios";
const reviewUrl = new URL(route, "http://localhost:3000");
if (reviewUrl.origin !== "http://localhost:3000" || !/^\/app\/ios(?:\/|$)/.test(reviewUrl.pathname)) {
  throw new Error("Review routes must stay inside http://localhost:3000/app/ios.");
}
const root = resolve(import.meta.dirname, "..");
process.chdir(root);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

const response = await fetch("http://localhost:3000/app/ios");
if (!response.ok) throw new Error("Start the local BVS dev server on port 3000 first.");
const derived = resolve("artifacts/ios-simulator");
const staged = resolve("artifacts/ios-review/App.app");
mkdirSync("out", { recursive: true });
if (!existsSync("out/index.html")) writeFileSync("out/index.html", "<!doctype html><title>BVS Review</title>");
run("npx", ["cap", "sync", "ios"]);
run("xcodebuild", ["-workspace", "ios/App/App.xcworkspace", "-scheme", "App", "-configuration", "Debug", "-sdk", "iphonesimulator", "-arch", "arm64", "-derivedDataPath", derived, "build", "CODE_SIGNING_ALLOWED=NO"]);
cpSync(`${derived}/Build/Products/Debug-iphonesimulator/App.app`, staged, { recursive: true });
const configPath = `${staged}/capacitor.config.json`;
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.appId = "com.bvsradio.app.review";
config.appName = "BVS Review";
config.server = { url: reviewUrl.href, cleartext: true };
writeFileSync(configPath, JSON.stringify(config, null, 2));
const plist = `${staged}/Info.plist`;
run("/usr/libexec/PlistBuddy", ["-c", "Set :CFBundleIdentifier com.bvsradio.app.review", plist]);
run("/usr/libexec/PlistBuddy", ["-c", "Set :CFBundleDisplayName BVS Review", plist]);
run("/usr/libexec/PlistBuddy", ["-c", "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true", plist]);
// Require a booted simulator; never select or install onto a physical device.
run("xcrun", ["simctl", "bootstatus", udid, "-b"]);
run("xcrun", ["simctl", "install", udid, staged]);
run("xcrun", ["simctl", "launch", "--terminate-running-process", udid, "com.bvsradio.app.review"]);
console.log("BVS Review launched against localhost. Open Xcode Device Hub to review.");
