import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
const mediaRoute = await readFile(new URL("../src/app/api/media/[...key]/route.ts", import.meta.url), "utf8");

assert.match(
  nextConfig,
  /images:\s*\{[\s\S]*?unoptimized:\s*true/,
  "BVS media reliability gate must keep Next image optimization disabled while /api/media is proxied through signed R2 redirects.",
);

for (const requiredGuard of ["safeR2Key", "isPublicR2MediaKey", "signedR2DownloadUrl"]) {
  assert.ok(
    mediaRoute.includes(requiredGuard),
    `/api/media must retain ${requiredGuard} before browser-direct media delivery is allowed.`,
  );
}

assert.ok(
  mediaRoute.includes("NextResponse.redirect"),
  "/api/media must continue redirecting authorized public media to a signed R2 URL.",
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
