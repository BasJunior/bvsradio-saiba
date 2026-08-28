import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const home = read("src/app/creator/studio/page.tsx");
const manage = read("src/app/creator/studio/manage/page.tsx");
const marketplace = read("src/app/api/marketplace/route.ts");
const analytics = read("src/lib/analytics.ts");
const capacitor = read("capacitor.config.ts");

assert(home.includes("/creator/studio/create/release"), "home has Release music");
assert(home.includes("/creator/studio/create/beat"), "home has Sell a beat");
assert(home.includes("/creator/studio/create/service"), "home has Offer a service");
assert(home.includes("/creator/studio/manage"), "home links full Studio");
assert(home.includes('href="/artists"'), "money stays on production wallet /artists");
assert(home.includes("legacyStudioAnchors"), "legacy hash redirects exist");
assert(home.includes("studio_open"), "studio_open instrumentation");
assert(fs.existsSync(path.join(root, "src/app/creator/studio/create/release/page.tsx")), "release route");
assert(fs.existsSync(path.join(root, "src/app/creator/studio/create/beat/page.tsx")), "beat route");
assert(fs.existsSync(path.join(root, "src/app/creator/studio/create/service/page.tsx")), "service route");
assert(manage.includes("Welcome,") || manage.includes("Creator studio"), "manage keeps production Studio");
assert(manage.includes("/creator/studio"), "manage links home");
assert(marketplace.includes('"recording"'), "recording category");
assert(marketplace.includes('"studio_session"'), "studio_session category");
assert(analytics.includes("create_intent_selected"), "create_intent_selected allowlisted");
assert(!analytics.includes("lyrics_pad_open"), "this candidate must not bundle Lyrics Pad analytics");
assert(capacitor.includes("https://bvsradio.com/app/${mobileSurface}") || capacitor.includes("bvsradio.com/app/"), "capacitor still live hybrid");

const pkg = JSON.parse(read("package.json"));
const build = pkg.scripts.build || "";
const vercelBuild = pkg.scripts["vercel-build"] || "";
assert(build.includes("test:ios-surface-gates"), "build keeps C03 iOS gates");
assert(build.includes("test:studio-intent"), "build also runs Studio intent test");
assert(build.includes("next build"), "build still runs next build");
assert(vercelBuild.includes("test:ios-surface-gates") && vercelBuild.includes("test:studio-intent"), "vercel-build keeps iOS gates and Studio test");
assert((pkg.scripts["test:ios-surface-gates"] || "").includes("test:ios-surface-lock"), "ios-surface-lock still in gates");
assert((pkg.scripts["test:ios-surface-gates"] || "").includes("test:apple-ios-surface"), "apple-ios-surface still in gates");
assert(fs.existsSync(path.join(root, "src/lib/ios-surface-lock.ts")), "C03 iOS lock contract present");
assert(fs.existsSync(path.join(root, "src/components/app/IosHomeListenPanel.tsx")), "C03 iOS listen panel present");

const iosFiles = walk(path.join(root, "src/app/app")).map((file) => read(path.relative(root, file)));
const iosJoined = iosFiles.join("\n");
assert(!iosJoined.includes("creator/studio/create"), "iOS shell does not mount Studio create routes");
assert(!iosJoined.includes("QuickBeatCreate"), "iOS shell does not import beat create");
assert(!iosJoined.includes("SongWorkspace"), "iOS shell does not import Lyrics Pad");
assert(!/from ["']@\/app\/creator\//.test(iosJoined), "iOS shell does not import creator app routes");

console.log("Studio intent assertions passed.");
