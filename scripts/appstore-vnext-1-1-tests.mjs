import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pbxPath = path.join(root, "ios/App/App.xcodeproj/project.pbxproj");
const plistPath = path.join(root, "ios/App/App/Info.plist");
if (fs.existsSync(pbxPath) && fs.existsSync(plistPath)) {
  const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
  assert(pbx.includes("MARKETING_VERSION = 1.1;"), "native marketing version must be 1.1");
  assert(pbx.includes("CURRENT_PROJECT_VERSION = 4;"), "native build must be 4");
  assert(pbx.includes("IPHONEOS_DEPLOYMENT_TARGET = 15.0;"), "minimum iOS must be 15");
  assert(pbx.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;"), "push/app-link entitlements must be signed");
  assert(pbx.includes("BvsOfflineMediaPlugin.swift"), "offline plugin must be in the Xcode target");

  const plist = read("ios/App/App/Info.plist");
  assert(plist.includes("<string>bvsradio</string>"), "custom URL scheme required");
  assert(plist.includes("<string>remote-notification</string>"), "push background mode required");
  assert(plist.includes("<string>audio</string>"), "audio background mode must remain");
} else {
  console.log("Skipping native Xcode file checks on this host (ios/ is not in the Vercel payload).");
}

const capacitor = read("capacitor.config.ts");
assert(capacitor.includes("https://bvsradio.com/app/${mobileSurface}"), "App Store binary must load production /app/ios");
assert(!capacitor.includes("allowNavigation:"), "do not broaden native navigation hosts");
assert(capacitor.includes('appId: "com.bvsradio.app"'), "keep the live App Store bundle id");

const shell = read("src/components/app-vnext/AppEditionShell.tsx");
assert(shell.includes("isAppStoreVnextVersion"), "vNext chrome must be version-gated");
assert(shell.includes('appShell") === "vnext"'), "preview query must be able to mount 1.1 chrome");
assert(shell.includes("AppBottomNav"), "1.1 chrome includes the five-tab nav");

const home = read("src/app/app/[surface]/page.tsx");
assert(home.includes("IosListenHero"), "approved listen home stays on the 1.1 candidate");
assert(home.includes("AppRail"), "cleared-catalogue rails stay on home");
assert(!home.includes("BVS App vNext"), "do not retitle the live app as a preview build");

for (const marker of ["SongWorkspace", "Lyrics Pad", "QuickBeatCreate"]) {
  assert(!shell.includes(marker), `1.1 shell must not mount ${marker}`);
  assert(!home.includes(marker), `home must not mount ${marker}`);
}

const native = read("src/lib/app-native.ts");
assert(native.includes('appVariant: "production"'), "push registration for the store binary is production");

const harness = `
import { pathToFileURL } from "node:url";
import path from "node:path";
const lock = await import(pathToFileURL(${JSON.stringify(path.join(root, "src/lib/ios-surface-lock.ts"))}).href);
const nativeUrl = pathToFileURL(${JSON.stringify(path.join(root, "src/lib/app-native.ts"))}).href;
console.log(JSON.stringify({
  v1: lock.isAllowedIosPathname("/app/ios/studio"),
  v11: lock.isAllowedIosPathname("/app/ios/studio", "1.1"),
  you: lock.isAllowedIosPathname("/app/ios/you", "1.1"),
  rooms: lock.isAllowedIosPathname("/app/ios/rooms/abc", "1.1"),
  version: lock.IOS_APPSTORE_VNEXT_VERSION,
}));
`;
const tmp = path.join(root, "scripts/.appstore-vnext-harness.mts");
fs.writeFileSync(tmp, harness);
const result = spawnSync(process.execPath, ["--experimental-strip-types", tmp], { encoding: "utf8", cwd: root });
fs.unlinkSync(tmp);
if (result.status !== 0) throw new Error(result.stderr || result.stdout);
const payload = JSON.parse(result.stdout.trim().split("\n").find((line) => line.startsWith("{")) || "{}");
assert(payload.v1 === false, "1.0 path lock still hides studio");
assert(payload.v11 === true, "1.1 path lock allows studio");
assert(payload.you === true, "1.1 path lock allows You");
assert(payload.rooms === true, "1.1 path lock allows rooms");
assert(payload.version === "1.1", "lock constant matches App Store 1.1");

console.log("App Store 1.1 vNext candidate assertions passed.");
