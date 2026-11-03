import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const css = read("src/app/section-accents.css");
const home = read("src/app/page.tsx");
const mediaStage = read("src/components/home/HomeMediaStage.tsx");
const engagement = read("src/components/home/HomeEngagementHub.tsx");
const shows = read("src/components/home/HomeShowsSection.tsx");
const beats = read("src/components/flow/HomeBeatRail.tsx");
const playlists = read("src/components/home/HomePublicPlaylistRail.tsx");

for (const accent of ["listen", "discover", "feed", "beats", "studio", "marketplace", "shows"]) {
  assert(css.includes(`[data-home-accent="${accent}"]`), `home palette includes ${accent}`);
}
assert(css.includes(".bvs-home-accent-button"), "home accent buttons share one restrained treatment");
assert(css.includes(".bvs-home-accent-card"), "home accent cards share one restrained hover treatment");
assert(home.includes("Listen closer. Build what comes next."), "root home restores the reference hero headline");
assert(home.includes("<HomeTopFive"), "home hero includes the visual Top 5 showcase");
assert(home.includes('src="/media/bvs-home-stage-loop.mp4"'), "home keeps the BVS teaser asset beneath the hero");
assert(home.includes("<video"), "home reference layout keeps an actual BVS Original video element");
assert(home.includes("controls"), "home BVS Original video exposes playback controls");
assert(home.includes("playsInline"), "home BVS Original video stays inline on mobile");
assert(home.includes("muted"), "home BVS Original video can autoplay without forcing audio");
assert(home.includes("loop"), "home BVS Original teaser loops");
assert(mediaStage.includes("<video"), "reusable media stage still renders an actual video element");
assert(mediaStage.includes("controls"), "reusable media stage still exposes playback controls");
assert(mediaStage.includes("playsInline"), "reusable media stage stays inline on mobile");
assert(mediaStage.includes("muted"), "reusable media stage can autoplay without forcing audio");
assert(mediaStage.includes("loop={!live}"), "non-live reusable media can loop without looping a live source");
assert(mediaStage.includes('live ? "Live on BVS" : eyebrow'), "live presentation remains explicit and data-driven");
assert(mediaStage.includes("data-home-accent={action.accent}"), "media-stage actions use the shared restrained home palette");
assert(shows.includes('data-home-accent="shows"'), "shows CTA uses Shows rose");
assert(home.includes('data-home-accent="marketplace"'), "marketplace CTA uses Marketplace green");
assert(engagement.includes("accentForMove"), "personalized home actions map to the product palette");
assert(engagement.includes('data-home-accent="feed"'), "home ownership CTA uses Feed lavender");
assert(beats.includes('data-home-accent="beats"'), "BeatStore rail uses BeatStore purple");
assert(playlists.includes('data-home-accent="feed"'), "playlist rail uses Feed lavender");

console.log("home accent and restored-reference regression checks passed");
