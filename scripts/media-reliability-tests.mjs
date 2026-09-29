import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
const mediaRoute = await readFile(new URL("../src/app/api/media/[...key]/route.ts", import.meta.url), "utf8");
const imageBoundary = await readFile(new URL("../src/lib/image-optimization.ts", import.meta.url), "utf8");
const checkout = await readFile(new URL("../src/app/checkout/page.tsx", import.meta.url), "utf8");
const account = await readFile(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
const homeShows = await readFile(new URL("../src/components/home/HomeShowsSection.tsx", import.meta.url), "utf8");
const showPage = await readFile(new URL("../src/app/shows/[slug]/page.tsx", import.meta.url), "utf8");

assert.ok(
  nextConfig.includes("images: {") && !nextConfig.includes("unoptimized: true"),
  "Next image optimization must stay enabled globally now that the public media redirect path is proven.",
);
assert.ok(
  imageBoundary.includes("https?:|blob:|data:"),
  "Arbitrary absolute, blob and data image sources must remain browser-direct.",
);
assert.ok(
  checkout.includes("unoptimized={shouldBypassImageOptimizer(item.artwork)}") &&
    account.includes("unoptimized={shouldBypassImageOptimizer(currentPhoto)}") &&
    homeShows.includes("unoptimized={shouldBypassImageOptimizer(show.image)}") &&
    showPage.includes("unoptimized={shouldBypassImageOptimizer(show.image)}"),
  "Dynamic checkout, preview and programme artwork must retain per-image optimizer bypass guards.",
);

for (const requiredGuard of ["safeR2Key", "isPublicR2MediaKey", "signedR2DownloadUrl"]) {
  assert.ok(
    mediaRoute.includes(requiredGuard),
    `/api/media must retain ${requiredGuard} before optimized public media delivery is allowed.`,
  );
}

assert.ok(
  mediaRoute.includes("NextResponse.redirect"),
  "/api/media must continue redirecting authorized public media to a signed R2 URL.",
);

assert.ok(
  mediaRoute.includes("RASTER_IMAGE_KEY") &&
    mediaRoute.includes("max-age=0, s-maxage=300, stale-while-revalidate=300"),
  "Authorized public raster artwork redirects should be reusable at the Vercel edge.",
);
assert.ok(
  mediaRoute.includes('"Cache-Control": "private, no-store"') &&
    mediaRoute.includes('headers["Cache-Control"] = "public, max-age=0, s-maxage=300, stale-while-revalidate=300"'),
  "Non-image media must remain private/no-store while raster images opt into shared edge reuse.",
);
assert.ok(
  !mediaRoute.includes("audio/mpeg") && !mediaRoute.includes("audio/"),
  "Media redirect caching must be extension-scoped to raster images, never audio content types.",
);
assert.ok(
  mediaRoute.includes('const RASTER_IMAGE_KEY = /\\.(?:jpe?g|png|webp|avif|gif)$/i;'),
  "Raster cache allowlist must remain limited to common non-SVG image extensions.",
);

assert.ok(
  nextConfig.includes('source: "/branding/:path*"') &&
    nextConfig.includes('max-age=3600, stale-while-revalidate=86400') &&
    nextConfig.includes('max-age=86400, stale-while-revalidate=604800'),
  "Static BVS branding must keep browser and CDN reuse headers.",
);


const playerSource = await readFile(new URL("../src/components/StationPlayer.tsx", import.meta.url), "utf8");

for (const requiredSignal of ["error_name", "media_error_message", "media_extension", "ready_state"]) {
  assert.ok(
    playerSource.includes(requiredSignal),
    `Player reliability telemetry must retain ${requiredSignal}.`,
  );
}

assert.match(
  playerSource,
  /error_name === "AbortError"\) return;/,
  "Interrupted play() promises must not be counted as broken recordings.",
);

console.log("media reliability gates passed");
