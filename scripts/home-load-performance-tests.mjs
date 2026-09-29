import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artistsRoute = await readFile(new URL("../src/app/api/artists/route.ts", import.meta.url), "utf8");
const releasesRoute = await readFile(new URL("../src/app/api/releases/public/route.ts", import.meta.url), "utf8");
const releasesLib = await readFile(new URL("../src/lib/public-releases.ts", import.meta.url), "utf8");
const beatsRoute = await readFile(new URL("../src/app/api/beats/route.ts", import.meta.url), "utf8");
const beatServer = await readFile(new URL("../src/lib/beatstore-server.ts", import.meta.url), "utf8");
const playlistsRoute = await readFile(new URL("../src/app/api/playlists/public/route.ts", import.meta.url), "utf8");
const artistShelf = await readFile(new URL("../src/components/PublishedArtistsShelf.tsx", import.meta.url), "utf8");
const releaseShelf = await readFile(new URL("../src/components/PublishedAlbumsShelf.tsx", import.meta.url), "utf8");
const beatShelf = await readFile(new URL("../src/components/flow/HomeBeatRail.tsx", import.meta.url), "utf8");
const playlistShelf = await readFile(new URL("../src/components/home/HomePublicPlaylistRail.tsx", import.meta.url), "utf8");
const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
const homePage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const deferredHome = await readFile(new URL("../src/components/home/DeferredHomeSections.tsx", import.meta.url), "utf8");

for (const route of [releasesRoute, beatsRoute, playlistsRoute]) {
  assert.ok(
    route.includes("s-maxage=60") && route.includes("stale-while-revalidate=300"),
    "Cache-safe public Home discovery APIs must retain short CDN caching.",
  );
}
assert.ok(
  artistsRoute.includes("'Cache-Control': 'no-store'"),
  "Artist route must preserve fresh daily fair ordering rather than freezing an old order at the CDN.",
);

assert.ok(
  artistShelf.includes("/api/artists?limit=${limit}"),
  "Home artists must request only the visible shelf size.",
);
assert.ok(
  releaseShelf.includes("/api/releases/public?limit=6"),
  "Home releases must not fetch the full public release catalogue.",
);
assert.ok(
  beatShelf.includes("/api/beats?limit=8") &&
    !beatShelf.includes('fetch("/api/beats", { cache: "no-store" })'),
  "Home BeatStore must request only eight beats and avoid an explicit no-store fetch.",
);
assert.ok(
  playlistShelf.includes("/api/playlists/public?limit=6") &&
    playlistShelf.includes('loading="lazy"') &&
    playlistShelf.includes('decoding="async"'),
  "Home playlists must request only visible rows and lazy-load below-fold artwork.",
);

assert.ok(
  beatsRoute.includes("listPublishedBeats(publicLimit)") &&
    beatsRoute.includes("'Cache-Control': 'private, no-store'"),
  "Public beat reads may be cached, but creator-owned scope must stay private/no-store.",
);
assert.ok(
  releasesLib.includes("next: { revalidate: 60 }") &&
    beatServer.includes("next: { revalidate: 60 }") &&
    playlistsRoute.includes("next: { revalidate: 60 }"),
  "Public Supabase reads used by Home must retain server revalidation.",
);
assert.ok(
  releasesLib.includes("safeLimit") &&
    playlistsRoute.includes("candidateLimit"),
  "Server work must be bounded by requested public shelf sizes.",
);

assert.ok(
  deferredHome.includes('dynamic(() => import("@/components/home/HomeEngagementHub"), { ssr: false })') &&
    deferredHome.includes('dynamic(() => import("@/components/flow/HomeBeatRail"), { ssr: false })') &&
    deferredHome.includes('dynamic(() => import("@/components/home/HomePublicPlaylistRail"), { ssr: false })') &&
    deferredHome.includes('new IntersectionObserver') &&
    deferredHome.includes('rootMargin: "320px 0px"') &&
    deferredHome.includes('placeholderClassName="min-h-[28rem]"'),
  "Below-fold Home client sections must stay code-split and mount only near the viewport.",
);
assert.ok(
  homePage.includes("<DeferredHomeEngagementHub />") &&
    homePage.includes("<DeferredPublishedArtistsShelf limit={6} />") &&
    homePage.includes("<DeferredPublishedAlbumsShelf />") &&
    homePage.includes("<DeferredHomeBeatRail />") &&
    homePage.includes("<DeferredHomePublicPlaylistRail />") &&
    !homePage.includes("<HomeEngagementHub />") &&
    !homePage.includes("<HomeBeatRail />"),
  "Home must keep the first listening screen eager while deferring lower discovery/engagement work.",
);

// Image optimization is intentionally still disabled globally because the prior
// /api/media -> /_next/image runtime failure is a reliability constraint.
// Performance work must not silently re-enable that failure path.
assert.ok(
  nextConfig.includes("unoptimized: true"),
  "Keep global Next image optimization disabled until its media route is separately proven reliable.",
);

console.log("home load performance gates passed");
