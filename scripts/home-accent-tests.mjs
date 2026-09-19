import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const css = read("src/app/section-accents.css");
const home = read("src/app/page.tsx");
const engagement = read("src/components/home/HomeEngagementHub.tsx");
const beats = read("src/components/flow/HomeBeatRail.tsx");
const playlists = read("src/components/home/HomePublicPlaylistRail.tsx");

for (const accent of ["listen", "discover", "feed", "beats", "studio", "marketplace", "shows"]) {
  assert(css.includes(`[data-home-accent="${accent}"]`), `home palette includes ${accent}`);
}
assert(css.includes(".bvs-home-accent-button"), "home accent buttons share one restrained treatment");
assert(css.includes(".bvs-home-accent-card"), "home accent cards share one restrained hover treatment");
assert(home.includes('data-home-accent="discover"'), "hero discovery uses Explore teal");
assert(home.includes('data-home-accent="studio"'), "creator CTA uses Studio blue");
assert(home.includes('data-home-accent="shows"'), "shows CTA uses Shows rose");
assert(home.includes('data-home-accent="marketplace"'), "marketplace CTA uses Marketplace green");
assert(engagement.includes("accentForMove"), "personalized home actions map to the product palette");
assert(engagement.includes('data-home-accent="feed"'), "home ownership CTA uses Feed lavender");
assert(beats.includes('data-home-accent="beats"'), "BeatStore rail uses BeatStore purple");
assert(playlists.includes('data-home-accent="feed"'), "playlist rail uses Feed lavender");

console.log("home accent regression checks passed");
