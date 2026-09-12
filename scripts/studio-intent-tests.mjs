import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Public web Creator Studio keeps its existing production workflows.
const home = read("src/app/creator/studio/page.tsx");
const manage = read("src/app/creator/studio/manage/page.tsx");
const marketplace = read("src/app/api/marketplace/route.ts");
const analytics = read("src/lib/analytics.ts");
const capacitor = read("capacitor.config.ts");
const quickBeat = read("src/components/QuickBeatCreate.tsx");
const beatPack = read("src/components/BeatPackUploadForm.tsx");
const beatPackRoute = read("src/app/api/beat-packs/route.ts");
const webNavbar = read("src/components/layout/Navbar.tsx");
const accessRoute = read("src/app/api/auth/access/route.ts");

assert(home.includes("/creator/studio/create/release"), "web Studio has Release music");
assert(home.includes("/creator/studio/create/beat"), "web Studio has Sell a beat");
assert(home.includes("/creator/studio/create/service"), "web Studio has Offer a service");
assert(home.includes("/creator/studio/manage"), "web Studio links full Studio");
assert(home.includes('href="/artists"'), "web Studio money stays on production wallet /artists");
assert(home.includes("legacyStudioAnchors"), "web Studio legacy hash redirects remain");
assert(home.includes("studio_open"), "web Studio instrumentation remains");
assert(exists("src/app/creator/studio/create/release/page.tsx"), "web release route exists");
assert(exists("src/app/creator/studio/create/beat/page.tsx"), "web beat route exists");
assert(exists("src/app/creator/studio/create/service/page.tsx"), "web service route exists");
assert(manage.includes("Welcome,") || manage.includes("Creator studio"), "web manage keeps production Studio");
assert(manage.includes("/creator/studio"), "web manage links home");
assert(marketplace.includes('"recording"'), "recording category remains");
assert(marketplace.includes('"studio_session"'), "studio_session category remains");
assert(analytics.includes("create_intent_selected"), "create_intent_selected remains allowlisted");
assert(capacitor.includes("https://bvsradio.com/app/${mobileSurface}") || capacitor.includes("bvsradio.com/app/"), "Capacitor still loads live contained app surface");

// Web should treat Studio as a first-class creator destination, using the same access source of truth.
assert(accessRoute.includes("const isCreator = profileRole !== 'listener' || isProducerFlag || isEditorial"), "web/app access must keep creator identity source of truth");
assert(webNavbar.includes("const showCreator = Boolean(access?.creator)"), "web Studio visibility must use creator access");
assert(webNavbar.includes('data-bvs-web-studio="desktop"'), "desktop web creators must get a first-class Studio button");
assert(webNavbar.includes('data-bvs-web-studio="mobile"'), "mobile web creators must get a one-tap Studio button");
assert(webNavbar.includes('href="/creator/studio"'), "web Studio button must open canonical Creator Studio");
assert(webNavbar.includes("studioActive"), "web Studio button must expose active-route state");

assert(quickBeat.includes("BeatPackUploadForm"), "Sell a beat exposes existing beat-pack uploader");
assert(quickBeat.includes("Beat pack / EP"), "Sell a beat includes Beat pack / EP mode");
assert(quickBeat.includes('setMode("pack")'), "beat-pack mode can be selected");
assert(quickBeat.includes('trackEvent("create_submission_complete"'), "single-beat submission analytics remain intact");
assert(beatPack.includes("/api/beat-packs"), "beat-pack form uses existing pack API");
assert(beatPackRoute.includes("items.length < 2 || items.length > 20"), "beat-pack API preserves 2–20 item bound");

// Build gates remain active; the vNext reconciliation updates their contracts rather than bypassing them.
const pkg = JSON.parse(read("package.json"));
const build = pkg.scripts.build || "";
const vercelBuild = pkg.scripts["vercel-build"] || "";
assert(build.includes("test:ios-surface-gates"), "build keeps iOS surface gates");
assert(build.includes("test:studio-intent"), "build keeps Studio intent test");
assert(build.includes("next build"), "build still runs next build");
assert(vercelBuild.includes("test:ios-surface-gates") && vercelBuild.includes("test:studio-intent"), "vercel-build keeps iOS gates and Studio test");
assert((pkg.scripts["test:ios-surface-gates"] || "").includes("test:ios-surface-lock"), "ios-surface-lock remains in gates");
assert((pkg.scripts["test:ios-surface-gates"] || "").includes("test:apple-ios-surface"), "apple-ios-surface remains in gates");

// vNext keeps the fourth tab contextual: listeners see Beats; creators see contained Studio.
const appStudioRoute = read("src/app/app/[surface]/studio/page.tsx");
const appStudio = read("src/components/app-vnext/AppStudioClient.tsx");
const appNav = read("src/components/app-vnext/AppBottomNav.tsx");
const appYou = read("src/components/app-vnext/AppYouClient.tsx");
assert(appStudioRoute.includes("AppStudioClient"), "vNext Studio route must use AppStudioClient");
assert(appNav.includes('label: "Feed"'), "Feed must be available for all roles");
assert(appNav.includes('label: "Studio"'), "creator fourth tab must be Studio");
assert(appNav.includes('data-bvs-role-tab={isCreator ? "studio" : "beats"}'), "Beats/Studio switch must use the existing creator access state");
assert(appNav.includes('href: `${base}/studio`'), "creator Studio tab must stay in contained app namespace");
assert(appNav.includes('href: `${base}/feed`'), "listener Feed tab must stay in contained app namespace");
assert(appYou.includes('Turn on creator access.'), "listener Create option must live under You");
assert(appYou.includes('href={`/app/${surface}/account#creator-role`}'), "listener Create option must lead to contained creator-role setup");

for (const route of [
  "src/app/app/[surface]/studio/release/page.tsx",
  "src/app/app/[surface]/studio/beats/page.tsx",
  "src/app/app/[surface]/studio/insights/page.tsx",
  "src/app/app/[surface]/studio/money/page.tsx",
]) {
  assert(exists(route), `${route} must exist`);
}

assert(appStudio.includes('`/app/${surface}/studio/release`'), "app Studio release workflow stays contained");
assert(appStudio.includes('`/app/${surface}/studio/beats`'), "app Studio BeatStore workflow stays contained");
assert(appStudio.includes('`/app/${surface}/studio/insights`'), "app Studio insights workflow stays contained");
assert(appStudio.includes('`/app/${surface}/studio/money`'), "app Studio money workflow stays contained");
assert(appStudio.includes('`/app/${surface}/account#creator-role`'), "listener-to-creator upgrade stays inside app");
assert(appStudio.includes('`/app/${surface}/join`'), "signed-out creator entry stays inside app");
assert(!/from ["']@\/app\/creator\//.test(appStudio), "vNext Studio must not import web route components directly");

// Producer creation is deliberately available inside vNext and reuses the shared uploader.
const appBeats = read("src/app/app/[surface]/studio/beats/page.tsx");
assert(appBeats.includes("BeatPackUploadForm"), "vNext BeatStore Studio exposes beat/pack upload");
assert(appBeats.includes("MyBeatStore"), "vNext BeatStore Studio exposes producer catalogue management");
assert(appBeats.includes('href={`/app/${surface}/studio`}'), "vNext BeatStore back link remains inside app");

// Release/insight/money destinations must likewise remain inside vNext rather than jumping to web.
for (const route of [
  "src/app/app/[surface]/studio/release/page.tsx",
  "src/app/app/[surface]/studio/insights/page.tsx",
  "src/app/app/[surface]/studio/money/page.tsx",
]) {
  const text = read(route);
  assert(text.includes('href={`/app/${surface}/studio`}'), `${route} back link must stay inside app`);
  assert(!/from ["']@\/app\/creator\//.test(text), `${route} must not import web creator route directly`);
}

console.log("Studio intent assertions passed for web + role-aware contained vNext Studio.");
