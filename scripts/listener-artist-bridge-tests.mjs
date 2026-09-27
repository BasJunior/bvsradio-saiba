import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const station = await readFile(new URL("../src/lib/station.ts", import.meta.url), "utf8");
const stationLibrary = await readFile(new URL("../src/lib/station-library.ts", import.meta.url), "utf8");
const player = await readFile(new URL("../src/components/StationPlayer.tsx", import.meta.url), "utf8");
const libraryAction = await readFile(new URL("../src/components/LibraryAction.tsx", import.meta.url), "utf8");

for (const field of ["creatorId?: string", "creatorUsername?: string"]) {
  assert.ok(station.includes(field), `Station tracks must carry ${field}.`);
}

assert.ok(
  stationLibrary.includes("profiles!tracks_user_id_fkey(id,username,is_published)"),
  "Rotation query must resolve the owning creator profile.",
);
assert.ok(
  stationLibrary.includes("track.profiles?.is_published") &&
    stationLibrary.includes("creatorId:") &&
    stationLibrary.includes("creatorUsername:"),
  "Only published creator identities may be exposed to listener navigation.",
);

assert.ok(
  player.includes("function CreatorLink") &&
    player.includes('/app/${surface}/creator/${encodeURIComponent(track.creatorId)}') &&
    player.includes('/artist/${encodeURIComponent(track.creatorUsername)}'),
  "Now Playing must route directly to the creator on contained app and web surfaces.",
);
assert.ok(
  player.includes('analyticsSource="now_playing"') &&
    player.includes('section="follows"') &&
    player.includes("CreatorFollowAction"),
  "Now Playing must expose a measurable one-tap creator follow.",
);
assert.ok(
  player.includes('player.liked ? "♥ Saved" : "♡ Save"'),
  "Full Now Playing must label the save action rather than relying on an icon alone.",
);
assert.ok(
  !player.includes("function ArtistSearchLink"),
  "Known creator identities must not be routed through the old generic artist-search helper.",
);

assert.ok(
  libraryAction.includes("analyticsSource?: string") &&
    libraryAction.includes("source: source || null"),
  "Library actions must attribute the entry point for save/follow conversion analysis.",
);

console.log("listener artist bridge gates passed");
