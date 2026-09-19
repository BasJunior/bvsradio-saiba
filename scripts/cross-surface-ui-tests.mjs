import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const css = read("src/app/section-accents.css");
const scope = read("src/components/layout/BvsSectionScope.tsx");
const editorial = read("src/app/admin/editorial/page.tsx");
const premium = read("src/app/premium/page.tsx");
const webLibrary = read("src/components/library/LibraryView.tsx");
const appLibrary = read("src/components/app-vnext/AppLibraryClient.tsx");
const appHome = read("src/app/app/[surface]/page.tsx");
const appDiscovery = read("src/components/app-vnext/AppHomeDiscoverySections.tsx");
const appStudio = read("src/components/app-vnext/AppStudioClient.tsx");
const appMoney = read("src/app/app/[surface]/studio/money/page.tsx");
const appYou = read("src/components/app-vnext/AppYouClient.tsx");
const appBootstrap = read("src/components/app-vnext/AppBootstrap.tsx");

for (const section of ["editorial", "premium", "library"]) {
  assert(scope.includes(`return "${section}"`), `${section} gets explicit section lighting`);
  assert(css.includes(`[data-bvs-section="${section}"]`), `${section} lighting palette exists`);
}
for (const accent of ["core", "releases", "beats", "people", "marketplace", "shows", "money"]) {
  assert(css.includes(`[data-editorial-accent="${accent}"]`), `editorial palette includes ${accent}`);
}
for (const accent of ["instant", "artist", "producer", "creator_bundle", "service", "team", "curator", "supporter", "brand"]) {
  assert(css.includes(`[data-premium-accent="${accent}"]`), `Premium palette includes ${accent}`);
}
for (const accent of ["library", "discover", "beats", "downloads"]) {
  assert(css.includes(`[data-library-accent="${accent}"]`), `Library palette includes ${accent}`);
}

assert(editorial.includes("Needs review"), "Editorial overview aggregates actionable review work");
assert(editorial.includes("Processed decisions"), "Editorial overview separates processed work");
assert(editorial.includes('accent="beats"'), "Editorial BeatStore queue is purple");
assert(editorial.includes('accent="money"'), "Editorial money surfaces are gold");
assert(editorial.includes('data-editorial-accent="marketplace"'), "Editorial marketplace surface is green");
assert(editorial.includes("bvs-editorial-panel mt-5"), "Editorial queue spacing stays compact");

assert(premium.includes("premiumAccentFor"), "Premium plans map to product accents");
assert(premium.includes('data-premium-accent={item}'), "Premium family switcher carries family colour");
assert(premium.includes("bvs-premium-accent-card"), "Premium cards use restrained family accents");
assert(premium.includes("statusClass(plan.status)"), "Premium availability statuses keep status semantics");

assert(webLibrary.includes("libraryAccent"), "web Library maps sections to semantic accents");
assert(webLibrary.includes('accent="downloads"'), "web Downloads uses its blue lane");
assert(webLibrary.includes("bvs-library-accent-card"), "web Library uses restrained accent cards");
assert(appLibrary.includes("appLibraryAccent"), "iOS Library mirrors section accents");
assert(appLibrary.includes('accent="downloads"'), "iOS Downloads mirrors blue lane");
assert(appLibrary.includes("bvs-library-accent-card"), "iOS Library mirrors accent cards");

assert(appHome.includes('data-home-accent="feed"'), "iOS Home mirrors Feed lavender");
assert(appHome.includes('data-home-accent="studio"'), "iOS Home mirrors Studio blue");
assert(appHome.includes('data-home-accent="marketplace"'), "iOS Home mirrors Marketplace green");
assert(appDiscovery.includes('data-home-accent="discover"'), "iOS Home discovery is teal");
assert(appDiscovery.includes('data-home-accent="shows"'), "iOS Home shows are rose");

assert(appStudio.includes('accent: "beats"'), "iOS Studio BeatStore is purple");
assert(appStudio.includes('accent: "insights"'), "iOS Studio Insights are teal");
assert(appStudio.includes('accent: "marketplace"'), "iOS Studio marketplace is green");
assert(appStudio.includes('accent: "money"'), "iOS Studio Money is gold");
assert(appMoney.includes('data-studio-accent="money"'), "iOS Money surface carries Premium/money identity");
assert(appYou.includes('data-studio-accent="money"'), "iOS Premium status uses the money identity");

assert(!appBootstrap.includes('path === "/premium"'), "web Premium is not forced into a duplicate iOS pricing page");
assert(!appBootstrap.includes('path === "/editorial"'), "Editorial remains web-only staff tooling");

console.log("cross-surface UI system checks passed");
