import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const station = await readFile(new URL("../src/lib/station.ts", import.meta.url), "utf8");
const stationLibrary = await readFile(new URL("../src/lib/station-library.ts", import.meta.url), "utf8");
const player = await readFile(new URL("../src/components/StationPlayer.tsx", import.meta.url), "utf8");
const libraryAction = await readFile(new URL("../src/components/LibraryAction.tsx", import.meta.url), "utf8");
const artistWeb = await readFile(new URL("../src/app/artist/[slug]/page.tsx", import.meta.url), "utf8");
const artistApp = await readFile(new URL("../src/app/app/[surface]/creator/[slug]/page.tsx", import.meta.url), "utf8");

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
  "Listener save actions must be labelled rather than relying on an icon alone.",
);
assert.ok(
  player.includes('entryPoint="persistent_player"') &&
    player.includes('analyticsSource="persistent_player"') &&
    player.includes('player.toggleLike("persistent_player")'),
  "The persistent player must expose measurable Artist, Follow and Save actions without opening Now Playing first.",
);
assert.ok(
  player.includes('entry_point: entryPoint') &&
    player.includes('entry_point: entryPoint,'),
  "Player relationship/save analytics must preserve their entry point.",
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
assert.ok(
  artistWeb.includes('analyticsSource="artist_profile"') &&
    artistApp.includes('analyticsSource="artist_profile"'),
  "Web and contained-app artist profiles must attribute follow conversion to the artist profile.",
);

console.log("listener artist bridge gates passed");
