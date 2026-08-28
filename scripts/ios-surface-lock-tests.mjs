import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Load lock + copy modules through TypeScript by spawning node strip-types on a
// tiny harness, avoiding Next path-alias / extension friction in CI scripts.
const harness = `
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
const root = ${JSON.stringify(root)};
const lockUrl = pathToFileURL(path.join(root, "src/lib/ios-surface-lock.ts")).href;
const copyUrl = pathToFileURL(path.join(root, "src/lib/ios-surface-copy.ts")).href;
const lock = await import(lockUrl);
// copy imports lock with extensionless path; rewrite by importing lock first is not enough.
// So we only import lock here and parse copy file text for keys.
console.log(JSON.stringify({
  root: lock.IOS_SURFACE_ROOT,
  forbidden: lock.IOS_FORBIDDEN_PRODUCT_MARKERS,
  allowedPrimary: lock.IOS_ALLOWED_PRIMARY_PATHS,
  checks: {
    rootOk: lock.isAllowedIosPathname("/app/ios"),
    exploreOk: lock.isAllowedIosPathname("/app/ios/explore"),
    trackOk: lock.isAllowedIosPathname("/app/ios/track/abc"),
    studioDenied: !lock.isAllowedIosPathname("/creator/studio"),
    nestedDenied: !lock.isAllowedIosPathname("/app/ios/creator/studio"),
    webLibDenied: !lock.isAllowedIosPathname("/library"),
  }
}));
try { lock.assertPlainIosCopy("Open /creator/studio now", "bad"); console.log(JSON.stringify({ badCopyRejected: false })); }
catch { console.log(JSON.stringify({ badCopyRejected: true })); }
try { lock.assertPlainIosCopy('Click <a href="/x">x</a>', "bad-html"); console.log(JSON.stringify({ badHtmlRejected: false })); }
catch { console.log(JSON.stringify({ badHtmlRejected: true })); }
`;

import { spawnSync } from "node:child_process";
const tmpHarness = path.join(root, "scripts/.ios-surface-lock-harness.mts");
fs.writeFileSync(tmpHarness, harness);
// ios-surface-copy uses extensionless import; for harness we only need lock.
// Patch a temporary copy module loader: make ios-surface-lock importable with .ts
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", tmpHarness],
  { encoding: "utf8", cwd: root },
);
fs.unlinkSync(tmpHarness);
if (result.status !== 0) {
  throw new Error(`lock harness failed:\n${result.stderr || result.stdout}`);
}
const lines = result.stdout
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("{"));
const payload = JSON.parse(lines[0]);
const badCopy = JSON.parse(lines[1]);
const badHtml = JSON.parse(lines[2]);

assert(payload.root === "/app/ios", "root path");
assert(payload.checks.rootOk, "root allowed");
assert(payload.checks.exploreOk, "explore allowed");
assert(payload.checks.trackOk, "track detail allowed");
assert(payload.checks.studioDenied, "studio path denied");
assert(payload.checks.nestedDenied, "nested studio denied");
assert(payload.checks.webLibDenied, "web library not ios path");
assert(badCopy.badCopyRejected, "copy lane must reject route injection");
assert(badHtml.badHtmlRejected, "copy lane must reject markup");

// Copy lane file must freeze plain strings only (static review)
const copySrc = read("src/lib/ios-surface-copy.ts");
assert(copySrc.includes("assertPlainIosCopy"), "copy lane validates plain text");
assert(copySrc.includes("homeTitle"), "copy lane has home title");
assert(!copySrc.includes("/creator/studio"), "copy values must not embed studio route");

// --- capacitor untouched ---
const capacitor = read("capacitor.config.ts");
assert(capacitor.includes("https://bvsradio.com/app/${mobileSurface}"), "native URL must stay production mobile surface");
assert(!capacitor.includes("allowNavigation:"), "Build 3 must not whitelist broad navigation hosts");
assert(capacitor.includes('appId: "com.bvsradio.app"'), "bundle id must remain com.bvsradio.app");

// --- iOS home uses locked hero, not web HomeListenPanel ---
const home = read("src/app/app/[surface]/page.tsx");
assert(home.includes("IosListenHero"), "iOS home must mount locked IosListenHero");
assert(home.includes('surface === "ios"'), "iOS branch must be explicit");
assert(home.includes("IOS_SURFACE_COPY"), "iOS home copy must come from copy lane");

const iosHero = read("src/components/app/IosListenHero.tsx");
assert(iosHero.includes("IosHomeListenPanel"), "locked hero uses iOS-stable listen panel");
assert(
  !/from\s+["']@\/components\/HomeListenPanel["']/.test(iosHero),
  "locked hero must not import web HomeListenPanel",
);

const iosPanel = read("src/components/app/IosHomeListenPanel.tsx");
assert(iosPanel.includes("useStationPlayer"), "iOS panel keeps shared player contract");
assert(!iosPanel.includes("@/components/HomeListenPanel"), "no re-export of web home panel");

// --- boundary still fail-closed ---
const boundary = read("src/components/MobileIosBoundary.tsx");
assert(boundary.includes('Capacitor.getPlatform() === "ios"'), "boundary is iOS-native");
assert(boundary.includes("window.location.replace(IOS_ROOT)"), "boundary fails closed to /app/ios");
assert(boundary.includes("openOutsideNativeShell"), "non-app destinations externalise");

// --- station fail-closed clearance join remains ---
const station = read("src/lib/station-library.ts");
assert(station.includes("mobile_distribution_clearances!inner"), "station must inner-join mobile clearance");
assert(station.includes("mobile_distribution_clearances.status=eq.cleared"), "station must require cleared");
assert(station.includes("return surface ? [] : shuffleDaily(localFallback)"), "mobile station fail-closed");
assert(station.includes('!surface || track.src.startsWith("/")'), "mobile station rejects absolute audio URLs");

const IOS_FORBIDDEN_PRODUCT_MARKERS = payload.forbidden;

// --- no forbidden product surface imports/links under iOS shell tree ---
const iosShellFiles = [
  "src/app/app/[surface]/page.tsx",
  "src/app/app/[surface]/layout.tsx",
  "src/app/app/[surface]/explore/page.tsx",
  "src/app/app/[surface]/beats/page.tsx",
  "src/app/app/[surface]/library/page.tsx",
  "src/app/app/[surface]/account/page.tsx",
  "src/app/app/[surface]/artists/page.tsx",
  "src/app/app/[surface]/track/[id]/page.tsx",
  "src/app/app/[surface]/beat/[id]/page.tsx",
  "src/app/app/[surface]/artist/[slug]/page.tsx",
  "src/components/app/IosListenHero.tsx",
  "src/components/app/IosHomeListenPanel.tsx",
  "src/components/app/AppListenHero.tsx",
  "src/components/app/AppExploreView.tsx",
  "src/components/app/AppRail.tsx",
  "src/components/app/AppSceneTrail.tsx",
  "src/components/MobileIosBoundary.tsx",
  "src/components/MobileAccountPanel.tsx",
  "src/lib/ios-surface-copy.ts",
];

for (const rel of iosShellFiles) {
  const text = read(rel);
  for (const marker of IOS_FORBIDDEN_PRODUCT_MARKERS) {
    assert(!text.includes(marker), `${rel} must not reference forbidden marker ${marker}`);
  }
  assert(!text.includes("SongWorkspace"), `${rel} must not mount SongWorkspace`);
  assert(!text.includes("QuickBeatCreate"), `${rel} must not mount QuickBeatCreate`);
}

const importRe = /from\s+["']([^"']+)["']/g;
const forbiddenImportSnippets = [
  "SongWorkspace",
  "QuickBeatCreate",
  "QuickServiceCreate",
  "creator/studio",
  "song-workspaces",
];
for (const rel of iosShellFiles) {
  const text = read(rel);
  let match;
  while ((match = importRe.exec(text))) {
    const spec = match[1];
    for (const bad of forbiddenImportSnippets) {
      assert(!spec.includes(bad), `${rel} imports forbidden ${spec}`);
    }
  }
}

assert(read("src/app/layout.tsx").includes("<MobileIosBoundary />"), "root layout mounts iOS boundary");
assert(home.includes("AppSceneTrail") && home.includes("AppRail"), "listener shell chrome remains");

assert(fs.existsSync(path.join(root, "src/app/page.tsx")), "web home exists independently");
assert(fs.existsSync(path.join(root, "src/components/HomeListenPanel.tsx")), "web listen panel exists independently");
assert(read("src/components/app/AppListenHero.tsx").includes("HomeListenPanel"), "android/web-shared hero still uses HomeListenPanel");
assert(!read("src/components/app/AppListenHero.tsx").includes("IosHomeListenPanel"), "web/android hero stays off iOS panel");
assert(
  read("src/components/HomeListenPanel.tsx") !== read("src/components/app/IosHomeListenPanel.tsx"),
  "web and iOS listen panels are separate files",
);

console.log("iOS surface lock assertions passed.");
console.log(
  JSON.stringify(
    {
      root: payload.root,
      forbiddenMarkers: IOS_FORBIDDEN_PRODUCT_MARKERS.length,
      allowedPrimary: payload.allowedPrimary.length,
    },
    null,
    2,
  ),
);
