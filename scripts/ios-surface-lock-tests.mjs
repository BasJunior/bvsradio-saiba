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

// Native shell contract: App Store build must continue loading the contained
// production mobile surface, without opening broad in-WebView navigation.
const capacitor = read("capacitor.config.ts");
assert(capacitor.includes("https://bvsradio.com/app/${mobileSurface}"), "native URL must stay production mobile surface");
assert(!capacitor.includes("allowNavigation:"), "native shell must not whitelist broad navigation hosts");
assert(capacitor.includes('appId: "com.bvsradio.app"'), "bundle id must remain com.bvsradio.app");

// Root boundary must keep native iOS inside /app/ios and externalise unrelated web links.
const boundary = read("src/components/MobileIosBoundary.tsx");
assert(boundary.includes('Capacitor.getPlatform() === "ios"'), "boundary must only activate for native iOS");
assert(boundary.includes('const IOS_ROOT = "/app/ios"'), "boundary root must remain /app/ios");
assert(boundary.includes('pathname.startsWith(`${IOS_ROOT}/`)'), "all contained vNext child routes must remain navigable");
assert(boundary.includes("openOutsideNativeShell"), "non-app destinations must open outside the native shell");
assert(boundary.includes("window.location.replace(IOS_ROOT)"), "unexpected native routes must fail closed to app home");

// vNext app layout must own the mobile experience. This protects against the
// older four-tab app tree being merged back over the current app.
const layout = read("src/app/app/[surface]/layout.tsx");
assert(layout.includes("@/components/app-vnext/AppBootstrap"), "mobile route must use vNext bootstrap");
assert(layout.includes("@/components/app-vnext/AppBottomNav"), "mobile route must use vNext bottom navigation");
assert(layout.includes("<AppNativeRuntime"), "mobile route must mount native runtime bridge");
assert(layout.includes("<AppSessionProvider>"), "mobile route must keep app session provider");
assert(layout.includes("<AppBottomNav surface={surface}"), "mobile route must render vNext bottom navigation");

// Root web chrome must never compete with vNext. This specifically blocks the
// old four-tab MobileFlowNav and old app header from being streamed into /app/*.
const rootLayout = read("src/app/layout.tsx");
const rootChrome = read("src/components/layout/RootChrome.tsx");
assert(rootLayout.includes("<RootNavbar />"), "root layout must use route-aware navbar wrapper");
assert(rootLayout.includes("<RootMobileFlowNav />"), "root layout must use route-aware mobile nav wrapper");
assert(!rootLayout.includes("<Navbar />"), "root layout must not mount legacy Navbar directly");
assert(!rootLayout.includes("<MobileFlowNav />"), "root layout must not mount legacy MobileFlowNav directly");
assert(rootChrome.includes('/^\\/app\\/(ios|android)(?:\\/|$)/'), "root chrome guard must recognize vNext iOS/Android routes");
assert(rootChrome.includes("if (isVNextAppPath(pathname)) return null"), "legacy root chrome must return null on vNext routes");

// Five-tab invariant: Home / Discover / Library / Create-or-Studio / You.
const nav = read("src/components/app-vnext/AppBottomNav.tsx");
assert(nav.includes("grid-cols-5"), "bottom navigation must render five columns");
assert(nav.includes('label: "Home"'), "bottom navigation must contain Home");
assert(nav.includes('label: "Discover"'), "bottom navigation must contain Discover");
assert(nav.includes('label: "Library"'), "bottom navigation must contain Library");
assert(nav.includes('label: isCreator ? "Studio" : "Create"'), "bottom navigation must contain Create/Studio");
assert(nav.includes('label: "You"'), "bottom navigation must contain You");
assert(nav.includes('`${base}/studio`'), "Create/Studio must stay inside the app shell");
assert(nav.includes('`${base}/you`'), "You must stay inside the app shell");

// Required primary destinations must actually exist so nav cannot point at 404s.
for (const rel of [
  "src/app/app/[surface]/page.tsx",
  "src/app/app/[surface]/explore/page.tsx",
  "src/app/app/[surface]/library/page.tsx",
  "src/app/app/[surface]/studio/page.tsx",
  "src/app/app/[surface]/you/page.tsx",
]) {
  assert(exists(rel), `${rel} must exist`);
}

// Library contract: the new low-scroll hub must live inside vNext, default to
// All, and keep playlists/downloads first-class without reintroducing Lyrics as a Library tab.
const libraryRoute = read("src/app/app/[surface]/library/page.tsx");
assert(libraryRoute.includes("AppLibraryClient"), "app Library route must use vNext Library client");
const library = read("src/components/app-vnext/AppLibraryClient.tsx");
assert(library.includes('useState<ActiveSection>("all")'), "Library must default to All");
assert(library.includes('{ id: "all", label: "All" }'), "Library must expose All");
assert(library.includes('{ id: "liked", label: "Liked" }'), "Library must expose Liked");
assert(library.includes('{ id: "playlists", label: "Playlists" }'), "Library must expose Playlists");
assert(library.includes('{ id: "downloads", label: "Downloads" }'), "Library must expose Downloads");
assert(library.includes("Quick access"), "Library must keep quick-access hub");
assert(library.includes("Your Library now"), "Library must keep activity hub");
assert(!library.includes('label: "Lyrics"'), "Lyrics must not return as a Library tab");
assert(library.includes("<AppPlaylists"), "Library must keep native playlists");
assert(library.includes("<AppOfflineDownloads"), "Library must keep native downloads");

// App-specific runtime/API dependencies must be present; missing any of these
// previously produces a build that renders nav but breaks interactions.
for (const rel of [
  "src/lib/app-api-auth.ts",
  "src/lib/app-external-boundary.ts",
  "src/lib/app-link-routing.ts",
  "src/lib/app-native.ts",
  "src/lib/app-offline-native.ts",
  "src/lib/app-telemetry.ts",
  "src/app/api/app/playlists/route.ts",
]) {
  assert(exists(rel), `${rel} must exist`);
}

// Rights-sensitive mobile station remains fail-closed.
const station = read("src/lib/station-library.ts");
assert(station.includes("mobile_distribution_clearances!inner"), "station must inner-join mobile clearance");
assert(station.includes("mobile_distribution_clearances.status=eq.cleared"), "station must require cleared mobile distribution");
assert(station.includes("return surface ? [] : shuffleDaily(localFallback)"), "mobile station fallback must fail closed");

// Web must remain independently present; restoring vNext must not replace the public site.
assert(exists("src/app/page.tsx"), "public web home must remain present");
assert(exists("src/app/beat/[id]/page.tsx"), "web beat workspace must remain present");
assert(exists("src/components/beatstore/BeatWorkflow.tsx"), "web beat/Lyrics workflow must remain present");

console.log("vNext iOS surface assertions passed.");
console.log(JSON.stringify({ tabs: 5, libraryDefault: "all", legacyAppChrome: false, beatWorkspacePreserved: true }, null, 2));
